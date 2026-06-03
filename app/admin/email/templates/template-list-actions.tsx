"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleTemplateActive, duplicateTemplate, deleteTemplate } from "@/lib/actions/email-templates";

type Props = {
  id:       string;
  isActive: boolean;
  isSystem: boolean;
};

export default function TemplateListActions({ id, isActive, isSystem }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function handleToggle() {
    setMsg(null);
    startTransition(async () => {
      const r = await toggleTemplateActive(id, !isActive);
      if (r.error) setMsg(r.error);
      else router.refresh();
    });
  }

  function handleDuplicate() {
    setMsg(null);
    startTransition(async () => {
      const r = await duplicateTemplate(id);
      if (r.error) { setMsg(r.error); return; }
      router.push(`/admin/email/templates/${r.id}`);
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setMsg(null);
    startTransition(async () => {
      const r = await deleteTemplate(id);
      if (r.error) { setMsg(r.error); setConfirmDelete(false); return; }
      router.refresh();
    });
  }

  return (
    <span className="tmpl-actions">
      {msg && <span style={{ fontSize: "0.75rem", color: "var(--color-brand-red)" }}>{msg}</span>}

      {!isSystem && (
        <button
          className="tmpl-action-btn"
          onClick={handleToggle}
          disabled={pending}
        >
          {isActive ? "Deactivate" : "Activate"}
        </button>
      )}

      <button
        className="tmpl-action-btn"
        onClick={handleDuplicate}
        disabled={pending}
      >
        Duplicate
      </button>

      {!isSystem && (
        <button
          className={`tmpl-action-btn${confirmDelete ? " tmpl-action-btn--danger" : ""}`}
          onClick={handleDelete}
          disabled={pending}
        >
          {confirmDelete ? "Confirm delete" : "Delete"}
        </button>
      )}

      {confirmDelete && (
        <button
          className="tmpl-action-btn"
          onClick={() => setConfirmDelete(false)}
          disabled={pending}
        >
          Cancel
        </button>
      )}
    </span>
  );
}
