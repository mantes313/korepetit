'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../app/lib/supabase';

// Hardcoded admin emails — these users see a role-switcher toggle in the
// Topbar that overrides the role *for UI rendering only*. RLS still applies
// the actual profiles.role, so DB writes behave per the real role.
const ADMIN_EMAILS = ['autornas123@gmail.com'];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [roleOverride, setRoleOverrideState] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);

  // Hydrate the override from sessionStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('adminRoleOverride');
    if (stored === 'student' || stored === 'teacher') setRoleOverrideState(stored);
  }, []);

  const setRoleOverride = (next) => {
    if (typeof window !== 'undefined') {
      if (next) sessionStorage.setItem('adminRoleOverride', next);
      else sessionStorage.removeItem('adminRoleOverride');
    }
    setRoleOverrideState(next);
  };

  // 1) Resolve current session up front. Don't rely on onAuthStateChange to
  //    flip `loading` — its INITIAL_SESSION event can be delayed by token
  //    refresh / cross-tab Web Locks and wedge the UI on reload.
  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Hard escape hatch — if the SDK wedges, unblock the UI anyway.
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.provider_token) setGoogleToken(session.provider_token);
      setLoading(false);
      clearTimeout(safety);
    }).catch(() => {
      if (cancelled) return;
      setUser(null);
      setLoading(false);
      clearTimeout(safety);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Listener only handles future changes — never gates `loading`.
      setUser(session?.user ?? null);
      // provider_token is only present right after OAuth sign-in. Cache it
      // so Calendar API calls within this session can use it.
      if (session?.provider_token) setGoogleToken(session.provider_token);
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  // 2) Profile fetch. Seeds a row on first sign-in so RLS-gated queries
  //    (e.g. lessons insert/update) actually see profiles.role.
  useEffect(() => {
    if (!supabase || !user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    (async () => {
      try {
        const { data: existing } = await supabase
          .from('profiles').select('*').eq('id', user.id).maybeSingle();

        if (cancelled) return;

        const pendingRole = typeof window !== 'undefined'
          ? sessionStorage.getItem('pendingGoogleRole')
          : null;
        if (typeof window !== 'undefined') sessionStorage.removeItem('pendingGoogleRole');

        if (existing) {
          // Existing profile is authoritative. Never overwrite role from
          // pendingGoogleRole — login flow defaults it to 'student' and would
          // silently demote teachers signing in via Google.
          setProfile(existing);
        } else {
          // First sign-in: seed a row so the role lives in the DB, not just
          // user_metadata. RLS (lessons insert/update) reads profiles.role.
          const role = pendingRole ?? user.user_metadata?.role ?? 'student';
          const name = user.user_metadata?.full_name ?? null;
          const seed = { id: user.id, role, name };
          const { data: created } = await supabase
            .from('profiles').upsert(seed).select().maybeSingle();
          if (!cancelled) setProfile(created ?? seed);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const actualRole = profile?.role ?? user?.user_metadata?.role ?? null;
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const role = isAdmin && roleOverride ? roleOverride : actualRole;

  return (
    <AuthContext.Provider value={{
      user, profile, setProfile, loading, profileLoading,
      role, actualRole, isAdmin, roleOverride, setRoleOverride,
      googleToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
