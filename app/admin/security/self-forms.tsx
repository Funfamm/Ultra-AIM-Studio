"use client";

import { useActionState, useState } from "react";
import { updateAdminDisplayName, updateAdminPassword } from "@/lib/actions/admin-security";
import { PasswordInput } from "@/components/password-input";

// ── Display Name Form ─────────────────────────────────────────
export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, action, pending] = useActionState(updateAdminDisplayName, null);

  return (
    <form action={action} className="sec-mgmt-form">
      <div className="sec-field">
        <label className="sec-field-label">New Display Name</label>
        <input
          name="name"
          type="text"
          required
          defaultValue={currentName}
          placeholder="Your name"
          className="sec-field-input"
          disabled={pending}
        />
      </div>
      {state?.error && <p className="sec-form-error">{state.error}</p>}
      {state?.ok && !state.error && <p className="sec-form-ok">Display name updated.</p>}
      <button type="submit" disabled={pending} className="sec-mgmt-btn">
        {pending ? "Saving…" : "Save Name"}
      </button>
    </form>
  );
}

// ── Password strength grader ──────────────────────────────────
function strengthLabel(pw: string): { label: string; cls: string } {
  if (pw.length === 0) return { label: "", cls: "" };
  if (pw.length < 8)   return { label: "Too short", cls: "sec-pw-str--weak" };
  if (pw.length < 12)  return { label: "Acceptable",   cls: "sec-pw-str--ok" };
  return                      { label: "Strong",     cls: "sec-pw-str--strong" };
}

// ── Password Form ─────────────────────────────────────────────
export function PasswordForm() {
  const [state, action, pending] = useActionState(updateAdminPassword, null);
  const [newPw, setNewPw] = useState("");
  const strength = strengthLabel(newPw);

  return (
    <form action={action} className="sec-mgmt-form">
      <div className="sec-field">
        <label className="sec-field-label">Current Password</label>
        <PasswordInput
          name="currentPassword"
          inputClassName="sec-field-input"
          required
          placeholder="Enter current password"
          autoComplete="current-password"
          disabled={pending}
        />
      </div>
      <div className="sec-field">
        <label className="sec-field-label">New Password</label>
        <PasswordInput
          name="newPassword"
          inputClassName="sec-field-input"
          required
          minLength={8}
          placeholder="Min 8 characters"
          autoComplete="new-password"
          disabled={pending}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        {strength.label && (
          <span className={`sec-pw-str ${strength.cls}`}>{strength.label}</span>
        )}
      </div>
      <div className="sec-field">
        <label className="sec-field-label">Confirm New Password</label>
        <PasswordInput
          name="confirmPassword"
          inputClassName="sec-field-input"
          required
          placeholder="Re-enter new password"
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      {state?.error && <p className="sec-form-error">{state.error}</p>}
      {state?.ok && !state.error && <p className="sec-form-ok">Password updated. Sign in again on other devices.</p>}
      <button type="submit" disabled={pending} className="sec-mgmt-btn">
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
