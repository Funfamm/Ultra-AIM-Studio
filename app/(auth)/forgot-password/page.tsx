import { forgotPassword } from "@/lib/actions/auth";
import Link from "next/link";
import type { Metadata } from "next";
import "./forgot.css";

export const metadata: Metadata = { title: "Forgot Password — AIM Studio" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-sub">
            Enter your email and we&apos;ll send you a verification code.
          </p>
        </div>

        {params?.error && (
          <div className="auth-error">{params.error}</div>
        )}

        <form action={forgotPassword} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className="auth-btn">Send Verification Code</button>
        </form>

        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
