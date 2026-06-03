"use server";

// Server actions for admin announcement management.
// Guards: requireAdmin() on every mutation.
// No secrets exposed. No client bundle.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { createBulkInAppNotificationForUserIds } from "@/lib/notifications";
import { resolveInAppAudience, resolveEmailAudience } from "@/lib/outreach-audience";
import { enqueueBulkForRecipients, buildAnnouncementEmail, checkSelectedBulkProvider } from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

// ── Create draft announcement ─────────────────────────────────
// Signature is compatible with React useActionState:
// (prevState: { error: string | undefined }, formData: FormData) => Promise<{ error: string | undefined }>

export async function createAnnouncement(
  _prevState: { error: string | undefined },
  formData: FormData,
): Promise<{ error: string | undefined }> {
  await requireAdmin();

  const title     = (formData.get("title")     as string | null)?.trim() ?? "";
  const body      = (formData.get("body")       as string | null)?.trim() ?? "";
  const href      = (formData.get("href")       as string | null)?.trim() || null;
  const hrefLabel = (formData.get("hrefLabel")  as string | null)?.trim() || null;
  const sendEmail = formData.get("sendEmail") === "on";
  const expiresRaw = formData.get("expiresAt") as string | null;

  if (!title) return { error: "Title is required." };
  if (!body)  return { error: "Body is required." };

  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  await prisma.announcement.create({
    data: {
      title,
      body,
      href,
      hrefLabel,
      sendInApp: true,          // always true for now
      sendEmail,
      expiresAt,
      publishedAt: null,        // draft — not published yet
    },
  });

  revalidatePath("/admin/outreach");
  return { error: undefined };
}

// ── Publish announcement ──────────────────────────────────────
// Sets publishedAt and creates in-app notifications for all active users.
// If sendEmail = true and ACS is configured, queues bulk emails.

export async function publishAnnouncement(
  id: string,
): Promise<{ error?: string; created?: number; queued?: number }> {
  await requireAdmin();

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement)            return { error: "Announcement not found." };
  if (announcement.publishedAt) return { error: "Already published." };

  // Parse stored targetUserIds for "specific" audience
  let targetUserIds: string[] = [];
  if (announcement.targetUserIds) {
    try { targetUserIds = JSON.parse(announcement.targetUserIds); } catch { /* ignore */ }
  }

  // Mark published
  await prisma.announcement.update({
    where: { id },
    data:  { publishedAt: new Date() },
  });

  // ── In-app (audience-aware) ────────────────────────────────────
  let created = 0;
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

  // ── Bulk email (audience-aware) ────────────────────────────────
  let queued = 0;
  if (announcement.sendEmail) {
    const providerCheck = await checkSelectedBulkProvider();
    if (!providerCheck.ok) {
      await prisma.announcement.update({
        where: { id },
        data:  { recipientCount: created },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: `In-app sent. Email not queued: ${providerCheck.error}`,
      };
    }

    const emailUsers = await resolveEmailAudience(announcement.audienceType, targetUserIds);
    const campaignId = `announcement_${id}`;

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

    await prisma.announcement.update({
      where: { id },
      data:  { emailSentAt: new Date() },
    });

    queued = result.queued;
  }

  await prisma.announcement.update({
    where: { id },
    data:  { recipientCount: created, emailQueuedCount: queued },
  });

  revalidatePath("/admin/outreach");
  return { created, queued };
}

// ── Unpublish / archive ───────────────────────────────────────
// Sets publishedAt = null (back to draft). Does NOT delete notifications.

export async function unpublishAnnouncement(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.announcement.update({
    where: { id },
    data:  { publishedAt: null },
  });

  revalidatePath("/admin/outreach");
  return {};
}

// ── Delete announcement ───────────────────────────────────────
// Hard delete. Does NOT delete Notification rows already sent.

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.announcement.delete({ where: { id } });

  revalidatePath("/admin/outreach");
  return {};
}
