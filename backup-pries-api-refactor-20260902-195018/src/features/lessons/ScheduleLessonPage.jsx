'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { listStudents, createLessonAsTeacher } from '../../../app/lib/lessons';
import { getUserProfile } from '../../../app/lib/auth';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ScheduleLessonPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [subjects, setSubjects] = useState([]);

  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listStudents()
      .then(data => { if (!cancelled) setStudents(data); })
      .catch(e   => { if (!cancelled) setError(e.message ?? 'Failed to load students.'); })
      .finally(() => { if (!cancelled) setLoadingStudents(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.id)
      .then(profile => setSubjects((profile?.subjects ?? []).filter(s => s?.name).map(s => s.name)))
      .catch(() => {});
  }, [user]);

  const student = students.find(s => s.id === studentId);

  const isValid = studentId && date && time;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createLessonAsTeacher({ teacherId: user.id, studentId, date, time, subject, notes });
      router.replace('/lessons');
    } catch (err) {
      setError(err.message ?? 'Failed to schedule lesson.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Topbar crumbs={[t('schedule.crumb')]} />
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-[#8A7556] uppercase tracking-widest mb-1">{t('schedule.kicker')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2A1F14]">{t('schedule.title')}</h1>
            <p className="text-[#8A7556] text-sm mt-1">{t('schedule.subtitle')}</p>
          </div>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C8654A] text-white text-sm hover:bg-[#B0533A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5L6.5 12 13 4.5"/></svg>
            {submitting ? t('schedule.sending') : t('schedule.create')}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-[#F4D9D5] border border-[#E0A89F] text-red-400 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_300px] gap-4">
          <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] p-5 space-y-6">
            <div>
              <label className="block text-xs text-[#8A7556] mb-1.5">
                {t('schedule.student')} <span className="text-[#7A3A33]">*</span>
              </label>
              <select
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                disabled={loadingStudents}
                className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
              >
                <option value="">{loadingStudents ? t('common.loading') : t('schedule.selectStudent')}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.email ?? '—'}{s.grade ? ` · ${s.grade}` : ''}
                  </option>
                ))}
              </select>
              {!loadingStudents && students.length === 0 && (
                <p className="text-[11px] text-[#8A6418] mt-1.5">{t('schedule.noStudents')}</p>
              )}
            </div>

            {subjects.length > 0 && (
              <div>
                <label className="block text-xs text-[#8A7556] mb-1.5">{t('create.subject')}</label>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
                >
                  <option value="">{t('create.subjectPh')}</option>
                  {subjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <hr className="border-[#EADFCB]" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#8A7556] mb-1.5">{t('create.date')}</label>
                <input
                  type="date"
                  value={date}
                  min={todayStr()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8A7556] mb-1.5">{t('create.time')}</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors"
                />
              </div>
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
                <h2 className="text-sm font-semibold text-[#2A1F14]">{t('schedule.preview')}</h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF0DE] border border-[#BDC79A] text-[10px] text-[#4F5F36]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7A8C5C]" />{t('status.accepted').toLowerCase()}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#8A7556]">
                {date && time ? `${date} · ${time}` : t('create.notSet')}
              </p>
              <p className="text-base font-semibold text-[#2A1F14] mt-2 leading-snug">
                {student?.name ?? t('schedule.noStudent')}
              </p>
              {subject && (
                <span className="inline-flex mt-2 px-2 py-0.5 rounded-full bg-[#F6E4DA] border border-[#E8B7A2] text-[11px] text-[#B0533A]">
                  {subject}
                </span>
              )}
              {notes && (
                <>
                  <hr className="border-[#EADFCB] my-4" />
                  <div className="text-xs text-[#5A4A38] leading-relaxed line-clamp-4">{notes}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
