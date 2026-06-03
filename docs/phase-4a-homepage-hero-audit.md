# Phase 4A — Homepage / Hero Visual Restoration Audit

**Date:** 2026-06-03
**Branch:** ultra-rebrand-phase-1
**Status:** Audit only — no code written, no database commands run

---

## 1. Current Ultra Homepage Architecture

The homepage is a **Next.js server component** (`app/(public)/page.tsx`) that:

**Data fetched server-side:**
- Featured works (`showOnHome: true`, `featured: true`, ordered by `order`, max 6)
- New releases (ordered by `createdAt` desc, max 8)
- User-specific: watch progress, saved work IDs, available work types (for pills)

**Components rendered:**
| Component | Viewport | Purpose |
|---|---|---|
| `MobileFeaturedHero` | <768px | Carousel hero with swipe, category pills, CTAs per work |
| `HeroDesktopSection` | ≥768px | Wraps `HeroRotator`, syncs CTA buttons to active slide |
| `HeroRotator` | ≥768px | Rotating background images from Work hero URLs, 4s interval |
| `FilmRail` (×3) | all | Continue Watching, Featured Works, New Releases |

**Current hero headline (static, in `HeroDesktopSection`):**
> "Cinema, reimagined."

**Current CTA buttons (per-slide, synced from work data):**
- Primary: `current.primaryLabel` (e.g., "Watch Short", "Watch Now") → `/works/{slug}`
- Secondary: `current.secondaryLabel` (e.g., "Watch Trailer") → trailer URL
- Static tertiary: "Find Your Way In" → `/about`

**Current empty state:** Shows "We're cooking. The first films drop soon." when no works exist. Below that is a brand strip and studio identity section with headline, copy, and CTAs.

**PageMedia on homepage today:** Not integrated. The `getPageMedia` helper exists but is not called in `page.tsx`. The hero background comes entirely from Work-level `heroDesktopUrl` / `heroMobileUrl` fields.

**Key architecture strengths to preserve:**
- Server-side CTA pre-computation (no stale-state bug)
- `onSlideChange` callback syncing CTAs to the active slide
- Separate mobile / desktop components (no shared hydration complexity)
- `FilmRail` horizontal scroll for work discovery

---

## 2. Old AIM Studio Homepage — Visual Elements Found

**Source examined:** `c:\Users\mxz\Desktop\my website\aim-platform`

The old homepage used a **cinematic immersive design** with multiple visual layers:

**Background system (`HeroBackground.tsx`):**
- Premium cinematic gradient base (dark charcoal)
- Static poster/fallback image (renders immediately before API resolves)
- Media Manager-controlled images (6-second slideshow rotation, opacity fade)
- Two video slots with 1.2s crossfade on desktop only
- Dark overlay gradient for text readability
- Zoom animation: scale 1.0 → 1.05 over 12 seconds on visible images
- Connection-gated video: 4G + no Save-Data + device memory ≥4GB

**Hero headline (`HomeHero.tsx`):**
- Eyebrow: studio label
- Headline: Contains a **rotating word span** — a gold gradient italic word cycles every 3 seconds (e.g., "provoke", "remember", "matter")
- The rotating word sits inline in the headline with a fade + slide-up animation
- Sub-headline: secondary descriptive copy

**CTA buttons:**
- Primary: solid gold fill, "Watch Now" or "Watch the Films"
- Secondary: glass morphism (backdrop-filter: blur(8px), 1px border rgba(255,255,255,0.18))

**Stats pill:**
- Inline pill below CTAs
- Three stats: **Films** (gold accent), **Upcoming** (white), **Castings/Open Roles** (gold)
- Separator dots between values

**3D canvas (`Scene3D.tsx`):**
- Full-viewport fixed canvas
- 35 ambient particles with radial gradients
- O(n²) connection lines between particles
- Throttled to ~30fps for performance

**Floating ambient particles (desktop only):**
- 3 hardcoded glowing dots (box-shadow glow)
- Infinite CSS animations at 6s/8s/10s intervals
- GPU-intensive due to animated box-shadows

**Featured projects:**
- `FeaturedProjects3D` — desktop uses `ScrollReveal3D` wrapper per card (staggered delay, rotate 6°, distance 50px)
- Mobile: horizontal snap scroll

**Hydration complexity:**
- `isMobileHint` prop propagated through multiple component layers
- `isMobileRef` workaround for stale closure bug in async media fetch
- Multiple `useEffect` dependencies on `isMobileDevice` resolving

---

## 3. Elements to Rebuild

These old visual elements are worth rebuilding cleanly on the Ultra foundation:

| Element | Why | How to rebuild |
|---|---|---|
| **Cinematic headline with gold accent word** | Strong emotional impact, brand identity | Static headline with gold italic CSS on final/accent word. No rotating word needed — static is faster and more focused |
| **Stats pill** | Shows studio activity, builds credibility | Server-fetched counts (published works, upcoming, open roles) rendered as an inline pill with gold/white accent |
| **PageMedia-controlled background** | Lets admin update homepage look without deploys | Use existing `getPageMedia("home")` + `PageMediaVideo`/`PageMediaImage` components already built in Phase 3B |
| **Stronger cinematic overlay** | Current overlay exists but can be more cinematic | Richer gradient layering on the hero section |
| **Primary gold CTA: "Watch the Films"** | Clear action, brand-appropriate | Update static CTA labels in `HeroDesktopSection` |
| **Glass secondary CTA: "Join the Next One"** | Premium feel, matches brand | Add secondary glass CTA linking to registration or notify-me flow |
| **Improved eyebrow treatment** | More editorial | Keep "— Now Streaming" eyebrow but style more sharply |

---

## 4. Elements to Skip

These old elements must **not** be rebuilt:

| Element | Why to skip |
|---|---|
| **Scene3D / 3D canvas** | O(n²) particle checks, GPU heat on mobile, unnecessary complexity |
| **FeaturedProjects3D / ScrollReveal3D** | Heavy animation, not needed for work discovery |
| **Rotating word animation** | JS `setInterval` driving inline style transitions — fragile, harder to maintain, and a static elegant headline is stronger |
| **Floating ambient particles** | Animated `box-shadow` is GPU-intensive; gains no functional value |
| **Dual video crossfade system** | Stale-closure bug, `isMobileRef` workaround, hydration complexity — Phase 3B's `PageMediaVideo` is cleaner |
| **HeroBackground dual-path architecture** | Unnecessary — `PageMediaVideo` + `PageMediaImage` already handle device-targeting and connection gating |
| **`isMobileHint` hydration workarounds** | Architecture smell — separate mobile/desktop components (already in Ultra) is the right pattern |
| **Zoom animation on background images** | Scale transforms on large images are GPU-heavy; subtle or none is fine |
| **`ScrollReveal3D` / rotate animations on cards** | Adds jank on lower-end devices; Ultra's clean card layout is already premium |
| **Sponsor banners / ThreeWaysIn** | Old AIM Studio feature sections not needed in Ultra |

---

## 5. PageMedia Homepage Integration Strategy

**Approach:** PageMedia acts as the **background canvas layer** behind the existing hero system. Work-level hero images (from `heroDesktopUrl`/`heroMobileUrl`) remain the primary background; PageMedia fills the canvas when no work heroes exist, or always if admin sets a persistent cinematic background.

**Rendering priority on desktop:**
1. Work heroes (from HeroRotator, using `heroDesktopUrl`) — primary, per-slide
2. PageMedia background (if no work heroes, or as a static canvas behind the rotator)

**Rendering priority on mobile:**
1. Work mobile heroes (from MobileFeaturedHero, using `heroMobileUrl`) — primary
2. PageMedia MOBILE or BOTH image as canvas background on the hero section

**Device targeting:**
- `deviceTarget: DESKTOP` → show on `.hero` section (≥768px), hidden on mobile
- `deviceTarget: MOBILE` → show on `.mfh-*` section (<768px), hidden on desktop
- `deviceTarget: BOTH` → both sections can use it

**Fallback:** If no active `page = "home"` PageMedia exists, current behavior continues unchanged. No blank hero, no broken layout.

**Integration point:** `app/(public)/page.tsx` calls `getPageMedia("home")` and passes:
- First active IMAGE or VIDEO item with `deviceTarget: DESKTOP or BOTH` → `HeroDesktopSection` as `pageBg`
- First active IMAGE item with `deviceTarget: MOBILE or BOTH` → `MobileFeaturedHero` as `mobileBg`

---

## 6. Desktop Design Plan

**Full viewport hero section layout:**

```
┌─────────────────────────────────────────────────────────┐
│ [Background layer: PageMedia image/video OR dark canvas] │
│ [Dark cinematic overlay gradient]                         │
│                                                          │
│  — Now Streaming                           [eyebrow]     │
│                                                          │
│  Cinema for the moments                   [headline]     │
│  we can't take back.                                     │
│                          [gold italic: "take back"]      │
│                                                          │
│  Original cinema built around story,      [desc]         │
│  emotion, memory, and the moments                        │
│  people refuse to look away from.                        │
│                                                          │
│  [Watch the Films ▶]  [Join the Next One]  [CTAs]        │
│                                                          │
│  ● 12 Films  · 3 Upcoming  · 2 Open Roles  [stats]      │
└─────────────────────────────────────────────────────────┘
                    ↓ scroll ↓
                [Film Rails]
```

**CSS changes needed:**
- Headline upgrade: `font-size: clamp(3rem, 5.5vw, 5.5rem)`, gold italic on accent span
- CTA labels: "Watch the Films" (primary gold) + "Join the Next One" (glass secondary)
- Stats pill: inline, gold for number values, muted separators
- Background: When PageMedia `pageBg` is set, apply behind HeroRotator as an `<img>` element (not CSS background) to support lazy/eager loading properly and device art direction

**Background image stacking (desktop):**
```
.hero
  └── .hero-bg (absolute, z-index 0)
        ├── [pageBg img, absolutely positioned, object-fit cover] ← NEW: PageMedia canvas
        ├── HeroRotator (existing work heroes, on top of pageBg)
        └── .hero-gradient (existing overlay)
  └── .hero-content (z-index 1, existing, updated copy + CTAs)
```

**HeroRotator remains primary.** PageMedia is the canvas that shows when HeroRotator slides are dark/empty or as a persistent cinematic floor texture.

---

## 7. Mobile Design Plan

Mobile keeps the existing `MobileFeaturedHero` architecture which is already strong:
- Swipe gesture works well
- Category pills work well
- Per-work CTAs are functional
- Poster images load correctly

**Additions for Phase 4A:**
- Accept optional `mobileBg` prop: a PageMedia IMAGE URL (MOBILE or BOTH target)
- Apply as `style={{ backgroundImage: url(...) }}` on the `.mfh` wrapper section if set
- Mobile-only: **no video background** — image-first, always poster
- Keep `prefers-reduced-motion` auto-pause (already implemented)
- Keep `RESUME_MS = 3000` debounce after user interaction (already implemented)

**Mobile CTA targets:**
- Primary: "Watch" / "Watch Trailer" (per-work, already synced to slide)
- No change to mobile CTA labels in Phase 4A

---

## 8. CTA Routing Plan

**Desktop hero CTAs (updated labels, existing routing):**

| Button | Label | Route | Style |
|---|---|---|---|
| Primary (per-slide) | "Watch the Films" → or per-work label | `/works/{slug}` | Gold fill, 52px height |
| Secondary (per-slide) | "Watch Trailer" (if trailer exists) | trailer URL or `/works/{slug}#trailer` | Glass, 52px height |
| Static | "Join the Next One" | `/register` (if not logged in) or `/dashboard` (if logged in) | Ghost outline |

**Current routing:** Per-slide primary/secondary is already correct (work-level hrefs). The static "Find Your Way In" → `/about` should be replaced with a more action-driven CTA.

**Implementation note:** `HeroDesktopSection` passes `current.primaryLabel` and `current.primaryHref` from server-pre-computed work data. The static CTA (currently "Find Your Way In") will be changed to "Join the Next One" → `/register`.

**Mobile CTAs:** No change — per-work labels work correctly.

---

## 9. Stats Source Plan

**Stats to show in pill:**
- **Films** — count of `PUBLISHED` works excluding `EPISODE` type
- **Upcoming** — count of works with `status: UPCOMING or IN_PRODUCTION`
- **Open Roles** — count from `AdminSettings.showCasting` gate; if casting not enabled, show `0` or hide

**Fetch approach:**
- Add to the existing `Promise.all` in `page.tsx` (server-side, no extra API call)
- Example additions:
  ```ts
  prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } })
  prisma.work.count({ where: { status: { in: ["UPCOMING", "IN_PRODUCTION"] } } })
  ```
- Open Roles: For V1, hardcode `0` or omit if casting module is not built. The stats pill renders whatever counts are passed; the label can be hidden if count = 0.

**Rendering:** Pass counts to `HeroDesktopSection` as a `stats` prop. Render inline pill below CTA buttons.

---

## 10. Exact Files to Touch

**Modified files:**

| File | Change |
|---|---|
| `app/(public)/page.tsx` | Add `getPageMedia("home")`, extract `homeBg`/`mobileBg`, fetch stats counts, pass to components |
| `app/(public)/home.css` | Upgrade headline font size + italic gold span; style stats pill; adjust hero copy color; add pageBg image CSS |
| `components/hero-desktop-section.tsx` | Accept `pageBg?: string \| null`, `stats?`, updated static CTA label ("Join the Next One" → `/register`); render pageBg `<img>` inside `.hero-bg`; render stats pill |
| `components/mobile-featured-hero.tsx` | Accept `mobileBg?: string \| null`; apply as section background if set |

**New files:**

None required. `PageMediaVideo`, `PageMediaImage`, and `getPageMedia` from Phase 3B handle the media layer.

**Not touched:**
- `HeroRotator` — no changes needed
- `FilmRail` — no changes needed
- `components/page-media-video.tsx` — already correct
- `components/page-media-image.tsx` — already correct
- Admin routes — no changes
- Schema — no changes
- All Phase 3A CSS files — no changes

---

## 11. Schema / Database Impact

**Zero schema changes required.**

All data needed exists:
- Work hero images: already on `Work.heroDesktopUrl`, `Work.heroMobileUrl`
- Stats: computed from existing `Work.status` and `Work.type` fields
- PageMedia: `PageMedia` model already live with `page="home"` support

**No migration needed. No `db:push`. No schema changes.**

---

## 12. Performance Risk

| Area | Risk | Mitigation |
|---|---|---|
| PageMedia background image | Low | `loading="lazy"` unless first-above-fold; `decoding="async"`; Next.js static file or CDN URL |
| PageMedia video (desktop) | Low | `PageMediaVideo` already gates on 4G + no Save-Data + no reduced-motion; `preload="none"` |
| Stats DB queries | Negligible | 2 simple `count()` queries added to existing `Promise.all`; no N+1 |
| Headline font size increase | None | Pure CSS; no JS change |
| Stats pill DOM | None | 3 numbers, pure HTML; lightweight |
| Mobile background | Low | Image only, no video; lazy loaded |
| No 3D/animations | N/A | Not building them |

**Overall risk: Low.** All changes are additive and isolated. Existing fallbacks remain intact.

---

## 13. Recommended Phase 4A Implementation Plan

### Stage 1 — Visual upgrade only (no PageMedia, no stats)

1. Update `home.css`:
   - Increase hero headline size
   - Add `.hero-title-accent` class (gold italic for the emotional word)
   - Improve cinematic overlay gradient
   - Add stats pill CSS (`.hero-stats`, `.hero-stat-num`, `.hero-stat-label`)

2. Update `hero-desktop-section.tsx`:
   - Change static CTA from "Find Your Way In → /about" to "Join the Next One → /register"
   - Add accent word to headline (wrap last/accent word in `<em className="hero-title-accent">`)

3. Verify TypeScript passes, confirm no regressions.

### Stage 2 — Stats pill

4. Add 2 count queries to `page.tsx` `Promise.all`
5. Pass stats to `HeroDesktopSection`, render pill below CTAs

### Stage 3 — PageMedia homepage background

6. Add `getPageMedia("home")` call in `page.tsx`
7. Extract first active IMAGE/VIDEO (DESKTOP or BOTH) as `homeBg` item
8. Extract first active IMAGE (MOBILE or BOTH) as `mobileBg` URL
9. Pass `homeBg` to `HeroDesktopSection` → render `<img>` or `<PageMediaVideo>` inside `.hero-bg` before `HeroRotator`
10. Pass `mobileBg` to `MobileFeaturedHero` → apply as section background if set

### Stage 4 — QA and commit

11. Test with empty PageMedia table → current fallback unchanged
12. Test with IMAGE item active for "home" → background appears on desktop
13. Test with VIDEO item → poster first, video only if 4G and connection API available
14. Deactivate → fallback restores
15. Confirm mobile has no layout shift
16. Run TypeScript
17. Commit

---

## Phase 4A Approval Checklist

Before coding begins, confirm:

- [ ] Headline direction approved: static cinematic headline with gold italic accent word
- [ ] Stats pill fields approved: Films / Upcoming / Open Roles (or Films / Upcoming only for V1)
- [ ] Desktop CTA labels approved: "Watch the Films" (primary) + "Join the Next One" (secondary)
- [ ] PageMedia strategy approved: background canvas layer, Work heroes remain primary
- [ ] Mobile strategy approved: image-only PageMedia background, no mobile video in Phase 4A
- [ ] No 3D/rotating-word/particle effects confirmed skipped
- [ ] Home integration stage sequence (visual → stats → PageMedia) approved

---

*Audit completed 2026-06-03. No code was written. No database commands were run. Awaiting approval to proceed.*
