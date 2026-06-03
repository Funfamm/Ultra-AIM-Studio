// Check recent login attempts and throttle state for both admin accounts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const emails = ["samaderemi01@gmail.com", "aimstudio@impactaistudio.com"];

  for (const email of emails) {
    console.log(`\n=== ${email} ===`);

    // Recent login attempts
    const attempts = await prisma.loginAttempt.findMany({
      where:   { email },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { success: true, failureReason: true, createdAt: true },
    });
    console.log("Recent attempts:", attempts.length);
    attempts.forEach((a) =>
      console.log(
        `  ${a.success ? "✓" : "✗"} ${a.failureReason ?? "success"} — ${a.createdAt.toISOString()}`
      )
    );

    // User status
    const user = await prisma.user.findUnique({
      where:  { email },
      select: { status: true, role: true, tokenVersion: true, password: true },
    });
    if (user) {
      console.log(`status: ${user.status}, role: ${user.role}, tokenVersion: ${user.tokenVersion}`);
      console.log(`has password hash: ${!!user.password}`);
    } else {
      console.log("User not found!");
    }
  }

  // AdminSettings: check if credentials sign-in is enabled
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: {
      allowCredentialsSignIn: true,
      allowGoogleSignIn:      true,
      emailSendingEnabled:    true,
    },
  });
  console.log("\n=== AdminSettings ===");
  console.log(settings);
}

main().catch(console.error).finally(() => prisma.$disconnect());
