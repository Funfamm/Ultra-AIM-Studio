"use server";
// Server Actions for Work CRUD — admin only

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WorkType, WorkStatus } from "@prisma/client";

function parseFormData(formData: FormData) {
  const galleryRaw = (formData.get("galleryUrls") as string) ?? "";
  const galleryUrls = galleryRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    type:        formData.get("type") as WorkType,
    status:      formData.get("status") as WorkStatus,
    title:       ((formData.get("title") as string) ?? "").trim(),
    description: (formData.get("description") as string) || null,
    posterUrl:      (formData.get("posterUrl") as string)      || null,
    heroMobileUrl:  (formData.get("heroMobileUrl") as string)  || null,
    heroDesktopUrl: (formData.get("heroDesktopUrl") as string) || null,
    thumbnailUrl:   (formData.get("thumbnailUrl") as string)   || null,
    trailerUrl:     (formData.get("trailerUrl") as string)     || null,
    videoUrl:    (formData.get("videoUrl") as string)    || null,
    teaserUrl:   (formData.get("teaserUrl") as string)   || null,
    year:        formData.get("year")     ? Number(formData.get("year"))     : null,
    duration:    formData.get("duration") ? Number(formData.get("duration")) : null,
    director:    (formData.get("director") as string)    || null,
    genres:      (formData.getAll("genres") as string[]).filter(Boolean),
    clientName:  (formData.get("clientName") as string)  || null,
    industry:    (formData.get("industry") as string)    || null,
    projectGoal: (formData.get("projectGoal") as string) || null,
    deliverables:(formData.get("deliverables") as string)|| null,
    caseStudy:   (formData.get("caseStudy") as string)   || null,
    galleryUrls,
    requiresAuth:               formData.getAll("requiresAuth").includes("true"),
    requiresLoginToViewTrailer: formData.getAll("requiresLoginToViewTrailer").includes("true"),
    featured:         formData.getAll("featured").includes("true"),
    showOnHome:       formData.getAll("showOnHome").includes("true"),
    commentsEnabled:  formData.getAll("commentsEnabled").includes("true"),
    order:            formData.get("order") ? Number(formData.get("order")) : 0,
    parentId:     (formData.get("parentId") as string) || null,
    episodeNumber: formData.get("episodeNumber") ? Number(formData.get("episodeNumber")) : null,
    seasonNumber:  formData.get("seasonNumber")  ? Number(formData.get("seasonNumber"))  : null,
    introStart:   formData.get("introStart")   ? Number(formData.get("introStart"))   : null,
    introEnd:     formData.get("introEnd")     ? Number(formData.get("introEnd"))     : null,
    creditsStart: formData.get("creditsStart") ? Number(formData.get("creditsStart")) : null,
    contentRating:      (formData.get("contentRating") as string) || null,
    contentDescriptors: (formData.getAll("contentDescriptors") as string[]).filter(Boolean),
  };
}

function revalidateAll() {
  revalidatePath("/admin/works", "layout"); // covers list + all /admin/works/[id] pages
  revalidatePath("/works");
  revalidatePath("/");
}

/**
 * Generate a slug for an episode: {parent-slug}-s{season}-e{episode}-{title-slug}
 * Returns a safe slug that doesn't conflict with existing works (appends suffix if needed).
 * @param excludeId  When editing, the current work's id is excluded from conflict checks.
 */
async function buildEpisodeSlug(
  parentId: string,
  seasonNumber: number | null,
  episodeNumber: number | null,
  title: string,
  excludeId?: string
): Promise<string> {
  const parent = await prisma.work.findUnique({
    where: { id: parentId },
    select: { slug: true },
  });
  const parentSlug = parent?.slug ?? "series";
  const s = seasonNumber ?? 1;
  const e = episodeNumber ?? 0;
  const candidate = `${parentSlug}-s${s}-e${e}-${slugify(title)}`;

  // Resolve collision with any OTHER work
  const conflict = await prisma.work.findFirst({
    where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return conflict ? `${candidate}-${Date.now().toString(36)}` : candidate;
}

// ── Create ────────────────────────────────────────────────────
export async function createWork(formData: FormData) {
  await requireAdmin();

  const data = parseFormData(formData);
  if (!data.title) {
    redirect("/admin/works/new?error=" + encodeURIComponent("Title is required."));
  }

  // ── EPISODE path ──────────────────────────────────────────
  if (data.type === "EPISODE") {
    if (!data.parentId) {
      redirect("/admin/works/new?type=EPISODE&error=" + encodeURIComponent("An episode must belong to a parent series."));
    }

    // Validate uniqueness by parentId + seasonNumber + episodeNumber (not by title)
    if (data.seasonNumber != null && data.episodeNumber != null) {
      const dup = await prisma.work.findFirst({
        where: {
          parentId: data.parentId,
          seasonNumber: data.seasonNumber,
          episodeNumber: data.episodeNumber,
        },
        select: { id: true, title: true },
      });
      if (dup) {
        const errMsg = `Season ${data.seasonNumber} Episode ${data.episodeNumber} already exists under this series.`;
        redirect(
          `/admin/works/new?parentId=${data.parentId}&type=EPISODE&error=` +
            encodeURIComponent(errMsg)
        );
      }
    }

    const slug = await buildEpisodeSlug(
      data.parentId,
      data.seasonNumber,
      data.episodeNumber,
      data.title
    );

    // Episodes inherit featured/showOnHome/genres/order/access from parent — never stored on episode
    await prisma.work.create({
      data: {
        ...data,
        slug,
        genres: [],
        featured: false,
        showOnHome: false,
        order: 0,
        requiresAuth: false,
        requiresLoginToViewTrailer: false,
      },
    });

    revalidateAll();
    redirect(`/admin/works/${data.parentId}`);
  }

  // ── Non-episode path ──────────────────────────────────────
  const slug = slugify(data.title);
  const existing = await prisma.work.findUnique({ where: { slug } });
  if (existing) {
    redirect("/admin/works/new?error=" + encodeURIComponent("A work with this title already exists."));
  }

  await prisma.work.create({ data: { ...data, slug } });

  revalidateAll();
  redirect("/admin/works");
}

// ── Update ────────────────────────────────────────────────────
export async function updateWork(id: string, formData: FormData) {
  await requireAdmin();

  const data = parseFormData(formData);

  // ── EPISODE path ──────────────────────────────────────────
  if (data.type === "EPISODE") {
    // Validate S+E uniqueness within parent, excluding the current episode
    if (data.parentId && data.seasonNumber != null && data.episodeNumber != null) {
      const dup = await prisma.work.findFirst({
        where: {
          parentId: data.parentId,
          seasonNumber: data.seasonNumber,
          episodeNumber: data.episodeNumber,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup) {
        const errMsg = `Season ${data.seasonNumber} Episode ${data.episodeNumber} already exists under this series.`;
        redirect(`/admin/works/${id}?error=` + encodeURIComponent(errMsg));
      }
    }

    // Regenerate episode slug when parent/season/episode/title changes
    let newSlug: string | undefined;
    if (data.parentId) {
      const current = await prisma.work.findUnique({ where: { id }, select: { slug: true } });
      const candidate = await buildEpisodeSlug(
        data.parentId,
        data.seasonNumber,
        data.episodeNumber,
        data.title,
        id
      );
      // Only write slug if it actually changed
      if (current?.slug !== candidate) newSlug = candidate;
    }

    await prisma.work.update({
      where: { id },
      data: {
        ...data,
        ...(newSlug ? { slug: newSlug } : {}),
        // Episodes must never carry these — enforce server-side regardless of form
        genres: [],
        featured: false,
        showOnHome: false,
        order: 0,
        requiresAuth: false,
        requiresLoginToViewTrailer: false,
      },
    });

    revalidateAll();
    redirect(`/admin/works/${id}`);
  }

  // ── Non-episode path ──────────────────────────────────────
  await prisma.work.update({ where: { id }, data });

  revalidateAll();
  redirect(`/admin/works/${id}`);
}

// ── Toggle published/private ──────────────────────────────────
export async function setWorkStatus(id: string, status: WorkStatus) {
  await requireAdmin();
  await prisma.work.update({ where: { id }, data: { status } });
  revalidateAll();
}

// ── Delete ────────────────────────────────────────────────────
export async function deleteWork(id: string) {
  await requireAdmin();
  await prisma.work.delete({ where: { id } });
  revalidateAll();
}
