// Read-only inspection of the old production database.
// Queries information_schema only — never reads PII, passwords, or tokens.
// Run: node scripts/inspect-old-db.mjs

import { PrismaClient } from "@prisma/client";

const OLD_DB_URL =
  "postgresql://neondb_owner:npg_2jrMNVBU3IkY@ep-dry-resonance-amkkbusx-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: { db: { url: OLD_DB_URL } },
  log: [],
});

async function q(sql, params = []) {
  return prisma.$queryRawUnsafe(sql, ...params);
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  OLD DATABASE — READ-ONLY INSPECTION");
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. All tables ──────────────────────────────────────────
  const tables = await q(`
    SELECT table_name
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    ORDER  BY table_name
  `);
  console.log("ALL TABLES:");
  tables.forEach(t => console.log("  •", t.table_name));

  // ── 2. User table columns ──────────────────────────────────
  const userTables = tables.map(t => t.table_name).filter(n =>
    n === "users" || n === "user" || n === "User" || n === "members" || n === "member"
  );
  const targetUserTable = userTables[0] ?? "users";
  console.log(`\nUSER TABLE: "${targetUserTable}"`);

  const userCols = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM   information_schema.columns
    WHERE  table_schema = 'public' AND table_name = $1
    ORDER  BY ordinal_position
  `, [targetUserTable]);

  console.log("COLUMNS:");
  userCols.forEach(c =>
    console.log(`  ${c.column_name.padEnd(32)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`)
  );

  // ── 3. Account/OAuth table ─────────────────────────────────
  const accountTables = tables.map(t => t.table_name).filter(n =>
    n === "accounts" || n === "account" || n === "oauth_accounts" || n === "provider_accounts"
  );
  const targetAccountTable = accountTables[0] ?? null;

  if (targetAccountTable) {
    console.log(`\nACCOUNT TABLE: "${targetAccountTable}"`);
    const acctCols = await q(`
      SELECT column_name, data_type, is_nullable
      FROM   information_schema.columns
      WHERE  table_schema = 'public' AND table_name = $1
      ORDER  BY ordinal_position
    `, [targetAccountTable]);
    acctCols.forEach(c =>
      console.log(`  ${c.column_name.padEnd(32)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`)
    );
  } else {
    console.log("\nACCOUNT TABLE: not found");
  }

  // ── 4. Counts ──────────────────────────────────────────────
  console.log("\n─── COUNTS ───────────────────────────────────────────");

  const [totalRow]    = await q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}"`);
  const [activeRow]   = await q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}" WHERE status IS NULL OR status = 'ACTIVE' OR status = 'active'`).catch(() => q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}"`));
  console.log(`  Total users:           ${totalRow.n}`);
  console.log(`  Active/no-status:      ${activeRow.n}`);

  // Password hash check (count non-null passwords — no values printed)
  const pwdCol = userCols.find(c =>
    ["password", "passwordhash", "password_hash", "hashed_password", "password_digest"].includes(c.column_name.toLowerCase())
  );
  if (pwdCol) {
    const [pwdRow] = await q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}" WHERE "${pwdCol.column_name}" IS NOT NULL AND "${pwdCol.column_name}" != ''`);
    console.log(`  Users with password:   ${pwdRow.n}  (field: ${pwdCol.column_name})`);
  }

  // Role breakdown (no PII — just counts per role value)
  const roleCol = userCols.find(c => ["role", "roles", "user_role"].includes(c.column_name.toLowerCase()));
  if (roleCol) {
    const roleCounts = await q(`SELECT "${roleCol.column_name}" AS role, COUNT(*)::int AS n FROM "${targetUserTable}" GROUP BY "${roleCol.column_name}" ORDER BY n DESC`);
    console.log(`  Role breakdown:`);
    roleCounts.forEach(r => console.log(`    ${String(r.role ?? "null").padEnd(20)} → ${r.n} users`));
  }

  // Email verified breakdown
  const evCol = userCols.find(c => ["emailverified", "email_verified", "verified", "is_verified"].includes(c.column_name.toLowerCase()));
  if (evCol) {
    const [evRow] = await q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}" WHERE "${evCol.column_name}" IS NOT NULL`);
    console.log(`  Email-verified users:  ${evRow.n}  (field: ${evCol.column_name})`);
  }

  // Google OAuth accounts
  if (targetAccountTable) {
    const [googleRow] = await q(`SELECT COUNT(*)::int AS n FROM "${targetAccountTable}" WHERE LOWER(provider) = 'google'`).catch(() => [{ n: "error" }]);
    console.log(`  Google OAuth accounts: ${googleRow.n}`);

    const providerRows = await q(`SELECT provider, COUNT(*)::int AS n FROM "${targetAccountTable}" GROUP BY provider ORDER BY n DESC`).catch(() => []);
    if (providerRows.length) {
      console.log(`  Providers in accounts table:`);
      providerRows.forEach(r => console.log(`    ${String(r.provider).padEnd(20)} → ${r.n}`));
    }
  }

  // Duplicate emails
  const [dupRow] = await q(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT LOWER(email), COUNT(*) FROM "${targetUserTable}"
      GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ) sub
  `);
  console.log(`  Duplicate emails:      ${dupRow.n}`);

  // Users with no email
  const [noEmailRow] = await q(`SELECT COUNT(*)::int AS n FROM "${targetUserTable}" WHERE email IS NULL OR email = ''`);
  console.log(`  Users with no email:   ${noEmailRow.n}`);

  // ── 5. Hash format sample (first char only — no hash printed) ─
  if (pwdCol) {
    const hashSamples = await q(`
      SELECT LEFT("${pwdCol.column_name}", 7) AS prefix, COUNT(*)::int AS n
      FROM "${targetUserTable}"
      WHERE "${pwdCol.column_name}" IS NOT NULL AND "${pwdCol.column_name}" != ''
      GROUP BY LEFT("${pwdCol.column_name}", 7)
      ORDER BY n DESC LIMIT 5
    `);
    console.log(`\n  Password hash prefixes (first 7 chars — confirms algorithm):`);
    hashSamples.forEach(r => console.log(`    "${r.prefix}..."  → ${r.n} users`));
  }

  // ── 6. Session table ───────────────────────────────────────
  const sessionTables = tables.map(t => t.table_name).filter(n =>
    n === "sessions" || n === "session"
  );
  if (sessionTables.length) {
    const [sessRow] = await q(`SELECT COUNT(*)::int AS n FROM "${sessionTables[0]}"`);
    console.log(`\n  Sessions (will NOT migrate): ${sessRow.n} rows in "${sessionTables[0]}"`);
  }

  // ── 7. Check enum type for role (if Postgres enum) ────────
  const enumRows = await q(`
    SELECT t.typname AS enum_name, e.enumlabel AS value
    FROM   pg_type t
    JOIN   pg_enum e ON e.enumtypid = t.oid
    WHERE  t.typname ILIKE '%role%' OR t.typname ILIKE '%status%'
    ORDER  BY t.typname, e.enumsortorder
  `);
  if (enumRows.length) {
    const grouped = {};
    enumRows.forEach(r => {
      grouped[r.enum_name] = grouped[r.enum_name] ?? [];
      grouped[r.enum_name].push(r.value);
    });
    console.log("\n─── POSTGRES ENUMS ───────────────────────────────────");
    Object.entries(grouped).forEach(([name, vals]) =>
      console.log(`  ${name}: ${vals.join(" | ")}`)
    );
  }

  // ── 8. UserPreferences / suppression tables ─────────────────
  const prefTables = tables.map(t => t.table_name).filter(n =>
    n.includes("preference") || n.includes("suppression") || n.includes("unsubscribe")
  );
  if (prefTables.length) {
    console.log("\n─── OPTIONAL TABLES (preferences / suppression) ─────");
    for (const t of prefTables) {
      const [cntRow] = await q(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      console.log(`  ${t}: ${cntRow.n} rows`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  INSPECTION COMPLETE — no data was modified");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("\nINSPECTION ERROR:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
