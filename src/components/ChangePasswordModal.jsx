import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

export default function ChangePasswordModal({ onClose, changePassword }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const close = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const submit = async event => {
    event.preventDefault(); setError('');
    if (newPassword.length < 8) { setError('Kata sandi baru minimal 8 karakter.'); return; }
    if (newPassword !== confirmation) { setError('Konfirmasi kata sandi belum sama.'); return; }
    setBusy(true);
    try { await changePassword(oldPassword, newPassword); setSaved(true); }
    catch (reason) { setError(reason.message || 'Kata sandi gagal diperbarui.'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="confirm-modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <button className="password-modal-close" type="button" onClick={onClose} aria-label="Tutup"><X size={17} /></button>
      <span className="login-card-icon"><KeyRound size={18} /></span>
      <h2 id="password-title">Ubah kata sandi</h2>
      {saved ? <><p>Kata sandi akun Anda sudah diperbarui.</p><div className="modal-actions"><button className="button-primary" onClick={onClose}>Selesai</button></div></> : <form onSubmit={submit}>
        <label className="field">Kata sandi lama<input type="password" value={oldPassword} onChange={event => setOldPassword(event.target.value)} autoComplete="current-password" required /></label>
        <label className="field">Kata sandi baru<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label className="field">Ulangi kata sandi baru<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <div className="modal-actions"><button className="button-secondary" type="button" onClick={onClose}>Batal</button><button className="button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</button></div>
      </form>}
    </section>
  </div>;
}

