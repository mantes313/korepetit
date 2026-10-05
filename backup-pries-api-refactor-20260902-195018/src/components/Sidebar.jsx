'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { signOut } from '../../app/lib/auth';

const Icons = {
  Grid:     () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  Cal:      () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6h11M5.5 2v3M10.5 2v3"/></svg>,
  Bell:     () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 7a4 4 0 018 0v3l1 2H3l1-2V7z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>,
  User:     () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="6" r="2.8"/><path d="M3 14c.5-2.5 2.5-4 5-4s4.5 1.5 5 4"/></svg>,
  Plus:     () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 3v10M3 8h10"/></svg>,
  Folder:   () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-7.5z"/></svg>,
  Video:    () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>,
  Search:   () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>,
  Logout:   () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"/></svg>,
};

const sections = [
  {
    items: [
      { href: '/dashboard',      labelKey: 'nav.dashboard',      icon: 'Grid'   },
      { href: '/messages',       labelKey: 'nav.messages',       icon: 'Bell'   },
      { href: '/lessons',        labelKey: 'nav.myLessons',      icon: 'Video' },
    ],
  },
  
  {
    items: [
      { href: '/tutors',         labelKey: 'nav.findTutor',      icon: 'Search', studentOnly: true },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, profile, role } = useAuth();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const displayName = profile?.name ?? user?.email ?? '';
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // Hide role-restricted items unless the role is known and matches.
  // While role is still resolving (null), studentOnly items stay hidden so
  // teachers never flash student UI on first paint.
  const visibleSections = sections
    .map(sec => ({ ...sec, items: sec.items.filter(it => !it.studentOnly || role === 'student') }))
    .filter(sec => sec.items.length > 0);

  return (
    <aside className="w-60 h-full shrink-0 bg-[#FFFDF8] border-r border-[#EADFCB] flex flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#EADFCB]">
        <div className="w-8 h-8 rounded-lg bg-[#C8654A] flex items-center justify-center text-white font-bold text-sm shrink-0">
          K
        </div>
        <div>
          <div className="text-[#2A1F14] font-semibold text-3xl tracking-tight">
            Koris
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        {visibleSections.map((sec) => (
          <div key={sec.items[0]?.href ?? sec.labelKey} className="mb-6">
            {sec.labelKey && (
              <div className="px-2 mb-2 text-[9px] font-semibold tracking-[0.1em] text-[#8A7556] uppercase">
                {t(sec.labelKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon   = Icons[item.icon];
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                        active
                          ? 'bg-[#F4ECDF] text-[#2A1F14]'
                          : 'text-[#5A4A38] hover:bg-[#FFFDF8] hover:text-[#2A1F14]'
                      }`}
                    >
                      <span className={active ? 'text-[#B0533A]' : 'text-[#8A7556] group-hover:text-[#5A4A38]'}>
                        <Icon />
                      </span>
                      <span className="flex-1">{t(item.labelKey)}</span>
                      <span className="text-[10px] font-mono text-[#B5A07F]">{item.num}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 px-3 py-3 border-t border-[#EADFCB]">
        <Link
          href="/profile"
          title={t('nav.profileSettings')}
          className={`flex items-center gap-3 flex-1 min-w-0 px-2 py-1.5 rounded-lg transition-colors ${
            pathname === '/profile' ? 'bg-[#F4ECDF]' : 'hover:bg-[#FFFDF8]'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-[#B0533A] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[#2A1F14] text-xs font-medium truncate">
              {displayName || '—'}
            </div>
            <div className="text-[#8A7556] text-[10px] truncate">{user?.email ?? ''}</div>
          </div>
        </Link>
        <button
          onClick={handleSignOut}
          title={t('nav.signOut')}
          className="shrink-0 p-2 rounded-lg text-[#8A7556] hover:text-[#7A3A33] hover:bg-[#FFFDF8] transition-colors"
        >
          <Icons.Logout />
        </button>
      </div>
    </aside>
  );
}
