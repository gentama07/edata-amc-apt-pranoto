import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { demoAccounts } from '../config/airportOptions';
import { isSupabaseConfigured } from '../lib/supabase';
import ServiceStatus from '../components/ServiceStatus';

function passwordResetError(message = '') {
  if (/redirect|url/i.test(message)) {
    return 'Tautan pemulihan belum dapat dikirim. Minta Admin memeriksa URL pengalihan pada konfigurasi Auth Supabase.';
  }
  if (/email.*invalid|invalid.*email/i.test(message)) {
    return 'Alamat email tidak dapat diproses. Periksa kembali formatnya atau hubungi Admin untuk memastikan alamat akun Anda.';
  }
  if (/rate|too many|security purposes/i.test(message)) {
    return 'Permintaan terlalu sering. Tunggu beberapa menit sebelum meminta tautan pemulihan lagi.';
  }
  return 'Tautan pemulihan belum dapat dikirim. Coba lagi beberapa saat atau hubungi Admin AMC.';
}

export default function Login({ app, portalMode = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [forgot, setForgot] = useState(false);
  const [tokenStep, setTokenStep] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (forgot) {
        if (tokenStep) {
          if (newPassword.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
          if (newPassword !== confirmPassword) throw new Error('Ulangan kata sandi belum sama.');
          await app.finishAdminPasswordRecovery(email, token, newPassword);
          setMessage({ type: 'success', text: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.' });
          setForgot(false); setTokenStep(false); setToken(''); setNewPassword(''); setConfirmPassword('');
        } else {
          const result = await app.requestPasswordReset(email);
          setTokenStep(result.stage === 'token_required');
          setMessage({ type: 'success', text: result.stage === 'token_required'
            ? 'Permintaan sebelumnya telah disetujui Admin. Masukkan token 6 digit yang diberikan Admin.'
            : 'Permintaan pemulihan tercatat. Hubungi Admin AMC di luar aplikasi untuk verifikasi. Setelah disetujui, ajukan lagi dengan email yang sama untuk memasukkan token.' });
        }
      } else {
        await app.signIn(email.trim(), password);
      }
    } catch (error) {
      const text = forgot && tokenStep
        ? error.message || 'Token tidak dapat diverifikasi. Coba lagi atau hubungi Admin AMC.'
        : forgot
        ? passwordResetError(error.message || '')
        : error.message || 'Permintaan gagal diproses. Coba lagi beberapa saat.';
      setMessage({ type: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-screen">
    <a className="skip-link" href="#login-form">Lewati ke formulir masuk</a>
    <section className="login-left" aria-labelledby="login-story-title">
      <div className="login-brand">
        <div className="apt-mark login-apt-mark"><img width="810" height="308" fetchPriority="high" src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="Bandar Udara A.P.T. Pranoto" /></div>
        <span>E-data AMC Aji Pangeran Tumenggung Pranoto Samarinda</span>
      </div>
      <div className="login-story" data-enter>
        <h1 id="login-story-title"><span>Operasional apron</span><em>APT Pranoto · Samarinda.</em></h1>
      </div>
        <div className="login-footnote"><ServiceStatus demo={app.demo} /></div>
    </section>

    <section className="login-right" aria-label="Akses akun">
      <div className="login-card" id="login-form" tabIndex="-1">
        <div className="login-card-icon"><LockKeyhole size={19} aria-hidden="true" /></div>
        <h2>{forgot ? 'Pulihkan akses akun' : 'Masuk ke E-data AMC'}</h2>
        <p className="login-subtitle">{forgot ? tokenStep ? 'Masukkan token dari Admin dan buat kata sandi baru.' : 'Ajukan pemulihan, lalu minta Admin memverifikasi identitas Anda secara langsung.' : 'Gunakan akun operasional yang diberikan Admin.'}</p>
        {app.demo && <div className="login-demo-banner"><ShieldCheck size={16} aria-hidden="true" /><div><strong>Mode Pratinjau Lokal aktif</strong><span>Supabase belum dikonfigurasi. Data pratinjau hanya tersimpan di browser ini.</span></div></div>}
        {app.error && <div className="login-error" role="alert">{app.error}</div>}
        {message && <div className={`login-feedback feedback-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}

        {isSupabaseConfigured && <form className="login-form" onSubmit={submit}>
          <label className="field">Email
            <input type="email" name="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" spellCheck="false" placeholder="nama@role.apt.id" />
          </label>
          {forgot && tokenStep && <>
            <label className="field">Token Admin (6 digit)<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
            <label className="field">Kata sandi baru<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required /></label>
            <label className="field">Ulangi kata sandi baru<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></label>
          </>}
          {!forgot && <label className="field">Kata sandi
            <input type="password" name="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Masukkan kata sandi" />
          </label>}
          <button className="button-primary login-submit" disabled={busy}>
            {busy ? (forgot ? 'Memproses…' : 'Memeriksa akun…') : forgot ? tokenStep ? 'Ubah kata sandi' : 'Ajukan pemulihan' : <>Masuk<ArrowRight size={16} aria-hidden="true" /></>}
          </button>
          {!forgot && <p className="login-security"><ShieldCheck size={14} aria-hidden="true" /> Akses akun dilindungi kebijakan peran dan database.</p>}
          <button type="button" className="text-link login-forgot" onClick={() => { setForgot(value => !value); setTokenStep(false); setToken(''); setNewPassword(''); setConfirmPassword(''); setMessage(null); }}>
            {forgot ? 'Kembali ke masuk' : 'Lupa kata sandi?'}
          </button>
        </form>}

        {app.demo && <div className="demo-role-section"><div className="demo-role-caption">MASUK SEBAGAI PERAN DEMO</div><div className="demo-role-list">{demoAccounts.map(account => <button key={account.role} onClick={() => app.signInDemo(account.role)} className="demo-role-button"><span className={`demo-role-avatar role-${account.role}`}>{account.label.slice(0, 1)}</span><span><strong>{account.label}</strong><small>{account.email}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div><small className="demo-password-note">Akun demo terisolasi · data contoh · tanpa kata sandi</small></div>}
        {!isSupabaseConfigured && <div className="login-config-note"><strong>Login produksi belum tersedia</strong><span>Mode ini hanya untuk pratinjau. Hubungi Admin AMC untuk mengaktifkan akses dan penyimpanan produksi.</span></div>}
        {portalMode && <a className="ground-handler-link" href={import.meta.env.BASE_URL}>Kembali ke masuk AMC</a>}
      </div>
    </section>
  </main>;
}


