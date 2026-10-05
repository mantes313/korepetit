'use client';

// Collaborative whiteboard powered by Excalidraw + Supabase Realtime.
// - Each scene change broadcasts the full element set on a separate channel
//   (`lesson-board:<lessonId>`). Full-snapshot sync is fine for typical
//   lesson-sized boards and avoids Excalidraw's reconciler complexity.
// - Echo prevention uses Excalidraw's `getSceneVersion`: we never re-broadcast
//   a version we just applied from a peer.
// - On subscribe we ask any existing peer for their current scene so a late
//   joiner sees what was already drawn.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw, getSceneVersion } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '../../../app/lib/supabase';

const THROTTLE_MS = 80;

export default function CollabWhiteboard({ lessonId, userId }) {
  const [api, setApi] = useState(null);
  const apiRef = useRef(null);
  const channelRef = useRef(null);

  // Echo guard: last scene version we either broadcast or applied from a peer.
  const lastSeenVersionRef = useRef(0);

  // Throttle bookkeeping for outgoing scene broadcasts.
  const throttleRef = useRef({ lastSent: 0, timer: null, queued: null });

  useEffect(() => { apiRef.current = api; }, [api]);

  const sendScene = useCallback((elements) => {
    const channel = channelRef.current;
    if (!channel) return;
    const version = getSceneVersion(elements);
    lastSeenVersionRef.current = version;
    channel.send({
      type: 'broadcast',
      event: 'scene',
      payload: { from: userId, version, elements },
    });
  }, [userId]);

  const broadcast = useCallback((elements) => {
    const t = throttleRef.current;
    const now = Date.now();
    const elapsed = now - t.lastSent;
    if (elapsed >= THROTTLE_MS) {
      t.lastSent = now;
      t.queued = null;
      if (t.timer) { clearTimeout(t.timer); t.timer = null; }
      sendScene(elements);
    } else {
      t.queued = elements;
      if (!t.timer) {
        t.timer = setTimeout(() => {
          const queued = t.queued;
          t.lastSent = Date.now();
          t.queued = null;
          t.timer = null;
          if (queued) sendScene(queued);
        }, THROTTLE_MS - elapsed);
      }
    }
  }, [sendScene]);

  useEffect(() => {
    if (!supabase || !lessonId) return;
    const channel = supabase.channel(`lesson-board:${lessonId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'scene' }, ({ payload }) => {
        const a = apiRef.current;
        if (!a || !payload || payload.from === userId) return;
        if (payload.version <= lastSeenVersionRef.current) return;
        lastSeenVersionRef.current = payload.version;
        a.updateScene({ elements: payload.elements });
      })
      .on('broadcast', { event: 'request-state' }, ({ payload }) => {
        const a = apiRef.current;
        if (!a || !payload || payload.from === userId) return;
        const elements = a.getSceneElements();
        if (!elements?.length) return;
        const version = getSceneVersion(elements);
        channel.send({
          type: 'broadcast',
          event: 'scene',
          payload: { from: userId, version, elements },
        });
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          // Ask any peers for the current board so we don't start blank.
          channel.send({
            type: 'broadcast',
            event: 'request-state',
            payload: { from: userId },
          });
        }
      });

    return () => {
      const t = throttleRef.current;
      if (t.timer) clearTimeout(t.timer);
      t.timer = null;
      t.queued = null;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [lessonId, userId]);

  const onChange = useCallback((elements) => {
    const version = getSceneVersion(elements);
    if (version === lastSeenVersionRef.current) return;
    lastSeenVersionRef.current = version;
    broadcast(elements);
  }, [broadcast]);

  const handleClear = () => {
    const a = apiRef.current;
    if (!a) return;
    a.updateScene({ elements: [] });
    sendScene([]);
  };

  return (
    <div className="relative w-full h-full">
      <button
        onClick={handleClear}
        className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md bg-[#F4ECDF] border border-[#DCC9A8] text-[#2A1F14] text-xs hover:bg-[#F4D9D5] hover:text-[#7A3A33] hover:border-[#E0A89F] transition-colors"
      >
        Clear board
      </button>
      <Excalidraw
        excalidrawAPI={setApi}
        onChange={onChange}
        theme="dark"
        UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false } }}
      />
    </div>
  );
}
