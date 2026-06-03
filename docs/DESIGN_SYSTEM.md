# AIM Studio Lite — Design System

**Status:** Approved. All UI work must follow this document.
**Last updated:** 2026-05-23

---

## Brand Personality

**Three words: Authoritative. Cinematic. Restrained.**

AIM Studio Lite operates at the intersection of:
- **Netflix** — media browsing mastery, horizontal rails, hero treatment, hover overlays
- **A24** — editorial restraint, bold type, confidence through whitespace, image respect
- **Apple** — 8pt spatial discipline, minimal UI chrome, one purposeful CTA per view
- **Letterboxd** — cinephile credibility, image-first cards, dark warmth, cultural authority

Not flashy. Not trying hard. Confident enough to leave space.

---

## Color Usage Rules

Palette tokens are defined in `app/globals.css` under `@theme`. Never use arbitrary hex values.

| Token | Hex | Correct use | Never use for |
|---|---|---|---|
| `brand-black` | `#0a0a0a` | Page background only | Components, cards, panels |
| `brand-dark` | `#111111` | Footer, about strip, secondary sections | Card backgrounds (cards = image only) |
| `brand-surface` | `#1a1a1a` | Admin panels, form inputs, modals | Page backgrounds |
| `brand-border` | `#2a2a2a` | Dividers, horizontal rules, nav underline | Decorative card borders |
| `brand-muted` | `#6b7280` | Secondary text, captions, timestamps | Headings, primary actions |
| `brand-light` | `#e5e7eb` | Body text, descriptions | Headings |
| `brand-white` | `#f9fafb` | Headings, active states, primary text | Body paragraphs |
| `brand-accent` | `#e8c97e` | **One use per view** — primary CTA only | Genre labels, hover borders, multiple elements |
| `brand-red` | `#c0392b` | Error states, destructive actions | Decorative elements |

**Elevation system — three levels only:**
- Level 0: `brand-black` — page background
- Level 1: `brand-dark` — footer, about strip, secondary sections
- Level 2: `brand-surface` — admin panels, form containers, overlays

**Gold discipline:** When everything is gold, nothing is premium. `brand-accent` appears once per view — on the primary action. All secondary elements use white or muted.

---

## Typography Rules

Fonts are loaded via `next/font/google` in the app layout. CSS variables `--font-cormorant` and `--font-manrope` are injected on `<html>`, then aliased to `--font-display` and `--font-body` in `@theme`.

**Font stack:**
- Display/editorial: **Cormorant Garamond** — weights 300, 600, 700 — `var(--font-display)`
- Body/UI: **Manrope** — weights 400, 500, 600, 700 — `var(--font-body)`

**Logo wordmark:** `AIM` in Cormorant 700 + `0.04em` tracking / `Studio` in Cormorant 300 + gold + `0.1em` tracking — never weight 900.

| Name | Font | Size | Weight | Tracking | Line height | Use |
|---|---|---|---|---|---|---|
| Display | Cormorant Garamond | `clamp(3.5rem, 9vw, 7rem)` | 700 | `-0.03em` | `1.05` | Hero title only |
| H1 | Cormorant Garamond | `clamp(2rem, 5vw, 3.25rem)` | 700 | `-0.02em` | `1.15` | Page titles |
| H2 | Cormorant Garamond | `clamp(1.4rem, 3vw, 1.875rem)` | 700 | `-0.01em` | `1.15` | Section headings |
| H3 | Cormorant Garamond | `1.125rem` | 600 | `0` | `1.35` | Card titles, sub-heads |
| Body | Manrope | `1rem` | 400 | `0` | `1.6` | Paragraphs, descriptions |
| UI | Manrope | `0.875rem` | 500 | `0` | — | Nav links, button labels |
| Label | Manrope | `0.6875rem` | 600 | `0.1em` | — | Uppercase tags, genres, eyebrows |
| Micro | Manrope | `0.75rem` | 400 | `0` | — | Meta, timestamps, captions |

**Rules:**
- Negative letter-spacing on all display/heading type — this creates editorial confidence
- `text-transform: uppercase` only on Label and nav links — never on headings
- Weight 900 only on the logo mark — nowhere else
- Section eyebrows: small gold Label text above the H2 (e.g., `— Latest Work`), not a badge or pill
- All heading colors: `brand-white`
- Body color: `brand-light`
- Secondary/meta color: `brand-muted`

---

## 8pt Spacing Grid

Every spacing value must be a multiple of 4. No exceptions.

```
4px  (0.25rem)  — icon gaps, tight inline spacing
8px  (0.5rem)   — between related elements
12px (0.75rem)  — form field internal padding (vertical)
16px (1rem)     — component internal padding (small)
24px (1.5rem)   — component internal padding (standard), mobile container padding
32px (2rem)     — between components on mobile
48px (3rem)     — section padding mobile / between components desktop
64px (4rem)     — section padding tablet
96px (6rem)     — section padding desktop
128px (8rem)    — hero top padding, landmark spacing
```

**Container:**
- Max-width: `1280px`
- Mobile padding: `24px`
- Tablet (640px+): `48px`
- Desktop (1024px+): `64px`

**Kill all odd values.** Never use `0.35rem`, `0.7rem`, `0.875rem` gap, `1.1rem`, `2.5rem`, `4.5rem`. Round to the nearest grid point.

---

## Button Rules

Three variants only. One primary button per view.

### Primary (gold fill)
Used for: hero watch CTA, main form submit, single primary page action.
```
height: 52px
padding: 0 32px
background: brand-accent
color: brand-black
font-weight: 600
font-size: 0.875rem
letter-spacing: 0.06em
text-transform: uppercase
border-radius: 2px
border: none
hover: translateY(-2px) + brightness(1.05)  — NOT opacity
```

### Ghost (outlined)
Used for: secondary hero CTA ("Learn More"), non-primary page actions.
```
height: 52px
padding: 0 32px
background: transparent
border: 1px solid rgba(255,255,255,0.3)
color: brand-white
font-weight: 500
border-radius: 2px
hover: border → rgba(255,255,255,0.7) + background → rgba(255,255,255,0.05)
```

### Text (no chrome)
Used for: nav sign-in link, inline subtle actions, "View all" links below rails.
```
background: none
border: none
padding: 0
color: brand-muted → brand-white on hover
font-weight: 500
font-size: 0.875rem
underline: focus only, not hover
```

**Rules:**
- Remove gold CTA from the nav — nav uses text variant for Sign In
- Hover state is never `opacity: 0.88` — use transform or color transitions
- All touch targets: minimum 44×44px, minimum 52px height for primary buttons
- Border-radius: always `2px` — never `4px`, `6px`, `8px`, `12px` on buttons

---

## Film Card Rules

**Fundamental principle: the card IS the image. Not an image inside a card.**

### Structure
```
<Link> (the card)
  <div> aspect-[2/3], overflow-hidden
    <Image fill object-cover />          ← poster, fills 100%
    <div> gradient overlay (always)      ← darkens bottom 55%
    <div> genre label (inside, bottom)   ← gold, uppercase, 11px
    <h3> title (inside, bottom)          ← Playfair, white, line-clamp-2
    <div> lock badge (top-right)         ← members only
  </div>
  ← NO info panel below the image
</Link>
```

### Visual rules
- `border: none` — no card borders
- `border-radius: 4px` — minimal, consistent
- `background: transparent` — image IS the card
- Info panel below image: **eliminated**
- Genre label: `position absolute`, `bottom: 52px`, `left: 16px` — inside poster
- Title: `position absolute`, `bottom: 16px`, `left: 16px`, `right: 16px` — inside poster
- Year/duration: removed from card — belongs on the detail page
- Gradient: `linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 55%)`
- Hover (desktop): `scale(1.04)` + `box-shadow: 0 8px 32px rgba(0,0,0,0.6)` — no gold border flash
- Mobile: gradient + title always visible — no hover-only text

### Performance rules for cards
- Use `next/image` with `fill` + proper `sizes` attribute
- First 3–4 cards in the first rail: `priority={true}`
- All others: default (lazy)
- Never use `<img>` for poster images

---

## Homepage Section Structure

```
NAV — 68px fixed, blur backdrop, no gold CTA button
│
HERO — 95dvh
  Poster: 60–70% opacity (not 35%)
  Gradient: strong at bottom 60%, transparent at top
  Layout: left-aligned, bottom-anchored content
  Eyebrow: gold Label text ("Now Streaming")
  Title: Display size, Playfair 700, white
  Tagline: one line, body, muted, max 480px wide
  CTA row: Primary button + Ghost button
  Remove: "scroll" hint text (trite, remove entirely)
│
NEW RELEASES — 96px top padding
  Eyebrow: gold Label above H2 ("— Latest Work")
  H2: large Playfair, left-aligned
  Rail: horizontal scroll, 220px cards desktop, 160px mobile
  Below rail: text-variant "View all films →" link (not inline with header)
│
STAFF PICKS — 64px top padding
  Visually differentiated from New Releases
  Consider: editorial 3-up grid or numbered overlay on cards
│
STUDIO STATEMENT — 96px top padding
  Replace the AI/4K/∞ stat strip entirely
  Large editorial Playfair display quote: 2–3 lines
  Example: "Films that couldn't exist before now."
  No stats. No bullet points. One optional text link below.
│
FOOTER — 48px padding, minimal
  Logo left / nav links center / copyright right
  No tagline (homepage already set the mood)
```

---

## 4G / Mobile Performance Rules

- Animate only `transform` and `opacity` — never `height`, `width`, `top`, `left`
- Transition duration: `150–250ms` — never exceed 300ms for UI responses
- Use `next/image` everywhere — no raw `<img>` tags for content images
- `sizes` attribute required on every `<Image>` — prevents oversized downloads on mobile
- `priority` only on above-fold images — max 3–4 per page
- No autoplay video anywhere
- No third-party scripts without `strategy="lazyOnload"`
- Skeleton states for any content load >300ms
- `min-h-dvh` not `min-h-screen` — fixes iOS Safari address bar
- `touch-action: manipulation` on all interactive elements — removes 300ms tap delay
- All touch targets: minimum 44×44px
- Test at 375px (iPhone SE), 768px (tablet), 1280px (desktop) before marking done
- Fonts: `display: swap` — never block render

---

## Things to Avoid

### Template UI patterns
- Pill buttons with `border-radius: 100px` on genre filters
- Solid gold button in the navigation header
- Inline `<style>` blocks (acceptable for now — migrate to Tailwind utilities progressively)
- Stat tiles (AI / 4K / ∞) that communicate nothing real
- "scroll ↓" hints at the bottom of heroes
- Card info panels below poster images

### Excessive gold
- `brand-accent` on genre labels, hover borders, active states, section links, AND the primary CTA simultaneously
- Gold used more than once per view
- Gold on anything that isn't the single primary action

### Heavy animations
- Framer Motion (not installed — do not add)
- `transition: all` — always target specific properties
- Animations over 300ms
- Entrance animations that delay content visibility
- Parallax scrolling effects

### Spacing anti-patterns
- Arbitrary values: `0.35rem`, `0.7rem`, `1.1rem`, `2.5rem`
- Different padding values on similar sections without a system reason
- Container padding less than 24px on mobile

### Unnecessary JavaScript
- `"use client"` for components that only display data
- Event handlers on Server Components (use small client wrappers)
- `onClick` + `router.push()` for navigation (use `<Link>` instead)
- Client-side data fetching when Server Components can fetch directly

### Typography errors
- Font weight 900 outside of the logo
- `text-transform: uppercase` on headings
- Positive letter-spacing on display/heading type
- Line heights above 1.2 on headings
- Type smaller than 12px anywhere

---

## Quick Reference Checklist

Before marking any UI task done:

- [ ] Colors use only `brand-*` tokens — no arbitrary hex
- [ ] Gold (`brand-accent`) used at most once per view
- [ ] All spacing on the 8pt grid
- [ ] Touch targets ≥ 44×44px
- [ ] Images use `next/image` with `sizes`
- [ ] No `"use client"` added without a clear reason
- [ ] Tested at 375px mobile width
- [ ] Build passes: `npm run build`
- [ ] No card info panels below poster images
- [ ] No gold CTA button in the nav
