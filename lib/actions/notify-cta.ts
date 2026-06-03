"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { CtaType } from "@prisma/client";



// ── Admin: upsert CTA for a work ─────────────────────────────────────────────
export async function upsertCta(
  workId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const type                  = formData.get("type") as CtaType;
  const headline              = ((formData.get("headline") as string) ?? "").trim();
  const body                  = ((formData.get("body") as string) ?? "").trim() || null;
  const ctaLabel              = ((formData.get("ctaLabel") as string) ?? "").trim();
  const triggerSecondsFromEnd = parseInt(formData.get("triggerSecondsFromEnd") as string, 10);
  const isEnabled             = formData.get("isEnabled") === "1";

  if (!["RELEASE", "MORE", "POST_RELEASE"].includes(type))
    return { ok: false, error: "Invalid CTA type." };
  if (!headline) return { ok: false, error: "Headline is required." };
  if (!ctaLabel) return { ok: false, error: "Button label is required." };
  if (isNaN(triggerSecondsFromEnd) || triggerSecondsFromEnd < 0)
    return { ok: false, error: "Trigger seconds must be 0 or more." };

  await prisma.notifyMeCta.upsert({
    where:  { workId },
    update: { type, headline, body, ctaLabel, triggerSecondsFromEnd, isEnabled },
    create: { workId, type, headline, body, ctaLabel, triggerSecondsFromEnd, isEnabled },
  });

  revalidatePath(`/admin/works/${workId}`);
  revalidatePath("/admin/notify-me-ctas");
  return { ok: true };
}

// ── Admin: delete CTA (signups ctaId → null via SetNull, data preserved) ─────
export async function deleteCta(
  ctaId: string,
  workId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await prisma.notifyMeCta.delete({ where: { id: ctaId } });
    revalidatePath(`/admin/works/${workId}`);
    revalidatePath("/admin/notify-me-ctas");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove CTA." };
  }
}

// ── Admin: toggle enabled/disabled ───────────────────────────────────────────
export async function toggleCtaEnabled(
  ctaId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const cta = await prisma.notifyMeCta.findUnique({ where: { id: ctaId }, select: { isEnabled: true, workId: true } });
    if (!cta) return { ok: false, error: "CTA not found." };
    await prisma.notifyMeCta.update({ where: { id: ctaId }, data: { isEnabled: !cta.isEnabled } });
    revalidatePath("/admin/notify-me-ctas");
    revalidatePath(`/admin/works/${cta.workId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not toggle CTA." };
  }
}

// ── Public: sign up for a CTA ────────────────────────────────────────────────
// Deduplication: server checks DB; client stores in localStorage after success.
export async function notifyMeSignup(
  ctaId: string,
  workId: string,
  workTitle: string | null,
  email: string,
  name?: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@"))
    return { ok: false, error: "Please enter a valid email address." };

  // Check suppression list — silently succeed so we don't leak suppression status
  const suppressed = await prisma.emailSuppression.findUnique({
    where: { email: trimmedEmail },
    select: { active: true },
  });
  if (suppressed?.active) return { ok: true };

  // Deduplicate: already signed up for this CTA
  const existing = await prisma.notifyMeSignup.findFirst({
    where: { ctaId, email: trimmedEmail },
    select: { id: true },
  });
  if (existing) return { ok: true };

  await prisma.notifyMeSignup.create({
    data: {
      ctaId,
      workId,
      workTitle,
      email: trimmedEmail,
      name: name?.trim() || null,
    },
  });

  return { ok: true };
}
