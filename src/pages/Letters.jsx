import { useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, FileText, MessageCircle, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import { airportDate, formatDateLong } from '../lib/time';
import { PageHeading } from '../components/Shell';

const statusOptions = ['Baru', 'Dalam proses', 'Menunggu balasan', 'Dibalas', 'Selesai', 'Diarsipkan'];
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function Letters({ letters, messages, profile, canWrite, canReply, demo, onCreate, onReply, onMessage, onDelete, onUpdate, syncDrive, setError }) {
  const external = profile.role === 'ground_handling';
  const [adding, setAdding] = useState(false); const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(false); const [attachment, setAttachment] = useState(null);
  const [chatDraft, setChatDraft] = useState(''); const [replyFile, setReplyFile] = useState(null);
  const [retryId, setRetryId] = useState(''); const retryInput = useRef(null);
  const [form, setForm] = useState({ reference: '', date: airportDate(), sender: profile.name || '', senderOrganization: profile.organization || '', subject: '', status: 'Baru' });
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const roots = useMemo(() => letters.filter(letter => !letter.replyToId), [letters]);
  const selected = roots.find(letter => letter.id === activeId);
  const replies = selected ? letters.filter(letter => letter.replyToId === selected.id) : [];
  const threadMessages = selected ? messages.filter(message => message.letter_id === selected.id) : [];
  const thread = [...replies.map(row => ({ ...row, kind: 'letter', at: row.createdAt || row.date })), ...threadMessages.map(row => ({ ...row, kind: 'message', at: row.created_at }))].sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const uploadPdf = async (file, letterId) => {
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > MAX_PDF_BYTES) throw new Error('Lampiran wajib PDF dan maksimal 10 MB.');
    if (!demo) await syncDrive(file, letterId);
  };

  const submit = async event => {
    event.preventDefault(); setError('');
    if (!form.sender.trim() || !form.subject.trim() || (external && !attachment)) { setError(external ? 'Nama pengirim, perihal, dan berkas PDF wajib diisi.' : 'Pengirim dan perihal wajib diisi.'); return; }
    if (external && !profile.organization) { setError('Perusahaan akun belum diatur. Hubungi Admin AMC.'); return; }
    setBusy(true);
    try {
      const saved = await onCreate({
        ...form,
        reference: form.reference.trim() || `GH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`,
        sender: form.sender.trim(), senderOrganization: external ? profile.organization : form.senderOrganization.trim() || form.sender.trim(),
        subject: form.subject.trim(), direction: 'inbound', status: 'Baru',
        fileName: attachment?.name || '', requesterId: external ? profile.id : undefined,
      });
      if (attachment && !demo) await uploadPdf(attachment, saved.id);
      setForm({ reference: '', date: airportDate(), sender: external ? profile.name || '' : '', senderOrganization: external ? profile.organization || '' : '', subject: '', status: 'Baru' });
      setAttachment(null); setAdding(false); setActiveId(saved.id);
    } catch (error) { setError(error.message || 'Surat gagal dikirim.'); }
    finally { setBusy(false); }
  };

  const sendChat = async event => {
    event.preventDefault(); if (!chatDraft.trim() || !selected) return;
    setBusy(true);
    try { await onMessage(selected.id, chatDraft); setChatDraft(''); }
    catch (error) { setError(error.message || 'Balasan gagal dikirim.'); }
    finally { setBusy(false); }
  };

  const sendReply = async event => {
    event.preventDefault(); if (!selected || !replyFile) return;
    setBusy(true);
    try {
      if (replyFile.type !== 'application/pdf' || replyFile.size > MAX_PDF_BYTES) throw new Error('Surat balasan wajib PDF dan maksimal 10 MB.');
      const saved = await onReply(selected, { fileName: replyFile.name, subject: `Balasan: ${selected.subject}` });
      if (!demo) await syncDrive(replyFile, saved.id);
      setReplyFile(null);
    } catch (error) { setError(error.message || 'Surat balasan gagal dikirim.'); }
    finally { setBusy(false); }
  };

  const removeLetter = async letter => {
    if (!window.confirm(`Hapus surat “${letter.subject}” dari Persuratan? Berkas di Google Drive tetap tersimpan.`)) return;
    try { await onDelete(letter.id); setActiveId(''); }
    catch (error) { setError(error.message || 'Surat gagal dihapus.'); }
  };
  const retryUpload = async event => {
    const file = event.target.files?.[0]; if (!file || !retryId) return;
    setBusy(true);
    try { await uploadPdf(file, retryId); }
    catch (error) { setError(error.message || 'PDF gagal diunggah.'); }
    finally { setBusy(false); setRetryId(''); event.target.value = ''; }
  };

  return <>
    <PageHeading eyebrow={external ? 'PORTAL GROUND HANDLING' : 'TATA USAHA & DOKUMEN'} title="Persuratan" description={external ? 'Kirim surat kepada AMC dan pantau perkembangan serta balasannya.' : 'Surat, lampiran, dan balasan antara AMC dan Ground Handling.'} action={(external || canWrite) && <button className="button-primary" onClick={() => setAdding(value => !value)}><Plus size={17} />{external ? 'Kirim surat' : 'Catat surat'}</button>} />
    {demo && <div className="inline-notice"><FileText size={17} /><span>Pratinjau lokal: surat dan balasan hanya tersimpan di browser ini; Drive dan Supabase belum terhubung.</span></div>}
    {adding && <section className="panel letter-form-panel"><div className="panel-heading"><div><span className="panel-kicker">{external ? 'PENGIRIMAN KE AMC' : 'PENCATATAN SURAT'}</span><h2>{external ? 'Surat baru' : 'Catat surat masuk'}</h2></div><button className="close-form" onClick={() => setAdding(false)} aria-label="Tutup formulir"><X size={17} /></button></div>
      <form onSubmit={submit}><div className="form-grid form-grid-2">
        {!external && <label className="field">Nomor surat<input name="reference" value={form.reference} onChange={update} placeholder="Nomor surat dari pengirim" /></label>}
        <label className="field">Tanggal {external ? 'pengiriman' : 'diterima'}<input type="date" name="date" value={form.date} onChange={update} required /></label>
        <label className="field">Nama pengirim<input name="sender" value={form.sender} onChange={update} onFocus={event => { if (external && event.target.value === profile.name) event.target.select(); }} required placeholder="Nama orang yang mengirim" /></label>
        <label className="field">Perusahaan Ground Handling<input value={external ? profile.organization : form.senderOrganization} onChange={event => setForm(current => ({ ...current, senderOrganization: event.target.value }))} readOnly={external} required={external} placeholder="Pilih perusahaan pengirim" /></label>
        <label className="field field-full">Perihal surat<input name="subject" value={form.subject} onChange={update} required placeholder="Tujuan atau ringkasan surat" /></label>
        <label className="field field-full">Lampiran PDF {external && <span className="required-mark">* wajib</span>}<input type="file" accept="application/pdf,.pdf" onChange={event => setAttachment(event.target.files?.[0] || null)} required={external} /><small className="field-hint">{attachment ? `${attachment.name} · ${(attachment.size / 1024 / 1024).toFixed(1)} MB` : 'PDF maksimal 10 MB. Surat akan diarsipkan pada folder yang sesuai.'}</small></label>
      </div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setAdding(false)}>Batal</button><button className="button-primary" disabled={busy}><Send size={16} />{busy ? 'Mengirim…' : external ? 'Kirim ke AMC' : 'Simpan surat'}</button></div></form>
    </section>}
    <section className="panel letters-panel"><div className="panel-heading"><div><span className="panel-kicker">ARSIP & PELACAKAN</span><h2>{roots.length} surat tercatat</h2></div><span className="panel-note">{formatDateLong(airportDate())}</span></div>
      {roots.length ? <div className="letter-list">{roots.map(letter => <article className={`letter-row correspondence-row ${activeId === letter.id ? 'letter-selected' : ''}`} key={letter.id}>
        <div className="letter-file-icon">{letter.direction === 'outbound' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}</div>
        <button className="letter-main letter-open" onClick={() => setActiveId(activeId === letter.id ? '' : letter.id)} aria-expanded={activeId === letter.id}>
          <span className="letter-meta"><span>{letter.reference}</span><span>{letter.date}</span><span>{letter.senderOrganization || letter.sender}</span></span>
          <strong className="letter-subject">{letter.subject}</strong><span className="letter-sender">{letter.sender}</span>
          <span className="letter-fileline">{letter.fileName ? <span className="file-name"><FileText size={13} />{letter.fileName}</span> : <span className="no-file">Belum ada PDF</span>}{letter.driveFolder && <span className="drive-connected">Drive · {letter.driveFolder}</span>}</span>
        </button>
        {canWrite ? <label className="letter-status-control">Status<select aria-label={`Status ${letter.reference}`} value={letter.status} onChange={event => onUpdate(letter.id, { status: event.target.value }).catch(error => setError(error.message))}>{statusOptions.map(status => <option key={status}>{status}</option>)}</select></label> : <span className={`letter-status status-${letter.status === 'Selesai' || letter.status === 'Diarsipkan' ? 'archived' : letter.status === 'Baru' ? 'new' : 'followup'}`}>{letter.status}</span>}
        {canWrite && <button className="icon-button delete-letter" aria-label={`Hapus ${letter.reference}`} onClick={() => removeLetter(letter)}><Trash2 size={16} /></button>}
        {!letter.driveFileId && letter.fileName && <button className="button-secondary retry-letter-upload" onClick={() => { setRetryId(letter.id); retryInput.current?.click(); }} disabled={busy}><Upload size={14} />Lengkapi PDF</button>}
      </article>)}</div> : <div className="letters-empty"><div><FileText size={22} /></div><strong>{external ? 'Belum ada surat yang dikirim' : 'Belum ada surat masuk'}</strong><span>{external ? 'Surat yang Anda kirim dan balasan AMC tampil di sini.' : 'Surat dari Ground Handling akan tampil di sini.'}</span></div>}
    </section>
    {selected && <section className="panel correspondence-thread"><div className="panel-heading"><div><span className="panel-kicker">RIWAYAT SURAT</span><h2>{selected.subject}</h2><p>{selected.senderOrganization || selected.sender} · {selected.reference}</p></div><button className="close-form" onClick={() => setActiveId('')} aria-label="Tutup detail"><X size={17} /></button></div>
      <div className="thread-body">
        <article className="thread-entry thread-original"><div className="thread-entry-heading"><strong>{selected.sender}</strong><time>{selected.date}</time></div><p>{selected.subject}</p>{selected.driveWebViewLink && <a href={selected.driveWebViewLink} target="_blank" rel="noreferrer">Buka PDF asli · Google Drive</a>}</article>
        {thread.map(entry => entry.kind === 'message' ? <article className={`thread-entry ${entry.sender_id === profile.id ? 'thread-own' : ''}`} key={`m-${entry.id}`}><div className="thread-entry-heading"><strong>{entry.sender_id === profile.id ? 'Anda' : 'AMC'}</strong><time>{new Date(entry.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' })} WITA</time></div><p>{entry.body}</p></article> : <article className="thread-entry thread-reply" key={`r-${entry.id}`}><div className="thread-entry-heading"><strong>Surat balasan AMC</strong><time>{entry.date}</time></div><p>{entry.fileName || entry.subject}</p>{entry.driveWebViewLink && <a href={entry.driveWebViewLink} target="_blank" rel="noreferrer">Buka PDF balasan · Google Drive</a>}</article>)}
        {thread.length === 0 && <p className="thread-empty">Belum ada balasan. Pesan baru akan muncul langsung di percakapan ini.</p>}
      </div>
      {canReply && <div className="thread-composer"><form className="thread-chat-form" onSubmit={sendChat}><label className="field">Balas melalui chat<textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} rows="2" maxLength="5000" placeholder="Tulis pesan untuk pengirim surat…" /></label><button className="button-primary" disabled={busy || !chatDraft.trim()}><MessageCircle size={16} />Kirim pesan</button></form>
        <form className="thread-file-form" onSubmit={sendReply}><label className="field">Balas dengan surat resmi (PDF)<input type="file" accept="application/pdf,.pdf" onChange={event => setReplyFile(event.target.files?.[0] || null)} /><small className="field-hint">{replyFile?.name || 'PDF maksimal 10 MB akan dikirim ke folder GROUND HANDLING.'}</small></label><button className="button-secondary" disabled={busy || !replyFile}><Upload size={15} />{busy ? 'Mengirim…' : 'Kirim surat balasan'}</button></form>
      </div>}
      {external && <div className="thread-composer"><form className="thread-chat-form" onSubmit={sendChat}><label className="field">Balas melalui chat<textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} rows="2" maxLength="5000" placeholder="Tulis balasan atau pertanyaan…" /></label><button className="button-primary" disabled={busy || !chatDraft.trim()}><MessageCircle size={16} />Kirim pesan</button></form></div>}
      {canWrite && <p className="drive-delete-note"><Check size={14} /> Hapus surat hanya menghapus catatan dan percakapan di website; arsip Google Drive tetap tersedia.</p>}
    </section>}
    <input ref={retryInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={retryUpload} aria-label="Pilih PDF untuk melengkapi unggahan" />
  </>;
}

