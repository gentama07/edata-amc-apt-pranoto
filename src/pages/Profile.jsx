import { useRef, useState } from 'react';
import { Camera, KeyRound, Save, UserRound } from 'lucide-react';
import { PageHeading } from '../components/Shell';
import ChangePasswordModal from '../components/ChangePasswordModal';

const roleNames = { admin: 'Admin', personel: 'Personel AMC', pimpinan: 'Pimpinan', ground_handling: 'Ground Handling' };

export default function Profile({ app }) {
  const { profile, demo, updateOwnProfile, uploadProfilePhoto, changePassword, setError } = app;
  const [name, setName] = useState(profile.name || '');
  const [nip, setNip] = useState(profile.nip || '');
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const photoInput = useRef(null);
  const hasNip = ['personel', 'pimpinan'].includes(profile.role);

  const saveProfile = async event => {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) { setError('Nama minimal 2 karakter.'); return; }
    if (hasNip && nip.trim() && !/^\d{18}$/.test(nip.trim())) { setError('NIP harus terdiri dari 18 angka.'); return; }
    setSaving(true);
    try { await updateOwnProfile({ name, nip: hasNip ? nip : '' }); }
    catch (error) { setError(error.message || 'Profil gagal disimpan.'); }
    finally { setSaving(false); }
  };

  const selectPhoto = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    try { await uploadProfilePhoto(file); }
    catch (error) { setError(error.message || 'Foto profil gagal disimpan.'); }
  };

  return <>
    <PageHeading title="Profil" description="Perbarui identitas dan foto profil akun Anda." />
    <section className="profile-layout">
      <form className="panel profile-card" onSubmit={saveProfile}>
        <div className="profile-photo-section">
          <div className="profile-photo-frame">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`Foto profil ${profile.name}`} /> : <UserRound size={34} aria-hidden="true" />}
          </div>
          <div className="profile-photo-copy"><strong>Foto profil</strong><span>JPG, PNG, atau WebP · maksimal 5 MB</span>
            <button className="button-secondary" type="button" onClick={() => photoInput.current?.click()}><Camera size={15} />Pilih foto</button>
            <input ref={photoInput} className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} aria-label="Pilih foto profil" />
          </div>
        </div>
        <div className="profile-fields">
          <label className="field"><span className="field-label">Nama</span><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} /></label>
          <label className="field"><span className="field-label">Peran</span><input value={roleNames[profile.role] || profile.role} readOnly disabled aria-describedby="profile-role-note" /><small id="profile-role-note" className="field-hint">Peran ditetapkan oleh Admin.</small></label>
          {profile.role === 'ground_handling' && <label className="field"><span className="field-label">Perusahaan</span><input value={profile.organization || 'Belum ditetapkan'} readOnly disabled aria-describedby="profile-company-note" /><small id="profile-company-note" className="field-hint">Perusahaan ditetapkan oleh Admin.</small></label>}
          {hasNip && <label className="field"><span className="field-label">NIP</span><input value={nip} onChange={event => setNip(event.target.value.replace(/\D/g, '').slice(0, 18))} inputMode="numeric" autoComplete="off" maxLength={18} placeholder="18 angka" /></label>}
          <label className="field"><span className="field-label">Email akun</span><input value={profile.email || ''} readOnly disabled /></label>
        </div>
        <div className="profile-actions"><button className="button-primary" disabled={saving}><Save size={15} />{saving ? 'Menyimpan…' : 'Simpan profil'}</button><button className="button-secondary" type="button" onClick={() => setPasswordOpen(true)}><KeyRound size={15} />Ubah kata sandi</button></div>
        {demo && <p className="profile-demo-note">Perubahan profil pada mode pratinjau hanya berlaku selama sesi browser ini.</p>}
      </form>
    </section>
    {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} changePassword={changePassword} />}
  </>;
}

