import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import "./watch.css";
import "../../works/[slug]/detail.css";
import { ChevronLeft, ChevronRight, Lock, Check, Play, Clock } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import AimPlayer from "@/components/aim-player";
import { getWatchProgress, getEpisodeProgressMap } from "@/lib/actions/progress";
import SaveButton from "@/components/save-button";
import CommentSection from "@/components/comment-section";
import ShareButton from "@/components/share-button";
import { isWorkSaved } from "@/lib/actions/watchlist";
import { getWorkLikeState } from "@/lib/actions/likes";
import { getOrCreateSession, trackEvent } from "@/lib/analytics";

const WORK_TYPE_LABEL: Record<string, string> = {
  FULL_FILM: "Film", SHORT_FILM: "Short Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ full?: string; trailer?: string; clipStart?: string; clipEnd?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({ where: { slug }, select: { title: true } });
  return { title: work ? `Watch: ${work.title}` : "Watch" };
}

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true, type: true,
      commentsEnabled: true,
      trailerUrl: true, videoUrl: true,
      requiresAuth: true, requiresLoginToViewTrailer: true,
      posterUrl: true, description: true,
      episodeNumber: true, seasonNumber: true, duration: true,
      introStart: true, introEnd: true, creditsStart: true,
      contentRating: true, contentDescriptors: true,
      // SERIES: all published episodes — used for redirect, player panel, and
      // the "Watch Series" section on the trailer watch page.
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: {
          id: true, slug: true, title: true,
          episodeNumber: true, seasonNumber: true,
          duration: true, thumbnailUrl: true, posterUrl: true,
        },
      },
      // EPISODE: parent series controls access, intro timings, and content advisory
      parent: {
        select: {
          id: true, slug: true, title: true, requiresAuth: true,
          introStart: true, introEnd: true, creditsStart: true,
          contentRating: true, contentDescriptors: true,
          episodes: {
            where: { status: "PUBLISHED" },
            orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
            select: {
              id: true, slug: true, title: true,
              episodeNumber: true, seasonNumber: true,
              duration: true, thumbnailUrl: true, posterUrl: true,
            },
          },
        },
      },
      notifyMeCta: {
        select: {
          id: true, type: true, isEnabled: true,
          headline: true, body: true, ctaLabel: true,
          triggerSecondsFromEnd: true,
        },
      },
    },
  });
}

function toEmbedUrl(url: string): string {
  if (url.includes("youtube.com/watch")) {
    const v = new URL(url).searchParams.get("v");
    return `https://www.youtube.com/embed/${v}?rel=0`;
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${id}?rel=0`;
  }
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1].split("?")[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { full, trailer, clipStart: clipStartStr, clipEnd: clipEndStr } = await searchParams;
  const clipStartParam = clipStartStr != null ? Math.max(0, Math.floor(Number(clipStartStr))) : null;
  const clipEndParam   = clipEndStr   != null ? Math.floor(Number(clipEndStr)) : null;
  const isClipMode     = clipStartParam !== null && clipEndParam !== null;
  const work = await getWork(slug);

  const PUBLIC_WATCH_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_WATCH_STATUSES.has(work.status)) notFound();

  // SERIES with episodes → redirect to Episode 1 (smart resume handled on detail page)
  if (work.type === "SERIES" && work.episodes.length > 0 && !trailer) {
    redirect(`/watch/${work.episodes[0].slug}`);
  }

  const session = await auth();
  const isEpisode = work.type === "EPISODE";
  const wantFull  = isEpisode ? true : full === "1";

  // Access control
  const mainRequiresAuth =
    isEpisode ? (work.parent?.requiresAuth ?? false) : work.requiresAuth;
  const trailerRequiresAuth = work.requiresLoginToViewTrailer;
  const isTrailerVisit = work.type === "TRAILER" || (!isEpisode && !wantFull);
  const requiresAuth   = isTrailerVisit ? trailerRequiresAuth : mainRequiresAuth;

  if (requiresAuth && !session?.user) {
    const from = isEpisode ? `/watch/${slug}` : `/watch/${slug}${wantFull ? "?full=1" : ""}`;
    redirect(`/login?from=${from}`);
  }

  // Block full-film viewing for non-published upcoming works
  if (work.status !== "PUBLISHED" && wantFull && !isEpisode) notFound();

  // Video selection
  const videoUrl = isEpisode
    ? work.videoUrl
    : work.type === "TRAILER"
    ? work.videoUrl
    : wantFull && work.videoUrl
    ? work.videoUrl
    : work.trailerUrl;
  const isTrailer = work.type === "TRAILER" || (!isEpisode && (!wantFull || !work.videoUrl));

  const isYouTube = videoUrl?.includes("youtube.com") || videoUrl?.includes("youtu.be");
  const isVimeo   = videoUrl?.includes("vimeo.com");
  const isEmbed   = isYouTube || isVimeo;
  const embedUrl  = videoUrl ? toEmbedUrl(videoUrl) : null;

  // Resume position (0 if completed — player restarts from beginning)
  const initialSeconds = session?.user && !isEmbed && !isTrailer && work.id
    ? await getWatchProgress(work.id)
    : 0;

  const [isSaved, { isLiked, likeCount }] = await Promise.all([
    session?.user ? isWorkSaved(work.id) : Promise.resolve(false),
    getWorkLikeState(work.id),
  ]);

  // Episode nav (for episode pages — siblings from parent series)
  const siblings    = work.parent?.episodes ?? [];
  const currentIdx  = siblings.findIndex((ep) => ep.slug === slug);
  const nextEp      = currentIdx >= 0 && currentIdx < siblings.length - 1
    ? siblings[currentIdx + 1] : null;
  const isLastEp    = isEpisode && siblings.length > 0 && currentIdx === siblings.length - 1;

  // Episode progress map for sidebar — plain object, not Map (must be serializable)
  const siblingProgressMap = session?.user && siblings.length > 0
    ? await getEpisodeProgressMap(siblings.map((e) => e.id))
    : {} as Record<string, { seconds: number; completed: boolean }>;

  // For series trailer pages: episodes fetched in getWork (all published episodes)
  // used to populate the player episodes panel and the "Watch Series" section.
  const isSeriesTrailer = work.type === "SERIES" && !!trailer;
  const seriesEpisodes  = isSeriesTrailer ? work.episodes : [];

  // Notify Me CTA
  let rawCta = work.notifyMeCta?.isEnabled && !isEmbed ? work.notifyMeCta : null;
  if (!rawCta && isLastEp && work.parent?.id) {
    const seriesCta = await prisma.notifyMeCta.findUnique({
      where: { workId: work.parent.id },
      select: { id: true, type: true, isEnabled: true, headline: true, body: true, ctaLabel: true, triggerSecondsFromEnd: true },
    });
    if (seriesCta?.isEnabled) rawCta = seriesCta;
  }

  const ctaAlreadySigned = rawCta && session?.user?.email
    ? await prisma.notifyMeSignup.findFirst({
        where: { ctaId: rawCta.id, email: session.user.email.toLowerCase() },
        select: { id: true },
      })
    : null;

  const ctaProp = rawCta && !ctaAlreadySigned
    ? ({
        id: rawCta.id, type: rawCta.type as string,
        headline: rawCta.headline, body: rawCta.body, ctaLabel: rawCta.ctaLabel,
        triggerSecondsFromEnd: rawCta.triggerSecondsFromEnd,
        workId: work.id, workTitle: work.title,
      } satisfies import("@/components/notify-cta-overlay").CtaData)
    : null;

  const ctaUser = session?.user?.email
    ? { email: session.user.email, name: session.user.name ?? null }
    : undefined;

  // Episodes: use episode-level timing first, then fall back to parent series
  // This lets admins override per-episode (e.g. different season intros)
  const introStart   = isEpisode ? (work.introStart   ?? work.parent?.introStart   ?? null) : work.introStart;
  const introEnd     = isEpisode ? (work.introEnd     ?? work.parent?.introEnd     ?? null) : work.introEnd;
  const creditsStart = isEpisode ? (work.creditsStart ?? work.parent?.creditsStart ?? null) : work.creditsStart;
  const contentRating   = isEpisode ? (work.parent?.contentRating   ?? null) : work.contentRating;
  const contentDescriptors = isEpisode
    ? (work.parent?.contentDescriptors ?? [])
    : work.contentDescriptors;

  const hasContentWarning =
    !isEmbed && (!!contentRating || contentDescriptors.length > 0);

  // Analytics
  if (isTrailer) {
    const jar = await cookies();
    const _visitorId = jar.get("aim-vid")?.value;
    const _userId = session?.user?.id ?? undefined;
    const _workId = work.id;
    const _path   = `/watch/${slug}`;
    after(async () => {
      if (!_visitorId) return;
      try {
        const sessionId = await getOrCreateSession({ visitorId: _visitorId }).catch(() => undefined);
        await trackEvent({ visitorId: _visitorId, userId: _userId, sessionId, type: "TRAILER_CLICK", path: _path, workId: _workId });
      } catch {}
    });
  }

  const epLabel =
    isEpisode && (work.seasonNumber != null || work.episodeNumber != null)
      ? [
          work.seasonNumber != null ? `S${work.seasonNumber}` : null,
          work.episodeNumber != null ? `E${work.episodeNumber}` : null,
        ].filter(Boolean).join(" ")
      : null;

  const backHref  = isEpisode && work.parent ? `/works/${work.parent.slug}` : `/works/${work.slug}`;
  const backLabel = isEpisode && work.parent ? work.parent.title : work.title;

  // Group sidebar siblings by season
  const seasonGroups = siblings.reduce<Map<number | null, typeof siblings>>((acc, ep) => {
    const s = ep.seasonNumber;
    if (!acc.has(s)) acc.set(s, []);
    acc.get(s)!.push(ep);
    return acc;
  }, new Map());
  const hasMultipleSeasons = seasonGroups.size > 1;

  return (
    <main className="watch-page">
      <div className="container-app">
        <Link href={backHref} className="watch-back">
          <ChevronLeft size={16} /> {backLabel}
        </Link>

        <p className="watch-label">
          {isEpisode ? (epLabel ?? "Episode") : isTrailer ? "Trailer" : "Full Film"}
        </p>

        <div className="watch-layout">
          {/* ── Main column ── */}
          <div className="watch-main">

            <div className="watch-player-wrap">
              {videoUrl && !isEmbed ? (
                <AimPlayer
                  src={videoUrl}
                  poster={work.posterUrl ?? undefined}
                  workId={work.id}
                  isTrailer={isTrailer}
                  workTitle={work.title}
                  workTypeLabel={isTrailer && work.type !== "TRAILER" ? "Trailer" : (WORK_TYPE_LABEL[work.type] ?? work.type)}
                  epLabel={epLabel}
                  backHref={backHref}
                  currentSlug={slug}
                  initialSeconds={initialSeconds}
                  durationMinutes={work.duration ?? undefined}
                  introStart={introStart}
                  introEnd={introEnd}
                  creditsStart={creditsStart}
                  contentRating={contentRating}
                  contentDescriptors={contentDescriptors}
                  nextSlug={nextEp?.slug}
                  nextTitle={nextEp?.title}
                  siblings={isSeriesTrailer ? seriesEpisodes : siblings}
                  siblingProgress={siblingProgressMap}
                  isGuest={!session?.user}
                  initialLiked={isLiked}
                  initialLikeCount={likeCount}
                  cta={ctaProp}
                  ctaUser={ctaUser}
                  clipStartParam={clipStartParam}
                  clipEndParam={clipEndParam}
                  isClipMode={isClipMode}
                />
              ) : isEmbed && embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="watch-iframe"
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  title={work.title}
                />
              ) : (
                <div className="watch-no-video">
                  <p>This video is unavailable right now. Please try again later.</p>
                </div>
              )}
            </div>

            <div className="watch-info">
              <h1 className="watch-title">{work.title}</h1>
              {work.description && <p className="watch-desc">{work.description}</p>}

              <div className="watch-engagement">
                {session?.user && (
                  <SaveButton workId={work.id} initialSaved={isSaved} className="save-btn save-btn--sm" />
                )}
                <ShareButton
                  title={isEpisode && work.parent ? work.parent.title : work.title}
                  slug={isEpisode && work.parent ? work.parent.slug : work.slug}
                  workId={isEpisode && work.parent ? work.parent.id : work.id}
                  size="sm"
                />
              </div>

              {/* Next Episode button (below player on mobile) */}
              {isEpisode && nextEp && (
                <Link href={`/watch/${nextEp.slug}`} className="watch-next-ep">
                  Next Episode <ChevronRight size={15} />
                </Link>
              )}

              {/* Series trailer: Watch Series upsell */}
              {isSeriesTrailer && seriesEpisodes.length > 0 && (
                <div className="watch-upsell">
                  {mainRequiresAuth && !session?.user ? (
                    <>
                      <Lock size={14} />
                      <span>
                        <Link href="/register">Create a free account</Link> to watch all episodes.
                      </span>
                    </>
                  ) : (
                    <Link href={`/watch/${seriesEpisodes[0].slug}`} className="watch-upsell-btn">
                      Watch Series — {seriesEpisodes.length} {seriesEpisodes.length === 1 ? "Episode" : "Episodes"} →
                    </Link>
                  )}
                </div>
              )}

              {/* Non-series trailer → Full Film upsell */}
              {isTrailer && work.type !== "TRAILER" && !isSeriesTrailer && work.videoUrl && (
                <div className="watch-upsell">
                  {mainRequiresAuth && !session?.user ? (
                    <>
                      <Lock size={14} />
                      <span>
                        <Link href="/register">Create a free account</Link> to watch the full film.
                      </span>
                    </>
                  ) : (
                    <Link href={`/watch/${work.slug}?full=1`} className="watch-upsell-btn">
                      Watch Full Film →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Episode sidebar ── */}
          {isEpisode && siblings.length > 1 && (
            <aside className="watch-ep-sidebar">
              <p className="watch-ep-sidebar-label">Episodes</p>
              <ol className="watch-ep-list">
                {Array.from(seasonGroups.entries()).map(([season, eps]) => (
                  <Fragment key={season ?? "no-season"}>
                    {hasMultipleSeasons && (
                      <li className="watch-season-head" aria-hidden="true">
                        {season != null ? `Season ${season}` : "Episodes"}
                      </li>
                    )}
                    {eps.map((ep) => {
                      const isCurrent = ep.slug === slug;
                      const prog = siblingProgressMap[ep.id];
                      const pct = prog && ep.duration
                        ? Math.min(100, Math.round((prog.seconds / (ep.duration * 60)) * 100))
                        : 0;
                      const isWatched = prog?.completed ?? false;
                      const num = [
                        ep.seasonNumber != null ? `S${ep.seasonNumber}` : null,
                        ep.episodeNumber != null ? `E${ep.episodeNumber}` : null,
                      ].filter(Boolean).join(" ");
                      const dur = ep.duration ? fmtDur(ep.duration) : null;
                      const thumb = ep.thumbnailUrl ?? ep.posterUrl ?? null;

                      return (
                        <li
                          key={ep.id}
                          className={`watch-ep-item${isCurrent ? " watch-ep-item--current" : ""}`}
                        >
                          {isCurrent ? (
                            <div className="watch-ep-link watch-ep-link--static">
                              {thumb && (
                                <div className="watch-ep-thumb" aria-hidden="true">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={thumb} alt="" loading="lazy" />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="watch-ep-meta">
                                  {num && <span className="watch-ep-num">{num}</span>}
                                  {dur && <span className="watch-ep-dur">{dur}</span>}
                                </div>
                                <span className="watch-ep-title">{ep.title}</span>
                                <span className="watch-ep-now">Now Playing</span>
                                {pct > 0 && !isWatched && (
                                  <div className="watch-ep-progress-bar">
                                    <div className="watch-ep-progress-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Link href={`/watch/${ep.slug}`} className="watch-ep-link">
                              {thumb && (
                                <div className="watch-ep-thumb" aria-hidden="true">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={thumb} alt="" loading="lazy" />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="watch-ep-meta">
                                  {num && <span className="watch-ep-num">{num}</span>}
                                  {dur && <span className="watch-ep-dur">{dur}</span>}
                                </div>
                                <span className="watch-ep-title">{ep.title}</span>
                                {isWatched && (
                                  <div className="watch-ep-watched">
                                    <Check size={9} style={{ display: "inline", marginRight: 2 }} />
                                    Watched
                                  </div>
                                )}
                                {!isWatched && pct > 0 && (
                                  <div className="watch-ep-progress-bar">
                                    <div className="watch-ep-progress-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </Fragment>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </div>

      {/* ── Series episodes list (shown below player on series trailer pages) ── */}
      {isSeriesTrailer && seriesEpisodes.length > 0 && (
        <div className="container-app">
          <section className="episodes-section">
            <div className="episodes-head">
              <h2 className="episodes-title">Episodes</h2>
              <span className="episodes-count">
                {seriesEpisodes.length} {seriesEpisodes.length === 1 ? "Episode" : "Episodes"}
              </span>
            </div>
            <ol className="episodes-list">
              {seriesEpisodes.map((ep) => {
                const label =
                  ep.seasonNumber != null && ep.episodeNumber != null
                    ? `S${ep.seasonNumber} E${ep.episodeNumber}`
                    : ep.episodeNumber != null
                    ? `E${ep.episodeNumber}`
                    : null;
                const epLocked = mainRequiresAuth && !session?.user;
                const thumb = ep.thumbnailUrl ?? ep.posterUrl;
                return (
                  <li key={ep.id}>
                    <div className="ep-card">
                      <div className="ep-thumb-wrap">
                        {thumb ? (
                          <Image
                            src={thumb}
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
                      <div className="ep-body">
                        <div className="ep-meta-row">
                          {label && <span className="ep-label">{label}</span>}
                          {ep.duration && (
                            <span className="ep-duration">
                              <Clock size={10} />
                              {ep.duration >= 60
                                ? `${Math.floor(ep.duration / 60)}h ${ep.duration % 60}m`
                                : `${ep.duration}m`}
                            </span>
                          )}
                        </div>
                        <p className="ep-title">{ep.title}</p>
                      </div>
                      <div className="ep-watch">
                        {epLocked ? (
                          <Link href={`/login?from=/watch/${ep.slug}`} className="ep-btn ep-btn--locked">
                            <Lock size={11} /> Watch Episode
                          </Link>
                        ) : (
                          <Link href={`/watch/${ep.slug}`} className="ep-btn">
                            <Play size={11} fill="currentColor" /> Watch Episode
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}

      {/* ── Comments ── episodes attach to episode; others attach to work ── */}
      {work.commentsEnabled && work.status === "PUBLISHED" && (
        <div className="container-app">
          <CommentSection
            workId={work.id}
            workSlug={isEpisode && work.parent ? work.parent.slug : work.slug}
            currentUser={session?.user
              ? { id: session.user.id!, name: session.user.name ?? null, image: session.user.image ?? null, role: session.user.role as string }
              : null}
          />
        </div>
      )}
    </main>
  );
}
