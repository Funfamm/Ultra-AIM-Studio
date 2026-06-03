"use server";

// Admin-triggered email queue processor.
// Processes up to BATCH_LIMIT queued bulk emails per invocation.
// Never called from public routes — admin only.

import { requireAdmin } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { processEmailQueueBatch } from "@/lib/bulk-email";

const BATCH_LIMIT = 50;


export type QueueProcessResult = {
  processed: number;
  sent:      number;
  failed:    number;
  remaining: number;
  error?:    string;
};

// Process one batch of queued emails.
// Returns counts for admin feedback — never throws.
export async function triggerEmailQueueBatch(): Promise<QueueProcessResult> {
  await requireAdmin();

  // Check admin settings: bulk sending must be enabled
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { bulkEmailSendingEnabled: true, emailSendingEnabled: true },
  });

  if (!settings?.emailSendingEnabled) {
    return {
      processed: 0, sent: 0, failed: 0, remaining: 0,
      error: "Email sending is disabled in Admin Settings.",
    };
  }

  if (!settings?.bulkEmailSendingEnabled) {
    return {
      processed: 0, sent: 0, failed: 0, remaining: 0,
      error: "Bulk email sending is disabled in Admin Settings → Bulk Email (ACS).",
    };
  }

  let result: QueueProcessResult;
  try {
    const batchResult = await processEmailQueueBatch(BATCH_LIMIT);

    // Count remaining queued items after this batch
    const remaining = await prisma.emailQueue.count({
      where: { status: "QUEUED" },
    });

    result = {
      processed: batchResult.processed,
      sent:      batchResult.sent,
      failed:    batchResult.failed,
      remaining,
      error:     batchResult.error,
    };
  } catch (err) {
    result = {
      processed: 0, sent: 0, failed: 0, remaining: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  revalidatePath("/admin/email");
  revalidatePath("/admin/email/logs");
  return result;
}
