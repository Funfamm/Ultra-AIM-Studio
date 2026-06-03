import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import "./detail.css";
import Image from "next/image";
import { Play, Clock, Calendar, ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import SynopsisToggle from "@/components/synopsis-toggle";
import SaveButton from "@/components/save-button";
import CommentSection from "@/components/comment-section";
import LikeButton from "@/components/like-button";
import ShareButton from "@/components/share-button";
import { isWorkSaved } from "@/lib/actions/watchlist";
import { getWorkLikeState } from "@/lib/actions/likes";
import { getOrCreateSession, trackEvent } from "@/lib/analytics";
import SeriesTrailerPlayer from "@/components/series-trailer-player";
import { getWorkCtaState } from "@/lib/work-cta";
import { getResumeEpisodeSlug } from "@/lib/actions/progress";

type Props = { params: Promise<{ slug: string }> };

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short Film",
  FULL_FILM: "Film",
  SERIES: "Series",
  TRAILER: "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING: "Branding",
  CAMPAIGN: "Campaign",
  CASE_STUDY: "Case Study",
};

const STATUS_BADGE: Record<string, { label: string; cls: string } | undefined> = {
  UPCOMING:      { label: "Coming Soon",    cls: "detail-status-badge detail-status-badge--upcoming" },
  IN_PRODUCTION: { label: "In Production",  cls: "detail-status-badge detail-status-badge--production" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({
    where: { slug },
    select: { title: true, description: true, posterUrl: true },
  });
  if (!work) return { title: "Not Found" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";
  const ogImage = work.posterUrl
    ? { url: work.posterUrl, width: 1200, height: 630, alt: work.title }
    : { url: `${appUrl}/images/SP_Logo.jpg`, width: 1200, height: 630, alt: "AIM Studio" };

  return {
    title: work.title,
    description: work.description ?? undefined,
    alternates: { canonical: `${appUrl}/works/${slug}` },
    openGraph: {
      title: work.title,
      description: work.description ?? undefined,
      url: `${appUrl}/works/${slug}`,
      images: [ogImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: work.title,
      description: work.description ?? undefined,
      images: [work.posterUrl ?? `${appUrl}/images/SP_Logo.jpg`],
    },
  };
}

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, type: true, status: true, commentsEnabled: true,
      description: true, posterUrl: true, heroMobileUrl: true, heroDesktopUrl: true,
      trailerUrl: true, videoUrl: true,
      year: true, duration: true, genre: true, genres: true, director: true,
      requiresAuth: true, requiresLoginToViewTrailer: true,
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: {
          id: true, slug: true, title: true,
          description: true, posterUrl: true, videoUrl: true,
          duration: true, seasonNumber: true, episodeNumber: true,
        },
      },
    },
  });
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function WorkDetailPage({ params }: Props) {
  const { slug } = await params;
  const [work, session] = await Promise.all([getWork(slug), auth()]);

  const PUBLIC_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_STATUSES.has(work.status)) notFound();

  // Track WORK_VIEW after the response is sent — zero render latency
  const jar = await cookies();
  const _visitorId = jar.get("aim-vid")?.value;
  const _userId    = session?.user?.id ?? undefined;
  const _workId    = work.id;
  const _path      = `/works/${slug}`;
  after(async () => {
    if (!_visitorId) return;
    try {
      const sessionId = await getOrCreateSession({ visitorId: _visitorId, landingPage: _path })
        .catch(() => undefined);
      await trackEvent({
        visitorId: _visitorId,
        userId: _userId,
        sessionId,
        type: "WORK_VIEW",
        path: _path,
        workId: _workId,
      });
    } catch { /* analytics must never break the page */ }
  });

  const isGuest       = !session?.user;
  const locked        = work.requiresAuth && isGuest;
  // CTA shows for any public status — the page already returns 404 for drafts/archived.
  const isPublished   = true;

  const [isSaved, { isLiked, likeCount }] = await Promise.all([
    !isGuest ? isWorkSaved(work.id) : Promise.resolve(false),
    getWorkLikeState(work.id),
  ]);

  const firstEp      = work.type === "SERIES" ? work.episodes[0] ?? null : null;
  const episodeCount = work.type === "SERIES" ? work.episodes.length : null;
  const isSeries     = work.type === "SERIES";

  // Smart resume: find last-watched / next unwatched episode for this series.
  // Always falls back to firstEp.slug so the "Watch Series" CTA is never missing.
  const allEpSlugs = isSeries ? work.episodes.map((e) => e.slug) : [];
  const resumeSlug = isSeries
    ? (!isGuest && allEpSlugs.length > 0
        ? (await getResumeEpisodeSlug(work.id, allEpSlugs)) ?? (firstEp?.slug ?? null)
        : firstEp?.slug ?? null)
    : null;

  // Detect if the entire series is completed (all episodes watched)
  const allEpisodesCompleted =
    isSeries && episodeCount != null && episodeCount > 0 && resumeSlug === allEpSlugs[0] &&
    !isGuest && allEpSlugs.length > 0;

  // Image fallback chain: prefer heroMobileUrl/heroDesktopUrl; fall back to posterUrl
  const portraitImg = work.heroMobileUrl ?? work.posterUrl;
  const backdropImg = work.heroDesktopUrl ?? work.heroMobileUrl ?? work.posterUrl;

  return (
    <main className="detail-page">

      {/* ── Mobile sticky 16:9 player (series only) ──────────────
          Hidden on desktop via CSS. Shows poster; plays trailer inline on tap.
          Renders before the hero so it sticks under the fixed nav (top: 68px).  */}
      {isSeries && (
        <SeriesTrailerPlayer
          posterUrl={portraitImg}
          trailerUrl={work.trailerUrl}
          title={work.title}
        />
      )}

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="detail-hero">

        {/* Ambient backdrop — prefer wide desktop image */}
        {backdropImg && (
          <div className="detail-backdrop" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backdropImg} alt="" className="detail-backdrop-img" />
            <div className="detail-backdrop-gradient" />
          </div>
        )}

        <div className="container-app detail-hero-inner">
          <Link href="/works" className="detail-back">
            <ChevronLeft size={15} /> All Works
          </Link>

          <div className="detail-layout">

            {/* Portrait poster — prefer heroMobileUrl (9:16), fallback to posterUrl */}
            <div className={`detail-poster-wrap${isSeries ? " detail-poster-wrap--mobile-hide" : ""}`}>
              {portraitImg ? (
                <Image
                  src={portraitImg}
                  alt={work.title}
                  fill
                  className="detail-poster"
                  priority
                  quality={90}
                  sizes="(max-width: 767px) 260px, (max-width: 1023px) 220px, 260px"
                />
              ) : (
                <div className="detail-poster-placeholder">
                  <span>{work.title.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="detail-info">

              {(work.genres.length > 0 ? work.genres.join(" · ") : work.genre) && (
                <span className="detail-genre">{work.genres.length > 0 ? work.genres.join(" · ") : work.genre}</span>
              )}

              <h1 className="detail-title">{work.title}</h1>

              {/* Metadata */}
              <div className="detail-meta">
                {work.type && TYPE_LABEL[work.type] && (
                  <span className="detail-meta-chip">{TYPE_LABEL[work.type]}</span>
                )}
                {work.year && (
                  <span className="detail-meta-item">
                    <Calendar size={12} />{work.year}
                  </span>
                )}
                {work.duration && (
                  <span className="detail-meta-item">
                    <Clock size={12} />{fmtDuration(work.duration)}
                  </span>
                )}
                {episodeCount != null && episodeCount > 0 && (
                  <span className="detail-meta-item">
                    {episodeCount} {episodeCount === 1 ? "Episode" : "Episodes"}
                  </span>
                )}
                {work.director && (
                  <span className="detail-meta-item">Dir. {work.director}</span>
                )}
              </div>

              {work.description && <div className="detail-synopsis"><SynopsisToggle text={work.description} /></div>}

              {/* Status badge — upcoming / in-production works */}
              {STATUS_BADGE[work.status] && (
                <span className={STATUS_BADGE[work.status]!.cls}>
                  {STATUS_BADGE[work.status]!.label}
                </span>
              )}

              {/* CTAs — powered by shared getWorkCtaState() */}
              <div className="detail-actions">
                {(() => {
                  const cta = getWorkCtaState({
                    slug: work.slug,
                    type: work.type,
                    trailerUrl: work.trailerUrl,
                    videoUrl: work.videoUrl,
                    requiresAuth: work.requiresAuth,
                    requiresLoginToViewTrailer: work.requiresLoginToViewTrailer ?? undefined,
                    isGuest: isGuest,
                    firstEpisodeSlug: resumeSlug,
                  });
                  // Override label for Watch Again (user finished whole series)
                  if (allEpisodesCompleted && cta.primaryLabel === "Watch Series") {
                    cta.primaryLabel = "Watch Again";
                  }
                  return (
                    <>
                      {/* Primary CTA — always visible on both desktop and mobile.
                          detail-trailer-desktop-only was previously wrapping
                          series CTAs, hiding Watch Again/Watch Series on mobile.
                          The SeriesTrailerPlayer sticky overlay is quick-access
                          only; the main CTAs must appear in the content area too. */}
                      {cta.primaryLabel && isPublished && (
                        <Link href={cta.primaryHref} className="detail-btn-primary">
                          {cta.isLocked || cta.isTrailerLocked ? <Lock size={14} /> : <Play size={14} fill="currentColor" />}
                          {" "}{cta.primaryLabel}
                        </Link>
                      )}

                      {/* Secondary CTA (trailer ghost button) — always visible */}
                      {cta.secondaryLabel && cta.secondaryHref && isPublished && (
                        <Link href={cta.secondaryHref} className="detail-btn-ghost">
                          {cta.isTrailerLocked ? <Lock size={14} /> : <Play size={14} fill="currentColor" />}
                          {" "}{cta.secondaryLabel}
                        </Link>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Engagement row — Save (members) + Like + Share */}
              <div className="detail-engagement">
                {!isGuest && (
                  <SaveButton workId={work.id} initialSaved={isSaved} />
                )}
                <LikeButton
                  workId={work.id}
                  initialLiked={isLiked}
                  likeCount={likeCount}
                  isGuest={isGuest}
                  slug={work.slug}
                />
                <ShareButton title={work.title} slug={work.slug} workId={work.id} />
              </div>

              {/* Guest note — only when content is gated */}
              {work.requiresAuth && isGuest && (
                <p className="detail-auth-note">
                  <Lock size={11} /> Members only.{" "}
                  <Link href="/register">Create a free account</Link> to watch.
                </p>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* ── Episodes (series only) ─────────────────────── */}
      {isSeries && (
        <section className="episodes-section">
          <div className="container-app">

            <div className="episodes-head">
              <h2 className="episodes-title">Episodes</h2>
              {episodeCount != null && episodeCount > 0 && (
                <span className="episodes-count">
                  {episodeCount} {episodeCount === 1 ? "Episode" : "Episodes"}
                </span>
              )}
            </div>

            {work.episodes.length === 0 ? (
              <p className="episodes-empty">Episodes are coming soon.</p>
            ) : (
              <ol className="episodes-list">
                {work.episodes.map((ep) => {
                  const label =
                    ep.seasonNumber != null && ep.episodeNumber != null
                      ? `S${ep.seasonNumber} E${ep.episodeNumber}`
                      : ep.episodeNumber != null
                      ? `E${ep.episodeNumber}`
                      : null;

                  // Episode access inherits from parent Series — no separate lock per episode
                  const epLocked = work.requiresAuth && isGuest;

                  return (
                    <li key={ep.id}>
                      <div className="ep-card">

                        {/* Thumbnail */}
                        <div className="ep-thumb-wrap">
                          {ep.posterUrl ? (
                            <Image
                              src={ep.posterUrl}
                              alt={ep.title}
                              fill
                              sizes="(max-width: 640px) 100px, 160px"
                              className="ep-thumb-img"
                              quality={75}
                              loading="lazy"
                            />
                          ) : (
                            <div className="ep-thumb-placeholder">
                              {label ?? ep.title.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="ep-body">
                          <div className="ep-meta-row">
                            {label && <span className="ep-label">{label}</span>}
                            {ep.duration && (
                              <span className="ep-duration">
                                <Clock size={10} />
                                {fmtDuration(ep.duration)}
                              </span>
                            )}
                          </div>
                          <p className="ep-title">{ep.title}</p>
                          {ep.description && (
                            <p className="ep-desc">{ep.description}</p>
                          )}
                        </div>

                        {/* Watch action */}
                        <div className="ep-watch">
                          {ep.videoUrl ? (
                            epLocked ? (
                              <Link
                                href={`/login?from=/watch/${ep.slug}`}
                                className="ep-btn ep-btn--locked"
                              >
                                <Lock size={11} /> Watch Episode
                              </Link>
                            ) : (
                              <Link href={`/watch/${ep.slug}`} className="ep-btn">
                                <Play size={11} fill="currentColor" /> Watch Episode
                              </Link>
                            )
                          ) : (
                            <span className="ep-soon">Soon</span>
                          )}
                        </div>

                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

          </div>
        </section>
      )}

      {/* ── Comments ───────────────────────────────────── */}
      {work.commentsEnabled && work.status === "PUBLISHED" && (
        <div className="container-app">
          <CommentSection
            workId={work.id}
            workSlug={work.slug}
            currentUser={session?.user
              ? { id: session.user.id!, name: session.user.name ?? null, image: session.user.image ?? null, role: session.user.role as string }
              : null}
          />
        </div>
      )}
    </main>
  );
}
