// Admin Audit Log — immutable record of all admin actions
// Server-rendered. CSS-only. No client JS.

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import "./audit.css";

export const metadata: Metadata = { title: "Admin — Audit Log" };

const PAGE_SIZE = 50;

const ACTION_META: Record<string, { label: string; cls: string }> = {
  ROLE_CHANGE:          { label: "Role Changed",      cls: "alog-badge--accent"  },
  SUSPEND:              { label: "Suspended",          cls: "alog-badge--red"     },
  UNSUSPEND:            { label: "Unsuspended",        cls: "alog-badge--green"   },
  BULK_SUSPEND:         { label: "Bulk Suspend",       cls: "alog-badge--red"     },
  BULK_UNSUSPEND:       { label: "Bulk Unsuspend",     cls: "alog-badge--green"   },
  PASSWORD_RESET_SENT:  { label: "Reset Email Sent",   cls: "alog-badge--muted"   },
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function pageUrl(p: number, action: string): string {
  const sp = new URLSearchParams();
  if (action) sp.set("action", action);
  if (p > 1)  sp.set("page", String(p));
  const qs = sp.toString();
  return `/admin/audit${qs ? `?${qs}` : ""}`;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp     = await searchParams;
  const action = sp.action ?? "";
  const page   = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where = action ? { action } : {};

  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Audit Log</h1>
        <span className="alog-total">{total.toLocaleString()} entries</span>
      </div>

      {/* ── Filter by action type ── */}
      <form method="get" action="/admin/audit" className="alog-filters">
        <select name="action" defaultValue={action} className="alog-select">
          <option value="">All Actions</option>
          {Object.entries(ACTION_META).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button type="submit" className="alog-filter-btn">Filter</button>
        {action && (
          <Link href="/admin/audit" className="alog-clear">Clear filter</Link>
        )}
      </form>

      {/* ── Table ── */}
      <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const meta = ACTION_META[e.action] ?? { label: e.action, cls: "alog-badge--muted" };
              return (
                <tr key={e.id}>
                  <td className="alog-when" style={{ whiteSpace: "nowrap" }}>
                    <span title={e.createdAt.toISOString()}>{timeAgo(e.createdAt)}</span>
                    <span className="alog-date">
                      {e.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </span>
                  </td>
                  <td>
                    <span className={`alog-badge ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="alog-email">{e.actorEmail}</td>
                  <td className="alog-email">{e.targetEmail ?? <span className="alog-dash">—</span>}</td>
                  <td className="alog-detail">{e.detail ?? <span className="alog-dash">—</span>}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  {action ? "No entries for this action type." : "No audit entries yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="upagination">
          {page > 1 ? (
            <Link href={pageUrl(page - 1, action)} className="upag-btn">← Prev</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← Prev</span>
          )}
          <span className="upag-info">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageUrl(page + 1, action)} className="upag-btn">Next →</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">Next →</span>
          )}
        </div>
      )}

    </div>
  );
}
