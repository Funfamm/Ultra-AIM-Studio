// ═══════════════════════════════════════════════════════════════
//  USER MIGRATION — REAL RUN
//  DO NOT RUN until dry-run has been reviewed and approved.
//  Run: node scripts/migrate-users-run.mjs
//
//  What this does:
//    1. Reads old production User table (read-only)
//    2. Skips users whose email already exists in new DB
//    3. Inserts new users into new DB (mapped fields)
//    4. Creates Account rows for Google-linked users
//    5. Writes audit report to scripts/migration-run-report.json
//    6. Never deletes, never overwrites, never touches old DB
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";
import { writeFileSync }  from "fs";

const OLD_URL = process.env.SOURCE_DATABASE_URL;
const NEW_URL = process.env.DATABASE_URL;

if (!OLD_URL) {
  console.error("SOURCE_DATABASE_URL not set. Set it to the old database connection string before running.");
  process.exit(1);
}
if (!NEW_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } }, log: [] });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_URL } }, log: [] });
const oq = (sql, p = []) => oldDb.$queryRawUnsafe(sql, ...p);
const nq = (sql, p = []) => newDb.$queryRawUnsafe(sql, ...p);

function mapRole(oldRole) {
  if (!oldRole) return "USER";
  const r = oldRole.toLowerCase().trim();
  if (r === "superadmin" || r === "super_admin") return "SUPER_ADMIN";
  if (r === "admin")                              return "ADMIN";
  return "USER";
}

function mapStatus(suspended) {
  return suspended === true ? "SUSPENDED" : "ACTIVE";
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║       MEMBER MIGRATION — REAL RUN                    ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log("Starting at:", new Date().toISOString());

  // ── Load old users ──────────────────────────────────────────
  const oldUsers = await oq(`
    SELECT id, name, email, "passwordHash", "googleId", role,
           "tokenVersion", "emailVerified", "suspended",
           "loginMethod", avatar, "createdAt", "updatedAt", "lastLoginAt"
    FROM "User" ORDER BY "createdAt" ASC
  `);

  // ── Load existing new-DB emails (lowercase) ─────────────────
  const existingRows   = await nq(`SELECT email FROM users`);
  const existingEmails = new Set(existingRows.map(r => r.email.toLowerCase().trim()));

  // ── Load existing new-DB Google account IDs ─────────────────
  const existingAccts = await nq(`SELECT "providerAccountId" FROM accounts WHERE provider = 'google'`);
  const existingGoogleIds = new Set(existingAccts.map(a => a.providerAccountId));

  const imported   = [];
  const skipped    = [];
  const errors     = [];

  // ── Process each old user ────────────────────────────────────
  for (const u of oldUsers) {
    const emailNorm = (u.email ?? "").toLowerCase().trim();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      skipped.push({ reason: "INVALID_EMAIL", id: u.id });
      continue;
    }

    if (existingEmails.has(emailNorm)) {
      skipped.push({ reason: "EMAIL_EXISTS", email: emailNorm });
      continue;
    }

    const newRole   = mapRole(u.role);
    const newStatus = mapStatus(u.suspended);
    const newEmailVerified = u.emailVerified === true ? (u.createdAt ?? new Date()) : null;
    const now = new Date();

    try {
      // ── Insert user ────────────────────────────────────────
      await newDb.$queryRawUnsafe(`
        INSERT INTO users (
          id, name, email, password, role, status,
          "emailVerified", image, "tokenVersion",
          "lastLoginAt", "lastLoginProvider",
          "welcomeEmailSentAt", "welcomeNotificationSentAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5::"Role", $6::"UserStatus",
          $7::timestamptz, $8, $9::int,
          $10::timestamptz, $11,
          $12::timestamptz, $13::timestamptz,
          $14::timestamptz, $15::timestamptz
        )
      `,
        u.id,
        u.name ?? "",
        emailNorm,
        u.passwordHash ?? null,
        newRole,
        newStatus,
        newEmailVerified,
        u.avatar ?? null,
        typeof u.tokenVersion === "number" ? u.tokenVersion : 0,
        u.lastLoginAt ?? null,
        u.loginMethod ?? null,
        u.createdAt ?? now,
        u.createdAt ?? now,
        u.createdAt ?? now,
        now,
      );

      // ── Insert Google Account row if needed ────────────────
      let accountCreated = false;
      if (u.googleId && !existingGoogleIds.has(u.googleId)) {
        await newDb.$queryRawUnsafe(`
          INSERT INTO accounts (
            "userId", type, provider, "providerAccountId",
            refresh_token, access_token, expires_at,
            token_type, scope, id_token, session_state
          ) VALUES (
            $1, $2, $3, $4,
            NULL, NULL, NULL,
            NULL, NULL, NULL, NULL
          )
        `,
          u.id, "oauth", "google", u.googleId
        );
        existingGoogleIds.add(u.googleId);
        accountCreated = true;
      }

      existingEmails.add(emailNorm);
      imported.push({
        id:             u.id,
        email:          emailNorm,
        oldRole:        u.role,
        newRole,
        status:         newStatus,
        hasPassword:    !!(u.passwordHash),
        googleAccount:  accountCreated,
      });

      console.log(`  ✓ imported  ${emailNorm}  (${u.role} → ${newRole})${accountCreated ? " [+Google]" : ""}`);

    } catch (err) {
      errors.push({ email: emailNorm, error: err.message });
      console.error(`  ✗ ERROR     ${emailNorm}  —  ${err.message}`);
    }
  }

  // ── Final counts ─────────────────────────────────────────────
  const [finalCount] = await nq(`SELECT COUNT(*)::int AS n FROM users`);
  const [finalAccts] = await nq(`SELECT COUNT(*)::int AS n FROM accounts`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  MIGRATION COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Imported:      ${imported.length}`);
  console.log(`  Skipped:       ${skipped.length}`);
  console.log(`  Errors:        ${errors.length}`);
  console.log(`  New DB users:  ${finalCount.n}`);
  console.log(`  New DB accts:  ${finalAccts.n}`);

  const report = {
    runAt:    new Date().toISOString(),
    dryRun:   false,
    imported,
    skipped,
    errors,
    finalCounts: { users: finalCount.n, accounts: finalAccts.n },
  };

  writeFileSync("scripts/migration-run-report.json", JSON.stringify(report, null, 2));
  console.log("  Report written → scripts/migration-run-report.json\n");

  if (errors.length > 0) {
    console.log("  ⚠ Some users failed — check migration-run-report.json");
    process.exit(1);
  }
}

main()
  .catch(e => { console.error("\nMIGRATION ERROR:", e.message); process.exit(1); })
  .finally(() => Promise.all([oldDb.$disconnect(), newDb.$disconnect()]));
