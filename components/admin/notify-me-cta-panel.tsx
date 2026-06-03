"use client";

import { useActionState, useTransition, useState } from "react";
import { upsertCta, deleteCta } from "@/lib/actions/notify-cta";
import "./notify-me-cta-panel.css";

type CtaRow = {
  id: string;
  type: string;
  isEnabled: boolean;
  headline: string;
  body: string | null;
  ctaLabel: string;
  triggerSecondsFromEnd: number;
};

type SignupRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string; // ISO string — serializable from server
};

type Props = {
  workId: string;
  cta: CtaRow | null;
  signupCount: number;
  recentSignups: SignupRow[];
};

const TYPE_OPTIONS = [
  { value: "RELEASE",      label: "Coming Soon (Release)" },
  { value: "MORE",         label: "More on the Way" },
  { value: "POST_RELEASE", label: "What's Next (Post-Release)" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function NotifyMeCtaPanel({
  workId, cta, signupCount, recentSignups,
}: Props) {
  const boundUpsert = upsertCta.bind(null, workId);
  const [state, formAction, isPending] = useActionState(boundUpsert, null);

  const [deleteState, setDeleteState] = useState<{ ok: boolean; error?: string } | null>(null);
  const [deleting, startDelete]        = useTransition();

  // Enabled toggle is controlled locally so the UI updates instantly
  const [enabled, setEnabled] = useState(cta?.isEnabled ?? true);

  function handleDelete() {
    if (!cta) return;
    if (!confirm("Remove this CTA? Signup records are preserved.")) return;
    startDelete(async () => {
      const res = await deleteCta(cta.id, workId);
      setDeleteState(res);
    });
  }

  return (
    <div className="ncta-panel">
      <div className="ncta-panel-header">
        <h3 className="ncta-panel-title">Notify Me CTA</h3>
        {signupCount > 0 && (
          <span className="ncta-panel-signup-count">
            <strong>{signupCount.toLocaleString()}</strong> signup{signupCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <form action={formAction}>
        {/* Hidden field carries the enabled state */}
        <input type="hidden" name="isEnabled" value={enabled ? "1" : "0"} />

        {/* Enable / Disable toggle */}
        <div className="ncta-toggle-row">
          <input
            type="checkbox"
            id="ncta-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <label className="ncta-toggle-label" htmlFor="ncta-enabled">
            Enable CTA for this work
          </label>
        </div>

        <div className="ncta-panel-grid">
          {/* Type */}
          <div className="ncta-panel-field">
            <label className="ncta-panel-label" htmlFor="ncta-type">CTA Type</label>
            <select
              id="ncta-type"
              name="type"
              className="ncta-panel-select"
              defaultValue={cta?.type ?? "RELEASE"}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Trigger timing */}
          <div className="ncta-panel-field">
            <label className="ncta-panel-label" htmlFor="ncta-trigger">
              Show with N seconds remaining
            </label>
            <input
              id="ncta-trigger"
              name="triggerSecondsFromEnd"
              type="number"
              min="0"
              step="1"
              className="ncta-panel-input"
              defaultValue={cta?.triggerSecondsFromEnd ?? 30}
            />
            <p className="ncta-panel-hint">e.g. 30 = shown 30 s before the video ends</p>
          </div>

          {/* Headline */}
          <div className="ncta-panel-field">
            <label className="ncta-panel-label" htmlFor="ncta-headline">Headline</label>
            <input
              id="ncta-headline"
              name="headline"
              type="text"
              className="ncta-panel-input"
              defaultValue={cta?.headline ?? "Stay in the Loop"}
              required
              maxLength={80}
            />
          </div>

          {/* Button label */}
          <div className="ncta-panel-field">
            <label className="ncta-panel-label" htmlFor="ncta-ctalabel">Button Label</label>
            <input
              id="ncta-ctalabel"
              name="ctaLabel"
              type="text"
              className="ncta-panel-input"
              defaultValue={cta?.ctaLabel ?? "Notify Me"}
              required
              maxLength={30}
            />
          </div>

          {/* Body / subtitle */}
          <div className="ncta-panel-field ncta-panel-field--full">
            <label className="ncta-panel-label" htmlFor="ncta-body">
              Subtitle <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="ncta-body"
              name="body"
              type="text"
              className="ncta-panel-input"
              defaultValue={cta?.body ?? ""}
              maxLength={120}
              placeholder="Short supporting line shown below the headline"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="ncta-panel-actions">
          <button type="submit" className="ncta-panel-save" disabled={isPending}>
            {isPending ? "Saving…" : cta ? "Save Changes" : "Create CTA"}
          </button>

          {cta && (
            <button
              type="button"
              className="ncta-panel-delete"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Remove CTA"}
            </button>
          )}

          {state?.ok  === true  && <span className="ncta-panel-ok">Saved ✓</span>}
          {state?.ok  === false && <span className="ncta-panel-err">{state.error}</span>}
          {deleteState?.ok === false && (
            <span className="ncta-panel-err">{deleteState.error}</span>
          )}
        </div>
      </form>

      {/* ── Recent signups ── */}
      {signupCount > 0 && (
        <div className="ncta-signups">
          <p className="ncta-signups-title">
            Recent Signups {signupCount > 10 ? `(showing 10 of ${signupCount.toLocaleString()})` : ""}
          </p>
          <table className="ncta-signups-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((s) => (
                <tr key={s.id}>
                  <td className="ncta-signups-email">{s.email}</td>
                  <td>{s.name ?? <span style={{ color: "var(--color-brand-border)" }}>—</span>}</td>
                  <td className="ncta-signups-date">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
