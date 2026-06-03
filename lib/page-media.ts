import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PageMediaItem = {
  id:           string;
  page:         string;
  mediaType:    "IMAGE" | "VIDEO";
  deviceTarget: "DESKTOP" | "MOBILE" | "BOTH";
  imageUrl:     string;
  videoUrl:     string;
  posterUrl:    string;
  altText:      string;
  sortOrder:    number;
};

export const getPageMedia = unstable_cache(
  async (page: string): Promise<PageMediaItem[]> => {
    return prisma.pageMedia.findMany({
      where:   { page, active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, page: true, mediaType: true, deviceTarget: true,
        imageUrl: true, videoUrl: true, posterUrl: true,
        altText: true, sortOrder: true,
      },
    }) as Promise<PageMediaItem[]>;
  },
  ["page-media"],
  { revalidate: 300, tags: ["page-media"] },
);
