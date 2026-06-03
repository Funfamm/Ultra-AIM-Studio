import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Activity, Users, Eye, Shield, MonitorPlay } from "lucide-react";
import type { Metadata } from "next";
import "./admin-overview.css";

export const metadata: Metadata = { title: "Admin — Command Center" };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

async function getStats() {
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const onlineCut  = new Date(now.getTime() - 2 * 60_000); // 2-min online window

  const [
    totalWorks, publishedWorks, totalUsers, newThisMonth,
    onlineCount, onlineMembers,
    viewsToday, watchStartsToday,
    openAlerts,
    recentUsers,
  ] = await Promise.all([
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),

    // Live visitor counts
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut } } }),
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut }, userId: { not: null } } }),

    // Today's activity
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW",    createdAt: { gte: dayStart } } }),
    prisma.analyticsEvent.count({ where: { type: "WATCH_START",  createdAt: { gte: dayStart } } }),

    // Security
    prisma.securityAlert.count({ where: { status: "OPEN" } }),

    // Recent members
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);

  return {
    totalWorks, publishedWorks, totalUsers, newThisMonth,
    onlineCount, onlineGuests: onlineCount - onlineMembers, onlineMembers,
    viewsToday, watchStartsToday,
    openAlerts,
    recentUsers,
  };
}

export default async function AdminOverviewPage() {
  const {
    totalWorks, publishedWorks, totalUsers, newThisMonth,
    onlineCount, onlineGuests, onlineMembers,
    viewsToday, watchStartsToday,
    openAlerts,
    recentUsers,
  } = await getStats();

  const greeting = getGreeting();

  const stats = [
    { label: "Total Works",    value: totalWorks,      note: "films & series" },
    { label: "Published",      value: publishedWorks,  note: "live now" },
    { label: "Members",        value: totalUsers,       note: "registered" },
    { label: "New This Month", value: newThisMonth,    note: "recent signups" },
  ];

  return (
    <div className="admin-page">

      {/* ── Command Center header ── */}
      <div className="cmd-header">
        <div>
          <p className="cmd-greeting">{greeting}, Director.</p>
          <h1 className="cmd-title">Studio Command Center</h1>
        </div>
      </div>

      {/* ── Live intelligence pills ── */}
      <div className="cmd-live-bar">
        <Link href="/admin/analytics/visitors" className="cmd-live-pill cmd-live-pill--online">
          <span className="cmd-live-dot" />
          <span className="cmd-live-val">{onlineCount}</span>
          <span className="cmd-live-lbl">Online Now</span>
        </Link>
        <div className="cmd-live-pill">
          <Users size={12} />
          <span className="cmd-live-val">{onlineMembers}</span>
          <span className="cmd-live-lbl">Members Online</span>
        </div>
        <div className="cmd-live-pill">
          <Eye size={12} />
          <span className="cmd-live-val">{onlineGuests}</span>
          <span className="cmd-live-lbl">Guests Online</span>
        </div>
        <div className="cmd-live-pill">
          <Activity size={12} />
          <span className="cmd-live-val">{viewsToday}</span>
          <span className="cmd-live-lbl">Views Today</span>
        </div>
        <div className="cmd-live-pill">
          <MonitorPlay size={12} />
          <span className="cmd-live-val">{watchStartsToday}</span>
          <span className="cmd-live-lbl">Watch Starts</span>
        </div>
        {openAlerts > 0 && (
          <Link href="/admin/security" className="cmd-live-pill cmd-live-pill--alert">
            <Shield size={12} />
            <span className="cmd-live-val">{openAlerts}</span>
            <span className="cmd-live-lbl">Open Alerts</span>
          </Link>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="cmd-stats">
        {stats.map((s) => (
          <div key={s.label} className="cmd-stat">
            <div className="cmd-stat-value">{s.value}</div>
            <div className="cmd-stat-label">{s.label}</div>
            <div className="cmd-stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      {/* ── Recent members ── */}
      <div className="admin-section">
        <div className="admin-section-hd">
          <h2 className="admin-section-title">Recent Members</h2>
          <Link href="/admin/users" className="admin-section-link">View all</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="td-primary">{u.name ?? "—"}</td>
                  <td className="td-muted">{u.email}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="td-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={4} className="table-empty">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
