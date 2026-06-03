"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { getWorkCtaState } from "@/lib/work-cta";
import SaveButton from "./save-button";
import "./mobile-featured-hero.css";

export type MobileHeroItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  heroMobileUrl?: string | null;
  requiresAuth: boolean;
  genres: string[];
  type: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  requiresLoginToViewTrailer?: boolean | null;
};

// Pill definitions: shown only if at least one requiredType has published content
const PILL_DEFS: { label: string; collection: string; requiredTypes: string[] }[] = [
  { label: "Films",      collection: "films",       requiredTypes: ["SHORT_FILM", "FULL_FILM"] },
  { label: "Series",     collection: "series",      requiredTypes: ["SERIES"] },
  { label: "Shorts",     collection: "shorts",      requiredTypes: ["SHORT_FILM"] },
  { label: "Upcoming",   collection: "upcoming",    requiredTypes: [] },
  { label: "Commercial", collection: "commercials", requiredTypes: ["COMMERCIAL"] },
  { label: "Branding",   collection: "branding",    requiredTypes: ["BRANDING"] },
  { label: "Campaigns",  collection: "campaigns",   requiredTypes: ["CAMPAIGN"] },
];

type Props = {
  items: MobileHeroItem[];
  isLoggedIn: boolean;
  savedIds: string[];
  availableTypes: string[];
};

const ROTATE_MS = 7000; // auto-rotation interval
const RESUME_MS = 3000; // pause after interaction before resuming

export default function MobileFeaturedHero({ items, isLoggedIn, savedIds, availableTypes }: Props) {
  const [active, setActive] = useState(0);
  const count = items.length;

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedRef = useRef(false); // prefers-reduced-motion
  const startXRef  = useRef<number | null>(null); // pointer start X for swipe
  const draggedRef = useRef(false); // true when pointer moved >8px horizontal

  // ── Timer helpers ────────────────────────────────────────
  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function clearResume() {
    if (resumeRef.current) { clearTimeout(resumeRef.current); resumeRef.current = null; }
  }
  function startAutoPlay() {
    if (count <= 1 || reducedRef.current) return;
    clearTimer();
    timerRef.current = setInterval(() => setActive(p => (p + 1) % count), ROTATE_MS);
  }
  function pauseAndResume() {
    clearTimer();
    clearResume();
    resumeRef.current = setTimeout(startAutoPlay, RESUME_MS);
  }

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startAutoPlay();
    return () => { clearTimer(); clearResume(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!count) return null;

  // ── Pointer / swipe handlers ─────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (count <= 1) return;
    // Let button clicks (nav arrows, save, dots) pass through untracked
    if ((e.target as HTMLElement).closest("button")) return;
    startXRef.current = e.clientX;
    draggedRef.current = false;
    clearTimer();
    clearResume();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    if (Math.abs(e.clientX - startXRef.current) > 8) draggedRef.current = true;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) { pauseAndResume(); return; }
    const dx = e.clientX - startXRef.current;
    startXRef.current = null;
    if (draggedRef.current && Math.abs(dx) > 50) {
      // Real swipe — navigate; draggedRef stays true to suppress the upcoming click
      setActive(p => dx < 0 ? (p + 1) % count : ((p - 1) + count) % count);
    } else {
      // Genuine tap — let click fire normally
      draggedRef.current = false;
    }
    pauseAndResume();
  }

  function onPointerCancel() {
    startXRef.current = null;
    draggedRef.current = false;
    pauseAndResume();
  }

  // Prevent card-link navigation when the gesture was a swipe, not a tap
  function onClickCapture(e: React.MouseEvent) {
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <section className="mfh" aria-label="Featured works">

      {/* ── Category pills ── */}
      <div className="mfh-pills-wrap">
        <div className="mfh-pills">
          <Link href="/works" className="mfh-pill">All</Link>
          {PILL_DEFS
            .filter(p =>
              p.label === "Upcoming"
                ? availableTypes.length > 0  // Show "Upcoming" if any types exist (upstream filters upcoming status)
                : p.requiredTypes.some(t => availableTypes.includes(t))
            )
            .map(p => (
              <Link key={p.label} href={`/works?collection=${p.collection}`} className="mfh-pill">
                {p.label}
              </Link>
            ))
          }
        </div>
      </div>

      {/* ── Hero card stack ── */}
      <div className="mfh-slides-wrap">
        <div
          className="mfh-slides"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClickCapture={onClickCapture}
        >
          {items.map((item, i) => {
            const isActive     = i === active;

            return (
              <div
                key={item.id}
                className={`mfh-slide${isActive ? " mfh-slide--active" : ""}`}
                aria-hidden={isActive ? undefined : true}
              >
                <div className="mfh-card">

                  {/* Background link — navigates to detail page */}
                  <Link
                    href={`/works/${item.slug}`}
                    className="mfh-card-link"
                    aria-label={`View details for ${item.title}`}
                    tabIndex={isActive ? 0 : -1}
                    draggable={false}
                  />

                  {/* Poster image */}
                  <div className="mfh-img-wrap">
                    {item.heroMobileUrl ? (
                      <img
                        src={item.heroMobileUrl}
                        alt=""
                        className="mfh-img"
                        loading={i === 0 ? "eager" : "lazy"}
                        fetchPriority={i === 0 ? "high" : undefined}
                        draggable={false}
                      />
                    ) : (
                      <Image
                        src={item.posterUrl}
                        alt=""
                        fill
                        className="mfh-img"
                        sizes="(max-width: 767px) 100vw"
                        quality={88}
                        priority={i === 0}
                        draggable={false}
                      />
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="mfh-gradient" aria-hidden="true" />

                  {/* Genres + title + buttons */}
                  <div className="mfh-card-content">
                    {item.genres.length > 0 && (
                      <p className="mfh-genres">
                        {item.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}
                    <h2 className="mfh-title">{item.title}</h2>
                    <div className="mfh-actions">
                    {(() => {
                      const cta = getWorkCtaState({
                        slug: item.slug,
                        type: item.type,
                        trailerUrl: item.trailerUrl,
                        videoUrl: item.videoUrl,
                        requiresAuth: item.requiresAuth,
                        requiresLoginToViewTrailer: item.requiresLoginToViewTrailer,
                        isGuest: !isLoggedIn,
                      });
                      return (
                        <>
                          {cta.primaryLabel ? (
                            <Link href={cta.primaryHref} className="mfh-btn-play" tabIndex={isActive ? 0 : -1}>
                              <Play size={14} fill="currentColor" />
                              {cta.primaryLabel}
                            </Link>
                          ) : (
                            <Link href={`/works/${item.slug}`} className="mfh-btn-play" tabIndex={isActive ? 0 : -1}>
                              View Details
                            </Link>
                          )}
                          {cta.secondaryLabel && cta.secondaryHref && (
                            <Link
                              href={cta.secondaryHref}
                              className="mfh-btn-trailer"
                              tabIndex={isActive ? 0 : -1}
                            >
                              {cta.secondaryLabel}
                            </Link>
                          )}
                        </>
                      );
                    })()}
                      {isLoggedIn && (
                        <SaveButton
                          workId={item.id}
                          initialSaved={savedIds.includes(item.id)}
                          className="mfh-btn-save"
                        />
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}

          {/* Prev / Next arrow buttons — inside .mfh-slides at z-index 10 */}
          {count > 1 && (
            <>
              <button
                type="button"
                className="mfh-nav mfh-nav--prev"
                aria-label="Previous poster"
                onClick={() => { setActive(p => ((p - 1) + count) % count); pauseAndResume(); }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="mfh-nav mfh-nav--next"
                aria-label="Next poster"
                onClick={() => { setActive(p => (p + 1) % count); pauseAndResume(); }}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {/* Clickable dot indicators */}
        {count > 1 && (
          <div className="mfh-dots" role="tablist" aria-label="Featured works slides">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Go to slide ${i + 1} of ${count}`}
                className={`mfh-dot${i === active ? " mfh-dot--active" : ""}`}
                onClick={() => { setActive(i); pauseAndResume(); }}
              />
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
