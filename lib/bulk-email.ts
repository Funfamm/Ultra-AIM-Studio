// lib/bulk-email.ts
// Bulk email queue ingestion and processing.
//
// Architecture:
//   - All bulk sends go through EmailQueue first (never inline).
//   - Active bulk provider is configured in AdminSettings.primaryBulkProvider.
//     Admin selects: "graph" | "acs" | "smtp" in /admin/email?tab=settings.
//   - Microsoft Graph can handle bulk while ACS domain is not yet verified.
//   - ACS is the preferred long-term bulk provider (announcements, campaigns).
//   - SMTP is an emergency fallback — currently not fully implemented.
//   - If selected provider is not configured, sends fail with a clear error.
//   - Every queued email respects EmailSuppression and UserPreferences.
//   - Every send attempt is logged in EmailLog.
//
// Caller contract:
//   1. Call checkSelectedBulkProvider() to verify the active provider is ready.
//   2. Check user preference before calling enqueueFor*().
//   3. Call enqueueFor*() — this writes EmailQueue rows in safe batches.
//   4. Call processEmailQueueBatch() separately (admin trigger / cron).

import { prisma } from "@/lib/prisma";
import { buildUnsubscribeUrl, buildPreferencesUrl } from "@/lib/unsubscribe";
import type { EmailType, EmailProvider, Prisma } from "@prisma/client";

// ── Release stage ─────────────────────────────────────────────
// Describes the availability state of a work at time of email send.
// coming_soon  — no trailer, no video (in production / announced only)
// trailer_out  — trailer URL present but no full video yet
// now_streaming — full video available
export type ReleaseStage = "coming_soon" | "trailer_out" | "now_streaming";

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_NAME = "AIM Studio";

// ── Provider configuration checks ────────────────────────────

export function isAcsConfigured(): boolean {
  return !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);
}

export function isGraphConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER
  );
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

// ── Active provider readiness check ──────────────────────────
// Reads AdminSettings.primaryBulkProvider and validates the selected
// provider is configured. Returns a clear error if not ready.
// Use this in outreach actions instead of isAcsConfigured() directly.

export async function checkSelectedBulkProvider(): Promise<{
  ok:       boolean;
  provider: string;
  error?:   string;
}> {
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { primaryBulkProvider: true },
  });
  const provider = ((settings?.primaryBulkProvider ?? "acs").toLowerCase()) as "acs" | "graph" | "smtp";

  if (provider === "acs" && !isAcsConfigured()) {
    return {
      ok: false, provider,
      error: "Bulk provider is set to ACS but ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS are not configured. Switch to Graph in Email Settings.",
    };
  }
  if (provider === "graph" && !isGraphConfigured()) {
    return {
      ok: false, provider,
      error: "Bulk provider is set to Graph but Microsoft Graph credentials are not configured. Check AZURE_CLIENT_ID, AZURE_TENANT_ID, GRAPH_EMAIL_SENDER.",
    };
  }
  if (provider === "smtp") {
    if (!isSmtpConfigured()) {
      return {
        ok: false, provider,
        error: "Bulk provider is set to SMTP but SMTP_HOST / SMTP_USER are not configured.",
      };
    }
    // SMTP is detected as configured but sending is not yet implemented
    return {
      ok: false, provider,
      error: "SMTP bulk sending is not yet implemented. Select ACS or Graph in Email Settings.",
    };
  }
  return { ok: true, provider };
}

// ── Base email template (dark cinematic — matches lib/email.ts) ──
// Includes unsubscribe footer on every bulk email.

function bulkBaseTemplate(opts: {
  title:          string;
  bodyHtml:       string;
  recipientEmail: string;
  preheader?:     string;
}): string {
  const unsubUrl   = buildUnsubscribeUrl(opts.recipientEmail);
  const prefsUrl   = buildPreferencesUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <!-- Logo -->
          <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">
            AIM<span style="color:#e8c97e;">Studio</span>
          </p>
          <!-- Title -->
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;line-height:1.3;">
            ${opts.title}
          </h1>
          <!-- Body -->
          ${opts.bodyHtml}
          <!-- Divider -->
          <hr style="margin:28px 0;border:none;border-top:1px solid #2a2a2a;">
          <!-- Footer -->
          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;line-height:1.6;">
            You are receiving this email because you have an account on AIM Studio.
          </p>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.6;">
            <a href="${prefsUrl}" style="color:#6b7280;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${unsubUrl}" style="color:#6b7280;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared helpers ────────────────────────────────────────────

function htmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Renders a safe, email-client-compatible image block.
 * Only called with http/https URLs (validated at action layer).
 * Falls back gracefully if image fails to load (display:block keeps layout intact).
 */
function safeImageBlock(imageUrl: string | null | undefined, altText: string): string {
  if (!imageUrl) return "";
  return `<img src="${imageUrl}" alt="${htmlEsc(altText)}" width="440"
    style="width:100%;max-width:440px;height:auto;border-radius:4px;
           margin:0 0 20px;display:block;border:0;" />`;
}

// ── Email template builders ───────────────────────────────────

export function buildNewReleaseEmail(opts: {
  recipientEmail: string;
  workTitle:      string;
  workSlug:       string;
  workType:       string;
  releaseStage?:  ReleaseStage;
  genres?:        string[];
  description?:   string | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const stage      = opts.releaseStage ?? "now_streaming";
  const watchHref  = opts.workType === "SERIES"
    ? `${APP_URL}/watch/${opts.workSlug}`
    : `${APP_URL}/watch/${opts.workSlug}?full=1`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const typeLabel  = opts.workType === "SERIES" ? "New Series" : "New Release";
  const genreText  = opts.genres?.slice(0, 3).join(" · ") ?? "";
  const descText   = opts.description
    ? opts.description.slice(0, 200) + (opts.description.length > 200 ? "…" : "")
    : null;

  let subject:   string;
  let leadText:  string;
  let ctaBlock:  string;
  let preheader: string;

  if (stage === "coming_soon") {
    subject   = `Coming Soon: ${opts.workTitle}`;
    leadText  = descText ?? `${opts.workTitle} is coming to AIM Studio. Stay tuned.`;
    preheader = `Coming soon to AIM Studio — ${opts.workTitle}`;
    ctaBlock  = `
      <a href="${detailHref}"
         style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
        View Details
      </a>`;
  } else if (stage === "trailer_out") {
    subject   = `Watch the Trailer: ${opts.workTitle}`;
    leadText  = descText ?? `The first trailer for ${opts.workTitle} is here.`;
    preheader = `The trailer for ${opts.workTitle} is here`;
    ctaBlock  = `
      <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="padding-right:8px;">
            <a href="${detailHref}"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
              Watch Trailer
            </a>
          </td>
          <td>
            <a href="${detailHref}"
               style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                      text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
              View Details
            </a>
          </td>
        </tr>
      </table>`;
  } else {
    // now_streaming
    subject   = `${typeLabel}: ${opts.workTitle}`;
    leadText  = descText ?? `${opts.workTitle} is now available to watch on AIM Studio.`;
    preheader = `${typeLabel} on AIM Studio — ${opts.workTitle}`;
    ctaBlock  = `
      <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="padding-right:8px;">
            <a href="${watchHref}"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
              ${opts.workType === "SERIES" ? "Watch Series" : "Watch Now"}
            </a>
          </td>
          <td>
            <a href="${detailHref}"
               style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                      text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
              View Details
            </a>
          </td>
        </tr>
      </table>`;
  }

  const body = `
    ${safeImageBlock(opts.imageUrl, opts.workTitle)}
    ${genreText ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">${genreText}</p>` : ""}
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">${leadText}</p>
    ${ctaBlock}`;

  return {
    subject,
    html: bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml:       body,
      recipientEmail: opts.recipientEmail,
      preheader,
    }),
  };
}

export function buildNewEpisodeEmail(opts: {
  recipientEmail: string;
  seriesTitle:    string;
  seriesSlug:     string;
  episodeTitle:   string;
  episodeNumber?: number | null;
  seasonNumber?:  number | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const watchHref  = `${APP_URL}/watch/${opts.seriesSlug}`;
  const epLabel    = opts.seasonNumber && opts.episodeNumber
    ? `S${opts.seasonNumber}E${opts.episodeNumber}`
    : opts.episodeNumber
      ? `Episode ${opts.episodeNumber}`
      : "New Episode";

  const body = `
    ${safeImageBlock(opts.imageUrl, opts.episodeTitle)}
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">
      ${opts.seriesTitle}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${epLabel} — <em style="color:#e5e7eb;">${opts.episodeTitle}</em> — is now available.
    </p>
    <a href="${watchHref}"
       style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
              letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
      Watch Now
    </a>`;

  return {
    subject: `New episode: ${opts.seriesTitle} — ${epLabel}`,
    html:    bulkBaseTemplate({
      title:          `${opts.episodeTitle}`,
      bodyHtml:       body,
      recipientEmail: opts.recipientEmail,
      preheader:      `${epLabel} of ${opts.seriesTitle} is now streaming`,
    }),
  };
}

export function buildSeasonDropEmail(opts: {
  recipientEmail: string;
  seriesTitle:    string;
  seriesSlug:     string;
  seasonNumber:   number;
  episodeCount:   number;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const watchHref   = `${APP_URL}/watch/${opts.seriesSlug}`;
  const detailHref  = `${APP_URL}/works/${opts.seriesSlug}`;
  const seasonLabel = `Season ${opts.seasonNumber}`;
  const epText      = `${opts.episodeCount} episode${opts.episodeCount === 1 ? "" : "s"}`;

  const body = `
    ${safeImageBlock(opts.imageUrl, opts.seriesTitle)}
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">
      ${htmlEsc(opts.seriesTitle)}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${htmlEsc(seasonLabel)} is now streaming — ${epText} available.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding-right:8px;">
          <a href="${watchHref}"
             style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                    letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
            Watch ${htmlEsc(seasonLabel)}
          </a>
        </td>
        <td>
          <a href="${detailHref}"
             style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                    text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
            View Details
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `${opts.seriesTitle} — ${seasonLabel} is now streaming`,
    html:    bulkBaseTemplate({
      title:          `${opts.seriesTitle} — ${seasonLabel}`,
      bodyHtml:       body,
      recipientEmail: opts.recipientEmail,
      preheader:      `${seasonLabel} of ${opts.seriesTitle} — ${epText} now streaming`,
    }),
  };
}

export function buildAnnouncementEmail(opts: {
  recipientEmail: string;
  title:          string;
  body:           string;
  href?:          string | null;
  hrefLabel?:     string | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const ctaHtml = opts.href
    ? `<a href="${opts.href}"
           style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                  letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;margin-top:20px;">
          ${opts.hrefLabel ?? "Learn More"}
        </a>`
    : "";

  const bodyHtml = `
    ${safeImageBlock(opts.imageUrl, opts.title)}
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">${opts.body}</p>
    ${ctaHtml}`;

  return {
    subject: opts.title,
    html:    bulkBaseTemplate({
      title:          opts.title,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      opts.title,
    }),
  };
}

export function buildNotifyMeFollowupEmail(opts: {
  recipientEmail: string;
  recipientName?: string | null;
  workTitle:      string;
  workSlug:       string;
  workType:       string;
}): { subject: string; html: string } {
  const watchHref  = opts.workType === "SERIES"
    ? `${APP_URL}/watch/${opts.workSlug}`
    : `${APP_URL}/watch/${opts.workSlug}?full=1`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const greeting   = opts.recipientName ? `Hi ${opts.recipientName},` : "It's here.";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${greeting} You asked us to let you know when <strong style="color:#e5e7eb;">${opts.workTitle}</strong> was ready.
      It&apos;s ready now.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding-right:8px;">
          <a href="${watchHref}"
             style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                    letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
            ${opts.workType === "SERIES" ? "Watch Series" : "Watch Now"}
          </a>
        </td>
        <td>
          <a href="${detailHref}"
             style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                    text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
            View Details
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `It's here: ${opts.workTitle}`,
    html:    bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      `${opts.workTitle} is now available on AIM Studio`,
    }),
  };
}

// ── Queue ingestion ───────────────────────────────────────────

export async function enqueueBulkEmail(opts: {
  to:          string;
  subject:     string;
  bodyHtml:    string;
  type:        EmailType;
  campaignId?: string;
  scheduledAt?: Date;
  metadata?:   Record<string, unknown>;
}): Promise<void> {
  await prisma.emailQueue.create({
    data: {
      to:          opts.to.toLowerCase().trim(),
      subject:     opts.subject,
      bodyHtml:    opts.bodyHtml,
      type:        opts.type,
      provider:    "ACS",
      status:      "QUEUED",
      campaignId:  opts.campaignId ?? null,
      scheduledAt: opts.scheduledAt ?? new Date(),
      metadata:    opts.metadata != null
        ? (opts.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

// Bulk-enqueue for a list of recipients.
// Checks EmailSuppression for each address.
// Returns counts: queued / suppressed.

const ENQUEUE_BATCH = 50; // EmailQueue inserts per batch

export async function enqueueBulkForRecipients(opts: {
  recipients:  { email: string; name?: string | null }[];
  buildEmail:  (recipient: { email: string; name?: string | null }) => { subject: string; html: string };
  type:        EmailType;
  campaignId:  string;
  scheduledAt?: Date;
}): Promise<{ queued: number; suppressed: number; skipped: number }> {
  let queued = 0;
  let suppressed = 0;
  let skipped = 0;

  // Load all suppressed emails in one query for this batch
  const emails      = opts.recipients.map(r => r.email.toLowerCase().trim());
  const suppressSet = await getSuppressedSet(emails);

  const rows: Prisma.EmailQueueCreateManyInput[] = [];

  for (const recipient of opts.recipients) {
    const norm = recipient.email.toLowerCase().trim();
    if (!norm) { skipped++; continue; }

    if (suppressSet.has(norm)) {
      suppressed++;
      continue;
    }

    let subject: string;
    let bodyHtml: string;
    try {
      const built = opts.buildEmail(recipient);
      subject  = built.subject;
      bodyHtml = built.html;
    } catch {
      skipped++;
      continue;
    }

    rows.push({
      to:          norm,
      subject,
      bodyHtml,
      type:        opts.type,
      provider:    "ACS",
      status:      "QUEUED",
      campaignId:  opts.campaignId,
      scheduledAt: opts.scheduledAt ?? new Date(),
    });
  }

  // Insert in batches
  for (let i = 0; i < rows.length; i += ENQUEUE_BATCH) {
    const batch = rows.slice(i, i + ENQUEUE_BATCH);
    await prisma.emailQueue.createMany({ data: batch, skipDuplicates: false });
    queued += batch.length;
  }

  return { queued, suppressed, skipped };
}

async function getSuppressedSet(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await prisma.emailSuppression.findMany({
    where: { email: { in: emails }, active: true },
    select: { email: true },
  });
  return new Set(rows.map(r => r.email));
}

// ── Batch processor ───────────────────────────────────────────
// Processes up to `limit` QUEUED items using whichever bulk provider
// is selected in AdminSettings.primaryBulkProvider (acs | graph | smtp).
// Called by admin actions or a cron route — never inline.

export type ProcessResult = {
  processed: number;
  sent:      number;
  failed:    number;
  error?:    string;
};

export async function processEmailQueueBatch(limit = 50): Promise<ProcessResult> {
  // Resolve the active bulk provider from AdminSettings
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { primaryBulkProvider: true },
  });

  const providerKey = ((settings?.primaryBulkProvider ?? "acs").toLowerCase()) as "acs" | "graph" | "smtp";

  // Validate that the selected provider is configured
  if (providerKey === "acs" && !isAcsConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to ACS but ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS are not set.",
    };
  }
  if (providerKey === "graph" && !isGraphConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to Graph but AZURE_CLIENT_ID / AZURE_TENANT_ID / GRAPH_EMAIL_SENDER are not set.",
    };
  }
  if (providerKey === "smtp" && !isSmtpConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to SMTP but SMTP_HOST / SMTP_USER are not set.",
    };
  }

  const logProvider: EmailProvider =
    providerKey === "graph" ? "GRAPH" :
    providerKey === "smtp"  ? "SMTP"  : "ACS";

  // Claim up to `limit` QUEUED items
  const items = await prisma.emailQueue.findMany({
    where:   { status: "QUEUED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take:    limit,
  });

  if (items.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent   = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (providerKey === "acs") {
        await sendViaAcs({ to: item.to, subject: item.subject, html: item.bodyHtml });
      } else if (providerKey === "graph") {
        await sendViaBulkGraph({ to: item.to, subject: item.subject, html: item.bodyHtml });
      } else {
        throw new Error("SMTP bulk sending requires additional server configuration. Switch to ACS or Graph.");
      }

      await prisma.emailQueue.update({
        where: { id: item.id },
        data:  { status: "SENT", processedAt: new Date(), error: null, provider: logProvider },
      });

      await logBulkSend({
        to: item.to, subject: item.subject, type: item.type,
        status: "SENT", campaignId: item.campaignId, provider: logProvider,
      });

      sent++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await prisma.emailQueue.update({
        where: { id: item.id },
        data:  {
          status:     item.retryCount + 1 >= item.maxRetries ? "FAILED" : "QUEUED",
          retryCount: { increment: 1 },
          error:      errorMsg,
        },
      });

      await logBulkSend({
        to: item.to, subject: item.subject, type: item.type,
        status: "FAILED", error: errorMsg, campaignId: item.campaignId, provider: logProvider,
      });

      failed++;
    }
  }

  return { processed: items.length, sent, failed };
}

// ── Microsoft Graph bulk sender ──────────────────────────────
// Reuses the same Graph API as transactional email (lib/email.ts)
// but is a self-contained copy to avoid circular imports.
// isGraphConfigured() is always checked before this is called.

async function sendViaBulkGraph(opts: {
  to: string; subject: string; html: string;
}): Promise<void> {
  const clientId     = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const tenantId     = process.env.AZURE_TENANT_ID!;
  const from         = process.env.GRAPH_EMAIL_SENDER!;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!tokenRes.ok) throw new Error(`Graph token failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json() as { access_token: string };

  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject:      opts.subject,
          body:         { contentType: "HTML", content: opts.html },
          toRecipients: [{ emailAddress: { address: opts.to } }],
          from:         { emailAddress: { address: from, name: FROM_NAME } },
        },
        saveToSentItems: false,
      }),
    }
  );
  if (!mailRes.ok) {
    const body = await mailRes.text();
    throw new Error(`Graph sendMail failed: ${mailRes.status} — ${body}`);
  }
}

// ── ACS sender ────────────────────────────────────────────────
// Uses @azure/communication-email (installed in Phase 8).
// Dynamic import keeps the package out of any client bundle.
// isAcsConfigured() is always checked before this is called.

const ACS_SEND_TIMEOUT_MS = 30_000; // 30 s per message

async function sendViaAcs(opts: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  const connectionString = process.env.ACS_CONNECTION_STRING;
  const senderAddress    = process.env.ACS_SENDER_ADDRESS;

  if (!connectionString || !senderAddress) {
    throw new Error("ACS_CONNECTION_STRING or ACS_SENDER_ADDRESS not set");
  }

  // Dynamic import — @azure/communication-email is Node.js-only.
  // This import never appears in a client bundle.
  const { EmailClient } = await import("@azure/communication-email");

  const client = new EmailClient(connectionString);

  const message = {
    senderAddress,
    content: {
      subject: opts.subject,
      html:    opts.html,
    },
    recipients: {
      to: [{ address: opts.to }],
    },
  };

  const poller = await client.beginSend(message);

  // Poll until the ACS operation completes, with a timeout guard
  const timeoutHandle = setTimeout(() => {
    // pollUntilDone() doesn't expose a cancel — let the caller's
    // try/catch handle the Promise rejection via the outer timeout race
  }, ACS_SEND_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      poller.pollUntilDone(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ACS send timed out")), ACS_SEND_TIMEOUT_MS)
      ),
    ]);

    // ACS returns status "Succeeded" on success; anything else is a failure
    if ("status" in result && result.status !== "Succeeded") {
      throw new Error(`ACS send status: ${result.status}`);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ── Email log helper for bulk sends ──────────────────────────

async function logBulkSend(opts: {
  to:          string;
  subject:     string;
  type:        EmailType;
  status:      "SENT" | "FAILED";
  error?:      string;
  campaignId?: string | null;
  provider?:   EmailProvider;
}): Promise<void> {
  try {
    const provider = opts.provider ?? "ACS";
    const from = provider === "GRAPH"
      ? (process.env.GRAPH_EMAIL_SENDER ?? "noreply@aimstudio.app")
      : (process.env.ACS_SENDER_ADDRESS ?? "bulk@aimstudio.app");

    await prisma.emailLog.create({
      data: {
        to:       opts.to,
        from,
        subject:  opts.subject,
        type:     opts.type,
        provider,
        status:   opts.status,
        error:    opts.error ?? null,
        metadata: opts.campaignId ? { campaignId: opts.campaignId } : undefined,
        sentAt:   opts.status === "SENT" ? new Date() : null,
      },
    });
  } catch {
    // logging must never throw
  }
}
