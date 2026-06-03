import { prisma } from "@/lib/prisma";
import { setWorkStatus } from "@/lib/actions/works";
import { DeleteWorkButton } from "@/components/delete-work-button";
import Link from "next/link";
import "./admin-works.css";
import { Plus, Pencil, Eye, EyeOff, Heart, Share2 } from "lucide-react";
import type { Metadata } from "next";
import type { WorkType, WorkStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Admin — Works" };

const TYPE_LABELS: Record<WorkType, string> = {
  SHORT_FILM: "Short Film", FULL_FILM: "Full Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

const STATUS_CLASS: Record<WorkStatus, string> = {
  PUBLISHED:     "badge--published",
  DRAFT:         "badge--draft",
  PRIVATE:       "badge--private",
  IN_PRODUCTION: "badge--production",
  UPCOMING:      "badge--upcoming",
};

export default async function AdminWorksPage() {
  // ── 1. Main works query — include episode IDs for series aggregation ──
  const works = await prisma.work.findMany({
    where: { type: { not: "EPISODE" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      featured: true, showOnHome: true, clientName: true, genre: true,
      videoUrl: true, trailerUrl: true, createdAt: true,
      // Episode IDs — used below to aggregate series stats
      episodes: { select: { id: true } },
    },
  });

  // ── 2. Collect every relevant workId (series + their episodes) ──────────
  const allIds = works.flatMap((w) => [w.id, ...w.episodes.map((e) => e.id)]);

  // ── 3. Like counts grouped by workId — one query ─────────────────────
  const likeRows = await prisma.workLike.groupBy({
    by: ["workId"],
    where: { workId: { in: allIds } },
    _count: { _all: true },
  });
  const likeMap = new Map(likeRows.map((r) => [r.workId, r._count._all]));

  // ── 4. Share counts from analytics events — one query ────────────────
  const shareRows = await prisma.analyticsEvent.groupBy({
    by: ["workId"],
    where: { type: "SHARE_WORK", workId: { in: allIds } },
    _count: { _all: true },
  });
  const shareMap = new Map(
    shareRows
      .filter((r) => r.workId != null)
      .map((r) => [r.workId!, r._count._all]),
  );

  // ── 5. Compute per-work totals (series = series + all episode ids) ────
  const worksWithStats = works.map((w) => {
    const ids = [w.id, ...w.episodes.map((e) => e.id)];
    const totalLikes  = ids.reduce((s, id) => s + (likeMap.get(id)  ?? 0), 0);
    const totalShares = ids.reduce((s, id) => s + (shareMap.get(id) ?? 0), 0);
    return { ...w, totalLikes, totalShares };
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Works</h1>
        <Link href="/admin/works/new" className="admin-add-btn">
          <Plus size={15} /> Add Work
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Video</th>
              <th>Featured</th>
              <th>Home</th>
              <th className="th-stat" title="Likes (series includes all episodes)">
                <Heart size={12} />
              </th>
              <th className="th-stat" title="Shares (series includes all episodes)">
                <Share2 size={12} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {worksWithStats.map((w) => {
              const nextStatus: WorkStatus = w.status === "PUBLISHED" ? "PRIVATE" : "PUBLISHED";
              return (
                <tr key={w.id}>
                  <td className="td-title">
                    {w.title}
                    {w.clientName && (
                      <span className="td-sub">{w.clientName}</span>
                    )}
                  </td>
                  <td>
                    <span className="type-label">{TYPE_LABELS[w.type]}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS[w.status]}`}>
                      {w.status.toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`dot ${w.videoUrl || w.trailerUrl ? "dot--green" : "dot--red"}`} />
                  </td>
                  <td>{w.featured ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
                  <td>{w.showOnHome ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
                  <td className="td-stat">
                    {w.totalLikes > 0 ? (
                      <span className="stat-val">
                        {w.totalLikes}
                        {w.type === "SERIES" && w.episodes.length > 0 && (
                          <span className="stat-agg" title={`Includes ${w.episodes.length} episode(s)`}>*</span>
                        )}
                      </span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td className="td-stat">
                    {w.totalShares > 0 ? (
                      <span className="stat-val">
                        {w.totalShares}
                        {w.type === "SERIES" && w.episodes.length > 0 && (
                          <span className="stat-agg" title={`Includes ${w.episodes.length} episode(s)`}>*</span>
                        )}
                      </span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td>
                    <div className="action-btns">
                      <Link href={`/admin/works/${w.id}`} className="action-btn" title="Edit">
                        <Pencil size={14} />
                      </Link>
                      <form action={setWorkStatus.bind(null, w.id, nextStatus)}>
                        <button
                          type="submit"
                          className="action-btn"
                          title={w.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        >
                          {w.status === "PUBLISHED" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </form>
                      <DeleteWorkButton id={w.id} title={w.title} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {works.length === 0 && (
              <tr>
                <td colSpan={9} className="table-empty">No works yet. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
