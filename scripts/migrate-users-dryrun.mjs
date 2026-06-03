// ═══════════════════════════════════════════════════════════════
//  USER MIGRATION — DRY RUN (read-only, zero writes)
//  Reads old prod DB, reads new Lite DB, reports what would happen.
//  Run: node scripts/migrate-users-dryrun.mjs
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";
import { writeFileSync }  from "fs";

const OLD_URL = "postgresql://neondb_owner:npg_2jrMNVBU3IkY@ep-dry-resonance-amkkbusx-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEW_URL = process.env.DATABASE_URL; // loaded from .env by Prisma default

if (!NEW_URL) {
  console.error("DATABASE_URL not set. Run: node -r dotenv/config scripts/migrate-users-dryrun.mjs");
  process.exit(1);
}

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } }, log: [] });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_URL } }, log: [] });
const oq = (sql, p = []) => oldDb.$queryRawUnsafe(sql, ...p);
const nq = (sql, p = []) => newDb.$queryRawUnsafe(sql, ...p);

// ── Role mapping ────────────────────────────────────────────────
function mapRole(oldRole) {
  if (!oldRole) return "USER";
  const r = oldRole.toLowerCase().trim();
  if (r === "superadmin" || r === "super_admin") return "SUPER_ADMIN";
  if (r === "admin")                              return "ADMIN";
  return "USER"; // member / user / anything else
}

// ── Status mapping ──────────────────────────────────────────────
function mapStatus(suspended) {
  return suspended === true ? "SUSPENDED" : "ACTIVE";
}

// ── emailVerified mapping ───────────────────────────────────────
// Old: boolean. New: DateTime? (null = unverified, timestamp = verified)
function mapEmailVerified(oldVerified, createdAt) {
  return oldVerified === true ? (createdAt ?? new Date()) : null;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║       MEMBER MIGRATION — DRY RUN REPORT              ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── 1. Load all old users ───────────────────────────────────
  const oldUsers = await oq(`
    SELECT id, name, email, "passwordHash", "googleId", role,
           "tokenVersion", "emailVerified", "suspended",
           "loginMethod", avatar, "createdAt", "updatedAt", "lastLoginAt"
    FROM "User"
    ORDER BY "createdAt" ASC
  `);

  // ── 2. Load all existing new-DB user emails (lowercase) ─────
  const existingNewRows = await nq(`SELECT id, email, role FROM users`);
  const existingEmails  = new Set(existingNewRows.map(r => r.email.toLowerCase().trim()));
  const existingNewByEmail = {};
  existingNewRows.forEach(r => { existingNewByEmail[r.email.toLowerCase().trim()] = r; });

  // ── 3. Load existing new-DB account providerAccountIds ──────
  const existingAccts = await nq(`SELECT "providerAccountId", provider FROM accounts`);
  const existingProviderIds = new Set(existingAccts.map(a => `${a.provider}:${a.providerAccountId}`));

  // ── 4. Load existing new-DB email suppressions ───────────────
  const existingSupps = await nq(`SELECT email FROM email_suppressions`);
  const existingSuppEmails = new Set(existingSupps.map(s => s.email.toLowerCase().trim()));

  // ── 5. Load old suppressions ────────────────────────────────
  const oldSuppressions = await oq(`
    SELECT id, email, reason, source, "createdAt", "removedAt", "expiresAt"
    FROM "EmailSuppression"
    ORDER BY "createdAt" ASC
  `).catch(() => []);

  // ── 6. Classify each old user ───────────────────────────────
  const toImport   = [];
  const toSkip     = [];
  const warnings   = [];
  const accountRows = []; // Account rows to create for Google users

  for (const u of oldUsers) {
    const emailNorm = (u.email ?? "").toLowerCase().trim();

    // Guard: no email
    if (!emailNorm) {
      toSkip.push({ reason: "NO_EMAIL", email: "(missing)", role: u.role });
      warnings.push(`NO_EMAIL: user id=${u.id}`);
      continue;
    }

    // Guard: email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      toSkip.push({ reason: "INVALID_EMAIL", email: emailNorm, role: u.role });
      warnings.push(`INVALID_EMAIL: ${emailNorm}`);
      continue;
    }

    // Guard: already exists in new DB
    if (existingEmails.has(emailNorm)) {
      const existing = existingNewByEmail[emailNorm];
      toSkip.push({
        reason:          "EMAIL_EXISTS_IN_NEW_DB",
        email:           emailNorm,
        role:            u.role,
        existingNewRole: existing?.role ?? "unknown",
      });
      continue;
    }

    // Guard: no auth method
    const hasPassword = !!(u.passwordHash);
    const hasGoogle   = !!(u.googleId);
    if (!hasPassword && !hasGoogle) {
      toSkip.push({ reason: "NO_AUTH_METHOD", email: emailNorm, role: u.role });
      warnings.push(`NO_AUTH_METHOD: ${emailNorm} — will need password reset`);
    }

    // Build new-user record (no writes — display only)
    const newRole   = mapRole(u.role);
    const newStatus = mapStatus(u.suspended);
    const newEmailVerified = mapEmailVerified(u.emailVerified, u.createdAt);

    const userRecord = {
      // Preserve old CUID as new id (CUIDs don't collide across DBs)
      id:                        u.id,
      name:                      u.name ?? "",
      email:                     emailNorm,
      // passwordHash field → password field (same bcrypt hash, compatible)
      password:                  u.passwordHash ?? null,
      role:                      newRole,
      status:                    newStatus,
      emailVerified:             newEmailVerified,
      image:                     u.avatar ?? null,
      tokenVersion:              typeof u.tokenVersion === "number" ? u.tokenVersion : 0,
      lastLoginAt:               u.lastLoginAt ?? null,
      lastLoginProvider:         u.loginMethod ?? null,
      // Prevent welcome email + notification on first new-site login
      welcomeEmailSentAt:        u.createdAt ?? new Date(),
      welcomeNotificationSentAt: u.createdAt ?? new Date(),
      createdAt:                 u.createdAt ?? new Date(),
      // updatedAt will be set to now() by Prisma @updatedAt
    };

    toImport.push({ user: userRecord, oldRole: u.role, hasPassword, hasGoogle, googleId: u.googleId });

    // Account row for Google-linked users
    if (hasGoogle) {
      const key = `google:${u.googleId}`;
      if (existingProviderIds.has(key)) {
        warnings.push(`GOOGLE_ACCOUNT_EXISTS: googleId ${u.googleId} already linked in new DB`);
      } else {
        accountRows.push({
          userId:            u.id, // same as userRecord.id
          type:              "oauth",
          provider:          "google",
          providerAccountId: u.googleId,
          refresh_token:     null,
          access_token:      null,
          expires_at:        null,
          token_type:        null,
          scope:             null,
          id_token:          null,
          session_state:     null,
        });
      }
    }
  }

  // ── 7. EmailSuppression plan ────────────────────────────────
  const suppsToImport = [];
  const suppsToSkip   = [];
  for (const s of oldSuppressions) {
    const emailNorm = (s.email ?? "").toLowerCase().trim();
    if (!emailNorm) { suppsToSkip.push({ reason: "NO_EMAIL" }); continue; }
    if (existingSuppEmails.has(emailNorm)) {
      suppsToSkip.push({ reason: "ALREADY_IN_NEW_DB", email: emailNorm });
      continue;
    }
    // Skip expired or removed suppressions
    const now = new Date();
    if (s.removedAt)               { suppsToSkip.push({ reason: "REMOVED",  email: emailNorm }); continue; }
    if (s.expiresAt && s.expiresAt < now) { suppsToSkip.push({ reason: "EXPIRED", email: emailNorm }); continue; }
    suppsToImport.push({ email: emailNorm, reason: s.reason ?? null, source: s.source ?? "migration", active: true, createdAt: s.createdAt });
  }

  // ── 8. Print dry-run report ─────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  OLD DATABASE SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Total old users:           ${oldUsers.length}`);
  console.log(`  Old email suppressions:    ${oldSuppressions.length}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  NEW DATABASE CURRENT STATE (will not be touched)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Existing users:            ${existingNewRows.length}`);
  existingNewRows.forEach(r => console.log(`    • role=${r.role}  (email masked for safety)`));
  console.log(`  Existing accounts:         ${existingAccts.length}`);
  console.log(`  Existing suppressions:     ${existingSupps.length}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  MIGRATION PLAN — USERS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Would import:              ${toImport.length}`);
  console.log(`  Would skip:                ${toSkip.length}`);
  console.log(`  Account rows to create:    ${accountRows.length}`);

  // Role breakdown of imports
  const roleCounts = {};
  toImport.forEach(i => { roleCounts[i.user.role] = (roleCounts[i.user.role] ?? 0) + 1; });
  console.log("\n  Import breakdown by role:");
  Object.entries(roleCounts).forEach(([r, n]) => console.log(`    ${r.padEnd(15)} → ${n} users`));

  // Auth method breakdown of imports
  const pwdCount    = toImport.filter(i => i.hasPassword).length;
  const googleCount = toImport.filter(i => i.hasGoogle).length;
  const bothCount   = toImport.filter(i => i.hasPassword && i.hasGoogle).length;
  console.log("\n  Import breakdown by auth:");
  console.log(`    Password hash (carry over): ${pwdCount}`);
  console.log(`    Google OAuth account link:  ${googleCount}`);
  console.log(`    Both (password + Google):   ${bothCount}`);

  if (toSkip.length > 0) {
    console.log("\n  SKIPPED (no writes for these):");
    toSkip.forEach(s => {
      const extra = s.existingNewRole ? ` (existing new-site role: ${s.existingNewRole})` : "";
      console.log(`    [${s.reason}] — role=${s.role}${extra}`);
    });
  }

  if (warnings.length > 0) {
    console.log("\n  WARNINGS:");
    warnings.forEach(w => console.log(`    ⚠  ${w}`));
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  MIGRATION PLAN — EMAIL SUPPRESSIONS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Would import:              ${suppsToImport.length}`);
  console.log(`  Would skip:                ${suppsToSkip.length}`);
  suppsToSkip.forEach(s => console.log(`    [${s.reason}]${s.email ? " " + s.email : ""}`));

  // ── 9. Post-migration totals (projected) ────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PROJECTED NEW DB TOTALS AFTER MIGRATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  users:             ${existingNewRows.length} existing + ${toImport.length} imported = ${existingNewRows.length + toImport.length}`);
  console.log(`  accounts:          ${existingAccts.length} existing + ${accountRows.length} imported = ${existingAccts.length + accountRows.length}`);
  console.log(`  email_suppressions:${existingSupps.length} existing + ${suppsToImport.length} imported = ${existingSupps.length + suppsToImport.length}`);

  // ── 10. Write JSON report ───────────────────────────────────
  const report = {
    runAt:       new Date().toISOString(),
    dryRun:      true,
    oldDb:       { totalUsers: oldUsers.length, suppressions: oldSuppressions.length },
    newDb:       { existingUsers: existingNewRows.length, existingAccounts: existingAccts.length },
    users: {
      toImport:  toImport.map(i => ({
        email:         i.user.email,
        oldRole:       i.oldRole,
        newRole:       i.user.role,
        status:        i.user.status,
        hasPassword:   i.hasPassword,
        hasGoogle:     i.hasGoogle,
        tokenVersion:  i.user.tokenVersion,
      })),
      toSkip: toSkip,
    },
    accounts:    { toCreate: accountRows.map(a => ({ provider: a.provider, userId: a.userId })) },
    suppressions:{ toImport: suppsToImport.length, toSkip: suppsToSkip },
    warnings,
  };

  writeFileSync("scripts/migration-dryrun-report.json", JSON.stringify(report, null, 2));
  console.log("\n  Report written → scripts/migration-dryrun-report.json");
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  DRY RUN COMPLETE — zero writes were made            ║");
  console.log("║  Approve the plan to run: migrate-users-run.mjs      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

main()
  .catch(e => { console.error("\nDRY RUN ERROR:", e.message); process.exit(1); })
  .finally(() => Promise.all([oldDb.$disconnect(), newDb.$disconnect()]));
