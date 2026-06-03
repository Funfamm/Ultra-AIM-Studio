// Route protection middleware
// Runs on every request BEFORE the page renders.
// Also sets the anonymous visitor cookie (aim-vid) used by analytics.

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const path = nextUrl.pathname;

  // ── Route guards — compute response first ───────────────────
  let response: NextResponse;

  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      response = NextResponse.redirect(new URL("/login?from=admin", nextUrl));
    } else if (!isAdmin) {
      response = NextResponse.redirect(new URL("/", nextUrl));
    } else {
      response = NextResponse.next();
    }
  } else if (path.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      response = NextResponse.redirect(new URL(`/login?from=${path}`, nextUrl));
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // ── Anonymous visitor cookie ─────────────────────────────────
  // Set once per browser, survives 1 year. HttpOnly — JS cannot read it;
  // the server reads it from the request cookie on every /api/analytics call.
  // crypto.randomUUID() is available in the Edge Runtime.
  if (!req.cookies.get("aim-vid")) {
    response.cookies.set("aim-vid", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
});

export const config = {
  // Run middleware on all routes except static files, images, and api/auth
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)",
  ],
};
