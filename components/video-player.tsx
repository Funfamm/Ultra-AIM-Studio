"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { saveWatchProgress } from "@/lib/actions/progress";
import { beacon } from "@/lib/beacon";
import NotifyMeCtaOverlay, { type CtaData } from "./notify-cta-overlay";

type Props = {
  src: string;
  poster?: string;
  workId: string;
  initialSeconds: number;
  durationMinutes?: number;
  cta?: CtaData | null;
  ctaUser?: { email: string; name: string | null };
  introStart?: number | null;
  introEnd?: number | null;
  creditsStart?: number | null;
};

const SAVE_INTERVAL_MS   = 10_000;
const BEACON_INTERVAL_MS = 30_000;
const CONTROLS_HIDE_MS   = 3_000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({
  src, poster, workId, initialSeconds, durationMinutes,
  cta, ctaUser,
  introStart, introEnd, creditsStart,
}: Props) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const lastSaveRef     = useRef<number>(0);
  const lastBeaconRef   = useRef<number>(0);
  const hasStarted      = useRef(false);
  const ctaShownRef     = useRef(false);
  const hideControlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ctaVisible,    setCtaVisible]    = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipCred,  setShowSkipCred]  = useState(false);
  const [speed,         setSpeed]         = useState(1);
  const [speedOpen,     setSpeedOpen]     = useState(false);
  const [controlsOn,    setControlsOn]    = useState(false);

  useEffect(() => {
    if (!cta) return;
    try {
      if (localStorage.getItem(`aim_cta_signed_${cta.id}`)) ctaShownRef.current = true;
    } catch {}
  }, [cta]);

  function save(seconds: number) {
    void saveWatchProgress(workId, seconds, durationMinutes);
  }

  const revealControls = useCallback(() => {
    setControlsOn(true);
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = setTimeout(() => setControlsOn(false), CONTROLS_HIDE_MS);
  }, []);

  function skipIntro() {
    if (introEnd != null && videoRef.current) {
      videoRef.current.currentTime = introEnd;
    }
  }

  function skipCredits() {
    if (videoRef.current) videoRef.current.currentTime = videoRef.current.duration;
  }

  function applySpeed(s: number) {
    setSpeed(s);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }

  useEffect(() => {
    if (!speedOpen) return;
    const h = () => setSpeedOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [speedOpen]);

  return (
    <div
      className="watch-player-inner"
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      <video
        ref={videoRef}
        src={src}
        className="watch-video"
        preload="metadata"
        controls
        playsInline
        controlsList="nodownload"
        poster={poster}
        onPlay={() => {
          if (!hasStarted.current) {
            hasStarted.current = true;
            beacon("WATCH_START", { workId });
          }
          if (videoRef.current && videoRef.current.playbackRate !== speed) {
            videoRef.current.playbackRate = speed;
          }
        }}
        onLoadedMetadata={() => {
          if (initialSeconds > 0 && videoRef.current) {
            videoRef.current.currentTime = initialSeconds;
          }
          if (videoRef.current) videoRef.current.playbackRate = speed;
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || !video.duration) return;
          const t = video.currentTime;
          const dur = video.duration;
          const now = Date.now();

          if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
            lastSaveRef.current = now;
            save(Math.floor(t));
          }
          if (now - lastBeaconRef.current >= BEACON_INTERVAL_MS) {
            lastBeaconRef.current = now;
            beacon("WATCH_PROGRESS", { workId, metadata: { seconds: Math.floor(t), percent: Math.round((t / dur) * 100) } });
          }

          setShowSkipIntro(!!(introStart != null && introEnd != null && t >= introStart && t < introEnd));
          setShowSkipCred(!!(creditsStart != null && t >= creditsStart && t < dur - 2));

          if (cta && !ctaShownRef.current) {
            const remaining = dur - t;
            if (remaining > 0 && remaining <= cta.triggerSecondsFromEnd) {
              ctaShownRef.current = true;
              setCtaVisible(true);
              beacon("CTA_IMPRESSION", { workId, metadata: { ctaId: cta.id } });
            }
          }
        }}
        onPause={() => {
          const video = videoRef.current;
          if (video) save(Math.floor(video.currentTime));
        }}
        onEnded={() => {
          const video = videoRef.current;
          if (video) save(Math.floor(video.duration));
          beacon("WATCH_COMPLETE", { workId });
        }}
      />

      {/* Interaction-activated overlay */}
      <div className={`player-overlay${controlsOn ? " player-overlay--on" : ""}`}>
        <div className="player-overlay-bottom">
          <div className="player-speed" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="player-pill player-pill--speed"
              onClick={() => setSpeedOpen((o) => !o)}
              aria-label="Playback speed"
            >
              {speed === 1 ? "1× Speed" : `${speed}×`}
            </button>
            {speedOpen && (
              <div className="player-speed-menu">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`player-speed-opt${s === speed ? " player-speed-opt--active" : ""}`}
                    onClick={() => applySpeed(s)}
                  >
                    {s === 1 ? "Normal" : `${s}×`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="player-skip-group">
            {showSkipIntro && (
              <button type="button" className="player-pill" onClick={skipIntro}>
                Skip Intro ›
              </button>
            )}
            {showSkipCred && !showSkipIntro && (
              <button type="button" className="player-pill" onClick={skipCredits}>
                Skip Credits ›
              </button>
            )}
          </div>
        </div>
      </div>

      {cta && ctaVisible && (
        <NotifyMeCtaOverlay cta={cta} onDismiss={() => setCtaVisible(false)} ctaUser={ctaUser} />
      )}
    </div>
  );
}
