'use client';

// 1:1 WebRTC video call using Supabase Realtime as the signaling channel.
// - Both peers subscribe to `lesson-call:<lessonId>` and announce themselves
//   via Realtime presence.
// - The peer with the lexicographically smaller userId initiates the offer;
//   the other one answers. This deterministic role split avoids the need for
//   full perfect-negotiation logic in a 2-party room.
// - SDP and ICE candidates flow as `signal` broadcasts addressed by `to`.
//
// Public STUN only — fine for most home networks but will fail behind
// symmetric NATs. Add a TURN server config later for reliability.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../app/lib/supabase';

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export default function VideoCall({ lessonId, userId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const peerIdRef = useRef(null);
  const pendingIceRef = useRef([]);

  const [streamReady, setStreamReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState('');

  // Acquire camera + mic once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setStreamReady(true);
      } catch (e) {
        setError(e?.message ?? 'Could not access camera or microphone.');
      }
    })();
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  // Open signaling channel + WebRTC peer connection once media is ready.
  useEffect(() => {
    if (!streamReady || !supabase || !lessonId || !userId) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    for (const track of localStreamRef.current.getTracks()) {
      pc.addTrack(track, localStreamRef.current);
    }

    pc.ontrack = (ev) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      setStatus('Connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setStatus('Connection failed');
      else if (pc.connectionState === 'disconnected') setStatus('Peer disconnected');
      else if (pc.connectionState === 'connected') setStatus('Connected');
    };

    const channel = supabase.channel(`lesson-call:${lessonId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const peer = peerIdRef.current;
      if (!peer) return;
      channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: userId, to: peer, kind: 'ice', data: ev.candidate.toJSON() },
      });
    };

    const startCallIfInitiator = async () => {
      const peer = peerIdRef.current;
      if (!peer) return;
      // Deterministic role: smaller userId offers; the other side answers.
      if (userId > peer) { setStatus('Waiting for offer…'); return; }
      if (pc.signalingState !== 'stable') return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: userId, to: peer, kind: 'offer', data: offer },
        });
        setStatus('Calling…');
      } catch (e) {
        setError(e?.message ?? 'Failed to start call.');
      }
    };

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.to !== userId) return;
        if (!peerIdRef.current) peerIdRef.current = payload.from;
        try {
          if (payload.kind === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            for (const c of pendingIceRef.current) await pc.addIceCandidate(c);
            pendingIceRef.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { from: userId, to: payload.from, kind: 'answer', data: answer },
            });
            setStatus('Answering…');
          } else if (payload.kind === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            for (const c of pendingIceRef.current) await pc.addIceCandidate(c);
            pendingIceRef.current = [];
          } else if (payload.kind === 'ice') {
            const cand = new RTCIceCandidate(payload.data);
            if (pc.remoteDescription) await pc.addIceCandidate(cand);
            else pendingIceRef.current.push(cand);
          }
        } catch (e) {
          setError(e?.message ?? 'Signaling error.');
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const peers = Object.keys(state).filter(k => k !== userId);
        if (peers.length > 0) {
          if (peerIdRef.current !== peers[0]) {
            peerIdRef.current = peers[0];
          }
          startCallIfInitiator();
        } else {
          peerIdRef.current = null;
          setStatus('Waiting for the other participant…');
        }
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({ userId });
        }
      });

    return () => {
      try { pc.getSenders().forEach(s => s.track && s.track.stop()); } catch {}
      pc.close();
      supabase.removeChannel(channel);
      channelRef.current = null;
      pcRef.current = null;
      peerIdRef.current = null;
      pendingIceRef.current = [];
    };
  }, [streamReady, lessonId, userId]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach(t => { t.enabled = !next; });
    setCamOff(next);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFDF8]">
      <div className="flex-1 flex flex-col gap-2 p-3 min-h-0 overflow-y-auto">
        <div className="relative bg-[#FFFDF8] rounded-lg overflow-hidden border border-[#EADFCB] w-full aspect-[4/3] shrink-0">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-[#5A4A38]">
            Peer · {status}
          </span>
        </div>
        <div className="relative bg-[#FFFDF8] rounded-lg overflow-hidden border border-[#EADFCB] w-full aspect-[4/3] shrink-0">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-[#5A4A38]">You</span>
        </div>
      </div>
      <div className="flex justify-center gap-2 p-3 border-t border-[#EADFCB]">
        <button
          onClick={toggleMute}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${muted ? 'bg-[#B85A4F] text-white hover:bg-[#B85A4F]/85' : 'bg-[#F4ECDF] border border-[#DCC9A8] text-[#2A1F14] hover:bg-[#EBDFC6]'}`}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={toggleCam}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${camOff ? 'bg-[#B85A4F] text-white hover:bg-[#B85A4F]/85' : 'bg-[#F4ECDF] border border-[#DCC9A8] text-[#2A1F14] hover:bg-[#EBDFC6]'}`}
        >
          {camOff ? 'Camera on' : 'Camera off'}
        </button>
      </div>
      {error && <p className="px-3 pb-3 text-xs text-[#7A3A33]">{error}</p>}
    </div>
  );
}
