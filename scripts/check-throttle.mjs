// Check throttle state and clear blocks if needed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: { failedLoginWindowMinutes: true, failedLoginMaxAttempts: true, loginCooldownMinutes: true },
  });
  const window = settings?.failedLoginWindowMinutes ?? 15;
  const maxAttempts = settings?.failedLoginMaxAttempts ?? 5;
  const cooldown = settings?.loginCooldownMinutes ?? 15;

  const emails = ["samaderemi01@gmail.com", "aimstudio@impactaistudio.com"];

  for (const email of emails) {
    const since = new Date(Date.now() - window * 60_000);
    const failures = await prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    });
    const isBlocked = failures >= maxAttempts;
    console.log(`${email}: ${failures}/${maxAttempts} failures in last ${window}min — ${isBlocked ? "🔴 BLOCKED" : "✓ OK"}`);
  }

  console.log(`\nThrottle config: window=${window}min, maxAttempts=${maxAttempts}, cooldown=${cooldown}min`);

  // Check if aimstudio account is blocked — if so, clear recent failures
  const since = new Date(Date.now() - window * 60_000);
  const acsFailures = await prisma.loginAttempt.count({
    where: { email: "aimstudio@impactaistudio.com", success: false, createdAt: { gte: since } },
  });

  if (acsFailures >= maxAttempts) {
    // Delete recent failed attempts to unblock
    const deleted = await prisma.loginAttempt.deleteMany({
      where: {
        email: "aimstudio@impactaistudio.com",
        success: false,
        createdAt: { gte: since },
      },
    });
    console.log(`\n✓ Cleared ${deleted.count} failed attempts for aimstudio@impactaistudio.com`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
