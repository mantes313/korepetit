'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getRoomAccess } from '@/lib/api/lessons';
import VideoCall from './VideoCall';

// Excalidraw touches `window` at import time and cannot be SSR'd.
const CollabWhiteboard = dynamic(() => import('./CollabWhiteboard'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-[#8A7556] text-sm">
      Loading whiteboard…
    </div>
  ),
});

const DENIED_COPY = {
  rejected: 'This lesson was cancelled.',
  not_accepted: 'This lesson has not been accepted yet.',
  too_early: 'The room opens 15 minutes before the lesson starts.',
  ended: 'This lesson has ended.',
};

/**
 * The room gate.
 *
 * Participation *and* the time window are decided by the server; this page
 * only renders the verdict. Previously it fetched the lesson row itself and
 * checked `user.id` against it client-side, and the time window lived purely
 * in the modal that linked here — so the URL was reachable at any time.
 */
export default function CallRoomPage({ lessonId }) {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    getRoomAccess(lessonId, { signal: controller.signal })
      .then(setAccess)
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err?.message ?? 'Could not open this lesson.');
      });

    return () => controller.abort();
  }, [lessonId, user]);

  if (loading || (!user && !error)) {
    return <Centered>Loading…</Centered>;
  }

  if (error) {
    return <RoomMessage text={error} />;
  }

  if (!access) {
    return <Centered>Loading lesson…</Centered>;
  }

  if (!access.allowed) {
    return <RoomMessage text={DENIED_COPY[access.reason] ?? 'You cannot join this lesson.'} />;
  }

  const { lesson } = access;

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF8]">
      <header className="flex items-center justify-between pl-14 pr-5 py-3 border-b border-[#EADFCB] bg-[#FFFDF8] shrink-0">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556]">
            Lesson Room
          </p>
          <h1 className="text-sm font-semibold text-[#2A1F14]">
            {lesson.subject ?? 'Lesson'} · {lesson.date} {lesson.time?.slice(0, 5)}
          </h1>
        </div>
        <Link
          href="/lessons"
          className="px-3 py-1.5 rounded-md bg-[#F4ECDF] border border-[#DCC9A8] text-[#2A1F14] text-xs hover:bg-[#F4D9D5] hover:text-[#7A3A33] transition-colors"
        >
          Leave
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[20%_1fr] flex-1 min-h-0">
        <div className="border-b md:border-b-0 md:border-r border-[#EADFCB] min-h-0 min-w-0">
          <VideoCall lessonId={lesson.id} userId={user.id} />
        </div>
        <div className="min-h-0 min-w-0">
          <CollabWhiteboard lessonId={lesson.id} userId={user.id} />
        </div>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="flex items-center justify-center h-full text-[#5A4A38] text-sm">
      {children}
    </div>
  );
}

function RoomMessage({ text }) {
  return (
    <div className="p-6 text-sm">
      <p className="text-[#7A3A33] mb-2">{text}</p>
      <Link href="/lessons" className="text-[#B0533A] hover:text-[#B0533A] underline">
        Back to lessons
      </Link>
    </div>
  );
}
