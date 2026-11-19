import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SupportChatPanel({ app, adminTarget, onClose }) {
  const targetId = adminTarget?.id || app.profile.id;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const isAdmin = Boolean(adminTarget);

  const load = useCallback(async () => {
    if (app.demo) return;
    const { data, error: requestError } = await supabase.functions.invoke('support-chat', { body: { action: 'list', targetUserId: targetId } });
    if (requestError) { setError(requestError.message || 'Percakapan gagal dimuat.'); return; }
    setMessages(data?.messages || []);
    setError('');
  }, [app.demo, targetId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!supabase || app.demo) return undefined;
    const channel = supabase.channel(`support-thread-${targetId}-${app.profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${targetId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [app.demo, app.profile.id, load, targetId]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);
  useEffect(() => {
    const onEscape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [onClose]);

  const submit = async event => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setError('');
    const { error: sendError } = await supabase.functions.invoke('support-chat', { body: { action: 'send', targetUserId: targetId, body } });
    if (sendError) setError(sendError.message || 'Pesan gagal dikirim.');
    else { setDraft(''); await load(); }
    setBusy(false);
  };

  return <div className="support-chat-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="support-chat-panel" role="dialog" aria-modal="true" aria-labelledby="support-chat-title">
      <header className="support-chat-header"><span className="support-chat-icon"><MessageCircle size={18} /></span><div><strong id="support-chat-title">{isAdmin ? adminTarget.display_name || adminTarget.email : 'Bantuan Admin'}</strong><span>{isAdmin ? adminTarget.email : 'Pesan langsung ke tim administrator'}</span></div><button className="icon-button" onClick={onClose} aria-label="Tutup percakapan"><X size={19} /></button></header>
      {app.demo ? <div className="support-chat-empty">Chat bantuan tersedia saat akun tersambung ke layanan.</div> : <>
        <div className="support-chat-messages" ref={listRef} aria-live="polite">{messages.length === 0 ? <div className="support-chat-empty"><span className="support-chat-empty-mark"><MessageCircle size={20} /></span><strong>{isAdmin ? 'Mulai percakapan' : 'Ada yang bisa kami bantu?'}</strong><span>{isAdmin ? 'Kirim pesan langsung kepada pengguna ini.' : 'Kirim pertanyaan atau kendala. Pesan Anda akan diterima Admin.'}</span></div> : messages.map(message => {
          const own = message.sender_id === app.profile.id;
          return <article key={message.id} className={`support-message ${own ? 'support-message-own' : ''}`}><span>{own ? 'Anda' : isAdmin ? adminTarget.display_name : 'Admin AMC'}</span><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</time></article>;
        })}</div>
        {error && <div className="support-chat-error" role="alert">{error}</div>}
        <form className="support-chat-compose" onSubmit={submit}><textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tulis pesan…" rows="2" maxLength="2000" aria-label="Tulis pesan" /><button className="button-primary" disabled={busy || !draft.trim()} aria-label="Kirim pesan">{busy ? 'Mengirim…' : <><Send size={16} />Kirim</>}</button></form>
      </>}
    </section>
  </div>;
}
