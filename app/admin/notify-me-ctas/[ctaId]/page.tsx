import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BellRing } from "lucide-react";
import CtaForm from "./cta-form";
import FollowupButton from "./followup-button";
import type { Metadata } from "next";
import "./cta-edit.css";

type Props = {
  params: Promise<{ ctaId: string }>;
  searchParams: Promise<{ workId?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ctaId } = await params;
  return { title: ctaId === "new" ? "Admin — New CTA" : "Admin — Edit CTA" };
}

export default async function CtaEditPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const { ctaId } = await params;
  const { workId: qWorkId } = await searchParams;
  const isNew = ctaId === "new";

  if (isNew) {
    // Step 1 — no workId: show published work selector
    if (!qWorkId) {
      // Fetch published works that don't already have a CTA
      const [publishedWorks, existingCtaWorkIds] = await Promise.all([
        prisma.work.findMany({
          where: { status: "PUBLISHED", type: { not: "EPISODE" } },
          orderBy: { title: "asc" },
          select: { id: true, title: true, type: true },
        }),
        prisma.notifyMeCta.findMany({
          select: { workId: true },
        }),
      ]);

      const takenIds = new Set(existingCtaWorkIds.map((c) => c.workId));
      const available = publishedWorks.filter((w) => !takenIds.has(w.id));

      return (
        <div className="cta-edit-page">
          <Link href="/admin/notify-me-ctas" className="cta-edit-back">
            <ChevronLeft size={14} /> All CTAs
          </Link>
          <div className="cta-edit-head">
            <BellRing size={16} />
            <h1>New Notify Me CTA</h1>
          </div>
          <p className="cta-edit-sub">Select a published work to attach a Notify Me CTA to.</p>

          {available.length === 0 ? (
            <div className="cta-work-empty">
              <p>All published works already have a CTA.</p>
              <Link href="/admin/notify-me-ctas" className="cta-edit-back">
                ← Back to CTAs
              </Link>
            </div>
          ) : (
            <div className="cta-work-selector">
              {available.map((w) => (
                <Link
                  key={w.id}
                  href={`/admin/notify-me-ctas/new?workId=${w.id}`}
                  className="cta-work-option"
                >
                  <span className="cta-work-option-title">{w.title}</span>
                  <span className="cta-work-option-type">{w.type.replace(/_/g, " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Step 2 — workId provided: validate and show create form
    const work = await prisma.work.findUnique({
      where: { id: qWorkId },
      select: { id: true, title: true, type: true, videoUrl: true, trailerUrl: true, status: true },
    });
    if (!work || work.status !== "PUBLISHED") redirect("/admin/notify-me-ctas");

    // If a CTA already exists for this work, redirect to the edit page
    const existing = await prisma.notifyMeCta.findUnique({
      where: { workId: qWorkId },
      select: { id: true },
    });
    if (existing) redirect(`/admin/notify-me-ctas/${existing.id}`);

    return (
      <div className="cta-edit-page">
        <Link href="/admin/notify-me-ctas/new" className="cta-edit-back">
          <ChevronLeft size={14} /> Choose a Different Work
        </Link>
        <div className="cta-edit-head">
          <BellRing size={16} />
          <h1>New Notify Me CTA</h1>
        </div>
        <p className="cta-edit-sub">
          For: <strong>{work.title}</strong>
        </p>
        <CtaForm workId={work.id} workTitle={work.title} cta={null} />
      </div>
    );
  }

  // ACS configured check — env var never exposed to client
  const acsConfigured = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );

  // Edit mode — fetch by ctaId
  const [cta, signupCount, recentSignups] = await Promise.all([
    prisma.notifyMeCta.findUnique({
      where: { id: ctaId },
      select: {
        id: true, type: true, isEnabled: true,
        headline: true, body: true, ctaLabel: true,
        triggerSecondsFromEnd: true,
        work: { select: { id: true, title: true, type: true } },
      },
    }),
    prisma.notifyMeSignup.count({ where: { ctaId } }),
    prisma.notifyMeSignup.findMany({
      where: { ctaId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, email: true, name: true, createdAt: true },
    }),
  ]);

  if (!cta) notFound();

  return (
    <div className="cta-edit-page">
      <Link href="/admin/notify-me-ctas" className="cta-edit-back">
        <ChevronLeft size={14} /> All CTAs
      </Link>

      <div className="cta-edit-head">
        <BellRing size={16} />
        <h1>Edit Notify Me CTA</h1>
      </div>
      <p className="cta-edit-sub">
        For: <strong>{cta.work.title}</strong>
      </p>

      <CtaForm
        workId={cta.work.id}
        workTitle={cta.work.title}
        cta={{ ...cta, type: cta.type as string }}
      />

      {/* Follow-up email */}
      <div style={{ marginTop: "2rem" }}>
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700,
          color: "var(--color-brand-white)", marginBottom: "0.5rem",
        }}>
          Follow-up Email
        </h2>
        <p style={{
          fontFamily: "var(--font-body)", fontSize: "0.8125rem",
          color: "var(--color-brand-muted)", marginBottom: "0.75rem",
        }}>
          Queue a release-ready follow-up email to everyone who signed up for this CTA.
        </p>
        <FollowupButton
          ctaId={ctaId}
          signupCount={signupCount}
          acsReady={acsConfigured}
        />
      </div>

      {/* Signups table */}
      <div className="cta-signups">
        <div className="cta-signups-head">
          <h2 className="cta-signups-title">Signups</h2>
          <span className="cta-signups-count">{signupCount} total</span>
        </div>

        {recentSignups.length === 0 ? (
          <p className="cta-signups-empty">No signups yet.</p>
        ) : (
          <div className="cta-table-wrap">
            <table className="cta-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{s.name ?? <span style={{ color: "var(--color-brand-muted)" }}>—</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(s.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {signupCount > 20 && (
              <p className="cta-table-more">
                Showing 20 of {signupCount}. Export from Prisma Studio for full list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
