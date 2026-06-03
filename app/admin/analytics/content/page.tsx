// Content tab — trailers, films, series, episodes, completion rates, saved works
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics — Content" };

function barPct(v: number, max: number) {
  return max === 0 ? "0%" : `${Math.round((v / max) * 100)}%`;
}

function rateClass(pct: number) {
  if (pct >= 60) return "rate-chip--good";
  if (pct >= 30) return "rate-chip--mid";
  return "rate-chip--low";
}

export default async function ContentPage() {
  const now        = new Date();
  const weekStart  = new Date(now.getTime() - 7  * 86400_000);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  const [
    trailerClicksAllTime,
    trailerClicksWeek,
    watchStartsAllTime,
    watchCompletesAllTime,
    episodeStartsAllTime,
    episodeCompletesAllTime,
    savedWorksCount,
    inProgressCount,
    topTrailersRaw,
    topFilmsRaw,
    topEpisodesRaw,
    topSeriesRaw,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: "TRAILER_CLICK" } }),
    prisma.analyticsEvent.count({ where: { type: "TRAILER_CLICK", createdAt: { gte: weekStart } } }),
    prisma.analyticsEvent.count({ where: { type: "WATCH_START" } }),
    prisma.analyticsEvent.count({ where: { type: "WATCH_COMPLETE" } }),
    prisma.analyticsEvent.count({ where: { type: "EPISODE_START" } }),
    prisma.analyticsEvent.count({ where: { type: "EPISODE_COMPLETE" } }),
    prisma.savedWork.count(),
    // In-progress: has progress but not 100% complete
    prisma.watchProgress.count({ where: { completed: false } }),

    // Top trailers by TRAILER_CLICK
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "TRAILER_CLICK", workId: { not: null } },
      _count: { workId: true },
      orderBy: { _count: { workId: "desc" } },
      take: 10,
    }),

    // Top films/shorts by WATCH_START
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "WATCH_START", workId: { not: null } },
      _count: { workId: true },
      orderBy: { _count: { workId: "desc" } },
      take: 10,
    }),

    // Top episodes by EPISODE_START
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "EPISODE_START", workId: { not: null } },
      _count: { workId: true },
      orderBy: { _count: { workId: "desc" } },
      take: 8,
    }),

    // Top series by WORK_VIEW
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "WORK_VIEW", workId: { not: null } },
      _count: { workId: true },
      orderBy: { _count: { workId: "desc" } },
      take: 8,
    }),
  ]);

  // Resolve work titles for all workIds
  const allIds = [...new Set([
    ...topTrailersRaw.map((r) => r.workId!),
    ...topFilmsRaw.map((r) => r.workId!),
    ...topEpisodesRaw.map((r) => r.workId!),
    ...topSeriesRaw.map((r) => r.workId!),
  ])];

  const works = allIds.length
    ? await prisma.work.findMany({
        where: { id: { in: allIds } },
        select: { id: true, title: true, type: true, slug: true },
      })
    : [];
  const wMap = new Map(works.map((w) => [w.id, w]));

  const filmRate    = watchStartsAllTime > 0   ? Math.round((watchCompletesAllTime / watchStartsAllTime) * 100) : 0;
  const episodeRate = episodeStartsAllTime > 0 ? Math.round((episodeCompletesAllTime / episodeStartsAllTime) * 100) : 0;

  const trailerMax = topTrailersRaw[0]?._count.workId  ?? 0;
  const filmMax    = topFilmsRaw[0]?._count.workId     ?? 0;
  const epMax      = topEpisodesRaw[0]?._count.workId  ?? 0;
  const seriesMax  = topSeriesRaw[0]?._count.workId    ?? 0;

  return (
    <div>
      {/* ── Overview stats ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className="astat-cell-val">{trailerClicksAllTime.toLocaleString()}</div>
          <div className="astat-cell-lbl">Trailer Views</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--accent">{trailerClicksWeek}</div>
          <div className="astat-cell-lbl">Trailers (7d)</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{watchStartsAllTime.toLocaleString()}</div>
          <div className="astat-cell-lbl">Film Plays</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{episodeStartsAllTime.toLocaleString()}</div>
          <div className="astat-cell-lbl">Episode Plays</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{savedWorksCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Saved Works</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{inProgressCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">In Progress</div>
        </div>
      </div>

      {/* ── Completion rates ── */}
      <div className="acols" style={{ marginBottom: "0.5rem" }}>
        <div className="asection">
          <h2 className="asection-title">Film Completion</h2>
          <div className="achart">
            <div className="abar-row">
              <span className="abar-label">Plays</span>
              <div className="abar-track"><div className="abar-fill" style={{ width: "100%" }} /></div>
              <span className="abar-count">{watchStartsAllTime}</span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Completed</span>
              <div className="abar-track"><div className="abar-fill" style={{ width: `${filmRate}%` }} /></div>
              <span className="abar-count">{watchCompletesAllTime}</span>
            </div>
            <div className="abar-row" style={{ marginTop: "0.25rem" }}>
              <span className="abar-label" style={{ color: "var(--color-brand-muted)" }}>Rate</span>
              <span className={`rate-chip ${rateClass(filmRate)}`}>{filmRate}%</span>
            </div>
          </div>
        </div>
        <div className="asection">
          <h2 className="asection-title">Episode Completion</h2>
          <div className="achart">
            <div className="abar-row">
              <span className="abar-label">Plays</span>
              <div className="abar-track"><div className="abar-fill" style={{ width: "100%" }} /></div>
              <span className="abar-count">{episodeStartsAllTime}</span>
            </div>
            <div className="abar-row">
              <span className="abar-label">Completed</span>
              <div className="abar-track"><div className="abar-fill" style={{ width: `${episodeRate}%` }} /></div>
              <span className="abar-count">{episodeCompletesAllTime}</span>
            </div>
            <div className="abar-row" style={{ marginTop: "0.25rem" }}>
              <span className="abar-label" style={{ color: "var(--color-brand-muted)" }}>Rate</span>
              <span className={`rate-chip ${rateClass(episodeRate)}`}>{episodeRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top trailers ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Trailer Leaderboard</h2>
          <span className="asection-count">all time · top 10</span>
        </div>
        {topTrailersRaw.length === 0 ? <p className="aempty">No trailer views yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th style={{ width: 32 }}>#</th><th>Work</th><th>Type</th><th style={{ width: 80 }}>Clicks</th><th style={{ width: 160 }}>Bar</th></tr></thead>
              <tbody>
                {topTrailersRaw.map((r, i) => {
                  const w = wMap.get(r.workId!);
                  return (
                    <tr key={r.workId}>
                      <td className="a-muted a-num">{i + 1}</td>
                      <td className="a-primary">{w?.title ?? <span className="a-muted">{r.workId}</span>}</td>
                      <td>{w?.type && <span className="atype-badge">{w.type.replace(/_/g, " ")}</span>}</td>
                      <td className="a-muted a-num">{r._count.workId}</td>
                      <td><div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.workId, trailerMax) }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 2-col: films + episodes ── */}
      <div className="acols">
        <div className="asection">
          <div className="asection-hd">
            <h2 className="asection-title">Film Leaderboard</h2>
            <span className="asection-count">by watch starts</span>
          </div>
          {topFilmsRaw.length === 0 ? <p className="aempty">No film plays yet.</p> : (
            <div className="achart">
              {topFilmsRaw.map((r, i) => {
                const w = wMap.get(r.workId!);
                return (
                  <div key={r.workId} className="abar-row">
                    <span className="abar-label" style={{ width: 160 }}>
                      <span className="a-muted a-num" style={{ fontSize: "0.72rem", marginRight: "0.4rem" }}>{i + 1}</span>
                      {w?.title ?? r.workId?.slice(0, 10) + "…"}
                    </span>
                    <div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.workId, filmMax) }} /></div>
                    <span className="abar-count">{r._count.workId}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="asection">
          <div className="asection-hd">
            <h2 className="asection-title">Top Episodes</h2>
            <span className="asection-count">by episode starts</span>
          </div>
          {topEpisodesRaw.length === 0 ? <p className="aempty">No episode plays yet.</p> : (
            <div className="achart">
              {topEpisodesRaw.map((r, i) => {
                const w = wMap.get(r.workId!);
                return (
                  <div key={r.workId} className="abar-row">
                    <span className="abar-label" style={{ width: 160 }}>
                      <span className="a-muted a-num" style={{ fontSize: "0.72rem", marginRight: "0.4rem" }}>{i + 1}</span>
                      {w?.title ?? r.workId?.slice(0, 10) + "…"}
                    </span>
                    <div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.workId, epMax) }} /></div>
                    <span className="abar-count">{r._count.workId}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Most viewed works (detail page) ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Most Viewed (Detail Page)</h2>
          <span className="asection-count">by WORK_VIEW events · all time</span>
        </div>
        {topSeriesRaw.length === 0 ? <p className="aempty">No work view data yet.</p> : (
          <div className="achart">
            {topSeriesRaw.map((r, i) => {
              const w = wMap.get(r.workId!);
              return (
                <div key={r.workId} className="abar-row">
                  <span className="abar-label" style={{ width: 180 }}>
                    <span className="a-muted a-num" style={{ fontSize: "0.72rem", marginRight: "0.4rem" }}>{i + 1}</span>
                    {w?.title ?? r.workId?.slice(0, 12) + "…"}
                  </span>
                  {w?.type && <span className="atype-badge" style={{ flexShrink: 0 }}>{w.type.replace(/_/g, " ")}</span>}
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(r._count.workId, seriesMax) }} /></div>
                  <span className="abar-count">{r._count.workId}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
