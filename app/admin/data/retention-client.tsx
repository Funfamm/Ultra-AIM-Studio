"use client";

import { useTransition, useState } from "react";
import { runRetentionCleanup, previewRetentionCleanup, saveRetentionSettings } from "@/lib/actions/retention";
import type { RetentionPreview, RetentionResult } from "@/lib/actions/retention";
import { ShieldAlert, Trash2, Eye } from "lucide-react";

// ── Settings form ─────────────────────────────────────────────

type SettingsFormProps = {
  defaults: {
    emailLogRetentionDays:     number;
    emailQueueRetentionDays:   number;
    notificationRetentionDays: number;
    visitorEventRetentionDays: number;
  };
};

export function RetentionSettingsForm({ defaults }: SettingsFormProps) {
  const [pending, start] = useTransition();
  const [saved,   setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await saveRetentionSettings(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="retention-settings-form">
      <div className="retention-field-grid">
        <RetentionField
          name="emailLogRetentionDays"
          label="Email logs"
          hint="Keep email send records for N days"
          defaultValue={defaults.emailLogRetentionDays}
        />
        <RetentionField
          name="emailQueueRetentionDays"
          label="Email queue (completed)"
          hint="Keep processed/failed queue rows for N days"
          defaultValue={defaults.emailQueueRetentionDays}
        />
        <RetentionField
          name="notificationRetentionDays"
          label="Read notifications"
          hint="Auto-remove read notifications after N days"
          defaultValue={defaults.notificationRetentionDays}
        />
        <RetentionField
          name="visitorEventRetentionDays"
          label="Visitor events & sessions"
          hint="Keep raw analytics events for N days"
          defaultValue={defaults.visitorEventRetentionDays}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.25rem" }}>
        <button type="submit" className="retention-save-btn" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="retention-saved-msg">✓ Saved</span>}
      </div>
    </form>
  );
}

function RetentionField({
  name, label, hint, defaultValue,
}: {
  name: string; label: string; hint: string; defaultValue: number;
}) {
  return (
    <div className="retention-field">
      <label className="retention-label" htmlFor={name}>{label}</label>
      <div className="retention-input-row">
        <input
          id={name}
          name={name}
          type="number"
          min={1}
          max={3650}
          defaultValue={defaultValue}
          className="retention-input"
          required
        />
        <span className="retention-unit">days</span>
      </div>
      <p className="retention-hint">{hint}</p>
    </div>
  );
}

// ── Preview + Run ─────────────────────────────────────────────

type CleanupActionsProps = {
  isSuperAdmin: boolean;
};

export function RetentionCleanupActions({ isSuperAdmin }: CleanupActionsProps) {
  const [pending,  start]      = useTransition();
  const [preview,  setPreview] = useState<RetentionPreview | null>(null);
  const [result,   setResult]  = useState<RetentionResult  | null>(null);
  const [confirm,  setConfirm] = useState(false);

  function handlePreview() {
    start(async () => {
      const p = await previewRetentionCleanup();
      setPreview(p);
      setResult(null);
    });
  }

  function handleRun() {
    start(async () => {
      const r = await runRetentionCleanup();
      setResult(r);
      setPreview(null);
      setConfirm(false);
    });
  }

  const deletableCount = preview
    ? (preview.emailLogs + preview.emailQueue + preview.notifications +
       preview.visitorEvents + preview.visitorSessions + preview.loginAttempts)
    : 0;

  return (
    <div className="retention-actions-section">
      <div className="retention-action-row">
        <button
          type="button"
          className="retention-preview-btn"
          onClick={handlePreview}
          disabled={pending}
        >
          <Eye size={14} /> Preview cleanup
        </button>

        {isSuperAdmin && (
          <button
            type="button"
            className="retention-run-btn"
            onClick={() => setConfirm(true)}
            disabled={pending || !preview}
            title={!preview ? "Run Preview first" : undefined}
          >
            <Trash2 size={14} /> Run cleanup
          </button>
        )}
      </div>

      {/* Preview results */}
      {preview && (
        <div className="retention-preview-card">
          <p className="retention-preview-title">Cleanup preview</p>
          <div className="retention-preview-grid">
            <PreviewRow label="Email logs"           count={preview.emailLogs}       deletable />
            <PreviewRow label="Email queue rows"     count={preview.emailQueue}      deletable />
            <PreviewRow label="Read notifications"   count={preview.notifications}   deletable />
            <PreviewRow label="Analytics events"     count={preview.visitorEvents}   deletable />
            <PreviewRow label="Visitor sessions"     count={preview.visitorSessions} deletable />
            <PreviewRow label="Login attempts"       count={preview.loginAttempts}   deletable />
            <PreviewRow label="Audit logs"           count={preview.auditLogs}       deletable={false} protected />
            <PreviewRow label="Security events"      count={preview.securityEvents}  deletable={false} protected />
            <PreviewRow label="Email suppressions"   count={preview.suppressions}    deletable={false} protected />
          </div>
          <p className="retention-preview-summary">
            {deletableCount === 0
              ? "Nothing to clean up — all records are within retention windows."
              : `${deletableCount.toLocaleString()} records will be deleted. Protected records are not affected.`}
          </p>
        </div>
      )}

      {/* Run result */}
      {result && (
        <div className={`retention-result-card ${result.error ? "retention-result-card--err" : ""}`}>
          {result.error ? (
            <p className="retention-result-err">⚠ {result.error}</p>
          ) : (
            <>
              <p className="retention-result-title">✓ Cleanup complete</p>
              <div className="retention-preview-grid">
                {Object.entries(result.deleted).map(([k, v]) => (
                  <PreviewRow key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} count={v ?? 0} deletable />
                ))}
              </div>
              <p className="retention-result-note">
                Protected audit and security records were not affected. This cleanup has been logged.
              </p>
            </>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && preview && (
        <div className="retention-confirm-overlay" role="dialog" aria-modal="true">
          <div className="retention-confirm">
            <div className="retention-confirm-warn">
              <ShieldAlert size={18} />
              <span>This action cannot be undone.</span>
            </div>
            <p className="retention-confirm-msg">Run data cleanup?</p>
            <p className="retention-confirm-sub">
              {deletableCount.toLocaleString()} records will be permanently deleted.
              Protected audit and security records will not be deleted.
              This action will be logged to the audit trail.
            </p>
            <div className="retention-confirm-actions">
              <button type="button" className="retention-confirm-cancel" onClick={() => setConfirm(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="retention-confirm-ok" onClick={handleRun} disabled={pending}>
                {pending ? "Running…" : "Run cleanup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label, count, deletable, protected: isProtected,
}: {
  label: string; count: number; deletable: boolean; protected?: boolean;
}) {
  return (
    <div className="retention-preview-row">
      <span className="retention-preview-label">{label}</span>
      <span className={`retention-preview-count ${isProtected ? "retention-preview-count--protected" : deletable && count > 0 ? "retention-preview-count--delete" : ""}`}>
        {count.toLocaleString()}
      </span>
      <span className="retention-preview-action">
        {isProtected ? "🔒 protected" : count === 0 ? "—" : "will delete"}
      </span>
    </div>
  );
}
