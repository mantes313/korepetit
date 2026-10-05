/**
 * Centralised environment access.
 *
 * Two audiences:
 *  - `publicEnv` is safe for the browser bundle (NEXT_PUBLIC_* only).
 *  - `serverEnv` must only ever be imported from server code. Importing it
 *    into a client component will throw at module-eval time rather than
 *    silently shipping a secret to the browser.
 */

function read(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const publicEnv = {
  supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: read('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
};

export const isSupabaseConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabaseAnonKey,
);

/** Throws if `serverEnv` is reached from a browser bundle. */
function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'src/lib/env.js: serverEnv was imported into client code. ' +
        'Service-role credentials must never reach the browser.',
    );
  }
}

export const serverEnv = {
  get serviceRoleKey() {
    assertServerOnly();
    return read('SUPABASE_SERVICE_ROLE_KEY');
  },
};

/**
 * Whether privileged (RLS-bypassing) operations are available. The app is
 * designed to degrade gracefully: without the key, endpoints that need it
 * return a clear 501 instead of silently leaking or crashing.
 */
export function hasServiceRole() {
  assertServerOnly();
  return Boolean(read('SUPABASE_SERVICE_ROLE_KEY'));
}
