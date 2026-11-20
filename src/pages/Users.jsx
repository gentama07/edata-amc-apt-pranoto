import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Check, KeyRound, MessageCircle, Pause, Plus, RefreshCw, Search, Shield, UserRound, X } from 'lucide-react';
import { PageHeading } from '../components/Shell';
import { airportOptions } from '../config/airportOptions';
import { supabase } from '../lib/supabase';
import SupportChatPanel from '../components/SupportChatPanel';
import { checkServiceHealth, getServiceHistory, getServiceSnapshot, subscribeServiceHealth } from '../lib/serviceMonitor';

const demoProfiles = [
  { id: 'demo-admin', display_name: 'Admin', email: 'admin@demo.local', role: 'admin', active: true },
  { id: 'demo-personel', display_name: 'Personel AMC', email: 'personel@demo.local', role: 'personel', active: true },
  { id: 'demo-pimpinan', display_name: 'Kepala Bandara', email: 'pimpinan@demo.local', role: 'pimpinan', active: true },
  { id: 'demo-ground', display_name: 'Ground Handling · Gapura', email: 'gapura@demo.local', role: 'ground_handling', organization: 'Gapura Angkasa', active: true },
];
const initialForm = { displayName: '', email: '', password: '', role: 'personel', organization: '' };

export default function Users({ app }) {
  const [profiles, setProfiles] = useState([]); const [error, setError] = useState(''); const [saving, setSaving] = useState('');
  const [form, setForm] = useState(initialForm); const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(app.profile.email || ''); const [emailState, setEmailState] = useState('');
  const [recoveries, setRecoveries] = useState([]); const [recoveryBusy, setRecoveryBusy] = useState(''); const [issuedToken, setIssuedToken] = useState(null);
  const [query, setQuery] = useState(''); const [chatProfile, setChatProfile] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(() => app.demo ? { status: 'demo', message: 'Pemeriksaan tidak berjalan pada pratinjau lokal.' } : getServiceSnapshot());
  const [serviceHistory, setServiceHistory] = useState(getServiceHistory);
  const [serviceChecking, setServiceChecking] = useState(false);
  const [serviceLogFocused, setServiceLogFocused] = useState(false);
  const reload = useCallback(async () => {
    if (app.demo) { setProfiles(demoProfiles); return; }
    const { data, error: loadError } = await supabase.from('profiles').select('id,display_name,email,role,active,organization').order('display_name');
    if (loadError) { setError(loadError.message); return; }
    setProfiles(data || []);
  }, [app.demo]);
  useEffect(() => { reload(); }, [reload]);
  const reloadRecoveries = useCallback(async () => {
    if (app.demo) return;
    const { data, error: requestError } = await supabase.functions.invoke('account-recovery', { body: { action: 'list' } });
    if (requestError) { setError(requestError.message || 'Permintaan pemulihan gagal dimuat.'); return; }
    setRecoveries(data?.requests || []);
  }, [app.demo]);
  useEffect(() => { reloadRecoveries(); }, [reloadRecoveries]);
  useEffect(() => {
    const unsubscribe = subscribeServiceHealth(snapshot => {
      setServiceHealth(snapshot);
      setServiceHistory(snapshot.history || getServiceHistory());
    });
    return unsubscribe;
  }, []);
  const consumeNotificationTarget = useCallback(target => {
    if (target.type === 'service_status') {
      localStorage.removeItem('amc-admin-notification-target');
      setServiceLogFocused(true);
      window.setTimeout(() => document.getElementById('service-status-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
      window.setTimeout(() => setServiceLogFocused(false), 2600);
    }
    if (target.type === 'support_message' && profiles.length) {
      const profile = profiles.find(row => row.id === target.userId);
      if (profile) { setChatProfile(profile); localStorage.removeItem('amc-admin-notification-target'); }
    }
    if (target.type === 'account_recovery' && recoveries.length) {
      window.setTimeout(() => document.querySelector(`[data-recovery-id="${CSS.escape(target.referenceId || '')}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      localStorage.removeItem('amc-admin-notification-target');
    }
  }, [profiles, recoveries]);
  useEffect(() => {
    const openTarget = event => consumeNotificationTarget(event.detail || {});
    window.addEventListener('amc-admin-notification-open', openTarget);
    const raw = localStorage.getItem('amc-admin-notification-target');
    if (raw) {
      try { consumeNotificationTarget(JSON.parse(raw)); }
      catch { localStorage.removeItem('amc-admin-notification-target'); }
    }
    return () => window.removeEventListener('amc-admin-notification-open', openTarget);
  }, [consumeNotificationTarget]);
  const filteredProfiles = useMemo(() => profiles.filter(profile => `${profile.display_name} ${profile.email} ${profile.organization || ''} ${profile.role}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const activeCount = profiles.filter(profile => profile.active).length;
  const checkServiceNow = async () => {
    if (serviceChecking || app.demo) return;
    setServiceChecking(true);
    try { await checkServiceHealth(); }
    finally { setServiceChecking(false); }
  };

  const processRecovery = async (request, action) => {
    setRecoveryBusy(request.id); setError(''); setIssuedToken(null);
    try {
      const { data, error: actionError } = await supabase.functions.invoke('account-recovery', { body: { action, requestId: request.id } });
      if (actionError) throw actionError;
      if (data?.token) setIssuedToken({ token: data.token, expiresAt: data.expiresAt, email: request.profile?.email });
      await reloadRecoveries();
    } catch (reason) { setError(reason.message || 'Permintaan pemulihan gagal diproses.'); }
    finally { setRecoveryBusy(''); }
  };

  const change = async (profile, updates) => {
    setSaving(profile.id); setError('');
    try {
      if (app.demo) setProfiles(current => current.map(row => row.id === profile.id ? { ...row, ...updates } : row));
      else { await app.updateProfile(profile.id, updates); await reload(); }
    } catch (reason) { setError(reason.message); }
    finally { setSaving(''); }
  };
  const toggleAccess = profile => {
    if (profile.active && !window.confirm(`Jeda sementara akses ${profile.display_name || profile.email}? Pengguna akan keluar dari akun dan tidak bisa membuka fitur sampai diaktifkan kembali.`)) return;
    change(profile, { active: !profile.active });
  };
  const create = async event => {
    event.preventDefault(); setError(''); setSaving('create');
    try {
      if (app.demo) throw new Error('Buat akun sebenarnya setelah menghubungkan Supabase.');
      await app.manageUser({ action: 'create', ...form });
      setForm(initialForm); setCreateOpen(false); await reload();
    } catch (reason) { setError(reason.message || 'Akun gagal dibuat.'); }
    finally { setSaving(''); }
  };
  const updateOwnEmail = async event => {
    event.preventDefault(); setEmailState('');
    try { await app.updateProfile(app.profile.id, { email: newEmail }); setEmailState('Email akun berhasil diperbarui.'); }
    catch (reason) { setEmailState(reason.message || 'Email gagal diperbarui.'); }
  };

  return <>
    <PageHeading eyebrow="AKSES & PERAN" title="Manajemen pengguna" description="Buat akun, atur peran, perusahaan, dan status akses." action={!app.demo && <button className="button-primary" onClick={() => setCreateOpen(value => !value)}><Plus size={17} />Buat akun</button>} />
    {app.demo && <div className="inline-notice"><Shield size={17} /><span>Pratinjau lokal: akun dan perubahan peran di bawah ini hanya contoh.</span></div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    <section id="service-status-log" className={`panel service-monitor-panel ${serviceLogFocused ? 'service-monitor-focused' : ''}`} aria-labelledby="service-monitor-title">
      <div className="panel-heading service-monitor-heading"><div><span className="panel-kicker">PEMANTAU LAYANAN</span><h2 id="service-monitor-title">Status & riwayat layanan</h2><p>Pemeriksaan otomatis tiap 30 detik selama aplikasi terbuka.</p></div>{!app.demo && <button className="button-secondary" onClick={checkServiceNow} disabled={serviceChecking}><RefreshCw size={15} className={serviceChecking ? 'service-refreshing' : ''} />{serviceChecking ? 'Memeriksa…' : 'Periksa sekarang'}</button>}</div>
      <div className={`service-monitor-current service-monitor-${serviceHealth.status}`}>
        <span className="service-monitor-mark"><Activity size={18} /></span>
        <div><strong>{app.demo ? 'Pratinjau lokal' : serviceHealth.status === 'online' ? 'Layanan data aktif' : serviceHealth.status === 'checking' ? 'Memeriksa layanan' : 'Layanan sulit dijangkau'}</strong><p>{serviceHealth.message}</p><small>{serviceHealth.checkedAt ? `Pemeriksaan terakhir ${new Date(serviceHealth.checkedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' })} WITA` : 'Menunggu pemeriksaan pertama.'}</small></div>
      </div>
      <div className="service-log-heading"><h3>Riwayat pemeriksaan</h3><span>{serviceHistory.length} catatan</span></div>
      {serviceHistory.length ? <ol className="service-log-list">{serviceHistory.map(event => <li key={event.id} className={`service-log-entry service-log-${event.status}`}><span className="service-log-mark"><Activity size={14} /></span><div><strong>{event.title}</strong><p>{event.message}</p><time>{new Date(event.checkedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' })} WITA</time></div></li>)}</ol> : <div className="service-log-empty">Belum ada catatan. Pemantau akan menyimpan pemeriksaan pertama saat terhubung.</div>}
      <div className="service-monitor-footnote">Pemantau tidak membuka data profil. Catatan dan notifikasi status tersimpan di browser ini; perubahan akses atau kredensial tetap memerlukan tindakan Admin.</div>
    </section>
    {createOpen && <section className="panel user-create-panel"><div className="panel-heading"><div><span className="panel-kicker">AKUN BARU</span><h2>Buat akses operasional</h2></div></div><form onSubmit={create}><div className="form-grid form-grid-2">
      <label className="field">Nama pengguna<input value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} required /></label>
      <label className="field">Email<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required /></label>
      <label className="field">Kata sandi awal<input type="password" minLength="12" maxLength="72" autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} required /><small className="field-hint">12–72 karakter. Pengguna bisa menggantinya setelah masuk.</small></label>
      <label className="field">Peran<select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value, organization: event.target.value === 'ground_handling' ? current.organization || airportOptions.handlers[0] : '' }))}><option value="personel">Personel AMC</option><option value="pimpinan">Pimpinan</option><option value="ground_handling">Ground Handling</option><option value="admin">Admin</option></select></label>
      {form.role === 'ground_handling' && <label className="field">Perusahaan<select value={form.organization} onChange={event => setForm(current => ({ ...current, organization: event.target.value }))} required>{airportOptions.handlers.map(name => <option key={name}>{name}</option>)}</select></label>}
    </div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setCreateOpen(false)}>Batal</button><button className="button-primary" disabled={saving === 'create'}>{saving === 'create' ? 'Membuat…' : 'Buat akun'}</button></div></form></section>}
    {!app.demo && <section className="panel recovery-admin-panel"><div className="panel-heading"><div><span className="panel-kicker">VERIFIKASI MANUAL</span><h2>Pemulihan akun</h2><p>Pastikan identitas pemohon melalui jalur resmi sebelum menyetujui. Token hanya tampil sekali dan berlaku 15 menit.</p></div><button className="button-secondary" onClick={reloadRecoveries} disabled={Boolean(recoveryBusy)}><RefreshCw size={15} />Perbarui</button></div>
      {issuedToken && <div className="recovery-token-callout" role="status"><KeyRound size={18} /><div><strong>Token untuk {issuedToken.email}</strong><code>{issuedToken.token}</code><span>Berlaku sampai {new Date(issuedToken.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. Sampaikan token ini langsung kepada pemilik akun.</span></div><button className="button-secondary" onClick={() => navigator.clipboard?.writeText(issuedToken.token)}>Salin token</button></div>}
      {recoveries.length === 0 ? <div className="recovery-empty">Belum ada riwayat permintaan pemulihan.</div> : <div className="recovery-request-list">{recoveries.map(request => <article className="recovery-request" data-recovery-id={request.id} key={request.id}><div className="recovery-request-person"><strong>{request.profile?.display_name || 'Nama belum diatur'}</strong><span>{request.profile?.email || 'Akun tidak ditemukan'} · {request.profile?.role || '—'}</span></div><span className={`recovery-state recovery-${request.status}`}>{({ pending: 'Menunggu Admin', approved: 'Disetujui', resetting: 'Sedang diproses', completed: 'Selesai', rejected: 'Ditolak', expired: 'Kedaluwarsa', locked: 'Terkunci' })[request.status] || request.status}</span><small>{new Date(request.last_requested_at).toLocaleString('id-ID')} · {request.request_count} pengajuan</small>{request.status === 'pending' && <div className="recovery-actions"><button className="button-primary" onClick={() => processRecovery(request, 'approve')} disabled={Boolean(recoveryBusy)}><Check size={15} />{recoveryBusy === request.id ? 'Memproses…' : 'Setujui & buat token'}</button><button className="button-secondary" onClick={() => processRecovery(request, 'reject')} disabled={Boolean(recoveryBusy)}><X size={15} />Tolak</button></div>}</article>)}</div>}
    </section>}
    <section className="panel user-create-panel"><div className="panel-heading"><div><span className="panel-kicker">EMAIL ADMIN</span><h2>Alamat akun Anda</h2></div></div><form className="own-email-form" onSubmit={updateOwnEmail}><label className="field">Email baru<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></label><button className="button-secondary">Simpan email</button>{emailState && <span role="status">{emailState}</span>}</form></section>
    <section className="panel users-panel"><div className="panel-heading users-panel-heading"><div><span className="panel-kicker">AKUN TERDAFTAR</span><h2>{profiles.length} pengguna <span className="users-count-detail">· {activeCount} aktif</span></h2></div><label className="users-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, email, atau perusahaan" aria-label="Cari pengguna" /></label></div>
      <div className="user-card-list">{filteredProfiles.map(profile => <article className={`managed-user-card ${profile.active ? '' : 'managed-user-paused'}`} key={profile.id}>
        <div className="managed-user-identity"><span className="user-avatar"><UserRound size={18} /></span><div className="user-details"><strong>{profile.display_name || 'Nama belum diatur'}</strong><small>{profile.email || `ID ${profile.id.slice(0, 8)}…`}</small><span className={`managed-user-state ${profile.active ? 'state-enabled' : 'state-paused'}`}><i />{profile.active ? 'Akun aktif' : 'Akses dijeda sementara'}</span></div></div>
        <label className="managed-field"><span>Peran</span><select aria-label={`Peran ${profile.display_name}`} value={profile.role} onChange={event => change(profile, { role: event.target.value, ...(event.target.value === 'ground_handling' ? { organization: profile.organization || airportOptions.handlers[0] } : {}) })} disabled={app.demo || saving === profile.id || profile.id === app.profile.id}><option value="pimpinan">Pimpinan</option><option value="personel">Personel AMC</option><option value="admin">Admin</option><option value="ground_handling">Ground Handling</option></select></label>
        <label className="managed-field"><span>Perusahaan</span>{profile.role === 'ground_handling' ? <select aria-label={`Perusahaan ${profile.display_name}`} value={profile.organization || ''} onChange={event => change(profile, { organization: event.target.value })} disabled={app.demo || saving === profile.id}>{airportOptions.handlers.map(name => <option key={name}>{name}</option>)}</select> : <span className="managed-company">—</span>}</label>
        <div className="managed-user-access"><span>Hak akses</span><small>{profile.role === 'ground_handling' ? 'Kirim & lacak surat sendiri' : profile.role === 'pimpinan' ? 'Baca dan balas persuratan' : profile.role === 'personel' ? 'Kelola data dan surat' : 'Kelola akses & operasional'}</small></div>
        <div className="managed-user-actions">{!app.demo && profile.id !== app.profile.id && <><button className="button-secondary user-chat-action" onClick={() => setChatProfile(profile)}><MessageCircle size={15} />Chat</button><button className={profile.active ? 'button-secondary' : 'button-primary'} onClick={() => toggleAccess(profile)} disabled={saving === profile.id}>{profile.active ? <><Pause size={15} />Jeda akun</> : <><Check size={15} />Aktifkan</>}</button></>}</div>
      </article>)}{filteredProfiles.length === 0 && <div className="users-no-results">Tidak ada akun yang cocok dengan “{query}”.</div>}</div>
    </section>
    {chatProfile && <SupportChatPanel app={app} adminTarget={chatProfile} onClose={() => setChatProfile(null)} />}
  </>;
}



