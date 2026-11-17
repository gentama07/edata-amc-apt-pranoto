import { useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, FileText, MessageCircle, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import { airportDate, formatDateLong } from '../lib/time';
import { PageHeading } from '../components/Shell';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const pdfSnapshots = new WeakSet();

function correspondenceStatus(letter, allLetters, allMessages, demo) {
  if (letter.senderConfirmedAt && letter.recipientConfirmedAt) return 'Selesai';
  if (letter.direction === 'outbound') return demo || letter.driveFileId ? 'Terkirim' : 'Dalam proses';
  if (allLetters.some(item => item.replyToId === letter.id && (demo || item.driveFileId))) return 'Dibalas';
  if (allMessages.some(message => message.letter_id === letter.id)) return 'Dalam proses';
  return 'Baru';
}

async function preparePdf(file) {
  if (!file) throw new Error('Pilih berkas PDF terlebih dahulu.');
  if (!file.name.toLocaleLowerCase('id-ID').endsWith('.pdf')) throw new Error('Berkas harus berformat PDF.');
  if (!file.size || file.size > MAX_PDF_BYTES) throw new Error('Ukuran PDF harus antara 1 byte dan 10 MB.');
  if (pdfSnapshots.has(file)) return file;

  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch {
    throw new Error('PDF tidak dapat dibaca dari lokasi asal. Unduh atau simpan PDF ke perangkat, lalu pilih ulang berkasnya.');
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Isi berkas tidak terbaca sebagai PDF. Pilih berkas PDF yang benar.');

  // Copy the selected file into memory before releasing the browser file-picker reference.
  const snapshot = new File([bytes], file.name, { type: 'application/pdf', lastModified: file.lastModified });
  pdfSnapshots.add(snapshot);
  return snapshot;
}

function letterErrorMessage(error, fallback) {
  const message = String(error?.message || '');
  if (/requested file could not be read|permission problems? .*file/i.test(message)) {
    return 'PDF tidak dapat dibaca dari lokasi asal. Unduh atau simpan PDF ke perangkat, lalu pilih ulang berkasnya.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Koneksi ke layanan surat terputus. Periksa koneksi internet, lalu coba kirim lagi.';
  }
  if (/invalid jwt|jwt expired|session.*expired|sesi.*berakhir/i.test(message)) {
    return 'Sesi login sudah berakhir. Masuk kembali, lalu kirim surat lagi.';
  }
  if (/row-level security|permission denied|not authorized|unauthorized/i.test(message)) {
    return 'Supabase menolak pencatatan surat. Pastikan akun Ground Handling aktif dan perusahaan akun sudah ditetapkan Admin AMC.';
  }
  return message || fallback;
}

function driveErrorMessage(error) {
  const message = String(error?.message || 'Layanan Google Drive tidak memberi keterangan.');
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Koneksi ke layanan unggah terputus. Periksa internet, lalu tekan Kirim ke AMC lagi untuk melanjutkan.';
  }
  if (/401|invalid jwt|jwt expired|sesi login/i.test(message)) {
    return 'Sesi unggah berakhir. Masuk kembali, lalu tekan Kirim ke AMC lagi untuk mengunggah PDF.';
  }
  if (/403|permission denied|not authorized|unauthorized|akses.*ditolak/i.test(message)) {
    return 'Google Drive menolak akses unggah. Surat sudah tercatat, tetapi PDF belum tersimpan. Hubungi Admin AMC untuk memeriksa akses folder Drive.';
  }
  return `Surat sudah tercatat, tetapi PDF belum terkirim ke Google Drive. ${message} Tekan Kirim ke AMC lagi untuk mencoba ulang.`;
}

export default function Letters({ letters, messages, profile, canWrite, canReply, demo, onCreate, onReply, onMessage, onDelete, syncDrive, confirmLetterComplete, setError }) {
  const external = profile.role === 'ground_handling';
  const [adding, setAdding] = useState(false); const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(false); const [attachment, setAttachment] = useState(null);
  const [readingPdf, setReadingPdf] = useState(false);
  const [chatDraft, setChatDraft] = useState(''); const [replyFile, setReplyFile] = useState(null);
  const [pendingLetterId, setPendingLetterId] = useState(''); const [pendingReplyIds, setPendingReplyIds] = useState({});
  const [retryId, setRetryId] = useState(''); const retryInput = useRef(null);
  const [form, setForm] = useState({ reference: '', date: airportDate(), sender: profile.name || '', senderOrganization: profile.organization || '', subject: '', recipientRole: external ? 'amc' : 'ground_handling' });
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const roots = useMemo(() => letters.filter(letter => !letter.replyToId), [letters]);
  const selected = roots.find(letter => letter.id === activeId);
  const replies = selected ? letters.filter(letter => letter.replyToId === selected.id) : [];
  const threadMessages = selected ? messages.filter(message => message.letter_id === selected.id) : [];
  const thread = [...replies.map(row => ({ ...row, kind: 'letter', at: row.createdAt || row.date })), ...threadMessages.map(row => ({ ...row, kind: 'message', at: row.created_at }))].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const uploadFolder = profile.role === 'ground_handling' ? 'GROUND HANDLING' : profile.role === 'personel' ? 'PETUGAS AMC' : 'ADMIN/PIMPINAN';

  const choosePdf = async (event, saveFile) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setReadingPdf(true);
    setError('');
    try { saveFile(await preparePdf(file)); }
    catch (error) { saveFile(null); setError(letterErrorMessage(error, 'PDF gagal dibaca. Pilih ulang berkas dari perangkat.')); }
    finally { input.value = ''; setReadingPdf(false); }
  };

  const uploadPdf = async (file, letterId) => {
    const snapshot = await preparePdf(file);
    if (!demo) await syncDrive(snapshot, letterId);
  };

  const submit = async event => {
    event.preventDefault(); setError('');
    if (readingPdf) { setError('Tunggu sampai pemeriksaan PDF selesai.'); return; }
    if (!form.date) { setError('Tanggal surat wajib diisi.'); return; }
    if (!form.sender.trim() || !form.subject.trim() || (external && !attachment)) { setError(external ? 'Nama pengirim, perihal, dan berkas PDF wajib diisi.' : 'Pengirim dan perihal wajib diisi.'); return; }
    if (external && !profile.organization) { setError('Perusahaan akun belum diatur. Hubungi Admin AMC.'); return; }
    setBusy(true);
    let phase = 'database';
    try {
      const pdf = attachment ? await preparePdf(attachment) : null;
      const saved = pendingLetterId ? { id: pendingLetterId } : await onCreate({
        ...form,
        reference: form.reference.trim() || `GH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`,
        sender: form.sender.trim(), senderOrganization: external ? profile.organization : form.senderOrganization.trim() || form.sender.trim(),
        subject: form.subject.trim(), direction: external ? 'inbound' : 'outbound', recipientRole: external ? 'amc' : form.recipientRole,
        fileName: pdf?.name || '', requesterId: external ? profile.id : undefined,
      });
      if (pdf && !demo) {
        setPendingLetterId(saved.id);
        phase = 'drive';
        await uploadPdf(pdf, saved.id);
      }
      setForm({ reference: '', date: airportDate(), sender: external ? profile.name || '' : profile.name || '', senderOrganization: external ? profile.organization || '' : profile.organization || '', subject: '', recipientRole: external ? 'amc' : 'ground_handling' });
      setPendingLetterId(''); setAttachment(null); setAdding(false); setActiveId(saved.id);
    } catch (error) {
      setError(phase === 'drive'
        ? driveErrorMessage(error)
        : letterErrorMessage(error, 'Surat gagal dicatat. Periksa isian, lalu coba lagi.'));
    }
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
    event.preventDefault(); if (!selected || !replyFile || readingPdf) return;
    setBusy(true);
    try {
      const pdf = await preparePdf(replyFile);
      const saved = pendingReplyIds[selected.id] ? { id: pendingReplyIds[selected.id] } : await onReply(selected, { fileName: pdf.name, subject: `Balasan: ${selected.subject}` });
      if (!demo) setPendingReplyIds(current => ({ ...current, [selected.id]: saved.id }));
      if (!demo) await syncDrive(pdf, saved.id);
      setPendingReplyIds(current => { const next = { ...current }; delete next[selected.id]; return next; }); setReplyFile(null);
    } catch (error) { setError(letterErrorMessage(error, 'Surat balasan gagal dikirim. Coba unggah PDF kembali.')); }
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
    try { await uploadPdf(await preparePdf(file), retryId); }
    catch (error) { setError(letterErrorMessage(error, 'PDF gagal diunggah. Pilih ulang berkas lalu coba lagi.')); }
    finally { setBusy(false); setRetryId(''); event.target.value = ''; }
  };
  const completionSide = letter => {
    const sender = letter.createdById === profile.id || (letter.direction === 'inbound' && letter.requesterId === profile.id);
    if (sender) return 'sender';
    const role = letter.recipientRole;
    const recipient = role === 'pimpinan' ? profile.role === 'pimpinan'
      : role === 'ground_handling' ? profile.role === 'ground_handling'
        : role === 'amc' ? ['admin', 'personel'].includes(profile.role)
          : letter.direction === 'inbound' ? ['admin', 'personel', 'pimpinan'].includes(profile.role)
            : letter.requesterId === profile.id;
    return recipient ? 'recipient' : '';
  };
  const confirmComplete = async letter => {
    setBusy(true); setError('');
    try { await confirmLetterComplete(letter); }
    catch (error) { setError(error.message || 'Konfirmasi penyelesaian gagal disimpan.'); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeading title="Persuratan" description={external ? 'Kirim surat ke Admin atau Personel AMC dan pantau tindak lanjutnya.' : 'Kirim surat sesuai peran penerima, lalu ikuti balasan dan penyelesaiannya.'} action={(external || canWrite) && <button className="button-primary" onClick={() => setAdding(value => !value)}><Plus size={17} />Kirim surat</button>} />
    {demo && <div className="inline-notice"><FileText size={17} /><span>Pratinjau lokal: surat dan balasan hanya tersimpan di browser ini; Drive dan Supabase belum terhubung.</span></div>}
    {adding && <section className="panel letter-form-panel"><div className="panel-heading"><div><span className="panel-kicker">PENGIRIMAN SURAT</span><h2>Surat baru</h2></div><button className="close-form" onClick={() => setAdding(false)} aria-label="Tutup formulir"><X size={17} /></button></div>
      <form onSubmit={submit} noValidate><div className="form-grid form-grid-2">
        {!external && <label className="field"><span className="field-label">Nomor surat</span><input name="reference" value={form.reference} onChange={update} placeholder="Nomor surat dari pengirim" /></label>}
        <label className="field"><span className="field-label">Kirim kepada <span className="required-mark" aria-hidden="true">*</span></span>{external ? <input value="Admin / Personel AMC" readOnly aria-describedby="recipient-role-note" /> : <select name="recipientRole" value={form.recipientRole} onChange={update} required><option value="ground_handling">Ground Handling</option><option value="pimpinan">Pimpinan</option></select>}<small id="recipient-role-note" className="field-hint">{external ? 'Akun Ground Handling hanya dapat mengirim surat ke Admin atau Personel AMC.' : 'Surat ke Pimpinan hanya dapat dikirim oleh Admin atau Personel AMC.'}</small></label>
        <label className="field"><span className="field-label">Tanggal {external ? 'pengiriman' : 'diterima'} <span className="required-mark" aria-hidden="true">*</span></span><input type="date" name="date" value={form.date} onChange={update} required /></label>
        <label className="field"><span className="field-label">Nama pengirim <span className="required-mark" aria-hidden="true">*</span></span><input name="sender" value={form.sender} onChange={update} onFocus={event => { if (external && event.target.value === profile.name) event.target.select(); }} required placeholder="Nama orang yang mengirim" /></label>
        <label className="field"><span className="field-label">Perusahaan Ground Handling</span><input value={external ? profile.organization : form.senderOrganization} onChange={event => setForm(current => ({ ...current, senderOrganization: event.target.value }))} readOnly={external} required={external} placeholder="Pilih perusahaan pengirim" /></label>
        <label className="field field-full"><span className="field-label">Perihal surat <span className="required-mark" aria-hidden="true">*</span></span><input name="subject" value={form.subject} onChange={update} required placeholder="Tujuan atau ringkasan surat" /></label>
        <label className="field field-full"><span className="field-label">Lampiran PDF {external && <span className="required-mark">* wajib</span>}</span><input type="file" accept="application/pdf,.pdf" onChange={event => { void choosePdf(event, setAttachment); }} required={external} /><small className="field-hint">{readingPdf ? 'Memeriksa dan menyiapkan PDF…' : attachment ? `${attachment.name} · ${(attachment.size / 1024 / 1024).toFixed(1)} MB` : 'PDF maksimal 10 MB. Surat akan diarsipkan pada folder yang sesuai.'}</small></label>
      </div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setAdding(false)}>Batal</button><button className="button-primary" disabled={busy || readingPdf}><Send size={16} />{busy ? 'Mengirim…' : external ? 'Kirim ke AMC' : 'Simpan surat'}</button></div></form>
    </section>}
    <section className="panel letters-panel"><div className="panel-heading"><div><span className="panel-kicker">ARSIP & PELACAKAN</span><h2>{roots.length} surat tercatat</h2></div><span className="panel-note">{formatDateLong(airportDate())}</span></div>
      {roots.length ? <div className="letter-list">{roots.map(letter => {
        const status = correspondenceStatus(letter, letters, messages, demo);
        const tone = status === 'Selesai' || status === 'Dibalas' ? 'archived' : status === 'Dalam proses' ? 'followup' : 'new';
        return <article className={`letter-row correspondence-row ${activeId === letter.id ? 'letter-selected' : ''}`} key={letter.id}>
          <div className="letter-file-icon" aria-hidden="true">{letter.direction === 'outbound' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}</div>
          <button className="letter-main letter-open" onClick={() => setActiveId(activeId === letter.id ? '' : letter.id)} aria-expanded={activeId === letter.id}>
            <span className="letter-meta"><span>{letter.reference}</span><span aria-hidden="true">·</span><span>{letter.date}</span><span aria-hidden="true">·</span><span>{letter.senderOrganization || letter.sender}</span></span>
            <strong className="letter-subject">{letter.subject}</strong><span className="letter-sender">{letter.sender}</span>
            <span className="letter-fileline">{letter.fileName ? <span className="file-name"><FileText size={13} />{letter.fileName}</span> : <span className="no-file">Belum ada PDF</span>}{letter.driveFolder && <span className="drive-connected">Drive · {letter.driveFolder}</span>}</span>
          </button>
          <div className="letter-status-block" aria-label={`Status otomatis: ${status}`} title="Status dihitung dari surat balasan dan aktivitas percakapan.">
            <span className="letter-status-label">Status surat</span>
            <span className={`letter-status status-${tone}`}>{status}</span>
          </div>
          {canWrite && <button className="icon-button delete-letter" aria-label={`Hapus ${letter.reference}`} onClick={() => removeLetter(letter)}><Trash2 size={16} /></button>}
          {!letter.driveFileId && letter.fileName && <button className="button-secondary retry-letter-upload" onClick={() => { setRetryId(letter.id); retryInput.current?.click(); }} disabled={busy}><Upload size={14} />Lengkapi PDF</button>}
        </article>;
      })}</div> : <div className="letters-empty"><div className="letters-empty-icon"><FileText size={22} aria-hidden="true" /></div><div className="letters-empty-copy"><strong>{external ? 'Belum ada surat yang dikirim' : 'Belum ada surat masuk'}</strong><span>{external ? 'Surat yang Anda kirim dan balasan AMC tampil di sini.' : 'Surat dari Ground Handling akan tampil di sini.'}</span></div></div>}
    </section>
    {selected && <section className="panel correspondence-thread"><div className="panel-heading"><div><h2>{selected.subject}</h2><p>{selected.senderOrganization || selected.sender} · {selected.reference}</p></div><button className="close-form" onClick={() => setActiveId('')} aria-label="Tutup detail"><X size={17} /></button></div>
      <div className="completion-confirmations" aria-live="polite"><div><span>Pengirim</span><strong>{selected.senderConfirmedAt ? 'Sudah mengonfirmasi' : 'Menunggu konfirmasi'}</strong></div><div><span>Penerima</span><strong>{selected.recipientConfirmedAt ? 'Sudah mengonfirmasi' : 'Menunggu konfirmasi'}</strong></div>{completionSide(selected) && <button className="button-secondary" onClick={() => confirmComplete(selected)} disabled={busy || Boolean(selected[completionSide(selected) === 'sender' ? 'senderConfirmedAt' : 'recipientConfirmedAt'])}>{selected[completionSide(selected) === 'sender' ? 'senderConfirmedAt' : 'recipientConfirmedAt'] ? 'Konfirmasi Anda tersimpan' : 'Konfirmasi surat selesai'}</button>}</div>
      <div className="thread-body">
        <article className="thread-entry thread-original"><div className="thread-entry-heading"><strong>{selected.sender}</strong><time>{selected.date}</time></div><p>{selected.subject}</p>{selected.driveWebViewLink && <a href={selected.driveWebViewLink} target="_blank" rel="noreferrer">Buka PDF asli · Google Drive</a>}</article>
      {thread.map(entry => entry.kind === 'message' ? <article className={`thread-entry ${entry.sender_id === profile.id ? 'thread-own' : ''}`} key={`m-${entry.id}`}><div className="thread-entry-heading"><strong>{entry.sender_name || entry.sender || 'Petugas AMC'}</strong><time>{new Date(entry.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' })} WITA</time></div><p>{entry.body}</p></article> : <article className="thread-entry thread-reply" key={`r-${entry.id}`}><div className="thread-entry-heading"><strong>{entry.senderOrganization || entry.sender || 'AMC'} · surat balasan</strong><time>{entry.date}</time></div><p>{entry.fileName || entry.subject}</p>{entry.driveWebViewLink && <a href={entry.driveWebViewLink} target="_blank" rel="noreferrer">Buka PDF balasan · Google Drive</a>}</article>)}
        {thread.length === 0 && <p className="thread-empty">Belum ada balasan. Pesan baru akan muncul langsung di percakapan ini.</p>}
      </div>
      {canReply && <div className="thread-composer"><form className="thread-chat-form" onSubmit={sendChat}><label className="field">Balas melalui chat<textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} rows="2" maxLength="5000" placeholder="Tulis pesan untuk pengirim surat…" /></label><button className="button-primary" disabled={busy || !chatDraft.trim()}><MessageCircle size={16} />Kirim pesan</button></form>
        <form className="thread-file-form" onSubmit={sendReply}><label className="field">Balas dengan surat resmi (PDF)<input type="file" accept="application/pdf,.pdf" onChange={event => { void choosePdf(event, setReplyFile); }} /><small className="field-hint">{readingPdf ? 'Memeriksa dan menyiapkan PDF…' : replyFile?.name || `PDF maksimal 10 MB · folder ${uploadFolder}.`}</small></label><button className="button-secondary" disabled={busy || readingPdf || !replyFile}><Upload size={15} />{busy ? 'Mengirim…' : 'Kirim surat balasan'}</button></form>
      </div>}
      {external && <div className="thread-composer"><form className="thread-chat-form" onSubmit={sendChat}><label className="field">Balas melalui chat<textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} rows="2" maxLength="5000" placeholder="Tulis balasan atau pertanyaan…" /></label><button className="button-primary" disabled={busy || !chatDraft.trim()}><MessageCircle size={16} />Kirim pesan</button></form></div>}
      {canWrite && <p className="drive-delete-note"><Check size={14} /> Hapus surat hanya menghapus catatan dan percakapan di website; arsip Google Drive tetap tersedia.</p>}
    </section>}
    <input ref={retryInput} className="retry-file-input" type="file" accept="application/pdf,.pdf" onChange={retryUpload} aria-label="Pilih PDF untuk melengkapi unggahan" tabIndex={-1} />
  </>;
}


