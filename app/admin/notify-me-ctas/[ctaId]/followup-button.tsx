"use client";

import { useState, useTransition } from "react";
import { sendNotifyMeFollowupEmails } from "@/lib/actions/notify-me-followup";
import type { FollowupResult } from "@/lib/actions/notify-me-followup";

type Props = {
  ctaId:       string;
  signupCount: number;
  acsReady:    boolean;
};

export default function FollowupButton({ ctaId, signupCount, acsReady }: Props) {
  const [pending, startTransition] = useTransition();
  const [result,  setResult]       = useState<FollowupResult | null>(null);
  const [confirmed, setConfirmed]  = useState(false);

  function handleSend() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setResult(null);
    setConfirmed(false);
    startTransition(async () => {
      const r = await sendNotifyMeFollowupEmails(ctaId);
      setResult(r);
    });
  }

  const canSend = acsReady && signupCount > 0;

  return (
    <div className="cta-followup">
      {!canSend && (
        <p className="cta-followup-warn">
          {!acsReady
            ? "⚠ ACS bulk email provider is not configured. Set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS."
            : "No signups to email."}
        </p>
      )}

      {canSend && (
        <>
          <p className="cta-followup-desc">
            Queues a <strong>release-ready email</strong> to {signupCount} signup{signupCount === 1 ? "" : "s"}.
            Suppressed addresses and opted-out users are automatically skipped.
            Emails are sent when the queue is processed from the Email page.
          </p>

          {confirmed && !pending && (
            <p className="cta-followup-confirm">
              Send follow-up emails to {signupCount} address{signupCount === 1 ? "" : "es"}?
              Click again to confirm.
            </p>
          )}

          <button
            className={`cta-followup-btn${confirmed ? " cta-followup-btn--confirm" : ""}`}
            onClick={handleSend}
            disabled={pending}
          >
            {pending
              ? "Queuing…"
              : confirmed
                ? "Confirm — Queue Emails"
                : "Send Follow-up Emails"}
          </button>

          {confirmed && !pending && (
            <button
              className="cta-followup-cancel"
              onClick={() => setConfirmed(false)}
            >
              Cancel
            </button>
          )}
        </>
      )}

      {result && !result.error && (
        <p className="cta-followup-ok">
          ✓ {result.queued} email{result.queued === 1 ? "" : "s"} queued
          {result.suppressed > 0 ? ` · ${result.suppressed} suppressed` : ""}
          {result.skipped   > 0 ? ` · ${result.skipped} skipped` : ""}
          {" · "}Process from the Email page to send.
        </p>
      )}
      {result?.error && (
        <p className="cta-followup-err">⚠ {result.error}</p>
      )}
    </div>
  );
}
