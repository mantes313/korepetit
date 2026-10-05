'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const CALL_RE = /^\/lessons\/[^/]+\/call(\/|$)/;

export default function AppShell({ children }) {
  const pathname = usePathname() ?? '';
  const inCall = CALL_RE.test(pathname);
  const [collapsed, setCollapsed] = useState(inCall);

  // Auto-collapse whenever the user enters a lesson-call route; auto-expand
  // when they navigate back out.
  useEffect(() => {
    setCollapsed(CALL_RE.test(pathname));
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#FBF7F0] text-[#2A1F14] overflow-hidden">
      <div
        className={`relative shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
          collapsed ? 'w-0' : 'w-60'
        }`}
      >
        <Sidebar />
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Hide sidebar"
          title="Hide sidebar"
          className={`absolute top-2.5 right-2.5 z-10 flex items-center justify-center w-7 h-7 rounded-lg text-[#8A7556] hover:bg-[#F4ECDF] hover:text-[#2A1F14] transition-opacity duration-200 ${
            collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Show sidebar"
        title="Show sidebar"
        className={`fixed top-2.5 left-2.5 z-50 flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFFDF8] border border-[#EADFCB] text-[#5A4A38] hover:bg-[#F4ECDF] hover:text-[#2A1F14] shadow-sm transition-opacity duration-300 ${
          collapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>

      <div className="flex-1 overflow-y-auto min-w-0">{children}</div>
    </div>
  );
}
