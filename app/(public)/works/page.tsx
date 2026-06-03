import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import WorksClient from "@/components/works-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works — AIM Studio" };

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

async function getWorks() {
  return prisma.work.findMany({
    where: {
      status: { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] },
      type: { not: "EPISODE" },
    },
    orderBy: { order: "asc" },
    select: {
      id: true, slug: true, title: true, posterUrl: true,
      heroMobileUrl: true, heroDesktopUrl: true,
      genre: true, genres: true, requiresAuth: true, type: true, status: true,
    },
  });
}

export default async function WorksPage({ searchParams }: Props) {
  const [works, { collection }, session] = await Promise.all([
    getWorks(),
    searchParams,
    auth(),
  ]);
  return <WorksClient works={works} collection={collection} isLoggedIn={!!session?.user} />;
}
