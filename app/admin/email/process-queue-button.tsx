"use client";

import { useState, useTransition } from "react";
import { triggerEmailQueueBatch } from "@/lib/actions/email-queue";
import type { QueueProcessResult } from "@/lib/actions/email-queue";

export default function ProcessQueueButton({ queuedCount }: { queuedCount: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<QueueProcessResult | null>(null);

  function handleProcess() {
    setResult(null);
    startTransition(async () => {
      const r = await triggerEmailQueueBatch();
      setResult(r);
    });
  }

  const hasQueue = queuedCount > 0;

  return (
    <div>
      <div className="email-test-wrap">
        <button
          className="email-test-btn"
          onClick={handleProcess}
          disabled={pending || !hasQueue}
        >
          {pending
            ? "Processing…"
            : hasQueue
              ? `Process Queue (${queuedCount} queued)`
              : "Queue is empty"}
        </button>
        {result && !result.error && (
          <p className="email-test-ok">
            ✓ Processed {result.processed} — {result.sent} sent
            {result.failed > 0 ? `, ${result.failed} failed` : ""}
            {result.remaining > 0 ? ` · ${result.remaining} remaining` : " · Queue clear"}
          </p>
        )}
        {result?.error && (
          <p className="email-test-err">⚠ {result.error}</p>
        )}
      </div>
    </div>
  );
}
