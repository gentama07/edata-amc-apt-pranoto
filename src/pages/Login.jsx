import { useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
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

export default function Login({ app, portalMode = false, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [forgot, setForgot] = useState(false);
  const [useRecoveryToken, setUseRecoveryToken] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (forgot) {
        if (useRecoveryToken) {
          if (password.length < 12 || password.length > 72) throw new Error('Kata sandi baru harus 12–72 karakter.');
          if (password !== confirmPassword) throw new Error('Konfirmasi kata sandi belum sama.');
          await app.finishAdminPasswordRecovery(email, recoveryToken, password);
          setForgot(false);
          setUseRecoveryToken(false);
          setPassword(''); setConfirmPassword(''); setRecoveryToken('');
          setMessage({ type: 'success', text: 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.' });
        } else {
          const result = await app.requestPasswordReset(email);
          if (result?.stage === 'token_required') {
            setUseRecoveryToken(true);
            setMessage({ type: 'success', text: 'Permintaan pemulihan sudah disetujui. Masukkan token 6 digit dari Admin dan buat kata sandi baru.' });
          } else {
            setMessage({ type: 'success', text: 'Permintaan diterima. Setelah Admin menyetujui, pilih “Sudah memiliki token?” untuk menyelesaikan pemulihan.' });
          }
        }
      } else {
        await app.signIn(email.trim(), password);
      }
    } catch (error) {
      const text = forgot && !useRecoveryToken
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
      <video className="login-left-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true" tabIndex={-1}>
        <source src={`${import.meta.env.BASE_URL}assets/left-side-login-page-animation.mp4`} type="video/mp4" />
      </video>
      <div className="login-brand">
        <div className="apt-mark login-apt-mark"><img width="810" height="308" fetchPriority="high" src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="Bandar Udara A.P.T. Pranoto" /></div>
        <span>E-data AMC Aji Pangeran Tumenggung Pranoto Samarinda</span>
      </div>
      <div className="login-story" data-enter>
        <h1 id="login-story-title"><span className="login-headline-line">Operasional apron</span><em className="login-headline-line">APT Pranoto · Samarinda.</em></h1>
        <p className="login-story-copy">Pencatatan pergerakan dan pemantauan aktivitas harian Apron Movement Control Bandar Udara A.P.T. Pranoto.</p>
      </div>
        <div className="login-footnote"><ServiceStatus demo={app.demo} /></div>
    </section>

    <section className="login-right" aria-label="Akses akun">
      <div className="login-card" id="login-form" tabIndex="-1">
        {onBack && <button type="button" className="login-home-link" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /><span>Kembali ke beranda</span></button>}
        <h2>{forgot ? 'Pulihkan akses akun' : 'Masuk ke E-data AMC'}</h2>
        {forgot && <p className="login-subtitle">{useRecoveryToken ? 'Masukkan token 6 digit dari Admin dan buat kata sandi baru. Token berlaku selama 15 menit.' : 'Ajukan pemulihan akun. Setelah disetujui Admin, masukkan token untuk membuat kata sandi baru.'}</p>}
        {app.demo && <div className="login-demo-banner"><ShieldCheck size={16} aria-hidden="true" /><div><strong>Mode Pratinjau Lokal aktif</strong><span>Supabase belum dikonfigurasi. Data pratinjau hanya tersimpan di browser ini.</span></div></div>}
        {app.error && <div className="login-error" role="alert">{app.error}</div>}
        {message && <div className={`login-feedback feedback-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}

        {isSupabaseConfigured && <form className="login-form" onSubmit={submit}>
          <label className="field">Email
            <input type="email" name="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" spellCheck="false" placeholder="nama@role.apt.id" />
          </label>
          {forgot && useRecoveryToken && <label className="field">Token pemulihan
            <input type="text" name="recovery-token" value={recoveryToken} onChange={event => setRecoveryToken(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" pattern="[0-9]{6}" minLength="6" maxLength="6" autoComplete="one-time-code" placeholder="Masukkan 6 digit token" />
          </label>}
          {!forgot && <label className="field">Kata sandi
            <input type="password" name="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Masukkan kata sandi" />
          </label>}
          {forgot && useRecoveryToken && <>
            <label className="field">Kata sandi baru
              <input type="password" name="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength="12" maxLength="72" autoComplete="new-password" placeholder="Gunakan 12–72 karakter" />
            </label>
            <label className="field">Konfirmasi kata sandi baru
              <input type="password" name="confirm-new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength="12" maxLength="72" autoComplete="new-password" placeholder="Ulangi kata sandi baru" />
            </label>
          </>}
          <button className="button-primary login-submit" disabled={busy}>
            {busy ? (forgot ? useRecoveryToken ? 'Memeriksa token…' : 'Mengirim permintaan…' : 'Memeriksa akun…') : forgot ? useRecoveryToken ? 'Atur ulang kata sandi' : 'Kirim permintaan pemulihan' : <>Masuk<ArrowRight size={16} aria-hidden="true" /></>}
          </button>
          {!forgot && <p className="login-security"><ShieldCheck size={14} aria-hidden="true" /> Akses akun dilindungi kebijakan peran dan database.</p>}
          <button type="button" className="text-link login-forgot" onClick={() => {
            setMessage(null);
            if (forgot && useRecoveryToken) { setUseRecoveryToken(false); setPassword(''); setConfirmPassword(''); setRecoveryToken(''); }
            else if (forgot) { setForgot(false); setUseRecoveryToken(false); setPassword(''); setConfirmPassword(''); setRecoveryToken(''); }
            else { setForgot(true); setUseRecoveryToken(false); }
          }}>
            {forgot ? useRecoveryToken ? 'Kembali ke permintaan pemulihan' : 'Sudah memiliki token?' : 'Lupa kata sandi?'}
          </button>
        </form>}

        {app.demo && <div className="demo-role-section"><div className="demo-role-caption">MASUK SEBAGAI PERAN DEMO</div><div className="demo-role-list">{demoAccounts.map(account => <button key={account.role} onClick={() => app.signInDemo(account.role)} className="demo-role-button"><span className={`demo-role-avatar role-${account.role}`}>{account.label.slice(0, 1)}</span><span><strong>{account.label}</strong><small>{account.email}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div><small className="demo-password-note">Akun demo terisolasi · data contoh · tanpa kata sandi</small></div>}
        {!isSupabaseConfigured && <div className="login-config-note"><strong>Login produksi belum tersedia</strong><span>Mode ini hanya untuk pratinjau. Hubungi Admin AMC untuk mengaktifkan akses dan penyimpanan produksi.</span></div>}
        {portalMode && <a className="ground-handler-link" href={import.meta.env.BASE_URL}>Kembali ke masuk AMC</a>}
      </div>
    </section>
  </main>;
}

