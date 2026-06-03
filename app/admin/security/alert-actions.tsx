"use client";

import { useTransition } from "react";
import { resolveAlert, dismissAlert } from "@/lib/actions/security";

export function AlertActions({ alertId }: { alertId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="sec-alert-actions">
      <button
        onClick={() => startTransition(() => resolveAlert(alertId))}
        disabled={isPending}
        className="sec-alert-btn sec-alert-btn--resolve"
      >
        Resolve
      </button>
      <button
        onClick={() => startTransition(() => dismissAlert(alertId))}
        disabled={isPending}
        className="sec-alert-btn sec-alert-btn--dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
