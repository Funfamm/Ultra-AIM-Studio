"use client";

import { useState, useTransition } from "react";
import {
  publishAnnouncement,
  unpublishAnnouncement,
  deleteAnnouncement,
} from "@/lib/actions/announcements";

type Props = {
  id:          string;
  isPublished: boolean;
};

export default function AnnouncementActions({ id, isPublished }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function run(action: () => Promise<{ error?: string; created?: number; queued?: number }>) {
    setMsg(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setMsg({ text: result.error, ok: false });
      } else if ("created" in result) {
        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} in-app`);
        if (result.queued)  parts.push(`${result.queued} email${result.queued === 1 ? "" : "s"} queued`);
        setMsg({ text: parts.length ? `Published — ${parts.join(", ")}` : "Published", ok: true });
      } else {
        setMsg({ text: "Done", ok: true });
      }
    });
  }

  return (
    <div>
      <div className="notif-card-actions">
        {!isPublished ? (
          <button
            className="notif-action-btn"
            disabled={pending}
            onClick={() => run(() => publishAnnouncement(id))}
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        ) : (
          <button
            className="notif-action-btn"
            disabled={pending}
            onClick={() => run(() => unpublishAnnouncement(id))}
          >
            {pending ? "Unpublishing…" : "Unpublish"}
          </button>
        )}
        <button
          className="notif-action-btn notif-action-btn--danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this announcement? This cannot be undone.")) {
              run(() => deleteAnnouncement(id));
            }
          }}
        >
          Delete
        </button>
      </div>
      {msg && (
        <p className={`notif-action-msg ${msg.ok ? "notif-action-msg--ok" : "notif-action-msg--err"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
