import { auth } from "@/lib/auth";
import {
  getUserPreferences,
  updateNotificationPreferences,
  updatePlaybackPreferences,
} from "@/lib/actions/preferences";
import { updateUserProfile, getUserProfile } from "@/lib/actions/user";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import { ChevronLeft, ChevronDown, LogOut } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";
import "./settings.css";

export const metadata: Metadata = { title: "Settings — AIM Studio" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  // Fetch session (auth check), live DB profile, and preferences in parallel
  const [, profile, prefs, params] = await Promise.all([
    auth(),
    getUserProfile(),      // always reads from DB — never the stale JWT session
    getUserPreferences(),
    searchParams,
  ]);

  const savedSection = params.saved;   // "profile" → shows Saved chip on Profile section
  const errorMsg = params.error;

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "68px" }}>
        <main className="settingspage">
          <div className="container-app">

            <Link href="/dashboard" className="settingspage-back">
              <ChevronLeft size={16} /> Dashboard
            </Link>

            <h1 className="settingspage-title">Settings</h1>

            {errorMsg && (
              <p className="settings-feedback settings-feedback--error">
                {decodeURIComponent(errorMsg)}
              </p>
            )}

            {/* ── Profile ── */}
            <details className="settings-accordion" open>
              <summary className="settings-accordion-summary">
                <span>Profile</span>
                {savedSection === "profile" && (
                  <span className="settings-saved-chip">Saved</span>
                )}
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <form action={updateUserProfile} className="settings-form">
                  <div className="settings-field-row">
                    <label className="settings-field-label" htmlFor="name">
                      Display name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      defaultValue={profile.name ?? ""}
                      maxLength={80}
                      className="settings-text-input"
                      autoComplete="name"
                    />
                  </div>
                  <div className="settings-field-row">
                    <label className="settings-field-label">Email</label>
                    <span className="settings-field-readonly">{profile.email ?? "—"}</span>
                  </div>
                  <div className="settings-form-footer">
                    <button type="submit" className="settings-save-btn">
                      Save Profile
                    </button>
                    <Link href="/forgot-password" className="settings-text-link">
                      Change password
                    </Link>
                  </div>
                </form>
              </div>
            </details>

            {/* ── Notification Preferences ── */}
            <details className="settings-accordion">
              <summary className="settings-accordion-summary">
                <span>Notification Preferences</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <form action={updateNotificationPreferences}>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">In-app notifications</p>
                      <p className="settings-toggle-desc">Show notifications inside your dashboard</p>
                    </div>
                    <input type="checkbox" name="inAppNotifications"
                      defaultChecked={prefs.inAppNotifications} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Email notifications</p>
                      <p className="settings-toggle-desc">Receive notifications by email</p>
                    </div>
                    <input type="checkbox" name="emailNotifications"
                      defaultChecked={prefs.emailNotifications} className="settings-checkbox" />
                  </label>
                  <div className="settings-divider" />
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">New releases</p>
                      <p className="settings-toggle-desc">When a new film or series drops</p>
                    </div>
                    <input type="checkbox" name="newReleaseNotifications"
                      defaultChecked={prefs.newReleaseNotifications} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">New episodes</p>
                      <p className="settings-toggle-desc">When a new episode is added to a series</p>
                    </div>
                    <input type="checkbox" name="newEpisodeNotifications"
                      defaultChecked={prefs.newEpisodeNotifications} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Announcements</p>
                      <p className="settings-toggle-desc">Studio news and major updates</p>
                    </div>
                    <input type="checkbox" name="announcementNotifications"
                      defaultChecked={prefs.announcementNotifications} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Studio updates</p>
                      <p className="settings-toggle-desc">Behind-the-scenes and production updates</p>
                    </div>
                    <input type="checkbox" name="studioUpdates"
                      defaultChecked={prefs.studioUpdates} className="settings-checkbox" />
                  </label>
                  <div className="settings-divider" />
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Notify Me follow-up emails</p>
                      <p className="settings-toggle-desc">Email when a work you signed up for is released</p>
                    </div>
                    <input type="checkbox" name="notifyMeFollowupEmails"
                      defaultChecked={prefs.notifyMeFollowupEmails} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Saved work updates</p>
                      <p className="settings-toggle-desc">Notify me when a saved series gets new content</p>
                    </div>
                    <input type="checkbox" name="savedWorkNotifications"
                      defaultChecked={prefs.savedWorkNotifications} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Watch reminders</p>
                      <p className="settings-toggle-desc">Occasional prompts to resume something you started</p>
                    </div>
                    <input type="checkbox" name="watchReminderNotifications"
                      defaultChecked={prefs.watchReminderNotifications} className="settings-checkbox" />
                  </label>
                  <div className="settings-toggle-row settings-toggle-row--plain">
                    <div>
                      <p className="settings-toggle-label">Security emails</p>
                      <p className="settings-toggle-desc">
                        Login alerts, password resets, and account security — always on
                      </p>
                    </div>
                    <span className="settings-field-readonly" style={{ fontSize: "0.78rem" }}>Always on</span>
                  </div>
                  <div className="settings-form-footer">
                    <button type="submit" className="settings-save-btn">Save</button>
                  </div>
                </form>
              </div>
            </details>

            {/* ── Playback Preferences ── */}
            <details className="settings-accordion" id="playback">
              <summary className="settings-accordion-summary">
                <span>Playback Preferences</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <form action={updatePlaybackPreferences}>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Autoplay next episode</p>
                      <p className="settings-toggle-desc">Automatically play the next episode when one ends</p>
                    </div>
                    <input type="checkbox" name="autoplayNextEpisode"
                      defaultChecked={prefs.autoplayNextEpisode} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Resume playback</p>
                      <p className="settings-toggle-desc">Continue from where you left off</p>
                    </div>
                    <input type="checkbox" name="resumePlayback"
                      defaultChecked={prefs.resumePlayback} className="settings-checkbox" />
                  </label>
                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Reduce motion</p>
                      <p className="settings-toggle-desc">Minimize animations across the site</p>
                    </div>
                    <input type="checkbox" name="reducedMotion"
                      defaultChecked={prefs.reducedMotion} className="settings-checkbox" />
                  </label>
                  <div className="settings-form-footer">
                    <button type="submit" className="settings-save-btn">Save</button>
                  </div>
                </form>
              </div>
            </details>

            {/* ── Account & Security ── */}
            <details className="settings-accordion">
              <summary className="settings-accordion-summary">
                <span>Account &amp; Security</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <div className="settings-toggle-row settings-toggle-row--plain">
                  <div>
                    <p className="settings-toggle-label">Password</p>
                    <p className="settings-toggle-desc">Reset via verification code</p>
                  </div>
                  <Link href="/forgot-password" className="settings-text-link">Change</Link>
                </div>
                <div className="settings-toggle-row settings-toggle-row--plain settings-toggle-row--last">
                  <div>
                    <p className="settings-toggle-label">Sign out</p>
                    <p className="settings-toggle-desc">Sign out of this device</p>
                  </div>
                  <form action={logoutUser}>
                    <button type="submit" className="settings-logout-btn">
                      <LogOut size={14} /> Sign Out
                    </button>
                  </form>
                </div>
              </div>
            </details>

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
