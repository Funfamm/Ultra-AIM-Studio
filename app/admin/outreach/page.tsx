// /admin/outreach — Communication command center
// Tabs: Compose | History | Queue Status | Templates →

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import OutreachComposeForm from "./compose-form";
import OutreachCardActions from "./outreach-actions";
import "./outreach.css";

export const metadata: Metadata = { title: "Outreach — Admin" };

type Tab = "compose" | "history" | "queue";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

function fmtDate(d: Date) {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
  return `${date}, ${time}`;
}

export default async function AdminOutreachPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const { tab: tabRaw } = await searchParams;
  const tab: Tab =
    tabRaw === "history" ? "history"
    : tabRaw === "queue"  ? "queue"
    : "compose";

  const acsConfigured = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );

  const [
    activeUserCount, inAppTotal, queuedCount,
    settings, publishedWorks, publishedEpisodes,
    announcements, queueRows,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.notification.count(),
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.adminSettings.findUnique({
      where:  { id: "singleton" },
      select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true, notificationEmailEnabled: true },
    }),
    // Published non-episode works (for New Release type)
    prisma.work.findMany({
      where:   { status: "PUBLISHED", type: { not: "EPISODE" } },
      select:  { id: true, title: true, type: true, posterUrl: true, trailerUrl: true, videoUrl: true },
      orderBy: { updatedAt: "desc" },
      take:    100,
    }),
    // Published episodes with a parent series (for Season Drop type)
    prisma.work.findMany({
      where: {
        status:   "PUBLISHED",
        type:     "EPISODE",
        parentId: { not: null },
      },
      select: {
        id:            true,
        title:         true,
        episodeNumber: true,
        seasonNumber:  true,
        posterUrl:     true,
        parent:        { select: { id: true, title: true, slug: true } },
      },
      orderBy: [{ parent: { title: "asc" } }, { seasonNumber: "asc" }, { episodeNumber: "asc" }],
      take:    200,
    }),
    // History tab: last 50 announcements
    prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    // Queue tab: last 100 EmailQueue rows (all statuses) for overview
    prisma.emailQueue.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
      select: {
        id: true, to: true, subject: true, type: true,
        status: true, campaignId: true, createdAt: true, processedAt: true, error: true,
      },
    }),
  ]);

  // Email channel is available when ACS is wired up AND all three email flags are on
  const acsReady =
    acsConfigured &&
    (settings?.emailSendingEnabled      ?? true)  &&
    (settings?.bulkEmailSendingEnabled  ?? false) &&
    (settings?.notificationEmailEnabled ?? false);

  return (
    <div className="outreach-page">
      <h1 className="admin-page-title">Outreach</h1>
      <p className="outreach-sub">
        Communication command center — compose and deliver messages to your audience.
      </p>

      {/* ── Stats ─────────────────────────────────── */}
      <div className="outreach-stats">
        <div className="outreach-stat">
          <span className="outreach-stat-value">{activeUserCount}</span>
          <span className="outreach-stat-label">Active users</span>
        </div>
        <div className="outreach-stat">
          <span className="outreach-stat-value">{inAppTotal}</span>
          <span className="outreach-stat-label">In-app sent (all time)</span>
        </div>
        <div className="outreach-stat">
          <span className="outreach-stat-value">{queuedCount}</span>
          <span className="outreach-stat-label">Emails in queue</span>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────── */}
      <div className="outreach-tabs" role="tablist">
        <Link
          href="/admin/outreach?tab=compose"
          className={`outreach-tab${tab === "compose" ? " outreach-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "compose"}
        >
          Compose
        </Link>
        <Link
          href="/admin/outreach?tab=history"
          className={`outreach-tab${tab === "history" ? " outreach-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "history"}
        >
          History
        </Link>
        <Link
          href="/admin/outreach?tab=queue"
          className={`outreach-tab${tab === "queue" ? " outreach-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "queue"}
        >
          Queue Status
        </Link>
        <Link
          href="/admin/email/templates"
          className="outreach-tab outreach-tab--link"
          title="Manage email templates"
        >
          Templates <ExternalLink size={11} />
        </Link>
      </div>

      {/* ── Tab content ───────────────────────────── */}
      {tab === "compose" && (
        <OutreachComposeForm
          acsReady={acsReady}
          acsConfigured={acsConfigured}
          bulkEmailEnabled={
            (settings?.emailSendingEnabled      ?? true)  &&
            (settings?.bulkEmailSendingEnabled  ?? false) &&
            (settings?.notificationEmailEnabled ?? false)
          }
          publishedEpisodes={publishedEpisodes.map((e) => ({
            id:            e.id,
            title:         e.title,
            episodeNumber: e.episodeNumber,
            seasonNumber:  e.seasonNumber,
            posterUrl:     e.posterUrl ?? null,
            seriesTitle:   e.parent?.title ?? null,
            seriesId:      e.parent?.id    ?? null,
            seriesSlug:    e.parent?.slug  ?? null,
          }))}
          publishedWorks={publishedWorks.map((w) => ({
            id:         w.id,
            title:      w.title,
            type:       w.type,
            posterUrl:  w.posterUrl  ?? null,
            trailerUrl: w.trailerUrl ?? null,
            videoUrl:   w.videoUrl   ?? null,
          }))}
        />
      )}
      {tab === "history" && <OutreachHistory announcements={announcements} />}
      {tab === "queue"   && <OutreachQueue rows={queueRows} />}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────

type AnnouncementRow = {
  id:               string;
  title:            string;
  body:             string;
  href:             string | null;
  type:             string;
  sendInApp:        boolean;
  sendEmail:        boolean;
  publishedAt:      Date | null;
  emailSentAt:      Date | null;
  expiresAt:        Date | null;
  createdAt:        Date;
  audienceType:     string;
  scheduledAt:      Date | null;
  recipientCount:   number;
  emailQueuedCount: number;
};

function OutreachHistory({ announcements }: { announcements: AnnouncementRow[] }) {
  return (
    <div className="outreach-section">
      <h2 className="outreach-section-title">
        History ({announcements.length})
      </h2>

      {announcements.length === 0 ? (
        <p className="outreach-empty">No announcements yet. Create one in the Compose tab.</p>
      ) : (
        <div className="outreach-list">
          {announcements.map((a) => (
            <div key={a.id} className={`outreach-card${a.publishedAt ? " outreach-card--published" : ""}`}>
              <div className="outreach-card-head">
                <h3 className="outreach-card-title">{a.title}</h3>
                <div className="outreach-card-badges">
                  <span className={`outreach-badge ${
                    a.publishedAt ? "outreach-badge--published"
                    : a.scheduledAt ? "outreach-badge--scheduled"
                    : "outreach-badge--draft"
                  }`}>
                    {a.publishedAt ? "Published" : a.scheduledAt ? "Scheduled" : "Draft"}
                  </span>
                  {a.sendInApp  && <span className="outreach-badge outreach-badge--inapp">In-app</span>}
                  {a.sendEmail  && <span className="outreach-badge outreach-badge--email">Email</span>}
                  <span className="outreach-badge outreach-badge--type">{a.audienceType}</span>
                </div>
              </div>

              <p className="outreach-card-body">{a.body}</p>

              {/* Delivery stats */}
              {a.publishedAt && (
                <div className="outreach-card-stats">
                  {a.recipientCount > 0 && (
                    <span className="outreach-card-stat-item">
                      <span className="outreach-card-stat-num">{a.recipientCount}</span> in-app
                    </span>
                  )}
                  {a.emailQueuedCount > 0 && (
                    <span className="outreach-card-stat-item">
                      <span className="outreach-card-stat-num">{a.emailQueuedCount}</span> email queued
                    </span>
                  )}
                </div>
              )}

              <div className="outreach-card-meta">
                <span>Created {fmtDate(a.createdAt)}</span>
                {a.scheduledAt && !a.publishedAt && <span>Scheduled for {fmtDate(a.scheduledAt)}</span>}
                {a.publishedAt && <span>Published {fmtDate(a.publishedAt)}</span>}
                {a.emailSentAt && <span>Email queued {fmtDate(a.emailSentAt)}</span>}
                {a.expiresAt   && <span>Expires {fmtDate(a.expiresAt)}</span>}
                {a.href        && <span>Link: {a.href}</span>}
              </div>

              <OutreachCardActions id={a.id} isPublished={!!a.publishedAt} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Queue Status tab ──────────────────────────────────────────

type QueueRow = {
  id:          string;
  to:          string;
  subject:     string;
  type:        string;
  status:      string;
  campaignId:  string | null;
  createdAt:   Date;
  processedAt: Date | null;
  error:       string | null;
};

const STATUS_CLASS: Record<string, string> = {
  QUEUED:     "outreach-status-badge--queued",
  SENT:       "outreach-status-badge--sent",
  FAILED:     "outreach-status-badge--failed",
  SUPPRESSED: "outreach-status-badge--suppressed",
  SKIPPED:    "outreach-status-badge--skipped",
};

function OutreachQueue({ rows }: { rows: QueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="outreach-section">
        <h2 className="outreach-section-title">Queue Status</h2>
        <p className="outreach-empty">No email queue rows found.</p>
      </div>
    );
  }

  return (
    <div className="outreach-section">
      <h2 className="outreach-section-title">
        Queue Status — last {rows.length} rows
      </h2>
      <p className="outreach-hint">
        Full logs at{" "}
        <Link href="/admin/email/logs" style={{ color: "var(--color-brand-accent)" }}>
          Admin → Email → Logs
        </Link>.
        Process queued emails at{" "}
        <Link href="/admin/email" style={{ color: "var(--color-brand-accent)" }}>
          Admin → Email
        </Link>.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="outreach-queue-table">
          <thead>
            <tr>
              <th>To</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Status</th>
              <th>Campaign</th>
              <th>Created</th>
              <th>Processed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td title={r.to}>{r.to}</td>
                <td title={r.subject}>{r.subject}</td>
                <td>{r.type.replace(/_/g, " ")}</td>
                <td>
                  <span className={`outreach-status-badge ${STATUS_CLASS[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                  {r.error && (
                    <span title={r.error} style={{ marginLeft: "0.35rem", fontSize: "0.7rem", color: "var(--color-brand-red)" }}>
                      ⚠
                    </span>
                  )}
                </td>
                <td title={r.campaignId ?? ""}>{r.campaignId?.replace(/_/g, " ") ?? "—"}</td>
                <td>{fmtDate(r.createdAt)}</td>
                <td>{r.processedAt ? fmtDate(r.processedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
