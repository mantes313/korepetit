'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { getLessonCounterpart } from '@/lib/api/lessons';

const JOIN_BEFORE_MS = 15 * 60 * 1000; // 15 min
const JOIN_AFTER_MS  = 60 * 60 * 1000; // 60 min

const ALLOWED_MEET_HOSTS = new Set(['meet.google.com', 'meet.jit.si']);

function meetUrlFor(lesson) {
  // Prefer the Google Meet link generated when the lesson was booked.
  // Fall back to a deterministic Jitsi room (same URL for both participants)
  // when no Meet link is stored — e.g. student didn't sign in with Google.
  const fallback = `https://meet.jit.si/Korepetitor-${lesson.id}`;
  if (!lesson.meet_link) return fallback;

  // New links are validated before they are stored, but rows written before
  // that check exist, and this value ends up in an href the counterpart
  // clicks. Re-check rather than trust the row.
  try {
    const url = new URL(lesson.meet_link);
    if (url.protocol === 'https:' && ALLOWED_MEET_HOSTS.has(url.hostname)) {
      return url.toString();
    }
  } catch {
    // fall through
  }
  return fallback;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days  = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins  = Math.floor((total % 3600) / 60);
  const secs  = total % 60;
  if (days > 0)  return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${String(secs).padStart(2, '0')}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function JoinSection({ lesson }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mirrors the server's rule in getRoomAccess: only an accepted lesson has
  // a room. The countdown below is presentation; the gate is server-side.
  if (lesson.status !== 'accepted') return null;

  const startMs = new Date(`${lesson.date}T${lesson.time}`).getTime();
  const diff = startMs - now;
  const tooEarly = diff > JOIN_BEFORE_MS;
  const ended = diff < -JOIN_AFTER_MS;
  const active = !tooEarly && !ended;
  const meetUrl = meetUrlFor(lesson);

  return (
    <div className="mt-4 mb-1 p-3 rounded-lg border border-[#EADFCB] bg-[#F4ECDF]">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-2">
        {t('lessonDetail.lessonRoom')}
      </p>
      {active ? (
        <div className="space-y-2">
          <Link
            href={`/lessons/${lesson.id}/call`}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[#7A8C5C] text-white text-sm font-medium hover:bg-[#677A4D] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {diff <= 0 ? t('lessonDetail.live') : t('lessonDetail.join')}
          </Link>
          <a
            href={meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-1.5 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] text-xs hover:bg-[#EBDFC6] transition-colors"
          >
            {t('lessonDetail.openExternalMeet')}
          </a>
        </div>
      ) : ended ? (
        <button
          type="button"
          disabled
          className="flex items-center justify-center w-full px-3 py-2 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#8A7556] text-sm cursor-not-allowed"
        >
          {t('lessonDetail.ended')}
        </button>
      ) : (
        <div>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[#F4ECDF] border border-[#DCC9A8] text-[#5A4A38] text-sm cursor-not-allowed"
          >
            {t('lessonDetail.join')}
          </button>
          <p className="mt-2 text-center text-[11px] font-mono text-[#8A7556]">
            {t('lessonDetail.startsIn')} <span className="text-[#5A4A38]">{formatCountdown(diff)}</span>
          </p>
        </div>
      )}
      <p className="mt-2 text-[10px] font-mono text-[#8A7556] break-all">{meetUrl}</p>
    </div>
  );
}

export const STATUS_PILL = {
  pending:  'bg-[#FBEAC9] border-[#EBC988] text-[#8A6418]',
  accepted: 'bg-[#E6EBD5] border-[#BDC79A] text-[#4F5F36]',
  rejected: 'bg-[#F4D9D5] border-[#E0A89F] text-[#7A3A33]',
};

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-1">{label}</p>
      {children}
    </div>
  );
}

function PaymentSection({ lesson, perspective, teacher, onMarkPaid }) {
  const { t } = useLanguage();
  const [marking, setMarking] = useState(false);
  if (lesson.status !== 'accepted') return null;

  const isPaid = Boolean(lesson.paid_at);

  return (
    <div className="mt-4 p-3 rounded-lg border border-[#EADFCB] bg-[#F4ECDF]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556]">
          {t('lessonDetail.payment')}
        </p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
          isPaid ? 'bg-[#E6EBD5] border-[#BDC79A] text-[#4F5F36]' : 'bg-[#FBEAC9] border-[#EBC988] text-[#8A6418]'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {isPaid ? t('lessonDetail.paid') : t('lessonDetail.unpaid')}
        </span>
      </div>

      {perspective === 'student' && !isPaid && (
        <div className="space-y-1.5">
          <p className="text-xs text-[#5A4A38]">{t('lessonDetail.payInstructions')}</p>
          {teacher?.bank_iban ? (
            <p className="text-sm font-mono text-[#2A1F14] break-all">{teacher.bank_iban}</p>
          ) : (
            <p className="text-xs text-[#8A6418] italic">{t('lessonDetail.noIban')}</p>
          )}
          <p className="text-[11px] text-[#8A7556]">
            {t('lessonDetail.paymentRef')}: <span className="font-mono text-[#2A1F14]">{lesson.payment_code}</span>
          </p>
          {teacher?.price_60 != null && (
            <p className="text-[11px] text-[#8A7556]">
              {t('lessonDetail.amount')}: <span className="font-mono text-[#2A1F14]">€{teacher.price_60}</span>
            </p>
          )}
        </div>
      )}

      {perspective === 'teacher' && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#8A7556]">
            {t('lessonDetail.paymentRef')}: <span className="font-mono text-[#2A1F14]">{lesson.payment_code}</span>
          </p>
          {!isPaid && onMarkPaid && (
            <button
              type="button"
              disabled={marking}
              onClick={async () => {
                setMarking(true);
                try { await onMarkPaid(lesson.id); } finally { setMarking(false); }
              }}
              className="mt-1 w-full px-3 py-1.5 rounded-lg bg-[#7A8C5C] text-white text-xs font-medium hover:bg-[#677A4D] transition-colors disabled:opacity-50"
            >
              {marking ? t('common.saving') : t('lessonDetail.markPaid')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LessonDetailModal({ lesson, perspective, onClose, onMarkPaid }) {
  const { t } = useLanguage();
  // perspective: 'teacher' (viewing student) or 'student' (viewing tutor)
  const card = perspective === 'teacher' ? lesson.student : lesson.teacher;

  // Lists carry only the public card. Contact details, the student's learning
  // notes and the tutor's IBAN are released per lesson, by an endpoint that
  // checks participation first — so they are fetched when the modal opens.
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getLessonCounterpart(lesson.id, { signal: controller.signal })
      .then(setDetails)
      .catch(() => {});
    return () => controller.abort();
  }, [lesson.id]);

  const p = { ...(card ?? {}), ...(details ?? {}) };
  const initials = (p?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const isStudentView = perspective === 'student';
  const hasTutorInfo = isStudentView && (p?.bio || p?.subjects?.length || p?.tags?.length || p?.price_60 != null);
  const hasStudentInfo = !isStudentView && (p?.grade || p?.learning_struggles || p?.expectations);
  const noInfo = isStudentView ? !hasTutorInfo : !hasStudentInfo;
  const counterpartId = isStudentView ? lesson.teacher_id : lesson.student_id;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFDF8] border border-[#EADFCB] rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title={t('lessonDetail.close')}
          className="absolute top-4 right-4 text-[#8A7556] hover:text-[#5A4A38] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l10 10M13 3L3 13"/>
          </svg>
        </button>

        <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556] mb-3">
          {t('lessonDetail.title')}
        </p>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-[#F4ECDF] flex items-center justify-center text-[#5A4A38] text-sm font-medium shrink-0 overflow-hidden">
            {p?.photo_url
              ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#2A1F14] truncate">{p?.name ?? '—'}</p>
            {p?.headline && <p className="text-xs text-[#8A7556] truncate">{p.headline}</p>}
          </div>
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${STATUS_PILL[lesson.status] ?? STATUS_PILL.pending}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {t(`status.${lesson.status ?? 'pending'}`)}
          </span>
        </div>

        <JoinSection lesson={lesson} />

        <PaymentSection
          lesson={lesson}
          perspective={perspective}
          teacher={isStudentView ? p : null}
          onMarkPaid={onMarkPaid}
        />

        {counterpartId && lesson.status !== 'rejected' && (
          <Link
            href={`/messages?with=${counterpartId}`}
            className="mt-3 flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[#FFFDF8] border border-[#DCC9A8] text-[#5A4A38] text-sm hover:bg-[#F4ECDF] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z"/>
            </svg>
            {t('lessonDetail.message')} {p?.name?.split(' ')[0] ?? t(isStudentView ? 'lessonDetail.tutorWord' : 'lessonDetail.studentWord')}
          </Link>
        )}

        <div className="space-y-3 mt-4">
          <Field label={t('lessonDetail.when')}>
            <p className="text-sm text-[#2A1F14] font-mono">
              {lesson.date} · {lesson.time?.slice(0, 5)}
            </p>
          </Field>

          {lesson.subject && (
            <Field label={t('lessonDetail.subject')}>
              <span className="inline-flex px-2 py-0.5 rounded-full bg-[#F6E4DA] border border-[#E8B7A2] text-[11px] text-[#B0533A]">
                {lesson.subject}
              </span>
            </Field>
          )}

          {/* Teacher viewing student */}
          {!isStudentView && p?.grade && (
            <Field label={t('lessonDetail.grade')}>
              <p className="text-sm text-[#2A1F14]">{p.grade}</p>
            </Field>
          )}

          {lesson.notes && (
            <Field label={t('dashboard.notes')}>
              <p className="text-sm text-[#5A4A38] whitespace-pre-wrap">{lesson.notes}</p>
            </Field>
          )}

          {!isStudentView && p?.learning_struggles && (
            <Field label={t('dashboard.struggles')}>
              <p className="text-sm text-[#5A4A38] whitespace-pre-wrap">{p.learning_struggles}</p>
            </Field>
          )}

          {!isStudentView && p?.expectations && (
            <Field label={t('dashboard.expects')}>
              <p className="text-sm text-[#5A4A38] whitespace-pre-wrap">{p.expectations}</p>
            </Field>
          )}

          {/* Student viewing tutor */}
          {isStudentView && p?.subjects?.length > 0 && (
            <Field label={t('lessonDetail.subjects')}>
              <div className="flex flex-wrap gap-1.5">
                {p.subjects.filter(s => s?.name).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-[#F6E4DA] border border-[#E8B7A2] text-[11px] text-[#B0533A]">
                    {s.name}{s.grades ? ` · ${s.grades}` : ''}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {isStudentView && p?.tags?.length > 0 && (
            <Field label={t('lessonDetail.tags')}>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-[#F4ECDF] border border-[#DCC9A8] text-[11px] text-[#5A4A38]">
                    {tag}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {isStudentView && p?.price_60 != null && (
            <Field label={t('lessonDetail.price')}>
              <p className="text-sm text-[#2A1F14]">€{p.price_60} <span className="text-xs text-[#8A7556]">/ 60 min</span></p>
            </Field>
          )}

          {isStudentView && p?.bio && (
            <Field label={t('lessonDetail.aboutTutor')}>
              <p className="text-sm text-[#5A4A38] whitespace-pre-wrap">{p.bio}</p>
            </Field>
          )}

          {p?.email && (
            <Field label={t('lessonDetail.contact')}>
              <a href={`mailto:${p.email}`} className="text-sm text-[#B0533A] hover:text-[#B0533A] break-all">
                {p.email}
              </a>
            </Field>
          )}

          {p?.phone && (
            <Field label={t('lessonDetail.phone')}>
              <a href={`tel:${p.phone}`} className="text-sm text-[#B0533A] hover:text-[#B0533A]">
                {p.phone}
              </a>
            </Field>
          )}

          {noInfo && !lesson.notes && (
            <p className="text-xs text-[#8A7556] italic">
              {isStudentView ? t('lessonDetail.noTutorInfo') : t('lessonDetail.noStudentInfo')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
