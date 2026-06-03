// Follow-up read-only queries — targeted specifics for migration planning.
import { PrismaClient } from "@prisma/client";

const OLD_DB_URL =
  "postgresql://neondb_owner:npg_2jrMNVBU3IkY@ep-dry-resonance-amkkbusx-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: { db: { url: OLD_DB_URL } },
  log: [],
});
const q = (sql, p = []) => prisma.$queryRawUnsafe(sql, ...p);

async function main() {
  console.log("\n═══ TARGETED MIGRATION ANALYSIS ═══\n");

  // Google vs password breakdown
  const [googleOnly]   = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE "googleId" IS NOT NULL AND ("passwordHash" IS NULL OR "passwordHash" = '')`);
  const [pwdOnly]      = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE ("googleId" IS NULL OR "googleId" = '') AND "passwordHash" IS NOT NULL AND "passwordHash" != ''`);
  const [both]         = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE "googleId" IS NOT NULL AND "passwordHash" IS NOT NULL AND "passwordHash" != ''`);
  const [neither]      = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE ("googleId" IS NULL OR "googleId" = '') AND ("passwordHash" IS NULL OR "passwordHash" = '')`);

  console.log("AUTH METHOD BREAKDOWN:");
  console.log(`  Google only (no password):  ${googleOnly.n}`);
  console.log(`  Password only (no Google):  ${pwdOnly.n}`);
  console.log(`  Both Google + password:     ${both.n}`);
  console.log(`  Neither (no auth method):   ${neither.n}`);

  // Suspended users
  const [susp] = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE suspended = true`);
  console.log(`\nSUSPENDED USERS:             ${susp.n}`);

  // loginMethod values
  const loginMethods = await q(`SELECT "loginMethod", COUNT(*)::int AS n FROM "User" GROUP BY "loginMethod" ORDER BY n DESC`);
  console.log("\nLOGIN METHOD VALUES:");
  loginMethods.forEach(r => console.log(`  "${r.loginMethod ?? "null"}"  → ${r.n}`));

  // EmailSuppression table
  const [suppCount] = await q(`SELECT COUNT(*)::int AS n FROM "EmailSuppression"`).catch(() => [{ n: "table not found" }]);
  console.log(`\nEmailSuppression rows:       ${suppCount.n}`);

  // EmailSuppression columns
  const suppCols = await q(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='EmailSuppression' ORDER BY ordinal_position
  `).catch(() => []);
  if (suppCols.length) {
    console.log("EmailSuppression columns:");
    suppCols.forEach(c => console.log(`  ${c.column_name.padEnd(20)} ${c.data_type}`));
  }

  // UserNotificationPreference
  const [prefCount] = await q(`SELECT COUNT(*)::int AS n FROM "UserNotificationPreference"`).catch(() => [{ n: "table not found" }]);
  console.log(`\nUserNotificationPreference:  ${prefCount.n}`);

  // New-site DB — check existing users count (to know what we'd be merging into)
  // (using same connection just to confirm old DB is isolated — we won't mix)

  // Role + googleId cross-tab
  const roleGoogle = await q(`
    SELECT role,
           COUNT(*)::int AS total,
           COUNT(CASE WHEN "googleId" IS NOT NULL THEN 1 END)::int AS has_google,
           COUNT(CASE WHEN "passwordHash" IS NOT NULL THEN 1 END)::int AS has_password
    FROM "User"
    GROUP BY role ORDER BY total DESC
  `);
  console.log("\nROLE × AUTH METHOD:");
  roleGoogle.forEach(r =>
    console.log(`  ${r.role.padEnd(15)} total=${r.total}  google=${r.has_google}  password=${r.has_password}`)
  );

  // Confirm bcrypt variant on superadmin (no value — just prefix)
  const [saRow] = await q(`SELECT LEFT("passwordHash", 7) AS prefix FROM "User" WHERE role = 'superadmin' AND "passwordHash" IS NOT NULL LIMIT 1`).catch(() => [null]);
  if (saRow) console.log(`\nSuperadmin hash prefix: "${saRow.prefix}..."`);

  // tokenVersion values
  const tvRows = await q(`SELECT "tokenVersion", COUNT(*)::int AS n FROM "User" GROUP BY "tokenVersion" ORDER BY "tokenVersion"`);
  console.log("\ntokenVersion distribution:");
  tvRows.forEach(r => console.log(`  tokenVersion=${r.tokenVersion}  → ${r.n} users`));

  console.log("\n═══ DONE ═══\n");
}

main()
  .catch(e => { console.error("ERROR:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
