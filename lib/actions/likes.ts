"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent, getOrCreateSession } from "@/lib/analytics";
import { cookies } from "next/headers";

export async function likeWork(workId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.workLike.upsert({
    where: { userId_workId: { userId: session.user.id, workId } },
    create: { userId: session.user.id, workId },
    update: {},
  });

  // Fire analytics — best-effort, non-blocking
  const jar = await cookies();
  const visitorId = jar.get("aim-vid")?.value;
  if (visitorId) {
    getOrCreateSession({ visitorId, userId: session.user.id })
      .then((sessionId) =>
        trackEvent({ visitorId, userId: session.user.id, sessionId, type: "LIKE_WORK", workId })
      )
      .catch(() => {});
  }
}

export async function unlikeWork(workId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.workLike.deleteMany({
    where: { userId: session.user.id, workId },
  });

  const jar = await cookies();
  const visitorId = jar.get("aim-vid")?.value;
  if (visitorId) {
    getOrCreateSession({ visitorId, userId: session.user.id })
      .then((sessionId) =>
        trackEvent({ visitorId, userId: session.user.id, sessionId, type: "UNLIKE_WORK", workId })
      )
      .catch(() => {});
  }
}

export async function getWorkLikeState(workId: string): Promise<{
  isLiked: boolean;
  likeCount: number;
}> {
  const session = await auth();
  const userId = session?.user?.id;

  const [likeCount, likeRow] = await Promise.all([
    prisma.workLike.count({ where: { workId } }),
    userId
      ? prisma.workLike.findUnique({
          where: { userId_workId: { userId, workId } },
          select: { id: true },
        })
      : null,
  ]);

  return { isLiked: !!likeRow, likeCount };
}
