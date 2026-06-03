"use client";

import { useTransition, useState } from "react";
import {
  clearNotification,
  clearReadNotifications,
  clearAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { Trash2, CheckCheck, X } from "lucide-react";

// ── Per-item menu ─────────────────────────────────────────────

type ItemActionsProps = {
  id:   string;
  read: boolean;
};

export function NotifItemActions({ id, read }: ItemActionsProps) {
  const [pending, start] = useTransition();

  return (
    <div className="notifpage-item-actions">
      {!read && (
        <button
          type="button"
          className="notifpage-action-btn"
          aria-label="Mark as read"
          disabled={pending}
          onClick={() => start(() => markNotificationRead(id))}
        >
          <CheckCheck size={13} />
        </button>
      )}
      <button
        type="button"
        className="notifpage-action-btn notifpage-action-btn--danger"
        aria-label="Delete notification"
        disabled={pending}
        onClick={() => start(() => clearNotification(id))}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Bulk header actions ───────────────────────────────────────

type BulkActionsProps = {
  hasUnread:    boolean;
  hasRead:      boolean;
  hasAny:       boolean;
};

export function NotifBulkActions({ hasUnread, hasRead, hasAny }: BulkActionsProps) {
  const [pending, start]   = useTransition();
  const [confirm, setConfirm] = useState<"read" | "all" | null>(null);

  function handleClearRead() {
    start(async () => {
      await clearReadNotifications();
      setConfirm(null);
    });
  }

  function handleClearAll() {
    start(async () => {
      await clearAllNotifications();
      setConfirm(null);
    });
  }

  function handleMarkAll() {
    start(() => markAllNotificationsRead());
  }

  return (
    <>
      <div className="notifpage-bulk-actions">
        {hasUnread && (
          <button
            type="button"
            className="notifpage-bulk-btn"
            disabled={pending}
            onClick={handleMarkAll}
          >
            <CheckCheck size={13} /> Mark all as read
          </button>
        )}
        {hasRead && (
          <button
            type="button"
            className="notifpage-bulk-btn notifpage-bulk-btn--warn"
            disabled={pending}
            onClick={() => setConfirm("read")}
          >
            <Trash2 size={13} /> Clear read
          </button>
        )}
        {hasAny && (
          <button
            type="button"
            className="notifpage-bulk-btn notifpage-bulk-btn--danger"
            disabled={pending}
            onClick={() => setConfirm("all")}
          >
            <Trash2 size={13} /> Clear all
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="notifpage-confirm-overlay" role="dialog" aria-modal="true">
          <div className="notifpage-confirm">
            <p className="notifpage-confirm-msg">
              {confirm === "read"
                ? "Clear all read notifications?"
                : "Clear all notifications?"}
            </p>
            <p className="notifpage-confirm-sub">
              This removes notifications from your dashboard only.
            </p>
            <div className="notifpage-confirm-actions">
              <button
                type="button"
                className="notifpage-confirm-cancel"
                onClick={() => setConfirm(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="notifpage-confirm-ok"
                onClick={confirm === "read" ? handleClearRead : handleClearAll}
                disabled={pending}
              >
                {pending ? "Clearing…" : "Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
