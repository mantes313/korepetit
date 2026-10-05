'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv, isSupabaseConfigured } from '../env';

/**
 * Browser-side Supabase client.
 *
 * Scope is deliberately narrow. After the API refactor the browser only uses
 * this client for two things:
 *   1. Auth (sign-in / sign-up / OAuth / sign-out) — the SDK owns the token
 *      lifecycle, and `@supabase/ssr` persists the session in cookies so the
 *      server can read it on every request.
 *   2. Realtime channels for the lesson room — WebRTC signalling and
 *      whiteboard sync are peer-to-peer and cannot be proxied through REST.
 *
 * All data reads and writes go through /api instead. Nothing in the app
 * should call `.from(...)` on this client.
 */
let client = null;

export function getBrowserSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return client;
}
