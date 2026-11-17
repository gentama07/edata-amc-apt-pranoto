import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Plus, RefreshCw, Shield, X } from 'lucide-react';
import { PageHeading } from '../components/Shell';
import { airportOptions } from '../config/airportOptions';
import { supabase } from '../lib/supabase';

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
    {createOpen && <section className="panel user-create-panel"><div className="panel-heading"><div><span className="panel-kicker">AKUN BARU</span><h2>Buat akses operasional</h2></div></div><form onSubmit={create}><div className="form-grid form-grid-2">
      <label className="field">Nama pengguna<input value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} required /></label>
      <label className="field">Email<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required /></label>
      <label className="field">Kata sandi awal<input type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} required /><small className="field-hint">Minimal 8 karakter. Pengguna bisa menggantinya setelah masuk.</small></label>
      <label className="field">Peran<select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value, organization: event.target.value === 'ground_handling' ? current.organization || airportOptions.handlers[0] : '' }))}><option value="personel">Personel AMC</option><option value="pimpinan">Pimpinan</option><option value="ground_handling">Ground Handling</option><option value="admin">Admin</option></select></label>
      {form.role === 'ground_handling' && <label className="field">Perusahaan<select value={form.organization} onChange={event => setForm(current => ({ ...current, organization: event.target.value }))} required>{airportOptions.handlers.map(name => <option key={name}>{name}</option>)}</select></label>}
    </div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setCreateOpen(false)}>Batal</button><button className="button-primary" disabled={saving === 'create'}>{saving === 'create' ? 'Membuat…' : 'Buat akun'}</button></div></form></section>}
    {!app.demo && <section className="panel recovery-admin-panel"><div className="panel-heading"><div><span className="panel-kicker">VERIFIKASI MANUAL</span><h2>Pemulihan akun</h2><p>Pastikan identitas pemohon melalui jalur resmi sebelum menyetujui. Token hanya tampil sekali dan berlaku 15 menit.</p></div><button className="button-secondary" onClick={reloadRecoveries} disabled={Boolean(recoveryBusy)}><RefreshCw size={15} />Perbarui</button></div>
      {issuedToken && <div className="recovery-token-callout" role="status"><KeyRound size={18} /><div><strong>Token untuk {issuedToken.email}</strong><code>{issuedToken.token}</code><span>Berlaku sampai {new Date(issuedToken.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. Sampaikan token ini langsung kepada pemilik akun.</span></div><button className="button-secondary" onClick={() => navigator.clipboard?.writeText(issuedToken.token)}>Salin token</button></div>}
      {recoveries.length === 0 ? <div className="recovery-empty">Belum ada riwayat permintaan pemulihan.</div> : <div className="recovery-request-list">{recoveries.map(request => <article className="recovery-request" key={request.id}><div className="recovery-request-person"><strong>{request.profile?.display_name || 'Nama belum diatur'}</strong><span>{request.profile?.email || 'Akun tidak ditemukan'} · {request.profile?.role || '—'}</span></div><span className={`recovery-state recovery-${request.status}`}>{({ pending: 'Menunggu Admin', approved: 'Disetujui', resetting: 'Sedang diproses', completed: 'Selesai', rejected: 'Ditolak', expired: 'Kedaluwarsa', locked: 'Terkunci' })[request.status] || request.status}</span><small>{new Date(request.last_requested_at).toLocaleString('id-ID')} · {request.request_count} pengajuan</small>{request.status === 'pending' && <div className="recovery-actions"><button className="button-primary" onClick={() => processRecovery(request, 'approve')} disabled={Boolean(recoveryBusy)}><Check size={15} />{recoveryBusy === request.id ? 'Memproses…' : 'Setujui & buat token'}</button><button className="button-secondary" onClick={() => processRecovery(request, 'reject')} disabled={Boolean(recoveryBusy)}><X size={15} />Tolak</button></div>}</article>)}</div>}
    </section>}
    <section className="panel user-create-panel"><div className="panel-heading"><div><span className="panel-kicker">EMAIL ADMIN</span><h2>Alamat akun Anda</h2></div></div><form className="own-email-form" onSubmit={updateOwnEmail}><label className="field">Email baru<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></label><button className="button-secondary">Simpan email</button>{emailState && <span role="status">{emailState}</span>}</form></section>
    <section className="panel users-panel"><div className="panel-heading"><div><span className="panel-kicker">AKUN TERDAFTAR</span><h2>{profiles.length} pengguna</h2></div><span className="panel-note">Email akun dikonfirmasi oleh Admin</span></div>
      <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Pengguna</th><th>Peran</th><th>Perusahaan</th><th>Status</th><th>Hak akses</th></tr></thead><tbody>{profiles.map(profile => <tr key={profile.id}><td><div className="user-cell"><span className="user-avatar">{(profile.display_name || profile.email || '?').slice(0,1).toUpperCase()}</span><div className="user-details"><strong>{profile.display_name || 'Nama belum diatur'}</strong><small>{profile.email || `ID ${profile.id.slice(0, 8)}…`}</small></div></div></td><td><select aria-label={`Peran ${profile.display_name}`} value={profile.role} onChange={event => change(profile, { role: event.target.value, ...(event.target.value === 'ground_handling' ? { organization: profile.organization || airportOptions.handlers[0] } : {}) })} disabled={app.demo || saving === profile.id || profile.id === app.profile.id}><option value="pimpinan">Pimpinan</option><option value="personel">Personel AMC</option><option value="admin">Admin</option><option value="ground_handling">Ground Handling</option></select></td><td>{profile.role === 'ground_handling' ? <select aria-label={`Perusahaan ${profile.display_name}`} value={profile.organization || ''} onChange={event => change(profile, { organization: event.target.value })} disabled={app.demo || saving === profile.id}>{airportOptions.handlers.map(name => <option key={name}>{name}</option>)}</select> : <span className="panel-note">—</span>}</td><td><button className={`account-state ${profile.active ? 'account-active' : 'account-inactive'}`} onClick={() => change(profile, { active: !profile.active })} disabled={app.demo || saving === profile.id || profile.id === app.profile.id}><i />{profile.active ? 'Aktif' : 'Nonaktif'}</button></td><td><span className="access-summary">{profile.role === 'ground_handling' ? 'Kirim & lacak surat sendiri' : profile.role === 'pimpinan' ? 'Baca dan balas persuratan' : profile.role === 'personel' ? 'Kelola data dan surat' : 'Kelola akses & operasional'}</span></td></tr>)}</tbody></table></div>
    </section>
  </>;
}



