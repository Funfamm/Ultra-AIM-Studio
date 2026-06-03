# AIM Studio — Admin Dashboard ("Studio Command Center") Blueprint

> **For Claude Code:** This is the source blueprint for the AIM Studio admin area. It documents the full intended design and architecture. Read all operational sections (1–4) before making any admin UI change. Do not build modules marked FUTURE without explicit approval.

---

## SOURCE MATERIAL — AIM Studio Admin Dashboard Blueprint

*The following is the full blueprint as provided. Operational rules follow in Sections 1–4 below.*

---

### 1. Global Admin Layout & Architecture

The Admin area uses a global shell consisting of a resizable sidebar on the left and a main content area on the right.

#### Admin Sidebar Component
- **Behavior:**
  - Resizable on desktop (drag handle on the right edge). Defaults to `260px` width, with a minimum of `180px` and a maximum of `380px`. The width is saved in `localStorage`.
  - On mobile (`<= 768px`), it becomes a slide-out drawer with a hamburger menu on the left and a blurred dark backdrop (`rgba(0,0,0,0.52)` with `blur(2px)`).
- **Design Tokens:**
  - **Logo:** Features the site logo, but with an "Admin Panel" subtitle styled in `0.7rem` tertiary text color.
  - **Active State:** When a navigation item is active, it gets a distinct highlight to signify the current page.
- **Navigation Items (The 21 Modules):**
  1. 📊 Analytics
  2. 🔍 Visitor Intel
  3. 🎬 Projects
  4. 🎞️ Movie Rolls
  5. 🎭 Casting
  6. 📡 Live Events
  7. 📋 Applications
  8. ✍️ Scripts
  9. 🎓 Training
  10. 🖼️ Media
  11. 🤝 Sponsors
  12. 💰 Donations
  13. 💬 Comments
  14. 📋 Project Requests
  15. 👥 Users
  16. 🛡️ Audit Log
  17. 📬 Subscribers
  18. 🔔 Notify Me CTAs
  19. 📡 Outreach
  20. 📧 Email Analytics
  21. ⚙️ Settings
  - *(Followed by a `← Back to Site` link separated by a subtle top border).*

---

### 2. Core Dashboard: "Studio Command Center"

The main entry point (`/admin/analytics`) is branded as the **"Studio Command Center."**

#### A. The Cinematic Header
**Layout:** A large, prominent header block at the top of the page.
- **Background:** A complex gradient: `linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(139,92,246,0.04) 50%, rgba(59,130,246,0.03) 100%)`.
- **Borders & Styling:** `16px` border-radius (`var(--radius-xl)`), with a `1px` subtle gold border.
- **Decorations:**
  - A decorative "film strip" line at the very top: a thin `3px` horizontal line that fades from transparent to gold to purple to gold to transparent.
  - An animated "orb" floating in the top right corner (`160px` wide, radial gold gradient, `blur`, 8-second floating animation).
- **Typography:**
  - **Greeting:** Dynamic based on time of day (e.g., "🌙 Late Night", "🌤️ Good Afternoon") followed by ", Director". Styled in `0.68rem` gold text with `0.08em` letter spacing.
  - **Title:** "Studio Command Center". Uses an aggressive text gradient (`var(--text-primary)` to `var(--accent-gold)`) clipping to the text, bold `900` weight, `-0.02em` spacing.
  - **Subtitle:** "Real-time analytics · AI-powered insights · Live monitoring" in tertiary text color.

#### B. Live Status Indicators
Located inside the Cinematic Header on the right side.
- **Clock:** A pill-shaped badge displaying the current local time.
- **Live Users Button:** A dynamic button showing logged-in users and anonymous guests.
  - **Active State:** If users are online, the button glows green (`rgba(34,197,94,0.08)`) with a pulsing green dot (`animation: livePulse 2s`).
  - **Inactive State:** Grey/subtle if no users are online.
- **Live Users Popover:** Clicking the live users button opens a highly detailed, absolute-positioned popover dropdown:
  - Features a summary row showing metrics for "logged in", "guests", and "total".
  - A scrollable list of active users, displaying their avatar (a circle with their initial on a gold gradient), name, and a pulsing green dot next to their name.

#### C. The Tab Bar
Directly below the header is a segmented control tab bar used to switch between analytics views.
- **Design:** Encased in a `var(--bg-secondary)` container with padding.
- **Active Tab:** The selected tab gets a background of `var(--bg-card)`, gold text color, and a subtle drop shadow (`boxShadow: 0 1px 3px rgba(0,0,0,0.2)`).
- **Tabs Available:**
  - 📊 Overview
  - 📈 Traffic
  - 🎬 Content
  - 🤖 AI Insights
  - 🖥️ System

---

### 3. Tab Breakdown & Layouts

#### Tab 1: Overview
**The Command Strip:** A grid (`repeat(auto-fit, minmax(140px, 1fr))`) of key metrics.
- **Cards:** Glassmorphism cards with a subtle radial gradient glowing from the top right corner. The numbers use the `AnimatedCounter` hook to count up from zero on load.
- **Metrics Displayed:**
  - 🎬 Projects
  - 🎭 Open Castings
  - 📋 Applications
  - ⌛ Pending Review (Colors red if > 0, green if 0)
  - ✍️ Script Submissions (Shows a dynamic "New" badge in the corner if there are pending reviews).
- **Quick Actions:** A row of primary buttons below the Command Strip:
  - `+ New Project` (Solid gold button)
  - `📋 Review Applications` (Red tinted if there are pending applications, otherwise subtle grey).
  - `✍️ Review Scripts` (Orange tinted if there are pending scripts, otherwise subtle grey).

#### Tab 2: Traffic
*(Design implies the use of the imported chart components: `Sparkline`, `HourlyHeatmap`, `TrendArrow`)*.
- Displays web traffic trends, daily views, top pages, device breakdown, and referrer sources.

#### Tab 3: Content
*(Design implies the use of the imported chart components: `DonutChart`, `AreaChart`)*.
- Displays video/film performance: total film views, top films (with cover images/thumbnails), and trailer statistics.

#### Tab 4: AI Insights
A unique, conversational interface built directly into the dashboard.
- **Insights Feed:** Automatically generates textual insights colored by type:
  - 📈 Trend (Blue)
  - 💡 Recommendation (Emerald/Green)
  - ⚠️ Alert (Amber/Orange)
  - 🏆 Win (Bright Green)
- **Voice AI Conversation (`VoiceConversation` / `speakText`):**
  - Features a built-in text-to-speech engine using the browser's `SpeechSynthesis` API.
  - Can read out the insights aloud to the admin.
  - Includes a chat input where the admin can type follow-up questions about the data, which the system answers and speaks aloud.

#### Tab 5: System (Health & DevOps)
A raw technical view for monitoring platform health.
- **Metrics Displayed:** Database latency, external API statuses, memory heap usage (RSS, external, utilization), node version, region, and server uptime.

---

### 4. Mobile Responsiveness Tricks

The admin panel utilizes strict CSS media queries (`max-width: 768px`) to aggressively restructure the dashboard for mobile directors:
- **Header:** Flex rows stack vertically.
- **Command Strip:** Drops from a 5-column grid down to a strict 2-column grid.
- **Engagement/Stats Strips:** Converts from rigid grid columns into horizontal, swipeable scroll rows with hidden scrollbars (`-webkit-overflow-scrolling: touch; scrollbar-width: none`).
- **Application Rows:** Hides secondary metadata (like scores or dates) to fit complex tables onto mobile screens.
- **Tab Bar:** Reduces font sizes and padding to fit all 5 tabs on a narrow screen.

---

### 5. UI Animations & Feedback

- **Counters:** Numbers physically roll up to their targets (`easeOutCubic` curve) on load.
- **Card Cascades:** The Command Strip cards animate in one by one using a staggered delay (`animation: cardCascade 0.5s ease {idx * 80}ms`).
- **Live Pulse:** Active indicators scale and glow infinitely (`animation: notif-pulse` or `livePulse 2s ease-in-out infinite`).
- **Hover States:** Most cards and buttons use `transform: translateY(-3px)` alongside a glowing box-shadow to respond to user interaction.

---
---

## OPERATIONAL SECTIONS

*The following four sections govern how this blueprint is applied in AIM Studio Lite V1.*

---

## SECTION 1 — ACTIVE FOR AIM STUDIO LITE V1

Build and improve these admin areas now. These are cleared for immediate implementation.

### Admin Shell
- Premium sidebar with AIM Studio wordmark + "Admin Panel" subtitle
- Collapsible on mobile (slide-out drawer with backdrop)
- Active nav state: clear highlight on current route
- `← Back to Site` link at bottom of sidebar, separated by a border
- Consistent spacing, dark surface (`brand-dark` / `brand-surface`), gold accents used sparingly

### Active Modules

| Module | Path | Status |
|---|---|---|
| Overview / Command Center | `/admin` | Build now |
| Works / Projects | `/admin/works` | Exists — improve |
| Works detail / edit | `/admin/works/[id]` | Exists — improve |
| Series & Episodes | `/admin/works/[id]` | Extend existing |
| Users list | `/admin/users` | Exists — improve |
| Settings | `/admin/settings` | Build when needed |

### Overview / Command Center (V1 Scope)
Build a lightweight version of the Studio Command Center:
- Time-of-day greeting: "Good morning, Director." — no emoji required
- Key stat cards: Total Works, Published Works, Total Users, Registered this month
- Quick actions: `+ New Work`, `Manage Works`, `View Users`
- No live user polling, no animated counters, no chart libraries
- Static counts fetched server-side (Server Component, no client state)
- Premium, clean layout — use `brand-surface` cards, gold accent on stat numbers

### Works / Projects Management (V1 Scope)
- List all works with status, type, slug, featured flag
- Inline status badge (Published / Draft)
- Edit link to `/admin/works/[id]`
- Create new work button
- Series + episode management within the work edit form
- Poster URL, video URL, trailer URL fields
- `showOnHome`, `featured`, `order`, `requiresAuth` toggles

### Users List (V1 Scope)
- Table of all users: name, email, role, join date
- Role badge (Admin / User)
- No delete UI without explicit approval

### Admin Visual Direction
- Follow the cinematic header direction: gold-tinted gradient background on the command center header, subtle border, no heavy animation
- Sidebar: `brand-dark` background, `brand-border` dividers, active item gets `brand-surface` background + left gold border accent
- Stat cards: `brand-surface` background, `brand-border` border, gold for the number value, muted label below
- Buttons: follow `docs/DESIGN_SYSTEM.md` button specs — primary gold, ghost outlined
- Tab bar (if used): `brand-surface` container, active tab = `brand-black` bg + gold text
- Typography: Cormorant Garamond for headings, Manrope for all UI/body text

---

## SECTION 2 — FUTURE / DO NOT TOUCH YET

The following modules are documented here for future reference only. **Do not build them. Do not add their UI. Do not add their routes. Do not write their schema.** Ask for explicit approval before touching any of these.

| Module | Reason |
|---|---|
| Casting management | Requires casting schema, application flow |
| Applications review | Depends on casting system |
| Script submissions | Requires script schema, review workflow |
| Training / courses | Requires LMS schema, video progress tracking |
| Sponsors management | Not yet in scope |
| Donations / payments | Requires payment provider |
| Comments moderation | Requires comment schema, threading |
| Subscribers management | Requires email list system |
| Notify Me CTAs | Requires notification schema |
| Outreach management | Not yet in scope |
| Email Analytics | Requires email provider integration |
| Visitor Intel / live user tracking | Requires real-time infrastructure or analytics provider |
| Live Events management | Requires WebSocket/real-time infrastructure |
| Watch Party controls | Requires real-time infrastructure |
| AI Insights voice assistant | Requires LLM + SpeechSynthesis integration |
| Audit Log | Requires event logging schema |
| System / DevOps dashboard | Requires server metrics API |
| Advanced charts (Sparkline, HeatMap, DonutChart, AreaChart) | No chart library installed — do not add without approval |
| AnimatedCounter / card cascade animations | Requires JS animation — do not add without approval |
| Live user popover with polling | Requires real-time infrastructure |
| Project Requests queue | Not yet in scope |

### Copy — Reserved for Future Admin Modules
Do not place this copy in the platform until the module is ready to ship:
- All casting/application copy: "Open Castings", "Review Applications", pending badge counts
- Script submission copy: "Review Scripts", pending/shortlisted/rejected status
- Training copy: course management, progress tracking
- Live event copy: "Live Events", streaming controls
- AI Insights copy: "Real-time analytics · AI-powered insights · Live monitoring"
- Subscriber copy: email list management
- Audit log copy: event history, admin action log

---

## SECTION 3 — LITE PERFORMANCE RULES

These rules apply to every admin page and component in AIM Studio Lite. No exceptions.

- **No chart libraries.** No Recharts, Chart.js, Nivo, Victory, D3, or similar. Use CSS-only stat cards for V1. Ask before installing any chart library.
- **No voice/AI features.** The SpeechSynthesis API and AI Insights chat require real infrastructure and intentional design. Do not stub these in.
- **No live user polling.** No `setInterval`, no WebSocket connections, no SSE streams for live visitor data.
- **No heavy animations.** No staggered card cascade on load, no animated counters. `transform` and `opacity` transitions on hover only (150–200ms).
- **No new packages without approval.** Check if plain TypeScript + CSS solves it first.
- **Server Components for admin data.** Admin pages that only display data must be Server Components. Add `"use client"` only for forms, toggles, or interactive state.
- **Keep public pages unaffected.** Admin CSS and JS must not bleed into public-facing routes.
- **Lean DB queries.** Select only the fields needed for each admin view. Do not over-fetch.
- **Mobile-friendly admin.** The sidebar must collapse on mobile. Admin tables must be scrollable, not broken.

---

## SECTION 4 — IMPLEMENTATION RULES FOR AI DEVELOPER

Read this section before making any admin UI change.

1. **Use this blueprint as visual and architectural direction** — not a feature request list.
2. **Do not build future modules** just because they appear in this blueprint or the source material.
3. **"It's in the blueprint" is not approval to build it.** All future-section modules require explicit approval.
4. **Before any admin redesign**, propose a small phase plan and get approval. Do not cascade into multiple admin pages at once.
5. **Build one admin area at a time.** Finish and confirm before starting the next.
6. **Follow `docs/DESIGN_SYSTEM.md`** for all color tokens, spacing, typography, and button specs.
7. **Follow `docs/BRAND_COPY_GUIDE_V2.md`** for all copy decisions — even in admin, tone should feel like AIM Studio, not generic SaaS.
8. **Run `npm run build`** after every meaningful change. Do not report a task complete if the build fails.
9. **Test at 375px mobile** before marking any admin UI task done. The sidebar must work as a drawer.
10. **Never commit `.env`, `.env.local`**, or secrets files.
11. **Never run `db:push`, `db:migrate`, or `db:seed`** without explicit approval confirming the target database.
