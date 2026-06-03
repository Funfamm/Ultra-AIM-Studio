"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export type UserPreferencesData = {
  // Notification preferences
  inAppNotifications:         boolean;
  emailNotifications:         boolean;
  newReleaseNotifications:    boolean;
  newEpisodeNotifications:    boolean;
  announcementNotifications:  boolean;
  studioUpdates:              boolean;
  // Communications system preferences (Phase 6)
  notifyMeFollowupEmails:     boolean; // CTA release-ready email
  savedWorkNotifications:     boolean; // new content on saved work
  watchReminderNotifications: boolean; // resume-watching prompts
  securityEmails:             boolean; // always true, read-only in UI
  // Playback preferences
  autoplayNextEpisode: boolean;
  resumePlayback:      boolean;
  reducedMotion:       boolean;
};

const DEFAULTS: UserPreferencesData = {
  inAppNotifications:         true,
  emailNotifications:         false,
  newReleaseNotifications:    true,
  newEpisodeNotifications:    true,
  announcementNotifications:  true,
  studioUpdates:              true,
  notifyMeFollowupEmails:     true,
  savedWorkNotifications:     true,
  watchReminderNotifications: false,
  securityEmails:             true,
  autoplayNextEpisode:        true,
  resumePlayback:             true,
  reducedMotion:              false,
};

/**
 * Get preferences for the current user.
 * Falls back to defaults if no record exists yet OR if the new columns
 * are not yet in the database (before db:push).
 */
export async function getUserPreferences(): Promise<UserPreferencesData> {
  const userId = await requireUser();

  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        inAppNotifications:         true,
        emailNotifications:         true,
        newReleaseNotifications:    true,
        newEpisodeNotifications:    true,
        announcementNotifications:  true,
        studioUpdates:              true,
        notifyMeFollowupEmails:     true,
        savedWorkNotifications:     true,
        watchReminderNotifications: true,
        securityEmails:             true,
        autoplayNextEpisode:        true,
        resumePlayback:             true,
        reducedMotion:              true,
      },
    });

    if (!prefs) return DEFAULTS;

    return {
      inAppNotifications:         prefs.inAppNotifications         ?? DEFAULTS.inAppNotifications,
      emailNotifications:         prefs.emailNotifications         ?? DEFAULTS.emailNotifications,
      newReleaseNotifications:    prefs.newReleaseNotifications    ?? DEFAULTS.newReleaseNotifications,
      newEpisodeNotifications:    prefs.newEpisodeNotifications    ?? DEFAULTS.newEpisodeNotifications,
      announcementNotifications:  prefs.announcementNotifications  ?? DEFAULTS.announcementNotifications,
      studioUpdates:              prefs.studioUpdates              ?? DEFAULTS.studioUpdates,
      notifyMeFollowupEmails:     prefs.notifyMeFollowupEmails     ?? DEFAULTS.notifyMeFollowupEmails,
      savedWorkNotifications:     prefs.savedWorkNotifications     ?? DEFAULTS.savedWorkNotifications,
      watchReminderNotifications: prefs.watchReminderNotifications ?? DEFAULTS.watchReminderNotifications,
      securityEmails:             prefs.securityEmails             ?? DEFAULTS.securityEmails,
      autoplayNextEpisode:        prefs.autoplayNextEpisode        ?? DEFAULTS.autoplayNextEpisode,
      resumePlayback:             prefs.resumePlayback             ?? DEFAULTS.resumePlayback,
      reducedMotion:              prefs.reducedMotion              ?? DEFAULTS.reducedMotion,
    };
  } catch {
    // New columns not yet in DB — return defaults until db:push
    return DEFAULTS;
  }
}

const bool = (formData: FormData, key: string) => {
  const val = formData.get(key);
  return val === "on" || val === "true" || val === "1";
};

/** Save all preferences at once (legacy — kept for compatibility). */
export async function updateUserPreferences(formData: FormData) {
  const userId = await requireUser();
  const data = {
    inAppNotifications:         bool(formData, "inAppNotifications"),
    emailNotifications:         bool(formData, "emailNotifications"),
    newReleaseNotifications:    bool(formData, "newReleaseNotifications"),
    newEpisodeNotifications:    bool(formData, "newEpisodeNotifications"),
    announcementNotifications:  bool(formData, "announcementNotifications"),
    studioUpdates:              bool(formData, "studioUpdates"),
    notifyMeFollowupEmails:     bool(formData, "notifyMeFollowupEmails"),
    savedWorkNotifications:     bool(formData, "savedWorkNotifications"),
    watchReminderNotifications: bool(formData, "watchReminderNotifications"),
    // securityEmails: always true — not editable via form
    autoplayNextEpisode:        bool(formData, "autoplayNextEpisode"),
    resumePlayback:             bool(formData, "resumePlayback"),
    reducedMotion:              bool(formData, "reducedMotion"),
  };
  try {
    await prisma.userPreferences.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  } catch { /* columns not in DB yet */ }
  revalidatePath("/dashboard/settings");
}

/** Save notification preferences only. */
export async function updateNotificationPreferences(formData: FormData) {
  const userId = await requireUser();
  const data = {
    inAppNotifications:         bool(formData, "inAppNotifications"),
    emailNotifications:         bool(formData, "emailNotifications"),
    newReleaseNotifications:    bool(formData, "newReleaseNotifications"),
    newEpisodeNotifications:    bool(formData, "newEpisodeNotifications"),
    announcementNotifications:  bool(formData, "announcementNotifications"),
    studioUpdates:              bool(formData, "studioUpdates"),
    notifyMeFollowupEmails:     bool(formData, "notifyMeFollowupEmails"),
    savedWorkNotifications:     bool(formData, "savedWorkNotifications"),
    watchReminderNotifications: bool(formData, "watchReminderNotifications"),
    // securityEmails: always true — not editable
  };
  try {
    await prisma.userPreferences.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  } catch { /* columns not in DB yet */ }
  revalidatePath("/dashboard/settings");
}

/** Save playback preferences only. */
export async function updatePlaybackPreferences(formData: FormData) {
  const userId = await requireUser();
  const data = {
    autoplayNextEpisode: bool(formData, "autoplayNextEpisode"),
    resumePlayback:      bool(formData, "resumePlayback"),
    reducedMotion:       bool(formData, "reducedMotion"),
  };
  try {
    await prisma.userPreferences.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  } catch { /* columns not in DB yet */ }
  // revalidatePath only — no redirect so the page stays in place (no black screen)
  revalidatePath("/dashboard/settings");
}
