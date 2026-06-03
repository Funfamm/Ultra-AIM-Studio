"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import "./hero-rotator.css";

export type HeroItem = {
  posterUrl: string;
  title: string;
  slug: string;
  heroMobileUrl?: string | null;
  heroDesktopUrl?: string | null;
};

type Props = {
  items: HeroItem[];
  interval?: number; // ms between slides, default 4s
  onSlideChange?: (index: number) => void;
};

export default function HeroRotator({ items, interval = 4000, onSlideChange }: Props) {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notify parent when active slide changes
  useEffect(() => {
    onSlideChange?.(active);
  }, [active, onSlideChange]);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timer.current = setInterval(() => {
      setActive((i) => (i + 1) % items.length);
    }, interval);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [items.length, interval]);

  if (!items.length) return null;

  return (
    <div className="hr-stack">
      {items.map((item, i) => {
        const isActive = i === active;
        const hasArtDirection = !!(item.heroDesktopUrl || item.heroMobileUrl);

        return (
          <div
            key={i}
            className="hr-slide"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            <Link
              href={`/works/${item.slug}`}
              className="hr-slide-link"
              aria-label={`View details for ${item.title}`}
              tabIndex={isActive ? 0 : -1}
            >
              {hasArtDirection ? (
                /* Native <picture> for 4G-safe art direction —
                   browser downloads only the source that matches the viewport */
                <picture className="hr-picture">
                  {item.heroDesktopUrl && (
                    <source media="(min-width: 768px)" srcSet={item.heroDesktopUrl} />
                  )}
                  {/* Mobile: heroMobileUrl if set, else posterUrl */}
                  <img
                    src={item.heroMobileUrl ?? item.posterUrl}
                    alt=""
                    className="hr-img-native"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                  />
                </picture>
              ) : (
                /* No art direction: use next/image for optimization */
                <Image
                  src={item.posterUrl}
                  alt=""
                  fill
                  className="hr-img"
                  sizes="100vw"
                  quality={85}
                  priority={i === 0}
                />
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
