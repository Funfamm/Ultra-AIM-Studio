"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Clapperboard, Users, BarChart2, Mail, Settings, ScrollText, LogOut, Menu, X, ArrowLeft, BellRing, Shield, Megaphone, Database, MessageSquare, TrendingUp } from "lucide-react";
import { logoutUser } from "@/lib/actions/auth";
import "./admin-sidebar.css";

const NAV = [
  { href: "/admin",            label: "Overview",  icon: LayoutDashboard, exact: true },
  { href: "/admin/works",      label: "Works",     icon: Clapperboard },
  { href: "/admin/users",      label: "Users",     icon: Users },
  { href: "/admin/analytics",  label: "Analytics", icon: BarChart2 },
  { href: "/admin/outreach",         label: "Outreach",      icon: Megaphone },
  { href: "/admin/notify-me-ctas", label: "Notify Me",     icon: BellRing },
  { href: "/admin/comments",        label: "Comments",      icon: MessageSquare },
  { href: "/admin/engagement",      label: "Engagement",    icon: TrendingUp },
  { href: "/admin/security",       label: "Security",      icon: Shield },
  { href: "/admin/email",          label: "Email",         icon: Mail },
  { href: "/admin/settings",  label: "Settings",  icon: Settings },
  { href: "/admin/data",      label: "Data",      icon: Database },
  { href: "/admin/audit",     label: "Audit Log", icon: ScrollText },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile hamburger — fixed top-left */}
      <button className="adm-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* Backdrop */}
      {open && <div className="adm-backdrop" onClick={close} />}

      {/* Sidebar */}
      <aside className={`adm-sidebar${open ? " adm-sidebar--open" : ""}`}>

        {/* Top: logo + label */}
        <div className="adm-top">
          <button className="adm-close" onClick={close} aria-label="Close menu">
            <X size={16} />
          </button>
          <Link href="/" className="adm-logo" onClick={close}>
            AIM<span>Studio</span>
          </Link>
          <span className="adm-sublabel">Admin Panel</span>
        </div>

        {/* Nav links */}
        <nav className="adm-nav">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={close}
              className={`adm-link${active(l.href, l.exact) ? " adm-link--active" : ""}`}
            >
              <l.icon size={15} strokeWidth={1.75} />
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Bottom: back to site + sign out */}
        <div className="adm-bottom">
          <Link href="/" className="adm-back" onClick={close}>
            <ArrowLeft size={13} /> Back to Site
          </Link>
          <form action={logoutUser}>
            <button type="submit" className="adm-signout">
              <LogOut size={13} /> Sign Out
            </button>
          </form>
        </div>

      </aside>

    </>
  );
}
