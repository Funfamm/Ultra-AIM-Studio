"use client";
import { useEffect, useState } from "react";
import type { PageMediaItem } from "@/lib/page-media";
import "./page-media.css";

interface Props {
  item:          PageMediaItem;
  className?:    string;
  mediaClassName?: string;
}

type NetworkInfo = { effectiveType?: string; saveData?: boolean };

function canPlayVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (!conn) return false;           // unknown connection → poster only
  if (conn.saveData) return false;   // explicit data-save mode
  if (conn.effectiveType !== "4g") return false; // slow-2g / 2g / 3g → poster
  return true;
}

export default function PageMediaVideo({ item, className, mediaClassName }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(canPlayVideo());
  }, []);

  if (!item.posterUrl) return null;

  const deviceClass =
    item.deviceTarget === "DESKTOP" ? "pm-desktop-only"
    : item.deviceTarget === "MOBILE"  ? "pm-mobile-only"
    : "";

  const wrapClass = [deviceClass, className].filter(Boolean).join(" ");

  return (
    <div className={wrapClass || undefined}>
      {ready && item.videoUrl ? (
        <video
          className={mediaClassName}
          src={item.videoUrl}
          poster={item.posterUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-label={item.altText || undefined}
        />
      ) : (
        <img
          src={item.posterUrl}
          alt={item.altText || ""}
          className={mediaClassName}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}
