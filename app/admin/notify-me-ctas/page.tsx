import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BellRing, Plus, CheckCircle2, Circle, Pencil } from "lucide-react";
import type { Metadata } from "next";
import "./notify-me-ctas.css";

export const metadata: Metadata = { title: "Admin — Notify Me CTAs" };

export default async function NotifyMeCtasPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const ctas = await prisma.notifyMeCta.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, isEnabled: true,
      headline: true, ctaLabel: true, triggerSecondsFromEnd: true,
      createdAt: true,
      work: { select: { id: true, title: true, type: true, slug: true } },
      _count: { select: { signups: true } },
    },
  });

  // Signups in the last 7 days per CTA
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCounts = await prisma.notifyMeSignup.groupBy({
    by: ["ctaId"],
    where: {
      ctaId: { in: ctas.map((c) => c.id) },
      createdAt: { gte: sevenDaysAgo },
    },
    _count: { id: true },
  });
  const recentMap = new Map(recentCounts.map((r) => [r.ctaId, r._count.id]));

  const CTA_TYPE_LABEL: Record<string, string> = {
    RELEASE: "Pre-Release",
    MORE: "Watch More",
    POST_RELEASE: "Post-Release",
  };

  return (
    <div className="nmc-page">
      <div className="nmc-head">
        <div className="nmc-head-title">
          <BellRing size={18} />
          <h1>Notify Me CTAs</h1>
        </div>
        <Link href="/admin/notify-me-ctas/new" className="nmc-add-btn">
          <Plus size={14} /> New CTA
        </Link>
      </div>

      {ctas.length === 0 ? (
        <div className="nmc-empty">
          <BellRing size={32} strokeWidth={1.25} />
          <p>No CTAs yet. Create one to start capturing signups during playback.</p>
          <Link href="/admin/notify-me-ctas/new" className="nmc-add-btn">
            <Plus size={14} /> New CTA
          </Link>
        </div>
      ) : (
        <div className="nmc-table-wrap">
          <table className="nmc-table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Type</th>
                <th>Status</th>
                <th>Signups</th>
                <th>Last 7 Days</th>
                <th>Trigger</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ctas.map((cta) => (
                <tr key={cta.id}>
                  <td>
                    <div className="nmc-work-cell">
                      <span className="nmc-work-title">{cta.work.title}</span>
                      <span className="nmc-work-type">{cta.work.type.replace("_", " ")}</span>
                    </div>
                  </td>
                  <td>
                    <span className="nmc-type-chip">{CTA_TYPE_LABEL[cta.type] ?? cta.type}</span>
                  </td>
                  <td>
                    {cta.isEnabled ? (
                      <span className="nmc-status nmc-status--active">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    ) : (
                      <span className="nmc-status nmc-status--off">
                        <Circle size={12} /> Off
                      </span>
                    )}
                  </td>
                  <td className="nmc-num">{cta._count.signups}</td>
                  <td className="nmc-num">{recentMap.get(cta.id) ?? 0}</td>
                  <td className="nmc-num">{cta.triggerSecondsFromEnd}s from end</td>
                  <td>
                    <Link
                      href={`/admin/notify-me-ctas/${cta.id}`}
                      className="nmc-edit-btn"
                      aria-label={`Edit CTA for ${cta.work.title}`}
                    >
                      <Pencil size={12} /> Edit
                    </Link>
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
