"use client";

import { useTransition } from "react";
import { removeSuppression } from "@/lib/actions/email-admin";

export default function RemoveSuppressionButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      className="email-sup-remove"
      onClick={() => startTransition(() => removeSuppression(email))}
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
