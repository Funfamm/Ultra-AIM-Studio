"use client";

// Compose tab — Group D:
//  - Channel selector: Both / In-app only / Email only (default Both when ACS ready)
//  - Image URL field with live thumbnail preview; auto-suggested from work posterUrl
//  - CTA paired validation (label + URL — both required or both empty)
//  - Live preview panel: in-app notification card + email channel hint
//  - Release / Episode now call sendReleaseOutreach / sendEpisodeOutreach (imageUrl support)
//  - Audience selector on all compose types, including "Specific members" search UI

import { useTransition, useState, useMemo, useEffect, useRef } from "react";
import {
  sendAnnouncement,
  sendReleaseOutreach,
  sendSeasonDropOutreach,
} from "@/lib/actions/outreach";
import type { OutreachResult, AudienceType } from "@/lib/actions/outreach";

// Format a scheduled Date as a human-readable label for the success message
function fmtScheduled(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date}, ${time}`;
}
import type { ReleaseStage } from "@/lib/bulk-email";

type MemberResult = { id: string; name: string | null; email: string };

type PublishedWork    = {
  id:          string;
  title:       string;
  type:        string;
  posterUrl?:  string | null;
  trailerUrl?: string | null;
  videoUrl?:   string | null;
};
type PublishedEpisode = {
  id:            string;
  title:         string;
  episodeNumber: number | null;
  seasonNumber:  number | null;
  seriesTitle:   string | null;
  seriesId:      string | null;
  seriesSlug:    string | null;
  posterUrl?:    string | null;
};

type Props = {
  acsReady:         boolean;
  acsConfigured:    boolean;
  bulkEmailEnabled: boolean;
  publishedWorks:    PublishedWork[];
  publishedEpisodes: PublishedEpisode[];
};

type ComposeType = "announcement" | "release" | "episode" | "studio";
type ChannelType = "both" | "inapp" | "email";

const TYPES: { id: ComposeType; label: string; available: boolean }[] = [
  { id: "announcement", label: "Announcement",  available: true  },
  { id: "release",      label: "New Release",   available: true  },
  { id: "episode",      label: "Season Drop",   available: true  },
  { id: "studio",       label: "Studio Update", available: false },
];

const STAGE_LABELS: Record<ReleaseStage, string> = {
  coming_soon:   "In Production",
  trailer_out:   "Trailer Available",
  now_streaming: "Now Streaming",
};

function detectStage(work: PublishedWork): ReleaseStage {
  if (work.videoUrl)   return "now_streaming";
  if (work.trailerUrl) return "trailer_out";
  return "coming_soon";
}

const AUDIENCE_OPTIONS: { id: AudienceType; label: string; hint: string }[] = [
  { id: "all",        label: "All users",         hint: "All active registered users" },
  { id: "admins",     label: "Admins only",        hint: "Admin accounts only" },
  { id: "notify_me",  label: "Notify Me signups",  hint: "Email addresses from Notify Me CTAs" },
  { id: "saved_work", label: "Saved work users",   hint: "Users who saved at least one work" },
  { id: "specific",   label: "Specific members",   hint: "Search and select individual members" },
];

const CHANNELS: { id: ChannelType; label: string }[] = [
  { id: "both",  label: "Both" },
  { id: "inapp", label: "In-app only" },
  { id: "email", label: "Email only" },
];

function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

function formatResult(r: OutreachResult): string {
  if (r.scheduledFor) return `✓ Scheduled for ${fmtScheduled(r.scheduledFor)}`;
  const parts: string[] = [];
  if ((r.created    ?? 0) > 0) parts.push(`${r.created} in-app`);
  if ((r.queued     ?? 0) > 0) parts.push(`${r.queued} email${r.queued === 1 ? "" : "s"} queued`);
  if ((r.suppressed ?? 0) > 0) parts.push(`${r.suppressed} suppressed`);
  if ((r.skipped    ?? 0) > 0) parts.push(`${r.skipped} skipped`);
  return `✓ Sent${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
}

export default function OutreachComposeForm({
  acsReady,
  acsConfigured,
  bulkEmailEnabled,
  publishedWorks,
  publishedEpisodes,
}: Props) {
  // ── Core state ──────────────────────────────────────────────
  const [composeType, setComposeType] = useState<ComposeType>("announcement");
  const [audience,    setAudience]    = useState<AudienceType>("all");
  const [channel,     setChannel]     = useState<ChannelType>(acsReady ? "both" : "inapp");

  // Announcement controlled fields (for live preview)
  const [annTitle, setAnnTitle] = useState("");
  const [annBody,  setAnnBody]  = useState("");

  // Shared: work selection + email image
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [imageUrl,       setImageUrl]       = useState("");

  // New Release: optional stage override (null = auto-detect)
  const [releaseStageOverride, setReleaseStageOverride] = useState<ReleaseStage | "">("");

  // Season Drop: series + season selection
  const [selectedSeriesId,     setSelectedSeriesId]     = useState("");
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | "">("");

  // CTA (announcement only — controlled for paired validation)
  const [ctaUrl,   setCtaUrl]   = useState("");
  const [ctaLabel, setCtaLabel] = useState("");

  // ── Member search state ─────────────────────────────────────
  const [specificUsers,   setSpecificUsers]   = useState<MemberResult[]>([]);
  const [memberQuery,     setMemberQuery]     = useState("");
  const [memberResults,   setMemberResults]   = useState<MemberResult[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberDropOpen,  setMemberDropOpen]  = useState(false);
  const [activeIdx,       setActiveIdx]       = useState(-1);
  const searchTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberInputRef  = useRef<HTMLInputElement>(null);
  const memberWrapRef   = useRef<HTMLDivElement>(null);

  // Scheduling
  const [scheduledAt, setScheduledAt] = useState("");

  const [pending, startTransition] = useTransition();
  const [result,  setResult]       = useState<OutreachResult | null>(null);
  const [formKey, setFormKey]      = useState(0);

  // ── Member search: debounced fetch (fires at 1 char) ────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = memberQuery.trim();
    if (q.length < 1) {
      setMemberResults([]);
      setMemberDropOpen(false);
      setMemberSearching(false);
      setActiveIdx(-1);
      return;
    }
    setMemberSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: MemberResult[] = await res.json();
          // Filter out already-selected users
          const selectedIds = new Set(specificUsers.map((u) => u.id));
          const filtered = data.filter((u) => !selectedIds.has(u.id));
          setMemberResults(filtered);
          setMemberDropOpen(filtered.length > 0);
          setActiveIdx(-1);
        }
      } catch {
        // silent — non-critical
      } finally {
        setMemberSearching(false);
      }
    }, 200);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [memberQuery, specificUsers]);

  // ── Member search: click-outside closes dropdown ────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (memberWrapRef.current && !memberWrapRef.current.contains(e.target as Node)) {
        setMemberDropOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addSpecificUser(user: MemberResult) {
    if (!specificUsers.find((u) => u.id === user.id)) {
      setSpecificUsers((prev) => [...prev, user]);
    }
    setMemberQuery("");
    setMemberResults([]);
    setMemberDropOpen(false);
    setActiveIdx(-1);
    // Keep focus in the input so admin can keep typing
    requestAnimationFrame(() => memberInputRef.current?.focus());
  }

  function removeSpecificUser(id: string) {
    setSpecificUsers((prev) => prev.filter((u) => u.id !== id));
    requestAnimationFrame(() => memberInputRef.current?.focus());
  }

  function handleMemberKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!memberDropOpen || memberResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, memberResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < memberResults.length) {
        addSpecificUser(memberResults[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setMemberDropOpen(false);
      setActiveIdx(-1);
    }
  }

  // ── Season Drop derived data ─────────────────────────────────
  const { seriesList, seasonsBySeriesId } = useMemo(() => {
    const seriesMap = new Map<string, { id: string; title: string; posterUrl?: string | null }>();
    const seasonsMap = new Map<string, Map<number, PublishedEpisode[]>>();

    for (const ep of publishedEpisodes) {
      if (!ep.seriesId || !ep.seriesTitle) continue;
      if (!seriesMap.has(ep.seriesId)) {
        seriesMap.set(ep.seriesId, { id: ep.seriesId, title: ep.seriesTitle, posterUrl: ep.posterUrl });
      }
      if (!seasonsMap.has(ep.seriesId)) seasonsMap.set(ep.seriesId, new Map());
      const sn = ep.seasonNumber ?? 0;
      const map = seasonsMap.get(ep.seriesId)!;
      if (!map.has(sn)) map.set(sn, []);
      map.get(sn)!.push(ep);
    }

    const seriesList = Array.from(seriesMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    return { seriesList, seasonsBySeriesId: seasonsMap };
  }, [publishedEpisodes]);

  const currentSeasons: [number, PublishedEpisode[]][] = selectedSeriesId
    ? Array.from((seasonsBySeriesId.get(selectedSeriesId) ?? new Map()).entries()).sort(([a], [b]) => a - b)
    : [];

  const currentSeasonEpisodes: PublishedEpisode[] =
    selectedSeriesId && selectedSeasonNumber !== ""
      ? (seasonsBySeriesId.get(selectedSeriesId)?.get(selectedSeasonNumber) ?? [])
      : [];

  // ── Derived ─────────────────────────────────────────────────
  const ctaError =
    (ctaUrl   && !ctaLabel) ? "CTA label is required when a URL is provided." :
    (ctaLabel && !ctaUrl)   ? "CTA URL is required when a label is provided." :
    null;

  const imgValid = isValidUrl(imageUrl);

  const emailDisabledReason: string | null =
    !acsConfigured    ? "ACS not configured" :
    !bulkEmailEnabled ? "Disabled in Admin Settings" :
    null;

  const emailChannelDisabled = emailDisabledReason !== null;

  // Preview data
  const selectedWork   = publishedWorks.find((w) => w.id === selectedWorkId);
  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId);

  const effectiveStage: ReleaseStage =
    releaseStageOverride ? releaseStageOverride :
    selectedWork ? detectStage(selectedWork) : "now_streaming";

  const previewTitle =
    composeType === "announcement" ? (annTitle  || "Notification title preview") :
    composeType === "release"      ? (selectedWork?.title || "New Release") :
    composeType === "episode"      ? (
      selectedSeries && selectedSeasonNumber !== ""
        ? `${selectedSeries.title} — Season ${selectedSeasonNumber}`
        : "Season Drop"
    ) :
    "Notification title preview";

  const previewBody =
    composeType === "announcement" ? (annBody || "Your notification message will appear here.") :
    composeType === "release"      ? (
      effectiveStage === "coming_soon" ? "Coming soon — save the date." :
      effectiveStage === "trailer_out" ? "Watch the trailer and add it to your list." :
      "A new film has just dropped — watch it now."
    ) :
    composeType === "episode"      ? (
      currentSeasonEpisodes.length > 0
        ? `Season ${selectedSeasonNumber} is now streaming — ${currentSeasonEpisodes.length} episode${currentSeasonEpisodes.length !== 1 ? "s" : ""} available.`
        : "A new season is now available. Watch it now."
    ) :
    "";

  const previewIcon =
    composeType === "release" ? "🎬" :
    composeType === "episode" ? "🎞️" :
    "📣";

  const previewTypeLabel =
    composeType === "release" ? "New Release" :
    composeType === "episode" ? "Season Drop" :
    "Announcement";

  const previewEmailSubject =
    composeType === "release" && selectedWork ? (
      effectiveStage === "coming_soon" ? `Coming Soon: ${selectedWork.title}` :
      effectiveStage === "trailer_out" ? `Watch the Trailer: ${selectedWork.title}` :
      `New Release: ${selectedWork.title}`
    ) :
    composeType === "episode" && selectedSeries && selectedSeasonNumber !== ""
      ? `${selectedSeries.title} — Season ${selectedSeasonNumber} is now streaming`
      : previewTitle;

  // Show email preview when channel includes email
  const showEmailPreview = channel === "both" || channel === "email";

  // ── Handlers ─────────────────────────────────────────────────
  function resetState() {
    setFormKey((k) => k + 1);
    setAudience("all");
    setChannel(acsReady ? "both" : "inapp");
    setAnnTitle("");
    setAnnBody("");
    setSelectedWorkId("");
    setImageUrl("");
    setReleaseStageOverride("");
    setSelectedSeriesId("");
    setSelectedSeasonNumber("");
    setCtaUrl("");
    setCtaLabel("");
    setScheduledAt("");
    setSpecificUsers([]);
    setMemberQuery("");
    setMemberResults([]);
    setMemberDropOpen(false);
    setActiveIdx(-1);
  }

  function handleTypeChange(t: ComposeType) {
    if (!TYPES.find((x) => x.id === t)?.available) return;
    setComposeType(t);
    setResult(null);
    setSelectedWorkId("");
    setImageUrl("");
    setReleaseStageOverride("");
    setSelectedSeriesId("");
    setSelectedSeasonNumber("");
    setCtaUrl("");
    setCtaLabel("");
    setAnnTitle("");
    setAnnBody("");
    setAudience("all");
    setScheduledAt("");
    setSpecificUsers([]);
    setMemberQuery("");
    setMemberResults([]);
    setMemberDropOpen(false);
    setActiveIdx(-1);
  }

  function handleWorkChange(workId: string) {
    setSelectedWorkId(workId);
    setReleaseStageOverride("");
    const work = publishedWorks.find((w) => w.id === workId);
    setImageUrl(work?.posterUrl ?? "");
  }

  function handleSeriesChange(seriesId: string) {
    setSelectedSeriesId(seriesId);
    setSelectedSeasonNumber("");
    setImageUrl("");
  }

  function handleSeasonChange(sn: number) {
    setSelectedSeasonNumber(sn);
    // Auto-populate image from first episode poster or series poster
    const eps = seasonsBySeriesId.get(selectedSeriesId)?.get(sn) ?? [];
    const poster = eps.find((e) => e.posterUrl)?.posterUrl ?? "";
    setImageUrl(poster);
  }

  function handleChannelChange(ch: ChannelType) {
    if (emailChannelDisabled && (ch === "both" || ch === "email")) return;
    if (ch === "inapp") setImageUrl(""); // clear image when switching to in-app only
    setChannel(ch);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ctaError) return;

    // Validate specific audience
    if (audience === "specific" && specificUsers.length === 0) {
      setResult({ error: "Select at least one member to send to." });
      return;
    }

    const formData = new FormData(e.currentTarget);
    setResult(null);

    startTransition(async () => {
      let r: OutreachResult;

      if (composeType === "announcement") {
        r = await sendAnnouncement(formData);
      } else if (composeType === "release") {
        if (!selectedWorkId) { setResult({ error: "Select a published work." }); return; }
        const schedDate = scheduledAt ? new Date(scheduledAt) : undefined;
        r = await sendReleaseOutreach(
          selectedWorkId,
          imageUrl || null,
          releaseStageOverride || undefined,
          audience,
          audience === "specific" ? specificUsers.map((u) => u.id) : undefined,
          channel,
          schedDate && !isNaN(schedDate.getTime()) ? schedDate : undefined,
        );
      } else if (composeType === "episode") {
        if (!selectedSeriesId) { setResult({ error: "Select a series." }); return; }
        if (selectedSeasonNumber === "") { setResult({ error: "Select a season." }); return; }
        const schedDate = scheduledAt ? new Date(scheduledAt) : undefined;
        r = await sendSeasonDropOutreach(
          selectedSeriesId,
          selectedSeasonNumber as number,
          imageUrl || null,
          audience,
          audience === "specific" ? specificUsers.map((u) => u.id) : undefined,
          channel,
          schedDate && !isNaN(schedDate.getTime()) ? schedDate : undefined,
        );
      } else {
        r = { error: "This message type is coming in a future phase." };
      }

      setResult(r);
      if (!r.error) resetState();
    });
  }

  // ── Member search UI (shared across all forms) ───────────────
  const memberSearchUI = (
    <div className="outreach-member-search" ref={memberWrapRef}>

      {/* Selected chips — shown above the input */}
      {specificUsers.length > 0 && (
        <div className="outreach-member-chips">
          {specificUsers.map((u) => (
            <span key={u.id} className="outreach-member-chip">
              {u.name ?? u.email}
              <button
                type="button"
                className="outreach-member-chip-remove"
                onClick={() => removeSpecificUser(u.id)}
                aria-label={`Remove ${u.name ?? u.email}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div style={{ position: "relative" }}>
        <div className="outreach-member-input-wrap">
          <input
            ref={memberInputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={memberDropOpen}
            aria-haspopup="listbox"
            value={memberQuery}
            onChange={(e) => { setMemberQuery(e.target.value); setMemberDropOpen(true); }}
            onFocus={() => { if (memberResults.length > 0) setMemberDropOpen(true); }}
            onKeyDown={handleMemberKeyDown}
            placeholder={memberSearching ? "Searching…" : "Type a name or email to search…"}
            className="outreach-input"
            autoComplete="off"
            spellCheck={false}
          />
          {memberSearching && (
            <span className="outreach-member-spinner" aria-hidden="true" />
          )}
        </div>

        {memberDropOpen && memberResults.length > 0 && (
          <ul className="outreach-member-dropdown" role="listbox">
            {memberResults.map((u, i) => (
              <li
                key={u.id}
                role="option"
                aria-selected={i === activeIdx}
                id={`member-option-${u.id}`}
              >
                <button
                  type="button"
                  className={`outreach-member-result${i === activeIdx ? " outreach-member-result--active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); addSpecificUser(u); }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <span className="outreach-member-result-name">
                    {u.name ?? <em style={{ color: "var(--color-brand-muted)" }}>No name</em>}
                  </span>
                  <span className="outreach-member-result-email">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state — only when user has typed something and results came back empty */}
        {memberDropOpen && !memberSearching && memberQuery.trim().length > 0 && memberResults.length === 0 && (
          <div className="outreach-member-empty">
            No members found for &ldquo;{memberQuery.trim()}&rdquo;
          </div>
        )}
      </div>

      <p className="outreach-hint" style={{ margin: "0.4rem 0 0" }}>
        {specificUsers.length === 0
          ? "Type a name or email — results appear from the first character."
          : `${specificUsers.length} member${specificUsers.length !== 1 ? "s" : ""} selected. Keep typing to add more.`
        }
      </p>
    </div>
  );

  // ── Audience selector (reused across all forms) ──────────────
  const audienceSelector = (
    <div>
      <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Audience</p>
      <div className="outreach-audience-grid">
        {AUDIENCE_OPTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAudience(a.id)}
            className={`outreach-audience-btn${audience === a.id ? " outreach-audience-btn--active" : ""}`}
            title={a.hint}
            aria-pressed={audience === a.id}
          >
            {a.label}
          </button>
        ))}
      </div>
      {audience === "specific" && (
        <div style={{ marginTop: "0.75rem" }}>
          {memberSearchUI}
        </div>
      )}
    </div>
  );

  // ── Shared: image URL field ──────────────────────────────────
  const imageField = (
    <div className="outreach-field outreach-field--full">
      <label className="outreach-label" htmlFor="oc-image-url">
        Email image URL{" "}
        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          (optional — https://…)
        </span>
      </label>
      <div className="outreach-img-input-row">
        <input
          id="oc-image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="outreach-input"
          autoComplete="off"
        />
        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="outreach-img-clear"
            aria-label="Clear image URL"
          >
            ✕
          </button>
        )}
      </div>
      {imgValid && (
        <div className="outreach-img-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Email banner preview"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );

  // ── Shared: preview panel ────────────────────────────────────
  const previewPanel = (
    <div className="outreach-preview">
      <p className="outreach-label" style={{ marginBottom: "0.75rem" }}>Preview</p>

      {/* In-app notification mock */}
      <div className="outreach-preview-inapp">
        <div className="outreach-preview-inapp-head">
          <span className="outreach-preview-icon" aria-hidden="true">{previewIcon}</span>
          <div>
            <p className="outreach-preview-type">{previewTypeLabel}</p>
            <p className="outreach-preview-title">{previewTitle}</p>
          </div>
        </div>
        {previewBody && (
          <p className="outreach-preview-body">{previewBody}</p>
        )}
        {composeType === "announcement" && ctaLabel && isValidUrl(ctaUrl) && (
          <span className="outreach-preview-cta">{ctaLabel}</span>
        )}
      </div>

      {/* Email channel hint */}
      {showEmailPreview && !emailChannelDisabled && (
        <div className="outreach-preview-email">
          <p className="outreach-preview-email-label">Email (ACS bulk)</p>
          <p className="outreach-preview-email-detail">
            Subject: {previewEmailSubject}
          </p>
          {imgValid && (
            <p className="outreach-preview-email-detail">🖼 Image banner included</p>
          )}
        </div>
      )}
      {showEmailPreview && emailChannelDisabled && (
        <div className="outreach-preview-email outreach-preview-email--warn">
          <p className="outreach-preview-email-label">Email</p>
          <p className="outreach-preview-email-detail">⚠ {emailDisabledReason}</p>
        </div>
      )}
    </div>
  );

  // ── Shared: "Send at" scheduling field ──────────────────────
  // If set and in the future: announcement is saved as draft (cron publishes);
  // release/season drop: email is queued with that scheduledAt timestamp.
  const scheduleField = (
    <div className="outreach-field" style={{ maxWidth: "300px" }}>
      <label className="outreach-label" htmlFor="oc-scheduled-at">
        Send at{" "}
        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          (optional — leave blank to send now)
        </span>
      </label>
      <input
        id="oc-scheduled-at"
        name="scheduledAt"
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        className="outreach-input"
      />
      {scheduledAt && (
        <p className="outreach-hint" style={{ marginTop: "0.3rem" }}>
          {composeType === "announcement"
            ? "Announcement will be saved as a draft and published automatically at this time."
            : "Email will be queued now and delivered at this time. In-app notifications send immediately."
          }
        </p>
      )}
    </div>
  );

  // ── Channel selector (all compose types) ─────────────────────
  const channelSelector = (
    <div>
      <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Delivery Channel</p>
      <div className="outreach-channel-grid">
        {CHANNELS.map((ch) => {
          const isEmailCh  = ch.id === "email" || ch.id === "both";
          const isDisabled = isEmailCh && emailChannelDisabled;
          return (
            <button
              key={ch.id}
              type="button"
              disabled={isDisabled}
              onClick={() => handleChannelChange(ch.id)}
              title={isDisabled ? (emailDisabledReason ?? undefined) : undefined}
              className={[
                "outreach-channel-btn",
                channel === ch.id   ? "outreach-channel-btn--active"   : "",
                isDisabled          ? "outreach-channel-btn--disabled"  : "",
              ].join(" ").trim()}
              aria-pressed={channel === ch.id}
            >
              {ch.label}
            </button>
          );
        })}
      </div>
      {emailChannelDisabled && (
        <p className="outreach-hint" style={{ marginTop: "0.4rem" }}>
          ⚠ Email channel unavailable — {emailDisabledReason}.
          {!acsConfigured && " Configure ACS to unlock bulk email."}
          {acsConfigured && !bulkEmailEnabled && (
            <> Enable it in <a href="/admin/settings" style={{ color: "var(--color-brand-accent)" }}>Admin Settings</a>.</>
          )}
        </p>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="outreach-section">
      <h2 className="outreach-section-title">Compose</h2>

      {/* ── Message type selector ──────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="outreach-label" style={{ marginBottom: "0.6rem" }}>Message Type</p>
        <div className="outreach-type-grid">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.available}
              onClick={() => handleTypeChange(t.id)}
              className={[
                "outreach-type-btn",
                composeType === t.id ? "outreach-type-btn--active"   : "",
                !t.available         ? "outreach-type-btn--disabled" : "",
              ].join(" ").trim()}
              title={!t.available ? "Coming soon" : undefined}
              aria-pressed={composeType === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Announcement form ═══════════════════════════════════ */}
      {composeType === "announcement" && (
        <form key={formKey} onSubmit={handleSubmit} className="outreach-form">
          {/* Hidden fields carry state into FormData */}
          <input type="hidden" name="audienceType"     value={audience}   />
          <input type="hidden" name="channel"          value={channel}    />
          <input type="hidden" name="imageUrl"         value={imageUrl}   />
          <input
            type="hidden"
            name="specificUserIds"
            value={JSON.stringify(specificUsers.map((u) => u.id))}
          />

          {/* Audience */}
          {audienceSelector}

          {/* Title */}
          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-title">Title *</label>
            <input
              id="oc-title"
              name="title"
              type="text"
              required
              maxLength={120}
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g. New film dropping this week"
              className="outreach-input"
            />
          </div>

          {/* Body */}
          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-body">Message *</label>
            <textarea
              id="oc-body"
              name="body"
              required
              maxLength={500}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Announcement text shown to users…"
              className="outreach-textarea"
            />
          </div>

          {/* CTA */}
          <div className="outreach-form-row">
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href">CTA URL (optional)</label>
              <input
                id="oc-href"
                name="href"
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://…"
                className="outreach-input"
              />
            </div>
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-href-label">CTA label (optional)</label>
              <input
                id="oc-href-label"
                name="hrefLabel"
                type="text"
                maxLength={40}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="e.g. Watch Now"
                className="outreach-input"
              />
            </div>
          </div>
          {ctaError && <p className="outreach-error">{ctaError}</p>}

          {/* Expiry */}
          <div className="outreach-field" style={{ maxWidth: "300px" }}>
            <label className="outreach-label" htmlFor="oc-expires">Expires at (optional)</label>
            <input
              id="oc-expires"
              name="expiresAt"
              type="datetime-local"
              className="outreach-input"
            />
          </div>

          {/* Channel selector */}
          {channelSelector}

          {/* Image URL — only shown when email channel is active */}
          {(channel === "both" || channel === "email") && !emailChannelDisabled && imageField}

          {/* Scheduling */}
          {scheduleField}

          {/* Live preview */}
          {previewPanel}

          {/* Feedback */}
          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !!ctaError}
            className="outreach-submit-btn"
          >
            {pending
              ? (scheduledAt ? "Scheduling…" : "Sending…")
              : (scheduledAt ? "Schedule" : "Send Now")
            }
          </button>
        </form>
      )}

      {/* ══ New Release form ════════════════════════════════════ */}
      {composeType === "release" && (
        <form key={`release-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ {!acsConfigured
                ? "Bulk email provider (ACS) is not configured."
                : "Bulk email sending is disabled in Admin Settings."
              }{" "}Email will not be queued.
            </p>
          )}

          {/* Audience */}
          {audienceSelector}

          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-release-work">Published Work *</label>
            {publishedWorks.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--color-brand-muted)" }}>
                No published works found.
              </p>
            ) : (
              <select
                id="oc-release-work"
                className="outreach-select"
                value={selectedWorkId}
                onChange={(e) => handleWorkChange(e.target.value)}
                required
              >
                <option value="">— Select a work —</option>
                {publishedWorks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} ({w.type.replace(/_/g, " ").toLowerCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stage detection + override */}
          {selectedWork && (
            <div className="outreach-field">
              <label className="outreach-label">Release Stage</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span className={`outreach-stage-badge outreach-stage-badge--${detectStage(selectedWork)}`}>
                  {STAGE_LABELS[detectStage(selectedWork)]}
                </span>
                <select
                  className="outreach-select"
                  style={{ flex: "0 1 220px" }}
                  value={releaseStageOverride}
                  onChange={(e) => setReleaseStageOverride(e.target.value as ReleaseStage | "")}
                >
                  <option value="">Auto-detected</option>
                  <option value="coming_soon">Override: In Production</option>
                  <option value="trailer_out">Override: Trailer Available</option>
                  <option value="now_streaming">Override: Now Streaming</option>
                </select>
              </div>
              <p className="outreach-hint" style={{ marginTop: "0.3rem" }}>
                Auto-detected from work URLs. Override if the work state differs.
              </p>
            </div>
          )}

          {/* Delivery Channel */}
          {channelSelector}

          {/* Image URL with auto-populated poster — shown when email channel active */}
          {(channel === "both" || channel === "email") && !emailChannelDisabled && imageField}
          {channel === "inapp" && selectedWorkId && imageField}

          {/* Scheduling */}
          {scheduleField}

          <p className="outreach-hint">
            Release stage determines subject line and CTA. Re-send per stage is blocked for mass sends;
            Specific Members can always be retargeted. Email scheduling queues emails for future delivery.
          </p>

          {/* Preview — shown once a work is selected */}
          {selectedWorkId && previewPanel}

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !selectedWorkId}
            className="outreach-submit-btn"
          >
            {pending ? "Sending…" : (scheduledAt ? "Schedule" : "Send")}
          </button>
        </form>
      )}

      {/* ══ Season Drop form ════════════════════════════════════ */}
      {composeType === "episode" && (
        <form key={`episode-${formKey}`} onSubmit={handleSubmit} className="outreach-form">
          {!acsReady && (
            <p className="outreach-warn">
              ⚠ {!acsConfigured
                ? "Bulk email provider (ACS) is not configured."
                : "Bulk email sending is disabled in Admin Settings."
              }{" "}Email will not be queued.
            </p>
          )}

          {/* Audience */}
          {audienceSelector}

          {/* Series selector */}
          <div className="outreach-field">
            <label className="outreach-label" htmlFor="oc-series">Series *</label>
            {seriesList.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--color-brand-muted)" }}>
                No published series found. Publish a series with episodes first.
              </p>
            ) : (
              <select
                id="oc-series"
                className="outreach-select"
                value={selectedSeriesId}
                onChange={(e) => handleSeriesChange(e.target.value)}
                required
              >
                <option value="">— Select a series —</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Season selector — only shown after series is selected */}
          {selectedSeriesId && (
            <div className="outreach-field">
              <label className="outreach-label" htmlFor="oc-season">Season *</label>
              {currentSeasons.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--color-brand-muted)" }}>
                  No published seasons found for this series.
                </p>
              ) : (
                <select
                  id="oc-season"
                  className="outreach-select"
                  value={selectedSeasonNumber === "" ? "" : String(selectedSeasonNumber)}
                  onChange={(e) =>
                    e.target.value ? handleSeasonChange(Number(e.target.value)) : setSelectedSeasonNumber("")
                  }
                  required
                >
                  <option value="">— Select a season —</option>
                  {currentSeasons.map(([sn, eps]) => (
                    <option key={sn} value={sn}>
                      Season {sn} — {eps.length} episode{eps.length !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Delivery Channel */}
          {channelSelector}

          {/* Image URL — only shown when series + season are selected and email channel active */}
          {selectedSeriesId && selectedSeasonNumber !== "" && (
            (channel === "both" || channel === "email") && !emailChannelDisabled
              ? imageField
              : channel === "inapp"
                ? imageField
                : null
          )}

          {/* Scheduling */}
          {scheduleField}

          <p className="outreach-hint">
            One send per season — sent to users with episode notifications enabled (or Specific Members).
            Selecting a season auto-fills the image from episode posters when available.
            Re-send is blocked per season for mass sends; Specific Members can always be retargeted.
          </p>

          {/* Preview — shown once series + season are selected */}
          {selectedSeriesId && selectedSeasonNumber !== "" && previewPanel}

          {result?.error && <p className="outreach-error">⚠ {result.error}</p>}
          {result && !result.error && (
            <p className="outreach-ok">{formatResult(result)}</p>
          )}

          <button
            type="submit"
            disabled={pending || !selectedSeriesId || selectedSeasonNumber === ""}
            className="outreach-submit-btn"
          >
            {pending ? "Sending…" : (scheduledAt ? "Schedule" : "Send")}
          </button>
        </form>
      )}
    </div>
  );
}
