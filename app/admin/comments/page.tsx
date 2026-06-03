import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { adminModerateComment, adminResolveReport } from "@/lib/actions/comments";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin — Comments" };

type Filter = "ALL" | "PUBLISHED" | "HIDDEN" | "REPORTED" | "DELETED";

type Props = { searchParams: Promise<{ filter?: string; cursor?: string }> };

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL",       label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "HIDDEN",    label: "Hidden" },
  { value: "REPORTED",  label: "Reported" },
  { value: "DELETED",   label: "Deleted" },
];

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam", HARASSMENT: "Harassment", HATE_OR_ABUSE: "Hate or abuse",
  SEXUAL_CONTENT: "Sexual content", VIOLENCE_OR_THREATS: "Violence / threats",
  PERSONAL_INFORMATION: "Personal info", OTHER: "Other",
};

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function AdminCommentsPage({ searchParams }: Props) {
  await requireAdmin();
  const { filter: filterRaw, cursor } = await searchParams;
  const filter = (FILTERS.find((f) => f.value === filterRaw)?.value ?? "ALL") as Filter;

  const where =
    filter === "ALL"       ? {} :
    filter === "REPORTED"  ? { reports: { some: { status: "OPEN" as const } } } :
    { status: filter as "PUBLISHED" | "HIDDEN" | "DELETED" };

  const PAGE = 25;
  const items = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, body: true, status: true, isPinned: true,
      likeCount: true, replyCount: true, createdAt: true, parentId: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      work: { select: { id: true, slug: true, title: true } },
      reports: {
        where: { status: "OPEN" },
        select: { id: true, reason: true, details: true, createdAt: true, user: { select: { name: true } } },
        take: 3,
      },
    },
  });

  const hasMore = items.length > PAGE;
  if (hasMore) items.pop();
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;
  const openReports = await prisma.commentReport.count({ where: { status: "OPEN" } });

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-page-title">Comments</h1>
        {openReports > 0 && (
          <span style={{
            fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 700,
            background: "rgba(192,57,43,0.15)", color: "var(--color-brand-red)",
            border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, padding: "0.25rem 0.6rem",
          }}>
            {openReports} open report{openReports !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/comments?filter=${f.value}`}
            style={{
              fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600,
              padding: "0.3rem 0.75rem", borderRadius: 4, textDecoration: "none",
              border: "1px solid",
              borderColor: filter === f.value ? "var(--color-brand-accent)" : "var(--color-brand-border)",
              color: filter === f.value ? "var(--color-brand-accent)" : "var(--color-brand-muted)",
              background: filter === f.value ? "rgba(232,201,126,0.07)" : "none",
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p style={{ fontFamily: "var(--font-body)", color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>
          No comments in this view.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Comment</th>
                <th>Author</th>
                <th>Work</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={{ maxWidth: 300 }}>
                    {c.isPinned && (
                      <span style={{ fontSize: "0.6rem", color: "var(--color-brand-accent)", fontFamily: "var(--font-body)", fontWeight: 700, display: "block", marginBottom: 2 }}>
                        📌 PINNED
                      </span>
                    )}
                    {c.parentId && (
                      <span style={{ fontSize: "0.6rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", display: "block", marginBottom: 2 }}>
                        ↳ reply
                      </span>
                    )}
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--color-brand-light)", margin: "0 0 0.25rem", lineHeight: 1.4, wordBreak: "break-word" }}>
                      {c.body.slice(0, 200)}{c.body.length > 200 ? "…" : ""}
                    </p>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-brand-muted)" }}>
                      {timeAgo(c.createdAt)} · ♥ {c.likeCount}
                    </span>
                    {c.reports.length > 0 && (
                      <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {c.reports.map((r) => (
                          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-brand-red)", fontWeight: 700 }}>
                              ⚑ {REASON_LABELS[r.reason] ?? r.reason}
                            </span>
                            {r.details && (
                              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-brand-muted)" }}>
                                "{r.details.slice(0, 60)}"
                              </span>
                            )}
                            <form>
                              <input type="hidden" name="reportId" value={r.id} />
                              <input type="hidden" name="status" value="DISMISSED" />
                              <button
                                formAction={async () => {
                                  "use server";
                                  await adminResolveReport(r.id, "DISMISSED");
                                }}
                                style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", background: "none", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-muted)", borderRadius: 3, padding: "0.15rem 0.4rem", cursor: "pointer" }}
                              >
                                Dismiss
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-light)", margin: 0 }}>{c.user.name ?? "—"}</p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--color-brand-muted)", margin: 0 }}>{c.user.email}</p>
                  </td>
                  <td>
                    {c.work ? (
                      <Link href={`/works/${c.work.slug}`} style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none" }}>
                        {c.work.title.slice(0, 30)}{c.work.title.length > 30 ? "…" : ""}
                      </Link>
                    ) : <span style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem" }}>—</span>}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                      color: c.status === "PUBLISHED" ? "#4ade80" : c.status === "HIDDEN" ? "var(--color-brand-accent)" : "var(--color-brand-muted)",
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", fontFamily: "var(--font-body)" }}>
                    {c.reports.length > 0 ? c.reports.length : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      {c.status === "PUBLISHED" && (
                        <form>
                          <button
                            formAction={async () => {
                              "use server";
                              await adminModerateComment(c.id, "HIDE");
                            }}
                            className="admin-action-btn"
                          >
                            Hide
                          </button>
                        </form>
                      )}
                      {c.status === "HIDDEN" && (
                        <form>
                          <button
                            formAction={async () => {
                              "use server";
                              await adminModerateComment(c.id, "RESTORE");
                            }}
                            className="admin-action-btn"
                          >
                            Restore
                          </button>
                        </form>
                      )}
                      {c.status !== "DELETED" && (
                        <form>
                          <button
                            formAction={async () => {
                              "use server";
                              await adminModerateComment(c.id, "DELETE");
                            }}
                            className="admin-action-btn admin-action-btn--danger"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                      {c.status === "PUBLISHED" && !c.isPinned && !c.parentId && (
                        <form>
                          <button
                            formAction={async () => {
                              "use server";
                              await adminModerateComment(c.id, "PIN");
                            }}
                            className="admin-action-btn"
                          >
                            Pin
                          </button>
                        </form>
                      )}
                      {c.isPinned && (
                        <form>
                          <button
                            formAction={async () => {
                              "use server";
                              await adminModerateComment(c.id, "UNPIN");
                            }}
                            className="admin-action-btn"
                          >
                            Unpin
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(nextCursor || cursor) && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
          {cursor && (
            <Link href={`/admin/comments?filter=${filter}`} style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none" }}>
              ← Start
            </Link>
          )}
          {nextCursor && (
            <Link href={`/admin/comments?filter=${filter}&cursor=${nextCursor}`} style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-brand-accent)", textDecoration: "none", marginLeft: "auto" }}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
