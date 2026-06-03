/**
 * GET /api/admin/users/search?q=<query>
 *
 * Admin-only — prefix search for active users by name or email.
 * Returns up to 20 results: [{ id, name, email }].
 * Min query length: 1 character (e.g. "s" → all names/emails starting with S).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { name:  { startsWith: q, mode: "insensitive" } },
        { email: { startsWith: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take:    20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
