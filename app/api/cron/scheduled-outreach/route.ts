/**
 * GET /api/cron/scheduled-outreach
 *
 * Processes announcements that have a scheduledAt time ≤ now and are still unpublished.
 * Called by Vercel Cron every 5 minutes: "* /5 * * * *"
 *
 * Authorization: Vercel sends `Authorization: Bearer ${CRON_SECRET}` — we verify it.
 * Idempotent: marks publishedAt before doing work to prevent double-publish.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBulkInAppNotificationForUserIds } from "@/lib/notifications";
import { resolveInAppAudience, resolveEmailAudience } from "@/lib/outreach-audience";
import {
  enqueueBulkForRecipients,
  buildAnnouncementEmail,
  checkSelectedBulkProvider,
} from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Verify Vercel cron authorization
  const auth = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find announcements due for publishing
  const due = await prisma.announcement.findMany({
    where: {
      publishedAt: null,
      scheduledAt: { not: null, lte: now },
    },
    take: 50, // safety cap per cron tick
  });

  if (due.length === 0) {
    return NextResponse.json({ published: 0, due: 0 });
  }

  let published = 0;
  const errors: string[] = [];

  for (const announcement of due) {
    try {
      // ── Idempotent lock — mark published before side-effects ──
      const updated = await prisma.announcement.updateMany({
        where: { id: announcement.id, publishedAt: null },
        data:  { publishedAt: now },
      });
      // If another cron tick already grabbed this, skip
      if (updated.count === 0) continue;

      // Parse stored specific user IDs for "specific" audience
      let targetUserIds: string[] = [];
      if (announcement.targetUserIds) {
        try { targetUserIds = JSON.parse(announcement.targetUserIds); } catch { /* ignore */ }
      }

      let created = 0;
      let queued  = 0;

      // ── In-app (audience-aware) ────────────────────────────────
      if (announcement.sendInApp) {
        const inAppUserIds = await resolveInAppAudience(
          announcement.audienceType,
          targetUserIds,
          announcement.type as Parameters<typeof resolveInAppAudience>[2],
        );
        const result = await createBulkInAppNotificationForUserIds(inAppUserIds, {
          type:      announcement.type as NotificationType,
          title:     announcement.title,
          body:      announcement.body,
          href:      announcement.href ?? undefined,
          expiresAt: announcement.expiresAt ?? undefined,
        });
        created = result.created;
      }

      // ── Bulk email (audience-aware) ────────────────────────────
      if (announcement.sendEmail) {
        const providerCheck = await checkSelectedBulkProvider();
        if (providerCheck.ok) {
          const emailUsers = await resolveEmailAudience(
            announcement.audienceType,
            targetUserIds,
          );
          const campaignId = `announcement_${announcement.id}`;
          const result = await enqueueBulkForRecipients({
            recipients: emailUsers,
            type:       "ANNOUNCEMENT",
            campaignId,
            buildEmail: (r) => buildAnnouncementEmail({
              recipientEmail: r.email,
              title:          announcement.title,
              body:           announcement.body,
              href:           announcement.href,
              hrefLabel:      announcement.hrefLabel,
            }),
          });
          queued = result.queued;

          await prisma.announcement.update({
            where: { id: announcement.id },
            data:  { emailSentAt: now },
          });
        }
      }

      // Update delivery counts
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: queued },
      });

      published++;
    } catch (err) {
      errors.push(`${announcement.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ published, due: due.length, errors });
}
