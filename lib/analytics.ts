// Analytics helpers — server-side only.
// Never import this in a "use client" component.

import { prisma } from "@/lib/prisma";
import type { AnalyticsEventType, DeviceType, Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// UA PARSER
// No external library. Covers the major browsers, OS, and device classes.
// Returns only human-readable strings — raw UA is never stored.
// ─────────────────────────────────────────────

export function parseUserAgent(ua: string): {
  browser: string;
  os: string;
  deviceType: DeviceType;
} {
  if (!ua) return { browser: "Unknown", os: "Unknown", deviceType: "UNKNOWN" };

  // Bot detection — check before anything else
  if (/bot|crawl|spider|slurp|preview|fetch|curl|wget|python|axios|http-client/i.test(ua)) {
    return { browser: "Bot", os: "Bot", deviceType: "BOT" };
  }

  // Device type
  let deviceType: DeviceType = "DESKTOP";
  if (/tablet|ipad/i.test(ua)) deviceType = "TABLET";
  else if (/mobile|android.*mobile|iphone|ipod/i.test(ua)) deviceType = "MOBILE";

  // Browser — check Edge before Chrome (Edge UA contains "Chrome")
  let browser = "Other";
  const edgeM   = ua.match(/edg(?:e|a|ios)?\/(\d+)/i);
  const chromeM = ua.match(/chrome\/(\d+)/i);
  const ffM     = ua.match(/firefox\/(\d+)/i);
  const safVerM = ua.match(/version\/(\d+)/i);
  if (edgeM)                               browser = `Edge ${edgeM[1]}`;
  else if (chromeM)                        browser = `Chrome ${chromeM[1]}`;
  else if (ffM)                            browser = `Firefox ${ffM[1]}`;
  else if (safVerM && /safari/i.test(ua)) browser = `Safari ${safVerM[1]}`;

  // OS
  let os = "Other";
  const iosM     = ua.match(/(?:cpu iphone os|cpu os|iphone os) (\d+)/i);
  const androidM = ua.match(/android (\d+)/i);
  if (/windows nt/i.test(ua))        os = "Windows";
  else if (/ipad/i.test(ua) && iosM) os = `iPadOS ${iosM[1]}`;
  else if (iosM)                      os = `iOS ${iosM[1]}`;
  else if (androidM)                  os = `Android ${androidM[1]}`;
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua))         os = "Linux";

  return { browser, os, deviceType };
}

// ─────────────────────────────────────────────
// VISITOR SESSION
// A session is a continuous browsing window. Inactivity > 30 min = new session.
// ─────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export async function getOrCreateSession(opts: {
  visitorId: string;
  userId?: string;       // populated for logged-in users; links session to member
  landingPage?: string;
  referrer?: string;
  country?: string;
  region?: string;
  city?: string;
  browser?: string;
  os?: string;
  deviceType?: DeviceType;
  isBot?: boolean;
}): Promise<string> {
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);

  // Look for an active session within the timeout window
  const existing = await prisma.visitorSession.findFirst({
    where: { visitorId: opts.visitorId, lastSeenAt: { gte: cutoff } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    // Touch lastSeenAt and userId (covers login-after-visit: guest → member).
    // Only set userId if provided so we never accidentally clear an existing link.
    // Fire-and-forget so it never delays the response.
    prisma.visitorSession
      .update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          ...(opts.userId ? { userId: opts.userId } : {}),
        },
      })
      .catch(() => {});
    return existing.id;
  }

  // Start a new session
  const created = await prisma.visitorSession.create({
    data: {
      visitorId:   opts.visitorId,
      userId:      opts.userId,
      landingPage: opts.landingPage,
      referrer:    opts.referrer,
      country:     opts.country,
      region:      opts.region,
      city:        opts.city,
      browser:     opts.browser,
      os:          opts.os,
      deviceType:  opts.deviceType ?? "UNKNOWN",
      isBot:       opts.isBot ?? false,
    },
    select: { id: true },
  });

  return created.id;
}

// ─────────────────────────────────────────────
// TRACK EVENT
// The single write point for all analytics events.
// Never throws — analytics must never break the application.
// ─────────────────────────────────────────────

export async function trackEvent(opts: {
  visitorId: string;
  userId?: string | null;
  sessionId?: string | null;
  type: AnalyticsEventType;
  path?: string | null;
  workId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        visitorId: opts.visitorId,
        userId:    opts.userId    ?? undefined,
        sessionId: opts.sessionId ?? undefined,
        type:      opts.type,
        path:      opts.path      ?? undefined,
        workId:    opts.workId    ?? undefined,
        metadata:  opts.metadata != null ? opts.metadata : undefined,
      },
    });
  } catch {
    // Swallow silently — analytics must never crash the app
  }
}
