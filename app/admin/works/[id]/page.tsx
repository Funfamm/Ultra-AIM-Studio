import { prisma } from "@/lib/prisma";
import { createWork, updateWork } from "@/lib/actions/works";
import WorkForm from "@/components/admin/work-form";
import SeriesEpisodesPanel from "@/components/admin/series-episodes-panel";
import ReleaseEmailButton from "./release-email-button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import type { WorkType } from "@prisma/client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    /** Pre-fill parent series — set by "Add Episode" link in SeriesEpisodesPanel */
    parentId?: string;
    /** Pre-select work type — set by "Add Episode" link */
    type?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "Admin — Add Work" };
  return { title: "Admin — Edit Work" };
}

export default async function AdminWorkFormPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, parentId: defaultParentId, type: defaultTypeRaw } = await searchParams;
  const defaultType = defaultTypeRaw as WorkType | undefined;
  const isNew = id === "new";

  // Fetch the work being edited (if any), the full series list, and lean CTA id in parallel
  const [work, seriesList, ctaRow] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.work.findUnique({ where: { id } }),
    prisma.work.findMany({
      where: { type: "SERIES" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    isNew
      ? Promise.resolve(null)
      : prisma.notifyMeCta.findUnique({
          where: { workId: id },
          select: { id: true, isEnabled: true },
        }),
  ]);

  if (!isNew && !work) notFound();

  // Fetch child episodes only when editing a Series — avoids the query for all other types
  const episodes =
    !isNew && work?.type === "SERIES"
      ? await prisma.work.findMany({
          where: { parentId: id },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
          select: {
            id: true, title: true, status: true,
            seasonNumber: true, episodeNumber: true,
            duration: true, videoUrl: true,
          },
        })
      : [];

  const action = isNew ? createWork : updateWork.bind(null, id);

  // ACS configured check — env var stays server-side, only boolean reaches client
  const acsReady = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );

  return (
    <>
      <WorkForm
        work={work}
        workTitle={work?.title}
        action={action}
        seriesList={seriesList}
        error={error}
        defaultType={defaultType}
        defaultParentId={defaultParentId}
      />

      {/* Episodes panel — only rendered when editing a Series */}
      {!isNew && work?.type === "SERIES" && (
        <SeriesEpisodesPanel seriesId={id} episodes={episodes} />
      )}

      {/* Notify Me CTA — link to dedicated CTA management page */}
      {!isNew && work && (
        <div style={{ marginTop: "2rem", padding: "1.25rem 1.5rem", background: "var(--color-brand-dark)", border: "1px solid var(--color-brand-border)", borderRadius: 4 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem" }}>Notify Me CTA</p>
          <Link
            href={ctaRow ? `/admin/notify-me-ctas/${ctaRow.id}` : `/admin/notify-me-ctas/new?workId=${id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-brand-accent)", textDecoration: "none" }}
          >
            <BellRing size={14} />
            {ctaRow ? `Manage CTA${ctaRow.isEnabled ? " (Active)" : " (Disabled)"}` : "Set Up Notify Me CTA"}
          </Link>
        </div>
      )}

      {/* Release email — only for published, non-episode works */}
      {!isNew && work && work.status === "PUBLISHED" && work.type !== "EPISODE" && (
        <div style={{ marginTop: "1rem", padding: "1.25rem 1.5rem", background: "var(--color-brand-dark)", border: "1px solid var(--color-brand-border)", borderRadius: 4 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.4rem" }}>Release Email</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
            Queue a bulk email to all opted-in registered users announcing this release.
            Emails are sent when you process the queue from{" "}
            <Link href="/admin/email" style={{ color: "var(--color-brand-accent)" }}>Admin → Email</Link>.
          </p>
          <ReleaseEmailButton workId={id} emailType="release" acsReady={acsReady} />
        </div>
      )}

      {/* Episode email — only for published episodes with a parent series */}
      {!isNew && work && work.status === "PUBLISHED" && work.type === "EPISODE" && work.parentId && (
        <div style={{ marginTop: "1rem", padding: "1.25rem 1.5rem", background: "var(--color-brand-dark)", border: "1px solid var(--color-brand-border)", borderRadius: 4 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.4rem" }}>Episode Email</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
            Queue a bulk email to opted-in users announcing this episode.
          </p>
          <ReleaseEmailButton workId={id} emailType="episode" acsReady={acsReady} />
        </div>
      )}
    </>
  );
}
