"use client";

import { useActionState } from "react";
import { saveSecuritySettings } from "@/lib/actions/settings";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="stg-save-btn" disabled={pending}>
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

type State = { ok: boolean; error?: string } | null;

export function SecurityForm({
  allowGoogleSignIn,
  allowCredentialsSignIn,
  allowNewRegistrations,
}: {
  allowGoogleSignIn: boolean;
  allowCredentialsSignIn: boolean;
  allowNewRegistrations: boolean;
}) {
  const [state, formAction] = useActionState<State, FormData>(
    async (_prev, fd) => saveSecuritySettings(fd),
    null
  );

  return (
    <form action={formAction} className="stg-section">
      <div className="stg-section-hd">
        <h2 className="stg-section-title">Security &amp; Authentication</h2>
        <p className="stg-section-desc">Control how users sign in and register.</p>
      </div>

      <div className="stg-fields">
        <StgCheck name="allowGoogleSignIn" defaultChecked={allowGoogleSignIn}
          label="Allow Google Sign-In" note="OAuth via Google provider" />
        <StgCheck name="allowCredentialsSignIn" defaultChecked={allowCredentialsSignIn}
          label="Allow Email &amp; Password Sign-In" note="Credentials provider (bcrypt)" />
        <StgCheck name="allowNewRegistrations" defaultChecked={allowNewRegistrations}
          label="Allow New Registrations" note="Uncheck to freeze public sign-ups" />
      </div>

      {state && !state.ok && (
        <p className="stg-error">{state.error}</p>
      )}
      {state?.ok && (
        <p className="stg-success">Saved.</p>
      )}

      <div className="stg-actions">
        <SubmitButton />
        <span className="stg-caution">
          Disabling both sign-in methods will lock all users out.
        </span>
      </div>
    </form>
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
        <span className="stg-check-label" dangerouslySetInnerHTML={{ __html: label }} />
        {note && <span className="stg-check-note">{note}</span>}
      </span>
    </label>
  );
}
