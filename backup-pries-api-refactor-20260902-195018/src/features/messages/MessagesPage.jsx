'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import {
  listConversationPartners,
  listMessagesWith,
  sendMessage,
  markConversationRead,
  getProfileBrief,
} from '../../../app/lib/messages';

const POLL_MS = 5000;

function initialsOf(name) {
  return (name ?? '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatPreviewTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatStamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Avatar({ url, name, size = 40 }) {
  return (
    <div
      className="rounded-full bg-[#F4ECDF] border border-[#DCC9A8] overflow-hidden flex items-center justify-center text-[#5A4A38] text-xs font-medium shrink-0"
      style={{ width: size, height: size }}
    >
      {url
        ? <img src={url} alt={name ?? ''} className="w-full h-full object-cover" />
        : initialsOf(name)}
    </div>
  );
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialPartner = searchParams.get('with');

  const [partners, setPartners] = useState([]);
  const [partnersLoaded, setPartnersLoaded] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const scrollerRef = useRef(null);

  const refreshPartners = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listConversationPartners(user.id);
      setPartners(prev => {
        if (initialPartner && !list.some(p => p.id === initialPartner) && !prev.some(p => p.id === initialPartner)) {
          getProfileBrief(initialPartner).then(p => {
            if (p) setPartners(curr => curr.some(x => x.id === p.id) ? curr : [{ ...p, lastMessage: null, unread: 0 }, ...curr]);
          }).catch(() => {});
        }
        return list;
      });
    } catch (e) {
      setError(e.message ?? t('messages.failedLoadConvs'));
    } finally {
      setPartnersLoaded(true);
    }
  }, [user, initialPartner, t]);

  const refreshMessages = useCallback(async () => {
    if (!user || !activeId) return;
    try {
      const list = await listMessagesWith(user.id, activeId);
      setMessages(list);
      const hasUnread = list.some(m => m.receiver_id === user.id && !m.read_at);
      if (hasUnread) {
        markConversationRead(user.id, activeId).catch(() => {});
      }
    } catch (e) {
      setError(e.message ?? t('messages.failedLoadMessages'));
    }
  }, [user, activeId, t]);

  useEffect(() => { refreshPartners(); }, [refreshPartners]);

  useEffect(() => {
    if (!partnersLoaded) return;
    if (initialPartner) {
      setActiveId(initialPartner);
    } else if (!activeId && partners.length > 0) {
      setActiveId(partners[0].id);
    }
  }, [partnersLoaded, initialPartner, activeId, partners]);

  useEffect(() => {
    setMessages([]);
    if (activeId) refreshMessages();
  }, [activeId, refreshMessages]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      refreshMessages();
      refreshPartners();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [user, refreshMessages, refreshPartners]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeId]);

  const active = partners.find(p => p.id === activeId);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || !user || !activeId || sending) return;
    setSending(true);
    setError('');
    setDraft('');
    try {
      const msg = await sendMessage({ senderId: user.id, receiverId: activeId, body });
      setMessages(prev => [...prev, msg]);
      refreshPartners();
    } catch (err) {
      setDraft(body);
      const code = err?.code;
      if (code === '42501' || /row-level security/i.test(err?.message ?? '')) {
        setError(t('messages.rlsError'));
      } else {
        setError(err.message ?? t('messages.failedSend'));
      }
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Topbar crumbs={[t('messages.crumb')]} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-[#8A7556] uppercase tracking-widest mb-1">{t('messages.kicker')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2A1F14]">{t('messages.title')}</h1>
            <p className="text-[#8A7556] text-sm mt-1">{t('messages.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 mb-4 rounded-lg bg-[#F4D9D5] border border-[#E0A89F] text-[#7A3A33] text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[480px]">
          {/* Partner list */}
          <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#EADFCB]">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A7556]">{t('messages.listHeader')}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(authLoading || !partnersLoaded) ? (
                <div className="flex justify-center py-8">
                  <div className="w-4 h-4 rounded-full border-2 border-[#C8654A] border-t-transparent animate-spin" />
                </div>
              ) : partners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#8A7556]">
                  <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1"><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z"/></svg>
                  <p className="text-xs mt-2">{t('messages.noConversations')}</p>
                  <p className="text-[10px] mt-1">{t('messages.startHint')}</p>
                </div>
              ) : (
                <ul>
                  {partners.map(p => {
                    const isActive = p.id === activeId;
                    const last = p.lastMessage;
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => setActiveId(p.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 border-b border-[#EADFCB] text-left transition-colors ${isActive ? 'bg-[#F4ECDF]' : 'hover:bg-[#F7EFDF]'}`}
                        >
                          <Avatar url={p.photo_url} name={p.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-[#2A1F14] truncate">{p.name ?? t('messages.unknown')}</p>
                              <span className="text-[10px] font-mono text-[#8A7556] shrink-0">{formatPreviewTime(last?.created_at)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className="text-xs text-[#8A7556] truncate">
                                {last ? last.body : <span className="italic">{t('messages.noMessagesYetShort')}</span>}
                              </p>
                              {p.unread > 0 && (
                                <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#C8654A] text-white text-[10px] font-medium flex items-center justify-center">
                                  {p.unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Conversation pane */}
          <div className="bg-[#FFFDF8] rounded-xl border border-[#EADFCB] flex flex-col overflow-hidden">
            {!activeId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8A7556]">
                <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1"><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z"/></svg>
                <p className="text-sm mt-3">{t('messages.selectConversation')}</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#EADFCB] flex items-center gap-3">
                  <Avatar url={active?.photo_url} name={active?.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2A1F14] truncate">{active?.name ?? t('messages.unknown')}</p>
                    {active?.headline && <p className="text-[11px] text-[#8A7556] truncate">{active.headline}</p>}
                  </div>
                </div>

                <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#8A7556]">
                      <p className="text-sm">{t('messages.sayHi')}</p>
                    </div>
                  ) : (
                    messages.map(m => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${mine
                            ? 'bg-[#C8654A] text-white rounded-br-md'
                            : 'bg-[#F4ECDF] border border-[#EADFCB] text-[#2A1F14] rounded-bl-md'}`}>
                            <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`text-[10px] font-mono mt-1 ${mine ? 'text-white/70' : 'text-[#8A7556]'}`}>
                              {formatStamp(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="border-t border-[#EADFCB] p-3 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value.slice(0, 2000))}
                    onKeyDown={onKeyDown}
                    rows={2}
                    placeholder={t('messages.placeholder')}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#F4ECDF]/60 border border-[#DCC9A8] text-[#2A1F14] text-sm outline-none focus:border-[#C8654A] transition-colors resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="px-4 py-2.5 rounded-lg bg-[#C8654A] text-white text-sm font-medium hover:bg-[#B0533A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? t('messages.sending') : t('messages.send')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
