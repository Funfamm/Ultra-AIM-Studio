"use client";

import { useActionState } from "react";
import { createPowerAdmin } from "@/lib/actions/admin-security";
import { PasswordInput } from "@/components/password-input";

const INIT = { ok: false as boolean, error: undefined as string | undefined, message: undefined as string | undefined };

export default function CreateAdminForm() {
  const [state, action, pending] = useActionState(createPowerAdmin, null);

  return (
    <form action={action} className="sec-mgmt-form">
      <div className="sec-mgmt-fields">
        <div className="sec-field">
          <label className="sec-field-label">Full Name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Jane Doe"
            className="sec-field-input"
            disabled={pending}
          />
        </div>
        <div className="sec-field">
          <label className="sec-field-label">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="admin@example.com"
            className="sec-field-input"
            disabled={pending}
          />
        </div>
        <div className="sec-field">
          <label className="sec-field-label">Password (min 8 chars)</label>
          <PasswordInput
            name="password"
            inputClassName="sec-field-input"
            required
            minLength={8}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            disabled={pending}
          />
        </div>
      </div>

      {state?.error   && <p className="sec-form-error">{state.error}</p>}
      {state?.message && <p className="sec-form-ok">{state.message}</p>}

      <p className="sec-form-hint">
        If the email already belongs to a Member, they will be promoted instead of a new account being created.
      </p>

      <button type="submit" disabled={pending} className="sec-mgmt-btn">
        {pending ? "Creating…" : "🛡️ Create Power Admin"}
      </button>
    </form>
  );
}
