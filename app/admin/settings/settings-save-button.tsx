"use client";
import { useFormStatus } from "react-dom";

export function SaveButton({ label = "Save Changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="stg-save-btn" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}
