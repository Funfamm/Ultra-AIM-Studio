import { listTemplates, ensureSystemEmailTemplates } from "@/lib/actions/email-templates";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail, Plus } from "lucide-react";
import TemplateListActions from "./template-list-actions";
import type { Metadata } from "next";
import "./templates.css";

export const metadata: Metadata = { title: "Email Templates — Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}

function statusBadge(t: { isSystem: boolean; isActive: boolean }) {
  if (t.isSystem)  return <span className="tmpl-status tmpl-status--system">System</span>;
  if (t.isActive)  return <span className="tmpl-status tmpl-status--active">Active</span>;
  return <span className="tmpl-status tmpl-status--inactive">Inactive</span>;
}

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  // Idempotent — creates missing default templates on first visit, skips existing ones
  await ensureSystemEmailTemplates();
  const templates = await listTemplates();

  return (
    <div className="tmpl-page">
      <Link href="/admin/email" className="tmpl-back">
        <ChevronLeft size={14} /> Email
      </Link>

      <div className="tmpl-head">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Mail size={16} color="var(--color-brand-accent)" />
          <h1>Email Templates</h1>
        </div>
        <Link href="/admin/email/templates/new" className="tmpl-new-btn">
          <Plus size={13} /> New Template
        </Link>
      </div>
      <p className="tmpl-sub">
        Create and manage reusable email templates. System templates (Password Reset, Welcome,
        Security Alert) are protected — they can be edited but not deleted or deactivated.
      </p>

      {templates.length === 0 ? (
        <div className="tmpl-table-wrap">
          <p className="tmpl-empty">No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="tmpl-table-wrap">
          <table className="tmpl-table">
            <thead>
              <tr>
                <th>Name / Key</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      href={`/admin/email/templates/${t.id}`}
                      className="tmpl-name"
                      style={{ textDecoration: "none", color: "var(--color-brand-white)" }}
                    >
                      {t.label ?? t.name}
                    </Link>
                    <span className="tmpl-key">{t.name}</span>
                  </td>
                  <td><span className="tmpl-type-badge">{t.type}</span></td>
                  <td className="tmpl-subject" title={t.subject}>{t.subject}</td>
                  <td>{statusBadge(t)}</td>
                  <td className="tmpl-date">{fmtDate(t.updatedAt)}</td>
                  <td>
                    <span className="tmpl-actions">
                      <Link
                        href={`/admin/email/templates/${t.id}`}
                        className="tmpl-action-btn"
                      >
                        Edit
                      </Link>
                      <TemplateListActions
                        id={t.id}
                        isActive={t.isActive}
                        isSystem={t.isSystem}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
