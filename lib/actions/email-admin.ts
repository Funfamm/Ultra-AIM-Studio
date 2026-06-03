"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ── Test Graph email ──────────────────────────────────────────
export async function testGraphEmail(): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();

  // Use testEmailRecipient from AdminSettings if set, else fall back to admin's own email
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  const to = settings?.testEmailRecipient?.trim() || admin.email!;

  try {
    await sendEmail({
      to,
      subject: "AIM Studio — Graph email test",
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f9fafb;">AIM<span style="color:#e8c97e;">Studio</span></p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;">Email test successful</h1>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">
            Microsoft Graph is correctly configured and sending email.<br>
            Sent to: <strong style="color:#e5e7eb;">${to}</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      type: "ADMIN_ALERT",
      metadata: { test: true },
    });
    return { ok: true, message: `Test email sent to ${to}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}

// ── Suppression management ────────────────────────────────────
export async function addSuppression(formData: FormData) {
  await requireAdmin();
  const email  = (formData.get("email") as string)?.toLowerCase().trim();
  const reason = (formData.get("reason") as string) || "manual";
  if (!email) redirect("/admin/email?tab=suppression&error=Email+is+required");

  await prisma.emailSuppression.upsert({
    where:  { email },
    create: { email, reason, source: "admin", active: true },
    update: { reason, active: true },
  });
  revalidatePath("/admin/email");
  redirect("/admin/email?tab=suppression");
}

// Soft-lift: marks inactive but keeps the record for audit
export async function removeSuppression(email: string) {
  await requireAdmin();
  await prisma.emailSuppression.update({
    where: { email },
    data:  { active: false },
  });
  revalidatePath("/admin/email");
}

// Hard delete: permanently removes the suppression record
export async function deleteSuppression(email: string) {
  await requireAdmin();
  await prisma.emailSuppression.delete({ where: { email } });
  revalidatePath("/admin/email");
}

// Bulk import suppressions from pasted email list
export async function bulkImportSuppression(formData: FormData) {
  await requireAdmin();
  const raw    = (formData.get("emails") as string) ?? "";
  const reason = (formData.get("reason") as string) || "manual";

  const emails = raw
    .split(/[\n,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length > 3);

  if (emails.length === 0) {
    redirect("/admin/email?tab=import&error=No+valid+email+addresses+found");
  }

  const unique = [...new Set(emails)];
  let imported = 0;
  let skipped  = 0;

  for (const email of unique) {
    const existing = await prisma.emailSuppression.findUnique({ where: { email } });
    if (existing?.active) { skipped++; continue; }
    await prisma.emailSuppression.upsert({
      where:  { email },
      create: { email, reason, source: "admin", active: true },
      update: { reason, active: true },
    });
    imported++;
  }

  revalidatePath("/admin/email");
  redirect(`/admin/email?tab=import&imported=${imported}&skipped=${skipped}`);
}
