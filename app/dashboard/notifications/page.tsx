import { getUserNotifications } from "@/lib/actions/notifications";
import { NotificationLink, NotificationTitle } from "./notification-link";
import { NotifItemActions, NotifBulkActions } from "./notif-clear-actions";
import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";
import "./notifications.css";

export const metadata: Metadata = { title: "Notifications — AIM Studio" };

const NOTIF_ICON: Record<string, string> = {
  NEW_RELEASE:    "🎬",
  NEW_EPISODE:    "🎞️",
  ANNOUNCEMENT:   "📣",
  WATCH_PROGRESS: "⏱️",
  ACCOUNT:        "👤",
  SYSTEM:         "⚙️",
  SECURITY:       "🔒",
};

const NOTIF_LABEL: Record<string, string> = {
  NEW_RELEASE:    "New Release",
  NEW_EPISODE:    "New Episode",
  ANNOUNCEMENT:   "Announcement",
  WATCH_PROGRESS: "Watch Progress",
  ACCOUNT:        "Account",
  SYSTEM:         "System",
  SECURITY:       "Security Alert",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function NotificationsPage() {
  // getUserNotifications already requires auth internally
  const notifications = await getUserNotifications();

  const hasUnread = notifications.some((n) => !n.read);
  const hasRead   = notifications.some((n) => n.read);

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "68px" }}>
        <main className="notifpage">
          <div className="container-app">

            {/* ── Back + heading ── */}
            <Link href="/dashboard" className="notifpage-back">
              <ChevronLeft size={16} /> Dashboard
            </Link>

            <div className="notifpage-header">
              <h1 className="notifpage-title">
                <Bell size={20} /> Notifications
              </h1>
            </div>

            {/* ── Bulk actions (client) ── */}
            <NotifBulkActions
              hasUnread={hasUnread}
              hasRead={hasRead}
              hasAny={notifications.length > 0}
            />

            {notifications.length === 0 ? (
              <div className="notifpage-empty">
                <p>No notifications yet. Check back when new films drop.</p>
                <Link href="/works" className="notifpage-browse-btn">Browse Works</Link>
              </div>
            ) : (
              <ul className="notifpage-list">
                {notifications.map((n) => (
                  <li key={n.id} className={`notifpage-item${n.read ? "" : " notifpage-item--unread"}`}>
                    <span className="notifpage-icon" aria-hidden="true">
                      {NOTIF_ICON[n.type] ?? "🔔"}
                    </span>

                    <div className="notifpage-body">
                      <div className="notifpage-meta">
                        <span className="notifpage-type">{NOTIF_LABEL[n.type] ?? n.type}</span>
                        <span className="notifpage-time">{timeAgo(new Date(n.createdAt))}</span>
                      </div>
                      {n.href ? (
                        <NotificationLink
                          id={n.id}
                          href={n.href}
                          read={n.read}
                          className="notifpage-item-title"
                        >
                          {n.title}
                        </NotificationLink>
                      ) : (
                        <NotificationTitle
                          id={n.id}
                          read={n.read}
                          className="notifpage-item-title"
                        >
                          {n.title}
                        </NotificationTitle>
                      )}
                      {n.body && <p className="notifpage-item-body">{n.body}</p>}
                    </div>

                    {/* Per-item actions: mark read + delete */}
                    <NotifItemActions id={n.id} read={n.read} />
                  </li>
                ))}
              </ul>
            )}

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
