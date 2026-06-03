// Diagnostic script — check admin tokenVersions + AdminSettings column presence
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Admin accounts ===");
  const admins = await prisma.user.findMany({
    where: { role: { not: "USER" } },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  console.table(admins);

  console.log("\n=== AdminSettings singleton ===");
  try {
    const s = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
    if (!s) {
      console.log("⚠ No AdminSettings singleton row found — will be auto-created on next visit.");
    } else {
      // Check the security policy fields specifically
      const fields = [
        "failedLoginWindowMinutes",
        "failedLoginMaxAttempts",
        "loginCooldownMinutes",
        "notifyUserOnNewDevice",
        "notifyUserOnNewLocation",
        "notifyAdminOnSuspiciousAdminLogin",
        "allowUserDeviceTrust",
        "requireReauthForSensitiveActions",
        "allowHardPurgeForSuperAdmin",
      ];
      const present = fields.filter((f) => f in s);
      const missing = fields.filter((f) => !(f in s));
      console.log("Security policy fields present:", present.length, "/", fields.length);
      if (missing.length) console.log("MISSING columns:", missing);
      else console.log("✓ All security policy columns present in DB row.");
      console.log("updatedAt:", s.updatedAt);
    }
  } catch (err) {
    console.error("✗ AdminSettings query failed:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
