"use client";

import { useTransition, useState } from "react";
import { sendNewReleaseEmail, sendNewEpisodeEmail } from "@/lib/actions/release-email";
import type { ReleaseEmailResult } from "@/lib/actions/release-email";
import { Mail } from "lucide-react";

type Props = {
  workId:    string;
  emailType: "release" | "episode";
  acsReady:  boolean;
};

const INITIAL: ReleaseEmailResult = { queued: 0, suppressed: 0, skipped: 0 };

export default function ReleaseEmailButton({ workId, emailType, acsReady }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed]  = useState(false);
  const [result, setResult]        = useState<ReleaseEmailResult | null>(null);

  const label   = emailType === "release" ? "Send Release Email" : "Send Episode Email";
  const confirm = emailType === "release" ? "Confirm — Queue Release Email" : "Confirm — Queue Episode Email";

  function handleClick() {
    if (!confirmed) { setConfirmed(true); return; }
    setResult(null);
    setConfirmed(false);
    startTransition(async () => {
      const r = emailType === "release"
        ? await sendNewReleaseEmail(workId)
        : await sendNewEpisodeEmail(workId);
      setResult(r);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {!acsReady && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#f59e0b", margin: 0 }}>
          ⚠ Bulk email provider (ACS) is not configured. Configure ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS to enable.
        </p>
      )}

      {acsReady && (
        <>
          {confirmed && !pending && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-light)", margin: 0 }}>
              This will queue a bulk email to all opted-in registered users. Process the queue from
              {" "}<a href="/admin/email" style={{ color: "var(--color-brand-accent)" }}>/admin/email</a> to send.
              Click again to confirm.
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleClick}
              disabled={pending || !!result?.queued}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: 600,
                color: confirmed ? "#0a0a0a" : "var(--color-brand-black)",
                background: confirmed ? "#f59e0b" : "var(--color-brand-accent)",
                border: "none", borderRadius: 2,
                padding: "0.5rem 1.1rem", cursor: (pending || !!result?.queued) ? "not-allowed" : "pointer",
                opacity: (pending || !!result?.queued) ? 0.55 : 1,
                transition: "filter 0.15s",
              }}
            >
              <Mail size={13} />
              {pending ? "Queuing…" : confirmed ? confirm : label}
            </button>

            {confirmed && !pending && (
              <button
                onClick={() => setConfirmed(false)}
                style={{
                  fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                  color: "var(--color-brand-muted)", background: "none",
                  border: "none", cursor: "pointer", padding: 0,
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {result && !result.error && (
        <p style={{
          fontFamily: "var(--font-body)", fontSize: "0.8125rem",
          color: "#4ade80", margin: 0,
          padding: "0.45rem 0.75rem",
          background: "rgba(74,222,128,0.08)", borderRadius: 3,
        }}>
          ✓ {result.queued} email{result.queued === 1 ? "" : "s"} queued
          {result.suppressed > 0 ? ` · ${result.suppressed} suppressed` : ""}
          {result.skipped    > 0 ? ` · ${result.skipped} skipped` : ""}
          {" · "}Process from{" "}
          <a href="/admin/email" style={{ color: "#4ade80" }}>Admin → Email</a>.
        </p>
      )}
      {result?.error && (
        <p style={{
          fontFamily: "var(--font-body)", fontSize: "0.8125rem",
          color: "var(--color-brand-red)", margin: 0,
          padding: "0.45rem 0.75rem",
          background: "rgba(192,57,43,0.1)", borderRadius: 3,
        }}>
          ⚠ {result.error}
        </p>
      )}
    </div>
  );
}
