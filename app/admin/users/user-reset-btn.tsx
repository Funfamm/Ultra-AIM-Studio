"use client";

import { useActionState } from "react";
import { sendPasswordResetToUser } from "@/lib/actions/users-admin";

type State = { ok: boolean; message: string } | null;

export function UserResetBtn({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState<State, FormData>(
    (prev, fd) => sendPasswordResetToUser(userId, prev, fd),
    null
  );

  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
      <button
        type="submit"
        disabled={isPending || state?.ok === true}
        className="action-btn"
        title={state?.message ?? "Send password reset email"}
        style={{ fontSize: "0.75rem", letterSpacing: 0 }}
      >
        {isPending ? "…" : "↺"}
      </button>
      {state && (
        <span
          className={state.ok ? "ureset-ok" : "ureset-err"}
          title={state.message}
        >
          {state.ok ? "✓" : "✗"}
        </span>
      )}
    </form>
  );
}
