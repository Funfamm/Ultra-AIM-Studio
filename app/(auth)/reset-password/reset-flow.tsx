"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import { verifyResetCode, resetPassword } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/password-input";

interface Props {
  email?: string;
  token?: string;
}

export function ResetPasswordFlow({ email, token }: Props) {
  // Token flow (admin-initiated): skip step 2, show password form directly
  if (token) {
    return <TokenFlow token={token} />;
  }

  // Code flow (user-initiated): step 2 → step 3
  return <CodeFlow email={email!} />;
}

// ── Admin link flow — password form only ──────────────────────

function TokenFlow({ token }: { token: string }) {
  return (
    <>
      <h1 className="auth-title">Choose a New Password</h1>
      <p className="auth-sub">Must be at least 8 characters.</p>

      <form action={resetPassword} className="auth-form" style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="token" value={token} />

        <div className="form-group">
          <label className="form-label">New password</label>
          <PasswordInput
            name="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Confirm new password</label>
          <PasswordInput
            name="confirm"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button type="submit" className="auth-btn">Update Password</button>
      </form>

      <p className="auth-switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}

// ── User code flow — step 2 then step 3 ───────────────────────

function CodeFlow({ email }: { email: string }) {
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);

  if (verifiedCode) {
    return <PasswordStep email={email} code={verifiedCode} onStartOver={() => setVerifiedCode(null)} />;
  }

  return <CodeStep email={email} onVerified={(code) => setVerifiedCode(code)} />;
}

// ── Step 2: Verify code ───────────────────────────────────────

function CodeStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (code: string) => void;
}) {
  const [state, formAction, pending] = useActionState(verifyResetCode, null);
  const [codeValue, setCodeValue] = useState("");

  // When server confirms code is valid, transition to step 3
  useEffect(() => {
    if (state?.valid && codeValue) {
      onVerified(codeValue);
    }
  }, [state, codeValue, onVerified]);

  return (
    <>
      <h1 className="auth-title">Enter Verification Code</h1>
      <p className="auth-sub">
        Enter the 6-digit code sent to your email.
      </p>

      {state?.error && (
        <div className="auth-error" style={{ marginTop: "1.25rem" }}>{state.error}</div>
      )}

      <form action={formAction} className="auth-form" style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="email" value={email} />

        <div className="form-group">
          <label className="form-label">Verification code</label>
          <input
            type="text"
            name="code"
            className="form-input code-input"
            placeholder="000000"
            required
            maxLength={6}
            minLength={6}
            pattern="[0-9]{6}"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={pending}
            value={codeValue}
            onChange={(e) => {
              // Only allow digits
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCodeValue(v);
            }}
          />
        </div>

        <button type="submit" className="auth-btn" disabled={pending}>
          {pending ? "Verifying…" : "Verify Code"}
        </button>
      </form>

      <p className="auth-resend">
        Didn&apos;t receive a code?{" "}
        <Link href="/forgot-password">Send again</Link>
      </p>

      <p className="auth-switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}

// ── Step 3: Set new password ──────────────────────────────────

function PasswordStep({
  email,
  code,
  onStartOver,
}: {
  email: string;
  code: string;
  onStartOver: () => void;
}) {
  return (
    <>
      <h1 className="auth-title">Choose a New Password</h1>
      <p className="auth-sub">Must be at least 8 characters.</p>

      <form action={resetPassword} className="auth-form" style={{ marginTop: "1.5rem" }}>
        {/* Code + email sent with password — server re-validates the code */}
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />

        <div className="form-group">
          <label className="form-label">New password</label>
          <PasswordInput
            name="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Confirm new password</label>
          <PasswordInput
            name="confirm"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button type="submit" className="auth-btn">Update Password</button>
      </form>

      <p className="auth-resend">
        <button
          type="button"
          className="auth-link-btn"
          onClick={onStartOver}
        >
          Start over
        </button>
      </p>

      <p className="auth-switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}
