"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import HeroRotator, { type HeroItem } from "./hero-rotator";

export type HeroDesktopItem = HeroItem & {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
};

type Props = {
  items: HeroDesktopItem[];
};

/**
 * Desktop cinematic hero (≥768px).
 *
 * Wraps HeroRotator so the CTA buttons update in sync with each rotating
 * slide. Previously the CTA was always for featuredWithPosters[0] regardless
 * of which slide was visible — causing "Watch Short" to stay on screen while
 * Grandpa's Diary (a Series) was displayed.
 */
export default function HeroDesktopSection({ items }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  const handleSlideChange = useCallback((idx: number) => {
    setActiveIdx(idx);
  }, []);

  const heroItems: HeroItem[] = items.map((item) => ({
    posterUrl: item.posterUrl,
    title: item.title,
    slug: item.slug,
    heroMobileUrl: item.heroMobileUrl,
    heroDesktopUrl: item.heroDesktopUrl,
  }));

  const current = items[activeIdx] ?? items[0];

  return (
    <>
      <div className="hero-bg">
        <HeroRotator items={heroItems} onSlideChange={handleSlideChange} />
        <div className="hero-bg-gradient" />
      </div>
      <div className="hero-content">
        <span className="hero-eyebrow">— Now Streaming</span>
        <h1 className="hero-title">Cinema, reimagined.</h1>
        <p className="hero-desc">
          Original cinema built around story, emotion, memory, and the moments people refuse to look away from.
        </p>
        <div className="hero-actions">
          {current?.primaryLabel ? (
            <Link href={current.primaryHref} className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> {current.primaryLabel}
            </Link>
          ) : (
            <Link href={`/works/${current?.slug}`} className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> View Details
            </Link>
          )}
          {current?.secondaryLabel && current?.secondaryHref && (
            <Link href={current.secondaryHref} className="hero-btn-trailer">
              {current.secondaryLabel}
            </Link>
          )}
          <Link href="/about" className="hero-btn-secondary">
            Find Your Way In
          </Link>
        </div>
      </div>
    </>
  );
}
