import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";

  const works = await prisma.work.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: appUrl,                   lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${appUrl}/works`,        lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${appUrl}/about`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/contact`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const workRoutes: MetadataRoute.Sitemap = works.map((w) => ({
    url:             `${appUrl}/works/${w.slug}`,
    lastModified:    w.updatedAt,
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  return [...staticRoutes, ...workRoutes];
}
