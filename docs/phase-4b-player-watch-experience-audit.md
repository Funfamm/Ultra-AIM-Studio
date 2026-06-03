# Phase 4B — Player / Watch Experience Audit

**Date:** 2026-06-03
**Branch:** ultra-rebrand-phase-1
**Status:** Audit only — no code written, no database commands run

---

## 1. Current Ultra Player Architecture

The watch experience spans three layers:

### 1a. Watch page — `app/(public)/watch/[slug]/page.tsx`

A server component that:

**Data fetched server-side:**
- Work metadata: id, slug, title, status, type, description, posterUrl
- Video URLs: `videoUrl`, `trailerUrl`
- Access controls: `requiresAuth`, `requiresLoginToViewTrailer`
- Player timings: `introStart`, `introEnd`, `creditsStart` (all in seconds)
- Content advisory: `contentRating`, `contentDescriptors`
- Episode hierarchy: `episodeNumber`, `seasonNumber`, `duration`, all published sibling episodes
- Parent series (if episode): sibling episode list for the episode panel
- `NotifyMeCta`: id, type, isEnabled, headline, body, ctaLabel, `triggerSecondsFromEnd`
- Resume position: `getWatchProgress(workId)` → `initialSeconds`
- Episode progress map (for sidebar progress bars)
- CTA for series finales: separate lookup

**Series handling:**
- Series slug redirects to Episode 1 (lines 123–125)
- Resume episode resolved by `getResumeEpisodeSlug()` → last-watched or first unwatched
- All timing fields have episode-level fallback to series-level (lines 220–226)

**Auth handling:**
- `requiresAuth` → redirect to login if not authenticated
- `requiresLoginToViewTrailer` → gated at component level

### 1b. AIM Player — `components/aim-player.tsx`

A fully client-rendered `"use client"` component. Already implements:

| Feature | Status | Key lines |
|---|---|---|
| Play / Pause | ✅ Working | Space/K shortcut |
| Seek bar | ✅ Working | Visual progress + time display |
| Volume + mute | ✅ Working | Slider + M shortcut |
| Playback speed | ✅ Working | 0.75×–2× menu |
| Fullscreen | ✅ Working | Native + webkit fallback |
| **Skip Intro** | ✅ Working | Lines 422–423, 468–471 |
| **Skip Credits** | ✅ Working | Lines 423, 473–476 |
| **Up Next / auto-play** | ✅ Working | Lines 480–492 (10-second countdown) |
| **Content Advisory** | ✅ Working | Lines 456–465, auto-fades after 5s |
| **Notify Me CTA** | ✅ Working | Lines 431–436, 580–582 |
| **Watch progress save** | ✅ Working | Every 10s, on pause, on end |
| **Analytics beacons** | ✅ Working | WATCH_START, WATCH_PROGRESS, WATCH_COMPLETE |
| Like / unlike | ✅ Working | Heart + count, login redirect for guests |
| Clip sharing | ✅ Working | Clip panel, 60s max, navigator.share |
| Episode panel | ✅ Working | Slides in from right, progress bars |
| Keyboard shortcuts | ✅ Working | Space, K, arrows |
| Mobile layout | ✅ Working | Touch targets, responsive controls |
| **Subtitles / CC** | ❌ Missing | No VTT/SRT track support |
| Quality selector | ❌ Missing | No resolution switching |
| Native casting (API) | ⚠️ Button only | Cast button calls native API, no state |

### 1c. Works detail page — `app/(public)/works/[slug]/page.tsx`

- Series: mobile sticky trailer player, portrait poster, smart resume button, episodes grid
- Films: standard detail layout with Watch and Trailer CTAs
- Smart resume: `getResumeEpisodeSlug()` → links to last-watched or first episode

---

## 2. Current Schema — Player-Relevant Fields

### Work model (player timing + video)

| Field | Type | Purpose |
|---|---|---|
| `videoUrl` | String? | Main video file (film, episode, commercial, branding) |
| `trailerUrl` | String? | Short/full film, series trailer |
| `teaserUrl` | String? | Optional second video (commercials) |
| `introStart` | Int? | Seconds — Skip Intro button appears |
| `introEnd` | Int? | Seconds — Skip Intro seeks here |
| `creditsStart` | Int? | Seconds — Skip Credits button appears |
| `contentRating` | String? | "G", "PG", "PG-13", "R", "TV-MA", "NR" |
| `contentDescriptors` | String[] | ["VIOLENCE","LANGUAGE","NUDITY"] |
| `duration` | Int? | Minutes — used for progress % calculation |
| `episodeNumber` | Int? | Episode ordering |
| `seasonNumber` | Int? | Season grouping |

**All timing fields are live in the schema and wired to the player.** Episode-level timings fall back to series-level (watch page.tsx lines 220–226).

### WatchProgress model

```
id, userId, workId
seconds   Int     default=0
duration  Int?               — minutes at time of save (for % calculation)
completed Boolean default=false
updatedAt DateTime @updatedAt
@@unique([userId, workId])
```

**Completion threshold:** 90% watched (`seconds >= duration * 60 * 0.9`) — set in `lib/actions/progress.ts`.

### NotifyMeCta model

```
workId (unique FK)           — one CTA per work
type         CtaType          — RELEASE | MORE | POST_RELEASE
isEnabled    Boolean
headline     String
body         String?
ctaLabel     String
triggerSecondsFromEnd Int     — default 30
```

Related: `NotifyMeSignup` — unique on `[ctaId, email]` — prevents duplicate signups.

---

## 3. Current Admin Controls for Player

### Works editor (`app/admin/works/[id]/page.tsx` → `WorkForm`)

Fields editable in admin for player-relevant settings:
- `videoUrl`, `trailerUrl`, `teaserUrl` — video URLs
- `posterUrl` — player poster/thumbnail
- `introStart`, `introEnd` — intro timing
- `creditsStart` — credits timing
- `contentRating`, `contentDescriptors` — content advisory
- `episodeNumber`, `seasonNumber` — episode ordering
- `requiresAuth`, `requiresLoginToViewTrailer` — access control

### CTA editor (`app/admin/notify-me-ctas/[ctaId]/`)

Fields editable for each work's CTA:
- `headline`, `body`, `ctaLabel` — display copy
- `triggerSecondsFromEnd` — when overlay appears
- `isEnabled` — on/off toggle
- `type` — RELEASE | MORE | POST_RELEASE

### Not in admin currently:
- No subtitle URL fields (no subtitle system exists)
- No visual intro/credits preview (admin enters raw second values)
- No per-episode CTA (one CTA per work, inherits from series)

---

## 4. Continue Watching — Current Status

**Watch progress is already fully implemented:**

- **Saves:** Every 10 seconds while playing, on pause, and on playback end
- **Resumes:** Watch page fetches `initialSeconds` from DB; player seeks on `loadedmetadata`
- **Completes:** At 90% watched, marked `completed: true`; resume from 0 if completed (not from middle of credits)
- **Series resume:** `getResumeEpisodeSlug()` finds last in-progress or first unwatched episode
- **Detail page:** Smart resume button links to the correct episode slug

**What is missing:**
- A "Continue Watching" rail on the homepage or dashboard (the data is saved but not surfaced on homepage for logged-in users). The homepage currently fetches continue-watching progress in `getHomeWorks()` area but the rail may be empty if no works are in-progress.

**Continue Watching rail on homepage — confirmed gap:** Looking at `app/(public)/page.tsx` line 167–169, `continueWatching` is fetched and passed to `<FilmRail title="Continue Watching">`. This IS already implemented. The rail appears only when the user has in-progress works.

**Conclusion: Continue Watching is fully working end-to-end.** No gap.

---

## 5. Skip Intro — Current Status

**Already fully implemented:**

- Appears when `currentTime >= introStart && currentTime < introEnd`
- Button text: "Skip Intro ›"
- Click seeks to `introEnd`
- Admin sets raw second values in work editor

**One gap:** No visual time indicator in the admin (admin enters `270` not "4:30"). A time-format helper in the admin form would improve usability, but is not a player bug.

---

## 6. Credits / Next Episode — Current Status

**Skip Credits already implemented:**

- Appears at `creditsStart` seconds
- Button text: "Skip Credits ›"
- Click seeks to `video.duration` (end)

**Up Next already implemented:**

- Appears 10 seconds before episode end
- 10-second countdown bar
- Auto-plays next episode or user can cancel
- Only shown for non-final episodes in a series

**One gap:** The Up Next countdown is 10 seconds (Ultra) vs 6 seconds (old AIM). Either is fine. No functional gap.

---

## 7. End-Card CTA — Current Status

**Already implemented:**

- `NotifyMeCtaOverlay` renders when `triggerSecondsFromEnd` is reached
- Fires `CTA_IMPRESSION` analytics beacon
- Admin configures headline, body, ctaLabel, triggerSecondsFromEnd per work
- Unique signup enforcement at DB level `[ctaId, email]`

**What is different from old AIM:**
- Old AIM had a 3-state flow: EndCard → Modal → Confirmation
- Ultra uses a single overlay (`NotifyMeCtaOverlay`)
- No translation/locale system (English only)

**Assessment:** Ultra's CTA system is simpler and appropriate. The old 3-state modal adds complexity without significant UX improvement for a single-language studio.

---

## 8. Content Advisory — Current Status

**Already implemented:**

- Renders rating badge + descriptor chips on first play
- Auto-fades after 5 seconds
- `DESCRIPTOR_LABELS` mapping (VIOLENCE, LANGUAGE, NUDITY, etc.)
- Admin sets `contentRating` (string) and `contentDescriptors` (string[])

**No gap.**

---

## 9. Subtitles — Current Status

**Not implemented in Ultra.** This is the only significant missing player feature.

What exists: `<video>` element is native, so adding `<track>` elements is straightforward.

What is missing:
- No VTT/SRT file hosting (no R2 upload for subtitle files)
- No admin subtitle URL field on works
- No CC button in the player UI
- No CC menu in `aim-player.tsx` or `aim-player.css`

---

## 10. Old AIM Studio Player — Features Found

**Location:** `aim-platform/src/components/WatchPlayer.tsx` (1350+ lines)

### Features the old platform had

| Feature | Old Complexity | Ultra Equivalent | Rebuild? |
|---|---|---|---|
| Skip Intro | Simple time-check | Already done ✅ | No |
| Skip Credits | Simple time-check | Already done ✅ | No |
| Up Next countdown | 60fps setInterval, 6s | 10s countdown ✅ | No |
| Content Advisory | Auto-fade 5s | Already done ✅ | No |
| CTA End-card | 3-state (card→modal→confirm) | Single overlay ✅ | No |
| Resume playback | Banner + manual button | Auto-resume ✅ (better) | No |
| Episode progress | % bars | Already done ✅ | No |
| Series resume | Smart slug lookup | Already done ✅ | No |
| Progress tracking | ~10s intervals | Already done ✅ | No |
| Subtitles (basic VTT) | Blob URL via fetch | Not in Ultra ❌ | Yes (simplified) |
| Multi-language CC | Language selector menu | Not in Ultra ❌ | Skip |
| Subtitle placement editor | 5-dimension admin tool | Not in Ultra ❌ | Skip |
| Per-cue subtitle overrides | Draggable preview | Not in Ultra ❌ | Skip |
| Pseudo-fullscreen CSS | Custom CSS fallback | Not in Ultra — not needed | Skip |
| Orientation lock | screen.orientation.lock | Not in Ultra | Skip |
| CTA translations | Locale key overrides | Not in Ultra | Skip |
| Playback speed | 0.25×–2× | 0.75×–2× ✅ | No |

---

## 11. Old AIM Studio — Subtitle System (What to Skip)

The old subtitle system was **far too complex to rebuild**:

**Admin editor features (skip all):**
- SRT/VTT file import → replaces cue list
- Revision history from `/api/admin/subtitles/revisions`
- Side-by-side translation mode
- Quality validator (84-char limit, overlap detection, gap warnings)
- 5-dimension placement config (vertical anchor, horizontal align, offsets, safe margin, font scale)
- Per-cue placement overrides
- Draggable preview editor on video thumbnail

**Player features (skip most):**
- Dynamic fetch per language from `/api/subtitles/{projectId}?lang=`
- Blob URL generation for native `<track>` element
- CC language selector menu with keyboard navigation
- Desktop/Mobile/Landscape three-tier subtitle positioning
- Responsive VideoRect calculation for letterboxed subtitles

**What is worth keeping if subtitles are needed:**
- Simple `<track kind="subtitles" src="[vtt-url]" label="English" default>` on the video element
- A CC on/off button in the player controls
- A single VTT URL field per work in the admin
- No multi-language in Phase 4B

---

## 12. Old AIM Studio — Things to Skip

| Feature | Reason to Skip |
|---|---|
| Full subtitle admin editor | High complexity, low immediate value. Use external SaaS if needed. |
| Multi-language CC selector | Not needed for English-only studio launch |
| Subtitle placement system | Over-engineered; bottom-center VTT is fine for MVP |
| Per-cue subtitle overrides | Requires custom tooling far beyond scope |
| Pseudo-fullscreen CSS fallback | Modern browsers support native fullscreen API |
| Orientation lock on fullscreen | Unreliable across platforms, causes UX friction |
| CTA locale/translation system | English-only; adds complexity without value for current scale |
| Resume banner (show/dismiss) | Ultra's auto-resume is cleaner UX than a banner |
| BotScore CTA anti-spam | DB uniqueness on [ctaId, email] is sufficient |
| 3-state CTA modal flow | Ultra's single overlay is cleaner |
| 60fps Up Next progress via setInterval | Ultra's simpler countdown approach is fine |

---

## 13. Recommended Phase 4B Implementation Plan

The Ultra player is already in excellent shape. Phase 4B changes should be **small, surgical, and high-value only.**

### Stage 1 — Admin UX improvements (no player changes)

These improve admin usability without touching the player:

1. **Time-format helper for intro/credits fields** in WorkForm: show "4:30" alongside raw second value. Admin enters `270`, sees "(4m 30s)". No schema change, no player change.

2. **Subtitle URL field** in WorkForm: single `subtitleUrl` string field per work. No schema change today — but schema needs one new field when approved.

### Stage 2 — Simple CC/Subtitle support (if approved separately)

Only implement if subtitles are a confirmed requirement. This requires:

1. **Schema:** Add `subtitleUrl String?` to `Work` model → one migration.
2. **Admin:** Add subtitle URL input to WorkForm.
3. **Watch page:** Pass `subtitleUrl` to `<AimPlayer>`.
4. **Player:** Add `<track kind="subtitles" src={subtitleUrl} label="English" default>` inside the `<video>` element when `subtitleUrl` is set. Add a CC toggle button (eye/CC icon). CSS for the CC button.

Complexity: Low. No blob URL system, no multi-language, no placement config. Native browser renders the VTT. ~50 lines total.

### Stage 3 — Player polish (CSS/UX only, no schema change)

Low-risk visual improvements:

1. Review skip button timing/styling on mobile — confirm tap targets are ≥44px.
2. Review Up Next card on mobile — confirm it does not obscure player controls.
3. Review Content Advisory on small screens.
4. Any visual regressions found during testing.

### Deferred to later phases

| Feature | When |
|---|---|
| Multi-language CC | After subtitle MVP is proven |
| Subtitle admin editor | Use external SaaS instead |
| Quality/resolution selector | When video hosting supports adaptive streaming |
| Analytics dashboard for watch data | Phase 5+ |
| Watch Party | Not in v1 scope |

---

## 14. Schema / Database Impact

| Change | Required for | Schema change needed? |
|---|---|---|
| None | All current player features | No |
| `subtitleUrl String?` on Work | Stage 2 subtitle support | Yes — one additive field, one migration |
| Any other field | Nothing planned | No |

**For Phase 4B Stage 1 (admin UX + time-format helper):** Zero schema changes.

**For Stage 2 (CC support):** One additive field, one migration, no existing data affected.

---

## 15. Risk Level

| Area | Risk | Reason |
|---|---|---|
| Stage 1 (admin helper) | Very Low | CSS/display only, no logic change |
| Stage 2 (CC support) | Low | Additive schema field, native browser `<track>` element |
| Stage 3 (player polish) | Low | CSS/UX only, no logic change |
| Subtitle system (full old) | High | Should not be rebuilt |
| Multi-language CC | Medium | Deferred |

**Overall Phase 4B risk: Low.**

The player is production-ready as-is. Phase 4B is refinement, not reconstruction.

---

## 16. Exact Files Likely to Touch If Approved

### Stage 1 — Admin UX (no player change)

| File | Change |
|---|---|
| `components/work-form.tsx` (or wherever WorkForm lives) | Add time-format display helper next to intro/credits inputs |

### Stage 2 — Simple CC (if approved)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `subtitleUrl String?` to Work model |
| `prisma/migrations/…_add_subtitle_url/migration.sql` | New migration |
| `app/admin/works/[id]/page.tsx` or WorkForm | Add subtitle URL text input |
| `app/(public)/watch/[slug]/page.tsx` | Select and pass `subtitleUrl` to AimPlayer |
| `components/aim-player.tsx` | Add `<track>` element, CC toggle button |
| `components/aim-player.css` | CC button styling |

### Stage 3 — Player polish (if issues found during testing)

| File | Likely change |
|---|---|
| `components/aim-player.css` | Mobile tap target adjustments |
| `app/(public)/watch/[slug]/watch.css` | Minor responsive fixes |

### Not touched in Phase 4B

- `components/hero-rotator.tsx`
- `components/mobile-featured-hero.tsx`
- `components/hero-desktop-section.tsx`
- Any admin page other than works editor
- Any public page other than watch/works
- `lib/page-media.ts`, `components/page-media-*.tsx`
- All Phase 3A CSS files

---

## Phase 4B Approval Checklist

Before coding begins, confirm:

- [ ] Stage 1 (admin time-format helper) approved
- [ ] Stage 2 (CC/subtitle support) approved OR deferred to later phase
- [ ] `subtitleUrl` field addition approved if Stage 2 proceeds
- [ ] Stage 3 (player polish) approved as part of Phase 4B or deferred
- [ ] Multi-language CC confirmed as out of scope for Phase 4B
- [ ] Full subtitle admin editor confirmed as out of scope for Phase 4B
- [ ] Old subtitle placement system confirmed as skip

---

*Audit completed 2026-06-03. No code was written. No database commands were run. Awaiting approval to proceed.*
