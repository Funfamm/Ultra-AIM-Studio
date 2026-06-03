// /admin/data — Retention settings + manual cleanup
// Preview cleanup counts before deleting. Run is superadmin-only.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole, isSuperAdmin } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { RetentionSettingsForm, RetentionCleanupActions } from "./retention-client";
import "./data.css";

export const metadata: Metadata = { title: "Data & Retention — Admin" };

export default async function AdminDataPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const superAdmin = isSuperAdmin(session.user.role);

  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: {
      emailLogRetentionDays:     true,
      emailQueueRetentionDays:   true,
      notificationRetentionDays: true,
      visitorEventRetentionDays: true,
    },
  });

  const defaults = {
    emailLogRetentionDays:     settings?.emailLogRetentionDays     ?? 90,
    emailQueueRetentionDays:   settings?.emailQueueRetentionDays   ?? 30,
    notificationRetentionDays: settings?.notificationRetentionDays ?? 90,
    visitorEventRetentionDays: settings?.visitorEventRetentionDays ?? 90,
  };

  return (
    <div className="retention-page">
      <h1 className="admin-page-title">Data &amp; Retention</h1>
      <p className="retention-sub">
        Configure how long operational data is kept and run manual cleanup when needed.
        Audit logs, security events, and email suppressions are always protected.
      </p>

      {/* ── Retention settings ── */}
      <section className="retention-section">
        <h2 className="retention-section-title">Retention windows</h2>
        <p className="retention-section-hint">
          These values control which records are included in a cleanup run.
          They do not auto-delete — cleanup runs only when you trigger it below.
        </p>
        <RetentionSettingsForm defaults={defaults} />
      </section>

      {/* ── Protected records notice ── */}
      <section className="retention-section">
        <h2 className="retention-section-title">Protected records</h2>
        <div className="retention-protected-list">
          {[
            ["Audit logs",          "Permanent — never auto-deleted"],
            ["Security events",     "Permanent — never auto-deleted"],
            ["Email suppressions",  "Permanent unless manually lifted"],
            ["Security alerts",     "Permanent — admin review required"],
            ["User accounts",       "Retained per user lifecycle policy"],
            ["Watch progress",      "User-owned — only cleared by user"],
            ["Saved works",         "User-owned — only cleared by user"],
          ].map(([name, desc]) => (
            <div key={name} className="retention-protected-row">
              <ShieldAlert size={13} className="retention-protected-icon" />
              <span className="retention-protected-name">{name}</span>
              <span className="retention-protected-desc">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cleanup tool ── */}
      <section className="retention-section">
        <h2 className="retention-section-title">Manual cleanup</h2>
        <p className="retention-section-hint">
          Preview shows exactly what will be deleted before you commit.
          {!superAdmin && (
            <> Run cleanup is restricted to Super Admin accounts.</>
          )}
        </p>
        <RetentionCleanupActions isSuperAdmin={superAdmin} />
      </section>
    </div>
  );
}
