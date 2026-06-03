import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import type { WorkType } from "@prisma/client";

export const metadata: Metadata = { title: "Admin — Engagement" };

const WORK_TYPE_LABELS: Record<string, string> = {
  FULL_FILM: "Full Film", SHORT_FILM: "Short Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

type Props = {
  searchParams: Promise<{
    type?: string;
    search?: string;
    cursor?: string;
    tab?: string;
  }>;
};

const PAGE = 30;

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminEngagementPage({ searchParams }: Props) {
  await requireAdmin();
  const { type: typeFilter, search, cursor, tab = "likes" } = await searchParams;

  // ── Likes tab ─────────────────────────────────────────────
  const likeWhere: Record<string, unknown> = {};
  if (typeFilter) likeWhere.work = { type: typeFilter as WorkType };
  if (search) {
    likeWhere.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const likes = await prisma.workLike.findMany({
    where: likeWhere,
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      work: { select: { id: true, slug: true, title: true, type: true } },
    },
  });

  const hasMore = likes.length > PAGE;
  if (hasMore) likes.pop();
  const nextCursor = hasMore ? likes[likes.length - 1]?.id : null;

  // ── Top works by like count ────────────────────────────────
  const topWorks = await prisma.work.findMany({
    where: {
      status: "PUBLISHED",
      ...(typeFilter ? { type: typeFilter as WorkType } : {}),
      likes: { some: {} },
    },
    orderBy: { likes: { _count: "desc" } },
    take: 10,
    select: {
      id: true, slug: true, title: true, type: true,
      _count: { select: { likes: true } },
    },
  });

  // ── Stats ──────────────────────────────────────────────────
  const totalLikes = await prisma.workLike.count();
  const totalComments = await prisma.comment.count({ where: { status: "PUBLISHED" } });

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-page-title">Engagement</h1>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { label: "Total Likes", value: totalLikes.toLocaleString() },
          { label: "Published Comments", value: totalComments.toLocaleString() },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--color-brand-dark)", border: "1px solid var(--color-brand-border)",
            borderRadius: 4, padding: "0.875rem 1.25rem", minWidth: 140,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, color: "var(--color-brand-white)" }}>{s.value}</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--color-brand-muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top works */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-brand-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          Most Liked Works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {topWorks.map((w, i) => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--color-brand-muted)", width: 18, textAlign: "right" }}>{i + 1}</span>
              <Link href={`/works/${w.slug}`} style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-light)", textDecoration: "none", flex: 1 }}>
                {w.title}
              </Link>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--color-brand-muted)" }}>
                {WORK_TYPE_LABELS[w.type] ?? w.type}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-brand-accent)", minWidth: 32, textAlign: "right" }}>
                ♥ {w._count.likes}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <input type="hidden" name="tab" value="likes" />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-brand-muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Work Type</label>
          <select name="type" defaultValue={typeFilter ?? ""} style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-light)", borderRadius: 4, padding: "0.35rem 0.6rem" }}>
            <option value="">All types</option>
            {Object.entries(WORK_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-brand-muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Search user</label>
          <input
            name="search"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Name or email…"
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-light)", borderRadius: 4, padding: "0.35rem 0.6rem", width: 200 }}
          />
        </div>
        <button type="submit" style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600, background: "var(--color-brand-accent)", color: "#000", border: "none", borderRadius: 4, padding: "0.4rem 0.9rem", cursor: "pointer" }}>
          Filter
        </button>
        {(typeFilter || search) && (
          <Link href="/admin/engagement" style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "var(--color-brand-muted)", textDecoration: "none", alignSelf: "flex-end", paddingBottom: "0.4rem" }}>
            Clear
          </Link>
        )}
      </form>

      {/* Likes table */}
      <h2 style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-brand-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
        Who Liked — {likes.length}{hasMore ? "+" : ""} results
      </h2>

      {likes.length === 0 ? (
        <p style={{ fontFamily: "var(--font-body)", color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>No likes match your filter.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Work</th>
                <th>Type</th>
                <th>Liked</th>
              </tr>
            </thead>
            <tbody>
              {likes.map((l) => (
                <tr key={l.id}>
                  <td className="a-primary">{l.user.name ?? "—"}</td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-muted)" }}>{l.user.email}</td>
                  <td>
                    <Link href={`/works/${l.work.slug}`} style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none" }}>
                      {l.work.title.slice(0, 40)}{l.work.title.length > 40 ? "…" : ""}
                    </Link>
                  </td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                    {WORK_TYPE_LABELS[l.work.type] ?? l.work.type}
                  </td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                    {timeAgo(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "1.25rem" }}>
        {cursor && (
          <Link href={`/admin/engagement?${typeFilter ? `type=${typeFilter}&` : ""}${search ? `search=${encodeURIComponent(search)}&` : ""}`}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none" }}>
            ← First page
          </Link>
        )}
        {nextCursor && (
          <Link href={`/admin/engagement?${typeFilter ? `type=${typeFilter}&` : ""}${search ? `search=${encodeURIComponent(search)}&` : ""}cursor=${nextCursor}`}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none", marginLeft: "auto" }}>
            Next → ({PAGE} per page)
          </Link>
        )}
      </div>
    </div>
  );
}
