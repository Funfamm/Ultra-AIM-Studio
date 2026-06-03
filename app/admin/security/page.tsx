// Admin Security — admin management + event log + alert management
// Server component. Paginated event log. Client AlertActions + admin management forms.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertActions } from "./alert-actions";
import DemoteAdminButton from "./demote-admin-button";
import CreateAdminForm from "./create-admin-form";
import { DisplayNameForm, PasswordForm } from "./self-forms";
import "./security-page.css";

export const metadata: Metadata = { title: "Admin — Security" };

const EV_PAGE_SIZE = 50;

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const evPage      = Math.max(1, parseInt(sp.page ?? "1", 10));
  const alertFilter = sp.alerts ?? "open"; // "open" | "all"

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    admins,
    openAlertsCount,
    highEventsCount,
    blockedLoginsCount,
    totalEventsCount,
    alerts,
    events,
  ] = await Promise.all([
    prisma.user.findMany({
      where:   { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select:  { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.securityAlert.count({ where: { status: "OPEN" } }),
    prisma.securityEvent.count({
      where: { severity: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.securityEvent.count({
      where: { type: "LOGIN_BLOCKED", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.securityEvent.count(),
    prisma.securityAlert.findMany({
      where: alertFilter === "all" ? {} : { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: (evPage - 1) * EV_PAGE_SIZE,
      take: EV_PAGE_SIZE,
      select: {
        id:        true,
        type:      true,
        severity:  true,
        email:     true,
        country:   true,
        provider:  true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalEventsCount / EV_PAGE_SIZE);
  const pagingAlerts = sp.alerts ? `&alerts=${sp.alerts}` : "";

  const currentUser = admins.find((a) => a.id === session?.user?.id);

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Security</h1>
      </div>

      {/* ══════════════════════════════════════════════════════
          ADMIN MANAGEMENT  (shown to all admins)
         ══════════════════════════════════════════════════════ */}

      {/* ── Admin Roster ── */}
      <div className="sec-section">
        <h2 className="sec-section-title">Admin Roster</h2>
        <div className="sec-roster">
          {admins.map((admin) => {
            const isSelf     = admin.id === session?.user?.id;
            const isSA       = admin.role === "SUPER_ADMIN";
            const letter     = (admin.name ?? admin.email ?? "?")[0].toUpperCase();
            return (
              <div key={admin.id} className="sec-roster-card">
                <div
                  className="sec-roster-avatar"
                  style={{
                    background: isSA
                      ? "linear-gradient(135deg, #f59e0b, #ef4444)"
                      : "linear-gradient(135deg, #3b82f6, #a855f7)",
                  }}
                >
                  {letter}
                </div>
                <div className="sec-roster-info">
                  <p className="sec-roster-name">
                    {admin.name ?? "—"}
                    {isSelf && <span className="sec-roster-you"> (you)</span>}
                  </p>
                  <p className="sec-roster-email">{admin.email}</p>
                  <span className={`sec-roster-pill ${isSA ? "sec-roster-pill--sa" : "sec-roster-pill--pa"}`}>
                    {isSA ? "👑 Super Admin" : "🛡️ Power Admin"}
                  </span>
                </div>
                {/* Demote — SUPER_ADMIN only, cannot demote self or another SA */}
                {isSuperAdmin && !isSelf && !isSA && (
                  <DemoteAdminButton adminId={admin.id} adminName={admin.name ?? admin.email} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create Power Admin (SUPER_ADMIN only) ── */}
      {isSuperAdmin && (
        <div className="sec-section">
          <h2 className="sec-section-title">🛡️ Create Power Admin</h2>
          <p className="sec-section-hint">
            Creates a new admin account or promotes an existing member by email.
          </p>
          <CreateAdminForm />
        </div>
      )}

      {/* ── Self-Service: Display Name + Password ── */}
      <div className="sec-section sec-section--split">
        <div className="sec-self-block">
          <h2 className="sec-section-title">Display Name</h2>
          <DisplayNameForm currentName={currentUser?.name ?? ""} />
        </div>
        <div className="sec-self-block">
          <h2 className="sec-section-title">Change Password</h2>
          <PasswordForm />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECURITY EVENTS + ALERTS  (existing sections below)
         ══════════════════════════════════════════════════════ */}

      {/* ── Stats ── */}
      <div className="ustat-row">
        <div className="ustat-cell">
          <div className={`ustat-val${openAlertsCount > 0 ? " ustat-val--warn" : ""}`}>
            {openAlertsCount}
          </div>
          <div className="ustat-lbl">Open Alerts</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${highEventsCount > 0 ? " ustat-val--warn" : ""}`}>
            {highEventsCount}
          </div>
          <div className="ustat-lbl">High+ Events (7d)</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${blockedLoginsCount > 0 ? " ustat-val--warn" : ""}`}>
            {blockedLoginsCount}
          </div>
          <div className="ustat-lbl">Blocked Logins (7d)</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{totalEventsCount.toLocaleString()}</div>
          <div className="ustat-lbl">Total Events</div>
        </div>
      </div>

      {/* ── Alerts ── */}
      <div className="sec-section">
        <div className="sec-section-hd">
          <h2 className="sec-section-title">Security Alerts</h2>
          <div className="sec-tabs">
            <Link
              href="/admin/security"
              className={`sec-tab${!sp.alerts || sp.alerts === "open" ? " sec-tab--active" : ""}`}
            >
              Open{openAlertsCount > 0 ? ` (${openAlertsCount})` : ""}
            </Link>
            <Link
              href="/admin/security?alerts=all"
              className={`sec-tab${sp.alerts === "all" ? " sec-tab--active" : ""}`}
            >
              All
            </Link>
          </div>
        </div>

        {alerts.length === 0 ? (
          <p className="sec-empty">
            {alertFilter === "open" ? "No open alerts — all clear." : "No alerts yet."}
          </p>
        ) : (
          <div className="sec-alerts-list">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={[
                  "sec-alert-card",
                  `sec-alert-card--${a.severity.toLowerCase()}`,
                  a.status !== "OPEN" ? "sec-alert-card--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="sec-alert-top">
                  <span className={`sec-sev sec-sev--${a.severity.toLowerCase()}`}>
                    {a.severity}
                  </span>
                  <span className="sec-alert-title">{a.title}</span>
                  {a.status !== "OPEN" && (
                    <span className="sec-alert-status-tag">{a.status}</span>
                  )}
                  <span className="sec-alert-ts">
                    {new Date(a.createdAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="sec-alert-msg">{a.message}</p>
                {a.status === "OPEN" && <AlertActions alertId={a.id} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Event Log ── */}
      <div className="sec-section">
        <div className="sec-section-hd">
          <h2 className="sec-section-title">Event Log</h2>
          <span className="sec-count">{totalEventsCount.toLocaleString()} total</span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Email / Actor</th>
                <th>Country</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="sec-ev-time">
                    {new Date(ev.createdAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="sec-ev-type">{ev.type.replace(/_/g, " ")}</td>
                  <td>
                    <span className={`sec-sev sec-sev--${ev.severity.toLowerCase()}`}>
                      {ev.severity}
                    </span>
                  </td>
                  <td className="sec-ev-email">{ev.email ?? "—"}</td>
                  <td className="sec-ev-meta">{ev.country ?? "—"}</td>
                  <td className="sec-ev-meta">{ev.provider ?? "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No security events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="upagination">
            {evPage > 1 ? (
              <Link
                href={`/admin/security?page=${evPage - 1}${pagingAlerts}`}
                className="upag-btn"
              >
                ← Prev
              </Link>
            ) : (
              <span className="upag-btn upag-btn--disabled">← Prev</span>
            )}
            <span className="upag-info">Page {evPage} of {totalPages}</span>
            {evPage < totalPages ? (
              <Link
                href={`/admin/security?page=${evPage + 1}${pagingAlerts}`}
                className="upag-btn"
              >
                Next →
              </Link>
            ) : (
              <span className="upag-btn upag-btn--disabled">Next →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
