// lib/onboarding/welcome.ts
// Welcome flow — runs once per user account on first login/registration.
//
// ensureWelcomeForUser(userId):
//   1. Loads user + welcome timestamps.
//   2. Sends welcome email via Microsoft Graph if not yet sent.
//   3. Creates in-app welcome notification (type: ACCOUNT) if not yet created.
//   4. Stamps welcomeEmailSentAt and welcomeNotificationSentAt.
//   5. Never throws — never blocks auth flow.
//   6. Idempotent — safe to call multiple times.
//
// Provider notes:
//   - Email: Microsoft Graph (transactional, not ACS bulk).
//   - Notification: direct Prisma insert (not createBulkInAppNotification — single user).
//   - Both paths are fire-and-forget from the auth callback perspective.

import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Ensure the welcome email and welcome notification have been sent exactly once
 * for this user. Safe to call on every sign-in — idempotent checks prevent
 * duplicate sends.
 *
 * Never throws — all errors are caught and swallowed so auth is never blocked.
 */
export async function ensureWelcomeForUser(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id:                        true,
        email:                     true,
        name:                      true,
        welcomeEmailSentAt:        true,
        welcomeNotificationSentAt: true,
      },
    });

    if (!user) {
      console.log(`[welcome] user ${userId} not found — skipping`);
      return;
    }

    const stampData: {
      welcomeEmailSentAt?:        Date;
      welcomeNotificationSentAt?: Date;
    } = {};

    // ── Welcome email ─────────────────────────────────────────
    if (!user.welcomeEmailSentAt) {
      try {
        console.log(`[welcome] sending welcome email to ${user.email} (userId: ${user.id})`);
        // sendWelcomeEmail uses Microsoft Graph — transactional, not ACS bulk.
        // Logs attempt in EmailLog internally.
        await sendWelcomeEmail(user.email, user.name);
        stampData.welcomeEmailSentAt = new Date();
        console.log(`[welcome] welcome email sent successfully to ${user.email}`);
      } catch (err) {
        // Email failure must never block auth or notification creation.
        // No stamp written — next call will retry (acceptable for first-login).
        console.error(`[welcome] welcome email FAILED for ${user.email}:`, err);
      }
    } else {
      console.log(`[welcome] email already sent for ${user.email} at ${user.welcomeEmailSentAt.toISOString()}`);
    }

    // ── Welcome in-app notification ───────────────────────────
    if (!user.welcomeNotificationSentAt) {
      try {
        console.log(`[welcome] creating in-app notification for ${user.email}`);
        await prisma.notification.create({
          data: {
            userId: user.id,
            type:   "ACCOUNT",
            title:  "Welcome to AIM Studio",
            body:   "Start watching, save your favorite works, and continue where you left off.",
            href:   `${APP_URL}/works`,
            read:   false,
          },
        });
        stampData.welcomeNotificationSentAt = new Date();
        console.log(`[welcome] in-app notification created for ${user.email}`);
      } catch (err) {
        // Notification failure must never block auth.
        console.error(`[welcome] notification FAILED for ${user.email}:`, err);
      }
    } else {
      console.log(`[welcome] notification already sent for ${user.email} at ${user.welcomeNotificationSentAt.toISOString()}`);
    }

    // ── Stamp timestamps ──────────────────────────────────────
    if (Object.keys(stampData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data:  stampData,
      }).catch((err) => {
        console.error(`[welcome] stamp update FAILED for ${user.email}:`, err);
      });
      // Stamp failure is non-fatal — worst case: welcome sends again on next login.
      // In practice Prisma updates rarely fail after a successful notification insert.
    }
  } catch (err) {
    // Outer catch: any unexpected error is swallowed — auth must never be blocked.
    console.error(`[welcome] unexpected error for userId ${userId}:`, err);
  }
}
