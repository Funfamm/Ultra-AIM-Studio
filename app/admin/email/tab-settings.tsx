import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TestEmailButton from "./test-email-button";
import { saveBulkEmailSettings } from "@/lib/actions/settings";
import { isAcsConfigured, isGraphConfigured, isSmtpConfigured } from "@/lib/bulk-email";

export default async function TabSettings() {
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: {
      emailSendingEnabled:       true,
      bulkEmailSendingEnabled:   true,
      primaryBulkProvider:       true,
      testEmailRecipient:        true,
      welcomeEmailEnabled:       true,
    },
  });

  const currentProvider = (settings?.primaryBulkProvider ?? "acs").toLowerCase();
  const acsOk   = isAcsConfigured();
  const graphOk = isGraphConfigured();
  const smtpOk  = isSmtpConfigured();

  // SMTP is detected by env vars but bulk sending is not yet implemented —
  // always surface as "Not implemented" to avoid misleading the admin.
  const SMTP_IMPLEMENTED = false;

  const providers = [
    {
      id:              "graph",
      label:           "Microsoft Graph",
      desc:            "Temporary bulk sender using the configured Microsoft mailbox. Recommended while ACS domain is not yet verified. Use smaller batch sizes.",
      ok:              graphOk,
      notImplemented:  false,
      hint:            graphOk ? null : "Requires AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, GRAPH_EMAIL_SENDER",
    },
    {
      id:              "acs",
      label:           "Azure Communication Services (ACS)",
      desc:            "Recommended long-term bulk sender for production announcements, releases, and campaigns after the verified domain is ready.",
      ok:              acsOk,
      notImplemented:  false,
      hint:            acsOk ? null : "Requires ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS",
    },
    {
      id:              "smtp",
      label:           "SMTP",
      desc:            "Emergency fallback only. Requires SMTP_HOST, SMTP_USER env vars and full SMTP implementation.",
      ok:              smtpOk && SMTP_IMPLEMENTED,
      notImplemented:  !SMTP_IMPLEMENTED,
      hint:            !SMTP_IMPLEMENTED
        ? "SMTP bulk sending is not yet implemented. Select Graph or ACS."
        : smtpOk ? null : "Set SMTP_HOST and SMTP_USER",
    },
  ];

  return (
    <>
      {/* ── Bulk email provider ───────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Bulk email provider</h2>
        <p className="email-hint">
          Choose which provider processes the bulk email queue — announcements,
          new releases, Notify Me follow-ups. Takes effect on the next queue run.
        </p>

        <form action={saveBulkEmailSettings} className="eprovider-form">
          {/* hidden — keep existing toggle state */}
          <input
            type="hidden"
            name="bulkEmailSendingEnabled"
            value={settings?.bulkEmailSendingEnabled ? "true" : "false"}
          />

          <div className="eprovider-list">
            {providers.map((p) => (
              <label
                key={p.id}
                className={`eprovider-card${currentProvider === p.id ? " eprovider-card--active" : ""}${!p.ok ? " eprovider-card--dim" : ""}`}
              >
                <div className="eprovider-radio-row">
                  <input
                    type="radio"
                    name="primaryBulkProvider"
                    value={p.id}
                    defaultChecked={currentProvider === p.id}
                    className="eprovider-radio"
                  />
                  <span className="eprovider-label">{p.label}</span>
                  <span className={`eprovider-badge ${p.ok ? "eprovider-badge--ok" : p.notImplemented ? "eprovider-badge--dim" : "eprovider-badge--warn"}`}>
                    {p.ok ? "Configured" : p.notImplemented ? "Not implemented" : "Not configured"}
                  </span>
                </div>
                <p className="eprovider-desc">{p.desc}</p>
                {p.hint && <p className="eprovider-hint">⚠ {p.hint}</p>}
              </label>
            ))}
          </div>

          <button type="submit" className="email-sup-btn" style={{ marginTop: "1rem" }}>
            Save provider
          </button>
        </form>
      </section>

      {/* ── Email system status ───────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Email system status</h2>
        <div className="email-config-grid">
          <div className="email-config-card">
            <p className="email-config-label">Email sending</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${settings?.emailSendingEnabled ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val">
                {settings?.emailSendingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Bulk sending</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${settings?.bulkEmailSendingEnabled ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">
                {settings?.bulkEmailSendingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Active provider</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${(currentProvider === "acs" ? acsOk : currentProvider === "graph" ? graphOk : smtpOk) ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val" style={{ textTransform: "uppercase" }}>
                {currentProvider}
              </span>
            </div>
          </div>
          <div className="email-config-card">
            <p className="email-config-label">Test recipient</p>
            <p className="email-config-val" style={{ fontSize: "0.82rem" }}>
              {settings?.testEmailRecipient ?? "Admin account (default)"}
            </p>
          </div>
        </div>
        <p className="email-hint" style={{ marginTop: "1rem" }}>
          Toggle sending on/off and set per-type controls in{" "}
          <Link href="/admin/settings" style={{ color: "var(--color-brand-accent)" }}>
            Admin Settings → Email
          </Link>.
        </p>
      </section>

      {/* ── Test transactional email ──────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Test transactional email</h2>
        <p className="email-hint">
          Sends a test email via Microsoft Graph (always — transactional emails never use ACS).
          {settings?.testEmailRecipient
            ? ` Delivers to: ${settings.testEmailRecipient}.`
            : " Delivers to your admin account."}
        </p>
        <TestEmailButton />
      </section>
    </>
  );
}
