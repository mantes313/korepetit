'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function RoleGuard({ allow, children, redirectTo = '/dashboard' }) {
  const { role, loading, user } = useAuth();
  const router = useRouter();
  const allowed = Array.isArray(allow) ? allow : [allow];
  const ok = role && allowed.includes(role);

  useEffect(() => {
    if (loading || !user) return;
    if (!ok) router.replace(redirectTo);
  }, [loading, user, ok, router, redirectTo]);

  if (loading || !user || !ok) return null;
  return children;
}
