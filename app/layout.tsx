import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import AnalyticsBeacon from "@/components/analytics-beacon";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "600", "700"],
  display: "swap",
  variable: "--font-cormorant",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "AIM Studio | Creating Cinema with AI",
    template: "%s | AIM Studio",
  },
  description:
    "A cinematic streaming platform for original AI-powered films, series, shorts, and stories that refuse to look away.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app"
  ),
  openGraph: {
    type: "website",
    siteName: "AIM Studio",
    title: "AIM Studio | Creating Cinema with AI",
    description:
      "A cinematic streaming platform for original AI-powered films, series, shorts, and stories that refuse to look away.",
    images: [{ url: "/images/SP_Logo.jpg", width: 1200, height: 630, alt: "AIM Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AIM Studio | Creating Cinema with AI",
    description:
      "A cinematic streaming platform for original AI-powered films, series, shorts, and stories that refuse to look away.",
    images: ["/images/SP_Logo.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png",    type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
