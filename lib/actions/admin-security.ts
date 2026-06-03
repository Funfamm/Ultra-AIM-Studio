"use server";

// Super Admin self-management and power admin creation.
// All mutations are gated behind requireSuperAdmin() or requireAdmin().

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";
import { writeSecurityEvent } from "@/lib/security";

// ── Demote an admin to member (SUPER_ADMIN only) ─────────────
export async function demoteAdmin(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();

  if (userId === actor.id) return { ok: false, error: "You cannot demote yourself." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, name: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "SUPER_ADMIN") return { ok: false, error: "Super Admins cannot be demoted." };
  if (target.role === "USER") return { ok: false, error: "User is already a member." };

  // Guard: keep at least one admin
  const adminCount = await prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
  if (adminCount <= 1) return { ok: false, error: "Cannot demote the last admin." };

  await prisma.user.update({
    where: { id: userId },
    data:  { role: "USER", tokenVersion: { increment: 1 } },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    targetId:   userId,
    targetEmail: target.email,
    action:     "ROLE_CHANGE",
    detail:     `ADMIN → USER (demoted by Super Admin)`,
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "ROLE_CHANGED", severity: "HIGH",
    email: target.email,
    metadata: { from: "ADMIN", to: "USER" },
  });

  revalidatePath("/admin/security");
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Create or promote a Power Admin (SUPER_ADMIN only) ────────
// If the email already exists as a USER/MEMBER, promotes them.
// If the email is new, creates a fresh admin account.
export async function createPowerAdmin(
  _prev: { ok: boolean; error?: string; message?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const actor = await requireSuperAdmin();

  const name     = (formData.get("name")     as string)?.trim() ?? "";
  const email    = (formData.get("email")    as string)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string) ?? "";

  if (!name)                     return { ok: false, error: "Full name is required." };
  if (!email || !email.includes("@")) return { ok: false, error: "A valid email is required." };
  if (password.length < 8)       return { ok: false, error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === "ADMIN" || existing.role === "SUPER_ADMIN") {
      return { ok: false, error: "This email already belongs to an admin account." };
    }

    // Promote existing member → admin
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role:          "ADMIN",
        emailVerified: new Date(),
        tokenVersion:  { increment: 1 },
      },
    });

    void writeAudit({
      actorId:    actor.id!,
      actorEmail: actor.email ?? "unknown",
      targetId:   existing.id,
      targetEmail: email,
      action:     "ROLE_CHANGE",
      detail:     `USER → ADMIN (promoted via Create Power Admin)`,
    });
    void writeSecurityEvent({
      userId: existing.id, actorUserId: actor.id,
      type: "ROLE_CHANGED", severity: "HIGH",
      email,
      metadata: { from: existing.role, to: "ADMIN", strategy: "promote_existing" },
    });

    revalidatePath("/admin/security");
    revalidatePath("/admin/users");
    return { ok: true, message: `${email} promoted to Power Admin.` };
  }

  // Create new admin from scratch
  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password:      passwordHash,
      role:          "ADMIN",
      emailVerified: new Date(), // skip double opt-in for admin-created accounts
    },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    targetId:   newUser.id,
    targetEmail: email,
    action:     "CREATE_ADMIN",
    detail:     `New Power Admin created: ${name} <${email}>`,
  });
  void writeSecurityEvent({
    userId: newUser.id, actorUserId: actor.id,
    type: "ROLE_CHANGED", severity: "HIGH",
    email,
    metadata: { strategy: "create_new", role: "ADMIN" },
  });

  revalidatePath("/admin/security");
  revalidatePath("/admin/users");
  return { ok: true, message: `Power Admin account created for ${email}.` };
}

// ── Update admin display name (self-service) ──────────────────
export async function updateAdminDisplayName(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  const name = (formData.get("name") as string)?.trim() ?? "";
  if (!name) return { ok: false, error: "Display name cannot be empty." };

  // Increment tokenVersion so the updated name appears in new JWTs immediately
  await prisma.user.update({
    where: { id: actor.id! },
    data:  { name, tokenVersion: { increment: 1 } },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    action:     "SETTINGS_UPDATE",
    detail:     `Display name updated to: ${name}`,
  });

  revalidatePath("/admin/security");
  return { ok: true };
}

// ── Update admin password (self-service) ──────────────────────
export async function updateAdminPassword(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newPassword     = (formData.get("newPassword")     as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!currentPassword)        return { ok: false, error: "Current password is required." };
  if (newPassword.length < 8)  return { ok: false, error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { ok: false, error: "Passwords do not match." };

  const user = await prisma.user.findUnique({
    where: { id: actor.id! },
    select: { password: true },
  });

  if (!user?.password) {
    return { ok: false, error: "This account uses Google sign-in and has no password to update." };
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return { ok: false, error: "Current password is incorrect." };

  // Reject same-as-current password
  if (currentPassword === newPassword) {
    return { ok: false, error: "New password cannot be the same as your current password." };
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  // Increment tokenVersion to invalidate other active sessions after password change
  await prisma.user.update({
    where: { id: actor.id! },
    data:  { password: newHash, tokenVersion: { increment: 1 } },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    action:     "SETTINGS_UPDATE",
    detail:     "Admin self-service password change",
  });
  void writeSecurityEvent({
    userId: actor.id, actorUserId: actor.id,
    type: "PASSWORD_CHANGED", severity: "MEDIUM",
    email: actor.email ?? undefined,
  });

  revalidatePath("/admin/security");
  return { ok: true };
}
