"use server";

// Admin-triggered release email actions.
// NEW_RELEASE: queues a bulk email to opted-in registered users.
// NEW_EPISODE: queues a bulk email to opted-in registered users.
//
// Both use the selected bulk provider (AdminSettings.primaryBulkProvider).
// Admin processes the queue from /admin/email.
// No email is sent inline — everything goes through the queue.

import { requireAdmin } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueBulkForRecipients,
  buildNewReleaseEmail,
  buildNewEpisodeEmail,
  checkSelectedBulkProvider,
} from "@/lib/bulk-email";


export type ReleaseEmailResult = {
  queued:     number;
  suppressed: number;
  skipped:    number;
  error?:     string;
};

// ── NEW_RELEASE ───────────────────────────────────────────────
// Audience: active registered users with email + newReleaseNotifications enabled.
// Suppression checked inside enqueueBulkForRecipients.
// CampaignId is stable per work — enqueueBulkForRecipients does NOT deduplicate
// automatically, so we block re-sends if the campaign already has QUEUED/SENT rows.

export async function sendNewReleaseEmail(
  workId: string,
): Promise<ReleaseEmailResult> {
  await requireAdmin();

  const providerCheck = await checkSelectedBulkProvider();
  if (!providerCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: providerCheck.error };
  }

  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true, notificationEmailEnabled: true },
  });
  if (!settings?.emailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Bulk email sending is disabled in Admin Settings → Email." };
  }
  if (!settings?.notificationEmailEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Notification emails are disabled in Admin Settings → Email." };
  }

  const work = await prisma.work.findUnique({
    where:  { id: workId },
    select: { id: true, slug: true, title: true, type: true, status: true, description: true, genres: true },
  });
  if (!work)                    return { queued: 0, suppressed: 0, skipped: 0, error: "Work not found." };
  if (work.status !== "PUBLISHED") return { queued: 0, suppressed: 0, skipped: 0, error: "Only published works can trigger release emails." };

  // Guard: don't allow re-send if this campaign already has QUEUED or SENT rows
  const campaignId = `new_release_${workId}`;
  const existing = await prisma.emailQueue.count({
    where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
  });
  if (existing > 0) {
    return {
      queued: 0, suppressed: 0, skipped: 0,
      error: `A release email for this work has already been queued or sent (${existing} row${existing === 1 ? "" : "s"} found). Check /admin/email/logs.`,
    };
  }

  // Audience: active users with email notifications + new release preference enabled
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: "" },
      OR: [
        { preferences: null },   // no prefs row = opted in by default
        {
          preferences: {
            emailNewReleases:       true,
            newReleaseNotifications: true,
          },
        },
      ],
    },
    select: { email: true, name: true },
  });

  if (users.length === 0) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "No eligible recipients." };
  }

  const result = await enqueueBulkForRecipients({
    recipients: users,
    type:       "NEW_RELEASE",
    campaignId,
    buildEmail: (r) => buildNewReleaseEmail({
      recipientEmail: r.email,
      workTitle:      work.title,
      workSlug:       work.slug,
      workType:       work.type,
      genres:         work.genres,
      description:    work.description,
    }),
  });

  revalidatePath(`/admin/works/${workId}`);
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/logs");

  return {
    queued:     result.queued,
    suppressed: result.suppressed,
    skipped:    result.skipped,
  };
}

// ── NEW_EPISODE ───────────────────────────────────────────────
// Audience: active registered users with email + newEpisodeNotifications enabled.
// Only valid for EPISODE type works with a parent series.

export async function sendNewEpisodeEmail(
  workId: string,
): Promise<ReleaseEmailResult> {
  await requireAdmin();

  const providerCheck = await checkSelectedBulkProvider();
  if (!providerCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: providerCheck.error };
  }

  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true, notificationEmailEnabled: true },
  });
  if (!settings?.emailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Bulk email sending is disabled in Admin Settings → Email." };
  }
  if (!settings?.notificationEmailEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Notification emails are disabled in Admin Settings → Email." };
  }

  const episode = await prisma.work.findUnique({
    where:  { id: workId },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      episodeNumber: true, seasonNumber: true,
      parent: { select: { id: true, slug: true, title: true } },
    },
  });

  if (!episode)                      return { queued: 0, suppressed: 0, skipped: 0, error: "Work not found." };
  if (episode.type !== "EPISODE")    return { queued: 0, suppressed: 0, skipped: 0, error: "This work is not an episode." };
  if (episode.status !== "PUBLISHED") return { queued: 0, suppressed: 0, skipped: 0, error: "Only published episodes can trigger episode emails." };
  if (!episode.parent)               return { queued: 0, suppressed: 0, skipped: 0, error: "Episode has no parent series." };

  // Guard: block re-send
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

  // Audience: opted-in users with new episode preference
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: "" },
      OR: [
        { preferences: null },
        {
          preferences: {
            newEpisodeNotifications: true,
          },
        },
      ],
    },
    select: { email: true, name: true },
  });

  if (users.length === 0) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "No eligible recipients." };
  }

  const epLabel = episode.seasonNumber && episode.episodeNumber
    ? `S${episode.seasonNumber}E${episode.episodeNumber}`
    : episode.episodeNumber
      ? `Episode ${episode.episodeNumber}`
      : "New Episode";

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
    }),
  });

  revalidatePath(`/admin/works/${workId}`);
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/logs");

  return {
    queued:     result.queued,
    suppressed: result.suppressed,
    skipped:    result.skipped,
  };
}
