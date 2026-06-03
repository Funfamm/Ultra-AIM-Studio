// /admin/email/logs — full email log viewer
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, MinusCircle, Clock, SkipForward, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import "../email-admin.css";

export const metadata: Metadata = { title: "Email Logs — Admin" };

type StatusFilter = "ALL" | "SENT" | "FAILED" | "SUPPRESSED" | "QUEUED" | "SKIPPED";

type Props = {
  searchParams: Promise<{ status?: string; type?: string }>;
};

function statusIcon(status: string) {
  if (status === "SENT")       return <CheckCircle  size={13} className="elog-sent"       />;
  if (status === "FAILED")     return <XCircle      size={13} className="elog-failed"     />;
  if (status === "SUPPRESSED") return <MinusCircle  size={13} className="elog-suppressed" />;
  if (status === "QUEUED")     return <Clock        size={13} className="elog-queued"     />;
  if (status === "SKIPPED")    return <SkipForward  size={13} className="elog-skipped"    />;
  return null;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

const STATUS_OPTIONS: StatusFilter[] = ["ALL", "SENT", "FAILED", "SUPPRESSED", "QUEUED", "SKIPPED"];

export default async function AdminEmailLogsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const params     = await searchParams;
  const rawStatus  = (params.status ?? "ALL").toUpperCase() as StatusFilter;
  const statusFilter: StatusFilter = STATUS_OPTIONS.includes(rawStatus) ? rawStatus : "ALL";
  const typeFilter = params.type ?? "";

  const where = {
    ...(statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
    ...(typeFilter              ? { type:   typeFilter   as any } : {}),
  };

  const [logs, counts] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, to: true, subject: true, type: true,
        provider: true, status: true, error: true, createdAt: true,
      },
    }),
    prisma.emailLog.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.status] = row._count._all;
  const totalAll = counts.reduce((sum, r) => sum + r._count._all, 0);

  return (
    <div className="email-page">
      <div className="email-section-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <Link href="/admin/email" className="email-back-link">
            <ArrowLeft size={13} /> Email settings
          </Link>
          <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Email Logs</h1>
        </div>
      </div>

      {/* ── Status counts ──────────────────────────── */}
      <section className="email-section">
        <div className="email-stats">
          <div className="email-stat">
            <span className="email-stat-val">{totalAll}</span>
            <span className="email-stat-label">Total</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val">{countMap["SENT"] ?? 0}</span>
            <span className="email-stat-label">Sent</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--red">{countMap["FAILED"] ?? 0}</span>
            <span className="email-stat-label">Failed</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{countMap["SUPPRESSED"] ?? 0}</span>
            <span className="email-stat-label">Suppressed</span>
          </div>
          {(countMap["QUEUED"] ?? 0) > 0 && (
            <div className="email-stat">
              <span className="email-stat-val email-stat-val--muted">{countMap["QUEUED"]}</span>
              <span className="email-stat-label">Queued</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Filters ───────────────────────────────── */}
      <section className="email-section">
        <div className="email-filter-row">
          {STATUS_OPTIONS.map(s => (
            <Link
              key={s}
              href={`/admin/email/logs?status=${s}${typeFilter ? `&type=${typeFilter}` : ""}`}
              className={`email-filter-pill${statusFilter === s ? " email-filter-pill--active" : ""}`}
            >
              {s === "ALL" ? `All (${totalAll})` : `${s} (${countMap[s] ?? 0})`}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Log table ─────────────────────────────── */}
      <section className="email-section">
        {logs.length === 0 ? (
          <p className="email-empty">No logs match the current filter.</p>
        ) : (
          <>
            <p className="email-hint" style={{ marginBottom: "0.75rem" }}>
              Showing {logs.length} most recent{statusFilter !== "ALL" ? ` ${statusFilter}` : ""} emails
              {logs.length === 200 ? " (limit 200)" : ""}.
            </p>
            <div className="email-log-wrap">
              <table className="email-log-table">
                <thead>
                  <tr>
                    <th>Status</th><th>To</th><th>Subject</th>
                    <th>Type</th><th>Provider</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr key={log.id}>
                        <td>
                          <span className="elog-status-cell">
                            {statusIcon(log.status)}
                            <span>{log.status}</span>
                          </span>
                        </td>
                        <td className="elog-to">{log.to}</td>
                        <td className="elog-subject" title={log.subject}>{log.subject}</td>
                        <td><span className="elog-badge">{log.type}</span></td>
                        <td className="elog-provider">{log.provider}</td>
                        <td className="elog-date">{fmtDate(log.createdAt)}</td>
                      </tr>
                      {log.status === "FAILED" && log.error && (
                        <tr key={`${log.id}-err`} className="elog-error-row">
                          <td />
                          <td colSpan={5} className="elog-error-cell">
                            {log.error.slice(0, 300)}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
