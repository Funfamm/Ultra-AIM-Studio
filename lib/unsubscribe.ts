// lib/unsubscribe.ts
// Stateless HMAC-based unsubscribe link generation and validation.
// The route handler at /api/unsubscribe validates incoming links.
// This module is the shared source of truth for both sides.

import { createHmac, timingSafeEqual } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not configured");
  return s;
}

// Build HMAC-SHA256 signature for the given email.
// sig = HMAC-SHA256(normalized_email, AUTH_SECRET)
export function buildUnsubscribeSig(email: string): string {
  return createHmac("sha256", secret()).update(email).digest("hex");
}

// Build the full one-click unsubscribe URL for insertion into bulk email.
export function buildUnsubscribeUrl(email: string): string {
  const norm    = email.toLowerCase().trim();
  const sig     = buildUnsubscribeSig(norm);
  const encoded = encodeURIComponent(norm);
  return `${APP_URL}/api/unsubscribe?email=${encoded}&sig=${sig}`;
}

// Build the manage-preferences URL (always available as an alternative).
export function buildPreferencesUrl(): string {
  return `${APP_URL}/dashboard/settings#notifications`;
}

// Validate a sig received by the route handler.
// Constant-time comparison to prevent timing attacks.
export function validateUnsubscribeSig(email: string, sig: string): boolean {
  try {
    const expected = buildUnsubscribeSig(email);
    const eBuf = Buffer.from(expected, "hex");
    const sBuf = Buffer.from(sig, "hex");
    if (eBuf.length !== sBuf.length) return false;
    return timingSafeEqual(eBuf, sBuf);
  } catch {
    return false;
  }
}
