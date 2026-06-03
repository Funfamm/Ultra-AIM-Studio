"use server";

// Outreach Center — server actions.
// sendAnnouncement:      create + publish atomically (or schedule for later). Channel + audience aware.
// sendReleaseOutreach:   release email + optional in-app. Audience + channel + scheduling support.
// sendSeasonDropOutreach: season drop email + optional in-app. Audience + channel + scheduling support.
// All admin-gated. No secrets exposed. No client bundle.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { createBulkInAppNotificationForUserIds } from "@/lib/notifications";
import {
  resolveInAppAudience,
  resolveEmailAudience,
  resolveReleaseEmailAudience,
  resolveEpisodeEmailAudience,
} from "@/lib/outreach-audience";
import {
  enqueueBulkForRecipients,
  buildAnnouncementEmail,
  buildNewReleaseEmail,
  buildNewEpisodeEmail,
  buildSeasonDropEmail,
  checkSelectedBulkProvider,
  type ReleaseStage,
} from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

// ── URL safety helper ─────────────────────────────────────────

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export type AudienceType = "all" | "admins" | "notify_me" | "saved_work" | "specific";

// ── Result type ───────────────────────────────────────────────

export type OutreachResult = {
  created?:      number;   // in-app notifications dispatched
  queued?:       number;   // EmailQueue rows created
  suppressed?:   number;
  skipped?:      number;
  error?:        string;
  scheduledFor?: string;   // ISO string when announcement was scheduled rather than sent immediately
};

// ── Admin email settings guard ───────────────────────────────

async function checkBulkEmailSettings(): Promise<{ ok: boolean; error?: string }> {
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: {
      emailSendingEnabled:      true,
      bulkEmailSendingEnabled:  true,
      notificationEmailEnabled: true,
    },
  });
  if (!settings?.emailSendingEnabled) {
    return { ok: false, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { ok: false, error: "Bulk email sending is disabled in Admin Settings → Email." };
  }
  if (!settings?.notificationEmailEnabled) {
    return { ok: false, error: "Notification emails are disabled in Admin Settings → Email." };
  }
  return { ok: true };
}

// ── Announcement (create + publish — or schedule) ────────────
// channel:     "both" | "inapp" | "email"
// scheduledAt: ISO string from a datetime-local input; if in the future → save as draft, cron publishes
// In-app uses audience-aware resolveInAppAudience (not a broadcast to all users).

export async function sendAnnouncement(
  formData: FormData,
): Promise<OutreachResult> {
  await requireAdmin();

  const title        = (formData.get("title")       as string | null)?.trim() ?? "";
  const body         = (formData.get("body")         as string | null)?.trim() ?? "";
  const href         = (formData.get("href")         as string | null)?.trim() || null;
  const hrefLabel    = (formData.get("hrefLabel")    as string | null)?.trim() || null;
  const imageUrlRaw  = (formData.get("imageUrl")     as string | null)?.trim() || null;
  const channel      = (formData.get("channel")      as string | null) ?? "both";
  const expiresRaw   = formData.get("expiresAt")     as string | null;
  const scheduleRaw  = formData.get("scheduledAt")   as string | null;
  const audienceType = (formData.get("audienceType") as string | null) ?? "all";
  const specificIdsRaw = (formData.get("specificUserIds") as string | null) ?? "[]";

  let specificUserIds: string[] = [];
  try { specificUserIds = JSON.parse(specificIdsRaw); } catch { /* invalid JSON — treat as empty */ }

  if (!title) return { error: "Title is required." };
  if (!body)  return { error: "Body is required." };

  if (audienceType === "specific" && specificUserIds.length === 0) {
    return { error: "Select at least one member to send to." };
  }

  if (href && !hrefLabel) return { error: "CTA label is required when a CTA URL is provided." };
  if (hrefLabel && !href) return { error: "CTA URL is required when a CTA label is provided." };
  if (href && !isSafeUrl(href)) return { error: "CTA URL must start with http:// or https://." };

  const imageUrl = imageUrlRaw && isSafeUrl(imageUrlRaw) ? imageUrlRaw : null;
  if (imageUrlRaw && !imageUrl) return { error: "Image URL must start with http:// or https://." };

  const expiresAt   = expiresRaw  ? new Date(expiresRaw)  : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  const scheduledAt = scheduleRaw ? new Date(scheduleRaw) : null;
  if (scheduledAt && isNaN(scheduledAt.getTime())) return { error: "Invalid scheduled date." };

  const wantsInApp = channel === "both" || channel === "inapp";
  const wantsEmail = channel === "both" || channel === "email";

  // Determine if this should be scheduled (future date) or sent immediately
  const isFuture = scheduledAt !== null && scheduledAt > new Date();

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      href,
      hrefLabel,
      sendInApp:    wantsInApp,
      sendEmail:    wantsEmail,
      expiresAt,
      audienceType,
      targetUserIds: specificUserIds.length > 0 ? JSON.stringify(specificUserIds) : null,
      scheduledAt:  scheduledAt,
      // publishedAt stays null until cron fires (scheduled) or we set it below (immediate)
      publishedAt:  isFuture ? null : new Date(),
    },
  });

  // ── Scheduled: save as draft, cron will publish at scheduledAt ──
  if (isFuture) {
    revalidatePath("/admin/outreach");
    return { scheduledFor: scheduledAt!.toISOString() };
  }

  // ── Immediate publish ─────────────────────────────────────────
  let created    = 0;
  let queued     = 0;
  let suppressed = 0;
  let skipped    = 0;

  if (wantsInApp) {
    const inAppUserIds = await resolveInAppAudience(audienceType, specificUserIds);
    const inAppResult = await createBulkInAppNotificationForUserIds(inAppUserIds, {
      type:      "ANNOUNCEMENT" as NotificationType,
      title,
      body,
      href:      href ?? undefined,
      expiresAt: expiresAt ?? undefined,
    });
    created = inAppResult.created;
  }

  if (wantsEmail) {
    const providerCheck = await checkSelectedBulkProvider();
    if (!providerCheck.ok) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: wantsInApp
          ? `In-app sent to ${created} user${created === 1 ? "" : "s"}. ${providerCheck.error}`
          : providerCheck.error,
      };
    }

    const settingsCheck = await checkBulkEmailSettings();
    if (!settingsCheck.ok) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: wantsInApp
          ? `In-app sent to ${created} user${created === 1 ? "" : "s"}. ${settingsCheck.error}`
          : settingsCheck.error,
      };
    }

    const emailUsers = await resolveEmailAudience(audienceType, specificUserIds);
    const campaignId = `announcement_${announcement.id}`;

    const emailResult = await enqueueBulkForRecipients({
      recipients: emailUsers,
      type:       "ANNOUNCEMENT",
      campaignId,
      buildEmail: (r) => buildAnnouncementEmail({
        recipientEmail: r.email,
        title,
        body,
        href,
        hrefLabel,
        imageUrl,
      }),
    });

    queued     = emailResult.queued;
    suppressed = emailResult.suppressed;
    skipped    = emailResult.skipped;

    await prisma.announcement.update({
      where: { id: announcement.id },
      data:  { emailSentAt: new Date() },
    });
  }

  await prisma.announcement.update({
    where: { id: announcement.id },
    data:  { recipientCount: created, emailQueuedCount: queued },
  });

  revalidatePath("/admin/outreach");
  return { created, queued, suppressed, skipped };
}

// ── Release Outreach ──────────────────────────────────────────
// Supports channel selection (email / inapp / both) and scheduling.
// Email scheduling: passes scheduledAt to EmailQueue — processor respects the future timestamp.
// In-app: created immediately (in-app scheduling not supported for release type).

export async function sendReleaseOutreach(
  workId:           string,
  imageUrl?:        string | null,
  stageOverride?:   ReleaseStage,
  audienceType?:    string,
  specificUserIds?: string[],
  channel?:         string,
  scheduledAt?:     Date,
): Promise<OutreachResult> {
  await requireAdmin();

  const work = await prisma.work.findUnique({
    where:  { id: workId },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      description: true, genres: true, trailerUrl: true, videoUrl: true,
    },
  });
  if (!work)                       return { error: "Work not found." };
  if (work.status !== "PUBLISHED") return { error: "Only published works can trigger release emails." };

  const releaseStage: ReleaseStage = stageOverride ??
    (work.videoUrl   ? "now_streaming" :
     work.trailerUrl ? "trailer_out"   : "coming_soon");

  const effectiveAudience = audienceType ?? "release_default";
  const wantsInApp = channel === "both" || channel === "inapp";
  const wantsEmail = !channel || channel === "both" || channel === "email";

  if (effectiveAudience === "specific" && (!specificUserIds || specificUserIds.length === 0)) {
    return { error: "Select at least one member to send to." };
  }

  let created = 0;

  // ── In-app notifications ──────────────────────────────────────
  if (wantsInApp) {
    const inAppUserIds = await resolveInAppAudience(effectiveAudience, specificUserIds);
    const inAppTitle = work.title;
    const inAppBody =
      releaseStage === "coming_soon" ? "Coming soon — save the date." :
      releaseStage === "trailer_out" ? "The trailer is now available." :
      "Now available to stream.";
    if (inAppUserIds.length > 0) {
      const result = await createBulkInAppNotificationForUserIds(inAppUserIds, {
        type:   "NEW_RELEASE" as NotificationType,
        title:  inAppTitle,
        body:   inAppBody,
        href:   `/works/${work.slug}`,
        workId: work.id,
      });
      created = result.created;
    }
  }

  // ── Email ─────────────────────────────────────────────────────
  let queued = 0, suppressed = 0, skipped = 0;
  if (wantsEmail) {
    const providerCheck = await checkSelectedBulkProvider();
    if (!providerCheck.ok) {
      revalidatePath("/admin/outreach");
      return {
        created: created || undefined,
        queued: 0, error: providerCheck.error,
      };
    }
    const settingsCheck = await checkBulkEmailSettings();
    if (!settingsCheck.ok) {
      revalidatePath("/admin/outreach");
      return {
        created: created || undefined,
        queued: 0, error: settingsCheck.error,
      };
    }

    // Stage-scoped dedup for mass sends (specific bypasses dedup)
    const campaignId = effectiveAudience === "specific"
      ? `new_release_${workId}_${releaseStage}_targeted_${Date.now()}`
      : `new_release_${workId}_${releaseStage}`;

    if (effectiveAudience !== "specific") {
      const existing = await prisma.emailQueue.count({
        where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
      });
      if (existing > 0) {
        const stageLabel =
          releaseStage === "coming_soon" ? "Coming Soon" :
          releaseStage === "trailer_out" ? "Trailer" : "Now Streaming";
        return {
          created: created || undefined,
          queued: 0,
          error: `A "${stageLabel}" email for this work has already been queued or sent (${existing} row${existing === 1 ? "" : "s"}).`,
        };
      }
    }

    const emailUsers = await resolveReleaseEmailAudience(effectiveAudience, specificUserIds);
    if (emailUsers.length === 0 && !wantsInApp) {
      return { error: "No eligible email recipients." };
    }

    const safeImageUrl = imageUrl && isSafeUrl(imageUrl) ? imageUrl : null;

    const result = await enqueueBulkForRecipients({
      recipients:  emailUsers,
      type:        "NEW_RELEASE",
      campaignId,
      scheduledAt: scheduledAt ?? undefined,
      buildEmail:  (r) => buildNewReleaseEmail({
        recipientEmail: r.email,
        workTitle:      work.title,
        workSlug:       work.slug,
        workType:       work.type,
        releaseStage,
        genres:         work.genres,
        description:    work.description,
        imageUrl:       safeImageUrl,
      }),
    });

    queued     = result.queued;
    suppressed = result.suppressed;
    skipped    = result.skipped;
  }

  revalidatePath("/admin/outreach");
  return { created: created || undefined, queued, suppressed, skipped };
}

// ── Season Drop Outreach ──────────────────────────────────────
// Industry-standard: one email per season drop, not per episode.
// Supports channel selection (email / inapp / both) and scheduling.

export async function sendSeasonDropOutreach(
  seriesId:         string,
  seasonNumber:     number,
  imageUrl?:        string | null,
  audienceType?:    string,
  specificUserIds?: string[],
  channel?:         string,
  scheduledAt?:     Date,
): Promise<OutreachResult> {
  await requireAdmin();

  const series = await prisma.work.findUnique({
    where:  { id: seriesId },
    select: { id: true, slug: true, title: true, type: true, status: true, posterUrl: true },
  });
  if (!series)                       return { error: "Series not found." };
  if (series.type !== "SERIES")      return { error: "Selected work is not a series." };
  if (series.status !== "PUBLISHED") return { error: "Series must be published." };

  const episodes = await prisma.work.findMany({
    where: { parentId: seriesId, seasonNumber, status: "PUBLISHED", type: "EPISODE" },
    select: { id: true },
  });
  if (episodes.length === 0) {
    return { error: `No published episodes found for Season ${seasonNumber} of "${series.title}".` };
  }

  const effectiveAudience = audienceType ?? "episode_default";
  const wantsInApp = channel === "both" || channel === "inapp";
  const wantsEmail = !channel || channel === "both" || channel === "email";

  if (effectiveAudience === "specific" && (!specificUserIds || specificUserIds.length === 0)) {
    return { error: "Select at least one member to send to." };
  }

  let created = 0;

  // ── In-app notifications ──────────────────────────────────────
  if (wantsInApp) {
    const inAppUserIds = await resolveInAppAudience(effectiveAudience, specificUserIds);
    if (inAppUserIds.length > 0) {
      const result = await createBulkInAppNotificationForUserIds(inAppUserIds, {
        type:   "NEW_EPISODE" as NotificationType,
        title:  `${series.title} — Season ${seasonNumber}`,
        body:   `Season ${seasonNumber} is now streaming — ${episodes.length} episode${episodes.length !== 1 ? "s" : ""} available.`,
        href:   `/works/${series.slug}`,
        workId: series.id,
      });
      created = result.created;
    }
  }

  // ── Email ─────────────────────────────────────────────────────
  let queued = 0, suppressed = 0, skipped = 0;
  if (wantsEmail) {
    const providerCheck = await checkSelectedBulkProvider();
    if (!providerCheck.ok) {
      revalidatePath("/admin/outreach");
      return {
        created: created || undefined,
        queued: 0, error: providerCheck.error,
      };
    }
    const settingsCheck = await checkBulkEmailSettings();
    if (!settingsCheck.ok) {
      revalidatePath("/admin/outreach");
      return {
        created: created || undefined,
        queued: 0, error: settingsCheck.error,
      };
    }

    const campaignId = effectiveAudience === "specific"
      ? `season_drop_${seriesId}_s${seasonNumber}_targeted_${Date.now()}`
      : `season_drop_${seriesId}_s${seasonNumber}`;

    if (effectiveAudience !== "specific") {
      const existing = await prisma.emailQueue.count({
        where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
      });
      if (existing > 0) {
        return {
          created: created || undefined,
          queued: 0,
          error: `A Season ${seasonNumber} email for "${series.title}" has already been queued or sent.`,
        };
      }
    }

    const emailUsers = await resolveEpisodeEmailAudience(effectiveAudience, specificUserIds);

    const safeImageUrl = (imageUrl && isSafeUrl(imageUrl))
      ? imageUrl
      : (series.posterUrl ?? null);

    const result = await enqueueBulkForRecipients({
      recipients:  emailUsers,
      type:        "NEW_EPISODE",
      campaignId,
      scheduledAt: scheduledAt ?? undefined,
      buildEmail:  (r) => buildSeasonDropEmail({
        recipientEmail: r.email,
        seriesTitle:    series.title,
        seriesSlug:     series.slug,
        seasonNumber,
        episodeCount:   episodes.length,
        imageUrl:       safeImageUrl,
      }),
    });

    queued     = result.queued;
    suppressed = result.suppressed;
    skipped    = result.skipped;
  }

  revalidatePath("/admin/outreach");
  return { created: created || undefined, queued, suppressed, skipped };
}

// ── Episode Outreach ──────────────────────────────────────────

export async function sendEpisodeOutreach(
  workId:   string,
  imageUrl?: string | null,
): Promise<OutreachResult> {
  await requireAdmin();

  const providerCheck = await checkSelectedBulkProvider();
  if (!providerCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: providerCheck.error };
  }
  const settingsCheck = await checkBulkEmailSettings();
  if (!settingsCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: settingsCheck.error };
  }

  const episode = await prisma.work.findUnique({
    where:  { id: workId },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      episodeNumber: true, seasonNumber: true,
      parent: { select: { id: true, slug: true, title: true } },
    },
  });

  if (!episode)                       return { queued: 0, suppressed: 0, skipped: 0, error: "Work not found." };
  if (episode.type !== "EPISODE")     return { queued: 0, suppressed: 0, skipped: 0, error: "This work is not an episode." };
  if (episode.status !== "PUBLISHED") return { queued: 0, suppressed: 0, skipped: 0, error: "Only published episodes can trigger episode emails." };
  if (!episode.parent)                return { queued: 0, suppressed: 0, skipped: 0, error: "Episode has no parent series." };

  const campaignId = `new_episode_${workId}`;
  const existing = await prisma.emailQueue.count({
    where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
  });
  if (existing > 0) {
    return {
      queued: 0, suppressed: 0, skipped: 0,
      error: `An episode email for this episode has already been queued or sent (${existing} row${existing === 1 ? "" : "s"} found).`,
    };
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: "" },
      OR: [
        { preferences: null },
        { preferences: { newEpisodeNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
  if (users.length === 0) return { queued: 0, suppressed: 0, skipped: 0, error: "No eligible recipients." };

  const safeImageUrl = imageUrl && isSafeUrl(imageUrl) ? imageUrl : null;

  const result = await enqueueBulkForRecipients({
    recipients: users,
    type:       "NEW_EPISODE",
    campaignId,
    buildEmail: (r) => buildNewEpisodeEmail({
      recipientEmail: r.email,
      seriesTitle:    episode.parent!.title,
      seriesSlug:     episode.parent!.slug,
      episodeTitle:   episode.title,
      episodeNumber:  episode.episodeNumber,
      seasonNumber:   episode.seasonNumber,
      imageUrl:       safeImageUrl,
    }),
  });

  revalidatePath("/admin/outreach");
  return { queued: result.queued, suppressed: result.suppressed, skipped: result.skipped };
}
