"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { saveWork, unsaveWork } from "@/lib/actions/watchlist";
import "./save-button.css";

type Props = {
  workId: string;
  initialSaved: boolean;
  className?: string;
};

export default function SaveButton({ workId, initialSaved, className = "save-btn" }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        if (next) await saveWork(workId);
        else await unsaveWork(workId);
      } catch {
        setSaved(!next); // revert on error
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={className}
      aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
      aria-pressed={saved}
    >
      {saved
        ? <BookmarkCheck size={14} />
        : <Bookmark size={14} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
