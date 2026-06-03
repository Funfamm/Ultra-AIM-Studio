"use client";

import { useActionState } from "react";
import { saveSecurityPolicySettings } from "@/lib/actions/settings";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="stg-save-btn" disabled={pending}>
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

function StgCheck({
  name, defaultChecked, label, note,
}: {
  name: string; defaultChecked: boolean; label: string; note?: string;
}) {
  return (
    <label className="stg-check-row">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="stg-checkbox" />
      <span className="stg-check-text">
        <span className="stg-check-label">{label}</span>
        {note && <span className="stg-check-note">{note}</span>}
      </span>
    </label>
  );
}

type State = { ok: boolean; error?: string } | null;

export function SecurityPoliciesForm({
  failedLoginWindowMinutes,
  failedLoginMaxAttempts,
  loginCooldownMinutes,
  notifyUserOnNewDevice,
  notifyUserOnNewLocation,
  notifyAdminOnSuspiciousAdminLogin,
  allowUserDeviceTrust,
  requireReauthForSensitiveActions,
  allowHardPurgeForSuperAdmin,
}: {
  failedLoginWindowMinutes: number;
  failedLoginMaxAttempts: number;
  loginCooldownMinutes: number;
  notifyUserOnNewDevice: boolean;
  notifyUserOnNewLocation: boolean;
  notifyAdminOnSuspiciousAdminLogin: boolean;
  allowUserDeviceTrust: boolean;
  requireReauthForSensitiveActions: boolean;
  allowHardPurgeForSuperAdmin: boolean;
}) {
  const [state, formAction] = useActionState<State, FormData>(
    async (_prev, fd) => saveSecurityPolicySettings(fd),
    null
  );

  return (
    <form action={formAction} className="stg-section">
      <div className="stg-section-hd">
        <h2 className="stg-section-title">Login Throttle &amp; Security Policies</h2>
        <p className="stg-section-desc">
          Configure rate limiting thresholds, device tracking, and notification behaviour.
        </p>
      </div>

      {/* Rate limiting */}
      <div className="stg-field-row">
        <div className="stg-field">
          <label className="stg-field-label">Failure window (minutes)</label>
          <span className="stg-field-note">Lookback window for counting failed logins</span>
          <input
            type="number"
            name="failedLoginWindowMinutes"
            min={1}
            max={1440}
            defaultValue={failedLoginWindowMinutes}
            className="stg-input"
          />
        </div>
        <div className="stg-field">
          <label className="stg-field-label">Max attempts before cooldown</label>
          <span className="stg-field-note">Block after this many failures in the window</span>
          <input
            type="number"
            name="failedLoginMaxAttempts"
            min={1}
            max={50}
            defaultValue={failedLoginMaxAttempts}
            className="stg-input"
          />
        </div>
        <div className="stg-field">
          <label className="stg-field-label">Cooldown duration (minutes)</label>
          <span className="stg-field-note">Block duration once threshold is hit</span>
          <input
            type="number"
            name="loginCooldownMinutes"
            min={1}
            max={1440}
            defaultValue={loginCooldownMinutes}
            className="stg-input"
          />
        </div>
      </div>

      {/* Notification toggles */}
      <div className="stg-fields" style={{ marginTop: "1.25rem" }}>
        <StgCheck
          name="notifyUserOnNewDevice"
          defaultChecked={notifyUserOnNewDevice}
          label="Notify user on new device login"
          note="Email + in-app alert when a new device fingerprint is seen"
        />
        <StgCheck
          name="notifyUserOnNewLocation"
          defaultChecked={notifyUserOnNewLocation}
          label="Notify user on new location login"
          note="Alert when a sign-in originates from a new country"
        />
        <StgCheck
          name="notifyAdminOnSuspiciousAdminLogin"
          defaultChecked={notifyAdminOnSuspiciousAdminLogin}
          label="Alert admin on suspicious admin sign-in"
        />
      </div>

      {/* Feature policy toggles */}
      <div className="stg-fields" style={{ marginTop: "0.75rem" }}>
        <StgCheck
          name="allowUserDeviceTrust"
          defaultChecked={allowUserDeviceTrust}
          label="Enable device trust tracking"
          note="Fingerprint and remember user devices across sessions"
        />
        <StgCheck
          name="requireReauthForSensitiveActions"
          defaultChecked={requireReauthForSensitiveActions}
          label="Require re-authentication for sensitive actions"
          note="Future — not yet enforced"
        />
        <StgCheck
          name="allowHardPurgeForSuperAdmin"
          defaultChecked={allowHardPurgeForSuperAdmin}
          label="Allow hard purge (permanent user deletion)"
          note="Admins can permanently erase all user data via the Users page"
        />
      </div>

      {state && !state.ok && <p className="stg-error">{state.error}</p>}
      {state?.ok && <p className="stg-success">Saved.</p>}

      <div className="stg-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
