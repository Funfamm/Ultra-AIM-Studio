// Admin Settings — singleton configuration for AIM Studio Lite
// Server-rendered form sections. Client components only for save buttons + security form.

import {
  saveEmailSettings,
  saveContentAccessSettings,
  saveFeatureSettings,
  saveNotificationSettings,
  savePlaybackSettings,
  getSettings,
} from "@/lib/actions/settings";
import { SaveButton } from "./settings-save-button";
import { SecurityForm } from "./settings-security-form";
import { SecurityPoliciesForm } from "./settings-security-policies-form";
import type { Metadata } from "next";
import "./settings.css";

export const metadata: Metadata = { title: "Admin — Settings" };

// ── Shared sub-components ─────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="stg-section-hd">
      <h2 className="stg-section-title">{title}</h2>
      <p className="stg-section-desc">{desc}</p>
    </div>
  );
}

function CheckRow({
  name, checked, label, note,
}: {
  name: string; checked: boolean; label: string; note?: string;
}) {
  return (
    <label className="stg-check-row">
      <input type="checkbox" name={name} value="true" defaultChecked={checked} className="stg-checkbox" />
      <span className="stg-check-text">
        <span className="stg-check-label">{label}</span>
        {note && <span className="stg-check-note">{note}</span>}
      </span>
    </label>
  );
}

function TextField({
  name, label, value, placeholder, type = "text", note,
}: {
  name: string; label: string; value?: string | null; placeholder?: string; type?: string; note?: string;
}) {
  return (
    <div className="stg-field">
      <label className="stg-field-label">{label}</label>
      {note && <span className="stg-field-note">{note}</span>}
      <input
        type={type}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="stg-input"
      />
    </div>
  );
}

function SelectField({
  name, label, value, options, note,
}: {
  name: string; label: string; value: string; options: { val: string; label: string }[]; note?: string;
}) {
  return (
    <div className="stg-field">
      <label className="stg-field-label">{label}</label>
      {note && <span className="stg-field-note">{note}</span>}
      <select name={name} defaultValue={value} className="stg-select">
        {options.map((o) => (
          <option key={o.val} value={o.val}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default async function SettingsPage() {
  const s = await getSettings();

  const graphOk = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID && process.env.GRAPH_EMAIL_SENDER);

  return (
    <div className="stg-shell">
      <div className="stg-header">
        <h1 className="stg-page-title">Settings</h1>
        <p className="stg-page-desc">Configure platform behaviour, email, access rules, and feature flags.</p>
      </div>

      {/* ── 1. Email ── */}
      <form action={saveEmailSettings} className="stg-section">
        <SectionHeader
          title="Email"
          desc="Sender configuration, email types, and test recipient."
        />

        <div className="stg-env-row">
          <span className="stg-env-label">Graph API provider</span>
          <span className={`stg-env-badge ${graphOk ? "stg-env-badge--ok" : "stg-env-badge--err"}`}>
            {graphOk ? "Configured ✓" : "Missing env vars"}
          </span>
        </div>

        <div className="stg-fields">
          <CheckRow name="emailSendingEnabled" checked={s.emailSendingEnabled}
            label="Email sending enabled" note="Uncheck to disable all outbound email" />
          <CheckRow name="welcomeEmailEnabled" checked={s.welcomeEmailEnabled}
            label="Send welcome email on sign-up" />
          <CheckRow name="passwordResetEmailEnabled" checked={s.passwordResetEmailEnabled}
            label="Send password reset emails" />
          <CheckRow name="notificationEmailEnabled" checked={s.notificationEmailEnabled}
            label="Send notification emails"
            note="Controls ACS broadcast emails — announcements, new releases, new episodes. Does not affect password reset or security emails." />
        </div>

        <div className="stg-field-row">
          <SelectField name="primaryEmailProvider" label="Primary provider" value={s.primaryEmailProvider}
            options={[{ val: "graph", label: "Microsoft Graph (recommended)" }, { val: "smtp", label: "SMTP fallback" }]}
          />
          <TextField name="fromDisplayName" label="From display name" value={s.fromDisplayName}
            placeholder="AIM Studio" />
        </div>
        <div className="stg-field-row">
          <TextField name="replyToEmail" label="Reply-to address" value={s.replyToEmail}
            placeholder="hello@aimstudio.com" type="email" />
          <TextField name="adminAlertEmail" label="Admin alert recipient" value={s.adminAlertEmail}
            placeholder="admin@aimstudio.com" type="email"
            note="Receives system alerts" />
        </div>
        <TextField name="testEmailRecipient" label="Test email recipient" value={s.testEmailRecipient}
          placeholder="Leave blank to send to current admin account" type="email"
          note="Used by the 'Send Test Email' button on the Email page" />

        <div className="stg-actions">
          <SaveButton />
        </div>
      </form>

      {/* ── 1b. Bulk Email — redirect to Email Command Center ── */}
      <div className="stg-section stg-section--info">
        <SectionHeader
          title="Bulk Email Provider"
          desc="Select and configure the active bulk email provider (Graph, ACS, or SMTP) in the Email Command Center."
        />
        <p className="stg-section-note">
          Bulk provider selection, queue controls, suppression management, and send testing are managed centrally in the Email Command Center.
        </p>
        <a href="/admin/email?tab=settings" className="stg-link-btn">
          Open Email Settings →
        </a>
      </div>

      {/* ── 2. Content Access ── */}
      <form action={saveContentAccessSettings} className="stg-section">
        <SectionHeader
          title="Content Access"
          desc="Default access rules for new works and catalog visibility."
        />
        <div className="stg-fields">
          <CheckRow name="defaultRequireLoginToWatch" checked={s.defaultRequireLoginToWatch}
            label="Require login to watch by default"
            note="Applied to new works — can be overridden per work" />
          <CheckRow name="defaultRequireLoginToViewTrailer" checked={s.defaultRequireLoginToViewTrailer}
            label="Require login to view trailers by default" />
          <CheckRow name="allowPublicProjectDetails" checked={s.allowPublicProjectDetails}
            label="Show project details publicly" note="Client work detail pages" />
          <CheckRow name="showLockedContentInCatalog" checked={s.showLockedContentInCatalog}
            label="Show locked content in the catalog" note="Lock icon shown, card still visible" />
        </div>
        <div className="stg-actions">
          <SaveButton />
        </div>
      </form>

      {/* ── 3. Feature Visibility ── */}
      <form action={saveFeatureSettings} className="stg-section">
        <SectionHeader
          title="Feature Visibility"
          desc="Toggle upcoming features in the navigation and UI. Disabled features are hidden — not deleted."
        />
        <div className="stg-features-grid">
          {([
            ["showNotifications",     "Notifications",       "Bell icon + notification centre"],
            ["showCasting",           "Casting",             "Future — not yet built"],
            ["showScripts",           "Scripts",             "Future — not yet built"],
            ["showTraining",          "Training Hub",        "Future — not yet built"],
            ["showSponsors",          "Sponsors",            "Future — not yet built"],
            ["showDonations",         "Donations",           "Future — not yet built"],
            ["showCommunityComments", "Community Comments",  "Future — not yet built"],
            ["showWatchParty",        "Watch Party",         "Future — not yet built"],
          ] as [string, string, string][]).map(([name, label, note]) => (
            <CheckRow key={name} name={name} checked={(s as Record<string, unknown>)[name] as boolean}
              label={label} note={note} />
          ))}
        </div>
        <div className="stg-actions">
          <SaveButton />
        </div>
      </form>

      {/* ── 4. Notifications ── */}
      <form action={saveNotificationSettings} className="stg-section">
        <SectionHeader
          title="Notification Defaults"
          desc="Default notification types enabled for all users. Users can override in their preferences."
        />
        <div className="stg-fields">
          <CheckRow name="inAppNotificationsEnabled" checked={s.inAppNotificationsEnabled}
            label="In-app notifications" />
          <CheckRow name="newReleaseNotificationsEnabled" checked={s.newReleaseNotificationsEnabled}
            label="New release notifications" />
          <CheckRow name="newEpisodeNotificationsEnabled" checked={s.newEpisodeNotificationsEnabled}
            label="New episode notifications" />
          <CheckRow name="announcementNotificationsEnabled" checked={s.announcementNotificationsEnabled}
            label="Announcement notifications" />
        </div>
        <div className="stg-actions">
          <SaveButton />
        </div>
      </form>

      {/* ── 5. Playback ── */}
      <form action={savePlaybackSettings} className="stg-section">
        <SectionHeader
          title="Playback Defaults"
          desc="Default player behaviour for new users (can be overridden in user preferences)."
        />
        <div className="stg-fields">
          <CheckRow name="defaultAutoplayNextEpisode" checked={s.defaultAutoplayNextEpisode}
            label="Autoplay next episode" />
          <CheckRow name="defaultResumePlayback" checked={s.defaultResumePlayback}
            label="Resume playback where left off" />
        </div>
        <SelectField name="defaultVideoPreload" label="Video preload strategy" value={s.defaultVideoPreload}
          options={[
            { val: "none",     label: "none — best for 4G / bandwidth-conscious (recommended)" },
            { val: "metadata", label: "metadata — preload duration and dimensions only" },
            { val: "auto",     label: "auto — preload full file (high bandwidth cost)" },
          ]}
          note="Controls the HTML5 <video preload> attribute on the player"
        />
        <div className="stg-actions">
          <SaveButton />
        </div>
      </form>

      {/* ── 6. Security — auth providers ── */}
      <SecurityForm
        allowGoogleSignIn={s.allowGoogleSignIn}
        allowCredentialsSignIn={s.allowCredentialsSignIn}
        allowNewRegistrations={s.allowNewRegistrations}
      />

      {/* ── 7. Security Policies — throttle + device + notifications ── */}
      <SecurityPoliciesForm
        failedLoginWindowMinutes={s.failedLoginWindowMinutes}
        failedLoginMaxAttempts={s.failedLoginMaxAttempts}
        loginCooldownMinutes={s.loginCooldownMinutes}
        notifyUserOnNewDevice={s.notifyUserOnNewDevice}
        notifyUserOnNewLocation={s.notifyUserOnNewLocation}
        notifyAdminOnSuspiciousAdminLogin={s.notifyAdminOnSuspiciousAdminLogin}
        allowUserDeviceTrust={s.allowUserDeviceTrust}
        requireReauthForSensitiveActions={s.requireReauthForSensitiveActions}
        allowHardPurgeForSuperAdmin={s.allowHardPurgeForSuperAdmin}
      />

      {/* ── Footer ── */}
      <p className="stg-footer">
        Last updated: {s.updatedAt ? s.updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}
      </p>
    </div>
  );
}
