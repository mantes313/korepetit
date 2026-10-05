'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchSession, onAuthStateChange } from '@/lib/api/auth';

/**
 * Identity for the whole app, resolved by the server.
 *
 * Previously this component read the Supabase session in the browser, queried
 * `profiles` directly, and upserted a row when none existed — so the `role`
 * every guard keyed off was assembled client-side from data the client could
 * influence. Now a single call to /api/auth/session returns the user and the
 * profile the server verified, and the token lifecycle stays with the SDK.
 */
/** Never leave the UI gated on a session lookup for longer than this. */
const SESSION_TIMEOUT_MS = 8000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal) => {
    try {
      const session = await fetchSession({ signal });
      if (signal?.aborted) return;
      setUser(session?.user ?? null);
      setProfile(session?.profile ?? null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setUser(null);
      setProfile(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Resolve the session once on mount.
  //
  // The abort controller also carries a hard deadline. Without it, a request
  // that never settles leaves `loading` true forever and ProtectedLayout spins
  // on a blank screen — the app looks hung rather than signed out. Treat a
  // stalled session lookup as "not signed in" and let the user reach /login.
  useEffect(() => {
    const controller = new AbortController();
    // Distinguishes "the request ran out of time" from "the effect was torn
    // down". Only the first should release the loading gate — releasing it on
    // teardown would bounce the user to /login during StrictMode's double
    // mount in development.
    let timedOut = false;

    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SESSION_TIMEOUT_MS);

    refresh(controller.signal).finally(() => {
      clearTimeout(deadline);
      // `refresh` skips its own setLoading when the signal aborted, so clear
      // the gate here instead; otherwise a timeout would wedge the UI.
      if (timedOut) setLoading(false);
    });

    return () => {
      clearTimeout(deadline);
      controller.abort();
    };
  }, [refresh]);

  // Re-resolve on sign-in / sign-out. Token refreshes do not change identity,
  // so they do not need a round trip.
  useEffect(() => {
    return onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        refresh();
      }
    });
  }, [refresh]);

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{ user, profile, setProfile, loading, role, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext) ?? {
    user: null,
    profile: null,
    setProfile: () => {},
    loading: true,
    role: null,
    refresh: async () => {},
  };
}
