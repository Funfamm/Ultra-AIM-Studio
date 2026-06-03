// Auth.js v5 (NextAuth) configuration
// Strategy: JWT (required for credentials provider)
// Providers: Credentials + Google OAuth
//
// Security additions:
//  - Login attempt tracking (LoginAttempt table)
//  - Rate limiting via checkLoginThrottle()
//  - lastLoginAt / lastLoginProvider updated on success
//  - Device fingerprint upserted on success (new device → alert)
//  - SecurityEvent written for every significant outcome

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
// Security utilities are dynamically imported inside callbacks to avoid
// bundling node:crypto into the Edge runtime (used by middleware for JWT only).
import { sendSecurityAlertEmail } from "@/lib/email";
import { ensureWelcomeForUser } from "@/lib/onboarding/welcome";

// Helper — extract raw request headers (no hashing — done in callbacks after dynamic import)
function extractRawContext(request?: Request) {
  const ua      = request?.headers.get("user-agent")          ?? "";
  const lang    = request?.headers.get("accept-language")     ?? "";
  const country = request?.headers.get("x-vercel-ip-country") ?? "";
  const region  = request?.headers.get("x-vercel-ip-region")  ?? "";
  const city    = request?.headers.get("x-vercel-ip-city")    ?? "";
  const ip      = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return { ua, lang, country, region, city, ip };
}

// Access token: 15-minute window before a DB re-validation is required.
// Refresh token: 30-day lifetime; rotated on every renewal; SHA-256 hash only in DB.
const ACCESS_TOKEN_TTL   = 15 * 60 * 1000;            // 15 min in ms
const REFRESH_TOKEN_TTL  = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy:  "jwt",
    // updateAge: 0 — always persist the rotated token back into the cookie.
    // Without this, Auth.js may withhold the Set-Cookie for up to 24 hours,
    // so new accessTokenExpires / rotated refresh token would be lost.
    updateAge: 0,
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  providers: [
    // allowDangerousEmailAccountLinking: when a Google email matches an existing
    // credentials user, the adapter links the Google account to that user instead
    // of blocking. Google verifies email ownership, so this is safe.
    Google({ allowDangerousEmailAccountLinking: true }),

    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email    = (credentials?.email    as string | undefined)?.toLowerCase().trim() ?? "";
        const password = (credentials?.password as string | undefined) ?? "";

        if (!email || !password) return null;

        const raw = extractRawContext(request as Request | undefined);

        // Dynamic import keeps node:crypto out of the Edge bundle
        const sec = await import("@/lib/security");

        const ipHash        = raw.ip ? sec.hashValue(raw.ip)  : undefined;
        const userAgentHash = raw.ua ? sec.hashValue(raw.ua)  : undefined;
        const fpHash        = raw.ua
          ? sec.buildFingerprintHash({ userAgent: raw.ua, acceptLanguage: raw.lang, country: raw.country })
          : undefined;
        const parsed = sec.parseUserAgent(raw.ua);

        // ── Rate limit check ───────────────────────────────────
        const throttle = await sec.checkLoginThrottle(email, ipHash ?? null);
        if (throttle.blocked) {
          void sec.recordLoginAttempt({
            email, provider: "credentials", success: false, failureReason: "BLOCKED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          void sec.writeSecurityEvent({
            type: "LOGIN_BLOCKED", severity: "HIGH",
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
            metadata: { failureCount: throttle.failureCount },
          });
          return null;
        }

        // ── User lookup ────────────────────────────────────────
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) {
          void sec.recordLoginAttempt({
            email, provider: "credentials", success: false, failureReason: "USER_NOT_FOUND",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          void sec.writeSecurityEvent({
            type: "LOGIN_FAILED", severity: "LOW",
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }

        // ── Password check ─────────────────────────────────────
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "INVALID_PASSWORD",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });

          const newFailureCount = throttle.failureCount + 1;
          const severity = newFailureCount >= 8 ? "HIGH" : newFailureCount >= 4 ? "MEDIUM" : "LOW";
          void sec.writeSecurityEvent({
            userId: user.id, type: "LOGIN_FAILED", severity,
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
            metadata: { failureCount: newFailureCount },
          });

          if (newFailureCount >= 4) {
            void sec.createSecurityAlert({
              userId: user.id, severity: "MEDIUM", type: "LOGIN_FAILED",
              title: "Multiple failed sign-in attempts",
              message: `We detected ${newFailureCount} failed sign-in attempts on your account. If this was not you, reset your password.`,
              metadata: { email, country: raw.country },
            });
            void sendSecurityAlertEmail({
              to:          user.email,
              title:       "Multiple failed sign-in attempts",
              body:        `We noticed ${newFailureCount} failed attempts to sign in to your AIM Studio account${raw.country ? ` from ${raw.country}` : ""}. If this was not you, reset your password immediately.`,
              actionUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/forgot-password`,
              actionLabel: "Reset Password",
            }).catch(() => {});
          }
          return null;
        }

        // ── Status check ───────────────────────────────────────
        if (user.status === "SUSPENDED") {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "SUSPENDED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }
        if (user.status === "DEACTIVATED" || user.status === "DELETED") {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "DEACTIVATED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }

        // ── Success ────────────────────────────────────────────
        void sec.recordLoginAttempt({
          email, userId: user.id, provider: "credentials", success: true,
          ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
        });
        void prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date(), lastLoginProvider: "credentials" },
        }).catch(() => {});
        void sec.writeSecurityEvent({
          userId: user.id, type: "CREDENTIALS_SIGN_IN", severity: "INFO",
          email, provider: "credentials",
          ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
        });

        // Device fingerprint — new-device detection
        if (fpHash) {
          void (async () => {
            try {
              const isNew = await sec.upsertUserDevice({
                userId: user.id, fingerprintHash: fpHash,
                browser: parsed.browser, os: parsed.os, deviceType: parsed.deviceType,
                country: raw.country, region: raw.region, city: raw.city,
              });
              if (isNew) {
                void sec.writeSecurityEvent({
                  userId: user.id, type: "NEW_DEVICE_LOGIN", severity: "MEDIUM",
                  email, provider: "credentials",
                  ipHash, userAgentHash, deviceFingerprintHash: fpHash,
                  country: raw.country, region: raw.region, city: raw.city,
                  metadata: { browser: parsed.browser, os: parsed.os },
                });
                void sec.createSecurityAlert({
                  userId: user.id, severity: "MEDIUM", type: "NEW_DEVICE_LOGIN",
                  title: "New device sign-in",
                  message: `Your account was accessed from a new device (${parsed.browser}, ${parsed.os})${raw.country ? ` in ${raw.country}` : ""}.`,
                  metadata: { browser: parsed.browser, os: parsed.os, country: raw.country },
                });
                void sendSecurityAlertEmail({
                  to:    user.email,
                  title: "New device sign-in",
                  body:  `We noticed a sign-in to your AIM Studio account from a new device — ${parsed.browser} on ${parsed.os}${raw.country ? `, ${raw.country}` : ""}.`,
                }).catch(() => {});
              }
            } catch { /* device tracking must never block auth */ }
          })();
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role, tokenVersion: user.tokenVersion };
      },
    }),
  ],

  callbacks: {
    // ── signIn callback ──────────────────────────────────────────────────────
    // Runs for all providers after credentials are validated / OAuth token exchanged.
    //
    // Google OAuth: status check, lastLoginAt, security events, welcome flow.
    //
    // Credentials: welcome-flow backstop only.  registerUser() also fires it via
    // void, but that promise may be cut short when signIn() throws NEXT_REDIRECT
    // before the async welcome completes (Vercel serverless function exits on
    // redirect).  Calling it here is inside the auth flow, so it always finishes.
    // ensureWelcomeForUser is idempotent — safe to call twice on first registration;
    // for returning users it exits immediately after a single findUnique check.
    async signIn({ user, account }) {
      // ── Credentials backstop — awaited so Vercel does not exit before send ──
      if (account?.provider === "credentials" && user.id) {
        await ensureWelcomeForUser(user.id);
      }

      if (account?.provider === "google" && user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          // lastLoginAt fetched BEFORE the update below so we can detect first login.
          select: { status: true, email: true, id: true, lastLoginAt: true },
        });
        if (
          dbUser?.status === "SUSPENDED" ||
          dbUser?.status === "DEACTIVATED" ||
          dbUser?.status === "DELETED"
        ) return false;

        if (dbUser) {
          void prisma.user.update({
            where: { id: dbUser.id },
            data:  { lastLoginAt: new Date(), lastLoginProvider: "google" },
          }).catch(() => {});

          // Welcome flow — awaited so Vercel serverless does not exit before it
          // completes. Previously fired as void and was abandoned before the email
          // sent (Vercel exits after return true). ensureWelcomeForUser never
          // throws — all errors are swallowed internally.
          await ensureWelcomeForUser(dbUser.id);

          // Dynamic import — security utilities are server-only
          void import("@/lib/security").then(async (sec) => {
            void sec.writeSecurityEvent({
              userId: dbUser.id, type: "GOOGLE_SIGN_IN", severity: "INFO",
              email: dbUser.email, provider: "google",
            });
            const isNew = await sec.upsertUserDevice({
              userId:          dbUser.id,
              fingerprintHash: sec.hashValue(`google|${dbUser.id}|oauth`),
              browser:         "Google OAuth",
              os:              "Unknown",
              deviceType:      "UNKNOWN",
            });
            // Only alert when it is a genuinely new device AND the user has
            // logged in before — first registration must never trigger alerts.
            const isGoogleFirstLogin = !dbUser.lastLoginAt;
            if (isNew && !isGoogleFirstLogin) {
              void sec.writeSecurityEvent({
                userId: dbUser.id, type: "NEW_DEVICE_LOGIN", severity: "LOW",
                email: dbUser.email, provider: "google",
                metadata: { note: "Google OAuth — full device details unavailable at callback" },
              });
            }
          }).catch(() => {});
        }
      }
      return true;
    },

    // ── JWT callback — 15-minute access-token rotation ────────────────────
    //
    // On sign-in:   generate a refresh token (SHA-256 hash stored in DB),
    //               set accessTokenExpires = now + 15 min.
    //
    // Fast path:    if accessTokenExpires is still in the future, return token
    //               as-is — no DB round-trip.
    //
    // Renewal path: when accessTokenExpires has passed (or is absent on legacy
    //               sessions), hit the DB to verify the user is still active,
    //               tokenVersion matches, and a valid refresh token exists.
    //               Rotate the refresh token in the same DB transaction and
    //               reset accessTokenExpires.  Return null on any failure —
    //               Auth.js clears the session cookie immediately.
    //
    // Edge runtime: skipped entirely — Prisma is unavailable. Middleware never
    //               needs session validity beyond what the signed JWT asserts.
    async jwt({ token, user, account }) {
      if (user) {
        // ── Initial sign-in ──────────────────────────────────────
        token.id = user.id;
        if (account?.type === "oauth") {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id! },
            select: { role: true, tokenVersion: true },
          });
          token.role         = dbUser?.role         ?? "USER";
          token.tokenVersion = dbUser?.tokenVersion ?? 0;
        } else {
          token.role         = (user as { role?: string }).role ?? "USER";
          token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        }

        // Issue refresh token — failure is non-fatal (falls back to full DB check)
        // crypto.randomUUID() is a global in Node.js 19+ and Edge runtimes.
        // hashValue() is dynamically imported from @/lib/security (already the
        // established pattern in this file) to avoid bundling node:crypto into Edge.
        try {
          const { hashValue } = await import("@/lib/security");
          const raw  = crypto.randomUUID();
          const hash = hashValue(raw);
          await prisma.refreshToken.create({
            data: {
              userId:    token.id as string,
              tokenHash: hash,
              expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
            },
          });
          token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL;
        } catch {
          token.accessTokenExpires = 0; // force renewal check on first request
        }

      } else if (token?.id) {
        // ── Subsequent requests ──────────────────────────────────
        // Skipped in Edge runtime (middleware) — Prisma unavailable there.
        if (process.env.NEXT_RUNTIME !== "edge") {
          const accessExpires = token.accessTokenExpires as number | undefined;

          // ── Fast path: access token still fresh ─────────────────
          if (accessExpires && accessExpires > Date.now()) {
            return token;
          }

          // ── Renewal path: access token expired ──────────────────
          try {
            const dbUser = await prisma.user.findUnique({
              where:  { id: token.id as string },
              select: { id: true, role: true, tokenVersion: true, status: true },
            });

            // User deleted from DB
            if (!dbUser) {
              await prisma.refreshToken.deleteMany({ where: { userId: token.id as string } }).catch(() => {});
              return null;
            }

            // User suspended or deactivated
            if (
              dbUser.status === "SUSPENDED" ||
              dbUser.status === "DEACTIVATED" ||
              dbUser.status === "DELETED"
            ) {
              await prisma.refreshToken.deleteMany({ where: { userId: dbUser.id } }).catch(() => {});
              return null;
            }

            // TokenVersion revoked (admin suspended / role-changed user)
            if (dbUser.tokenVersion !== (token.tokenVersion as number ?? 0)) {
              await prisma.refreshToken.deleteMany({ where: { userId: dbUser.id } }).catch(() => {});
              return null;
            }

            // Find the most-recent valid refresh token for this user
            const refreshRec = await prisma.refreshToken.findFirst({
              where:   { userId: dbUser.id, expiresAt: { gt: new Date() } },
              orderBy: { createdAt: "desc" },
            });

            // No valid refresh token — session fully expired
            if (!refreshRec) return null;

            // Rotate: delete the used token, create a fresh one
            const { hashValue } = await import("@/lib/security");
            const newRaw  = crypto.randomUUID();
            const newHash = hashValue(newRaw);
            await prisma.$transaction([
              prisma.refreshToken.delete({ where: { id: refreshRec.id } }),
              prisma.refreshToken.create({
                data: {
                  userId:    dbUser.id,
                  tokenHash: newHash,
                  expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
                },
              }),
            ]);

            // Sync token claims with current DB state
            token.role               = dbUser.role;
            token.tokenVersion       = dbUser.tokenVersion;
            token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL;

          } catch {
            // DB temporarily unreachable — extend grace period rather than
            // locking everyone out due to infrastructure issues.
            token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL;
          }
        }
      }
      return token;
    },

    // Expose role and id in the client-side session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  events: {
    // On explicit sign-out, delete all refresh tokens so the session
    // cannot be renewed — even if the signed cookie is somehow replayed.
    // The signOut event delivers { token } for JWT strategy and { session }
    // for database strategy; we narrow the union before accessing token.id.
    async signOut(message) {
      const tok    = "token" in message ? message.token : null;
      const userId = (tok as { id?: string } | null)?.id;
      if (userId) {
        await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
      }
    },
  },
});
