"use client";

import { useActionState } from "react";
import { createAnnouncement } from "@/lib/actions/announcements";

type FormState = { error: string | undefined };
const INITIAL: FormState = { error: undefined };

export default function AnnouncementForm({ acsConfigured }: { acsConfigured: boolean }) {
  const [state, action, pending] = useActionState(createAnnouncement, INITIAL);

  return (
    <form action={action} className="notif-form">
      {state.error && (
        <p style={{ fontSize: "0.82rem", color: "var(--color-brand-red)", margin: 0 }}>
          {state.error}
        </p>
      )}

      <div className="notif-field">
        <label className="notif-label" htmlFor="ann-title">Title *</label>
        <input
          id="ann-title"
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. New film dropping this week"
          className="notif-input"
        />
      </div>

      <div className="notif-field">
        <label className="notif-label" htmlFor="ann-body">Message *</label>
        <textarea
          id="ann-body"
          name="body"
          required
          maxLength={500}
          placeholder="Short announcement text shown to users…"
          className="notif-textarea"
        />
      </div>

      <div className="notif-form-row">
        <div className="notif-field">
          <label className="notif-label" htmlFor="ann-href">Link URL (optional)</label>
          <input
            id="ann-href"
            name="href"
            type="url"
            placeholder="https://…"
            className="notif-input"
          />
        </div>
        <div className="notif-field">
          <label className="notif-label" htmlFor="ann-href-label">Link label (optional)</label>
          <input
            id="ann-href-label"
            name="hrefLabel"
            type="text"
            maxLength={40}
            placeholder="e.g. Watch Now"
            className="notif-input"
          />
        </div>
      </div>

      <div className="notif-field">
        <label className="notif-label" htmlFor="ann-expires">Expires at (optional)</label>
        <input
          id="ann-expires"
          name="expiresAt"
          type="datetime-local"
          className="notif-input"
          style={{ maxWidth: "280px" }}
        />
      </div>

      <label className="notif-checkbox-row">
        <input type="checkbox" name="sendEmail" />
        Also send bulk email to opted-in users via ACS
        {!acsConfigured && (
          <span style={{ color: "#f59e0b", fontSize: "0.72rem", marginLeft: "0.3rem" }}>
            (ACS not configured)
          </span>
        )}
      </label>

      <button type="submit" disabled={pending} className="notif-submit-btn">
        {pending ? "Saving…" : "Save as Draft"}
      </button>
    </form>
  );
}
