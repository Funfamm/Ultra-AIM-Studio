// Email sending module — isolated so the provider can be swapped without touching callsites.
// Priority: Microsoft Graph (Azure) → DEV console log fallback
// SMTP stub ready for future approval.
// No tracking pixels. Transactional only.

import { prisma } from "@/lib/prisma";
import type { EmailType, EmailProvider, Prisma } from "@prisma/client";

const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_EMAIL = process.env.GRAPH_EMAIL_SENDER  ?? "noreply@example.com";
const FROM_NAME  = "AIM Studio";

// ── Types ─────────────────────────────────────────────────────

type SendOptions = {
  to:       string;
  subject:  string;
  html:     string;
  type:     EmailType;
  metadata?: Record<string, unknown>;
};

// ── Safety-critical email types ───────────────────────────────
// These types must NOT be blocked by marketing suppression.
// A user who unsubscribed from newsletters still needs to receive
// password resets and security alerts for account safety.
// Bulk/marketing emails (NEW_RELEASE, ANNOUNCEMENT, etc.) are routed
// through lib/bulk-email.ts and always respect suppression — correct.

const BYPASS_SUPPRESSION_TYPES = new Set<EmailType>([
  "PASSWORD_RESET",
  "SECURITY_ALERT",
  "ADMIN_ALERT",
  "ACCOUNT",
]);

// ── Suppression check ─────────────────────────────────────────

async function isSuppressed(email: string): Promise<boolean> {
  try {
    const row = await prisma.emailSuppression.findUnique({
      where: { email: email.toLowerCase() },
      select: { active: true },
    });
    return row?.active === true;
  } catch {
    return false; // never block a send on suppression check failure
  }
}

// ── Email log writer ──────────────────────────────────────────

async function logEmail(opts: {
  to: string;
  subject: string;
  type: EmailType;
  provider: EmailProvider;
  status: "SENT" | "FAILED" | "SUPPRESSED";
  error?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to:       opts.to,
        from:     FROM_EMAIL,
        subject:  opts.subject,
        type:     opts.type,
        provider: opts.provider,
        status:   opts.status,
        error:    opts.error ?? null,
        metadata: opts.metadata != null ? (opts.metadata as Prisma.InputJsonValue) : undefined,
        sentAt:   opts.status === "SENT" ? new Date() : null,
      },
    });
  } catch {
    // logging must never throw or block the caller
  }
}

// ── Microsoft Graph sender ─────────────────────────────────────

async function sendViaGraph(to: string, subject: string, html: string): Promise<void> {
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId     = process.env.AZURE_TENANT_ID;
  const from         = process.env.GRAPH_EMAIL_SENDER;

  if (!clientId || !clientSecret || !tenantId || !from) {
    throw new Error("GRAPH_EMAIL_SENDER env vars incomplete");
  }

  // Acquire OAuth2 token from Azure AD
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    throw new Error(`Graph token request failed: ${tokenRes.status}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Send mail via Graph API
  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body:          { contentType: "HTML", content: html },
          toRecipients:  [{ emailAddress: { address: to } }],
          from:          { emailAddress: { address: from, name: FROM_NAME } },
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

// ── SMTP sender (stub — add nodemailer when approved) ──────────

// async function sendViaSMTP(to: string, subject: string, html: string): Promise<void> { ... }

// ── Dispatch ──────────────────────────────────────────────────

export async function sendEmail(opts: SendOptions): Promise<void> {
  const { to, subject, html, type, metadata } = opts;
  const toNorm = to.toLowerCase().trim();
  const isDev  = process.env.NODE_ENV !== "production";

  // Suppression check — bypass for account-safety types (password reset, security alerts).
  // Marketing unsubscribe must never prevent a user receiving their own reset link.
  // Bulk marketing emails (NEW_RELEASE, ANNOUNCEMENT, etc.) go through lib/bulk-email.ts
  // which always enforces suppression — this bypass only applies to transactional Graph sends.
  const bypassSuppression = BYPASS_SUPPRESSION_TYPES.has(type);

  if (!bypassSuppression && (await isSuppressed(toNorm))) {
    await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SUPPRESSED" });
    return;
  }

  const graphConfigured =
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER;

  // Production: must use Graph — hard fail if not configured
  if (!isDev) {
    try {
      await sendViaGraph(toNorm, subject, html);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SENT", metadata });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "FAILED", error, metadata });
      throw err; // re-throw so callers can decide whether to surface the error
    }
    return;
  }

  // Dev: try Graph if configured, otherwise log to console only
  if (graphConfigured) {
    try {
      await sendViaGraph(toNorm, subject, html);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SENT", metadata });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "FAILED", error, metadata });
      throw err;
    }
    return;
  }

  // DEV ONLY — log to console, never runs in production
  console.log("\n[DEV ONLY — EMAIL NOT SENT]");
  console.log(`To:      ${toNorm}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
  console.log("[END DEV EMAIL]\n");
  await logEmail({ to: toNorm, subject, type, provider: "DEV_LOG", status: "SENT", metadata });
}

// ── Email templates ────────────────────────────────────────────

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">AIM<span style="color:#e8c97e;">Studio</span></p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;">${title}</h1>
          ${bodyHtml}
          <hr style="margin:24px 0;border:none;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:11px;color:#6b7280;">You are receiving this email because you have an account on AIM Studio.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Password reset ─────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  // rawToken is never logged — only the URL is used here and only in the email body

  const body = `
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      We received a request to reset the password for your AIM Studio account.
      Click the button below to choose a new password. This link expires in 30 minutes.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:14px;font-weight:600;
              text-decoration:none;padding:12px 28px;border-radius:6px;">
      Reset Password
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      If you did not request a password reset, you can safely ignore this email.
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#6b7280;">
      If the button does not work, copy this link:<br>
      <span style="color:#e5e7eb;word-break:break-all;">${resetUrl}</span>
    </p>`;

  await sendEmail({
    to,
    subject: "Reset your AIM Studio password",
    html:    baseTemplate("Reset your password", body),
    type:    "PASSWORD_RESET",
  });
}

// ── Password reset code (user-initiated) ──────────────────────

export async function sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      We received a request to reset the password for your AIM Studio account.
      Enter the verification code below to choose a new password. This code expires in 30 minutes.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background:#1a1a1a;border:2px solid #e8c97e;border-radius:8px;
                    padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#f9fafb;
                    font-family:monospace;">
        ${code}
      </span>
    </div>
    <p style="margin:0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      If you did not request a password reset, you can safely ignore this email.
      Do not share this code with anyone.
    </p>`;

  await sendEmail({
    to,
    subject: "Your AIM Studio password reset code",
    html:    baseTemplate("Password reset code", body),
    type:    "PASSWORD_RESET",
  });
}

// ── Security alert email ───────────────────────────────────────

export async function sendSecurityAlertEmail(opts: {
  to: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<void> {
  const resetUrl = `${APP_URL}/forgot-password`;

  const actionHtml = opts.actionUrl
    ? `<a href="${opts.actionUrl}"
         style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:6px;margin-top:20px;">
        ${opts.actionLabel ?? "Take Action"}
       </a>`
    : "";

  const html = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">${opts.body}</p>
    ${actionHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      If this was you, no action is needed.<br>
      If this was not you,
      <a href="${resetUrl}" style="color:#e8c97e;">reset your password immediately</a>.
    </p>`;

  await sendEmail({
    to:      opts.to,
    subject: `Security alert for your AIM Studio account`,
    html:    baseTemplate(opts.title, html),
    type:    "SECURITY_ALERT",
  });
}

// ── Welcome email ──────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name?: string | null): Promise<void> {
  const greeting = name ? `Welcome, ${name}` : "Welcome to AIM Studio";
  const dashboardUrl = `${APP_URL}/dashboard`;

  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      Your account is ready. Start exploring our films, series, and creative work.
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:14px;font-weight:600;
              text-decoration:none;padding:12px 28px;border-radius:6px;">
      Go to Dashboard
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      If you did not create this account, please ignore this email.
    </p>`;

  await sendEmail({
    to,
    subject: "Welcome to AIM Studio",
    html:    baseTemplate(greeting, body),
    type:    "WELCOME",
  });
}

// ── Account notification email ─────────────────────────────────
// Sent for account-level changes: suspension, restoration, etc.
// Uses Microsoft Graph (transactional). Bypasses suppression (ACCOUNT type).
// Never used for marketing. No tracking pixel.

export async function sendAccountEmail(opts: {
  to:       string;
  subject:  string;
  title:    string;
  body:     string;
  ctaUrl?:  string;
  ctaLabel?: string;
}): Promise<void> {
  const ctaHtml = opts.ctaUrl
    ? `<a href="${opts.ctaUrl}"
         style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:6px;margin-top:20px;">
        ${opts.ctaLabel ?? "View Account"}
       </a>`
    : "";

  const html = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">${opts.body}</p>
    ${ctaHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      If you have questions about your account, contact us through the site.
    </p>`;

  await sendEmail({
    to:      opts.to,
    subject: opts.subject,
    html:    baseTemplate(opts.title, html),
    type:    "ACCOUNT",
  });
}
