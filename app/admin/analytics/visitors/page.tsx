// Visitor Intelligence — premium live feed + breakdown charts
import { prisma } from "@/lib/prisma";
import { countryName } from "@/lib/country-names";
import type { Metadata } from "next";
import ViFeed from "./vi-feed";

export const metadata: Metadata = { title: "Analytics — Visitors" };

function barPct(v: number, max: number) {
  return max === 0 ? "0%" : `${Math.round((v / max) * 100)}%`;
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "📱 Mobile", TABLET: "📟 Tablet", DESKTOP: "🖥 Desktop", BOT: "🤖 Bot", UNKNOWN: "? Unknown",
};

export default async function VisitorsPage() {
  const now        = new Date();
  const weekStart  = new Date(now.getTime() - 7 * 86400_000);
  const onlineCut  = new Date(now.getTime() - 2 * 60_000);  // 2 min = "online" (players beacon every 30s)

  const [
    totalSessions,
    sessionsWeek,
    guestSessions,
    loggedInSessions,
    onlineCount,
    onlineMembersCount,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    countryBreakdown,
    recentSessions,
    returningCount,
    rawEvents,
  ] = await Promise.all([
    prisma.visitorSession.count({ where: { isBot: false } }),
    prisma.visitorSession.count({ where: { isBot: false, createdAt: { gte: weekStart } } }),
    prisma.visitorSession.count({ where: { isBot: false, userId: null } }),
    prisma.visitorSession.count({ where: { isBot: false, userId: { not: null } } }),
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut } } }),
    prisma.visitorSession.count({ where: { isBot: false, lastSeenAt: { gte: onlineCut }, userId: { not: null } } }),

    prisma.visitorSession.groupBy({
      by: ["deviceType"],
      where: { isBot: false },
      _count: { deviceType: true },
      orderBy: { _count: { deviceType: "desc" } },
    }),
    prisma.visitorSession.groupBy({
      by: ["browser"],
      where: { isBot: false, browser: { not: null } },
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
      take: 8,
    }),
    prisma.visitorSession.groupBy({
      by: ["os"],
      where: { isBot: false, os: { not: null } },
      _count: { os: true },
      orderBy: { _count: { os: "desc" } },
      take: 8,
    }),
    prisma.visitorSession.groupBy({
      by: ["country"],
      where: { isBot: false, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),

    // 30 most recent sessions with nested event journey
    prisma.visitorSession.findMany({
      where: { isBot: false },
      orderBy: { lastSeenAt: "desc" },
      take: 30,
      select: {
        id: true, visitorId: true, userId: true,
        country: true, city: true,
        deviceType: true, browser: true, os: true,
        landingPage: true, referrer: true,
        startedAt: true, lastSeenAt: true,
        events: {
          orderBy: { createdAt: "asc" },
          take: 30,
          select: { id: true, type: true, path: true, metadata: true, createdAt: true },
        },
      },
    }),

    // Returning visitors = visitorIds with > 1 session
    prisma.visitorSession.groupBy({
      by: ["visitorId"],
      where: { isBot: false },
      _count: { visitorId: true },
      having: { visitorId: { _count: { gt: 1 } } },
    }).then((r) => r.length),

    // 100 most recent raw events for All Events mode
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, type: true, path: true, metadata: true, createdAt: true,
        session: {
          select: {
            id: true, visitorId: true, userId: true,
            deviceType: true, country: true, city: true,
          },
        },
      },
    }),
  ]);

  // User enrichment — gather all userIds from sessions + raw events
  const sessionUserIds = recentSessions
    .map((s) => s.userId)
    .filter((id): id is string => id !== null);
  const eventUserIds = rawEvents
    .map((e) => e.session?.userId)
    .filter((id): id is string => id !== null && id !== undefined);
  const userIds = [...new Set([...sessionUserIds, ...eventUserIds])];

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true, name: true, email: true, role: true,
            accounts: { select: { provider: true }, take: 2 },
          },
        })
      : [];

  type UserInfo = {
    id: string; name: string | null; email: string;
    role: string; loginMethod: string;
  };
  const userMap: Record<string, UserInfo> = Object.fromEntries(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as string,
        loginMethod:
          u.accounts.length === 0 ? "email"
          : u.accounts.length > 1 ? "multi"
          : u.accounts[0].provider,
      },
    ])
  );

  // Serialize all Date fields for client components
  const serializedSessions = recentSessions.map((s) => ({
    id: s.id,
    visitorId: s.visitorId,
    userId: s.userId,
    country: s.country,
    city: s.city,
    deviceType: s.deviceType as string,
    browser: s.browser,
    os: s.os,
    landingPage: s.landingPage,
    referrer: s.referrer,
    startedAt: s.startedAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    events: s.events.map((e) => ({
      id: e.id,
      type: e.type as string,
      path: e.path,
      metadata: e.metadata as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    })),
  }));

  const serializedEvents = rawEvents.map((e) => ({
    id: e.id,
    type: e.type as string,
    path: e.path,
    metadata: e.metadata as Record<string, unknown> | null,
    createdAt: e.createdAt.toISOString(),
    session: e.session
      ? {
          id: e.session.id,
          visitorId: e.session.visitorId,
          userId: e.session.userId,
          deviceType: e.session.deviceType as string,
          country: e.session.country,
          city: e.session.city,
        }
      : null,
  }));

  const deviceMax  = deviceBreakdown[0]?._count.deviceType ?? 0;
  const browserMax = browserBreakdown[0]?._count.browser    ?? 0;
  const osMax      = osBreakdown[0]?._count.os              ?? 0;
  const countryMax = countryBreakdown[0]?._count.country    ?? 0;

  const loggedInPct  = totalSessions > 0 ? Math.round((loggedInSessions / totalSessions) * 100) : 0;
  const returningPct = totalSessions > 0 ? Math.round((returningCount    / totalSessions) * 100) : 0;
  const onlineGuests = onlineCount - onlineMembersCount;

  return (
    <div>
      {/* ── Live Visitor Intelligence Feed ── */}
      <ViFeed
        sessions={serializedSessions}
        rawEvents={serializedEvents}
        userMap={userMap}
        onlineCount={onlineCount}
        onlineMembers={onlineMembersCount}
        onlineGuests={onlineGuests}
        onlineCutISO={onlineCut.toISOString()}
      />

      {/* ── Summary stats ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className="astat-cell-val">{totalSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Total Sessions</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--accent">{sessionsWeek.toLocaleString()}</div>
          <div className="astat-cell-lbl">This Week</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{guestSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Guest Sessions</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--green">{loggedInSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Logged-in ({loggedInPct}%)</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{returningCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Returning ({returningPct}%)</div>
        </div>
      </div>

      {/* ── 3-col device/browser/OS breakdown ── */}
      <div className="acols-3">
        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Devices</h2>
          <div className="achart">
            {deviceBreakdown.map((d) => (
              <div key={d.deviceType} className="abar-row">
                <span className="abar-label">{DEVICE_LABELS[d.deviceType] ?? d.deviceType}</span>
                <div className="abar-track"><div className="abar-fill" style={{ width: barPct(d._count.deviceType, deviceMax) }} /></div>
                <span className="abar-count">{d._count.deviceType}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Browsers</h2>
          {browserBreakdown.length === 0 ? <p className="aempty">No data yet.</p> : (
            <div className="achart">
              {browserBreakdown.map((b) => (
                <div key={b.browser} className="abar-row">
                  <span className="abar-label">{b.browser}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(b._count.browser, browserMax) }} /></div>
                  <span className="abar-count">{b._count.browser}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Operating Systems</h2>
          {osBreakdown.length === 0 ? <p className="aempty">No data yet.</p> : (
            <div className="achart">
              {osBreakdown.map((o) => (
                <div key={o.os} className="abar-row">
                  <span className="abar-label">{o.os}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(o._count.os, osMax) }} /></div>
                  <span className="abar-count">{o._count.os}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Countries ── */}
      <div className="asection">
        <h2 className="asection-title">Countries</h2>
        {countryBreakdown.length === 0 ? (
          <p className="aempty">No geo data — populated from Vercel edge headers after deployment.</p>
        ) : (
          <div className="achart">
            {countryBreakdown.map((c) => (
              <div key={c.country} className="abar-row">
                <span className="abar-label">{countryName(c.country)}</span>
                <div className="abar-track"><div className="abar-fill" style={{ width: barPct(c._count.country, countryMax) }} /></div>
                <span className="abar-count">{c._count.country}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
