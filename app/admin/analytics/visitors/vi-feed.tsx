"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { countryName } from "@/lib/country-names";

/* ── Types ── */

type SessionEvent = {
  id: string; type: string;
  path: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Session = {
  id: string; visitorId: string; userId: string | null;
  country: string | null; city: string | null;
  deviceType: string; browser: string | null; os: string | null;
  landingPage: string | null; referrer: string | null;
  startedAt: string; lastSeenAt: string;
  events: SessionEvent[];
};

type RawEvent = {
  id: string; type: string; path: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  session: {
    id: string; visitorId: string; userId: string | null;
    deviceType: string; country: string | null; city: string | null;
  } | null;
};

type UserInfo = {
  id: string; name: string | null; email: string;
  role: string; loginMethod: string;
};

type Props = {
  sessions: Session[];
  rawEvents: RawEvent[];
  userMap: Record<string, UserInfo>;
  onlineCount: number;
  onlineMembers: number;
  onlineGuests: number;
  onlineCutISO: string;
};

/* ── Helpers ── */

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDur(startISO: string, endISO: string): string {
  const s = Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000);
  if (s <= 0)    return "—";
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatPageDur(s: number): string {
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const EVENT_LABELS: Record<string, string> = {
  PAGE_VIEW: "Page View",       PAGE_LEAVE: "Left Page",
  WORK_VIEW: "Work View",       TRAILER_CLICK: "Trailer Click",
  WATCH_START: "Watch Start",   WATCH_PROGRESS: "Progress",
  WATCH_COMPLETE: "Completed",  EPISODE_START: "Ep Start",
  EPISODE_COMPLETE: "Ep End",   SIGN_IN: "Sign In",
  SIGN_UP: "Sign Up",           SIGN_OUT: "Sign Out",
  SAVE_WORK: "Saved",           UNSAVE_WORK: "Unsaved",
  NOTIFICATION_OPEN: "Notif",   SETTINGS_UPDATE: "Settings",
  CTA_IMPRESSION: "CTA View",   CTA_SIGNUP: "CTA Signup",
};

const DEVICE_ICONS: Record<string, string> = {
  MOBILE: "📱", TABLET: "📟", DESKTOP: "🖥", BOT: "🤖", UNKNOWN: "?",
};

const ROLE_CLASS: Record<string, string> = {
  ADMIN: "vi-role vi-role--admin",
  SUPER_ADMIN: "vi-role vi-role--super",
  USER: "vi-role vi-role--user",
};

/* ── Journey builder — merges PAGE_LEAVE duration into PAGE_VIEW events ── */
type JourneyItem = SessionEvent & { pageDuration: number | null };

function buildJourney(events: SessionEvent[]): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === "PAGE_LEAVE") continue; // will annotate matching PAGE_VIEW

    let pageDuration: number | null = null;
    if (e.type === "PAGE_VIEW" && e.path) {
      for (let j = i + 1; j < events.length; j++) {
        const nxt = events[j];
        if (nxt.type === "PAGE_LEAVE" && nxt.path === e.path) {
          const d = nxt.metadata?.durationSeconds;
          pageDuration = typeof d === "number" ? d : null;
          break;
        }
        if (nxt.type === "PAGE_VIEW" && nxt.path === e.path) break;
      }
    }
    items.push({ ...e, pageDuration });
  }
  return items;
}

/* ── Component ── */

export default function ViFeed({
  sessions, rawEvents, userMap,
  onlineCount, onlineMembers, onlineGuests,
  onlineCutISO,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode]           = useState<"grouped" | "all">("grouped");
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  const cutoff = new Date(onlineCutISO);

  function handleRefresh() {
    startTransition(() => { router.refresh(); });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function isOnline(lastSeenAt: string) {
    return new Date(lastSeenAt) >= cutoff;
  }

  /* ── Collapsed summary view ── */
  if (collapsed) {
    return (
      <div className="vi-wrap">
        <div className="vi-header vi-header--collapsed">
          <div className="vi-header-left">
            <h2 className="vi-header-title">Live Visitor Intelligence</h2>
            <div className="vi-pills">
              <span className="vi-pill vi-pill--online">
                <span className="vi-dot vi-dot--pulse" />
                {onlineCount} Online
              </span>
              <span className="vi-pill vi-pill--members">{onlineMembers} Members</span>
              <span className="vi-pill vi-pill--guests">{onlineGuests} Guests</span>
            </div>
          </div>
          <div className="vi-header-right">
            <button className="vi-refresh-btn" onClick={handleRefresh} disabled={isPending}>
              <RefreshCw size={12} className={isPending ? "vi-spin" : undefined} />
            </button>
            <button className="vi-collapse-btn" onClick={() => setCollapsed(false)} aria-label="Expand">
              <ChevronDown size={14} />
              <span>Expand</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Expanded view ── */
  return (
    <div className="vi-wrap">

      {/* Header */}
      <div className="vi-header">
        <div className="vi-header-left">
          <h2 className="vi-header-title">Live Visitor Intelligence</h2>
          <div className="vi-pills">
            <span className="vi-pill vi-pill--online">
              <span className="vi-dot vi-dot--pulse" />
              {onlineCount} Online
            </span>
            <span className="vi-pill vi-pill--members">{onlineMembers} Members</span>
            <span className="vi-pill vi-pill--guests">{onlineGuests} Guests</span>
          </div>
        </div>
        <div className="vi-header-right">
          <button className="vi-refresh-btn" onClick={handleRefresh} disabled={isPending}
            aria-label="Refresh">
            <RefreshCw size={13} className={isPending ? "vi-spin" : undefined} />
            {isPending ? "Loading…" : "Refresh"}
          </button>
          <button className="vi-collapse-btn" onClick={() => setCollapsed(true)} aria-label="Collapse">
            <ChevronUp size={14} />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="vi-mode-bar">
        <button
          className={`vi-mode-btn${mode === "grouped" ? " vi-mode-btn--active" : ""}`}
          onClick={() => setMode("grouped")}
        >
          Grouped Sessions
        </button>
        <button
          className={`vi-mode-btn${mode === "all" ? " vi-mode-btn--active" : ""}`}
          onClick={() => setMode("all")}
        >
          All Events
        </button>
        <span className="vi-mode-hint">
          {mode === "grouped"
            ? `${sessions.length} sessions · click to expand journey`
            : `${rawEvents.length} events · most recent first`}
        </span>
      </div>

      {/* Grouped sessions */}
      {mode === "grouped" && (
        <div className="vi-sessions">
          {sessions.length === 0 ? (
            <p className="vi-empty">No session data yet.</p>
          ) : (
            sessions.map((s) => {
              const user    = s.userId ? userMap[s.userId] ?? null : null;
              const online  = isOnline(s.lastSeenAt);
              const isOpen  = expanded.has(s.id);
              const dur     = formatDur(s.startedAt, s.lastSeenAt);
              const lastPg  = s.events.filter(e => e.path && e.type === "PAGE_VIEW").pop()?.path
                              ?? s.landingPage;

              const registered = !s.userId && s.events.some((e) => e.type === "SIGN_UP");

              return (
                <div key={s.id} className={`vi-session${isOpen ? " vi-session--open" : ""}`}>
                  <button className="vi-session-row" onClick={() => toggleExpand(s.id)} aria-expanded={isOpen}>

                    {/* Status dot */}
                    <span className={`vi-status-dot vi-status-dot--${online ? "on" : "off"}`} />

                    {/* Expand chevron */}
                    <span className="vi-session-expand">
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>

                    {/* Device */}
                    <span className="vi-session-device" aria-hidden="true">
                      {DEVICE_ICONS[s.deviceType] ?? "?"}
                    </span>

                    {/* Identity */}
                    <span className="vi-session-identity">
                      {user ? (
                        <>
                          <span className="vi-session-name">
                            {user.name ?? user.email}
                            <span className={ROLE_CLASS[user.role] ?? "vi-role vi-role--user"}>
                              {user.role === "SUPER_ADMIN" ? "SUPER" : user.role}
                            </span>
                          </span>
                          <span className="vi-session-email">{user.email}</span>
                        </>
                      ) : (
                        <>
                          <span className="vi-session-name vi-session-name--guest">Guest</span>
                          <span className="vi-session-email">{s.visitorId.slice(0, 8)}…</span>
                        </>
                      )}
                    </span>

                    {/* Geo */}
                    <span className="vi-session-geo">
                      {[s.city, s.country ? countryName(s.country) : null].filter(Boolean).join(", ") || "—"}
                    </span>

                    {/* Last page */}
                    <span className="vi-session-lastpg">
                      {lastPg ? lastPg.slice(0, 28) : "—"}
                    </span>

                    {/* Platform duration */}
                    <span className="vi-session-dur">{dur}</span>

                    {/* Time ago */}
                    <span className="vi-session-time">{timeAgo(s.lastSeenAt)}</span>

                    {/* Event count */}
                    <span className="vi-session-count">{s.events.length} ev</span>

                    {/* Auth tag */}
                    <span className={`vi-auth-tag${s.userId ? " vi-auth-tag--member" : registered ? " vi-auth-tag--registered" : ""}`}>
                      {s.userId ? "Member" : registered ? "Registered" : "Guest"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="vi-journey">
                      {s.events.length === 0 ? (
                        <p className="vi-journey-empty">No events recorded for this session.</p>
                      ) : (
                        buildJourney(s.events).map((e, i) => (
                          <div key={e.id} className="vi-event-row">
                            <span className="vi-event-idx">{i + 1}</span>
                            <span className="vi-event-type">{EVENT_LABELS[e.type] ?? e.type}</span>
                            <span className="vi-event-path">{e.path ?? "—"}</span>
                            {e.pageDuration != null ? (
                              <span className="vi-event-pg-dur">{formatPageDur(e.pageDuration)}</span>
                            ) : (
                              <span className="vi-event-pg-dur vi-event-pg-dur--empty">—</span>
                            )}
                            <span className="vi-event-time">{timeAgo(e.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* All events feed */}
      {mode === "all" && (
        <div className="vi-all-events">
          {rawEvents.length === 0 ? (
            <p className="vi-empty">No events yet.</p>
          ) : (
            rawEvents.map((e) => {
              const userId = e.session?.userId ?? null;
              const user   = userId ? userMap[userId] ?? null : null;
              const geo    = e.session
                ? [e.session.city, e.session.country ? countryName(e.session.country) : null].filter(Boolean).join(", ") || "—"
                : "—";

              return (
                <div key={e.id} className="vi-feed-row">
                  <span className="vi-feed-type">{EVENT_LABELS[e.type] ?? e.type}</span>
                  <span className="vi-feed-path">{e.path ?? "—"}</span>
                  <span className="vi-feed-who">
                    {user ? (user.name ?? user.email)
                          : `Guest ${e.session?.visitorId?.slice(0, 6) ?? "?"}`}
                  </span>
                  <span className="vi-feed-device" aria-hidden="true">
                    {e.session ? (DEVICE_ICONS[e.session.deviceType] ?? "?") : "?"}
                  </span>
                  <span className="vi-feed-geo">{geo}</span>
                  <span className="vi-feed-time">{timeAgo(e.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
