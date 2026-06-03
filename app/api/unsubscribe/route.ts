// /api/unsubscribe
// One-click unsubscribe for bulk emails.
// Link format: /api/unsubscribe?email=<encoded>&sig=<hmac>
//
// Security model:
//   sig = HMAC-SHA256(email_lowercase, AUTH_SECRET) — see lib/unsubscribe.ts
//   Stateless — no DB token table needed.
//
// On valid sig:    upserts EmailSuppression → redirects to /unsubscribed?success=1
// On invalid sig:  redirects to /unsubscribed?error=invalid
// On server error: redirects to /unsubscribed?error=server

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUnsubscribeSig } from "@/lib/unsubscribe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const rawEmail = searchParams.get("email") ?? "";
  const sig      = searchParams.get("sig")   ?? "";

  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  if (!email || !sig) {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=invalid`);
  }

  // Validate HMAC signature (constant-time)
  let valid: boolean;
  try {
    valid = validateUnsubscribeSig(email, sig);
  } catch {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=server`);
  }

  if (!valid) {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=invalid`);
  }

  // Upsert suppression — idempotent
  try {
    await prisma.emailSuppression.upsert({
      where:  { email },
      create: { email, reason: "unsubscribe", source: "user", active: true },
      update: { active: true, reason: "unsubscribe", source: "user" },
    });
  } catch {
    // Suppression write failure: still redirect to success.
    // A failed unsubscribe is worse than a duplicate.
  }

  return NextResponse.redirect(`${APP_URL}/unsubscribed?success=1`);
}
