"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import HeroRotator, { type HeroItem } from "./hero-rotator";
import PageMediaVideo from "./page-media-video";
import type { PageMediaItem } from "@/lib/page-media";

export type HeroDesktopItem = HeroItem & {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
};

type Stats = { films: number; upcoming: number; openRoles: number };

type Props = {
  items:   HeroDesktopItem[];
  pageBg?: PageMediaItem | null;
  stats?:  Stats;
};

export default function HeroDesktopSection({ items, pageBg = null, stats }: Props) {
  const heroItems: HeroItem[] = items.map((item) => ({
    posterUrl:     item.posterUrl,
    title:         item.title,
    slug:          item.slug,
    heroMobileUrl: item.heroMobileUrl,
    heroDesktopUrl: item.heroDesktopUrl,
  }));

  return (
    <>
      <div className="hero-bg">
        {/* PageMedia canvas background — sits behind Work hero images */}
        {pageBg && (
          pageBg.mediaType === "VIDEO" ? (
            <PageMediaVideo
              item={pageBg}
              className="hero-pagemedia-wrap"
              mediaClassName="hero-pagemedia-bg"
            />
          ) : (
            <img
              src={pageBg.imageUrl || pageBg.posterUrl}
              alt=""
              className="hero-pagemedia-bg"
              loading="eager"
              decoding="async"
            />
          )
        )}
        <HeroRotator items={heroItems} />
        <div className="hero-bg-gradient" />
      </div>

      <div className="hero-content">
        <span className="hero-eyebrow">— Now Streaming</span>
        <h1 className="hero-title">
          Cinema for the moments<br />
          that <em className="hero-title-accent">provoke.</em>
        </h1>
        <p className="hero-desc">
          Original cinema built around story, emotion, memory, and the moments
          people refuse to look away from.
        </p>
        <div className="hero-actions">
          <Link href="/works" className="hero-btn-primary">
            <Play size={16} fill="currentColor" /> Watch the Films
          </Link>
          <Link href="/register" className="hero-btn-trailer">
            Join the Next One
          </Link>
        </div>
        {stats && (
          <div className="hero-stats">
            <span className="hero-stat">
              <strong className="hero-stat-num">{stats.films}</strong>
              <span className="hero-stat-label">Films</span>
            </span>
            <span className="hero-stat-sep" aria-hidden="true" />
            <span className="hero-stat">
              <strong className="hero-stat-num">{stats.upcoming}</strong>
              <span className="hero-stat-label">Upcoming</span>
            </span>
            <span className="hero-stat-sep" aria-hidden="true" />
            <span className="hero-stat">
              <strong className="hero-stat-num">{stats.openRoles}</strong>
              <span className="hero-stat-label">Open Roles</span>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
