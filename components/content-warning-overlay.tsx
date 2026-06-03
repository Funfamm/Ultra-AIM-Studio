"use client";

import { useState, useEffect } from "react";

const DESCRIPTOR_LABELS: Record<string, string> = {
  VIOLENCE:          "Violence",
  STRONG_LANGUAGE:   "Strong Language",
  MILD_LANGUAGE:     "Mild Language",
  NUDITY:            "Nudity",
  SEXUAL_CONTENT:    "Sexual Content",
  DRUG_USE:          "Drug Use",
  ALCOHOL:           "Alcohol Use",
  SMOKING:           "Smoking",
  FRIGHTENING:       "Frightening Scenes",
  THEMATIC_ELEMENTS: "Thematic Elements",
};

// Props contain only serializable values — no function props.
// Plain functions cannot cross the server→client boundary in React Server Components.
type Props = {
  workId: string;
  contentRating: string | null;
  contentDescriptors: string[];
};

export default function ContentWarningOverlay({ workId, contentRating, contentDescriptors }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(`aim_cw_${workId}`)) {
        setVisible(true);
      }
      // already acknowledged this session — stay hidden
    } catch {
      setVisible(true);
    }
  }, [workId]);

  function handleContinue() {
    try { sessionStorage.setItem(`aim_cw_${workId}`, "1"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  const labels = contentDescriptors
    .map((d) => DESCRIPTOR_LABELS[d] ?? d)
    .filter(Boolean);

  return (
    <div className="cw-backdrop" role="dialog" aria-modal="true" aria-label="Content warning">
      <div className="cw-card">
        {contentRating && (
          <div className="cw-rating">{contentRating}</div>
        )}
        <h2 className="cw-title">Viewer Advisory</h2>
        {labels.length > 0 && (
          <p className="cw-descriptors">
            Contains: <strong>{labels.join(" · ")}</strong>
          </p>
        )}
        <p className="cw-sub">Viewer discretion is advised.</p>
        <button className="cw-btn" onClick={handleContinue} autoFocus>
          Continue Watching
        </button>
      </div>
    </div>
  );
}
