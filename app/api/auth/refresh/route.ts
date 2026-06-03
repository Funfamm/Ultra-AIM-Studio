/**
 * GET /api/auth/refresh
 *
 * Triggers an access-token renewal cycle for the current session.
 * Client components call this when they detect a stale session (e.g., after
 * 15 minutes of inactivity with a tab open) to silently refresh without
 * forcing the user back to /login.
 *
 * Flow:
 *   1. auth() decodes the JWT and calls the jwt() callback (Node.js runtime).
 *   2. jwt() checks accessTokenExpires — if past, it validates the refresh
 *      token in the DB, rotates it, and returns an updated token.
 *   3. Because updateAge: 0 is set in NextAuth config, Auth.js always
 *      writes the refreshed token back via Set-Cookie in this response.
 *   4. The client receives 200 + the new cookie; subsequent auth() calls
 *      get a fresh 15-minute window.
 *
 * Returns 401 when:
 *   - No session cookie present.
 *   - User has been purged, suspended, or deactivated.
 *   - All refresh tokens have expired (30-day session limit reached).
 *   - TokenVersion mismatch (admin revoked the session).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  return NextResponse.json({
    ok:     true,
    userId: session.user.id,
    role:   session.user.role,
  });
}
