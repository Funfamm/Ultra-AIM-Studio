# Phase 5 — Deployment Readiness / Vercel Preview Setup Audit

**Date:** 2026-06-03
**Branch:** ultra-rebrand-phase-1
**Status:** Audit only — no code written, no database commands run

---

## Context

All prior phases are complete. The player is production-ready. Phase 4C (subtitles) is deferred. This document audits everything needed before running a safe Vercel preview deployment.

---

## 1. Current Deployment Readiness

| Area | Status | Notes |
|---|---|---|
| Build command | Ready | `prisma generate && next build` |
| Prisma schema | Ready | Single clean migration |
| Auth | Ready | JWT + Credentials + Google OAuth wired |
| Env example file | Gap | `.env.local.example` exists locally but is in `.gitignore` — not tracked in git |
| `DIRECT_URL` doc gap | Gap | `schema.prisma` uses `DIRECT_URL` but it is not documented in `.env.local.example` |
| Cron jobs | Caution | `vercel.json` has two crons — one runs every 5 min in production AND preview |
| Image config | Ready | `next.config.ts` allows any HTTPS hostname |

---

## 2. Required Environment Variables

### Mandatory for Build

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma schema introspection at build time | Pooled Neon URL |
| `DIRECT_URL` | Prisma direct connection (migrations, serverless) | Non-pooled Neon URL — **missing from `.env.local.example`** |
| `AUTH_SECRET` | Auth.js JWT signing | Generate: `openssl rand -base64 32` |

Build will fail if `DATABASE_URL` is absent (`prisma generate` runs first).

### Mandatory for Runtime

| Variable | Purpose | Hard Failure if Absent? |
|---|---|---|
| `DATABASE_URL` | All DB queries | Yes — 500 on any page |
| `DIRECT_URL` | Prisma serverless connection management | Yes — connection pool errors |
| `AUTH_SECRET` | JWT sign/verify | Yes — all auth broken |
| `AUTH_URL` | OAuth callback base URL | Yes — Google login broken |
| `NEXT_PUBLIC_APP_URL` | Email links, share URLs | No crash — links will be wrong |
| `AUTH_GOOGLE_ID` | Google OAuth login | No crash — Google login removed |
| `AUTH_GOOGLE_SECRET` | Google OAuth login | No crash — Google login removed |

### Optional (Graceful Degradation)

| Variable | Purpose | Behavior if Absent |
|---|---|---|
| `AZURE_CLIENT_ID` | Transactional email (security alerts, welcome) | Emails silently fail |
| `AZURE_CLIENT_SECRET` | Transactional email | Emails silently fail |
| `AZURE_TENANT_ID` | Transactional email | Emails silently fail |
| `GRAPH_EMAIL_SENDER` | Transactional email from-address | Emails silently fail |
| `ACS_CONNECTION_STRING` | Bulk email (campaigns, Notify Me) | Emails silently fail |
| `ACS_SENDER_ADDRESS` | Bulk email from-address | Emails silently fail |
| `SMTP_HOST/PORT/USER/PASS/FROM` | SMTP fallback | Emails silently fail |

### Dev/Migration Only — Do Not Set in Vercel

| Variable | Purpose |
|---|---|
| `SEED_ADMIN_EMAIL` | Seed script only — has default `admin@aimstudio.com` |
| `SEED_ADMIN_PASSWORD` | Seed script only — required at seed time, not runtime |
| `SOURCE_DATABASE_URL` | Old migration scripts only — never deploy this |

---

## 3. Identified Gaps to Fix Before Deploying

### Gap 1 — `DIRECT_URL` missing from `.env.local.example`

`prisma/schema.prisma` line 11:
```prisma
directUrl = env("DIRECT_URL")
```

This is not documented in `.env.local.example`. Neon provides two URLs:
- **Pooled URL** (`DATABASE_URL`) — for runtime queries via Neon connection pooler
- **Direct URL** (`DIRECT_URL`) — for migrations and Prisma's serverless connection management

Without `DIRECT_URL` in Vercel env vars, Prisma will produce connection errors in serverless functions.

**Fix needed:** Add `DIRECT_URL` to `.env.local.example` with a comment explaining it.

### Gap 2 — `.env.local.example` not tracked in git

`.gitignore` includes `.env.local.example` — the file is local only. New deployments or handoffs have no reference for required vars.

**Fix needed:** Remove `.env.local.example` from `.gitignore` and commit it. The file contains only placeholder values (no real secrets).

### Gap 3 — Cron jobs active in preview

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/morning-report", "schedule": "0 8 * * *" },
    { "path": "/api/cron/scheduled-outreach", "schedule": "*/5 * * * *" }
  ]
}
```

- `scheduled-outreach` fires every 5 minutes in **all** Vercel environments including preview.
- If Azure/ACS credentials are set in preview env vars, bulk emails may fire against real users.
- Cron routes are not protected by `CRON_SECRET` in the current code — they're publicly invocable.

**Fix needed before preview:** Either:
- (A) Add `CRON_SECRET` protection to both cron routes and set `CRON_SECRET` in Vercel, OR
- (B) Disable `scheduled-outreach` in preview by checking `VERCEL_ENV !== "production"` at the top of the route handler.

The safest choice for preview: do not set ACS/Azure/SMTP credentials in preview env vars. Cron fires but emails fail silently. Revisit before production.

---

## 4. Vercel Project Setup Plan

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → `Funfamm/Ultra-AIM-Studio`
2. Framework: **Next.js** (auto-detected)
3. Root directory: `/` (repo root, not a monorepo)
4. Build command: leave default (`npm run build`) — package.json already sets `prisma generate && next build`
5. Output directory: leave default (`.next`)
6. Install command: leave default (`npm install`)
7. Add all required env vars before first deploy (see Section 2)

---

## 5. Neon Database Setup Plan

**Do not use the local dev database for preview/production.**

Create a dedicated Neon database for Vercel:

1. Log into [neon.tech](https://neon.tech)
2. Create a new project: `ultra-aim-studio-preview` (or `ultra-aim-studio-production`)
3. Copy two connection strings from the Neon dashboard:
   - **Pooled connection** → paste as `DATABASE_URL` in Vercel
   - **Direct connection** (from "Connection pooling" → "Direct connection") → paste as `DIRECT_URL` in Vercel
4. Both URLs must point to the same Neon project/branch

**Local dev DB remains unchanged.** Never set Vercel's `DATABASE_URL` to the local dev database.

---

## 6. Prisma Migration Deploy Plan

Neon preview DB starts empty. The schema must be applied before the app can function.

**Do not use `prisma db push` on Vercel.** Use `prisma migrate deploy` — it replays the tracked migration history.

### Option A — Vercel build command (recommended)

Change `package.json` build command to:
```json
"build": "prisma migrate deploy && prisma generate && next build"
```

This runs `migrate deploy` on every Vercel build. It is safe — `migrate deploy` is idempotent (skips already-applied migrations). Requires `DIRECT_URL` to be set (migrations must use the direct connection).

### Option B — Manual one-time run

Run locally against the Vercel DB:
```bash
DATABASE_URL="<vercel-direct-url>" npx prisma migrate deploy
```

Then deploy normally. Requires switching `DATABASE_URL` temporarily — risky.

**Recommendation: Option A.** Let Vercel run migrations on every deploy. Safe, auditable, automatic.

---

## 7. Google OAuth Callback URL Plan

Auth.js v5 callback path: `/api/auth/callback/google`

Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID → Authorized redirect URIs:

| Environment | URL to add |
|---|---|
| Local dev | `http://localhost:3000/api/auth/callback/google` |
| Vercel preview | `https://<your-preview-url>.vercel.app/api/auth/callback/google` |
| Production | `https://yourdomain.com/api/auth/callback/google` |

**Also set `AUTH_URL` in Vercel env vars** to match the deployment URL:
- Preview: `https://<your-preview-url>.vercel.app`
- Production: `https://yourdomain.com`

Without `AUTH_URL` matching the exact deployment origin, Google OAuth redirects will fail with a redirect_uri_mismatch error.

**Note:** Vercel preview deployments get a new URL per-branch. For preview testing, use the branch's fixed alias URL (not the per-commit hash URL), then add only that URL to Google Console.

---

## 8. Admin Seed / First Login Plan

The seed script (`prisma/seed.ts`) creates the first admin user. It requires `SEED_ADMIN_PASSWORD` — exits with an error if not set.

**On Vercel, do not run the seed via Vercel build.** Run it once manually using the Vercel CLI or a local run pointed at the preview DB:

```bash
SEED_ADMIN_EMAIL="admin@yourdomain.com" SEED_ADMIN_PASSWORD="<strong-password>" DATABASE_URL="<vercel-direct-url>" npm run db:seed
```

The script is idempotent — if the admin already exists it exits cleanly without changes.

**Login URL:** `https://<preview-url>/login`

After first login, verify the admin can access `/admin` and `/admin/media`.

---

## 9. Build Command (Final)

Recommended `package.json` build script after Phase 5 fixes:

```json
"build": "prisma migrate deploy && prisma generate && next build"
```

- `prisma migrate deploy` — applies any pending migrations (idempotent, safe)
- `prisma generate` — regenerates Prisma client from schema
- `next build` — compiles the app

Vercel sets `DATABASE_URL` and `DIRECT_URL` from env vars — no `.env` file needed in CI.

---

## 10. Smoke Test Checklist

Run after first successful preview deployment:

### App loads
- [ ] `https://<preview-url>/` loads without error
- [ ] Homepage hero renders (cinematic text, gold accent, CTAs)
- [ ] No 500 or white-screen errors in browser console

### Public pages
- [ ] `/works` loads work grid
- [ ] `/about` loads About page with image
- [ ] `/watch/<any-published-slug>` loads player (if a published Work exists)
- [ ] `/login` loads login form

### Auth
- [ ] Credentials login works with seeded admin email/password
- [ ] Google login redirects correctly (if Google OAuth vars set)
- [ ] Dashboard `/dashboard` loads after login
- [ ] Unauthorized `/admin` access redirects to `/login`

### Admin
- [ ] `/admin` dashboard loads
- [ ] `/admin/works` lists works
- [ ] `/admin/media` loads Media Manager
- [ ] Can create a new Work draft and save
- [ ] Homepage PageMedia (home hero image) renders if set

### Database
- [ ] No Prisma connection errors in Vercel Function logs
- [ ] `prisma migrate deploy` ran cleanly (check Vercel build log)

### Security
- [ ] `.env` and `.env.local` are NOT in the GitHub repo
- [ ] No plaintext credentials visible in build logs

---

## 11. Risks and Blockers

| Risk | Severity | Mitigation |
|---|---|---|
| `DIRECT_URL` not set in Vercel | High — app breaks | Add to Vercel env vars; document in `.env.local.example` |
| `AUTH_URL` mismatch | High — Google OAuth broken | Set to exact preview URL; add callback to Google Console |
| `scheduled-outreach` cron fires emails in preview | Medium | Omit ACS/Azure vars from preview env or add `CRON_SECRET` guard |
| No admin user seeded | Medium — can't test admin | Run seed once against preview DB before smoke test |
| `.env.local.example` not in repo | Low — onboarding friction | Remove from `.gitignore`, commit it |
| `prisma db push` used instead of `migrate deploy` | High — destroys migration history | Always use `migrate deploy` in Vercel build |
| Google OAuth preview URL changes per-commit | Low — only affects Google login | Use branch alias URL for OAuth testing |

---

## 12. Recommended Deployment Sequence

### Pre-deployment (one-time setup)

**Step 1 — Fix `.env.local.example`:**
- Add `DIRECT_URL` entry
- Remove `.env.local.example` from `.gitignore`
- Commit the file

**Step 2 — Update build script:**
- Change `"build"` in `package.json` to `"prisma migrate deploy && prisma generate && next build"`
- Commit

**Step 3 — Create Neon preview DB:**
- New Neon project for Vercel (separate from local dev)
- Copy pooled URL → `DATABASE_URL`
- Copy direct URL → `DIRECT_URL`

**Step 4 — Create Vercel project:**
- Import `Funfamm/Ultra-AIM-Studio` from GitHub
- Set all mandatory env vars (Section 2)
- Set `AUTH_URL` to the preview branch alias URL

**Step 5 — Google Console:**
- Add `https://<preview-alias>.vercel.app/api/auth/callback/google` to authorized URIs

### First deploy

**Step 6 — Deploy to Vercel:**
- Push branch or trigger Vercel deploy
- Watch build log — confirm `migrate deploy` ran cleanly
- Confirm build passes

**Step 7 — Seed admin:**
- Run `db:seed` once locally, pointed at the Vercel direct DB URL

**Step 8 — Smoke test:**
- Run through checklist in Section 10

### Ready for review / PR

**Step 9 — Share preview URL on PR #1:**
- Post the Vercel preview URL in the PR description
- Confirm all smoke tests pass

---

## Summary

| # | Item | Answer |
|---|---|---|
| 1 | Deployment readiness | Near-ready — 3 gaps to fix |
| 2 | Required env vars identified | Yes — 7 mandatory, rest optional |
| 3 | Critical gap | `DIRECT_URL` missing from `.env.local.example` and undocumented |
| 4 | Cron job risk | `scheduled-outreach` fires every 5 min — omit email creds from preview |
| 5 | Build command change | Add `prisma migrate deploy` before `prisma generate && next build` |
| 6 | Migration strategy | `prisma migrate deploy` in Vercel build command — idempotent and safe |
| 7 | Google OAuth | Add preview alias URL to Google Console; set `AUTH_URL` in Vercel |
| 8 | Admin seed | Run once manually against Vercel DB via `DIRECT_URL` |
| 9 | Smoke test | 15-point checklist above |
| 10 | Overall risk | Low — gaps are documentation and config, not code |

---

*Audit completed 2026-06-03. No code was written. No database commands were run. Awaiting decision on which gaps to fix before deploying.*
