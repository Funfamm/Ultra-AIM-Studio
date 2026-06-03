"use client";

// Thin client wrappers for notification interaction.
// NotificationLink  — marks read then navigates (notifications with href).
// NotificationTitle — marks read on click (notifications without href).
//
// Both call markNotificationRead only when the notification is unread.
// Server action uses updateMany(where: { id, userId }) — users can only
// mark their own notifications; cross-user marking is impossible by design.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/lib/actions/notifications";

// ── With href — mark read then navigate ───────────────────────

type LinkProps = {
  id:        string;
  href:      string;
  read:      boolean;
  className?: string;
  children:  React.ReactNode;
};

export function NotificationLink({ id, href, read, className, children }: LinkProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    startTransition(async () => {
      if (!read) {
        await markNotificationRead(id).catch(() => {});
      }
      router.push(href);
    });
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

// ── Without href — mark read on click ────────────────────────

type TitleProps = {
  id:        string;
  read:      boolean;
  className?: string;
  children:  React.ReactNode;
};

export function NotificationTitle({ id, read, className, children }: TitleProps) {
  const [, startTransition] = useTransition();

  function handleClick() {
    if (!read) {
      startTransition(async () => {
        await markNotificationRead(id).catch(() => {});
      });
    }
  }

  return (
    <span
      role="button"
      tabIndex={read ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      className={className}
      style={{ cursor: read ? "default" : "pointer" }}
    >
      {children}
    </span>
  );
}
