// /unsubscribed — landing page after one-click email unsubscribe
import Link from "next/link";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function UnsubscribedPage({ searchParams }: Props) {
  const params  = await searchParams;
  const success = params.success === "1";
  const error   = params.error;

  return (
    <main style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      background: "var(--color-brand-black)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        textAlign: "center",
      }}>

        {success ? (
          <>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-brand-accent)",
              marginBottom: "1rem",
            }}>
              Unsubscribed
            </p>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              fontWeight: 700,
              color: "var(--color-brand-white)",
              margin: "0 0 1rem",
              letterSpacing: "-0.02em",
            }}>
              You&apos;re unsubscribed.
            </h1>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              color: "var(--color-brand-muted)",
              lineHeight: 1.6,
              margin: "0 0 2rem",
            }}>
              We&apos;ve removed you from our mailing list. You won&apos;t receive
              any more bulk emails from AIM Studio.
            </p>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--color-brand-muted)",
              margin: "0 0 2rem",
              lineHeight: 1.6,
            }}>
              You may still receive account emails such as password resets
              and security alerts — these cannot be disabled.
            </p>
          </>
        ) : error === "invalid" ? (
          <>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
              fontWeight: 700,
              color: "var(--color-brand-white)",
              margin: "0 0 1rem",
            }}>
              Invalid link
            </h1>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              color: "var(--color-brand-muted)",
              lineHeight: 1.6,
              margin: "0 0 2rem",
            }}>
              This unsubscribe link is invalid or has been modified.
              If you want to manage your email preferences, sign in and visit
              your settings.
            </p>
          </>
        ) : (
          <>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
              fontWeight: 700,
              color: "var(--color-brand-white)",
              margin: "0 0 1rem",
            }}>
              Something went wrong
            </h1>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              color: "var(--color-brand-muted)",
              lineHeight: 1.6,
              margin: "0 0 2rem",
            }}>
              We couldn&apos;t process your request. Please try again or
              contact us if the problem continues.
            </p>
          </>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-brand-black)",
            background: "var(--color-brand-accent)",
            padding: "0.6rem 1.5rem",
            borderRadius: "3px",
            textDecoration: "none",
          }}>
            Back to Home
          </Link>
          <Link href="/dashboard/settings#notifications" style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--color-brand-muted)",
            padding: "0.6rem 1.5rem",
            border: "1px solid var(--color-brand-border)",
            borderRadius: "3px",
            textDecoration: "none",
          }}>
            Manage Preferences
          </Link>
        </div>

      </div>
    </main>
  );
}
