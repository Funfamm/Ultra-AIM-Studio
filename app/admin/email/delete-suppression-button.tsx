"use client";

import { useTransition } from "react";
import { deleteSuppression } from "@/lib/actions/email-admin";

export default function DeleteSuppressionButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Permanently delete suppression record for ${email}?`)) return;
    startTransition(() => deleteSuppression(email));
  }

  return (
    <button
      disabled={pending}
      className="email-sup-remove email-sup-remove--del"
      onClick={handleDelete}
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
