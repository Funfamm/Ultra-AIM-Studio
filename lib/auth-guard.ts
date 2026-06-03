// Shared auth guards for server actions.
// requireAdmin  — allows ADMIN and SUPER_ADMIN (all admin features)
// requireSuperAdmin — SUPER_ADMIN only (role management, promote/demote)

import { auth } from "@/lib/auth";

export function isAdminRole(role?: string | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized — Super Admin required");
  }
  return session.user;
}
