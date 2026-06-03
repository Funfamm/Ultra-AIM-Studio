"use client";

import { useState, useTransition } from "react";
import { testGraphEmail } from "@/lib/actions/email-admin";

export default function TestEmailButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleTest() {
    setResult(null);
    startTransition(async () => {
      const res = await testGraphEmail();
      setResult(res);
    });
  }

  return (
    <div className="email-test-wrap">
      <button
        onClick={handleTest}
        disabled={pending}
        className="email-test-btn"
      >
        {pending ? "Sending…" : "Test Graph Email"}
      </button>
      {result && (
        <p className={result.ok ? "email-test-ok" : "email-test-err"}>
          {result.ok ? "✓ " : "✗ "}{result.message}
        </p>
      )}
    </div>
  );
}
