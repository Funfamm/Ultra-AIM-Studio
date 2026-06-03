"use client";

import { useTransition, useState } from "react";
import {
  removeWatchProgress,
  clearContinueWatching,
  resetWatchProgress,
} from "@/lib/actions/progress";
import { clearAllSavedWorks } from "@/lib/actions/watchlist";
import { Trash2, RotateCcw, X } from "lucide-react";

// ── Confirm dialog (shared) ───────────────────────────────────

type ConfirmProps = {
  title:    string;
  subtitle: string;
  label:    string;
  onConfirm: () => void;
  onCancel:  () => void;
  pending:   boolean;
};

function ConfirmDialog({ title, subtitle, label, onConfirm, onCancel, pending }: ConfirmProps) {
  return (
    <div className="dash-confirm-overlay" role="dialog" aria-modal="true">
      <div className="dash-confirm">
        <p className="dash-confirm-msg">{title}</p>
        <p className="dash-confirm-sub">{subtitle}</p>
        <div className="dash-confirm-actions">
          <button type="button" className="dash-confirm-cancel" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="dash-confirm-ok" onClick={onConfirm} disabled={pending}>
            {pending ? "Clearing…" : label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Remove single Continue Watching card ─────────────────────

export function RemoveProgressBtn({ workId, title }: { workId: string; title: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="dash-card-remove-btn"
      aria-label={`Remove ${title} from Continue Watching`}
      disabled={pending}
      onClick={() => start(() => removeWatchProgress(workId))}
      title="Remove from Continue Watching"
    >
      <X size={13} />
    </button>
  );
}

// ── Restart progress for a card ───────────────────────────────

export function ResetProgressBtn({ workId, title }: { workId: string; title: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="dash-card-remove-btn dash-card-remove-btn--reset"
      aria-label={`Restart progress for ${title}`}
      disabled={pending}
      onClick={() => start(() => resetWatchProgress(workId))}
      title="Restart from beginning"
    >
      <RotateCcw size={12} />
    </button>
  );
}

// ── Clear Continue Watching section ──────────────────────────

export function ClearContinueWatchingBtn() {
  const [pending, start]   = useTransition();
  const [confirm, setConfirm] = useState(false);

  function handleConfirm() {
    start(async () => {
      await clearContinueWatching();
      setConfirm(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className="section-clear-btn"
        onClick={() => setConfirm(true)}
        disabled={pending}
      >
        <Trash2 size={12} /> Clear all
      </button>
      {confirm && (
        <ConfirmDialog
          title="Clear Continue Watching?"
          subtitle="Your progress for these titles will be removed. This only clears your dashboard history — it does not delete the films."
          label="Clear"
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(false)}
          pending={pending}
        />
      )}
    </>
  );
}

// ── Clear My List section ─────────────────────────────────────

export function ClearMyListBtn() {
  const [pending, start]   = useTransition();
  const [confirm, setConfirm] = useState(false);

  function handleConfirm() {
    start(async () => {
      await clearAllSavedWorks();
      setConfirm(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className="section-clear-btn"
        onClick={() => setConfirm(true)}
        disabled={pending}
      >
        <Trash2 size={12} /> Clear My List
      </button>
      {confirm && (
        <ConfirmDialog
          title="Clear My List?"
          subtitle="This removes saved works from your list. You can save them again later."
          label="Clear"
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(false)}
          pending={pending}
        />
      )}
    </>
  );
}
