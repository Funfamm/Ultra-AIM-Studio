"use client";

import { useActionState } from "react";
import { upsertCta, deleteCta } from "@/lib/actions/notify-cta";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ExistingCta = {
  id: string;
  type: string;
  isEnabled: boolean;
  headline: string;
  body: string | null;
  ctaLabel: string;
  triggerSecondsFromEnd: number;
};

type Props = {
  workId: string;
  workTitle: string;
  cta: ExistingCta | null;
};

export default function CtaForm({ workId, workTitle, cta }: Props) {
  const router = useRouter();
  const bound = upsertCta.bind(null, workId);
  const [state, action, pending] = useActionState(bound, null);

  async function handleDelete() {
    if (!cta) return;
    if (!confirm(`Delete the Notify Me CTA for "${workTitle}"? Signup records will be kept.`)) return;
    const res = await deleteCta(cta.id, workId);
    if (res.ok) router.push("/admin/notify-me-ctas");
  }

  return (
    <form action={action} className="cta-form">

      {/* Status message */}
      {state?.ok && (
        <p className="cta-form-ok">Saved successfully.</p>
      )}
      {state?.error && (
        <p className="cta-form-err">{state.error}</p>
      )}

      {/* Work context (read-only) */}
      <div className="cta-form-field">
        <label className="cta-form-label">Work</label>
        <p className="cta-form-readonly">{workTitle}</p>
      </div>

      {/* Enabled toggle */}
      <div className="cta-form-field cta-form-field--inline">
        <label className="cta-form-label" htmlFor="isEnabled">Active</label>
        <label className="cta-toggle">
          <input
            type="checkbox"
            id="isEnabled"
            name="isEnabled"
            value="1"
            defaultChecked={cta?.isEnabled ?? true}
          />
          <span className="cta-toggle-track" />
        </label>
      </div>

      {/* CTA Type */}
      <div className="cta-form-field">
        <label className="cta-form-label" htmlFor="type">CTA Type</label>
        <select id="type" name="type" className="cta-form-select" defaultValue={cta?.type ?? "RELEASE"}>
          <option value="RELEASE">Pre-Release — coming soon, build anticipation</option>
          <option value="MORE">Watch More — in-series, audience retention</option>
          <option value="POST_RELEASE">Post-Release — launched, grow your list</option>
        </select>
      </div>

      {/* Headline */}
      <div className="cta-form-field">
        <label className="cta-form-label" htmlFor="headline">Headline</label>
        <input
          id="headline" name="headline" type="text"
          className="cta-form-input"
          defaultValue={cta?.headline ?? "Stay in the Loop"}
          placeholder="Stay in the Loop"
          required maxLength={100}
        />
      </div>

      {/* Body */}
      <div className="cta-form-field">
        <label className="cta-form-label" htmlFor="body">
          Body <span className="cta-form-optional">(optional)</span>
        </label>
        <textarea
          id="body" name="body"
          className="cta-form-textarea"
          defaultValue={cta?.body ?? ""}
          placeholder="Be the first to know when this drops."
          rows={3} maxLength={300}
        />
      </div>

      {/* Button label */}
      <div className="cta-form-field">
        <label className="cta-form-label" htmlFor="ctaLabel">Button Label</label>
        <input
          id="ctaLabel" name="ctaLabel" type="text"
          className="cta-form-input"
          defaultValue={cta?.ctaLabel ?? "Notify Me"}
          placeholder="Notify Me"
          required maxLength={40}
        />
      </div>

      {/* Trigger */}
      <div className="cta-form-field">
        <label className="cta-form-label" htmlFor="triggerSecondsFromEnd">
          Trigger — seconds from video end
        </label>
        <input
          id="triggerSecondsFromEnd" name="triggerSecondsFromEnd" type="number"
          className="cta-form-input cta-form-input--sm"
          defaultValue={cta?.triggerSecondsFromEnd ?? 30}
          min={0} max={3600} step={1}
          required
        />
        <p className="cta-form-hint">
          Overlay appears this many seconds before the video ends. 30 is recommended.
        </p>
      </div>

      {/* Actions */}
      <div className="cta-form-actions">
        <button type="submit" className="cta-form-save" disabled={pending}>
          {pending ? <Loader2 size={14} className="cta-form-spin" /> : null}
          {cta ? "Save Changes" : "Create CTA"}
        </button>

        {cta && (
          <button type="button" className="cta-form-delete" onClick={handleDelete}>
            <Trash2 size={13} /> Delete CTA
          </button>
        )}
      </div>

    </form>
  );
}
