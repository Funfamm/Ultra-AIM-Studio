// lib/notifications.ts
// In-app notification creation utilities.
// These write to the Notification table — they are NOT email senders.
// Email queuing lives in lib/bulk-email.ts.
// These functions are called from Server Actions (never from client code).

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────

export type NotificationInput = {
  type:      NotificationType;
  title:     string;
  body?:     string;
  href?:     string;
  workId?:   string;
  expiresAt?: Date;
};

// ── Single user ───────────────────────────────────────────────

export async function createNotification(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  await prisma.notification.create({ data: { userId, ...input } });
}

// ── Bulk — all active users ───────────────────────────────────
// Respects UserPreferences.inAppNotifications.
// Batched at 200 rows per insert to stay within Neon limits.
// Returns counts for admin feedback.

const BATCH_SIZE = 200;

export async function createBulkInAppNotification(
  input: NotificationInput,
): Promise<{ created: number }> {
  // Users who are ACTIVE and have not disabled in-app notifications.
  // A user with no preferences row is treated as opted-in (defaults = true).
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { preferences: null },
        { preferences: { inAppNotifications: true } },
      ],
    },
    select: { id: true },
  });

  // Filter by notification-type preference where applicable
  const filtered = await filterByTypePreference(users.map(u => u.id), input.type);

  let created = 0;
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const result = await prisma.notification.createMany({
      data: batch.map(userId => ({ userId, ...input })),
      skipDuplicates: true,
    });
    created += result.count;
  }

  return { created };
}

// ── Bulk — specific user IDs ──────────────────────────────────
// Sends to a pre-resolved list of user IDs.
// Applies per-type preference filter. Batched at BATCH_SIZE rows.

export async function createBulkInAppNotificationForUserIds(
  userIds: string[],
  input: NotificationInput,
): Promise<{ created: number }> {
  if (userIds.length === 0) return { created: 0 };

  const filtered = await filterByTypePreference(userIds, input.type);

  let created = 0;
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const result = await prisma.notification.createMany({
      data: batch.map((userId) => ({ userId, ...input })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  return { created };
}

// ── Per-type preference filter ────────────────────────────────
// Loads preferences only for users who have a prefs row.
// Users without a row keep their slot (defaults are all true).

async function filterByTypePreference(
  userIds: string[],
  type: NotificationType,
): Promise<string[]> {
  // Only NEW_RELEASE, NEW_EPISODE, ANNOUNCEMENT are preference-gated.
  // ACCOUNT, SYSTEM, SECURITY are always delivered.
  const gated: NotificationType[] = ["NEW_RELEASE", "NEW_EPISODE", "ANNOUNCEMENT"];
  if (!gated.includes(type)) return userIds;

  // Pull the relevant preference column for these users
  const prefs = await prisma.userPreferences.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId:                   true,
      newReleaseNotifications:  true,
      newEpisodeNotifications:  true,
      announcementNotifications: true,
    },
  });

  const prefMap = new Map(prefs.map(p => [p.userId, p]));

  const prefKey: Record<string, keyof typeof prefs[number]> = {
    NEW_RELEASE:  "newReleaseNotifications",
    NEW_EPISODE:  "newEpisodeNotifications",
    ANNOUNCEMENT: "announcementNotifications",
  };

  const key = prefKey[type];

  return userIds.filter(id => {
    const p = prefMap.get(id);
    if (!p) return true; // no prefs row → opted in by default
    return p[key] !== false;
  });
}
