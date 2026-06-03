import { signInWithGoogle } from "@/lib/actions/auth";
import Link from "next/link";
import { Film, Bookmark, Bell } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RegisterForm } from "./register-form";
import "./register.css";

export const metadata: Metadata = { title: "Join the Studio — AIM Studio" };

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.593C4.672 4.466 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Node.js runtime — full DB check; clears stale cookies for purged users.
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  return (
    <main className="auth-page">
      <div className="auth-card">

        {/* Brand */}
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Join the Studio</h1>
        </div>

        {/* Value pills */}
        <ul className="auth-perks">
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true"><Film size={13} /></span>
            Watch free
          </li>
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true"><Bookmark size={13} /></span>
            Save what moves you
          </li>
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true"><Bell size={13} /></span>
            Be first to know
          </li>
        </ul>

        {/* Google — shown first */}
        <form action={signInWithGoogle}>
          <button type="submit" className="auth-btn-google">
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <div className="auth-divider"><span>or create an account</span></div>

        {/* Client form — handles confirm password + show/hide toggles */}
        <RegisterForm error={params?.error} />

        <p className="auth-switch">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>

      </div>
    </main>
  );
}
