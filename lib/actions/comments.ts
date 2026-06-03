"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { CommentReportReason, CommentReportStatus } from "@prisma/client";

const MAX_BODY    = 1000;
const MAX_REPLY   = 500;
const PAGE_SIZE   = 15;

// ── Helpers ───────────────────────────────────────────────────
function sanitize(text: string): string {
  // Strip HTML tags, trim, collapse whitespace
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

// ── Public: list top-level comments for a work ───────────────
export async function getComments(
  workId: string,
  sort: "newest" | "top" = "newest",
  cursor?: string,
) {
  const orderBy =
    sort === "top"
      ? [{ likeCount: "desc" as const }, { createdAt: "desc" as const }]
      : [{ isPinned: "desc" as const }, { createdAt: "desc" as const }];

  const comments = await prisma.comment.findMany({
    where: {
      workId,
      parentId: null,
      status: "PUBLISHED",
    },
    orderBy,
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, body: true, isPinned: true,
      likeCount: true, replyCount: true,
      editedAt: true, createdAt: true,
      user: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  const hasMore = comments.length > PAGE_SIZE;
  if (hasMore) comments.pop();
  const nextCursor = hasMore ? comments[comments.length - 1]?.id : null;

  return { comments, nextCursor };
}

// ── Public: list replies for a comment ───────────────────────
export async function getReplies(parentId: string) {
  return prisma.comment.findMany({
    where: { parentId, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true, body: true, likeCount: true,
      editedAt: true, createdAt: true,
      user: { select: { id: true, name: true, image: true, role: true } },
    },
  });
}

// ── Public: get like state for a list of comment IDs ────────
export async function getCommentLikeState(commentIds: string[]) {
  const session = await auth();
  if (!session?.user?.id || commentIds.length === 0) return new Set<string>();

  const likes = await prisma.commentLike.findMany({
    where: { userId: session.user.id, commentId: { in: commentIds } },
    select: { commentId: true },
  });
  return new Set(likes.map((l) => l.commentId));
}

// ── Mutation: create comment or reply ────────────────────────
export async function createComment(
  workId: string,
  body: string,
  parentId?: string,
): Promise<{ ok: boolean; error?: string; comment?: { id: string; body: string; createdAt: Date } }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to comment." };

  const clean = sanitize(body);
  const maxLen = parentId ? MAX_REPLY : MAX_BODY;
  if (!clean) return { ok: false, error: "Comment cannot be empty." };
  if (clean.length > maxLen) return { ok: false, error: `Max ${maxLen} characters.` };

  // Validate work exists and comments are enabled
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { commentsEnabled: true, status: true, slug: true },
  });
  if (!work || !work.commentsEnabled) return { ok: false, error: "Comments are disabled for this work." };

  // Validate parent exists (one level only — parent must not itself be a reply)
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { parentId: true, status: true },
    });
    if (!parent || parent.status !== "PUBLISHED") return { ok: false, error: "Cannot reply to this comment." };
    if (parent.parentId) return { ok: false, error: "Replies can only be one level deep." };
  }

  const comment = await prisma.comment.create({
    data: {
      body: clean,
      userId: session.user.id,
      workId,
      parentId: parentId ?? null,
    },
    select: { id: true, body: true, createdAt: true },
  });

  // Increment parent replyCount
  if (parentId) {
    await prisma.comment.update({ where: { id: parentId }, data: { replyCount: { increment: 1 } } });

    // Notify the parent comment author
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });
    if (parent && parent.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          id: `cmt-reply-${comment.id}`,
          userId: parent.userId,
          type: "COMMENT_REPLY",
          title: "New reply to your comment",
          body: `${session.user.name ?? "Someone"} replied to your comment.`,
          href: `/works/${work.slug}`,
          read: false,
          createdAt: new Date(),
        },
      }).catch(() => {}); // non-blocking
    }
  }

  revalidatePath(`/works/${work.slug}`);
  revalidatePath(`/watch/${work.slug}`);
  return { ok: true, comment };
}

// ── Mutation: like / unlike a comment ────────────────────────
export async function toggleCommentLike(
  commentId: string,
): Promise<{ ok: boolean; liked: boolean; likeCount: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, liked: false, likeCount: 0 };

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.commentLike.delete({ where: { commentId_userId: { commentId, userId: session.user.id } } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } }),
    ]);
    const updated = await prisma.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    return { ok: true, liked: false, likeCount: updated?.likeCount ?? 0 };
  } else {
    await prisma.$transaction([
      prisma.commentLike.create({ data: { commentId, userId: session.user.id } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
    ]);
    const updated = await prisma.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    return { ok: true, liked: true, likeCount: updated?.likeCount ?? 0 };
  }
}

// ── Mutation: delete own comment ─────────────────────────────
export async function deleteOwnComment(commentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, parentId: true, status: true },
  });
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== user.id) return { ok: false, error: "Not authorised." };
  if (comment.status === "DELETED") return { ok: false, error: "Already deleted." };

  await prisma.comment.update({
    where: { id: commentId },
    data: { status: "DELETED", body: "[deleted]" },
  });
  if (comment.parentId) {
    await prisma.comment.update({ where: { id: comment.parentId }, data: { replyCount: { decrement: 1 } } });
  }
  return { ok: true };
}

// ── Mutation: report a comment ───────────────────────────────
export async function reportComment(
  commentId: string,
  reason: CommentReportReason,
  details?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const existing = await prisma.commentReport.findUnique({
    where: { commentId_userId: { commentId, userId: user.id } },
  });
  if (existing) return { ok: false, error: "You have already reported this comment." };

  await prisma.commentReport.create({
    data: {
      commentId,
      userId: user.id,
      reason,
      details: details ? sanitize(details).slice(0, 500) : null,
    },
  });

  // Notify all admins (in-app, non-blocking)
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        id: `cmt-report-${commentId}-${user.id}-${a.id}`,
        userId: a.id,
        type: "COMMENT_REPORT" as const,
        title: "Comment reported",
        body: `A comment was reported for: ${reason.replace(/_/g, " ").toLowerCase()}.`,
        href: "/admin/comments",
        read: false,
        createdAt: new Date(),
      })),
      skipDuplicates: true,
    }).catch(() => {});
  }

  return { ok: true };
}

// ── Admin: list comments for moderation ──────────────────────
export async function adminGetComments(
  filter: "ALL" | "PUBLISHED" | "HIDDEN" | "FLAGGED" | "DELETED" | "REPORTED",
  cursor?: string,
) {
  await requireAdmin();

  const where =
    filter === "ALL"       ? {} :
    filter === "REPORTED"  ? { reports: { some: { status: "OPEN" as const } } } :
    { status: filter as "PUBLISHED" | "HIDDEN" | "DELETED" | "FLAGGED" };

  const items = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 25 + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, body: true, status: true, isPinned: true,
      likeCount: true, replyCount: true, createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      work: { select: { id: true, slug: true, title: true, type: true } },
      parentId: true,
      reports: {
        where: { status: "OPEN" },
        select: { id: true, reason: true, details: true, createdAt: true, user: { select: { name: true } } },
        take: 5,
      },
    },
  });

  const hasMore = items.length > 25;
  if (hasMore) items.pop();
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

// ── Admin: hide / restore / delete / pin ─────────────────────
export async function adminModerateComment(
  commentId: string,
  action: "HIDE" | "RESTORE" | "DELETE" | "PIN" | "UNPIN",
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!comment) return { ok: false, error: "Comment not found." };

  if (action === "HIDE")    await prisma.comment.update({ where: { id: commentId }, data: { status: "HIDDEN" } });
  if (action === "RESTORE") await prisma.comment.update({ where: { id: commentId }, data: { status: "PUBLISHED" } });
  if (action === "DELETE")  await prisma.comment.update({ where: { id: commentId }, data: { status: "DELETED", body: "[removed by moderator]" } });
  if (action === "PIN")     await prisma.comment.update({ where: { id: commentId }, data: { isPinned: true } });
  if (action === "UNPIN")   await prisma.comment.update({ where: { id: commentId }, data: { isPinned: false } });

  revalidatePath("/admin/comments");
  return { ok: true };
}

// ── Admin: resolve report ────────────────────────────────────
export async function adminResolveReport(
  reportId: string,
  status: CommentReportStatus,
): Promise<{ ok: boolean }> {
  const session = await requireAdmin();

  await prisma.commentReport.update({
    where: { id: reportId },
    data: { status, reviewedAt: new Date(), reviewedById: session.id },
  });

  revalidatePath("/admin/comments");
  return { ok: true };
}
