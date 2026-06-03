// System Health tab — DB inventory, config status, live activity feed
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics — System" };

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  PAGE_VIEW:        "Page View",
  WORK_VIEW:        "Work Viewed",
  TRAILER_CLICK:    "Trailer Click",
  WATCH_START:      "Watch Started",
  WATCH_PROGRESS:   "Watch Progress",
  WATCH_COMPLETE:   "Watch Completed",
  EPISODE_START:    "Episode Started",
  EPISODE_COMPLETE: "Episode Completed",
  SIGN_IN:          "Sign In",
  SIGN_UP:          "Sign Up",
  SIGN_OUT:         "Sign Out",
  SAVE_WORK:        "Saved Work",
  UNSAVE_WORK:      "Unsaved Work",
  NOTIFICATION_OPEN:"Notification Open",
  SETTINGS_UPDATE:  "Settings Update",
};

export default async function SystemPage() {
  const dbStart = Date.now();

  // DB table counts + recent activity in parallel
  const [
    userCount,
    workCount,
    episodeCount,
    progressCount,
    savedWorkCount,
    notificationCount,
    sessionCount,
    eventCount,
    emailLogCount,
    suppressionCount,
    tokenCount,
    recentEvents,
    recentErrors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { type: "EPISODE" } }),
    prisma.watchProgress.count(),
    prisma.savedWork.count(),
    prisma.notification.count(),
    prisma.visitorSession.count(),
    prisma.analyticsEvent.count(),
    prisma.emailLog.count(),
    prisma.emailSuppression.count({ where: { active: true } }),
    prisma.passwordResetToken.count({ where: { used: false } }),
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { type: true, path: true, createdAt: true, userId: true },
    }),
    prisma.emailLog.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { to: true, subject: true, error: true, createdAt: true },
    }),
  ]);

  const dbLatencyMs = Date.now() - dbStart;

  // Config checks — never expose secret values
  const graphOk  = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID && process.env.GRAPH_EMAIL_SENDER);
  const smtpOk   = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const googleOk = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const dbOk     = !!(process.env.DATABASE_URL);
  const authOk   = !!(process.env.AUTH_SECRET);
  const appUrlOk = !!(process.env.NEXT_PUBLIC_APP_URL);

  const services = [
    { name: "Database (Neon)",     ok: dbOk,     note: dbOk ? `~${dbLatencyMs}ms latency` : "DATABASE_URL missing" },
    { name: "Auth Secret",         ok: authOk,   note: authOk ? "Configured" : "AUTH_SECRET missing" },
    { name: "App URL",             ok: appUrlOk, note: process.env.NEXT_PUBLIC_APP_URL ?? "Not set" },
    { name: "Email (Graph API)",   ok: graphOk,  note: graphOk ? `From: ${process.env.GRAPH_EMAIL_SENDER}` : "Azure env vars missing" },
    { name: "SMTP Fallback",       ok: smtpOk,   warn: true, note: smtpOk ? "Configured" : "Not configured (optional)" },
    { name: "Google OAuth",        ok: googleOk, warn: true, note: googleOk ? "Configured" : "Not configured (optional)" },
  ];

  const tables = [
    { name: "users",           count: userCount },
    { name: "works",           count: workCount },
    { name: "episodes",        count: episodeCount },
    { name: "watch_progress",  count: progressCount },
    { name: "saved_works",     count: savedWorkCount },
    { name: "notifications",   count: notificationCount },
    { name: "visitor_sessions",count: sessionCount },
    { name: "analytics_events",count: eventCount },
    { name: "email_logs",      count: emailLogCount },
    { name: "email_supp.",     count: suppressionCount },
    { name: "reset_tokens",    count: tokenCount },
  ];

  return (
    <div>
      {/* ── DB latency + summary ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className={`astat-cell-val ${dbLatencyMs < 100 ? "astat-cell-val--green" : dbLatencyMs < 500 ? "astat-cell-val--accent" : "astat-cell-val--red"}`}>
            {dbLatencyMs}ms
          </div>
          <div className="astat-cell-lbl">DB Latency</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{eventCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Analytics Events</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{sessionCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Visitor Sessions</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{emailLogCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Emails Logged</div>
        </div>
        <div className="astat-cell">
          <div className={`astat-cell-val ${recentErrors.length > 0 ? "astat-cell-val--red" : "astat-cell-val--green"}`}>
            {recentErrors.length}
          </div>
          <div className="astat-cell-lbl">Email Failures</div>
        </div>
      </div>

      {/* ── Service status ── */}
      <div className="asection">
        <h2 className="asection-title">Service Status</h2>
        <div className="achart">
          {services.map((s) => (
            <div key={s.name} className="sys-status-row">
              <span className={`sys-dot ${s.ok ? "sys-dot--ok" : s.warn ? "sys-dot--warn" : "sys-dot--err"}`} />
              <span className="sys-status-name">{s.name}</span>
              <span className="sys-status-note">{s.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DB inventory ── */}
      <div className="asection">
        <h2 className="asection-title">Database Inventory</h2>
        <div className="db-grid">
          {tables.map((t) => (
            <div key={t.name} className="db-card">
              <div className="db-count">{t.count.toLocaleString()}</div>
              <div className="db-table-name">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Email failures ── */}
      {recentErrors.length > 0 && (
        <div className="asection">
          <h2 className="asection-title">Recent Email Failures</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>To</th><th>Subject</th><th>Error</th><th>When</th></tr></thead>
              <tbody>
                {recentErrors.map((e, i) => (
                  <tr key={i}>
                    <td className="a-muted">{e.to}</td>
                    <td className="a-muted">{e.subject}</td>
                    <td style={{ color: "var(--color-brand-red)", fontSize: "0.75rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.error ?? "Unknown"}
                    </td>
                    <td className="a-muted" style={{ whiteSpace: "nowrap" }}>{timeAgo(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Live activity feed ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Live Activity</h2>
          <span className="asection-count">last 20 events · all types</span>
        </div>
        {recentEvents.length === 0 ? <p className="aempty">No events yet.</p> : (
          <div className="activity-feed">
            {recentEvents.map((e, i) => (
              <div key={i} className="activity-row">
                <span className="activity-dot" style={{ background: e.userId ? "#4ade80" : "var(--color-brand-accent)" }} />
                <span className="activity-type">{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="activity-path">{e.path ?? "—"}</span>
                <span style={{ fontSize: "0.68rem", color: "var(--color-brand-border)", marginRight: "0.5rem" }}>
                  {e.userId ? "user" : "guest"}
                </span>
                <span className="activity-time">{timeAgo(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
