'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function ProtectedLayout({ children }) {
  const { user, loading, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Block render until session AND profile have resolved. Without this,
  // role-aware UI (RoleGuard, Sidebar) sees role=null and either redirects
  // valid users or flashes the wrong nav.
  if (loading || (user && profileLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FFFDF8]">
        <div className="w-5 h-5 rounded-full border-2 border-[#C8654A] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return children;
}
