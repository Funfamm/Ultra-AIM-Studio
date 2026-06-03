"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Flag, ChevronDown, ChevronUp, X, Trash2 } from "lucide-react";
import {
  getComments, getReplies, createComment,
  toggleCommentLike, deleteOwnComment, reportComment,
} from "@/lib/actions/comments";
import type { CommentReportReason } from "@prisma/client";
import "./comment-section.css";

type CommentUser = { id: string; name: string | null; image: string | null; role: string };
type Comment = {
  id: string; body: string; isPinned: boolean;
  likeCount: number; replyCount: number;
  editedAt: Date | null; createdAt: Date;
  user: CommentUser;
};

type Props = {
  workId: string;
  workSlug: string;
  currentUser: { id: string; name: string | null; image: string | null; role: string } | null;
};

const REPORT_REASONS: { value: CommentReportReason; label: string }[] = [
  { value: "SPAM",                label: "Spam" },
  { value: "HARASSMENT",         label: "Harassment" },
  { value: "HATE_OR_ABUSE",      label: "Hate or abuse" },
  { value: "SEXUAL_CONTENT",     label: "Sexual content" },
  { value: "VIOLENCE_OR_THREATS",label: "Violence or threats" },
  { value: "PERSONAL_INFORMATION",label: "Personal information" },
  { value: "OTHER",              label: "Other" },
];

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({ user, sm }: { user: CommentUser; sm?: boolean }) {
  const cls = `cmt-avatar${sm ? " cmt-avatar--sm" : ""}`;
  const initials = (user.name ?? "?").charAt(0).toUpperCase();
  if (user.image) {
    return (
      <div className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.image} alt={user.name ?? "User"} loading="lazy" />
      </div>
    );
  }
  return <div className={cls}>{initials}</div>;
}

// ── Report modal ──────────────────────────────────────────────
function ReportModal({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const [reason, setReason] = useState<CommentReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!reason) { setErr("Please select a reason."); return; }
    setSubmitting(true);
    const res = await reportComment(commentId, reason as CommentReportReason, details || undefined);
    setSubmitting(false);
    if (res.ok) setDone(true);
    else setErr(res.error ?? "Could not submit report.");
  }

  return (
    <div className="cmt-report-backdrop" onClick={onClose}>
      <div className="cmt-report-card" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <p className="cmt-report-title">Report submitted. Thank you.</p>
            <div className="cmt-report-actions">
              <button className="cmt-cancel-btn" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <p className="cmt-report-title">Report this comment</p>
            <div className="cmt-report-reasons">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="cmt-report-reason">
                  <input type="radio" name="report-reason" value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              className="cmt-report-detail"
              placeholder="Optional details…"
              rows={2}
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {err && <p style={{ color: "var(--color-brand-red)", fontSize: "0.75rem", marginBottom: "0.5rem" }}>{err}</p>}
            <div className="cmt-report-actions">
              <button className="cmt-cancel-btn" onClick={onClose}>Cancel</button>
              <button className="cmt-report-submit" disabled={!reason || submitting} onClick={submit}>
                {submitting ? "Sending…" : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Single comment row (used for both top-level + replies) ────
function CommentRow({
  comment, currentUser, workSlug, isReply = false,
  likedSet, onLikeToggle, onDelete,
}: {
  comment: Comment;
  currentUser: Props["currentUser"];
  workSlug: string;
  isReply?: boolean;
  likedSet: Set<string>;
  onLikeToggle: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [liked, setLiked] = useState(likedSet.has(comment.id));
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDeleted = comment.body === "[deleted]" || comment.body === "[removed by moderator]";
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
  const isOwn = currentUser?.id === comment.user.id;

  async function handleLike() {
    if (!currentUser) return;
    const prev = liked;
    const prevCount = likeCount;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    onLikeToggle(comment.id, next ? 1 : -1);
    const res = await toggleCommentLike(comment.id);
    if (!res.ok) { setLiked(prev); setLikeCount(prevCount); }
    else setLikeCount(res.likeCount);
  }

  async function handleDelete() {
    if (!isOwn) return;
    setDeleting(true);
    await deleteOwnComment(comment.id);
    onDelete(comment.id);
  }

  return (
    <>
      {reporting && <ReportModal commentId={comment.id} onClose={() => setReporting(false)} />}
      <div className="cmt-item-top">
        <Avatar user={comment.user} sm={isReply} />
        <div className="cmt-item-body">
          <div className="cmt-meta">
            {comment.isPinned && <span className="cmt-badge-pin">📌 Pinned</span>}
            <span className="cmt-author">{comment.user.name ?? "Deleted user"}</span>
            {(comment.user.role === "ADMIN" || comment.user.role === "SUPER_ADMIN") && (
              <span className="cmt-badge-admin">Admin</span>
            )}
            <span className="cmt-timestamp">{timeAgo(comment.createdAt)}</span>
            {comment.editedAt && <span className="cmt-edited">(edited)</span>}
          </div>
          <p className={`cmt-text${isDeleted ? " cmt-text--deleted" : ""}`}>{comment.body}</p>
          {!isDeleted && (
            <div className="cmt-actions">
              <button
                className={`cmt-action-btn${liked ? " cmt-action-btn--liked" : ""}`}
                onClick={handleLike}
                disabled={!currentUser}
                title={currentUser ? (liked ? "Unlike" : "Like") : "Sign in to like"}
              >
                <Heart size={13} fill={liked ? "currentColor" : "none"} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
              {currentUser && !isOwn && (
                <button className="cmt-action-btn cmt-action-btn--danger" onClick={() => setReporting(true)}>
                  <Flag size={12} /> Report
                </button>
              )}
              {isOwn && !isDeleted && (
                <button className="cmt-action-btn cmt-action-btn--danger" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Reply thread ──────────────────────────────────────────────
function ReplyThread({
  parentId, replyCount, currentUser, workSlug, likedSet, onLikeToggle,
}: {
  parentId: string; replyCount: number; currentUser: Props["currentUser"];
  workSlug: string; likedSet: Set<string>;
  onLikeToggle: (id: string, delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [localCount, setLocalCount] = useState(replyCount);
  const maxLen = 500;

  async function load() {
    if (open) { setOpen(false); return; }
    setLoading(true);
    const data = await getReplies(parentId);
    setReplies(data as unknown as Comment[]);
    setLoading(false);
    setOpen(true);
  }

  async function submitReply() {
    const clean = replyBody.trim();
    if (!clean) return;
    setSubmitting(true);
    setErr("");
    const res = await createComment(workSlug, clean, parentId);
    setSubmitting(false);
    if (!res.ok) { setErr(res.error ?? "Could not post reply."); return; }
    if (res.comment) {
      setReplies((prev) => [...prev, {
        ...res.comment!,
        isPinned: false, likeCount: 0, replyCount: 0,
        editedAt: null,
        user: { id: currentUser!.id, name: currentUser!.name, image: currentUser!.image, role: currentUser!.role },
      } as Comment]);
      setLocalCount((c) => c + 1);
    }
    setReplyBody(""); setReplying(false);
  }

  return (
    <div className="cmt-replies">
      {localCount > 0 && (
        <button className="cmt-replies-toggle" onClick={load}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {loading ? "Loading…" : open ? "Hide replies" : `View ${localCount} ${localCount === 1 ? "reply" : "replies"}`}
        </button>
      )}
      {open && (
        <div className="cmt-reply-list">
          {replies.map((r) => (
            <div key={r.id} className="cmt-reply-item">
              <CommentRow
                comment={r} currentUser={currentUser} workSlug={workSlug}
                isReply likedSet={likedSet} onLikeToggle={onLikeToggle}
                onDelete={(id) => setReplies((prev) => prev.filter((x) => x.id !== id))}
              />
            </div>
          ))}
        </div>
      )}
      {currentUser && !replying && (
        <button className="cmt-action-btn" style={{ marginTop: "0.35rem" }} onClick={() => setReplying(true)}>
          <MessageSquare size={12} /> Reply
        </button>
      )}
      {replying && currentUser && (
        <div className="cmt-reply-form" style={{ marginTop: "0.5rem" }}>
          <Avatar user={currentUser as CommentUser} sm />
          <div className="cmt-reply-inner">
            <textarea
              className="cmt-reply-textarea"
              placeholder="Write a reply…"
              maxLength={maxLen}
              rows={2}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            {err && <p className="cmt-form-error">{err}</p>}
            <div className="cmt-reply-footer">
              <button className="cmt-cancel-btn" onClick={() => { setReplying(false); setReplyBody(""); }}>Cancel</button>
              <button className="cmt-submit" disabled={!replyBody.trim() || submitting} onClick={submitReply}>
                {submitting ? "Posting…" : "Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CommentSection ───────────────────────────────────────
export default function CommentSection({ workId, workSlug, currentUser }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedSet, setLikedSet] = useState(new Set<string>());
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postErr, setPostErr] = useState("");
  const maxLen = 1000;
  const mounted = useRef(false);

  const loadComments = useCallback(async (s: "newest" | "top", cur?: string) => {
    const res = await getComments(workId, s, cur);
    return res;
  }, [workId]);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    setLoading(true);
    loadComments(sort).then((res) => {
      setComments(res.comments as unknown as Comment[]);
      setNextCursor(res.nextCursor ?? null);
      setLoading(false);
    });
  }, [loadComments, sort]);

  async function handleSort(s: "newest" | "top") {
    if (s === sort) return;
    setSort(s);
    setLoading(true);
    const res = await loadComments(s);
    setComments(res.comments as unknown as Comment[]);
    setNextCursor(res.nextCursor ?? null);
    setLoading(false);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const res = await loadComments(sort, nextCursor);
    setComments((prev) => [...prev, ...(res.comments as unknown as Comment[])]);
    setNextCursor(res.nextCursor ?? null);
    setLoadingMore(false);
  }

  async function postComment() {
    const clean = body.trim();
    if (!clean) return;
    setSubmitting(true); setPostErr("");
    const res = await createComment(workId, clean);
    setSubmitting(false);
    if (!res.ok) { setPostErr(res.error ?? "Could not post comment."); return; }
    if (res.comment) {
      const newComment: Comment = {
        ...res.comment,
        isPinned: false, likeCount: 0, replyCount: 0, editedAt: null,
        user: { id: currentUser!.id, name: currentUser!.name, image: currentUser!.image, role: currentUser!.role },
      };
      setComments((prev) => sort === "newest" ? [newComment, ...prev] : [...prev, newComment]);
    }
    setBody("");
  }

  const totalVisible = comments.length;

  return (
    <section className="cmt-section">
      <div className="cmt-header">
        <h2 className="cmt-title">
          Viewer Conversation
          {totalVisible > 0 && <span className="cmt-count">({totalVisible}{nextCursor ? "+" : ""})</span>}
        </h2>
        <div className="cmt-sort">
          {(["newest", "top"] as const).map((s) => (
            <button key={s} className={`cmt-sort-btn${sort === s ? " cmt-sort-btn--active" : ""}`} onClick={() => handleSort(s)}>
              {s === "newest" ? "Newest" : "Top"}
            </button>
          ))}
        </div>
      </div>

      {/* Post form or guest CTA */}
      {currentUser ? (
        <div className="cmt-form-wrap">
          <Avatar user={currentUser as CommentUser} />
          <div className="cmt-form-inner">
            <textarea
              className="cmt-textarea"
              placeholder="What did this story make you feel?"
              maxLength={maxLen}
              rows={3}
              value={body}
              onChange={(e) => { setBody(e.target.value); setPostErr(""); }}
            />
            {postErr && <p className="cmt-form-error">{postErr}</p>}
            <div className="cmt-form-footer">
              <span className={`cmt-char-count${body.length > 900 ? body.length > maxLen ? " cmt-char-count--over" : " cmt-char-count--warn" : ""}`}>
                {body.length}/{maxLen}
              </span>
              <button className="cmt-submit" disabled={!body.trim() || submitting || body.length > maxLen} onClick={postComment}>
                {submitting ? "Posting…" : "Post Comment"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="cmt-guest-cta">
          <p className="cmt-guest-text">Sign in to join the conversation.</p>
          <div className="cmt-guest-actions">
            <Link href={`/login?from=/works/${workSlug}`} className="cmt-guest-sign-in">Sign In</Link>
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="cmt-list">
        {loading ? (
          <p className="cmt-loading">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="cmt-empty">No comments yet. Be the first to share your thoughts.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`cmt-item${c.isPinned ? " cmt-item--pinned" : ""}`}>
              <CommentRow
                comment={c} currentUser={currentUser} workSlug={workSlug}
                likedSet={likedSet}
                onLikeToggle={(id, delta) => {
                  setLikedSet((prev) => {
                    const next = new Set(prev);
                    if (delta > 0) next.add(id); else next.delete(id);
                    return next;
                  });
                }}
                onDelete={(id) => setComments((prev) => prev.filter((x) => x.id !== id))}
              />
              {/* Replies (only for top-level comments) */}
              <ReplyThread
                parentId={c.id} replyCount={c.replyCount}
                currentUser={currentUser} workSlug={workSlug}
                likedSet={likedSet} onLikeToggle={() => {}}
              />
            </div>
          ))
        )}
      </div>

      {nextCursor && (
        <div className="cmt-load-more-wrap">
          <button className="cmt-load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </section>
  );
}
