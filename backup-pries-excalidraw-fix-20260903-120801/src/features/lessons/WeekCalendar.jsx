'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
const PX = 48;

export const STATUS_STYLES = {
  pending:  { dot: 'bg-[#D89A3A]',   pill: 'bg-[#FBEAC9] border-[#EBC988] text-[#8A6418]',     bar: 'bg-[#FBEAC9] border-[#D89A3A]',     labelKey: 'status.pending'  },
  accepted: { dot: 'bg-[#7A8C5C]', pill: 'bg-[#E6EBD5] border-[#BDC79A] text-[#4F5F36]', bar: 'bg-[#E6EBD5] border-[#7A8C5C]', labelKey: 'status.accepted' },
  rejected: { dot: 'bg-[#B85A4F]',    pill: 'bg-[#F4D9D5] border-[#E0A89F] text-[#7A3A33]',         bar: 'bg-[#F4D9D5] border-[#B85A4F]',         labelKey: 'status.rejected' },
};

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday;
}

function getWeekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt;
  });
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTime(t) {
  if (!t) return { h: 0, m: 0 };
  const [h, m] = t.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export function StatusLegend() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-5 text-xs text-[#8A7556] mt-4">
      {Object.entries(STATUS_STYLES).map(([k, s]) => (
        <span key={k} className="flex items-center gap-2">
          <span className={`w-3 h-2 rounded-sm border-l-2 ${s.bar}`} />
          {t(s.labelKey)}
        </span>
      ))}
    </div>
  );
}

export function StatusPill({ status }) {
  const { t } = useLanguage();
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {t(s.labelKey)}
    </span>
  );
}

export default function WeekCalendar({ lessons, onSelect, perspective = 'teacher' }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const dates = getWeekDates(weekStart);
  const todayKey = ymd(new Date());
  const startMs = weekStart.getTime();
  const endMs   = startMs + 7 * 24 * 60 * 60 * 1000;

  const visible = lessons.filter(l => {
    const t = new Date(`${l.date}T00:00:00`).getTime();
    return t >= startMs && t < endMs;
  });

  const shift = (delta) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button onClick={() => shift(-1)} className="flex items-center px-2 py-1.5 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] hover:bg-[#EBDFC6] transition-colors">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 4l-4 4 4 4"/></svg>
        </button>
        <span className="text-[11px] font-mono text-[#5A4A38]">
          {dates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => shift(1)} className="flex items-center px-2 py-1.5 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] hover:bg-[#EBDFC6] transition-colors">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 4l4 4-4 4"/></svg>
        </button>
      </div>

      <div className="rounded-lg border border-[#EADFCB] overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
          <div className="border-b border-[#EADFCB] h-11 bg-[#F4ECDF]" />
          {dates.map((d, i) => (
            <div key={i} className="border-b border-[#EADFCB] border-l h-11 flex flex-col items-center justify-center bg-[#F4ECDF]">
              <span className="text-[10px] text-[#8A7556]">{DAYS[i]}</span>
              <span className={`text-xs font-semibold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${ymd(d) === todayKey ? 'bg-[#C8654A] text-white' : 'text-[#5A4A38]'}`}>
                {d.getDate()}
              </span>
            </div>
          ))}

          {HOURS.map(h => (
            <div key={`row-${h}`} className="contents">
              <div className="border-t border-[#EADFCB] text-[9px] font-mono text-[#B5A07F] flex items-start justify-end pr-1.5 pt-1" style={{ height: PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
              {dates.map((d, di) => {
                const dKey = ymd(d);
                const events = visible.filter(l => {
                  if (l.date !== dKey) return false;
                  const { h: lh } = parseTime(l.time);
                  return lh === h;
                });
                return (
                  <div key={`c-${h}-${di}`} className="border-t border-[#EADFCB] border-l relative" style={{ height: PX }}>
                    {events.map(ev => {
                      const { h: lh, m: lm } = parseTime(ev.time);
                      const top = (lm / 60) * PX;
                      const s = STATUS_STYLES[ev.status] ?? STATUS_STYLES.pending;
                      const counterpart = perspective === 'teacher' ? ev.student : ev.teacher;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onSelect?.(ev)}
                          title={`${ev.status} — ${ev.time}`}
                          className={`absolute left-0.5 right-0.5 px-1.5 py-0.5 rounded border-l-2 text-left text-[10px] hover:brightness-110 transition ${s.bar}`}
                          style={{ top, height: PX - 4 }}
                        >
                          <div className="font-mono text-[9px] opacity-80">{String(lh).padStart(2,'0')}:{String(lm).padStart(2,'0')}</div>
                          <div className="truncate text-[#2A1F14] text-[10px] font-medium">
                            {counterpart?.name ?? '—'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <StatusLegend />
    </div>
  );
}
