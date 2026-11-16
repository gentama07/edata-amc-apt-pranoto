import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export default function PasswordRecovery({ finishPasswordRecovery, invalid = false }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError('');
    if (password.length < 8) { setError('Kata sandi baru minimal 8 karakter.'); return; }
    if (password !== confirmation) { setError('Konfirmasi kata sandi belum sama.'); return; }
    setBusy(true);
    try { await finishPasswordRecovery(password); setSaved(true); }
    catch (reason) { setError(reason.message || 'Kata sandi gagal diperbarui.'); }
    finally { setBusy(false); }
  };
  return <main className="password-recovery-screen"><section className="panel password-recovery-card" aria-labelledby="recovery-title">
    <span className="login-card-icon"><LockKeyhole size={19} /></span>
    <span className="panel-kicker">PEMULIHAN AKUN</span><h1 id="recovery-title">{invalid ? 'Tautan tidak berlaku' : saved ? 'Kata sandi diperbarui' : 'Atur kata sandi baru'}</h1>
    {invalid ? <><p>Tautan pemulihan sudah kedaluwarsa, tidak valid, atau sesi pemulihannya tidak ditemukan. Minta tautan baru dari halaman masuk.</p><a className="button-primary recovery-return" href={import.meta.env.BASE_URL}>Kembali ke halaman masuk</a></> : null}
    {!invalid && (saved ? <><p>Kata sandi diperbarui. Silakan masuk menggunakan kata sandi baru.</p><a className="button-primary recovery-return" href={import.meta.env.BASE_URL}>Kembali ke masuk</a></> : <form onSubmit={submit}>
      <label className="field">Kata sandi baru<input type="password" name="new-password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <label className="field">Ulangi kata sandi<input type="password" name="confirm-password" autoComplete="new-password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi baru'}</button>
    </form>)}
  </section></main>;
}

