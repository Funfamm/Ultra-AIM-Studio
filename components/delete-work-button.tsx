"use client";

import { Trash2 } from "lucide-react";
import { deleteWork } from "@/lib/actions/works";

export function DeleteWorkButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteWork.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Delete "${title}"?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="action-btn action-btn--danger" title="Delete">
        <Trash2 size={14} />
      </button>
    </form>
  );
}
