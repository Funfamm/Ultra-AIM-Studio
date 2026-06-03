"use client";

/**
 * Fires PAGE_VIEW and PAGE_LEAVE analytics events via navigator.sendBeacon.
 *
 * PAGE_VIEW  — fires on every client-side navigation (including initial load).
 * PAGE_LEAVE — fires when the user navigates away or closes the tab.
 *              metadata.durationSeconds = time spent on that page (capped at 30 min).
 *
 * Both events are non-blocking (sendBeacon is queued by the browser).
 * No mouse/keyboard tracking. No large payloads. 4G-safe.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const API = "/api/analytics";

function send(type: string, path: string, meta?: Record<string, number>) {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;
  navigator.sendBeacon(
    API,
    new Blob(
      [JSON.stringify(meta ? { type, path, metadata: meta } : { type, path })],
      { type: "application/json" }
    )
  );
}

export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPathRef  = useRef<string>("");
  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    // Skip on StrictMode double-invoke
    if (pathname === lastPathRef.current) return;

    const prevPath = lastPathRef.current;
    const now = Date.now();

    // Fire PAGE_LEAVE for the previous path before switching
    if (prevPath) {
      const dur = Math.min(Math.round((now - enteredAtRef.current) / 1000), 1800);
      if (dur >= 1) send("PAGE_LEAVE", prevPath, { durationSeconds: dur });
    }

    // Fire PAGE_VIEW for the incoming path
    send("PAGE_VIEW", pathname);
    lastPathRef.current = pathname;
    enteredAtRef.current = now;

    // Also fire PAGE_LEAVE when the tab closes or user navigates to a different domain
    function onPageHide() {
      const dur = Math.min(
        Math.round((Date.now() - enteredAtRef.current) / 1000),
        1800
      );
      if (dur >= 1) send("PAGE_LEAVE", pathname, { durationSeconds: dur });
    }

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [pathname]);

  return null;
}
