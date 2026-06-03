/**
 * lib/work-cta.ts
 *
 * Shared pure helper that derives the correct CTA state for any work based on
 * actual media availability — not just published status.
 *
 * Rules:
 *  - TRAILER type → the work itself IS the trailer; videoUrl is never "full film"
 *  - hasFullVideo  = type !== "TRAILER" && !!videoUrl  (or series with episodes)
 *  - hasTrailer    = !!trailerUrl
 *  - Trailer-only  → primary "Watch Trailer"; no "Watch Full Film"
 *  - Full film     → primary "Watch Full Film"; secondary "Watch Trailer" if available
 *  - Series        → primary "Watch Series" (ep 1); secondary "Watch Trailer" if available
 */

export type WorkCtaInput = {
  slug: string;
  type: string;
  trailerUrl?: string | null;
  videoUrl?: string | null;
  requiresAuth: boolean;
  requiresLoginToViewTrailer?: boolean | null;
  isGuest: boolean;
  /** First published episode slug — series only */
  firstEpisodeSlug?: string | null;
};

export type WorkCtaState = {
  hasTrailer: boolean;
  hasFullVideo: boolean;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  isLocked: boolean;
  isTrailerLocked: boolean;
};

export function getWorkCtaState(work: WorkCtaInput): WorkCtaState {
  const isSeries    = work.type === "SERIES";
  const isShort     = work.type === "SHORT_FILM";
  const isTrailer   = work.type === "TRAILER";
  const isCommercial = work.type === "COMMERCIAL";
  const isBranding  = work.type === "BRANDING";
  const isCampaign  = work.type === "CAMPAIGN";
  const isCaseStudy = work.type === "CASE_STUDY";

  // TRAILER-type works: the clip lives in videoUrl, not trailerUrl.
  // For all other types, trailerUrl is the separate preview clip.
  const hasTrailer   = !!work.trailerUrl || (isTrailer && !!work.videoUrl);
  const hasFullVideo = !isTrailer && !!work.videoUrl;
  const hasEpisodes  = !!work.firstEpisodeSlug;
  const hasPlayable  = hasFullVideo || (isSeries && hasEpisodes);

  const isLocked        = work.requiresAuth && work.isGuest;
  const isTrailerLocked = !!(work.requiresLoginToViewTrailer && work.isGuest);

  // ── Hrefs ──────────────────────────────────────────────────────────────────
  // Series trailer needs ?trailer=1 to skip the series→ep1 redirect in /watch
  const trailerHref      = isSeries
    ? `/watch/${work.slug}?trailer=1`
    : `/watch/${work.slug}`;
  const trailerLoginHref = isSeries
    ? `/login?from=/watch/${work.slug}?trailer=1`
    : `/login?from=/watch/${work.slug}`;

  const fullHref      = isSeries && hasEpisodes
    ? `/watch/${work.firstEpisodeSlug}`
    : `/watch/${work.slug}?full=1`;
  const fullLoginHref = `/login?from=${encodeURIComponent(fullHref)}`;

  // ── Primary label for works with playable video ────────────────────────────
  function playLabel(): string {
    if (isSeries)    return "Watch Series";
    if (isShort)     return "Watch Short";
    if (isCommercial) return "Watch Commercial";
    if (isBranding)  return "View Project";
    if (isCampaign)  return "View Campaign";
    if (isCaseStudy) return "View Case Study";
    return "Watch Full Film";
  }

  // ── Primary CTA ────────────────────────────────────────────────────────────
  let primaryLabel: string;
  let primaryHref:  string;

  if (hasPlayable) {
    if (isLocked) {
      primaryLabel = "Sign In to Watch";
      primaryHref  = fullLoginHref;
    } else {
      primaryLabel = playLabel();
      primaryHref  = fullHref;
    }
  } else if (hasTrailer) {
    if (isTrailerLocked) {
      primaryLabel = "Sign In to Watch Trailer";
      primaryHref  = trailerLoginHref;
    } else {
      primaryLabel = "Watch Trailer";
      primaryHref  = trailerHref;
    }
  } else {
    primaryLabel = "";
    primaryHref  = `/works/${work.slug}`;
  }

  // ── Secondary CTA (trailer) — only when full content also exists ───────────
  let secondaryLabel: string | null = null;
  let secondaryHref:  string | null = null;

  if (hasPlayable && hasTrailer) {
    if (isTrailerLocked) {
      secondaryLabel = "Sign In to Watch Trailer";
      secondaryHref  = trailerLoginHref;
    } else {
      secondaryLabel = "Watch Trailer";
      secondaryHref  = trailerHref;
    }
  }

  return {
    hasTrailer,
    hasFullVideo,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref,
    isLocked,
    isTrailerLocked,
  };
}
