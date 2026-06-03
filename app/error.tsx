"use client";
// Global error boundary — catches unhandled render errors
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-brand-white)" }}>
        Something went wrong
      </h2>
      <p style={{ color: "var(--color-brand-muted)", fontFamily: "var(--font-body)" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.5rem",
          background: "var(--color-brand-accent)",
          color: "var(--color-brand-black)",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </main>
  );
}
