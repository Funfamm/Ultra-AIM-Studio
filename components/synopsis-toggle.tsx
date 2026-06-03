"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import "./synopsis-toggle.css";

export default function SynopsisToggle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  const clampStyle: CSSProperties = expanded
    ? { margin: 0 }
    : {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        margin: 0,
      };

  return (
    <div className="synopsis-wrap">
      <p className="detail-desc" style={clampStyle}>
        {text}
      </p>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="synopsis-toggle"
      >
        {expanded ? "Less" : "More"}
      </button>
    </div>
  );
}
