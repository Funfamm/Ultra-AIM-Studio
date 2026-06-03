// Seed script — creates the first ADMIN user
// Run: npx ts-node prisma/seed.ts  (or add to package.json scripts)
// Only run once after db:push

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@aimstudio.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  const name = "AIM Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, password: hashed, name, role: "ADMIN" },
  });

  console.log(`✅ Admin user created: ${user.email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ⚠  Change the password after first login!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
