// Fix: reset tokenVersion for samaderemi01@gmail.com so existing JWT passes the check.
// The JWT was issued before tokenVersion was incremented (from role changes),
// causing a tokenVersion mismatch that returns null session on every server auth() call.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.update({
    where: { email: "samaderemi01@gmail.com" },
    data:  { tokenVersion: 0 },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  console.log("✓ tokenVersion reset:", updated);
  console.log("\nYour existing session will now work.");
  console.log("Sign out and back in when convenient to resync the JWT.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
