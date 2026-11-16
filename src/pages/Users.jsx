import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Shield, UserRoundCog } from 'lucide-react';
import { PageHeading } from '../components/Shell';
import { supabase } from '../lib/supabase';

const demoProfiles = [
  { id: 'demo-admin', display_name: 'Admin', email: 'admin@demo.local', role: 'admin', active: true },
  { id: 'demo-personel', display_name: 'Personel AMC', email: 'personel@demo.local', role: 'personel', active: true },
  { id: 'demo-pimpinan', display_name: 'Pimpinan', email: 'pimpinan@demo.local', role: 'pimpinan', active: true },
];

export default function Users({ app }) {
  const [profiles, setProfiles] = useState([]); const [error, setError] = useState(''); const [saving, setSaving] = useState('');
  const reload = useCallback(async () => {
    if (app.demo) { setProfiles(demoProfiles); return; }
    const { data, error: loadError } = await supabase.from('profiles').select('id,display_name,email,role,active').order('display_name');
    if (loadError) { setError(loadError.message); return; }
    setProfiles(data || []);
  }, [app.demo]);
  useEffect(() => { reload(); }, [reload]);
  const change = async (profile, updates) => {
    setSaving(profile.id); setError('');
    try {
      if (app.demo) { setProfiles(current => current.map(row => row.id === profile.id ? { ...row, ...updates } : row)); }
      else await app.updateProfile(profile.id, updates);
    } catch (error) { setError(error.message); }
    finally { setSaving(''); }
  };
  return <>
    <PageHeading eyebrow="AKSES & PERAN" title="Manajemen pengguna" description="Kelola peran dan status akses akun operasional." />
    {app.demo && <div className="inline-notice"><Shield size={17} /><span>Perubahan peran di sini hanya simulasi pratinjau dan tidak mengubah akun Supabase.</span></div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    <section className="panel users-panel"><div className="panel-heading"><div><span className="panel-kicker">AKUN TERDAFTAR</span><h2>{profiles.length} pengguna</h2></div><span className="panel-note">Buat akun Auth di Supabase Dashboard</span></div>
      <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Hak akses</th></tr></thead><tbody>{profiles.map(profile => <tr key={profile.id}><td><div className="user-cell"><span className="user-avatar">{(profile.display_name || profile.email || '?').slice(0,1).toUpperCase()}</span><div><strong>{profile.display_name || 'Nama belum diatur'}</strong><small>{profile.email || `ID ${profile.id.slice(0, 8)}…`}</small></div></div></td><td><select aria-label={`Peran ${profile.display_name}`} value={profile.role} onChange={event => change(profile, { role: event.target.value })} disabled={saving === profile.id || profile.id === app.profile.id}><option value="pimpinan">Pimpinan</option><option value="personel">Personel AMC</option><option value="admin">Admin</option></select></td><td><button className={`account-state ${profile.active ? 'account-active' : 'account-inactive'}`} onClick={() => change(profile, { active: !profile.active })} disabled={saving === profile.id || profile.id === app.profile.id}><i />{profile.active ? 'Aktif' : 'Nonaktif'}</button></td><td><span className="access-summary">{profile.role === 'pimpinan' ? 'Baca laporan & operasional' : profile.role === 'personel' ? 'Kelola data operasional' : 'Akses penuh & pengguna'}</span></td></tr>)}</tbody></table></div>
    </section>
    <div className="role-explainer"><div><span className="role-explainer-icon role-pimpinan"><BadgeCheck size={17} /></span><div><strong>Pimpinan</strong><p>Akses baca untuk ringkasan, log, laporan, dan surat masuk. Perubahan juga diblokir oleh RLS.</p></div></div><div><span className="role-explainer-icon role-personel"><UserRoundCog size={17} /></span><div><strong>Personel AMC</strong><p>Membaca dan mengelola data pergerakan serta surat masuk.</p></div></div><div><span className="role-explainer-icon role-admin"><Shield size={17} /></span><div><strong>Admin</strong><p>Seluruh hak personel serta pengelolaan peran dan status akun.</p></div></div></div>
  </>;
}

