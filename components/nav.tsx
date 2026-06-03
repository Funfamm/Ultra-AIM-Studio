"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Menu, X, Bell, Home, Film, Clock, LayoutDashboard,
  Bookmark, Settings, LogOut, LogIn, UserPlus, Shield,
  CalendarClock,
} from "lucide-react";
import { logoutUser } from "@/lib/actions/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/works", label: "Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type NavProps = {
  user?: { name?: string | null; email?: string | null; role?: string; image?: string | null } | null;
  unreadCount?: number;
  hasUpcoming?: boolean;
  allowRegistrations?: boolean;
};

export default function Nav({
  user,
  unreadCount = 0,
  hasUpcoming = false,
  allowRegistrations = true,
}: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const hasUnread = !!user && unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? "?";
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "Account";

  return (
    <header className="nav-header">
      <div className="nav-inner container-app">

        {/* Logo */}
        <Link href="/" className="nav-logo" onClick={() => setOpen(false)}>
          <Image
            src="/images/SP_Logo.jpg"
            alt="AIM Studio"
            width={28}
            height={28}
            className="nav-logo-img"
            priority
          />
          AIM<span>Studio</span>
        </Link>

        {/* Desktop links */}
        <nav className="nav-links-desktop">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className={`nav-link ${pathname === l.href ? "nav-link--active" : ""}`}>
              {l.label}
            </Link>
          ))}
          {hasUpcoming && (
            <Link href="/works?collection=upcoming"
              className={`nav-link ${pathname === "/works" ? "" : ""}`}>
              Upcoming
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="nav-link nav-link--admin">
              <Shield size={12} /> Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/dashboard/notifications" className="nav-bell"
                aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}>
                <Bell size={16} />
                {hasUnread && <span className="nav-bell-badge" aria-hidden="true">{badgeLabel}</span>}
              </Link>
              <Link href="/dashboard" className="nav-cta">
                {displayName.split(" ")[0]}
              </Link>
            </>
          ) : (
            <Link href="/login" className="nav-cta">Sign In</Link>
          )}
        </nav>

        {/* Mobile cluster: bell + burger */}
        <div className="nav-mobile-actions">
          {user && (
            <Link href="/dashboard/notifications" className="nav-bell"
              aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
              onClick={() => setOpen(false)}>
              <Bell size={20} />
              {hasUnread && <span className="nav-bell-badge" aria-hidden="true">{badgeLabel}</span>}
            </Link>
          )}
          <button className="nav-burger" onClick={() => setOpen(true)}
            aria-label="Open menu" aria-expanded={open}>
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* ── Overlay ── */}
      <div
        className={`nav-overlay${open ? " nav-overlay--open" : ""}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* ── Sidebar drawer ── */}
      <div
        className={`nav-sidebar${open ? " nav-sidebar--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="nav-sb-header">
          {user ? (
            <div className="nav-sb-profile">
              <div className="nav-sb-avatar">{initial}</div>
              <div className="nav-sb-identity">
                <span className="nav-sb-name">{displayName}</span>
                {isAdmin && <span className="nav-sb-role">ADMIN</span>}
              </div>
              <span className="nav-sb-online-dot" aria-hidden="true" />
            </div>
          ) : (
            <div className="nav-sb-brand">
              <Image src="/images/SP_Logo.jpg" alt="AIM Studio" width={24} height={24}
                className="nav-logo-img" />
              <span className="nav-sb-brand-name">AIM Studio</span>
            </div>
          )}
          <button className="nav-sb-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Quick nav row */}
        <div className="nav-sb-quick">
          <Link href="/" className="nav-sb-quick-item" onClick={() => setOpen(false)}>
            <Home size={18} />
            <span>Home</span>
          </Link>
          <Link href="/works" className="nav-sb-quick-item" onClick={() => setOpen(false)}>
            <Film size={18} />
            <span>Works</span>
          </Link>
          {hasUpcoming && (
            <Link href="/works?collection=upcoming" className="nav-sb-quick-item" onClick={() => setOpen(false)}>
              <CalendarClock size={18} />
              <span>Upcoming</span>
            </Link>
          )}
        </div>

        {/* Divider */}
        <div className="nav-sb-divider" />

        {/* Main nav links */}
        <nav className="nav-sb-nav">
          {user ? (
            <>
              <Link href="/dashboard" className="nav-sb-link" onClick={() => setOpen(false)}>
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <Link href="/dashboard" className="nav-sb-link" onClick={() => setOpen(false)}>
                <Clock size={16} /> Continue Watching
              </Link>
              <Link href="/dashboard" className="nav-sb-link" onClick={() => setOpen(false)}>
                <Bookmark size={16} /> My List
              </Link>
              <Link href="/dashboard/notifications" className="nav-sb-link" onClick={() => setOpen(false)}>
                <Bell size={16} />
                <span>Notifications</span>
                {hasUnread && (
                  <span className="nav-sb-badge">{badgeLabel}</span>
                )}
              </Link>
              <Link href="/dashboard/settings" className="nav-sb-link" onClick={() => setOpen(false)}>
                <Settings size={16} /> Settings
              </Link>
            </>
          ) : (
            <>
              <Link href="/about" className="nav-sb-link" onClick={() => setOpen(false)}>
                About
              </Link>
              <Link href="/contact" className="nav-sb-link" onClick={() => setOpen(false)}>
                Contact
              </Link>
            </>
          )}
        </nav>

        {/* Admin shortcut */}
        {isAdmin && (
          <>
            <div className="nav-sb-divider" />
            <Link href="/admin" className="nav-sb-link nav-sb-link--admin" onClick={() => setOpen(false)}>
              <Shield size={16} /> Admin Panel
            </Link>
          </>
        )}

        <div className="nav-sb-divider" />

        {/* Auth actions */}
        <div className="nav-sb-auth">
          {user ? (
            <form action={logoutUser}>
              <button type="submit" className="nav-sb-signout">
                <LogOut size={15} /> Sign Out
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="nav-sb-link" onClick={() => setOpen(false)}>
                <LogIn size={16} /> Sign In
              </Link>
              {allowRegistrations && (
                <Link href="/register" className="nav-sb-register" onClick={() => setOpen(false)}>
                  <UserPlus size={15} /> Create Account
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
