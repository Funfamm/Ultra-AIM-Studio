# AIM Studio Lite — Setup Guide

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
2. Create a new project → name it `aim-studio-lite`
3. Copy the **Connection String** (postgresql://...)
4. Paste it as `DATABASE_URL` in `.env.local`

### 4. Push the database schema
```bash
npm run db:push
```
This creates all tables in Neon without needing migrations.

### 5. Create the first admin user
```bash
npx ts-node prisma/seed.ts
```
Default credentials:
- Email: `admin@aimstudio.com`
- Password: `changeme123`

**Change the password after first login!**

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
git commit -m "feat: Phase 1 foundation"
git remote add origin https://github.com/YOUR_USERNAME/aim-studio-lite.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variables:
   - `DATABASE_URL` (from Neon)
   - `AUTH_SECRET` (same value as local)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. `https://aim-studio.vercel.app`)
4. Deploy

---

## Phase 1 Checklist

- [x] Next.js 15 App Router + TypeScript
- [x] Tailwind CSS v4 with design tokens
- [x] Prisma schema (User, Film, WatchProgress + Auth.js models)
- [x] Auth.js v5 with credentials provider + JWT strategy
- [x] Middleware — admin/user/auth route protection
- [x] Server Actions — register, login, logout, film CRUD, watch progress
- [x] CLAUDE.md project rules
- [ ] Connect Neon database
- [ ] Run db:push
- [ ] Create first admin user
- [ ] Deploy to Vercel

---

## Next: Phase 2
Public pages — Home, Works/Films grid, Film Details, Trailer Watch page.
