# Migration Plan

This document outlines the strategy for migrating from the Old AIM Studio (`aim-platform`) to the new Ultra AIM Studio (`ultra-aim-studio`).

## 1. Schema Migration
- Map `Project` to `Work`
- Map `Episode` to self-referential `Work` episodes
- Map `WatchHistory` to `WatchProgress`

## 2. Environment Variables & Secrets
- Recreate necessary environment variables in the new project.
- Do NOT directly copy legacy `.env` files to avoid bringing over deprecated services.

## 3. Storage Migration
- Re-link R2 / S3 buckets.
- Ensure image and video paths align with the new schema (e.g. `heroDesktopUrl`, `posterUrl`).

## 4. Auth Transition
- Old platform uses custom token-based auth with NextAuth hooks.
- New platform uses `Auth.js` adapter.
- Passwords and Google provider accounts must map cleanly.
