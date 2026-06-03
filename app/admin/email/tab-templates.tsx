import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function TabTemplates() {
  const [total, systemCount] = await Promise.all([
    prisma.emailTemplate.count(),
    prisma.emailTemplate.count({ where: { isSystem: true } }),
  ]);
  const custom = total - systemCount;

  return (
    <>
      {/* ── Stats ────────────────────────────────── */}
      <section className="email-section">
        <div className="email-stats">
          <div className="email-stat">
            <span className="email-stat-val">{total}</span>
            <span className="email-stat-label">Total</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{systemCount}</span>
            <span className="email-stat-label">System</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val">{custom}</span>
            <span className="email-stat-label">Custom</span>
          </div>
        </div>
      </section>

      {/* ── Link to editor ────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Template editor</h2>
        <p className="email-hint">
          Create and edit reusable HTML email templates with variable placeholders.
          System templates (Password Reset, Welcome, Security Alert) are protected and cannot be deleted.
        </p>
        <Link
          href="/admin/email/templates"
          className="email-sup-btn"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          Open Template Editor →
        </Link>
      </section>
    </>
  );
}
