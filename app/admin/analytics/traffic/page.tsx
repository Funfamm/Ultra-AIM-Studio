// Traffic tab — page views, devices, referrers, countries, guest vs logged-in
import { prisma } from "@/lib/prisma";
import { countryName } from "@/lib/country-names";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics — Traffic" };

function barPct(v: number, max: number) {
  return max === 0 ? "0%" : `${Math.round((v / max) * 100)}%`;
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Mobile", TABLET: "Tablet", DESKTOP: "Desktop", BOT: "Bot", UNKNOWN: "Unknown",
};

export default async function TrafficPage() {
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterday  = new Date(todayStart.getTime() - 86400_000);
  const weekStart  = new Date(now.getTime() - 7 * 86400_000);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  const [
    viewsToday,
    viewsYesterday,
    viewsWeek,
    viewsMonth,
    sessionsWeek,
    guestEventsWeek,
    loggedInEventsWeek,
    deviceBreakdown,
    countryBreakdown,
    regionBreakdown,
    referrerBreakdown,
    topPages,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: todayStart } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: yesterday, lt: todayStart } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: monthStart } } }),
    prisma.visitorSession.count({ where: { isBot: false, createdAt: { gte: weekStart } } }),
    // Guest = events with no userId
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", userId: null, createdAt: { gte: weekStart } } }),
    // Logged-in = events with userId
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", userId: { not: null }, createdAt: { gte: weekStart } } }),
    prisma.visitorSession.groupBy({
      by: ["deviceType"],
      where: { isBot: false, createdAt: { gte: weekStart } },
      _count: { deviceType: true },
      orderBy: { _count: { deviceType: "desc" } },
    }),
    prisma.visitorSession.groupBy({
      by: ["country"],
      where: { isBot: false, country: { not: null }, createdAt: { gte: weekStart } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.visitorSession.groupBy({
      by: ["region"],
      where: { isBot: false, region: { not: null }, createdAt: { gte: weekStart } },
      _count: { region: true },
      orderBy: { _count: { region: "desc" } },
      take: 8,
    }),
    prisma.visitorSession.groupBy({
      by: ["referrer"],
      where: { isBot: false, referrer: { not: null }, createdAt: { gte: weekStart } },
      _count: { referrer: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "PAGE_VIEW", path: { not: null }, createdAt: { gte: weekStart } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 15,
    }),
  ]);

  const avgPerDay   = viewsMonth > 0 ? Math.round(viewsMonth / Math.max(1, now.getDate())) : 0;
  const deviceMax   = deviceBreakdown[0]?._count.deviceType ?? 0;
  const countryMax  = countryBreakdown[0]?._count.country   ?? 0;
  const regionMax   = regionBreakdown[0]?._count.region     ?? 0;
  const referrerMax = referrerBreakdown[0]?._count.referrer  ?? 0;
  const pageMax     = topPages[0]?._count.path               ?? 0;

  const guestPct    = viewsWeek > 0 ? Math.round((guestEventsWeek / viewsWeek) * 100) : 0;
  const loggedInPct = 100 - guestPct;

  return (
    <div>
      {/* ── Period stats ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className="astat-cell-val">{viewsToday.toLocaleString()}</div>
          <div className="astat-cell-lbl">Today</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{viewsYesterday.toLocaleString()}</div>
          <div className="astat-cell-lbl">Yesterday</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{viewsWeek.toLocaleString()}</div>
          <div className="astat-cell-lbl">This Week</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{viewsMonth.toLocaleString()}</div>
          <div className="astat-cell-lbl">This Month</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--accent">{avgPerDay}</div>
          <div className="astat-cell-lbl">Avg / Day</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{sessionsWeek.toLocaleString()}</div>
          <div className="astat-cell-lbl">Sessions (7d)</div>
        </div>
      </div>

      {/* ── Guest vs logged-in ── */}
      <div className="asection">
        <h2 className="asection-title">Audience Split (7 days)</h2>
        <div className="achart">
          <div className="abar-row">
            <span className="abar-label">Guest</span>
            <div className="abar-track"><div className="abar-fill" style={{ width: `${guestPct}%` }} /></div>
            <span className="abar-count">{guestEventsWeek} <span style={{ color: "var(--color-brand-border)", fontSize: "0.7rem" }}>({guestPct}%)</span></span>
          </div>
          <div className="abar-row">
            <span className="abar-label">Logged in</span>
            <div className="abar-track"><div className="abar-fill" style={{ width: `${loggedInPct}%` }} /></div>
            <span className="abar-count">{loggedInEventsWeek} <span style={{ color: "var(--color-brand-border)", fontSize: "0.7rem" }}>({loggedInPct}%)</span></span>
          </div>
        </div>
      </div>

      {/* ── 3-col breakdown ── */}
      <div className="acols-3">

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Devices</h2>
          {deviceBreakdown.length === 0 ? <p className="aempty">No data yet.</p> : (
            <div className="achart">
              {deviceBreakdown.map((d) => (
                <div key={d.deviceType} className="abar-row">
                  <span className="abar-label">{DEVICE_LABELS[d.deviceType] ?? d.deviceType}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(d._count.deviceType, deviceMax) }} /></div>
                  <span className="abar-count">{d._count.deviceType}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Countries</h2>
          {countryBreakdown.length === 0 ? <p className="aempty">No geo data — populated after Vercel deploy.</p> : (
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

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Regions</h2>
          {regionBreakdown.length === 0 ? <p className="aempty">No region data yet.</p> : (
            <div className="achart">
              {regionBreakdown.map((r) => (
                <div key={r.region} className="abar-row">
                  <span className="abar-label">{r.region ?? "Unknown"}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.region, regionMax) }} /></div>
                  <span className="abar-count">{r._count.region}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Top pages ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Top Pages</h2>
          <span className="asection-count">7 days · top 15</span>
        </div>
        {topPages.length === 0 ? <p className="aempty">No page view data yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Path</th>
                  <th style={{ width: 80 }}>Views</th>
                  <th style={{ width: 160 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p, i) => (
                  <tr key={p.path}>
                    <td className="a-muted a-num">{i + 1}</td>
                    <td className="a-primary">{p.path ?? "/"}</td>
                    <td className="a-muted a-num">{p._count.path}</td>
                    <td><div className="abar-track"><div className="abar-fill" style={{ width: barPct(p._count.path, pageMax) }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Referrers ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Traffic Sources</h2>
          <span className="asection-count">7 days · top 10</span>
        </div>
        {referrerBreakdown.length === 0 ? <p className="aempty">No referrer data yet.</p> : (
          <div className="achart">
            {referrerBreakdown.map((r) => (
              <div key={r.referrer} className="abar-row">
                <span className="abar-label" style={{ width: 200 }}>{
                  r.referrer ? new URL(r.referrer).hostname.replace(/^www\./, "") : "Direct"
                }</span>
                <div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.referrer, referrerMax) }} /></div>
                <span className="abar-count">{r._count.referrer}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
