"use client";

import { useActionState, useTransition, useState, useRef, useEffect } from "react";
import { createTemplate, updateTemplate } from "@/lib/actions/email-templates";
import type { TemplateResult } from "@/lib/actions/email-templates";
import type { EmailType } from "@prisma/client";

// Variable definitions per email type
const VARS: Record<string, { v: string; desc: string; bulk?: true }[]> = {
  PASSWORD_RESET: [
    { v: "{{userName}}",  desc: "Recipient's display name" },
    { v: "{{actionUrl}}", desc: "Password reset link URL" },
    { v: "{{supportEmail}}", desc: "Support contact address" },
    { v: "{{date}}",      desc: "Current date/time" },
  ],
  WELCOME: [
    { v: "{{userName}}",  desc: "Recipient's display name" },
    { v: "{{actionUrl}}", desc: "Dashboard URL" },
    { v: "{{supportEmail}}", desc: "Support contact address" },
  ],
  SECURITY_ALERT: [
    { v: "{{userName}}",  desc: "Recipient's display name" },
    { v: "{{eventDescription}}", desc: "Description of the security event" },
    { v: "{{date}}",      desc: "Event timestamp" },
    { v: "{{actionUrl}}", desc: "Security settings URL" },
    { v: "{{supportEmail}}", desc: "Support contact address" },
  ],
  NEW_RELEASE: [
    { v: "{{workTitle}}", desc: "Title of the new work" },
    { v: "{{workType}}",  desc: "Work type (Film, Series…)" },
    { v: "{{actionUrl}}", desc: "Link to the work" },
    { v: "{{unsubscribeUrl}}", desc: "One-click unsubscribe link", bulk: true },
  ],
  NEW_EPISODE: [
    { v: "{{episodeTitle}}", desc: "Episode title" },
    { v: "{{seriesTitle}}",  desc: "Series name" },
    { v: "{{actionUrl}}",    desc: "Link to the episode" },
    { v: "{{unsubscribeUrl}}", desc: "One-click unsubscribe link", bulk: true },
  ],
  ANNOUNCEMENT: [
    { v: "{{title}}",      desc: "Announcement title" },
    { v: "{{body}}",       desc: "Announcement body text" },
    { v: "{{actionUrl}}",  desc: "Optional CTA link" },
    { v: "{{actionLabel}}", desc: "CTA button label" },
    { v: "{{unsubscribeUrl}}", desc: "One-click unsubscribe link", bulk: true },
  ],
  NOTIFY_ME_FOLLOWUP: [
    { v: "{{userName}}",  desc: "Recipient's display name (if known)" },
    { v: "{{workTitle}}", desc: "Work title" },
    { v: "{{workType}}",  desc: "Work type" },
    { v: "{{actionUrl}}", desc: "Link to the work" },
    { v: "{{unsubscribeUrl}}", desc: "One-click unsubscribe link", bulk: true },
  ],
  ADMIN_ALERT: [
    { v: "{{subject}}", desc: "Alert subject" },
    { v: "{{body}}",    desc: "Alert body" },
    { v: "{{date}}",    desc: "Event timestamp" },
  ],
};
const DEFAULT_VARS = [
  { v: "{{userName}}",      desc: "Recipient's display name" },
  { v: "{{actionUrl}}",     desc: "Primary action URL" },
  { v: "{{supportEmail}}",  desc: "Support contact address" },
  { v: "{{date}}",          desc: "Current date/time" },
  { v: "{{unsubscribeUrl}}", desc: "Unsubscribe link (bulk only)", bulk: true },
];

const EMAIL_TYPES: EmailType[] = [
  "PASSWORD_RESET", "WELCOME", "ACCOUNT", "NOTIFICATION",
  "NEW_RELEASE", "NEW_EPISODE", "ADMIN_ALERT", "SECURITY_ALERT",
  "FUTURE_CAMPAIGN", "ANNOUNCEMENT", "NOTIFY_ME_FOLLOWUP",
];

const INITIAL: TemplateResult = { error: undefined };

type Existing = {
  id:          string;
  name:        string;
  label:       string | null;
  description: string | null;
  type:        EmailType;
  subject:     string;
  preheader:   string | null;
  bodyHtml:    string;
  bodyText:    string | null;
  isActive:    boolean;
  isSystem:    boolean;
};

// ── Preview iframe (sandboxed, no scripts) ───────────────────────
function PreviewFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcdoc = html || "<p style='font-family:sans-serif;color:#888;padding:2rem'>Nothing to preview.</p>";
  }, [html]);
  return (
    <iframe
      ref={ref}
      className="tmpl-preview-frame"
      sandbox="allow-same-origin"
      title="Template HTML preview"
    />
  );
}

// ── Main component ───────────────────────────────────────────────
export default function TemplateForm({
  existing,
  redirectOnCreate,
}: {
  existing: Existing | null;
  redirectOnCreate?: boolean;
}) {
  const isNew = !existing;
  const action = isNew ? createTemplate : updateTemplate;

  const [state, formAction, saving] = useActionState<TemplateResult, FormData>(action, INITIAL);

  // Local form state for live preview
  const [tab, setTab]           = useState<"edit" | "preview">("edit");
  const [bodyHtml, setBodyHtml] = useState(existing?.bodyHtml ?? "");
  const [subject,  setSubject]  = useState(existing?.subject  ?? "");
  const [preheader, setPreheader] = useState(existing?.preheader ?? "");
  const [selType,  setSelType]  = useState<string>(existing?.type ?? "");

  // Sample variable values for preview
  const vars = VARS[selType] ?? DEFAULT_VARS;
  const [sampleVals, setSampleVals] = useState<Record<string, string>>({});

  function applyVars(html: string) {
    let out = html;
    for (const { v } of vars) {
      const key = v;
      const val = sampleVals[key] ?? key;
      out = out.split(key).join(val);
    }
    return out;
  }

  const renderedHtml = applyVars(bodyHtml);

  // Redirect after successful create
  const [, startT] = useTransition();
  useEffect(() => {
    if (!isNew || !state.id || !redirectOnCreate) return;
    startT(() => {
      window.location.href = `/admin/email/templates/${state.id}`;
    });
  }, [state.id, isNew, redirectOnCreate]);

  return (
    <div>
      {/* ── Tabs ── */}
      <div className="tmpl-tabs">
        <button
          className={`tmpl-tab${tab === "edit" ? " tmpl-tab--active" : ""}`}
          type="button"
          onClick={() => setTab("edit")}
        >
          Edit
        </button>
        <button
          className={`tmpl-tab${tab === "preview" ? " tmpl-tab--active" : ""}`}
          type="button"
          onClick={() => setTab("preview")}
          disabled={!bodyHtml}
        >
          Preview
        </button>
      </div>

      {/* ── Edit tab ── */}
      {tab === "edit" && (
        <form action={formAction} className="tmpl-form">
          {/* Hidden fields */}
          {!isNew && <input type="hidden" name="id" value={existing.id} />}

          {/* System warning */}
          {existing?.isSystem && (
            <div className="tmpl-system-warn">
              ⚠ This is a system template used for critical email flows. Editing the subject and
              body is allowed, but it cannot be deactivated or deleted. Avoid removing essential
              variables or disabling the email layout.
            </div>
          )}

          {state.error && <p className="tmpl-form-err">⚠ {state.error}</p>}
          {!state.error && state.id === undefined && !isNew && saving === false && (
            /* saved feedback is shown by parent after redirect — no-op here */
            null
          )}

          {/* Row: key (new only) + label */}
          <div className="tmpl-form-2col">
            {isNew ? (
              <div className="tmpl-form-field">
                <label className="tmpl-form-label">Key <span style={{ color: "var(--color-brand-red)" }}>*</span></label>
                <input
                  className="tmpl-form-input"
                  name="name"
                  placeholder="e.g. NEW_RELEASE_CUSTOM"
                  required
                  pattern="[A-Z0-9_]+"
                  title="Uppercase letters, numbers, underscores only"
                  style={{ textTransform: "uppercase" }}
                />
                <p className="tmpl-form-hint">Uppercase, underscores only. Cannot be changed after creation.</p>
              </div>
            ) : (
              <div className="tmpl-form-field">
                <span className="tmpl-form-label">Key</span>
                <p style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "var(--color-brand-accent)", margin: 0 }}>
                  {existing.name}
                </p>
                <p className="tmpl-form-hint">System key — cannot be changed.</p>
              </div>
            )}

            <div className="tmpl-form-field">
              <label className="tmpl-form-label">Display name <span className="tmpl-form-optional">(optional)</span></label>
              <input
                className="tmpl-form-input"
                name="label"
                defaultValue={existing?.label ?? ""}
                placeholder="e.g. New Release Announcement"
              />
            </div>
          </div>

          {/* Row: type + description */}
          <div className="tmpl-form-2col">
            <div className="tmpl-form-field">
              <label className="tmpl-form-label">Email type <span style={{ color: "var(--color-brand-red)" }}>*</span></label>
              {isNew ? (
                <select
                  className="tmpl-form-select"
                  name="type"
                  required
                  value={selType}
                  onChange={e => setSelType(e.target.value)}
                >
                  <option value="">— Select type —</option>
                  {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <>
                  <input type="hidden" name="type" value={existing.type} />
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-light)", margin: 0 }}>
                    {existing.type}
                  </p>
                </>
              )}
            </div>

            <div className="tmpl-form-field">
              <label className="tmpl-form-label">Description <span className="tmpl-form-optional">(optional)</span></label>
              <input
                className="tmpl-form-input"
                name="description"
                defaultValue={existing?.description ?? ""}
                placeholder="Internal note — not shown to recipients"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="tmpl-form-field">
            <label className="tmpl-form-label">Subject <span style={{ color: "var(--color-brand-red)" }}>*</span></label>
            <input
              className="tmpl-form-input"
              name="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              placeholder="e.g. {{workTitle}} is now available"
            />
          </div>

          {/* Preheader */}
          <div className="tmpl-form-field">
            <label className="tmpl-form-label">Preheader <span className="tmpl-form-optional">(optional)</span></label>
            <input
              className="tmpl-form-input"
              name="preheader"
              value={preheader}
              onChange={e => setPreheader(e.target.value)}
              placeholder="Preview text shown after subject in email clients"
            />
            <p className="tmpl-form-hint">Keep under 90 characters for best compatibility.</p>
          </div>

          {/* HTML body */}
          <div className="tmpl-form-field">
            <label className="tmpl-form-label">HTML body <span style={{ color: "var(--color-brand-red)" }}>*</span></label>
            <textarea
              className="tmpl-form-textarea tmpl-form-textarea--html"
              name="bodyHtml"
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              required
              placeholder={"<!DOCTYPE html>\n<html>...</html>"}
              spellCheck={false}
            />
          </div>

          {/* Plain text body */}
          <div className="tmpl-form-field">
            <label className="tmpl-form-label">Plain text body <span className="tmpl-form-optional">(optional)</span></label>
            <textarea
              className="tmpl-form-textarea tmpl-form-textarea--text"
              name="bodyText"
              defaultValue={existing?.bodyText ?? ""}
              placeholder="Plain text fallback for email clients that don't render HTML."
              spellCheck={false}
            />
          </div>

          {/* Variables reference */}
          {vars.length > 0 && (
            <div className="tmpl-vars-section">
              <p className="tmpl-vars-title">Available variables</p>
              <table className="tmpl-vars-table">
                <tbody>
                  {vars.map(({ v, desc, bulk }) => (
                    <tr key={v}>
                      <td style={{ color: bulk ? "#60a5fa" : undefined }}>{v}</td>
                      <td>{desc}{bulk ? <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#60a5fa" }}>bulk only</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Active toggle */}
          <div className="tmpl-form-field tmpl-toggle-row">
            <span className="tmpl-form-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.875rem", fontWeight: 500 }}>
              Active
            </span>
            {existing?.isSystem ? (
              <span className="tmpl-toggle tmpl-toggle-locked" title="System templates must remain active">
                <input type="hidden" name="isActive" value="1" />
                <span className="tmpl-toggle-track" style={{ background: "var(--color-brand-accent)", pointerEvents: "none" }} />
              </span>
            ) : (
              <ActiveToggle defaultActive={existing?.isActive ?? true} />
            )}
          </div>

          {/* Actions */}
          <div className="tmpl-form-actions">
            <button className="tmpl-save-btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : isNew ? "Create Template" : "Save Changes"}
            </button>
            {!state.error && !isNew && !saving && (
              <SavedFeedback key={JSON.stringify(state)} />
            )}
          </div>
        </form>
      )}

      {/* ── Preview tab ── */}
      {tab === "preview" && (
        <div className="tmpl-preview">
          {/* Subject/preheader */}
          <div className="tmpl-preview-meta">
            <div className="tmpl-preview-row">
              <span className="tmpl-preview-row-label">Subject</span>
              <span className="tmpl-preview-row-val">{applyVars(subject) || "—"}</span>
            </div>
            {preheader && (
              <div className="tmpl-preview-row">
                <span className="tmpl-preview-row-label">Preheader</span>
                <span className="tmpl-preview-row-val">{applyVars(preheader)}</span>
              </div>
            )}
          </div>

          {/* Sample variable inputs */}
          {vars.length > 0 && (
            <div className="tmpl-preview-sample">
              <p className="tmpl-preview-sample-title">Test with sample values</p>
              <div className="tmpl-preview-sample-grid">
                {vars.map(({ v, desc }) => (
                  <input
                    key={v}
                    placeholder={`${v} — ${desc}`}
                    value={sampleVals[v] ?? ""}
                    onChange={e => setSampleVals(prev => ({ ...prev, [v]: e.target.value }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rendered HTML preview */}
          <p className="tmpl-preview-html-label">Rendered HTML</p>
          <PreviewFrame html={renderedHtml} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function ActiveToggle({ defaultActive }: { defaultActive: boolean }) {
  const [active, setActive] = useState(defaultActive);
  return (
    <label className="tmpl-toggle">
      <input
        type="hidden"
        name="isActive"
        value={active ? "1" : "0"}
      />
      <input
        type="checkbox"
        checked={active}
        onChange={e => setActive(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span className="tmpl-toggle-track" />
    </label>
  );
}

function SavedFeedback() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return <p className="tmpl-form-ok">✓ Saved</p>;
}
