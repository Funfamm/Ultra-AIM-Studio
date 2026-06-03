import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

// Load DATABASE_URL from .env
const envLines = readFileSync(".env", "utf8").split("\n");
for (const line of envLines) {
  const m = line.match(/^([^#=\s]+)\s*=\s*["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.work.findFirst({ where: { slug: "luminous" } });
  if (existing) {
    console.log("Work already exists:", existing.title);
    return;
  }

  const work = await prisma.work.create({
    data: {
      slug: "luminous",
      type: "SHORT_FILM",
      status: "PUBLISHED",
      title: "Luminous",
      description: "A short film about light, memory, and what we leave behind.",
      posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80",
      genre: "Drama",
      year: 2025,
      duration: 12,
      director: "AIM Studio",
      featured: true,
      showOnHome: true,
      requiresAuth: false,
      order: 1,
    },
  });

  console.log("Created work:", work.title, "(" + work.type + ")");
}

main().catch(console.error).finally(() => prisma.$disconnect());
