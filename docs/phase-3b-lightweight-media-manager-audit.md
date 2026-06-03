# Phase 3B — Lightweight Media Manager Audit

**Date:** 2026-06-03
**Branch:** ultra-rebrand-phase-1
**Status:** Audit only — no code written, no database commands run

---

## 1. Current Ultra AIM Studio — Media/Background Architecture

Ultra AIM Studio does **not** have a central media management system. All media is stored as URL string fields directly on the `Work` model in Prisma, entered manually per work item.

### How backgrounds/heroes are loaded per page

**Homepage (`app/(public)/page.tsx`)**
- Queries `Work` records that have `heroDesktopUrl` and `heroMobileUrl` set
- Passes them into two separate hero components:
  - `MobileFeaturedHero` — activates at viewport <768px
  - `HeroDesktopSection` → `HeroRotator` — activates at viewport ≥768px
- `HeroRotator` uses a native `<picture>` element with `media` breakpoints for art direction
- Lazy loading: first slide uses `loading="eager"`, subsequent slides use `loading="lazy"`
- Next.js `<Image>` with `quality={85}` and `priority` for the first hero

**Works page (`app/(public)/works/page.tsx`)**
- Fetches `posterUrl`, `heroMobileUrl`, `heroDesktopUrl` for each work
- Passes to `WorksClient` component for card-level display
- No page-level cinematic hero background system exists yet

**About page (`app/(public)/about/page.tsx`)**
- Hardcoded static image: `/images/about-cinematic.jpg` (line 34)
- No dynamic background loading whatsoever

**Watch page (`app/(public)/watch/[slug]/page.tsx`)**
- Uses `videoUrl`, `trailerUrl` from the Work model for the player
- Uses `posterUrl` as the video player poster
- No page-level cinematic background behind the player

---

## 2. Existing Schema Fields/Models Relevant to Media

**Work model** (schema.prisma ~lines 250–318) contains:

| Field | Type | Purpose |
|---|---|---|
| `posterUrl` | String? | Universal card fallback poster |
| `heroMobileUrl` | String? | 9:16 portrait mobile hero |
| `heroDesktopUrl` | String? | 16:9 landscape desktop hero |
| `thumbnailUrl` | String? | Episode row thumbnail |
| `trailerUrl` | String? | Trailer video |
| `videoUrl` | String? | Main video (film, episode, etc.) |
| `teaserUrl` | String? | Optional second video (commercials) |
| `galleryUrls` | String[] | Portfolio/case study gallery URLs |

These fields are **per-work** and are appropriate for work-level media. They are not suitable for managing site-wide page backgrounds or hero assets.

---

## 3. Whether a Media/PageMedia Model Already Exists

**No.** There is no `PageMedia`, `Media`, `Asset`, `HeroAsset`, or any similar model in the current schema. The schema has 30+ models but none dedicated to site-wide page media management.

---

## 4. Whether Schema Change Is Required

**Yes — a schema change is required.**

A new `PageMedia` model must be added to support site-wide background and hero management. The Work model itself does not need to change; its per-work URL fields remain as-is.

**Proposed `PageMedia` model:**

```prisma
model PageMedia {
  id        String   @id @default(cuid())
  page      String              // "home" | "works" | "about" | "watch" | comma-separated for multi-page
  type      String   @default("background")  // background | image | video | hero | hero-image | hero-video
  url       String              // Direct media URL (R2 CDN or external CDN)
  title     String   @default("")
  sortOrder Int      @default(0)
  duration  Int      @default(10)            // seconds for video display
  active    Boolean  @default(true)
  target    String   @default("all")         // "all" | "desktop" | "mobile"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([page, type])
  @@index([active])
}
```

This is the same model structure proven in aim-platform, stripped to essential fields only.

---

## 5. Existing Admin Routes That Can Host Media Manager

Current admin structure (all under `app/admin/`):

| Route | Purpose |
|---|---|
| `admin/` | Dashboard |
| `admin/works/` | Work list + work form |
| `admin/works/[id]/` | Individual work detail |
| `admin/analytics/` | Analytics |
| `admin/security/` | Security, users, roles, alerts, devices |
| `admin/email/` | Email templates, queue, logs |
| `admin/settings/` | Global settings |
| `admin/users/` | User management |
| `admin/audit/` | Admin audit logs |
| `admin/notify-me-ctas/` | Notify Me CTAs |
| `admin/notifications/` | Announcements |
| `admin/outreach/` | Outreach campaigns |
| `admin/comments/` | Comment moderation |
| `admin/engagement/` | Engagement analytics |
| `admin/data/` | Data retention |

**New route to create:** `admin/media/` — fits naturally alongside `admin/works/` and `admin/settings/`.

No existing routes conflict. The admin sidebar (from Phase 3A polish) will need one new nav item added.

---

## 6. Existing Upload/Storage System

**None exists in Ultra AIM Studio.**

- No upload library in `package.json` (no uploadthing, multer, cloudinary, S3 SDK)
- No `/api/admin/upload` route
- No file upload UI anywhere in admin
- No environment variables for storage (`.env.local.example` contains only `DATABASE_URL`, auth credentials, and Azure email keys)

**Current pattern:** Admins manually type or paste externally-hosted URLs into Work form fields. There is no in-app upload flow.

**Implication for Phase 3B:** The Media Manager can be built in two stages:
- **Stage 1 (MVP):** URL-only entry — admins paste URLs from external CDN or direct links. No upload system needed. Fully functional for initial deployment.
- **Stage 2 (Later):** Add R2/S3 file upload via `/api/admin/upload` once storage infrastructure is in place.

---

## 7. Old AIM Studio Media Manager — Features Found

aim-platform had a full `PageMedia` system with:

**Schema (`prisma/schema.prisma` ~lines 845–860):**
- Same 10-field model as proposed above

**Admin UI (`app/admin/media/page.tsx` — 722 lines):**
- Unified manager for all media types (background, image, video, hero, hero-image, hero-video, gallery)
- Drag-and-drop file upload to `/api/admin/upload`
- Multi-page assignment via comma-separated page field with toggle pills
- Device targeting (All / Desktop / Mobile)
- Sort order, title/label, duration input (video-only)
- Active/inactive toggle
- 4G safety warnings (detects desktop video missing mobile image fallback)
- Per-type filter pills and per-page filter pills
- Video hover-preview in table
- Thumbnail preview in table
- Visibility toggle, edit, delete with confirmation

**API Routes:**
- `/api/admin/media` — GET/POST/PUT/DELETE with 5-min cache / 1-hr SWR for public reads
- `/api/page-media` — Public-safe GET filtered by page, excludes admin-internal types
- `/api/admin/upload` — Multipart upload to Cloudflare R2 with:
  - Extension allowlist
  - MIME type validation
  - Magic byte validation (security)
  - Size limits (10MB images, 500MB video, 50MB docs)
  - Upload audit logging
  - Unique filename generation (timestamp + UUID + sanitized name)

---

## 8. Old Features to Rebuild

These patterns from aim-platform are clean and worth rebuilding:

1. **PageMedia schema** — exactly right, proven in production
2. **Comma-separated page assignment** — simple, avoids join table complexity
3. **Device targeting** (`all` | `desktop` | `mobile`) — critical for mobile-first strategy
4. **Sort order** — lets admin control hero rotation ordering
5. **Active/inactive toggle** — lets admin stage assets without deleting
6. **4G safety detection** — warn when desktop video lacks mobile image fallback (prevent bad mobile UX)
7. **Separate public API endpoint** (`/api/page-media`) — decouples public reads from admin operations
8. **5-min fresh / 1-hr SWR caching** on public endpoint — prevents database hammering
9. **Poster/fallback image** for every video entry — enforced at UI level

---

## 9. Old Features to Skip

These aim-platform features should not be rebuilt in Phase 3B:

1. **File upload to R2** — Ultra has no upload infrastructure yet; skip until Stage 2
2. **Drag-and-drop upload UI** — requires upload API; defer to Stage 2
3. **Document upload support** (PDFs, DOCs, etc.) — Ultra only needs images/videos
4. **Upload audit logging** (`logUploadEvent()`) — useful but not critical for MVP
5. **Gallery type media** — defer; Works page already handles gallery via `galleryUrls` on Work
6. **Root layout revalidation** (`revalidatePath('/', 'layout')`) — aim-platform rebuilt entire root layout on each media change; Ultra should use tag-based or targeted revalidation
7. **Duration field** — useful for auto-rotating slideshow; defer if hero rotation is Work-driven, not PageMedia-driven

---

## 10. Proposed Lightweight PageMedia Schema

```prisma
model PageMedia {
  id        String   @id @default(cuid())
  page      String              // "home" | "works" | "about" | "watch" | comma-separated
  type      String   @default("background")  // background | hero-image | hero-video
  url       String              // Hosted image/video URL
  posterUrl String   @default("")  // Required fallback image for video type
  title     String   @default("")  // Admin label only
  sortOrder Int      @default(0)
  active    Boolean  @default(true)
  target    String   @default("all")  // "all" | "desktop" | "mobile"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([page, type])
  @@index([active])
}
```

Changes vs aim-platform:
- Added `posterUrl` as a first-class field (enforces fallback culture in the schema)
- Removed `duration` (defer to later)
- Kept everything else identical

---

## 11. Proposed Admin UI Route and Layout

**Route:** `/admin/media`

**Layout:**

```
/admin/media
├── Header: "Media Manager" + "Add Media" button
├── Filter bar: [All Pages] [Home] [Works] [About] [Watch] | [All Types] [Image] [Video]
├── 4G Safety warnings panel (if any video entries lack mobile fallback)
└── Media table:
    ├── Thumbnail (image preview or video poster)
    ├── Title (admin label)
    ├── Pages (pills)
    ├── Type badge
    ├── Target (Desktop / Mobile / All icon)
    ├── Sort order
    ├── Active toggle
    └── Actions: Edit | Delete
```

**Add/Edit form (slide-over or inline):**
```
Title (admin label)
Page assignment (toggle pills: Home, Works, About, Watch, ...)
Type (image | video)
Device target (All | Desktop | Mobile)
Image URL (text input + preview)
Video URL (text input, only if type = video)
Poster URL (text input, required if type = video)
Sort order (number)
Active toggle
4G safety warning (if video + target includes mobile)
```

---

## 12. Proposed Public Rendering Strategy

**API approach:**

1. Public page calls `/api/page-media?page=home` on the server at render time (Next.js server component — no client fetch needed).
2. API returns active PageMedia items sorted by `sortOrder`, filtered to active=true.
3. Page renders appropriate component based on `type` and `target`.

**Component behavior:**

- `type: "hero-image"` + `target: "desktop"` → render as `<picture>` desktop art direction
- `type: "hero-image"` + `target: "mobile"` → render as `<picture>` mobile art direction
- `type: "hero-image"` + `target: "all"` → render as responsive `<picture>` (scales to viewport)
- `type: "hero-video"` → render `<video>` with poster fallback; apply 4G safety logic
- `type: "background"` → apply as CSS background or absolute-positioned `<Image>`

**Priority order:** PageMedia backgrounds sit behind per-Work heroes. Work-level heroes (from `heroDesktopUrl`/`heroMobileUrl`) take precedence on pages that are work-specific (e.g., homepage hero rotator). PageMedia backgrounds fill the page canvas for non-work pages (About, Watch).

---

## 13. Mobile/5G Safety Strategy

These rules must be enforced in the rendering components:

```
1. Mobile image-first:
   - Never auto-load a video on mobile unless explicitly checking connection strength.

2. Connection check before video:
   - navigator.connection.effectiveType must be "4g" or better
   - navigator.connection.saveData must be false
   - Video URL must exist
   - Poster image URL must exist (fallback ready)

3. If any condition fails:
   - Show poster image only
   - Do not load video source at all (do not even set <video src>)

4. Poster always renders first:
   - Set poster attribute on <video> before src
   - This keeps layout stable while connection is assessed

5. Device target enforcement:
   - target="desktop" → only render for viewport ≥768px
   - target="mobile" → only render for viewport <768px
   - target="all" → render for both, use responsive sizing

6. No heavy animation on mobile:
   - Respect prefers-reduced-motion: reduce
   - No parallax, WebGL, or 3D backgrounds

7. Lazy loading:
   - Only eager-load the first/active background item
   - All others: lazy or deferred

8. Admin 4G warning:
   - Media Manager UI warns when a video entry lacks a mobile-target image counterpart
   - This is a soft warning only; admin can override
```

---

## 14. Files Likely to Touch If Approved

**New files:**
- `prisma/schema.prisma` — add `PageMedia` model (10 lines)
- `app/admin/media/page.tsx` — Media Manager admin UI (~350 lines)
- `app/api/admin/media/route.ts` — CRUD API (~130 lines)
- `app/api/page-media/route.ts` — Public read API (~30 lines)
- `components/page-media-background.tsx` — Background renderer component (~80 lines)
- `components/page-media-hero.tsx` — Hero renderer component (~80 lines)

**Modified files:**
- `app/(public)/page.tsx` — Integrate PageMedia backgrounds (add ~10 lines)
- `app/(public)/works/page.tsx` — Integrate PageMedia hero background (~10 lines)
- `app/(public)/about/page.tsx` — Replace hardcoded `/images/about-cinematic.jpg` (~10 lines)
- `app/(public)/watch/[slug]/page.tsx` — Optional PageMedia background (~10 lines)
- Admin sidebar/nav component — Add "Media" nav item (~5 lines)
- `app/admin/media/media-manager.css` — Scoped styles for new admin page (~80 lines)

**Not touched:**
- Work model — unchanged
- All existing CSS files polished in Phase 3A — unchanged
- Episode/series/player logic — unchanged
- User/notify/comments/email — unchanged
- Any database beyond one new migration

---

## 15. Risk Level

**Overall risk: Low**

| Area | Risk | Reason |
|---|---|---|
| Schema migration | Low | Single model add, no existing tables affected |
| Public pages | Low | PageMedia is additive; existing Work hero system continues working |
| Admin | Low | New route, no changes to existing admin pages |
| Performance | Low | Server-side fetch, cached, image-first by default |
| Rollback | Easy | PageMedia table can be dropped cleanly; public pages revert to static fallback |

**Only risk:** Schema migration must be run carefully (`prisma migrate dev` or `prisma db push` on dev first, then production separately). This is the one step that requires confirmation before execution.

---

## 16. Recommended Phase 3B Implementation Plan

### Stage 1 — URL-Based Media Manager (MVP, safe, no upload infrastructure needed)

**Step 1: Schema**
- Add `PageMedia` model to `prisma/schema.prisma`
- Run `prisma migrate dev` locally (dev only — never run migrate on production without review)
- Do NOT run `prisma db push` on production

**Step 2: API routes**
- Create `/api/admin/media/route.ts` — CRUD (GET/POST/PUT/DELETE)
- Create `/api/page-media/route.ts` — Public read, cached

**Step 3: Admin UI**
- Create `app/admin/media/page.tsx` — URL-based Media Manager
- Add "Media" item to admin sidebar nav
- Add scoped CSS

**Step 4: Public integration**
- Create `components/page-media-background.tsx`
- Integrate into About page (replace hardcoded image)
- Integrate into Works page (add page-level hero background)
- Integrate into Watch page (optional ambient background)
- Homepage: PageMedia used as fallback if no Work heroes exist (Work heroes remain primary)

**Step 5: Mobile safety**
- Add 4G/Save-Data connection check in `page-media-background.tsx`
- Enforce poster-first rendering for video types
- Add device target rendering logic

### Stage 2 — File Upload (Future, requires storage setup)

- Add Cloudflare R2 or compatible S3 storage
- Create `/api/admin/upload/route.ts`
- Add drag-and-drop upload UI to Media Manager
- This stage does not block Stage 1 shipping

---

## Phase 3B Approval Checklist

Before any coding begins, confirm:

- [ ] Schema change approved: add `PageMedia` model
- [ ] Migration strategy approved: dev-only first, production separately
- [ ] MVP scope confirmed: URL-based entry only (no upload in Phase 3B)
- [ ] Public pages to integrate confirmed: About (replace hardcoded), Works (add hero bg), Watch (optional)
- [ ] Homepage strategy confirmed: PageMedia as fallback, Work heroes remain primary
- [ ] Admin sidebar update approved
- [ ] Stage 2 (file upload) deferred to future phase confirmed

---

*Audit completed 2026-06-03. No code was written. No database commands were run. Awaiting approval to proceed with implementation.*
