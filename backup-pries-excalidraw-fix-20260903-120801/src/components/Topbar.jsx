'use client';

import { useLanguage } from './LanguageProvider';

export default function Topbar({ crumbs }) {
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => setLang(lang === 'en' ? 'lt' : 'en');

  return (
    <div className="h-12 border-b border-[#EADFCB] bg-[#FFFDF8] flex items-center px-6 gap-3 shrink-0">
      <div className="flex items-center gap-1.5 text-xs text-[#8A7556] flex-1 min-w-0">
        <span>Korepetitor</span>
        {crumbs?.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 4l4 4-4 4" />
            </svg>
            <span className={i === crumbs.length - 1 ? 'text-[#5A4A38]' : ''}>{c}</span>
          </span>
        ))}
      </div>

      <button
        onClick={toggleLang}
        title={t('lang.toggleTitle')}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#DCC9A8] bg-[#FFFDF8] text-[#5A4A38] text-[11px] font-mono hover:bg-[#F4ECDF] transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6"/>
          <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>
        </svg>
        <span>{lang.toUpperCase()}</span>
      </button>

    </div>
  );
}
