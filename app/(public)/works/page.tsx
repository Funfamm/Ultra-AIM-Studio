import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPageMedia } from "@/lib/page-media";
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
  const [works, { collection }, session, worksMedia] = await Promise.all([
    getWorks(),
    searchParams,
    auth(),
    getPageMedia("works"),
  ]);

  // First active IMAGE item for the works page background canvas
  const bgItem = worksMedia.find((m) => m.mediaType === "IMAGE") ?? null;
  const pageBg = bgItem?.imageUrl || bgItem?.posterUrl || null;

  return (
    <WorksClient
      works={works}
      collection={collection}
      isLoggedIn={!!session?.user}
      pageBg={pageBg}
    />
  );
}
