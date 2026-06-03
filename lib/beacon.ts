/**
 * Client-side sendBeacon helper.
 * Only import this in "use client" components.
 * Never import in Server Components or Server Actions.
 */

type BeaconPayload = {
  type: string;
  path?: string;
  workId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function beacon(type: string, extra?: Omit<BeaconPayload, "type">) {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;

  const payload: BeaconPayload = {
    type,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...extra,
  };

  navigator.sendBeacon(
    "/api/analytics",
    new Blob([JSON.stringify(payload)], { type: "application/json" })
  );
}
