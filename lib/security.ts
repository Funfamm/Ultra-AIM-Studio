// lib/security.ts — Security utility functions
// All logic runs server-side only. Zero client bytes.
// Raw IPs and UAs are hashed before storage — never stored raw.
import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { SecurityEventType, SecuritySeverity, DeviceType, Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// HASHING
// ─────────────────────────────────────────────

/** SHA-256 hash any string. Used for IP, UA, and device fingerprints. */
export function hashValue(raw: string): string {
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
}

/** Build a device fingerprint hash from available request signals. */
export function buildFingerprintHash(opts: {
  userAgent: string;
  acceptLanguage: string;
  country: string;
}): string {
  const raw = `${opts.userAgent}|${opts.acceptLanguage}|${opts.country}`;
  return hashValue(raw);
}

// ─────────────────────────────────────────────
// UA PARSING
// Minimal parser — no package needed.
// ─────────────────────────────────────────────

export function parseUserAgent(ua: string): {
  browser: string;
  os: string;
  deviceType: DeviceType;
} {
  const u = ua.toLowerCase();

  // Device type
  let deviceType: DeviceType = "DESKTOP";
  if (/bot|crawler|spider|crawling/i.test(ua)) deviceType = "BOT";
  else if (/mobile|iphone|android.*mobile|windows phone/i.test(ua)) deviceType = "MOBILE";
  else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) deviceType = "TABLET";

  // Browser
  let browser = "Unknown";
  if (u.includes("edg/"))           browser = "Edge";
  else if (u.includes("opr/") || u.includes("opera")) browser = "Opera";
  else if (u.includes("chrome/"))   browser = "Chrome";
  else if (u.includes("firefox/"))  browser = "Firefox";
  else if (u.includes("safari/") && !u.includes("chrome")) browser = "Safari";
  else if (u.includes("msie") || u.includes("trident")) browser = "IE";

  // Extract major version
  const versionPatterns: Record<string, RegExp> = {
    Edge:    /edg\/([\d]+)/i,
    Opera:   /(?:opr|opera)\/([\d]+)/i,
    Chrome:  /chrome\/([\d]+)/i,
    Firefox: /firefox\/([\d]+)/i,
    Safari:  /version\/([\d]+)/i,
  };
  const vRe = versionPatterns[browser];
  if (vRe) {
    const m = ua.match(vRe);
    if (m) browser = `${browser} ${m[1]}`;
  }

  // OS
  let os = "Unknown";
  if (/windows nt 10/i.test(ua))     os = "Windows 11/10";
  else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/windows/i.test(ua))      os = "Windows";
  else if (/iphone os ([\d_]+)/i.test(ua)) {
    const m = ua.match(/iphone os ([\d_]+)/i);
    os = `iOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  else if (/ipad.*os ([\d_]+)/i.test(ua)) {
    const m = ua.match(/os ([\d_]+)/i);
    os = `iPadOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  else if (/android ([\d.]+)/i.test(ua)) {
    const m = ua.match(/android ([\d.]+)/i);
    os = `Android ${m ? m[1] : ""}`;
  }
  else if (/mac os x/i.test(ua))  os = "macOS";
  else if (/linux/i.test(ua))     os = "Linux";

  return { browser, os, deviceType };
}

// ─────────────────────────────────────────────
// LOGIN ATTEMPT TRACKING
// ─────────────────────────────────────────────

export interface LoginContext {
  email: string;
  provider: string;
  success: boolean;
  failureReason?: string;
  userId?: string;
  ipHash?: string;
  userAgentHash?: string;
  country?: string;
  region?: string;
  city?: string;
}

/** Record a login attempt row. Fire-and-forget — never throws. */
export async function recordLoginAttempt(ctx: LoginContext): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email:         ctx.email.toLowerCase().trim(),
        userId:        ctx.userId ?? null,
        provider:      ctx.provider,
        success:       ctx.success,
        failureReason: ctx.failureReason ?? null,
        ipHash:        ctx.ipHash ?? null,
        userAgentHash: ctx.userAgentHash ?? null,
        country:       ctx.country ?? null,
        region:        ctx.region ?? null,
        city:          ctx.city ?? null,
      },
    });
  } catch { /* never block login flow */ }
}

// ─────────────────────────────────────────────
// RATE LIMIT CHECK
// Returns whether the email+ipHash combo is currently throttled.
// Uses AdminSettings thresholds if available; falls back to hardcoded defaults.
// ─────────────────────────────────────────────

export interface ThrottleResult {
  blocked: boolean;
  cooldownUntil?: Date;
  failureCount: number;
}

export async function checkLoginThrottle(
  email: string,
  ipHash: string | null
): Promise<ThrottleResult> {
  try {
    // Read thresholds from settings (singleton row may not exist yet)
    const settings = await prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: {
        failedLoginWindowMinutes: true,
        failedLoginMaxAttempts:   true,
        loginCooldownMinutes:     true,
      },
    });

    const windowMinutes  = settings?.failedLoginWindowMinutes ?? 15;
    const maxAttempts    = settings?.failedLoginMaxAttempts   ?? 5;
    const cooldownMinutes = settings?.loginCooldownMinutes    ?? 15;

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Count recent failures for this email
    const emailFailures = await prisma.loginAttempt.count({
      where: {
        email:     email.toLowerCase().trim(),
        success:   false,
        createdAt: { gte: windowStart },
      },
    });

    // Also count recent failures from same IP (catches credential stuffing)
    const ipFailures = ipHash
      ? await prisma.loginAttempt.count({
          where: {
            ipHash,
            success:   false,
            createdAt: { gte: windowStart },
          },
        })
      : 0;

    const failureCount = Math.max(emailFailures, ipFailures);

    if (failureCount >= maxAttempts) {
      // Find the most recent failure to compute cooldown expiry
      const lastFailure = await prisma.loginAttempt.findFirst({
        where: {
          email:     email.toLowerCase().trim(),
          success:   false,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const cooldownUntil = lastFailure
        ? new Date(lastFailure.createdAt.getTime() + cooldownMinutes * 60 * 1000)
        : new Date(Date.now() + cooldownMinutes * 60 * 1000);

      // Still in cooldown?
      if (cooldownUntil > new Date()) {
        return { blocked: true, cooldownUntil, failureCount };
      }
    }

    return { blocked: false, failureCount };
  } catch {
    // If the check fails, do not block the user — fail open
    return { blocked: false, failureCount: 0 };
  }
}

// ─────────────────────────────────────────────
// SECURITY EVENT LOG
// ─────────────────────────────────────────────

export interface SecurityEventPayload {
  userId?: string;
  actorUserId?: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  email?: string;
  ipHash?: string;
  userAgentHash?: string;
  deviceFingerprintHash?: string;
  provider?: string;
  path?: string;
  country?: string;
  region?: string;
  city?: string;
  metadata?: Record<string, unknown>;
}

/** Write a SecurityEvent row. Fire-and-forget — never throws. */
export async function writeSecurityEvent(payload: SecurityEventPayload): Promise<string | null> {
  try {
    const ev = await prisma.securityEvent.create({
      data: {
        userId:                payload.userId ?? null,
        actorUserId:           payload.actorUserId ?? null,
        type:                  payload.type,
        severity:              payload.severity,
        email:                 payload.email ?? null,
        ipHash:                payload.ipHash ?? null,
        userAgentHash:         payload.userAgentHash ?? null,
        deviceFingerprintHash: payload.deviceFingerprintHash ?? null,
        provider:              payload.provider ?? null,
        path:                  payload.path ?? null,
        country:               payload.country ?? null,
        region:                payload.region ?? null,
        city:                  payload.city ?? null,
        metadata:              payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return ev.id;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// SECURITY ALERT
// ─────────────────────────────────────────────

export interface SecurityAlertPayload {
  userId?: string;       // null = admin-level alert
  severity: SecuritySeverity;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Create a SecurityAlert row. Fire-and-forget — never throws. */
export async function createSecurityAlert(payload: SecurityAlertPayload): Promise<void> {
  try {
    await prisma.securityAlert.create({
      data: {
        userId:   payload.userId ?? null,
        severity: payload.severity,
        type:     payload.type,
        title:    payload.title,
        message:  payload.message,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch { /* never block primary flow */ }
}

// ─────────────────────────────────────────────
// DEVICE TRACKING
// ─────────────────────────────────────────────

export interface DeviceContext {
  userId: string;
  fingerprintHash: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
  country?: string;
  region?: string;
  city?: string;
}

/**
 * Upsert a UserDevice row. Returns true if this is the FIRST time
 * this fingerprint has been seen for this user (new device).
 */
export async function upsertUserDevice(ctx: DeviceContext): Promise<boolean> {
  try {
    const existing = await prisma.userDevice.findUnique({
      where: {
        userId_fingerprintHash: {
          userId: ctx.userId,
          fingerprintHash: ctx.fingerprintHash,
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Known device — update lastSeenAt only
      await prisma.userDevice.update({
        where: {
          userId_fingerprintHash: {
            userId: ctx.userId,
            fingerprintHash: ctx.fingerprintHash,
          },
        },
        data: {
          lastSeenAt: new Date(),
          country:    ctx.country ?? undefined,
          region:     ctx.region  ?? undefined,
          city:       ctx.city    ?? undefined,
        },
      });
      return false; // not a new device
    }

    // New device — create row
    await prisma.userDevice.create({
      data: {
        userId:          ctx.userId,
        fingerprintHash: ctx.fingerprintHash,
        deviceType:      ctx.deviceType,
        browser:         ctx.browser,
        os:              ctx.os,
        country:         ctx.country ?? null,
        region:          ctx.region  ?? null,
        city:            ctx.city    ?? null,
      },
    });
    return true; // new device
  } catch {
    return false; // fail safe — don't alert on error
  }
}
