import { auth } from "@/lib/auth";
import { getAllWatchProgress } from "@/lib/actions/progress";
import { getDashboardSavedWorks, unsaveWork } from "@/lib/actions/watchlist";
import { getUserNotifications, markAllNotificationsRead, getUnreadNotificationCount } from "@/lib/actions/notifications";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import Image from "next/image";
import "./dashboard.css";
import {
  Clock, Play, LogOut, X, Bell, Settings, ChevronRight, Bookmark,
  Film, Clapperboard, Megaphone, Timer, User, Wrench,
} from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import { RemoveProgressBtn, ResetProgressBtn, ClearContinueWatchingBtn, ClearMyListBtn } from "./history-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — AIM Studio" };

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short Film", FULL_FILM: "Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

function NotifIcon({ type }: { type: string }) {
  switch (type) {
    case "NEW_RELEASE":    return <Film size={15} />;
    case "NEW_EPISODE":    return <Clapperboard size={15} />;
    case "ANNOUNCEMENT":   return <Megaphone size={15} />;
    case "WATCH_PROGRESS": return <Timer size={15} />;
    case "ACCOUNT":        return <User size={15} />;
    case "SYSTEM":         return <Wrench size={15} />;
    default:               return <Bell size={15} />;
  }
}

export default async function DashboardPage() {
  const session = await auth();

  const [progress, savedWorks, notifications, unreadCount] = await Promise.all([
    getAllWatchProgress(),
    getDashboardSavedWorks(),
    getUserNotifications(),
    getUnreadNotificationCount(),
  ]);

  const userName = session?.user?.name ?? "there";
  const userEmail = session?.user?.email ?? "";

  return (
    <>
      <NavWrapper />
      <div className="nav-offset">
        <main className="dashboard-page">
          <div className="container-app">

            {/* ── Header ── */}
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Hello, {userName}</h1>
                <p className="dashboard-sub">{userEmail}</p>
              </div>
              <div className="dashboard-header-actions">
                <Link href="/dashboard/notifications" className="dashboard-notif-btn" aria-label="Notifications">
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="dashboard-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </Link>
                <Link href="/dashboard/settings" className="dashboard-settings-btn" aria-label="Settings">
                  <Settings size={17} />
                </Link>
                <form action={logoutUser}>
                  <button type="submit" className="logout-btn">
                    <LogOut size={15} /> Sign Out
                  </button>
                </form>
              </div>
            </div>

            {/* ── Quick nav ── */}
            <nav className="dashboard-quicknav" aria-label="Dashboard sections">
              <Link href="#continue-watching" className="quicknav-chip">Continue Watching</Link>
              <Link href="#my-list" className="quicknav-chip">My List</Link>
              <Link href="/dashboard/notifications" className="quicknav-chip">
                Notifications {unreadCount > 0 && <span className="quicknav-badge">{unreadCount}</span>}
              </Link>
              <Link href="/dashboard/settings" className="quicknav-chip">Settings</Link>
            </nav>

            {/* ── Continue Watching ── */}
            <section id="continue-watching" className="dashboard-section">
              <div className="section-head">
                <h2 className="section-heading">Continue Watching</h2>
                {progress.length > 0 && <ClearContinueWatchingBtn />}
              </div>
              {progress.length > 0 ? (
                <div className="progress-grid">
                  {progress.slice(0, 8).map((p) => {
                    const watchHref =
                      p.work.type === "EPISODE" || p.work.type === "SERIES"
                        ? `/watch/${p.work.slug}`
                        : `/watch/${p.work.slug}?full=1`;
                    const pct = p.work.duration
                      ? Math.min(100, (p.seconds / (p.work.duration * 60)) * 100)
                      : null;
                    return (
                      <div key={p.id} className="progress-card-wrap">
                        <Link href={watchHref} className="progress-card">
                          {p.work.posterUrl ? (
                            <Image
                              src={p.work.posterUrl}
                              alt={p.work.title}
                              width={54}
                              height={80}
                              className="progress-poster"
                              loading="lazy"
                            />
                          ) : (
                            <div className="progress-poster-placeholder">
                              {p.work.title.charAt(0)}
                            </div>
                          )}
                          <div className="progress-info">
                            <p className="progress-type">{TYPE_LABEL[p.work.type] ?? p.work.type}</p>
                            <h3 className="progress-title">{p.work.title}</h3>
                            <div className="progress-meta">
                              <Clock size={12} />
                              {Math.floor(p.seconds / 60)}m {p.seconds % 60}s watched
                            </div>
                            {pct !== null && (
                              <div className="progress-bar-wrap" aria-label={`${Math.round(pct)}% watched`}>
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                          <div className="progress-play" aria-hidden="true">
                            <Play size={18} fill="currentColor" />
                          </div>
                        </Link>
                        <div className="progress-card-actions">
                          <ResetProgressBtn workId={p.work.id} title={p.work.title} />
                          <RemoveProgressBtn workId={p.work.id} title={p.work.title} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <p>No watch history yet.</p>
                  <Link href="/works" className="browse-btn">Browse Works</Link>
                </div>
              )}
            </section>

            {/* ── My List ── */}
            <section id="my-list" className="dashboard-section">
              <div className="section-head">
                <h2 className="section-heading">
                  <Bookmark size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }} />
                  My List
                </h2>
                {savedWorks.length > 0 && <ClearMyListBtn />}
              </div>
              {savedWorks.length > 0 ? (
                <div className="watchlist-grid">
                  {savedWorks.slice(0, 8).map((item) => {
                    const removeAction = unsaveWork.bind(null, item.work.id);
                    return (
                      <div key={item.id} className="watchlist-card">
                        <Link href={`/works/${item.work.slug}`} className="watchlist-link">
                          {item.work.posterUrl ? (
                            <Image
                              src={item.work.posterUrl}
                              alt={item.work.title}
                              width={54}
                              height={80}
                              className="progress-poster"
                              loading="lazy"
                            />
                          ) : (
                            <div className="progress-poster-placeholder">
                              {item.work.title.charAt(0)}
                            </div>
                          )}
                          <div className="progress-info">
                            <p className="progress-type">{TYPE_LABEL[item.work.type] ?? item.work.type}</p>
                            <h3 className="progress-title">{item.work.title}</h3>
                            <div className="progress-meta">
                              {item.work.year ? `${item.work.year}` : ""}
                            </div>
                          </div>
                        </Link>
                        <form action={removeAction}>
                          <button
                            type="submit"
                            className="watchlist-remove-btn"
                            aria-label={`Remove ${item.work.title} from list`}
                          >
                            <X size={14} />
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <p>Your list is empty.</p>
                  <Link href="/works" className="browse-btn">Browse Works</Link>
                </div>
              )}
            </section>

            {/* ── Notifications preview — only shown when there are notifications ── */}
            {notifications.length > 0 && (
              <section className="dashboard-section">
                <div className="section-head">
                  <h2 className="section-heading">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="section-badge">{unreadCount} new</span>
                    )}
                  </h2>
                  <Link href="/dashboard/notifications" className="section-link">
                    View all <ChevronRight size={14} />
                  </Link>
                </div>
                <ul className="notif-list">
                  {notifications.slice(0, 10).map((n) => (
                    <li key={n.id} className={`notif-item${n.read ? "" : " notif-item--unread"}`}>
                      <span className="notif-icon" aria-hidden="true"><NotifIcon type={n.type} /></span>
                      <div className="notif-body">
                        {n.href ? (
                          <Link href={n.href} className="notif-title">{n.title}</Link>
                        ) : (
                          <p className="notif-title">{n.title}</p>
                        )}
                        {n.body && <p className="notif-text">{n.body}</p>}
                      </div>
                      {!n.read && <span className="notif-dot" aria-label="Unread" />}
                    </li>
                  ))}
                </ul>
                {unreadCount > 0 && (
                  <form action={markAllNotificationsRead} className="notif-mark-all-form">
                    <button type="submit" className="notif-mark-all-btn">Mark all as read</button>
                  </form>
                )}
              </section>
            )}

            {/* ── Settings shortcut ── */}
            <section className="dashboard-section">
              <div className="section-head">
                <h2 className="section-heading">Account</h2>
              </div>
              <div className="settings-shortcuts">
                <Link href="/dashboard/settings" className="settings-shortcut-row">
                  <Settings size={16} />
                  <span>Preferences &amp; Notifications</span>
                  <ChevronRight size={16} className="settings-shortcut-arrow" />
                </Link>
                <Link href="/dashboard/settings#playback" className="settings-shortcut-row">
                  <Play size={16} />
                  <span>Playback Settings</span>
                  <ChevronRight size={16} className="settings-shortcut-arrow" />
                </Link>
                <Link href="/dashboard/notifications" className="settings-shortcut-row">
                  <Bell size={16} />
                  <span>All Notifications</span>
                  <ChevronRight size={16} className="settings-shortcut-arrow" />
                </Link>
              </div>
            </section>

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
