"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { trackEvent } from "@/lib/analytics";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function saveWork(workId: string) {
  const userId = await requireUser();
  await prisma.savedWork.upsert({
    where: { userId_workId: { userId, workId } },
    create: { userId, workId },
    update: {},
  });
  // Track save event — fire-and-forget
  void (async () => {
    try {
      const jar = await cookies();
      const visitorId = jar.get("aim-vid")?.value;
      if (visitorId) await trackEvent({ visitorId, userId, type: "SAVE_WORK", workId });
    } catch { /* never block */ }
  })();
  revalidatePath("/dashboard");
}

export async function unsaveWork(workId: string) {
  const userId = await requireUser();
  await prisma.savedWork.deleteMany({ where: { userId, workId } });
  // Track unsave event — fire-and-forget
  void (async () => {
    try {
      const jar = await cookies();
      const visitorId = jar.get("aim-vid")?.value;
      if (visitorId) await trackEvent({ visitorId, userId, type: "UNSAVE_WORK", workId });
    } catch { /* never block */ }
  })();
  revalidatePath("/dashboard");
}

export async function isWorkSaved(workId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const row = await prisma.savedWork.findUnique({
    where: { userId_workId: { userId: session.user.id, workId } },
    select: { id: true },
  });
  return row != null;
}

export async function clearAllSavedWorks() {
  const userId = await requireUser();
  await prisma.savedWork.deleteMany({ where: { userId } });
  revalidatePath("/dashboard");
}

export async function getSavedWorks() {
  const userId = await requireUser();
  return prisma.savedWork.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      work: {
        select: {
          id: true, slug: true, title: true, type: true,
          posterUrl: true, year: true, genre: true,
        },
      },
    },
  });
}

/** Dashboard-only variant — max 8 items to keep the page lightweight. */
export async function getDashboardSavedWorks() {
  const userId = await requireUser();
  return prisma.savedWork.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      work: {
        select: {
          id: true, slug: true, title: true, type: true,
          posterUrl: true, year: true, genre: true,
        },
      },
    },
  });
}
