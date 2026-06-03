"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/**
 * Fetch the current user's live profile from the database.
 * Always reflects the latest DB state — never the stale JWT session.
 */
export async function getUserProfile() {
  const session = await auth();
  if (!session?.user?.id) return { name: null as string | null, email: null as string | null };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return {
    name:  user?.name  ?? null,
    email: user?.email ?? session.user.email ?? null,
  };
}

/** Update the current user's display name. */
export async function updateUserProfile(formData: FormData) {
  const userId = await requireUser();
  const name = (formData.get("name") as string | null)?.trim() || null;

  if (name && name.length > 80) {
    redirect("/dashboard/settings?error=Name+is+too+long");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  // Redirect back with ?saved=profile so the Saved chip appears.
  // The page reads name from DB (getUserProfile), so the updated value shows immediately.
  redirect("/dashboard/settings?saved=profile");
}
