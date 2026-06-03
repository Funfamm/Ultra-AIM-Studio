"use server";

// Trigger Notify Me follow-up emails for a CTA's signups.
// Enqueues NOTIFY_ME_FOLLOWUP bulk emails via ACS queue.
// Checks suppression list for every address.
// For registered users: also checks notifyMeFollowupEmails preference.

import { requireAdmin } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueBulkForRecipients,
  buildNotifyMeFollowupEmail,
  checkSelectedBulkProvider,
} from "@/lib/bulk-email";


export type FollowupResult = {
  queued:     number;
  suppressed: number;
  skipped:    number;
  error?:     string;
};

export async function sendNotifyMeFollowupEmails(
  ctaId: string,
): Promise<FollowupResult> {
  await requireAdmin();

  // Selected bulk provider must be configured
  const providerCheck = await checkSelectedBulkProvider();
  if (!providerCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: providerCheck.error };
  }

  // Admin settings: both sending flags must be on
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true },
  });
  if (!settings?.emailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Bulk email sending is disabled in Admin Settings → Email." };
  }

  // Load the CTA and its work
  const cta = await prisma.notifyMeCta.findUnique({
    where:  { id: ctaId },
    select: {
      id: true,
      work: { select: { slug: true, title: true, type: true } },
    },
  });
  if (!cta) return { queued: 0, suppressed: 0, skipped: 0, error: "CTA not found." };

  // Load all signups for this CTA
  const signups = await prisma.notifyMeSignup.findMany({
    where:   { ctaId },
    select:  { email: true, name: true },
  });
  if (signups.length === 0) {
    return { queued: 0, suppressed: 0, skipped: 0 };
  }

  // Load opted-out registered users (notifyMeFollowupEmails = false)
  // We only have email addresses from signups — match against registered users.
  const signupEmails = signups.map(s => s.email.toLowerCase().trim());

  const optedOutUsers = await prisma.userPreferences.findMany({
    where: {
      notifyMeFollowupEmails: false,
      user: { email: { in: signupEmails } },
    },
    select: { user: { select: { email: true } } },
  });
  const optedOutSet = new Set(optedOutUsers.map(p => p.user.email.toLowerCase().trim()));

  // Filter out opted-out registered users before enqueueing
  const eligibleSignups = signups.filter(
    s => !optedOutSet.has(s.email.toLowerCase().trim()),
  );

  const campaignId = `notifyme_followup_${ctaId}`;
  const { slug, title: workTitle, type: workType } = cta.work;

  const result = await enqueueBulkForRecipients({
    recipients: eligibleSignups,
    type:       "NOTIFY_ME_FOLLOWUP",
    campaignId,
    buildEmail: (r) => buildNotifyMeFollowupEmail({
      recipientEmail: r.email,
      recipientName:  r.name ?? null,
      workTitle,
      workSlug:       slug,
      workType,
    }),
  });

  revalidatePath(`/admin/notify-me-ctas/${ctaId}`);
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/logs");

  return {
    queued:     result.queued,
    suppressed: result.suppressed,
    skipped:    result.skipped + (signups.length - eligibleSignups.length),
  };
}
