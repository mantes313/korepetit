'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '../../../app/lib/supabase';
import VideoCall from './VideoCall';

// Excalidraw touches `window` at import time and can't be SSR'd.
const CollabWhiteboard = dynamic(
  () => import('./CollabWhiteboard'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-[#8A7556] text-sm">Loading whiteboard…</div> },
);

export default function CallRoomPage({ lessonId }) {
  const { user, loading } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error: dbError } = await supabase
        .from('lessons')
        .select('id, student_id, teacher_id, status, subject, date, time')
        .eq('id', lessonId)
        .maybeSingle();
      if (cancelled) return;
      if (dbError) { setError(dbError.message); return; }
      if (!data) { setError('Lesson not found, or you do not have access.'); return; }
      setLesson(data);
    })();
    return () => { cancelled = true; };
  }, [lessonId, user]);

  if (loading || (!user && !error)) {
    return <div className="flex items-center justify-center h-full text-[#5A4A38] text-sm">Loading…</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm">
        <p className="text-[#7A3A33] mb-2">{error}</p>
        <Link href="/lessons" className="text-[#B0533A] hover:text-[#B0533A] underline">Back to lessons</Link>
      </div>
    );
  }
  if (!lesson) {
    return <div className="flex items-center justify-center h-full text-[#5A4A38] text-sm">Loading lesson…</div>;
  }

  const isParticipant = user.id === lesson.student_id || user.id === lesson.teacher_id;
  if (!isParticipant) {
    return (
      <div className="p-6 text-sm">
        <p className="text-[#7A3A33] mb-2">You are not a participant of this lesson.</p>
        <Link href="/lessons" className="text-[#B0533A] hover:text-[#B0533A] underline">Back to lessons</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF8]">
      <header className="flex items-center justify-between pl-14 pr-5 py-3 border-b border-[#EADFCB] bg-[#FFFDF8] shrink-0">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556]">Lesson Room</p>
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
