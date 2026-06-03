"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/analytics",          label: "Overview" },
  { href: "/admin/analytics/traffic",  label: "Traffic"  },
  { href: "/admin/analytics/content",  label: "Content"  },
  { href: "/admin/analytics/visitors", label: "Visitors" },
  { href: "/admin/analytics/system",   label: "System"   },
];

export default function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <nav className="atab-nav">
      {TABS.map((t) => {
        const exact    = t.href === "/admin/analytics";
        const isActive = exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`atab${isActive ? " atab--active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
