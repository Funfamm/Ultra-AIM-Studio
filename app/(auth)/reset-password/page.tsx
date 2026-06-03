import Link from "next/link";
import type { Metadata } from "next";
import { ResetPasswordFlow } from "./reset-flow";
import "./reset.css";

export const metadata: Metadata = { title: "Reset Password — AIM Studio" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token?.trim();
  const email = params?.email?.trim();

  // Neither token nor email — show a generic invalid message
  if (!token && !email) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
            <h1 className="auth-title">Reset Password</h1>
          </div>
          <p className="auth-invalid">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password">Request a new one.</Link>
          </p>
        </div>
      </main>
    );
  }

  // Token flow (admin-initiated): skip code verification, go straight to password
  // Code flow (user-initiated): multi-step — verify code first, then set password
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
        </div>

        {params?.error && (
          <div className="auth-error">{params.error}</div>
        )}

        <ResetPasswordFlow email={email} token={token} />
      </div>
    </main>
  );
}
