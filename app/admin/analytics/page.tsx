// Admin Analytics — Overview tab
// Server-rendered. CSS-only charts. No client JS on this page.
// All queries isolated to /admin/analytics — not loaded on public routes.

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics — Overview" };

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
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

export default async function AnalyticsOverviewPage() {
  const now       = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now.getTime() - 7  * 86400_000);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  const [
    totalUsers,
    newThisMonth,
    totalWorks,
    publishedWorks,
    pageViewsToday,
    pageViewsWeek,
    pageViewsMonth,
    trailerClicksWeek,
    watchStartsWeek,
    watchCompletesWeek,
    signUpsWeek,
    savedWorksTotal,
    emailSentToday,
    emailFailedTotal,
    suppressionCount,
    recentEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: todayStart } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: monthStart } } }),
    prisma.analyticsEvent.count({ where: { type: "TRAILER_CLICK", createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: { in: ["WATCH_START", "EPISODE_START"] }, createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: { in: ["WATCH_COMPLETE", "EPISODE_COMPLETE"] }, createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: "SIGN_UP", createdAt: { gte: weekStart } } }),
    prisma.savedWork.count(),
    prisma.emailLog.count({ where: { status: "SENT",   createdAt: { gte: todayStart } } }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.emailSuppression.count({ where: { active: true } }),
    prisma.analyticsEvent.findMany({
      where: { type: { notIn: ["PAGE_VIEW", "WATCH_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { type: true, path: true, createdAt: true, userId: true },
    }),
  ]);

  const completionRate = watchStartsWeek > 0
    ? Math.round((watchCompletesWeek / watchStartsWeek) * 100) : 0;

  const graphOk = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID && process.env.GRAPH_EMAIL_SENDER);

  return (
    <div>
      {/* ── Top stat row ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className="astat-cell-val">{totalUsers.toLocaleString()}</div>
          <div className="astat-cell-lbl">Total Members</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--accent">{newThisMonth}</div>
          <div className="astat-cell-lbl">New This Month</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{publishedWorks}</div>
          <div className="astat-cell-lbl">Published Works</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{totalWorks}</div>
          <div className="astat-cell-lbl">Total Works</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{savedWorksTotal.toLocaleString()}</div>
          <div className="astat-cell-lbl">Watchlist Saves</div>
        </div>
      </div>

      {/* ── Traffic + engagement cards ── */}
      <div className="acols">

        <div className="asection">
          <h2 className="asection-title">Page Views</h2>
          <div className="achart">
            {[
              { label: "Today",      val: pageViewsToday },
              { label: "This Week",  val: pageViewsWeek  },
              { label: "This Month", val: pageViewsMonth  },
            ].map(({ label, val }) => (
              <div key={label} className="abar-row">
                <span className="abar-label">{label}</span>
                <div className="abar-track">
                  <div className="abar-fill" style={{ width: pageViewsMonth > 0 ? `${Math.round((val / pageViewsMonth) * 100)}%` : "0%" }} />
                </div>
                <span className="abar-count">{val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="asection">
          <h2 className="asection-title">Engagement (7 days)</h2>
          <div className="achart">
            {[
              { label: "Sign-ups",    val: signUpsWeek },
              { label: "Trailers",    val: trailerClicksWeek },
              { label: "Watch Starts",val: watchStartsWeek },
              { label: "Completions", val: watchCompletesWeek },
            ].map(({ label, val }) => {
              const max = Math.max(signUpsWeek, trailerClicksWeek, watchStartsWeek, watchCompletesWeek, 1);
              return (
                <div key={label} className="abar-row">
                  <span className="abar-label">{label}</span>
                  <div className="abar-track">
                    <div className="abar-fill" style={{ width: `${Math.round((val / max) * 100)}%` }} />
                  </div>
                  <span className="abar-count">{val}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Email + completion row ── */}
      <div className="acols" style={{ marginTop: "1.5rem" }}>

        <div className="asection">
          <h2 className="asection-title">Email Health</h2>
          <div className="achart">
            <div className="abar-row">
              <span className="abar-label">Provider</span>
              <span className="abar-count" style={{ width: "auto", textAlign: "left", color: graphOk ? "#4ade80" : "var(--color-brand-red)" }}>
                {graphOk ? "Graph ✓" : "Not configured"}
              </span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Sent today</span>
              <span className="abar-count" style={{ width: "auto" }}>{emailSentToday}</span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Failed (all)</span>
              <span className="abar-count" style={{ width: "auto", color: emailFailedTotal > 0 ? "var(--color-brand-red)" : "inherit" }}>{emailFailedTotal}</span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Suppressed</span>
              <span className="abar-count" style={{ width: "auto" }}>{suppressionCount}</span>
            </div>
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/admin/email" className="asection-count" style={{ color: "var(--color-brand-accent)", textDecoration: "none" }}>
              View full email log →
            </Link>
          </p>
        </div>

        <div className="asection">
          <h2 className="asection-title">Watch Funnel (7 days)</h2>
          <div className="achart">
            <div className="abar-row">
              <span className="abar-label">Starts</span>
              <div className="abar-track">
                <div className="abar-fill" style={{ width: "100%" }} />
              </div>
              <span className="abar-count">{watchStartsWeek}</span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Completed</span>
              <div className="abar-track">
                <div className="abar-fill" style={{ width: watchStartsWeek > 0 ? `${completionRate}%` : "0%" }} />
              </div>
              <span className="abar-count">{watchCompletesWeek}</span>
            </div>
            <div className="abar-row" style={{ marginTop: "0.25rem" }}>
              <span className="abar-label" style={{ color: "var(--color-brand-muted)" }}>Completion</span>
              <span className={`rate-chip ${completionRate >= 60 ? "rate-chip--good" : completionRate >= 30 ? "rate-chip--mid" : "rate-chip--low"}`}>
                {completionRate}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Live activity feed ── */}
      <div className="asection" style={{ marginTop: "2rem" }}>
        <div className="asection-hd">
          <h2 className="asection-title">Recent Activity</h2>
          <span className="asection-count">last 15 meaningful events</span>
        </div>
        {recentEvents.length === 0 ? (
          <p className="aempty">No events recorded yet.</p>
        ) : (
          <div className="activity-feed">
            {recentEvents.map((e, i) => (
              <div key={i} className="activity-row">
                <span className="activity-dot" />
                <span className="activity-type">{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="activity-path">{e.path ?? "—"}</span>
                <span className="activity-time">{timeAgo(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links to other tabs ── */}
      <div className="acols" style={{ marginTop: "2rem" }}>
        {[
          { href: "/admin/analytics/traffic",  label: "Traffic →",  note: "Top pages, devices, referrers, countries" },
          { href: "/admin/analytics/content",  label: "Content →",  note: "Trailer leaderboard, film ranking, completions" },
          { href: "/admin/analytics/visitors", label: "Visitors →", note: "Sessions, browser, OS, geo breakdown" },
          { href: "/admin/analytics/system",   label: "System →",   note: "DB inventory, config health, service status" },
        ].map((l) => (
          <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
            <div className="astat" style={{ cursor: "pointer", transition: "border-color 0.2s" }}>
              <div className="astat-value" style={{ fontSize: "1rem" }}>{l.label}</div>
              <div className="astat-label" style={{ marginTop: "0.4rem" }}>{l.note}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
