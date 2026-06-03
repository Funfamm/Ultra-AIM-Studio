"use client";

import { useTransition } from "react";
import { demoteAdmin } from "@/lib/actions/admin-security";

interface Props {
  adminId: string;
  adminName: string;
}

export default function DemoteAdminButton({ adminId, adminName }: Props) {
  const [pending, startTransition] = useTransition();

  function handleDemote() {
    if (!confirm(`Demote ${adminName} to Member? Their admin session will end immediately.`)) return;
    startTransition(async () => {
      const result = await demoteAdmin(adminId);
      if (!result.ok) alert(result.error ?? "Failed to demote admin.");
    });
  }

  return (
    <button
      onClick={handleDemote}
      disabled={pending}
      className="sec-demote-btn"
    >
      {pending ? "…" : "Demote"}
    </button>
  );
}
