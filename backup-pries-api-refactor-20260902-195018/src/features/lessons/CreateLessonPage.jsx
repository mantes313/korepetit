'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { listTeachers, createLessonRequest, setLessonMeetLink } from '../../../app/lib/lessons';
import { createMeetEvent } from '../../../app/lib/google';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday;
}

function SlotCalendarHeader({ weekStart, onShift, prevTitle, nextTitle }) {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart);
    dt.setDate(weekStart.getDate() + i);
    return dt;
  });
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onShift(-1)}
        title={prevTitle}
        className="flex items-center px-2 py-1.5 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] hover:bg-[#EBDFC6] transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 4l-4 4 4 4"/></svg>
      </button>
      <span className="text-[11px] font-mono text-[#5A4A38]">
        {dates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
      <button
        type="button"
        onClick={() => onShift(1)}
        title={nextTitle}
        className="flex items-center px-2 py-1.5 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] hover:bg-[#EBDFC6] transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 4l4 4-4 4"/></svg>
      </button>
    </div>
  );
}

function SlotCalendar({ availSet, weekStart, selectedDate, selectedHour, onSelect }) {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart);
    dt.setDate(weekStart.getDate() + i);
    return dt;
  });
  const todayKey = ymd(new Date());
  const now = new Date();

  // Compute hour range from teacher's availability so the grid stays compact.
  const hours = (() => {
    const set = new Set();
    availSet.forEach(k => {
      const h = parseInt(k.split('-')[1], 10);
      if (!Number.isNaN(h)) set.add(h);
    });
    if (set.size === 0) return [];
    const arr = [...set].sort((a, b) => a - b);
    return Array.from({ length: arr[arr.length - 1] - arr[0] + 1 }, (_, i) => arr[0] + i);
  })();

  return (
    <div className="rounded-lg border border-[#EADFCB] overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
        <div className="border-b border-[#EADFCB] h-11 bg-[#F4ECDF]" />
        {dates.map((d, i) => {
          const isToday = ymd(d) === todayKey;
          return (
            <div key={i} className="border-b border-[#EADFCB] border-l h-11 flex flex-col items-center justify-center bg-[#F4ECDF]">
              <span className="text-[10px] text-[#8A7556]">{DAYS[i]}</span>
              <span className={`text-xs font-semibold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#C8654A] text-white' : 'text-[#5A4A38]'}`}>
                {d.getDate()}
              </span>
            </div>
          );
        })}

        {hours.map(h => (
          <div key={`row-${h}`} className="contents">
            <div className="border-t border-[#EADFCB] text-[10px] font-mono text-[#8A7556] flex items-start justify-end pr-2 pt-1.5" style={{ height: 36 }}>
              {String(h).padStart(2, '0')}:00
            </div>
            {dates.map((d, di) => {
              const dKey = ymd(d);
              const isAvailable = availSet.has(`${di}-${h}`);
              const slotDate = new Date(d);
              slotDate.setHours(h, 0, 0, 0);
              const isPast = slotDate.getTime() < now.getTime();
              const enabled = isAvailable && !isPast;
              const isSelected = enabled && selectedDate === dKey && selectedHour === String(h).padStart(2, '0');
              return (
                <button
                  key={`c-${h}-${di}`}
                  type="button"
                  disabled={!enabled}
                  onClick={() => onSelect(dKey, String(h).padStart(2, '0'))}
                  title={enabled ? `${dKey} ${String(h).padStart(2,'0')}:00` : ''}
                  className={`border-t border-l border-[#EADFCB] transition-colors ${
                    isSelected
                      ? 'bg-[#C8654A] hover:bg-[#B0533A]'
                      : enabled
                        ? 'bg-[#F6E4DA] hover:bg-[#B0533A]/30 cursor-pointer'
                        : 'bg-[#FFFDF8]/20'
                  }`}
                  style={{ height: 36 }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreateLessonPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, googleToken } = useAuth();
  const { t } = useLanguage();

  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const presetTeacherId = params.get('teacherId') ?? '';
  const [teacherId, setTeacherId] = useState(presetTeacherId);
  const tutorPreselected = Boolean(presetTeacherId);
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const time = hour ? `${hour}:00` : '';
  const [notes, setNotes] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const teacher = teachers.find(tt => tt.id === teacherId);
  const availSet = useMemo(
    () => new Set(teacher?.availability ?? []),
    [teacher],
  );

  // Reset selected slot and subject when the teacher changes.
  useEffect(() => {
    setDate('');
    setHour('');
    setSubject('');
  }, [teacherId]);

  const teacherSubjects = useMemo(
    () => (teacher?.subjects ?? []).filter(s => s?.name).map(s => s.name),
    [teacher],
  );

  useEffect(() => {
    let cancelled = false;
    listTeachers()
      .then(data => { if (!cancelled) setTeachers(data); })
      .catch(e   => { if (!cancelled) setError(e.message ?? 'Failed to load tutors.'); })
      .finally(() => { if (!cancelled) setLoadingTeachers(false); });
    return () => { cancelled = true; };
  }, []);

  const isValid =
    teacherId
    && date
    && hour
    && (teacherSubjects.length === 0 || subject);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const lesson = await createLessonRequest({ studentId: user.id, teacherId, date, time, subject, notes });

      // Best-effort: create a Google Calendar event with a Meet link. Only
      // possible if the student signed in with Google in this session.
      if (googleToken && teacher?.email) {
        try {
          const { meetLink } = await createMeetEvent({
            token: googleToken,
            lessonId: lesson.id,
            summary: subject ? `${subject} lesson with ${teacher.name ?? ''}`.trim() : `Lesson with ${teacher.name ?? ''}`.trim(),
            description: notes || '',
            date,
            time: `${time}:00`,
            durationMin: 60,
            attendeeEmails: [user.email, teacher.email],
          });
          if (meetLink) await setLessonMeetLink(lesson.id, meetLink);
        } catch (calendarErr) {
          // Don't block the booking on calendar failures — the lesson still
          // exists and JoinSection falls back to a Jitsi room.
          console.warn('Calendar event creation failed:', calendarErr);
        }
      }

      router.replace('/lessons');
    } catch (err) {
      setError(err.message ?? 'Failed to send request.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Topbar crumbs={[t('create.crumb')]} />
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-[#8A7556] uppercase tracking-widest mb-1">{t('create.kicker')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2A1F14]">{t('create.title')}</h1>
            <p className="text-[#8A7556] text-sm mt-1">{t('create.subtitle')}</p>
          </div>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C8654A] text-white text-sm hover:bg-[#B0533A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5L6.5 12 13 4.5"/></svg>
            {submitting ? t('create.sending') : t('create.send')}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-[#F4D9D5] border border-[#E0A89F] text-red-400 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_300px] gap-4">
          <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] p-5 space-y-6">
            <div className="space-y-4">
              <p className="text-[10px] font-mono text-[#8A7556] uppercase tracking-widest">{t('create.tutor')}</p>
              {tutorPreselected ? (
                teacher ? (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8]">
                    <div className="w-9 h-9 rounded-full bg-[#F4ECDF] border border-[#DCC9A8] overflow-hidden flex items-center justify-center text-[#5A4A38] text-xs font-medium shrink-0">
                      {teacher.photo_url
                        ? <img src={teacher.photo_url} alt={teacher.name ?? ''} className="w-full h-full object-cover" />
                        : (teacher.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2A1F14] truncate">{teacher.name ?? '—'}</p>
                      {teacher.headline && <p className="text-[11px] text-[#8A7556] truncate">{teacher.headline}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8A7556]">{t('common.loading')}</p>
                )
              ) : (
                <div>
                  <label className="block text-xs text-[#8A7556] mb-1.5">{t('create.chooseTutor')}</label>
                  <select
                    value={teacherId}
                    onChange={e => setTeacherId(e.target.value)}
                    disabled={loadingTeachers}
                    className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
                  >
                    <option value="">{loadingTeachers ? t('common.loading') : t('create.selectTutor')}</option>
                    {teachers.map(tt => (
                      <option key={tt.id} value={tt.id}>
                        {tt.name ?? '—'} {tt.headline ? `· ${tt.headline}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {teacher && (
                <div>
                  <label className="block text-xs text-[#8A7556] mb-1.5">
                    {t('create.subject')} <span className="text-[#7A3A33]">*</span>
                  </label>
                  {teacherSubjects.length === 0 ? (
                    <p className="text-[11px] text-[#8A6418]">{t('create.noSubjects')}</p>
                  ) : (
                    <select
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
                    >
                      <option value="">{t('create.subjectPh')}</option>
                      {teacherSubjects.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <hr className="border-[#EADFCB]" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-[#8A7556] uppercase tracking-widest">{t('create.dateTime')}</p>
                {teacher && availSet.size > 0 && (
                  <SlotCalendarHeader
                    weekStart={weekStart}
                    onShift={(delta) => {
                      const next = new Date(weekStart);
                      next.setDate(weekStart.getDate() + delta * 7);
                      setWeekStart(next);
                    }}
                    prevTitle={t('create.weekPrev')}
                    nextTitle={t('create.weekNext')}
                  />
                )}
              </div>

              {!teacher ? (
                <p className="text-xs text-[#8A7556]">{t('create.pickTutorFirst')}</p>
              ) : availSet.size === 0 ? (
                <p className="text-xs text-[#8A6418]">{t('create.noAvailability')}</p>
              ) : (
                <SlotCalendar
                  availSet={availSet}
                  weekStart={weekStart}
                  selectedDate={date}
                  selectedHour={hour}
                  onSelect={(d, h) => { setDate(d); setHour(h); }}
                />
              )}
            </div>

            <hr className="border-[#EADFCB]" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-[#8A7556] uppercase tracking-widest">{t('create.notes')}</p>
                <span className="text-xs font-mono text-[#8A7556]">{notes.length} / 500</span>
              </div>
              <textarea
                rows={5}
                value={notes}
                onChange={e => setNotes(e.target.value.slice(0, 500))}
                placeholder={t('create.notesPh')}
                className="w-full px-3 py-3 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors resize-none"
              />
            </div>
          </div>

          <div>
            <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#2A1F14]">{t('create.preview')}</h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FBEAC9] border border-[#EBC988] text-[10px] text-[#8A6418]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D89A3A]" />{t('status.pending').toLowerCase()}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#8A7556]">
                {date && time ? `${date} · ${time}` : t('create.notSet')}
              </p>
              <p className="text-base font-semibold text-[#2A1F14] mt-2 leading-snug">
                {teacher?.name ?? t('create.noTutor')}
              </p>
              {teacher?.headline && <p className="text-xs text-[#8A7556] mt-1">{teacher.headline}</p>}
              {subject && (
                <span className="inline-flex mt-2 px-2 py-0.5 rounded-full bg-[#F6E4DA] border border-[#E8B7A2] text-[11px] text-[#B0533A]">
                  {subject}
                </span>
              )}
              <hr className="border-[#EADFCB] my-4" />
              <div className="space-y-2.5 text-sm text-[#8A7556]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EBDFC6]" />
                  {teacher?.price_60 != null ? `€${teacher.price_60} / 60 min` : t('create.priceOnReq')}
                </div>
                {notes && (
                  <div className="text-xs text-[#5A4A38] leading-relaxed line-clamp-4">{notes}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
