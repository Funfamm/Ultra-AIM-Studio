// Auth.js v5 catch-all route handler
// Handles: GET/POST /api/auth/*  (signin, signout, session, csrf, etc.)

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
