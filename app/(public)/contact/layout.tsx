import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — AIM Studio",
  description: "For partnerships, press, casting, or just to say hi. We read every message.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
