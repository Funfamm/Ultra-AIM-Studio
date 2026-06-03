// Server component — episodes management panel rendered inside Series edit page.
// CSS classes from admin-layout.css (admin-table, status-badge, action-btn, etc.)
// are globally available under /admin via the admin layout.

import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { DeleteWorkButton } from "@/components/delete-work-button";
import "./series-episodes-panel.css";

type Episode = {
  id: string;
  title: string;
  status: "DRAFT" | "IN_PRODUCTION" | "UPCOMING" | "PUBLISHED" | "PRIVATE";
  seasonNumber: number | null;
  episodeNumber: number | null;
  duration: number | null;
  videoUrl: string | null;
};

type Props = {
  seriesId: string;
  episodes: Episode[];
};

const STATUS_CLASS: Record<Episode["status"], string> = {
  PUBLISHED:     "badge--published",
  DRAFT:         "badge--draft",
  PRIVATE:       "badge--private",
  IN_PRODUCTION: "badge--production",
  UPCOMING:      "badge--upcoming",
};

export default function SeriesEpisodesPanel({ seriesId, episodes }: Props) {
  return (
    <div className="sep-panel">
      <div className="sep-header">
        <h2 className="sep-title">
          Episodes
          <span className="sep-count">{episodes.length}</span>
        </h2>
        <Link
          href={`/admin/works/new?parentId=${seriesId}&type=EPISODE`}
          className="admin-add-btn"
        >
          <Plus size={13} /> Add Episode
        </Link>
      </div>

      {episodes.length === 0 ? (
        <p className="sep-empty">No episodes yet. Add one above.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>S</th>
                <th>Ep</th>
                <th>Title</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Video</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td className="sep-num">{ep.seasonNumber ?? "—"}</td>
                  <td className="sep-num">{ep.episodeNumber ?? "—"}</td>
                  <td className="td-title">{ep.title}</td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS[ep.status]}`}>
                      {ep.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="sep-meta">
                    {ep.duration ? `${ep.duration}m` : "—"}
                  </td>
                  <td>
                    <span className={`dot ${ep.videoUrl ? "dot--green" : "dot--red"}`} />
                  </td>
                  <td>
                    <div className="action-btns">
                      <Link
                        href={`/admin/works/${ep.id}`}
                        className="action-btn"
                        title="Edit episode"
                      >
                        <Pencil size={14} />
                      </Link>
                      <DeleteWorkButton id={ep.id} title={ep.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
