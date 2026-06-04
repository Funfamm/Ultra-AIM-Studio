# Ultra AIM Studio — Setup Guide

## Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) account (free)
- A [Vercel](https://vercel.com) account (free)

---

## Local Development Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.local.example .env.local
```
Then edit `.env.local` and fill in your values:
- `DATABASE_URL` — from Neon (see step 3)
- `AUTH_SECRET` — run `openssl rand -base64 32` to generate
- `NEXT_PUBLIC_APP_URL` — leave as `http://localhost:3000` for dev

### 3. Create Neon database
1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project → name it `ultra-aim-studio`
3. Copy the **Connection String** (postgresql://...)
4. Paste it as `DATABASE_URL` in `.env.local`

### 4. Push the database schema
```bash
npm run db:push
```
This creates all tables in Neon without needing migrations.

### 5. Create the first admin user

Set your admin credentials in `.env` before running the seed:
```bash
SEED_ADMIN_EMAIL="admin@yourdomain.com"
SEED_ADMIN_PASSWORD="your-strong-password-here"
```

Do not commit `.env`. Do not use a weak or default password.

Then run:
```bash
npx ts-node prisma/seed.ts
```

The seed will exit with an error if `SEED_ADMIN_PASSWORD` is not set.

**Change the password after first login.**

Alternatively, after `db:push` run:
```bash
npm run db:studio
```
And manually set a user's `role` to `ADMIN` in Prisma Studio.

### 6. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "feat: Ultra AIM Studio Phase 1 foundation"
git remote add origin https://github.com/Funfamm/Ultra-AIM-Studio.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variables:
   - `DATABASE_URL` (from Neon)
   - `AUTH_SECRET` (same value as local)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. `https://ultra-aim-studio.vercel.app`)
4. Deploy

---

## Phase 1 Checklist

- [x] Next.js 15 App Router + TypeScript
- [x] Tailwind CSS v4 with design tokens
- [x] Prisma schema (User, Work, WatchProgress + Auth.js models)
- [x] Auth.js v5 with credentials provider + JWT strategy
- [x] Middleware — admin/user/auth route protection
- [x] Server Actions — register, login, logout, work CRUD, watch progress
- [x] CLAUDE.md project rules
- [x] Ultra AIM Studio rebrand complete
- [ ] Connect Neon database
- [ ] Create first admin user
- [ ] Deploy to Vercel

---

## Next: Phase 2
Public design upgrade — hero, works page, typography, animation polish.
