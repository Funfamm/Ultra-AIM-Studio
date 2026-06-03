import { prisma } from "@/lib/prisma";
import ProcessQueueButton from "./process-queue-button";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function TabQueue() {
  const acsConfigured = !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);

  const [queuedCount, recentItems] = await Promise.all([
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.emailQueue.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const statusCounts = recentItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      {/* ── Stats ────────────────────────────────── */}
      <section className="email-section">
        <div className="email-stats">
          <div className="email-stat">
            <span className="email-stat-val">{queuedCount}</span>
            <span className="email-stat-label">Queued</span>
          </div>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="email-stat">
              <span className="email-stat-val email-stat-val--muted">{count}</span>
              <span className="email-stat-label">{status} (last 20)</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Process batch ─────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Process queue</h2>
        <p className="email-hint">
          Processes up to 50 queued bulk emails per batch. Respects suppression list and user preferences.
          Only runs if ACS is configured and bulk sending is enabled in Admin Settings.
        </p>
        {!acsConfigured && (
          <p className="email-hint" style={{ color: "#f59e0b", marginBottom: "0.75rem" }}>
            ⚠ ACS not configured — set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS to enable bulk sending.
          </p>
        )}
        <ProcessQueueButton queuedCount={queuedCount} />
      </section>

      {/* ── Recent queue items ────────────────────── */}
      {recentItems.length > 0 && (
        <section className="email-section">
          <h2 className="email-section-title">Recent queue items (last 20)</h2>
          <div className="email-log-wrap">
            <table className="email-log-table">
              <thead>
                <tr>
                  <th>Status</th><th>To</th><th>Type</th><th>Campaign</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr key={item.id}>
                    <td><span className="elog-badge">{item.status}</span></td>
                    <td className="elog-to">{item.to}</td>
                    <td><span className="elog-badge">{item.type}</span></td>
                    <td className="elog-provider">{item.campaignId ?? "—"}</td>
                    <td className="elog-date">{fmtDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {recentItems.length === 0 && queuedCount === 0 && (
        <section className="email-section">
          <p className="email-empty">No queue items.</p>
        </section>
      )}
    </>
  );
}
