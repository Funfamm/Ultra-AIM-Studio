"use server";

import { requireAdmin, isAdminRole } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { EmailType } from "@prisma/client";

// System templates are critical auth/security flows — cannot be deleted or deactivated.
const SYSTEM_NAMES = new Set([
  "PASSWORD_RESET",
  "WELCOME",
  "SECURITY_ALERT",
  "ADMIN_ALERT",
]);

// ── Shared HTML primitives ────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";

const T = {
  // Outer wrapper
  wrap: (inner: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">AIM<span style="color:#e8c97e;">Studio</span></p>
          ${inner}
          <hr style="margin:28px 0;border:none;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.06em;text-transform:uppercase;">AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,

  // Bulk wrapper — adds unsubscribe footer
  wrapBulk: (inner: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">AIM<span style="color:#e8c97e;">Studio</span></p>
          ${inner}
          <hr style="margin:28px 0;border:none;border-top:1px solid #2a2a2a;">
          <p style="margin:0 0 8px;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.06em;text-transform:uppercase;">AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.</p>
          <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
            <a href="{{preferencesUrl}}" style="color:#374151;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="{{unsubscribeUrl}}" style="color:#374151;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,

  h1: (text: string) =>
    `<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;line-height:1.3;">${text}</h1>`,

  p: (text: string) =>
    `<p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">${text}</p>`,

  btn: (label: string, href: string) =>
    `<a href="${href}" style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">${label}</a>`,

  ghost: (label: string, href: string) =>
    `<a href="${href}" style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;text-decoration:none;padding:12px 20px;border:1px solid #3a3a3a;border-radius:3px;">${label}</a>`,

  note: (text: string) =>
    `<p style="margin:20px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">${text}</p>`,

  preheader: (text: string) =>
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${text}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`,
};

// ── Default system templates ──────────────────────────────────
// Called from the admin templates list page — idempotent, safe to call on every page load.
// Uses createMany + skipDuplicates so existing admin edits are never overwritten.

type TemplateRow = {
  name:        string;
  label:       string;
  description: string;
  type:        EmailType;
  subject:     string;
  preheader:   string;
  bodyHtml:    string;
  bodyText:    string;
  isActive:    boolean;
  isSystem:    boolean;
  isDefault:   boolean;
};

export async function ensureSystemEmailTemplates(): Promise<void> {
  const templates: TemplateRow[] = [
    // ── PASSWORD_RESET ──────────────────────────────
    {
      name:        "PASSWORD_RESET",
      label:       "Password Reset",
      description: "Sent when a user requests a password reset. System — always active.",
      type:        "PASSWORD_RESET",
      subject:     "Reset your AIM Studio password",
      preheader:   "A password reset was requested for your account.",
      bodyHtml: T.wrap(`
        ${T.preheader("A password reset was requested for your account.")}
        ${T.h1("Reset your password")}
        ${T.p("We received a request to reset the password for your AIM Studio account. Click the button below to choose a new password. This link expires in 30 minutes.")}
        ${T.btn("Reset Password", "{{actionUrl}}")}
        ${T.note("If you did not request a password reset, you can safely ignore this email. Your password will not change.")}
        ${T.note(`If the button doesn't work, copy this link:<br><span style="color:#e5e7eb;word-break:break-all;">{{actionUrl}}</span>`)}
      `),
      bodyText: `Reset your AIM Studio password\n\nWe received a request to reset your password.\n\nReset link (expires in 30 minutes):\n{{actionUrl}}\n\nIf you did not request this, you can safely ignore this email.\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },

    // ── WELCOME ─────────────────────────────────────
    {
      name:        "WELCOME",
      label:       "Welcome",
      description: "Sent after a new account is created. System — always active.",
      type:        "WELCOME",
      subject:     "Welcome to AIM Studio",
      preheader:   "Your account is ready. Start watching.",
      bodyHtml: T.wrap(`
        ${T.preheader("Your account is ready. Start watching.")}
        ${T.h1("Welcome, {{userName}}")}
        ${T.p("Your AIM Studio account is ready. Explore films, series, and behind-the-scenes work from the studio.")}
        ${T.btn("Go to Dashboard", "{{actionUrl}}")}
        ${T.note("If you did not create this account, please ignore this email.")}
      `),
      bodyText: `Welcome to AIM Studio\n\nYour account is ready.\n\nGo to your dashboard:\n{{actionUrl}}\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },

    // ── SECURITY_ALERT ──────────────────────────────
    {
      name:        "SECURITY_ALERT",
      label:       "Security Alert",
      description: "Sent on suspicious login, new device, or security events. System — always active. No tracking pixels.",
      type:        "SECURITY_ALERT",
      subject:     "Security alert for your AIM Studio account",
      preheader:   "We noticed something unusual on your account.",
      bodyHtml: T.wrap(`
        ${T.preheader("We noticed something unusual on your account.")}
        ${T.h1("{{eventTitle}}")}
        ${T.p("{{eventDescription}}")}
        ${T.p("Event time: {{date}}")}
        ${T.btn("Review Account Security", "{{actionUrl}}")}
        ${T.note("If this was you, no action is needed. If this was not you, <a href='{{resetUrl}}' style='color:#e8c97e;'>reset your password immediately</a> and contact support at <a href='mailto:{{supportEmail}}' style='color:#e8c97e;'>{{supportEmail}}</a>.")}
      `),
      bodyText: `Security alert — AIM Studio\n\n{{eventTitle}}\n\n{{eventDescription}}\n\nEvent time: {{date}}\n\nReview your account:\n{{actionUrl}}\n\nIf this wasn't you, reset your password immediately.\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },

    // ── ADMIN_ALERT ─────────────────────────────────
    {
      name:        "ADMIN_ALERT",
      label:       "Admin Alert / Test",
      description: "Used for admin test emails and internal alerts. System — always active.",
      type:        "ADMIN_ALERT",
      subject:     "{{subject}}",
      preheader:   "Admin notification from AIM Studio.",
      bodyHtml: T.wrap(`
        ${T.preheader("Admin notification from AIM Studio.")}
        ${T.h1("{{subject}}")}
        ${T.p("{{body}}")}
        ${T.note("Sent: {{date}}")}
      `),
      bodyText: `{{subject}}\n\n{{body}}\n\nSent: {{date}}\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },

    // ── NEW_RELEASE ─────────────────────────────────
    {
      name:        "NEW_RELEASE",
      label:       "New Release",
      description: "Sent to opted-in users when a new film, series, or work is published.",
      type:        "NEW_RELEASE",
      subject:     "New Release: {{workTitle}}",
      preheader:   "{{workTitle}} is now available on AIM Studio.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{workTitle}} is now available on AIM Studio.")}
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">{{workType}}</p>
        ${T.h1("{{workTitle}}")}
        ${T.p("{{description}}")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
          <tr>
            <td style="padding-right:8px;">${T.btn("Watch Now", "{{watchUrl}}")}</td>
            <td>${T.ghost("View Details", "{{detailUrl}}")}</td>
          </tr>
        </table>
      `),
      bodyText: `New Release: {{workTitle}}\n\n{{workType}}\n\n{{description}}\n\nWatch now:\n{{watchUrl}}\n\nView details:\n{{detailUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },

    // ── NEW_EPISODE ─────────────────────────────────
    {
      name:        "NEW_EPISODE",
      label:       "New Episode",
      description: "Sent to opted-in users when a new episode is published.",
      type:        "NEW_EPISODE",
      subject:     "New episode: {{seriesTitle}} — {{episodeLabel}}",
      preheader:   "{{episodeTitle}} is now streaming.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{episodeTitle}} is now streaming.")}
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">{{seriesTitle}}</p>
        ${T.h1("{{episodeLabel}} — {{episodeTitle}}")}
        ${T.p("A new episode of {{seriesTitle}} is now available.")}
        ${T.btn("Watch Now", "{{watchUrl}}")}
      `),
      bodyText: `New episode: {{seriesTitle}} — {{episodeLabel}}\n\n{{episodeTitle}} is now available.\n\nWatch now:\n{{watchUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },

    // ── ANNOUNCEMENT ────────────────────────────────
    {
      name:        "ANNOUNCEMENT",
      label:       "Studio Announcement",
      description: "Studio-wide broadcast sent via /admin/notifications.",
      type:        "ANNOUNCEMENT",
      subject:     "{{title}}",
      preheader:   "{{title}}",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{title}}")}
        ${T.h1("{{title}}")}
        ${T.p("{{body}}")}
        <p style="margin:0;">{{ctaButton}}</p>
      `),
      bodyText: `{{title}}\n\n{{body}}\n\n{{ctaUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },

    // ── NOTIFY_ME_FOLLOWUP ──────────────────────────
    {
      name:        "NOTIFY_ME_FOLLOWUP",
      label:       "Notify Me Follow-up",
      description: "Sent to CTA signups when a work is released. Triggered from the CTA edit page.",
      type:        "NOTIFY_ME_FOLLOWUP",
      subject:     "It's here: {{workTitle}}",
      preheader:   "{{workTitle}} is now available on AIM Studio.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{workTitle}} is now available on AIM Studio.")}
        ${T.h1("{{workTitle}}")}
        ${T.p("{{greeting}} You asked us to let you know when <strong style='color:#e5e7eb;'>{{workTitle}}</strong> was ready. It&rsquo;s ready now.")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
          <tr>
            <td style="padding-right:8px;">${T.btn("Watch Now", "{{watchUrl}}")}</td>
            <td>${T.ghost("View Details", "{{detailUrl}}")}</td>
          </tr>
        </table>
      `),
      bodyText: `It's here: {{workTitle}}\n\n{{greeting}} You asked us to notify you when {{workTitle}} was ready. It's ready now.\n\nWatch now:\n{{watchUrl}}\n\nView details:\n{{detailUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },

    // ── ACCOUNT ─────────────────────────────────────
    {
      name:        "ACCOUNT",
      label:       "Account Update",
      description: "Sent on account changes such as email or password updates.",
      type:        "ACCOUNT",
      subject:     "Account update — AIM Studio",
      preheader:   "An update was made to your AIM Studio account.",
      bodyHtml: T.wrap(`
        ${T.preheader("An update was made to your AIM Studio account.")}
        ${T.h1("Account update")}
        ${T.p("{{changeDescription}}")}
        ${T.p("If you did not make this change, <a href='{{resetUrl}}' style='color:#e8c97e;'>reset your password</a> or contact support at <a href='mailto:{{supportEmail}}' style='color:#e8c97e;'>{{supportEmail}}</a>.")}
      `),
      bodyText: `Account update — AIM Studio\n\n{{changeDescription}}\n\nIf you did not make this change, reset your password immediately.\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: false, isDefault: true,
    },
  ];

  // Idempotent: skipDuplicates skips any row whose unique `name` already exists.
  // Admin edits to existing records are never touched.
  await prisma.emailTemplate.createMany({ data: templates, skipDuplicates: true });
}


export type TemplateResult = {
  error?: string;
  id?: string;
};

// ── List ──────────────────────────────────────────────────────────

export async function listTemplates() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/");

  return prisma.emailTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { type: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, label: true, type: true,
      subject: true, isActive: true, isSystem: true,
      isDefault: true, updatedAt: true,
    },
  });
}

// ── Get one ───────────────────────────────────────────────────────

export async function getTemplate(id: string) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/");
  return prisma.emailTemplate.findUnique({ where: { id } });
}

// ── Create ────────────────────────────────────────────────────────

export async function createTemplate(
  _prev: TemplateResult,
  formData: FormData,
): Promise<TemplateResult> {
  await requireAdmin();

  const raw         = (formData.get("name") as string ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const label       = (formData.get("label") as string ?? "").trim() || null;
  const description = (formData.get("description") as string ?? "").trim() || null;
  const type        = formData.get("type") as EmailType;
  const subject     = (formData.get("subject") as string ?? "").trim();
  const preheader   = (formData.get("preheader") as string ?? "").trim() || null;
  const bodyHtml    = (formData.get("bodyHtml") as string ?? "").trim();
  const bodyText    = (formData.get("bodyText") as string ?? "").trim() || null;

  if (!raw || !type || !subject || !bodyHtml) {
    return { error: "Key, type, subject, and HTML body are required." };
  }

  if (SYSTEM_NAMES.has(raw)) {
    return { error: `"${raw}" is a reserved system key. Choose a different key.` };
  }

  try {
    const t = await prisma.emailTemplate.create({
      data: {
        name: raw, label, description, type, subject,
        preheader, bodyHtml, bodyText,
        isActive: true, isSystem: false, isDefault: false,
      },
    });
    revalidatePath("/admin/email/templates");
    return { id: t.id };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { error: "A template with that key already exists." };
    }
    return { error: "Failed to create template." };
  }
}

// ── Update ────────────────────────────────────────────────────────

export async function updateTemplate(
  _prev: TemplateResult,
  formData: FormData,
): Promise<TemplateResult> {
  await requireAdmin();

  const id          = formData.get("id") as string;
  const label       = (formData.get("label") as string ?? "").trim() || null;
  const description = (formData.get("description") as string ?? "").trim() || null;
  const subject     = (formData.get("subject") as string ?? "").trim();
  const preheader   = (formData.get("preheader") as string ?? "").trim() || null;
  const bodyHtml    = (formData.get("bodyHtml") as string ?? "").trim();
  const bodyText    = (formData.get("bodyText") as string ?? "").trim() || null;
  const isActive    = formData.get("isActive") === "1";

  if (!id || !subject || !bodyHtml) {
    return { error: "Subject and HTML body are required." };
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true },
  });
  if (!existing) return { error: "Template not found." };

  if (existing.isSystem && !isActive) {
    return { error: `${existing.name} is a system template and must remain active.` };
  }

  try {
    await prisma.emailTemplate.update({
      where: { id },
      data: { label, description, subject, preheader, bodyHtml, bodyText, isActive },
    });
    revalidatePath("/admin/email/templates");
    revalidatePath(`/admin/email/templates/${id}`);
    return {};
  } catch {
    return { error: "Failed to save template." };
  }
}

// ── Toggle active ─────────────────────────────────────────────────

export async function toggleTemplateActive(
  id: string,
  active: boolean,
): Promise<TemplateResult> {
  await requireAdmin();

  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true },
  });
  if (!t) return { error: "Template not found." };
  if (t.isSystem && !active) {
    return { error: "System templates cannot be deactivated." };
  }

  await prisma.emailTemplate.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/admin/email/templates");
  return {};
}

// ── Duplicate ─────────────────────────────────────────────────────

export async function duplicateTemplate(id: string): Promise<TemplateResult> {
  await requireAdmin();

  const src = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!src) return { error: "Template not found." };

  const newName = `${src.name}_COPY_${Date.now()}`;
  try {
    const dup = await prisma.emailTemplate.create({
      data: {
        name:        newName,
        label:       src.label ? `${src.label} (copy)` : null,
        description: src.description,
        type:        src.type,
        subject:     src.subject,
        preheader:   src.preheader,
        bodyHtml:    src.bodyHtml,
        bodyText:    src.bodyText,
        isActive:    false,
        isSystem:    false,
        isDefault:   false,
      },
    });
    revalidatePath("/admin/email/templates");
    return { id: dup.id };
  } catch {
    return { error: "Failed to duplicate template." };
  }
}

// ── Delete ────────────────────────────────────────────────────────

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  await requireAdmin();

  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true, isDefault: true },
  });
  if (!t) return { error: "Template not found." };
  if (t.isSystem || t.isDefault) {
    return { error: "System templates cannot be deleted. Deactivate them instead." };
  }

  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/admin/email/templates");
  return {};
}
