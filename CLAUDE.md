# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Push Prisma schema to DB (no migration history)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Run migrations (dev only)
npm run db:studio    # Open Prisma Studio UI
npm run db:seed      # Create first admin user (tsx prisma/seed.ts)
```

Environment variables required (copy `.env.local.example`):
- `DATABASE_URL` — Neon PostgreSQL connection string
- `AUTH_SECRET` — 32-byte JWT secret (`openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL` — App base URL

Prisma CLI reads `DATABASE_URL` from `.env`. Next.js reads all vars from `.env.local`.

There is no test framework configured.

---

## Architecture

**Next.js 15 App Router** full-stack app — a cinematic video streaming platform with admin film management and user authentication.

### Route groups

```
app/
  (auth)/         login, register — redirects if already logged in
  (public)/       public-facing pages (home, works, watch, about, contact)
  admin/          ADMIN role required (enforced in middleware + page-level guard)
  dashboard/      authenticated user area
  api/auth/       Auth.js route handler only
```

Middleware (`middleware.ts`) guards routes at the edge:
- `/admin/*` → requires `role === "ADMIN"`
- `/dashboard/*` → requires any valid session
- `/login`, `/register` → redirect to `/dashboard` if already signed in

### Data layer

All mutations go through **Server Actions** in `/lib/actions/` — no custom API routes:
- `auth.ts` — register (bcrypt hash + Prisma create), login (signIn), logout
- `films.ts` — CRUD for Film model; every mutating action calls `requireAdmin()` first
- `progress.ts` — save/retrieve WatchProgress per user+film

Prisma client is a singleton in `/lib/prisma.ts` (needed for Next.js dev hot-reload).

### Auth

Auth.js v5 with a credentials provider and JWT strategy (required for credentials). Session is extended with `id` and `role` via callbacks in `/lib/auth.ts`. Role is sourced from the DB on every JWT creation but not re-fetched on refresh — update the token if the role changes at the DB level.

### Design tokens

All colors and fonts are CSS custom properties in `app/globals.css` under `@theme`. Use Tailwind's `brand-*` scale (e.g., `bg-brand-dark`, `text-brand-accent`) — never arbitrary hex values.

```css
brand-black   #0a0a0a   page background
brand-dark    #111111   card background
brand-surface #1a1a1a   elevated surfaces
brand-border  #2a2a2a   borders
brand-muted   #6b7280   secondary text
brand-light   #e5e7eb   body text
brand-white   #f9fafb   headings
brand-accent  #e8c97e   gold — CTAs, highlights
brand-red     #c0392b   errors
font-display  "Cormorant Garamond", Georgia, serif   — headings, logo, hero, blockquotes
font-body     "Manrope", system-ui, sans-serif       — nav, buttons, body, labels, admin UI
```

Fonts are loaded via `next/font/google` in `app/layout.tsx` (weights: Cormorant 300/600/700, Manrope 400/500/600/700). CSS variables `--font-cormorant` and `--font-manrope` are injected on `<html>` and aliased to `--font-display` and `--font-body` in `globals.css @theme`.

---

## Core rules

1. **Only install a package when necessary for the current feature.** Check if plain TypeScript suffices first. Never install speculatively.
2. **Mobile-first always.** Write mobile styles first, then `md:` and `lg:` breakpoints.
3. **Prefer React Server Components.** Add `"use client"` only for browser APIs, event handlers, or hooks.
4. **Prefer Server Actions over API routes** for form submissions and mutations.
5. **Always use Prisma** for DB access. Never raw SQL except in migration files.
6. **Hash passwords with bcryptjs** (12 rounds). Never store plain text.
7. **Always call `requireAdmin()`** at the top of any admin Server Action.
8. **UI components** — shadcn/ui copy-paste only; never run `npx shadcn add`. No inline styles; use Tailwind utilities. Split files that exceed ~150 lines.
9. **Always follow `docs/DESIGN_SYSTEM.md` for all UI work.** Before making any visual change, check the design system for the correct color, spacing, typography, button, and card rules.
10. **Do not make visual changes without checking the design system.** No arbitrary colors, no random spacing, no gold overuse, no card info panels below posters.
11. **Keep all UI work premium, cinematic, mobile-first, and 4G-friendly.** The standard is Netflix-level browsing, Apple-level spacing, A24-level restraint. If a change looks template-generic, it does not meet the standard.
12. **Always follow `docs/BRAND_COPY_GUIDE_V2.md` for all public-facing copy.** This supersedes `docs/BRAND_COPY_GUIDE.md`. Use exact words from the guide — do not paraphrase or invent new copy. Never use buzzwords (revolutionize, disrupt, leverage, synergize, AI-powered, AI-driven). Section 3 (Future) must not be built yet; Section 1 is cleared for V1.
13. **Always follow `docs/ADMIN_DASHBOARD_BLUEPRINT.md` for all admin UI work.** Before any admin redesign or new admin module, read Sections 1–4. Do not build modules listed in Section 2 (Future). Propose a phase plan before touching multiple admin areas at once.

---

## Stack

| Layer      | Choice                                       |
|------------|----------------------------------------------|
| Framework  | Next.js 15 App Router                        |
| Language   | TypeScript strict mode                       |
| Styling    | Tailwind CSS v4 — CSS-first `@theme` tokens  |
| UI         | shadcn/ui copy-paste (no CLI install)        |
| Database   | Neon serverless Postgres                     |
| ORM        | Prisma                                       |
| Auth       | Auth.js v5 — credentials provider + JWT      |
| Video      | Native `<video>` / `<iframe>` — no video lib |
| Icons      | lucide-react                                 |
| Deployment | Vercel                                       |

---

## Token and Context Management

- **Concise by default.** Keep responses short unless deep detail is explicitly requested.
- **No repeat reads.** Do not re-read a file that hasn't changed since the last read in this session.
- **No full-repo scans.** Use targeted `Grep` or `Glob` searches instead of reading every file.
- **One task at a time.** Finish and confirm before starting the next task.
- **One component or page at a time** for design changes. Do not cascade into adjacent files.
- **Summarize before editing.** State what you found and what you plan to change before making edits.
- **Ask before reading large folders.** If a task seems to require reading 5+ files, confirm with the user first.
- **Reference repos on demand only.** Do not load reference repos unless the user asks. When you do, read at most 2–3 files (prefer `README.md`, `CLAUDE.md`, or the single relevant component).
- **Never use reference repos as context dumps.** They are inspiration sources, not documentation to recite.
- **Refresh reference repos before major design/planning sessions** using the command below. Do not install packages from them, do not copy full systems blindly. After refreshing, inspect only the relevant files and summarize useful findings before applying any pattern.
- **Recommend `/compact` after major milestones** (completed page, completed feature, completed fix cycle).

See `.claude/commands/token-budget.md` for the pre-task checklist format.

### Reference repo refresh command

Run this in PowerShell before major UI/UX, workflow, or architecture sessions:

```powershell
cd "C:\Users\mxz\Desktop\ai-agent-repos"
Get-ChildItem -Directory | ForEach-Object {
  if (Test-Path "$($_.FullName)\.git") {
    git -C $_.FullName pull --ff-only
  }
}
```

Reference repos live at `C:\Users\mxz\Desktop\ai-agent-repos`. Use for inspiration only — never install packages from them into AIM Studio Lite.

---

## Out of scope for v1

Multilingual/i18n, watch party, payment/subscription, notifications, casting system, training hub, advanced analytics, RAG/memory system, AI automation.
