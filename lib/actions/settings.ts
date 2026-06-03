"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { AdminSettings } from "@prisma/client";


// ── Read ──────────────────────────────────────────────────────
export async function getSettings(): Promise<AdminSettings> {
  await requireAdmin();
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  if (settings) return settings;

  // First load — create the singleton row with all schema defaults
  return prisma.adminSettings.create({ data: { id: "singleton" } });
}

// ── Helper: upsert helper ─────────────────────────────────────
async function upsert(data: Partial<Omit<AdminSettings, "id" | "updatedAt">>) {
  await prisma.adminSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  revalidatePath("/admin/settings");
}

// ── Section 1: Email ──────────────────────────────────────────
export async function saveEmailSettings(formData: FormData) {
  await requireAdmin();
  await upsert({
    emailSendingEnabled:       formData.get("emailSendingEnabled")       === "true",
    primaryEmailProvider:      (formData.get("primaryEmailProvider") as string) || "graph",
    testEmailRecipient:        (formData.get("testEmailRecipient") as string) || null,
    fromDisplayName:           (formData.get("fromDisplayName") as string) || "AIM Studio",
    replyToEmail:              (formData.get("replyToEmail") as string) || null,
    adminAlertEmail:           (formData.get("adminAlertEmail") as string) || null,
    welcomeEmailEnabled:       formData.get("welcomeEmailEnabled")       === "true",
    passwordResetEmailEnabled: formData.get("passwordResetEmailEnabled") === "true",
    notificationEmailEnabled:  formData.get("notificationEmailEnabled")  === "true",
  });
}

// ── Section 2: Content Access ─────────────────────────────────
export async function saveContentAccessSettings(formData: FormData) {
  await requireAdmin();
  await upsert({
    defaultRequireLoginToWatch:       formData.get("defaultRequireLoginToWatch")       === "true",
    defaultRequireLoginToViewTrailer: formData.get("defaultRequireLoginToViewTrailer") === "true",
    allowPublicProjectDetails:        formData.get("allowPublicProjectDetails")        === "true",
    showLockedContentInCatalog:       formData.get("showLockedContentInCatalog")       === "true",
  });
}

// ── Section 3: Feature Visibility ────────────────────────────
export async function saveFeatureSettings(formData: FormData) {
  await requireAdmin();
  await upsert({
    showCasting:           formData.get("showCasting")           === "true",
    showScripts:           formData.get("showScripts")           === "true",
    showTraining:          formData.get("showTraining")          === "true",
    showSponsors:          formData.get("showSponsors")          === "true",
    showDonations:         formData.get("showDonations")         === "true",
    showCommunityComments: formData.get("showCommunityComments") === "true",
    showWatchParty:        formData.get("showWatchParty")        === "true",
    showNotifications:     formData.get("showNotifications")     === "true",
  });
}

// ── Section 4: Notifications ──────────────────────────────────
export async function saveNotificationSettings(formData: FormData) {
  await requireAdmin();
  await upsert({
    inAppNotificationsEnabled:        formData.get("inAppNotificationsEnabled")        === "true",
    newReleaseNotificationsEnabled:   formData.get("newReleaseNotificationsEnabled")   === "true",
    newEpisodeNotificationsEnabled:   formData.get("newEpisodeNotificationsEnabled")   === "true",
    announcementNotificationsEnabled: formData.get("announcementNotificationsEnabled") === "true",
  });
}

// ── Section 5: Playback ───────────────────────────────────────
export async function savePlaybackSettings(formData: FormData) {
  await requireAdmin();
  await upsert({
    defaultAutoplayNextEpisode: formData.get("defaultAutoplayNextEpisode") === "true",
    defaultResumePlayback:      formData.get("defaultResumePlayback")      === "true",
    defaultVideoPreload:        (formData.get("defaultVideoPreload") as string) || "none",
  });
}

// ── Section 5b: Bulk Email ────────────────────────────────────
export async function saveBulkEmailSettings(formData: FormData) {
  await requireAdmin();
  const raw      = (formData.get("primaryBulkProvider") as string ?? "").toLowerCase();
  const provider = ["acs", "graph", "smtp"].includes(raw) ? raw : "acs";
  await upsert({
    bulkEmailSendingEnabled: formData.get("bulkEmailSendingEnabled") === "true",
    primaryBulkProvider:     provider,
    testBulkEmailRecipient:  (formData.get("testBulkEmailRecipient") as string) || null,
  });
  revalidatePath("/admin/email");
}

// ── Section 6: Security / Auth ────────────────────────────────

export async function saveSecuritySettings(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const allowGoogle      = formData.get("allowGoogleSignIn")      === "true";
  const allowCredentials = formData.get("allowCredentialsSignIn") === "true";

  // Safety: cannot disable both auth methods
  if (!allowGoogle && !allowCredentials) {
    return { ok: false, error: "At least one sign-in method must remain enabled." };
  }

  await upsert({
    allowGoogleSignIn:      allowGoogle,
    allowCredentialsSignIn: allowCredentials,
    allowNewRegistrations:  formData.get("allowNewRegistrations") === "true",
  });

  return { ok: true };
}

// ── Section 7: Security Policies ─────────────────────────────
export async function saveSecurityPolicySettings(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const windowMins   = parseInt(formData.get("failedLoginWindowMinutes") as string, 10);
  const maxAttempts  = parseInt(formData.get("failedLoginMaxAttempts") as string, 10);
  const cooldownMins = parseInt(formData.get("loginCooldownMinutes") as string, 10);

  if (!windowMins || windowMins < 1 || maxAttempts < 1 || cooldownMins < 1) {
    return { ok: false, error: "Throttle values must be positive numbers." };
  }

  await upsert({
    failedLoginWindowMinutes:          windowMins,
    failedLoginMaxAttempts:            maxAttempts,
    loginCooldownMinutes:              cooldownMins,
    notifyUserOnNewDevice:             formData.get("notifyUserOnNewDevice")             === "true",
    notifyUserOnNewLocation:           formData.get("notifyUserOnNewLocation")           === "true",
    notifyAdminOnSuspiciousAdminLogin: formData.get("notifyAdminOnSuspiciousAdminLogin") === "true",
    allowUserDeviceTrust:              formData.get("allowUserDeviceTrust")              === "true",
    requireReauthForSensitiveActions:  formData.get("requireReauthForSensitiveActions")  === "true",
    allowHardPurgeForSuperAdmin:       formData.get("allowHardPurgeForSuperAdmin")       === "true",
  });

  return { ok: true };
}
