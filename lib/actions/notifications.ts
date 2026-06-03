"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

/**
 * Fetch up to 10 notifications for the current user (unread first, then recent).
 * Falls back to a schema-compatible query if new columns (href, expiresAt)
 * are not yet in the database (i.e. before db:push).
 */
export async function getUserNotifications(): Promise<NotificationRow[]> {
  const userId = await requireUser();
  const now = new Date();

  try {
    // Full query — works after db:push adds href + expiresAt
    return await prisma.notification.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        read: true,
        createdAt: true,
      },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: 10,
    });
  } catch {
    // Fallback — safe against missing columns before db:push
    const rows = await prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        createdAt: true,
      },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: 10,
    });
    return rows.map((r) => ({ ...r, href: null }));
  }
}

/**
 * Count unread notifications for the current user.
 * Falls back to a query without expiresAt if column doesn't exist yet.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const now = new Date();

  try {
    return await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  } catch {
    return prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });
  }
}

/** Mark a single notification as read. */
export async function markNotificationRead(notificationId: string) {
  const userId = await requireUser();

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

/** Mark all notifications for the current user as read. */
export async function markAllNotificationsRead() {
  const userId = await requireUser();

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

/** Hard-delete a single notification — ownership-verified. */
export async function clearNotification(notificationId: string) {
  const userId = await requireUser();
  await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

/** Hard-delete all read notifications for the current user. */
export async function clearReadNotifications() {
  const userId = await requireUser();
  await prisma.notification.deleteMany({ where: { userId, read: true } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

/** Hard-delete ALL notifications for the current user. */
export async function clearAllNotifications() {
  const userId = await requireUser();
  await prisma.notification.deleteMany({ where: { userId } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}
