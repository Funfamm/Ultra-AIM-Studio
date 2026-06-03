"use client";

import { useState } from "react";
import Link from "next/link";
import { registerUser } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/password-input";

export function RegisterForm({ error }: { error?: string }) {
  const [matchError, setMatchError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const pw      = fd.get("password")        as string;
    const confirm = fd.get("confirmPassword") as string;

    if (pw !== confirm) {
      e.preventDefault();
      setMatchError("Passwords do not match.");
    } else {
      setMatchError(null);
    }
  }

  return (
    <>
      {error && <div className="auth-error">{error}</div>}

      <form action={registerUser} onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label">
            Name <span className="form-optional">(optional)</span>
          </label>
          <input
            type="text"
            name="name"
            className="form-input"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            name="email"
            className="form-input"
            placeholder="your@email.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <PasswordInput
            name="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <PasswordInput
            name="confirmPassword"
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />
          {matchError && (
            <p className="pw-match-error" role="alert">{matchError}</p>
          )}
        </div>

        <button type="submit" className="auth-btn">Create Account</button>
        <p className="auth-fine-print">
          By joining, you agree to our{" "}
          <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </form>
    </>
  );
}
