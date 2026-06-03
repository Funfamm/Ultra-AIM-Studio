// Admin Users — command center
// Server-rendered page. Stat cards, search/filter/sort/paginate.
// Interactive table (checkbox select, bulk suspend, role change) in UsersTable (client).

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { UsersFilters } from "./users-filters";
import { UsersTable, type UserRow } from "./users-table";
import "./users.css";

export const metadata: Metadata = { title: "Admin — Users" };

const PAGE_SIZE = 25;

// ── Prisma where clause from URL params ───────────────────────
function buildWhere(
  q: string,
  role: string,
  via: string,
  status: string
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: "insensitive" } },
      { email: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  if (role === "ADMIN") where.role = "ADMIN";
  if (role === "USER")  where.role = "USER";

  if (via === "google") { where.accounts = { some: { provider: "google" } }; where.password = null; }
  if (via === "email")  { where.password = { not: null }; where.accounts = { none: { provider: "google" } }; }
  if (via === "multi")  { where.password = { not: null }; where.accounts = { some: { provider: "google" } }; }

  if (status === "ACTIVE")      where.status = "ACTIVE";
  if (status === "SUSPENDED")   where.status = "SUSPENDED";
  if (status === "DEACTIVATED") where.status = "DEACTIVATED";

  return where;
}

// ── Pagination URL ────────────────────────────────────────────
function pageUrl(
  p: number,
  q: string,
  role: string,
  via: string,
  sort: string,
  status: string
): string {
  const sp = new URLSearchParams();
  if (q)              sp.set("q",      q);
  if (role)           sp.set("role",   role);
  if (via)            sp.set("via",    via);
  if (sort !== "newest") sp.set("sort", sort);
  if (status)         sp.set("status", status);
  if (p > 1)          sp.set("page",   String(p));
  const qs = sp.toString();
  return `/admin/users${qs ? `?${qs}` : ""}`;
}

// ── Login method ──────────────────────────────────────────────
function loginMethod(
  hasPassword: boolean,
  providers: string[]
): "google" | "email" | "multi" {
  const hasGoogle = providers.includes("google");
  if (hasGoogle && hasPassword) return "multi";
  if (hasGoogle)                return "google";
  return "email";
}

// ── Page ──────────────────────────────────────────────────────
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const actorId     = session?.user?.id   ?? "";
  const sessionRole = session?.user?.role ?? "";

  const q      = sp.q      ?? "";
  const role   = sp.role   ?? "";
  const via    = sp.via    ?? "";
  const sort   = sp.sort   ?? "newest";
  const status = sp.status ?? "";
  const page   = Math.max(1, parseInt(sp.page ?? "1", 10));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const where = buildWhere(q, role, via, status);

  const [
    totalCount,
    adminCount,
    suspendedCount,
    googleCount,
    credCount,
    multiCount,
    newThisMonth,
    filteredTotal,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: { not: "USER" } } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { accounts: { some: { provider: "google" } } } }),
    prisma.user.count({ where: { password: { not: null } } }),
    prisma.user.count({ where: { password: { not: null }, accounts: { some: { provider: "google" } } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,      // used as boolean only — hash never passed to client
        status: true,
        suspendedAt: true,
        lastLoginAt: true,
        lastLoginProvider: true,
        createdAt: true,
        accounts: { select: { provider: true } },
        _count: { select: { savedWorks: true, progress: true } },
      },
    }),
  ]);

  const memberCount = totalCount - adminCount;
  const totalPages  = Math.ceil(filteredTotal / PAGE_SIZE);
  const isFiltered  = !!(q || role || via || status);

  // Device counts — UserDevice.userId is a plain string (no FK), so we group separately
  const userIds = users.map((u) => u.id);
  const deviceGroups = userIds.length > 0
    ? await prisma.userDevice.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { id: true },
      })
    : [];
  const deviceCountMap = Object.fromEntries(deviceGroups.map((d) => [d.userId, d._count.id]));

  // Compute UserRow[] — serializable shape for the client component
  // Password hash is used as a boolean check here and never forwarded.
  const rows: UserRow[] = users.map((u) => ({
    id:                u.id,
    name:              u.name,
    email:             u.email,
    role:              u.role,
    hasPassword:       !!u.password,
    loginMethod:       loginMethod(!!u.password, u.accounts.map((a) => a.provider)),
    status:            u.status,
    suspendedAt:       u.suspendedAt?.toISOString() ?? null,
    lastLoginAt:       u.lastLoginAt?.toISOString() ?? null,
    lastLoginProvider: u.lastLoginProvider ?? null,
    deviceCount:       deviceCountMap[u.id] ?? 0,
    savedWorksCount:   u._count.savedWorks,
    progressCount:     u._count.progress,
    createdAt:         u.createdAt.toISOString(),
    isSelf:            u.id === actorId,
  }));

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users</h1>
        <span className="upage-count">
          {isFiltered
            ? `${filteredTotal} of ${totalCount}`
            : `${totalCount} total`}
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="ustat-row">
        <div className="ustat-cell">
          <div className="ustat-val">{totalCount.toLocaleString()}</div>
          <div className="ustat-lbl">Total Users</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{memberCount.toLocaleString()}</div>
          <div className="ustat-lbl">Members</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--accent">{adminCount.toLocaleString()}</div>
          <div className="ustat-lbl">Admins</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${suspendedCount > 0 ? " ustat-val--warn" : ""}`}>
            {suspendedCount.toLocaleString()}
          </div>
          <div className="ustat-lbl">Suspended</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{googleCount.toLocaleString()}</div>
          <div className="ustat-lbl">Google</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{credCount.toLocaleString()}</div>
          <div className="ustat-lbl">Email</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{multiCount.toLocaleString()}</div>
          <div className="ustat-lbl">Multi-auth</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--green">{newThisMonth.toLocaleString()}</div>
          <div className="ustat-lbl">Joined This Month</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <UsersFilters q={q} role={role} via={via} sort={sort} status={status} />

      {/* ── Interactive table (client component) ── */}
      <UsersTable users={rows} isFiltered={isFiltered} sessionRole={sessionRole} />

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="upagination">
          {page > 1 ? (
            <Link href={pageUrl(page - 1, q, role, via, sort, status)} className="upag-btn">
              ← Prev
            </Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← Prev</span>
          )}
          <span className="upag-info">
            Page {page} of {totalPages}
            {isFiltered && (
              <span className="upag-sub"> · {filteredTotal} matching</span>
            )}
          </span>
          {page < totalPages ? (
            <Link href={pageUrl(page + 1, q, role, via, sort, status)} className="upag-btn">
              Next →
            </Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">Next →</span>
          )}
        </div>
      )}

    </div>
  );
}
