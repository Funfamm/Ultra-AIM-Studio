// /admin/email/suppressions — dedicated suppression manager
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { addSuppression } from "@/lib/actions/email-admin";
import RemoveSuppressionButton from "../remove-suppression-button";
import type { Metadata } from "next";
import "../email-admin.css";

export const metadata: Metadata = { title: "Email Suppressions — Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function AdminEmailSuppressionsPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const [active, inactive] = await Promise.all([
    prisma.emailSuppression.findMany({
      where:   { active: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailSuppression.findMany({
      where:   { active: false },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
  ]);

  return (
    <div className="email-page">
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/email" className="email-back-link">
          <ArrowLeft size={13} /> Email settings
        </Link>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Suppression List</h1>
      </div>

      <p className="email-hint" style={{ marginBottom: "2rem" }}>
        Suppressed addresses will not receive any bulk or transactional emails
        (except security alerts, which cannot be suppressed at this level).
        Addresses are suppressed automatically when a user clicks
        &ldquo;Unsubscribe&rdquo; in a bulk email.
      </p>

      {/* ── Add suppression ───────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Add suppression</h2>
        <form action={addSuppression} className="email-sup-form">
          <input
            type="email"
            name="email"
            required
            placeholder="email@example.com"
            className="email-sup-input"
          />
          <input
            type="text"
            name="reason"
            placeholder="Reason (optional)"
            className="email-sup-input email-sup-input--reason"
          />
          <button type="submit" className="email-sup-btn">Add</button>
        </form>
      </section>

      {/* ── Active suppressions ───────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">
          Active suppressions ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="email-empty">No active suppressions.</p>
        ) : (
          <div className="email-log-wrap">
            <table className="email-sup-table">
              <thead>
                <tr>
                  <th>Email</th><th>Reason</th><th>Source</th><th>Added</th><th></th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td className="elog-provider">{s.reason ?? "—"}</td>
                    <td className="elog-provider">{s.source ?? "—"}</td>
                    <td className="elog-date">{fmtDate(s.createdAt)}</td>
                    <td><RemoveSuppressionButton email={s.email} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Removed suppressions ──────────────────── */}
      {inactive.length > 0 && (
        <section className="email-section">
          <h2 className="email-section-title">
            Previously removed ({inactive.length})
          </h2>
          <p className="email-hint">
            These addresses were suppressed and then manually re-enabled.
          </p>
          <div className="email-log-wrap">
            <table className="email-sup-table">
              <thead>
                <tr><th>Email</th><th>Reason</th><th>Source</th><th>Date</th></tr>
              </thead>
              <tbody>
                {inactive.map((s) => (
                  <tr key={s.id}>
                    <td style={{ opacity: 0.5 }}>{s.email}</td>
                    <td className="elog-provider">{s.reason ?? "—"}</td>
                    <td className="elog-provider">{s.source ?? "—"}</td>
                    <td className="elog-date">{fmtDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
