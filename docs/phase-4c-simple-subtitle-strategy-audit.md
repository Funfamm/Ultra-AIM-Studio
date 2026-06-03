# Phase 4C — Simple Subtitle Strategy Audit

**Date:** 2026-06-03
**Branch:** ultra-rebrand-phase-1
**Status:** Audit only — no code written, no database commands run

---

## Context

Phase 4B confirmed the Ultra player is production-ready. Subtitles were intentionally deferred. This document answers all subtitle strategy questions before any implementation.

### What was reviewed

| File | Purpose |
|---|---|
| `components/aim-player.tsx` (751 lines) | Full player — props, `<video>` element, controls, state, keyboard |
| `components/aim-player.css` | Player visual styling |
| `app/(public)/watch/[slug]/page.tsx` (571 lines) | Watch page — data fetching, Prisma select, AimPlayer prop wiring |
| `app/(public)/works/[slug]/page.tsx` | Works detail page |
| `app/admin/works/[id]/page.tsx` | Admin edit page — renders WorkForm + panels |
| `components/admin/work-form.tsx` | Admin form — all URL fields, timing fields, access controls |
| `prisma/schema.prisma` (1100+ lines) | Work model (lines 262–330) — all fields |
| `aim-platform/prisma/schema.prisma` | Old AIM — FilmSubtitle model (lines 239–294), SubtitleRevision, SubtitleHistoryClear, SubtitleJob |
| `docs/phase-4b-player-watch-experience-audit.md` | Previous audit — confirms player readiness |

### Key findings from code review

- **No subtitle-related code exists in Ultra.** Zero `<track>` elements, zero `.vtt` references, zero CC button or menu code.
- The `<video>` element is self-closing (`/>` at line 450). Adding `<track>` children requires converting it to an open/close pair `<video>...</video>`.
- **Episodes are not a separate model.** Episode = `Work` with `type: "EPISODE"` and a `parentId` pointing to a Series `Work`. Any field added to `Work` automatically applies to episodes.
- The player already accepts 50+ props (lines 25–54). Adding `subtitleUrl?: string | null` is trivial.
- The controls bar has clear left/right groupings (lines 666–744). CC toggle fits naturally next to the speed button.

---

## 1. Where Should Subtitles Be Stored?

### Options considered

| Option | Pros | Cons |
|---|---|---|
| `Work.subtitleUrl String?` | Zero new tables; covers all content types; matches existing URL pattern (`videoUrl`, `posterUrl`, `trailerUrl`) | One language per work |
| `Work.subtitleTracks Json?` | Multi-language in one field | Not queryable; hard to type safely; messy to migrate later |
| Separate `SubtitleTrack` model | Multi-language, per-track metadata, active toggle | New table, join queries, admin UI complexity — over-engineered for MVP |

### Recommendation: `Work.subtitleUrl String?`

**Reason:** Ultra has no file upload infrastructure and no multi-language requirement for launch. A single nullable URL field on `Work` is zero-join, covers every content type, and matches every other URL field in the schema.

**Future-safety:** When multi-language is needed, migrate to a `SubtitleTrack` model. The player can be designed from the start to accept the URL wrapped in a single-element array internally, so only the data layer changes later.

---

## 2. Single Language vs Multi-Language

### Recommendation: Single language (English) for MVP

- Ultra AIM Studio creates English-language original content
- No confirmed audience demand for multi-language CC
- Multi-language adds schema, player, and admin complexity for no current value
- Native HTML `<track>` supports multiple tracks natively — the browser renders its own language picker if you add multiple `<track>` elements
- Adding a second language later is additive: either add `subtitleUrlFr String?` or migrate to a `SubtitleTrack` model

---

## 3. Content Type Support

### Recommendation: All types via `Work.subtitleUrl`

Every content type in Ultra (SHORT_FILM, FULL_FILM, SERIES, EPISODE, TRAILER, COMMERCIAL, BRANDING, CAMPAIGN, CASE_STUDY) is a `Work` record.

- **Movie/short subtitles:** Admin sets URL → player renders CC.
- **Episode subtitles:** Each episode is its own Work → gets its own `subtitleUrl`.
- **Trailer subtitles:** Uncommon but available. Admin leaves it empty for most trailers.
- **Series itself:** No subtitles needed — series page redirects to episode for playback.

**No special-casing per content type.** If the field is set, the CC button renders. If not, the button is hidden.

---

## 4. Admin Workflow

### Recommendation: URL entry only in MVP

**Why:** Ultra has no file upload infrastructure (R2 Stage 2 is deferred). VTT files can be hosted on Cloudflare R2 public bucket, CDN, or any static host. This matches the existing admin pattern: admin pastes `videoUrl`, `posterUrl`, etc.

**Admin flow:**
1. Export/author a VTT file externally (Subtitle Edit, Happy Scribe, Kapwing)
2. Upload to R2 or any static host
3. Paste the public URL into the `Subtitle URL (VTT)` field in the admin works editor
4. Save

**When to add file upload:** When Media Manager R2 uploads are built (deferred). The URL field stays; the upload path just feeds into it.

**No SRT conversion in MVP.** Admin provides `.vtt` directly. External tools handle SRT→VTT conversion.

---

## 5. Public/Private Subtitle Toggle

### Recommendation: Defer — not needed for MVP

- If `subtitleUrl` is set, the VTT file is publicly hosted (the URL is direct)
- CC button doesn't render if `subtitleUrl` is null/empty
- Adding `subtitlesPublic Boolean @default(true)` adds schema, admin UI, and player logic for no confirmed use case

**If private subtitles are ever needed:** gate at the server-side watch page level (same as `requiresAuth` for video), or host VTT behind signed URLs.

---

## 6. Player Integration — Native `<track>` First?

### Recommendation: Yes — native `<track>` element, direct URL

```tsx
<video ref={videoRef} src={src} ...>
  {subtitleUrl && (
    <track
      kind="subtitles"
      src={subtitleUrl}
      label="English"
      srcLang="en"
      default
    />
  )}
</video>
```

**Implementation note:** The current `<video>` element is self-closing (`/>` at line 450 of aim-player.tsx). This must be converted to `<video>...</video>` to accept `<track>` children.

**Why not blob URLs (as old AIM used)?** Old AIM fetched VTT server-side and created blob URLs because subtitles were gated behind auth. Ultra's VTT files are publicly hosted — a direct `src` works without fetch overhead.

**CC on/off toggle:** `videoElement.textTracks[0].mode = 'showing' | 'hidden'` — ~10 lines of code.

---

## 7. Mobile CC Menu Behavior

### Recommendation: Simple on/off toggle for single-language

- One tap: captions on
- Another tap: captions off
- No dropdown or menu for single-language
- Button located next to the speed button in the controls row

**When multi-language is added:** CC button becomes a dropdown with language options + Off. Touch targets ≥ 44px. Dismiss on outside tap or Escape.

**What NOT to build:** Full-screen CC settings, bottom sheet, placement config, font size adjustment.

**Persistence:** Store CC preference in `localStorage` so it persists across works.

---

## 8. Fallback When No Subtitles Exist

**Behavior when `subtitleUrl` is null or empty:**
- CC button is not rendered
- No error, no "No subtitles available" message
- Player looks and behaves identically to current state

This is the correct approach. Hiding an absent feature is less disruptive than showing a disabled button.

---

## 9. Old AIM Subtitle Features to Skip

| Feature | Skip Reason |
|---|---|
| **5-dimension placement** (vertical anchor, horizontal align, X/Y offsets, safe margin, font scale) | Over-engineered. Native browser CC rendering is standard and accessible. |
| **Per-cue placement overrides** | No editor to set them; no renderer to display them |
| **Three-tier placement** (desktop / mobile portrait / landscape) | Native `<track>` handles responsive display |
| **Subtitle admin editor** (cue list, import SRT/VTT, quality validator) | Use external SaaS for authoring; Ultra stores URL only |
| **Revision history** (`SubtitleRevision` model, `SubtitleHistoryClear` model) | Not needed without an editor |
| **Side-by-side translation editor** | No translation workflow planned |
| **Multi-language CC selector menu** | Single language for MVP |
| **Blob URL fetch system** | Public VTT URLs don't need auth-gated blob generation |
| **AI subtitle generation** (`SubtitleJob` model) | Not in scope |
| **AI translation workflow** | Not in scope |
| **VideoRect letterbox calculation** | Native browser handles caption positioning |
| **Status text during CC load** ("Loading captions…") | Direct URL fetch is near-instant |

### Old AIM subtitle model complexity (for reference):

The old `FilmSubtitle` model (lines 239–294 of old schema) had **30+ fields** including:
- `segments String` — JSON transcript
- `translations String?` — JSON multi-language translations
- `langStatus Json?` — per-language processing status
- `vttPaths Json?` — versioned R2 object keys
- `qcIssues String?` — Netflix-spec quality checks
- `verticalAnchor`, `horizontalAlign`, `offsetYPercent`, `offsetXPercent` — desktop placement
- `mobileSafeAreaMarginPx`, `mobileFontScale` — mobile placement
- `landscapeVerticalAnchor`, `landscapeFontScale` — landscape placement
- `cueOverrides String` — per-cue JSON overrides

Plus related models: `SubtitleRevision` (revision history), `SubtitleHistoryClear` (admin clear audit), `SubtitleJob` (AI generation tracking).

**Ultra replaces all of this with:** `subtitleUrl String?` — one field.

---

## 10. Exact Files to Touch If Approved

### Schema (one migration)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `subtitleUrl String?` to Work model (line ~277, after `teaserUrl`) |
| `prisma/migrations/…_add_subtitle_url/migration.sql` | `ALTER TABLE "works" ADD COLUMN "subtitleUrl" TEXT;` |

### Admin (one field)

| File | Change |
|---|---|
| `components/admin/work-form.tsx` | Add `Subtitle URL (VTT)` input below existing video URL fields |

### Watch page (one select + one prop)

| File | Change |
|---|---|
| `app/(public)/watch/[slug]/page.tsx` | Add `subtitleUrl: true` to Prisma select (line ~45); pass as prop to `<AimPlayer>` |

### Player (track + toggle)

| File | Change |
|---|---|
| `components/aim-player.tsx` | Accept `subtitleUrl?: string \| null` prop; convert `<video />` to `<video>...</video>` with `<track>` child; add CC toggle button; add `ccOn` state; ~40 lines |
| `components/aim-player.css` | CC button styling; active/inactive state; ~25 lines |

### Not touched

- All Phase 3A admin CSS files
- `lib/page-media.ts` and PageMedia components
- `components/hero-desktop-section.tsx`, `HeroRotator`, `MobileFeaturedHero`
- Any admin page other than works editor
- `components/works-client.tsx`
- No public pages other than watch

**Total: ~6 files, ~100 lines.**

---

## 11. Schema Change Needed?

**Yes — one additive field.**

```prisma
model Work {
  // existing video URLs ...
  trailerUrl  String?
  videoUrl    String?
  teaserUrl   String?
  subtitleUrl String?   // VTT file URL — null = no captions
  // ...
}
```

**Migration SQL:**
```sql
ALTER TABLE "works" ADD COLUMN "subtitleUrl" TEXT;
```

One nullable column. No existing data affected. No existing functionality changes. No foreign keys, no new tables, no enum changes.

---

## 12. Risk Level

| Area | Risk | Reason |
|---|---|---|
| Schema migration | Very Low | Single nullable column addition |
| Player change | Very Low | One `<track>` element + one toggle button, entirely additive |
| Admin change | Very Low | One additional URL input field |
| Watch page change | Negligible | One extra `select` field in existing query |
| Rollback | Easy | Remove `<track>`, remove CC button, drop column |

**Overall risk: Very Low.**

---

## Recommended Implementation Sequence

### If subtitles are needed before launch

**Stage 1 — Schema (~15 min):**
1. Add `subtitleUrl String?` to schema
2. `prisma migrate dev --name add_subtitle_url`
3. `prisma generate`
4. TypeScript check

**Stage 2 — Admin (~15 min):**
5. Add "Subtitle URL (VTT)" input to WorkForm
6. Test: save URL, confirm persistence

**Stage 3 — Player (~30 min):**
7. Pass `subtitleUrl` from watch page → AimPlayer
8. Convert `<video />` to `<video>` with `<track>` child
9. Add CC toggle button to controls
10. Add CC button CSS + localStorage preference
11. Test: captions show when URL set, button hidden when absent

**Total: ~60 minutes. Risk: Very Low.**

### If subtitles are not needed before launch

**Defer implementation. Move to Phase 5 — Deployment Readiness.** This audit and design is complete and can be executed in one session whenever subtitles become a priority.

---

## Summary Answers

| # | Question | Answer |
|---|---|---|
| 1 | Where to store subtitles? | `Work.subtitleUrl String?` — one field, covers all content types |
| 2 | Single vs multi-language? | Single language (English) for MVP |
| 3 | Movie/trailer/episode support? | All types — every content type is a `Work` record |
| 4 | Admin workflow? | URL entry only; no upload until R2 Stage 2 |
| 5 | Public/private toggle? | Defer — present = renders CC, absent = hidden |
| 6 | Native `<track>`? | Yes — direct URL, no blob system |
| 7 | Mobile CC menu? | Simple on/off toggle; dropdown only for multi-language |
| 8 | Fallback? | CC button hidden when no URL; no error message |
| 9 | Old features to skip? | Placement editor, revisions, multi-lang, AI, blob URLs |
| 10 | Files to touch? | ~6 files, ~100 lines |
| 11 | Schema change? | Yes — one `ALTER TABLE ADD COLUMN TEXT` |
| 12 | Risk level? | Very Low |

---

*Audit completed 2026-06-03. No code was written. No database commands were run. Awaiting decision on whether to implement or defer to Phase 5.*
