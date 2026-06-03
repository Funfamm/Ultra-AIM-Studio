"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import "./action-buttons.css";

type Props = {
  title: string;
  /** slug for the work detail page (prefer series slug for episodes) */
  slug: string;
  workId: string;
  size?: "default" | "sm";
};

export default function ShareButton({ title, slug, workId, size = "default" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Canonical URL — never a raw video/storage URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const url = `${baseUrl}/works/${slug}`;

    const shareData = {
      title: `AIM Studio — ${title}`,
      text: `Watch ${title} on AIM Studio.`,
      url,
    };

    let shared = false;

    // Web Share API — native sheet on mobile
    if (
      typeof navigator !== "undefined" &&
      "share" in navigator &&
      typeof navigator.canShare === "function" &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch {
        // User cancelled or browser denied — fall through to clipboard
      }
    }

    // Clipboard fallback
    if (!shared) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        shared = true;
      } catch {
        // Clipboard denied — silent fail
      }
    }

    // Fire SHARE_WORK analytics beacon — fire-and-forget
    if (shared && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon(
        "/api/analytics",
        new Blob(
          [JSON.stringify({ type: "SHARE_WORK", path: `/works/${slug}`, metadata: { workId } })],
          { type: "application/json" }
        )
      );
    }
  }

  const cls = [
    "action-btn",
    "action-btn--share",
    size === "sm" ? "action-btn--sm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cls}
      aria-label={`Share ${title}`}
    >
      {copied ? <Check size={size === "sm" ? 13 : 14} /> : <Share2 size={size === "sm" ? 13 : 14} />}
      <span>{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
