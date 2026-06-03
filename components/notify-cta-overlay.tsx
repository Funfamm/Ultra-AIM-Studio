"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { notifyMeSignup } from "@/lib/actions/notify-cta";
import { beacon } from "@/lib/beacon";
import "./notify-cta-overlay.css";

export type CtaData = {
  id: string;
  type: string;
  headline: string;
  body: string | null;
  ctaLabel: string;
  triggerSecondsFromEnd: number;
  workId: string;
  workTitle: string | null;
};

type Props = {
  cta: CtaData;
  onDismiss: () => void;
  /** If provided, the user is logged in — skip email/name form, show one-click confirm */
  ctaUser?: { email: string; name: string | null };
};

const TYPE_BADGE: Record<string, string> = {
  RELEASE:      "Coming Soon",
  MORE:         "More on the Way",
  POST_RELEASE: "What's Next",
};

export default function NotifyMeCtaOverlay({ cta, onDismiss, ctaUser }: Props) {
  const [email, setEmail]   = useState("");
  const [name, setName]     = useState("");
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [pending, start]    = useTransition();

  const isLoggedIn = !!ctaUser;

  function fireSignup(submittedEmail: string, submittedName?: string) {
    start(async () => {
      const res = await notifyMeSignup(
        cta.id, cta.workId, cta.workTitle, submittedEmail, submittedName
      );
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      try { localStorage.setItem(`aim_cta_signed_${cta.id}`, "1"); } catch {}
      beacon("CTA_SIGNUP", { workId: cta.workId, metadata: { ctaId: cta.id } });
      setDone(true);
      setTimeout(onDismiss, 2400);
    });
  }

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    fireSignup(email, name || undefined);
  }

  function handleLoggedInClick() {
    setError(null);
    fireSignup(ctaUser!.email, ctaUser!.name ?? undefined);
  }

  return (
    // stopPropagation prevents touch/click events on form inputs from bubbling
    // to the AimPlayer wrapper's onTouchStart={reveal}, which was hijacking
    // taps on Name/Email fields and showing the player overlay instead of
    // focusing the input.
    <div
      className="ncta-overlay"
      role="dialog"
      aria-label="Stay in the loop"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button className="ncta-close" onClick={onDismiss} aria-label="Dismiss">
        <X size={13} />
      </button>

      <span className="ncta-badge">{TYPE_BADGE[cta.type] ?? cta.type}</span>

      {done ? (
        <div className="ncta-done">
          <p className="ncta-done-msg">You&apos;re on the list.</p>
        </div>
      ) : isLoggedIn ? (
        /* ── Logged-in: one-click confirm — no form fields ── */
        <>
          <p className="ncta-headline">{cta.headline}</p>
          {cta.body && <p className="ncta-body">{cta.body}</p>}
          {error && <p className="ncta-error">{error}</p>}
          <button
            className="ncta-btn"
            onClick={handleLoggedInClick}
            disabled={pending}
          >
            {pending ? "…" : cta.ctaLabel}
          </button>
        </>
      ) : (
        /* ── Guest: email + optional name form ── */
        <>
          <p className="ncta-headline">{cta.headline}</p>
          {cta.body && <p className="ncta-body">{cta.body}</p>}

          <form className="ncta-form" onSubmit={handleGuestSubmit}>
            <input
              className="ncta-input"
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              autoComplete="name"
            />
            <input
              className="ncta-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={pending}
              autoComplete="email"
            />
            {error && <p className="ncta-error">{error}</p>}
            <button className="ncta-btn" type="submit" disabled={pending}>
              {pending ? "…" : cta.ctaLabel}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
