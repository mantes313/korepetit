'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

/**
 * Client-side redirect for signed-out visitors.
 *
 * This is a UX affordance, not the security boundary: every /api route
 * re-checks the session server-side, and RLS sits underneath that.
 */
export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FFFDF8]">
        <div className="w-5 h-5 rounded-full border-2 border-[#C8654A] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return children;
}
