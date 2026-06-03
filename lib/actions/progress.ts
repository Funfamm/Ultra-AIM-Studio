"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Save progress ─────────────────────────────────────────────
export async function saveWatchProgress(
  workId: string,
  seconds: number,
  durationMinutes?: number,
) {
  const session = await auth();
  if (!session?.user?.id) return;

  const duration = durationMinutes ?? null;
  // Mark complete when 90% of duration has been watched
  const completed = duration ? seconds >= duration * 60 * 0.9 : false;

  await prisma.watchProgress.upsert({
    where: { userId_workId: { userId: session.user.id, workId } },
    update: { seconds, duration, completed },
    create: { userId: session.user.id, workId, seconds, duration, completed: false },
  });
}

// ── Get progress for a single work ───────────────────────────
export async function getWatchProgress(workId: string): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const record = await prisma.watchProgress.findUnique({
    where: { userId_workId: { userId: session.user.id, workId } },
    select: { seconds: true, completed: true },
  });

  // Completed content always restarts from the beginning
  if (!record || record.completed) return 0;
  return record.seconds;
}

// ── Remove one item from Continue Watching ────────────────────
export async function removeWatchProgress(workId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.watchProgress.deleteMany({
    where: { userId: session.user.id, workId },
  });
  revalidatePath("/dashboard");
}

// ── Reset progress for a specific work (restart from 0) ───────
export async function resetWatchProgress(workId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.watchProgress.updateMany({
    where: { userId: session.user.id, workId },
    data: { seconds: 0, completed: false },
  });
  revalidatePath("/dashboard");
}

// ── Smart series resume: last-watched episode for a series ───
// Returns the slug of the last episode the user was watching (not completed),
// or the first incomplete episode, or null (fall back to Episode 1).
export async function getResumeEpisodeSlug(
  seriesId: string,
  episodeSlugs: string[],  // ordered list: s1e1 … last
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || episodeSlugs.length === 0) return null;

  // Fetch all episodes of this series that the user has progress on
  const episodeWorks = await prisma.work.findMany({
    where: { parentId: seriesId, slug: { in: episodeSlugs } },
    select: { id: true, slug: true },
  });
  const workIds = episodeWorks.map((e) => e.id);
  if (workIds.length === 0) return null;

  const progressRows = await prisma.watchProgress.findMany({
    where: { userId: session.user.id, workId: { in: workIds } },
    select: { workId: true, seconds: true, completed: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const progressByWorkId = new Map(progressRows.map((r) => [r.workId, r]));
  const slugById = new Map(episodeWorks.map((e) => [e.id, e.slug]));

  // Return most recently watched in-progress episode
  const inProgress = progressRows.find((r) => !r.completed && r.seconds > 0);
  if (inProgress) return slugById.get(inProgress.workId) ?? null;

  // All watched — find first unwatched episode in order
  for (const slug of episodeSlugs) {
    const ep = episodeWorks.find((e) => e.slug === slug);
    if (!ep) continue;
    const prog = progressByWorkId.get(ep.id);
    if (!prog || (!prog.completed && prog.seconds === 0)) return slug;
  }

  // All completed — return first episode so user can watch again
  return episodeSlugs[0];
}

// ── Per-episode progress map (for sidebar) ────────────────────
// Returns a plain object (not Map) — must be JSON-serializable for Next.js server actions.
export async function getEpisodeProgressMap(
  workIds: string[],
): Promise<Record<string, { seconds: number; completed: boolean }>> {
  const session = await auth();
  if (!session?.user?.id || workIds.length === 0) return {};

  const rows = await prisma.watchProgress.findMany({
    where: { userId: session.user.id, workId: { in: workIds } },
    select: { workId: true, seconds: true, completed: true },
  });

  return Object.fromEntries(
    rows.map((r) => [r.workId, { seconds: r.seconds, completed: r.completed }])
  );
}

// ── Clear all Continue Watching (incomplete) ──────────────────
export async function clearContinueWatching() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.watchProgress.deleteMany({
    where: { userId: session.user.id, completed: false },
  });
  revalidatePath("/dashboard");
}

// ── Clear entire watch history (all records) ──────────────────
export async function clearWatchHistory() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.watchProgress.deleteMany({
    where: { userId: session.user.id },
  });
  revalidatePath("/dashboard");
}

// ── Get all progress for user dashboard ───────────────────────
export async function getAllWatchProgress() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.watchProgress.findMany({
    where: {
      userId: session.user.id,
      completed: false,
      work: { type: { not: "TRAILER" } }, // trailers always restart; exclude from Continue Watching
    },
    include: {
      work: {
        select: {
          id: true, title: true, slug: true,
          posterUrl: true, duration: true, type: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
}
