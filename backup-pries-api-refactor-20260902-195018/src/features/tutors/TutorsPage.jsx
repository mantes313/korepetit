'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { useLanguage } from '@/components/LanguageProvider';
import { listTeachers } from '../../../app/lib/lessons';

const DAY_KEYS = ['days.mon', 'days.tue', 'days.wed', 'days.thu', 'days.fri', 'days.sat', 'days.sun'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

function TutorDetailModal({ tutor, onClose }) {
  const { t } = useLanguage();
  const initials = (tutor.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const availSet = useMemo(() => new Set(tutor.availability ?? []), [tutor.availability]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFDF8] border border-[#EADFCB] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8A7556] hover:text-[#5A4A38] transition-colors z-10"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l10 10M13 3L3 13"/>
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex gap-4 items-start">
            <div className="w-20 h-20 rounded-full bg-[#F4ECDF] border border-[#DCC9A8] overflow-hidden flex items-center justify-center text-[#5A4A38] text-lg font-medium shrink-0">
              {tutor.photo_url
                ? <img src={tutor.photo_url} alt={tutor.name ?? ''} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-xl font-semibold text-[#2A1F14]">{tutor.name ?? t('tutors.unnamed')}</p>
              {tutor.headline && <p className="text-sm text-[#5A4A38] mt-1">{tutor.headline}</p>}
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-[#8A7556]">
                  {tutor.price_60 != null
                    ? <><span className="text-[#2A1F14] font-semibold">€{tutor.price_60}</span> <span className="text-xs">/ 60 min</span></>
                    : t('tutors.priceOnRequest')}
                </p>
              </div>
            </div>
          </div>

          {/* Bio */}
          {tutor.bio && (
            <div className="mt-5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-2">{t('tutors.about')}</p>
              <p className="text-sm text-[#5A4A38] leading-relaxed whitespace-pre-wrap">{tutor.bio}</p>
            </div>
          )}

          {/* Subjects */}
          {(tutor.subjects?.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-2">{t('tutors.teaches')}</p>
              <div className="space-y-1.5">
                {tutor.subjects.filter(s => s.name).map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#EADFCB]">
                    <span className="text-sm text-[#2A1F14] font-medium">{s.name}</span>
                    {s.grades && <span className="text-xs text-[#8A7556] font-mono">{s.grades}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {(tutor.tags?.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-2">{t('tutors.topics')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tutor.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-[#F4ECDF] border border-[#DCC9A8] text-xs text-[#5A4A38]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className="mt-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-2">{t('tutors.availability')}</p>
            {availSet.size === 0 ? (
              <p className="text-xs text-[#8A7556]">{t('tutors.noAvailability')}</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-[#EADFCB]">
                  <div className="grid" style={{ gridTemplateColumns: '40px repeat(7, 1fr)', minWidth: 480 }}>
                    <div className="h-7 bg-[#F4ECDF]" />
                    {DAY_KEYS.map(k => (
                      <div key={k} className="h-7 text-[10px] font-mono text-[#8A7556] flex items-center justify-center bg-[#F4ECDF] border-l border-[#EADFCB]">{t(k)}</div>
                    ))}
                    {HOURS.map(h => (
                      <React.Fragment key={h}>
                        <div className="text-[9px] font-mono text-[#8A7556] flex items-center justify-end pr-1.5 bg-[#F4ECDF]/60 border-t border-[#EADFCB]" style={{ height: 24 }}>
                          {String(h).padStart(2, '0')}:00
                        </div>
                        {DAY_KEYS.map((_, d) => {
                          const on = availSet.has(`${d}-${h}`);
                          return (
                            <div
                              key={`c-${h}-${d}`}
                              className={`border-t border-l border-[#EADFCB] ${on ? 'bg-[#C8654A]/30' : ''}`}
                              style={{ height: 24 }}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="flex gap-5 mt-2 text-xs text-[#8A7556]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#C8654A]/40" />{t('tutors.free')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#F4ECDF] border border-[#DCC9A8]" />{t('tutors.busy')}</span>
                  <span className="ml-auto font-mono text-[10px]">Europe/Vilnius</span>
                </div>
              </>
            )}
          </div>

          {/* Action */}
          <Link
            href={`/lessons/create?teacherId=${tutor.id}`}
            className="mt-6 block w-full text-center py-2.5 rounded-lg bg-[#C8654A] text-white text-sm font-medium hover:bg-[#B0533A] transition-colors"
          >
            {t('tutors.requestLesson')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TutorsPage() {
  const { t } = useLanguage();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listTeachers()
      .then(data => { if (!cancelled) setTeachers(data); })
      .catch(e   => { if (!cancelled) setError(e.message ?? t('tutors.failedLoad')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  const subjects = useMemo(() => {
    const set = new Set();
    teachers.forEach(t => (t.subjects ?? []).forEach(s => s?.name && set.add(s.name)));
    return [...set].sort();
  }, [teachers]);

  const filtered = teachers.filter(t => {
    if (subject && !(t.subjects ?? []).some(s => s.name === subject)) return false;
    if (maxPrice && t.price_60 != null && Number(t.price_60) > Number(maxPrice)) return false;
    return true;
  });

  const selectedTutor = selectedId ? teachers.find(t => t.id === selectedId) : null;

  return (
    <>
      {selectedTutor && (
        <TutorDetailModal tutor={selectedTutor} onClose={() => setSelectedId(null)} />
      )}
      <Topbar crumbs={[t('tutors.crumb')]} />
      <div className="p-6 space-y-6">
        <div>
          <p className="text-xs font-mono text-[#8A7556] uppercase tracking-widest mb-1">{t('tutors.kicker')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A1F14]">{t('tutors.title')}</h1>
          <p className="text-[#8A7556] text-sm mt-1">{t('tutors.subtitle')}</p>
        </div>

        <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] p-5">
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-[#8A7556] mb-1.5">{t('tutors.subject')}</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none appearance-none cursor-pointer"
              >
                <option value="">{t('tutors.anySubject')}</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8A7556] mb-1.5">{t('tutors.maxPrice')}</label>
              <div className="flex items-center bg-[#F4ECDF]/60 border border-[#DCC9A8] rounded-lg overflow-hidden focus-within:border-[#C8654A] transition-colors">
                <span className="px-2.5 text-[#8A7556] text-sm">€</span>
                <input
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 py-2 bg-transparent text-[#2A1F14] text-sm outline-none"
                  placeholder={t('tutors.anyPlaceholder')}
                />
              </div>
            </div>
            <button
              onClick={() => { setSubject(''); setMaxPrice(''); }}
              className="px-4 py-2 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] text-sm hover:bg-[#EBDFC6] transition-colors"
            >
              {t('tutors.clearFilters')}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-[#F4D9D5] border border-[#E0A89F] text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#C8654A] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8A7556]">
            <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>
            <p className="text-sm mt-3">{teachers.length === 0 ? t('tutors.noTutors') : t('tutors.noMatch')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(tu => {
              const initials = (tu.name ?? '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
              return (
                <div
                  key={tu.id}
                  onClick={() => setSelectedId(tu.id)}
                  className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] p-5 flex gap-4 cursor-pointer transition-shadow hover:shadow-md hover:border-[#DCC9A8]"
                >
                  <div className="w-14 h-14 rounded-full bg-[#F4ECDF] border border-[#DCC9A8] overflow-hidden flex items-center justify-center text-[#5A4A38] text-sm font-medium shrink-0">
                    {tu.photo_url ? <img src={tu.photo_url} alt={tu.name ?? ''} className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-[#2A1F14] truncate">{tu.name ?? t('tutors.unnamed')}</p>
                    {tu.headline && <p className="text-xs text-[#5A4A38] truncate mt-0.5">{tu.headline}</p>}
                    {(tu.subjects?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tu.subjects.filter(s => s.name).slice(0, 3).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-[#F6E4DA] border border-[#E8B7A2] text-[10px] text-[#B0533A]">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3" onClick={e => e.stopPropagation()}>
                      <p className="text-xs text-[#8A7556]">
                        {tu.price_60 != null ? <><span className="text-[#2A1F14] font-semibold">€{tu.price_60}</span> / 60 min</> : t('tutors.priceOnRequest')}
                      </p>
                      <Link
                        href={`/lessons/create?teacherId=${tu.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[#C8654A] text-white text-xs font-medium hover:bg-[#B0533A] transition-colors"
                      >
                        {t('tutors.requestLesson')}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
