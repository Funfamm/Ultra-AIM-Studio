"use client";

import { useRef, useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play, Pause, RotateCcw, RotateCw,
  Volume2, VolumeX, Volume1,
  ChevronLeft, Maximize, Minimize,
  Lock, Unlock, ListVideo, Scissors,
  Sun, Cast, Heart, X, Check,
} from "lucide-react";
import { saveWatchProgress } from "@/lib/actions/progress";
import { beacon } from "@/lib/beacon";
import { likeWork, unlikeWork } from "@/lib/actions/likes";
import NotifyMeCtaOverlay, { type CtaData } from "@/components/notify-cta-overlay";
import "./aim-player.css";

type EpSibling = {
  id: string; slug: string; title: string;
  episodeNumber: number | null; seasonNumber: number | null;
  duration: number | null; thumbnailUrl: string | null; posterUrl: string | null;
};

type Props = {
  src: string;
  poster?: string;
  workId: string;
  isTrailer?: boolean;
  workTitle: string;
  workTypeLabel: string;
  epLabel?: string | null;
  backHref: string;
  currentSlug: string;
  initialSeconds: number;
  durationMinutes?: number;
  introStart?: number | null;
  introEnd?: number | null;
  creditsStart?: number | null;
  contentRating?: string | null;
  contentDescriptors?: string[];
  nextSlug?: string | null;
  nextTitle?: string | null;
  siblings?: EpSibling[];
  siblingProgress?: Record<string, { seconds: number; completed: boolean }>;
  isGuest: boolean;
  initialLiked: boolean;
  initialLikeCount: number;
  cta?: CtaData | null;
  ctaUser?: { email: string; name: string | null };
  clipStartParam?: number | null;
  clipEndParam?: number | null;
  isClipMode?: boolean;
};

const SAVE_MS    = 10_000;
const BEACON_MS  = 30_000;
const HIDE_MS    = 3_000;
const UP_NEXT_S  = 10;
const RATING_MS  = 5_000;
const MAX_CLIP_S = 60;
const SPEEDS     = [0.75, 1, 1.25, 1.5, 2];

const DESCRIPTOR_LABELS: Record<string, string> = {
  VIOLENCE: "violence", STRONG_LANGUAGE: "language", MILD_LANGUAGE: "mild language",
  NUDITY: "nudity", SEXUAL_CONTENT: "sex", DRUG_USE: "drug use",
  ALCOHOL: "alcohol", SMOKING: "smoking", FRIGHTENING: "frightening scenes",
  THEMATIC_ELEMENTS: "thematic elements",
};

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function AimPlayer({
  src, poster, workId, isTrailer,
  workTitle, workTypeLabel, epLabel, backHref, currentSlug,
  initialSeconds, durationMinutes,
  introStart, introEnd, creditsStart,
  contentRating, contentDescriptors = [],
  nextSlug, nextTitle, siblings = [], siblingProgress = {},
  isGuest, initialLiked, initialLikeCount,
  cta, ctaUser,
  clipStartParam, clipEndParam, isClipMode,
}: Props) {
  const router      = useRouter();
  const wrapRef     = useRef<HTMLDivElement>(null);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const saveRef     = useRef(0);
  const beaconRef   = useRef(0);
  const hideRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const ratingRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStarted  = useRef(false);
  const ctaFired    = useRef(false);
  const speedRef    = useRef(1);

  // Playback state
  const [playing,     setPlaying]     = useState(false);
  const [curTime,     setCurTime]     = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [isFs,        setIsFs]        = useState(false);

  // UI state
  const [ctrlOn,      setCtrlOn]      = useState(true);
  const [locked,      setLocked]      = useState(false);
  const [brightness,  setBrightness]  = useState(100);
  const [speed,       setSpeed]       = useState(1);
  const [touchOnly,   setTouchOnly]   = useState(false);
  const [castAvail,   setCastAvail]   = useState(false);

  // Panels
  const [speedOpen,   setSpeedOpen]   = useState(false);
  const [epOpen,      setEpOpen]      = useState(false);
  const [clipOpen,    setClipOpen]    = useState(false);

  // Content
  const [skipIntro,   setSkipIntro]   = useState(false);
  const [skipCred,    setSkipCred]    = useState(false);
  const [ratingOn,    setRatingOn]    = useState(false);
  const [upNext,      setUpNext]      = useState<number | null>(null);
  const [ctaVisible,  setCtaVisible]  = useState(false);

  // Clip
  const [clipSt,    setClipSt]    = useState(0);
  const [clipEn,    setClipEn]    = useState(15);
  const [clipErr,   setClipErr]   = useState("");
  const [clipOk,    setClipOk]    = useState(false);

  // Reactions
  const [liked,     setLiked]     = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  // ── Mount: detect env, listen for fullscreen ─────────────────────────
  useEffect(() => {
    setTouchOnly(!window.matchMedia("(pointer: fine)").matches);
    const video = videoRef.current;
    if (video) setCastAvail("remote" in video);

    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // ── Controls reveal ───────────────────────────────────────────────────
  const reveal = useCallback(() => {
    setCtrlOn(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setCtrlOn(false), HIDE_MS);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.code) {
        case "Space": case "KeyK":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          reveal();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          reveal();
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          reveal();
          break;
        case "KeyM":
          v.muted = !v.muted;
          setMuted(v.muted);
          break;
        case "KeyF":
          toggleFs();
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // ── Speed menu outside click ──────────────────────────────────────────
  useEffect(() => {
    if (!speedOpen) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest?.(".aim-speed-wrap")) setSpeedOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [speedOpen]);

  // ── Helpers ───────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (locked) { setLocked(false); return; }
    v.paused ? v.play() : v.pause();
    reveal();
  }

  function seekBy(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    reveal();
  }

  function seekTo(s: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, s));
  }

  function setVol(val: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val; v.muted = val === 0;
    setVolume(val); setMuted(val === 0);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFs() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      (el.requestFullscreen?.() ?? (el as any).webkitRequestFullscreen?.())?.catch?.(() => {});
    }
  }

  function applySpeed(s: number) {
    speedRef.current = s;
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s); setSpeedOpen(false);
  }

  function save(s: number) {
    if (!isTrailer) void saveWatchProgress(workId, s, durationMinutes);
  }

  // ── Up Next countdown ─────────────────────────────────────────────────
  const startUpNext = useCallback(() => {
    if (!nextSlug) return;
    setUpNext(UP_NEXT_S);
    countRef.current = setInterval(() => {
      setUpNext((p) => {
        if (p === null || p <= 1) {
          clearInterval(countRef.current!);
          router.push(`/watch/${nextSlug}`);
          return null;
        }
        return p - 1;
      });
    }, 1000);
  }, [nextSlug, router]);

  // ── Like ──────────────────────────────────────────────────────────────
  async function handleLike() {
    if (isGuest) { router.push(`/login?from=/watch/${currentSlug}`); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await likeWork(workId);
      else await unlikeWork(workId);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  // ── Cast ──────────────────────────────────────────────────────────────
  function handleCast() {
    const v = videoRef.current;
    if (!v || !("remote" in v)) return;
    (v as any).remote.prompt().catch(() => {});
  }

  // ── Clip ─────────────────────────────────────────────────────────────
  function openClip() {
    const v = videoRef.current;
    const t = v ? Math.floor(v.currentTime) : 0;
    const dur = v ? Math.floor(v.duration || 0) : 0;
    setClipSt(t);
    setClipEn(Math.min(t + 15, dur));
    setClipErr(""); setClipOk(false);
    setClipOpen(true);
  }

  function validateClip(): string {
    if (clipSt < 0) return "Start time cannot be negative.";
    if (clipEn <= clipSt) return "End time must be after start time.";
    const v = videoRef.current;
    if (v && clipEn > Math.floor(v.duration || 0)) return "End time exceeds video length.";
    if (clipEn - clipSt > MAX_CLIP_S) return `Max clip length is ${MAX_CLIP_S}s.`;
    return "";
  }

  function buildClipUrl() {
    const base = `${window.location.origin}/watch/${currentSlug}`;
    return `${base}?clipStart=${clipSt}&clipEnd=${clipEn}`;
  }

  async function copyClipLink() {
    const err = validateClip();
    if (err) { setClipErr(err); return; }
    setClipErr("");
    try {
      await navigator.clipboard.writeText(buildClipUrl());
      setClipOk(true);
      setTimeout(() => setClipOk(false), 3000);
    } catch { setClipErr("Copy failed — please copy the URL manually."); }
  }

  async function shareClip() {
    const err = validateClip();
    if (err) { setClipErr(err); return; }
    setClipErr("");
    if ("share" in navigator) {
      try { await navigator.share({ title: workTitle, url: buildClipUrl() }); return; } catch {}
    }
    await copyClipLink();
  }

  // ── Episode groups ────────────────────────────────────────────────────
  const seasons = siblings.reduce<Map<number | null, EpSibling[]>>((acc, ep) => {
    const s = ep.seasonNumber;
    if (!acc.has(s)) acc.set(s, []);
    acc.get(s)!.push(ep);
    return acc;
  }, new Map());
  const multiSeason = seasons.size > 1;

  const seekPct = duration > 0 ? (curTime / duration) * 100 : 0;
  const volPct  = muted ? 0 : volume * 100;

  return (
    <div
      ref={wrapRef}
      className="watch-player-inner aim-player"
      onMouseMove={reveal}
      onTouchStart={reveal}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        src={src}
        className="watch-video aim-player-video"
        preload="metadata"
        playsInline
        controlsList="nodownload"
        poster={poster}
        style={brightness !== 100 ? { filter: `brightness(${brightness}%)` } : undefined}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          if (!hasStarted.current) {
            hasStarted.current = true;
            beacon(isTrailer ? "TRAILER_CLICK" : "WATCH_START", { workId });
            // Show content rating for 5s on first play
            if (contentRating || contentDescriptors.length > 0) {
              setRatingOn(true);
              ratingRef.current = setTimeout(() => setRatingOn(false), RATING_MS);
            }
          }
          const v = videoRef.current;
          if (v) v.playbackRate = speedRef.current;
        }}
        onPause={() => {
          setPlaying(false);
          save(Math.floor(videoRef.current?.currentTime ?? 0));
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (!v) return;
          setDuration(v.duration);
          const seekTarget = clipStartParam != null ? clipStartParam : initialSeconds;
          if (seekTarget > 0) v.currentTime = seekTarget;
          v.playbackRate = speedRef.current;
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          const t = v.currentTime;
          const dur = v.duration;
          setCurTime(t);

          const now = Date.now();
          if (now - saveRef.current >= SAVE_MS) { saveRef.current = now; save(Math.floor(t)); }
          if (now - beaconRef.current >= BEACON_MS && dur > 0) {
            beaconRef.current = now;
            beacon("WATCH_PROGRESS", { workId, metadata: { seconds: Math.floor(t), percent: Math.round((t / dur) * 100) } });
          }

          // Skip intro/credits windows
          setSkipIntro(!!(introStart != null && introEnd != null && t >= introStart && t < introEnd));
          setSkipCred(!!(creditsStart != null && dur > 0 && t >= creditsStart && t < dur - 2));

          // Clip end enforcement
          if (clipEndParam != null && t >= clipEndParam) {
            v.pause(); v.currentTime = clipEndParam;
          }

          // Notify Me CTA
          if (cta && !ctaFired.current && dur > 0) {
            const rem = dur - t;
            if (rem > 0 && rem <= cta.triggerSecondsFromEnd) {
              ctaFired.current = true; setCtaVisible(true);
              beacon("CTA_IMPRESSION", { workId, metadata: { ctaId: cta.id } });
            }
          }
        }}
        onVolumeChange={() => {
          const v = videoRef.current;
          if (!v) return;
          setVolume(v.volume); setMuted(v.muted);
        }}
        onEnded={() => {
          setPlaying(false);
          const v = videoRef.current;
          if (v) { save(Math.floor(v.duration)); beacon(isTrailer ? "TRAILER_CLICK" : "WATCH_COMPLETE", { workId }); }
          if (nextSlug) startUpNext();
        }}
      />

      {/* ── Clip mode badge ── */}
      {isClipMode && <div className="aim-clip-badge">Shared Clip</div>}

      {/* ── Content rating overlay (auto-fades, non-blocking) ── */}
      {(contentRating || contentDescriptors.length > 0) && (
        <div className={`aim-rating${ratingOn ? "" : " aim-rating--hidden"}`}>
          {contentRating && <div className="aim-rating-score">Rated {contentRating}</div>}
          {contentDescriptors.length > 0 && (
            <div className="aim-rating-desc">
              {contentDescriptors.map((d) => DESCRIPTOR_LABELS[d] ?? d.toLowerCase()).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* ── Skip Intro / Credits pill ── */}
      {skipIntro && (
        <button type="button" className="aim-skip-pill" onClick={() => { if (introEnd != null) seekTo(introEnd); }}>
          Skip Intro ›
        </button>
      )}
      {skipCred && !skipIntro && (
        <button type="button" className="aim-skip-pill" onClick={() => { const v = videoRef.current; if (v) v.currentTime = v.duration; }}>
          Skip Credits ›
        </button>
      )}

      {/* ── Up Next card ── */}
      {upNext !== null && nextSlug && (
        <div className="aim-up-next">
          <div className="aim-up-next-label">Up Next</div>
          {nextTitle && <div className="aim-up-next-title">{nextTitle}</div>}
          <div className="aim-up-next-bar">
            <div className="aim-up-next-fill" style={{ width: `${((UP_NEXT_S - upNext) / UP_NEXT_S) * 100}%` }} />
          </div>
          <div className="aim-up-next-actions">
            <button className="aim-up-next-play" onClick={() => router.push(`/watch/${nextSlug}`)}>Play Now</button>
            <button className="aim-up-next-cancel" onClick={() => { clearInterval(countRef.current!); setUpNext(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Episodes panel ── */}
      {siblings.length > 0 && (
        <div className={`aim-ep-panel${epOpen ? " aim-ep-panel--open" : ""}`}>
          <div className="aim-ep-panel-head">
            <span className="aim-ep-panel-label">Episodes</span>
            <button className="aim-icon-btn" onClick={() => setEpOpen(false)} aria-label="Close"><X size={16} /></button>
          </div>
          <ol className="aim-ep-list">
            {Array.from(seasons.entries()).map(([season, eps]) => (
              <Fragment key={season ?? "no-season"}>
                {multiSeason && <li className="aim-season-head">{season != null ? `Season ${season}` : "Episodes"}</li>}
                {eps.map((ep) => {
                  const isCur  = ep.slug === currentSlug;
                  const prog   = siblingProgress[ep.id];
                  const pct    = prog && ep.duration ? Math.min(100, Math.round((prog.seconds / (ep.duration * 60)) * 100)) : 0;
                  const num    = [ep.seasonNumber != null ? `S${ep.seasonNumber}` : null, ep.episodeNumber != null ? `E${ep.episodeNumber}` : null].filter(Boolean).join(" ");
                  const thumb  = ep.thumbnailUrl ?? ep.posterUrl;
                  return (
                    <li key={ep.id}>
                      {isCur ? (
                        <div className="aim-ep-item aim-ep-item--current">
                          {thumb && <div className="aim-ep-thumb"><img src={thumb} alt="" loading="lazy" /></div>}
                          <div className="aim-ep-info">
                            {num && <div className="aim-ep-num">{num} · Now Playing</div>}
                            <div className="aim-ep-title">{ep.title}</div>
                            {pct > 0 && <div className="aim-ep-prog"><div className="aim-ep-prog-fill" style={{ width: `${pct}%` }} /></div>}
                          </div>
                        </div>
                      ) : (
                        <Link href={`/watch/${ep.slug}`} className="aim-ep-item" onClick={() => setEpOpen(false)}>
                          {thumb && <div className="aim-ep-thumb"><img src={thumb} alt="" loading="lazy" /></div>}
                          <div className="aim-ep-info">
                            {num && <div className="aim-ep-num">{num}</div>}
                            <div className="aim-ep-title">{ep.title}</div>
                            {ep.duration && <div className="aim-ep-dur">{Math.floor(ep.duration / 60)}m</div>}
                            {pct > 0 && <div className="aim-ep-prog"><div className="aim-ep-prog-fill" style={{ width: `${pct}%` }} /></div>}
                          </div>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </Fragment>
            ))}
          </ol>
        </div>
      )}

      {/* ── Clip panel ── */}
      <div className={`aim-clip-panel${clipOpen ? " aim-clip-panel--open" : ""}`}>
        <div className="aim-clip-head">
          <span className="aim-clip-heading">Create Share Clip</span>
          <button className="aim-icon-btn" onClick={() => setClipOpen(false)} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="aim-clip-fields">
          <div className="aim-clip-field">
            <label className="aim-clip-label">Start (seconds)</label>
            <input type="number" className="aim-clip-input" value={clipSt} min={0}
              onChange={(e) => { setClipSt(Number(e.target.value)); setClipErr(""); }} />
          </div>
          <div className="aim-clip-field">
            <label className="aim-clip-label">End (seconds)</label>
            <input type="number" className="aim-clip-input" value={clipEn} min={0}
              onChange={(e) => { setClipEn(Number(e.target.value)); setClipErr(""); }} />
          </div>
        </div>
        {clipErr && <div className="aim-clip-error">{clipErr}</div>}
        <div className="aim-clip-actions">
          <button className="aim-clip-copy" onClick={copyClipLink}>
            {clipOk ? <><Check size={12} />Copied!</> : "Copy Link"}
          </button>
          {"share" in (typeof navigator !== "undefined" ? navigator : {}) && (
            <button className="aim-clip-share" onClick={shareClip}>Share</button>
          )}
        </div>
        <div className="aim-clip-note">Max {MAX_CLIP_S}s · Link opens on AIM Studio · No download</div>
      </div>

      {/* ── Lock overlay ── */}
      {locked && (
        <div className="aim-lock-overlay" onClick={() => setLocked(false)}>
          <div className="aim-lock-icon"><Lock size={20} /></div>
        </div>
      )}

      {/* ── Notify Me CTA ── */}
      {cta && ctaVisible && (
        <NotifyMeCtaOverlay cta={cta} onDismiss={() => setCtaVisible(false)} ctaUser={ctaUser} />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Controls overlay — always pointer-events:none on backdrop;        */}
      {/* interactive elements have pointer-events:auto via CSS             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className={`aim-player-ctrl${ctrlOn && !locked ? " aim-player-ctrl--on" : ""}`}>

        {/* ── Header ── */}
        <div className="aim-player-header">
          <Link href={backHref} className="aim-player-back" aria-label="Back" style={{ pointerEvents: "auto" }}>
            <ChevronLeft size={20} />
          </Link>
          <div className="aim-player-meta">
            <div className="aim-player-meta-label">{epLabel ? `${epLabel}  ·  ${workTypeLabel}` : workTypeLabel}</div>
            <div className="aim-player-meta-title">{workTitle}</div>
          </div>
          <div className="aim-player-header-right">
            {castAvail && (
              <button className="aim-icon-btn" onClick={handleCast} title="Cast" aria-label="Cast">
                <Cast size={17} />
              </button>
            )}
            <button
              className={`aim-icon-btn${locked ? " aim-icon-btn--on" : ""}`}
              onClick={() => setLocked((l) => !l)}
              title={locked ? "Unlock controls" : "Lock controls"}
              aria-label={locked ? "Unlock controls" : "Lock controls"}
            >
              {locked ? <Unlock size={17} /> : <Lock size={17} />}
            </button>
          </div>
        </div>

        {/* ── Center: brightness + rewind/play/forward ── */}
        <div className="aim-player-mid">
          {!touchOnly && (
            <div className="aim-player-brightness-wrap" title="Brightness">
              <Sun size={13} className="aim-brightness-icon" />
              <input
                type="range" className="aim-player-brightness"
                min={30} max={150} value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                aria-label="Brightness"
              />
            </div>
          )}

          <div className="aim-player-center-btns">
            <button className="aim-icon-btn aim-skip10" onClick={() => seekBy(-10)} aria-label="Rewind 10 seconds">
              <RotateCcw size={24} />
              <span className="aim-skip10-num">10</span>
            </button>

            <button className="aim-icon-btn aim-player-play-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing
                ? <Pause size={26} fill="currentColor" />
                : <Play  size={26} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>

            <button className="aim-icon-btn aim-skip10" onClick={() => seekBy(10)} aria-label="Forward 10 seconds">
              <RotateCw size={24} />
              <span className="aim-skip10-num">10</span>
            </button>
          </div>

          {!touchOnly && <div className="aim-mid-spacer" />}
        </div>

        {/* ── Footer: progress + controls row ── */}
        <div className="aim-player-footer">
          {/* Progress + time */}
          <div className="aim-player-progress-wrap">
            <input
              type="range" className="aim-seek"
              style={{ "--seek-pct": `${seekPct}%` } as React.CSSProperties}
              min={0} max={duration || 100} step={0.5} value={curTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label="Seek"
            />
            <span className="aim-time">{fmt(curTime)} / {fmt(duration)}</span>
          </div>

          {/* Controls row */}
          <div className="aim-controls-row">
            {/* Left side */}
            <div className="aim-controls-left">
              {/* Volume */}
              <div className="aim-vol-group">
                <button className="aim-icon-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                  {muted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                </button>
                {!touchOnly && (
                  <input
                    type="range" className="aim-vol-slider"
                    style={{ "--vol-pct": `${volPct}%` } as React.CSSProperties}
                    min={0} max={1} step={0.05} value={muted ? 0 : volume}
                    onChange={(e) => setVol(Number(e.target.value))}
                    aria-label="Volume"
                  />
                )}
              </div>

              {/* Speed */}
              <div className="aim-speed-wrap">
                <button
                  className="aim-icon-btn aim-speed-btn"
                  onClick={(e) => { e.stopPropagation(); setSpeedOpen((o) => !o); }}
                  aria-label="Playback speed"
                >
                  {speed === 1 ? "1×" : `${speed}×`}
                </button>
                {speedOpen && (
                  <div className="aim-speed-menu">
                    {SPEEDS.map((s) => (
                      <button key={s} className={`aim-speed-opt${s === speed ? " aim-speed-opt--on" : ""}`} onClick={() => applySpeed(s)}>
                        {s === 1 ? "Normal" : `${s}×`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Episodes button — series only */}
              {siblings.length > 0 && (
                <button
                  className={`aim-icon-btn${epOpen ? " aim-icon-btn--on" : ""}`}
                  onClick={() => setEpOpen((o) => !o)}
                  aria-label="Episodes"
                  title="Episodes"
                >
                  <ListVideo size={18} />
                </button>
              )}

              {/* Clip */}
              <button
                className={`aim-icon-btn${clipOpen ? " aim-icon-btn--on" : ""}`}
                onClick={openClip}
                aria-label="Create share clip"
                title="Clip"
              >
                <Scissors size={16} />
              </button>
            </div>

            {/* Right side */}
            <div className="aim-controls-right">
              {/* Like */}
              <button
                className={`aim-icon-btn${liked ? " aim-icon-btn--liked" : ""}`}
                onClick={handleLike}
                aria-label={liked ? "Unlike" : "Like"}
                title={`${likeCount} like${likeCount !== 1 ? "s" : ""}`}
              >
                <Heart size={17} fill={liked ? "currentColor" : "none"} />
              </button>

              {/* Fullscreen */}
              <button className="aim-icon-btn" onClick={toggleFs} aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}>
                {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
