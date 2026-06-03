/**
 * app/api/cron/morning-report/route.ts
 *
 * Vercel Cron Job — fires at 08:00 UTC every day.
 * Sends a Good Morning system digest to the admin email.
 *
 * Vercel passes Authorization: Bearer <CRON_SECRET> automatically.
 * Set CRON_SECRET as a random string in your Vercel environment variables.
 *
 * Schedule: "0 8 * * *"  — adjust in vercel.json for your timezone offset.
 *   e.g. WAT (UTC+1)  → "0 7 * * *"
 *        GMT           → "0 8 * * *"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow if secret is not configured
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Stats query ───────────────────────────────────────────────────────────────

async function getStats(since: Date) {
  const [
    newUsers,
    totalUsers,
    newLikes,
    newShares,
    newSignups,
    watchCompletions,
    openAlerts,
    emailFailures,
    totalPublished,
    newWorks,
    pageViews,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since }, status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.workLike.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: "SHARE_WORK", createdAt: { gte: since } } }),
    prisma.notifyMeSignup.count({ where: { createdAt: { gte: since } } }),
    prisma.watchProgress.count({ where: { completed: true, updatedAt: { gte: since } } }),
    prisma.securityAlert.count({ where: { status: "OPEN" } }),
    prisma.emailQueue.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { createdAt: { gte: since }, type: { not: "EPISODE" } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: since } } }),
  ]);

  return {
    newUsers, totalUsers, newLikes, newShares, newSignups,
    watchCompletions, openAlerts, emailFailures,
    totalPublished, newWorks, pageViews,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load admin settings
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: { adminAlertEmail: true, emailSendingEnabled: true },
  });

  if (!settings?.emailSendingEnabled) {
    return NextResponse.json({ skipped: "Email sending is disabled in admin settings" });
  }

  // Resolve recipients
  const recipients: string[] = [];
  if (settings.adminAlertEmail) {
    recipients.push(settings.adminAlertEmail);
  } else {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      select: { email: true },
    });
    admins.forEach((a) => recipients.push(a.email));
  }

  if (recipients.length === 0) {
    return NextResponse.json({ skipped: "No admin recipients configured" });
  }

  // Gather stats for the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats  = await getStats(since);

  // Date string for subject + heading
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = buildEmailHtml({ dateStr, appUrl, stats });

  // Send to all recipients in parallel
  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Good Morning — AIM Studio Daily Report · ${dateStr}`,
        html,
        type: "ADMIN_ALERT",
        metadata: {
          reportDate: new Date().toISOString(),
          stats: { newUsers: stats.newUsers, newLikes: stats.newLikes },
        },
      }),
    ),
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ok: true, sent, failed, recipients: recipients.length });
}

// ── Email HTML ────────────────────────────────────────────────────────────────

type Stats = Awaited<ReturnType<typeof getStats>>;

function stat(value: number, good = true): string {
  const colour = value > 0 && good ? "#e8c97e" : value > 0 && !good ? "#e05252" : "#6b7280";
  return `<span style="font-size:22px;font-weight:700;color:${colour};font-family:Georgia,serif;">${value}</span>`;
}

function row(label: string, value: number, good = true): string {
  return `
    <tr>
      <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">${label}</td>
      <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(value, good)}</td>
    </tr>`;
}

function buildEmailHtml({ dateStr, appUrl, stats }: { dateStr: string; appUrl: string; stats: Stats }): string {
  const hasAlerts   = stats.openAlerts > 0;
  const hasFailures = stats.emailFailures > 0;

  const alertBanner = (hasAlerts || hasFailures)
    ? `<tr>
        <td colspan="2" style="background:#2a1a1a;padding:12px 16px;color:#e05252;font-size:12px;font-weight:600;letter-spacing:.05em;border-radius:4px;margin-bottom:8px;">
          ${hasAlerts ? `⚠ ${stats.openAlerts} open security alert${stats.openAlerts !== 1 ? "s" : ""} — <a href="${appUrl}/admin/security" style="color:#e05252;">review now</a>` : ""}
          ${hasAlerts && hasFailures ? " &nbsp;·&nbsp; " : ""}
          ${hasFailures ? `${stats.emailFailures} email queue failure${stats.emailFailures !== 1 ? "s" : ""} — <a href="${appUrl}/admin/email" style="color:#e05252;">check queue</a>` : ""}
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Good Morning — AIM Studio Daily Report</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:.15em;color:#6b7280;text-transform:uppercase;font-weight:600;">AIM Studio</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#f9fafb;letter-spacing:-.01em;">Good Morning ☀️</h1>
              <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${dateStr}</p>
            </td>
          </tr>

          <!-- Alert banner (only shown when needed) -->
          ${alertBanner ? `<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${alertBanner}</table></td></tr>` : ""}

          <!-- Stats card -->
          <tr>
            <td style="background:#111111;border-radius:8px;border:1px solid #1f1f1f;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Section: Last 24 hours -->
                <tr>
                  <td colspan="2" style="padding:14px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Last 24 Hours
                  </td>
                </tr>
                ${row("New Registrations", stats.newUsers)}
                ${row("Page Views", stats.pageViews)}
                ${row("New Likes", stats.newLikes)}
                ${row("Shares", stats.newShares)}
                ${row("Notify Me Signups", stats.newSignups)}
                ${row("Watch Completions", stats.watchCompletions)}
                ${row("New Works Added", stats.newWorks)}

                <!-- Section: Platform -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Platform
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">Total Published Works</td>
                  <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(stats.totalPublished)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">Total Active Members</td>
                  <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(stats.totalUsers)}</td>
                </tr>

                <!-- Section: Alerts -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Alerts
                  </td>
                </tr>
                ${row("Open Security Alerts", stats.openAlerts, false)}
                ${row("Email Queue Failures", stats.emailFailures, false)}

              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <a href="${appUrl}/admin"
                style="display:inline-block;padding:11px 28px;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:600;text-decoration:none;border-radius:4px;letter-spacing:.03em;">
                Open Admin Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 0 0;text-align:center;color:#374151;font-size:11px;line-height:1.6;">
              <p style="margin:0;">This report is sent daily at 08:00 UTC to AIM Studio admins.</p>
              <p style="margin:4px 0 0;">To change the recipient, update <strong>Admin Alert Email</strong> in
                <a href="${appUrl}/admin/settings" style="color:#6b7280;">Admin → Settings</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
