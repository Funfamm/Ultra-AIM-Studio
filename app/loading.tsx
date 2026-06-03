// Global loading skeleton shown during RSC streaming
import "./loading.css";
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid var(--color-brand-border)",
          borderTopColor: "var(--color-brand-accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}
