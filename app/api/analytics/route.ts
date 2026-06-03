// Analytics beacon endpoint.
// Receives POST events from navigator.sendBeacon on every page navigation.
// Always returns 204 — beacons are fire-and-forget; errors must be silent.
//
// Security:
//   - visitorId is read from the HttpOnly aim-vid cookie (not from the payload)
//   - Bot traffic is rejected before writing to the DB
//   - Payloads over 2 KB are rejected
//   - event type is validated against the enum allowlist
//
// Performance:
//   - Session lastSeenAt update is fire-and-forget (non-blocking)
//   - No heavy computation on the hot path

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trackEvent, getOrCreateSession, parseUserAgent } from "@/lib/analytics";
import type { AnalyticsEventType, Prisma } from "@prisma/client";

const VALID_TYPES = new Set<string>([
  "PAGE_VIEW", "PAGE_LEAVE",                          // navigation / dwell
  "WORK_VIEW", "TRAILER_CLICK",
  "WATCH_START", "WATCH_PROGRESS", "WATCH_COMPLETE",
  "EPISODE_START", "EPISODE_COMPLETE",
  "SIGN_IN", "SIGN_UP", "SIGN_OUT",
  "SAVE_WORK", "UNSAVE_WORK",
  "NOTIFICATION_OPEN", "SETTINGS_UPDATE",
  "CTA_IMPRESSION", "CTA_SIGNUP",                     // notify-me CTA
  "PAGE_LEAVE",                                        // page dwell duration
  "LIKE_WORK", "UNLIKE_WORK",                         // likes
  "SHARE_WORK",                                        // share
]);

export async function POST(request: NextRequest) {
  try {
    // Reject oversized payloads before reading body
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 2048) return new NextResponse(null, { status: 204 });

    // Parse body — any parse failure is silent
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return new NextResponse(null, { status: 204 });

    const { type, path, workId, metadata } = body as Record<string, unknown>;

    // Validate event type against the allowlist
    if (!type || !VALID_TYPES.has(String(type))) return new NextResponse(null, { status: 204 });

    // visitorId is read server-side from the HttpOnly cookie — never trusted from the payload
    const visitorId = request.cookies.get("aim-vid")?.value;
    if (!visitorId) return new NextResponse(null, { status: 204 });

    // Parse device/browser/OS from UA — no raw UA stored
    const ua = request.headers.get("user-agent") ?? "";
    const { browser, os, deviceType } = parseUserAgent(ua);

    // Drop bot traffic silently
    if (deviceType === "BOT") return new NextResponse(null, { status: 204 });

    // Geo from Vercel edge headers — no IP address is read or stored
    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const region  = request.headers.get("x-vercel-ip-region")  ?? undefined;
    const city    = request.headers.get("x-vercel-ip-city")    ?? undefined;

    // Resolve userId from JWT (decode only — no DB query)
    const session = await auth();
    const userId  = session?.user?.id ?? undefined;

    // Find or start a visitor session — userId links the session to a member account
    const sessionId = await getOrCreateSession({
      visitorId,
      userId,
      landingPage: typeof path === "string" ? path.slice(0, 512) : undefined,
      referrer:    request.headers.get("referer")?.slice(0, 512) ?? undefined,
      country, region, city,
      browser, os, deviceType,
      isBot: false,
    });

    // Write the event
    await trackEvent({
      visitorId,
      userId,
      sessionId,
      type: type as AnalyticsEventType,
      path:     typeof path   === "string" ? path.slice(0, 512)   : null,
      workId:   typeof workId === "string" ? workId               : null,
      metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Prisma.InputJsonValue)
        : null,
    });
  } catch {
    // Always swallow — beacons must never surface errors to the client
  }

  return new NextResponse(null, { status: 204 });
}
