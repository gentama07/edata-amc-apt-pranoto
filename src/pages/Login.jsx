import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { demoAccounts } from '../config/airportOptions';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Login({ app }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async event => { event.preventDefault(); setBusy(true); setMessage(''); try { await app.signIn(email, password); } catch (error) { setMessage(error.message || 'Email atau kata sandi tidak valid.'); } finally { setBusy(false); } };
  return <main className="login-screen">
    <a className="skip-link" href="#login-form">Lewati ke formulir masuk</a>
    <div className="login-left"><div className="login-brand"><div className="apt-mark"><img width="100" height="48" src={`${import.meta.env.BASE_URL}assets/logo-apt.svg`} alt="Logo Bandar Udara A.P.T. Pranoto" /></div><div className="amc-mark"><img width="64" height="64" src={`${import.meta.env.BASE_URL}assets/logo-amc.png`} alt="Logo Apron Movement Control" /></div><span>E-data AMC</span></div><div className="login-story"><div className="eyebrow">AAP · WALS · SAMARINDA</div><h1>Operasional apron<br /><em>dalam satu pandangan.</em></h1><p>Pencatatan pergerakan dan pemantauan aktivitas harian Apron Movement Control Bandar Udara A.P.T. Pranoto.</p></div><div className="login-footnote"><span><i /> SISTEM OPERASIONAL AMC</span><span>WITA · ASIA/MAKASSAR</span></div></div>
    <div className="login-right"><div className="login-card" id="login-form" tabIndex="-1"><div className="login-card-icon"><LockKeyhole size={19} /></div><span className="panel-kicker">AKSES PERSONEL</span><h2>Masuk ke E-data AMC</h2><p className="login-subtitle">Gunakan akun operasional yang diberikan Admin.</p>
      {app.demo && <div className="login-demo-banner"><ShieldCheck size={16} /><div><strong>Mode Pratinjau Lokal aktif</strong><span>{isSupabaseConfigured ? 'Pilih peran demo untuk memeriksa alur antarmuka.' : 'Supabase belum dikonfigurasi. Data pratinjau hanya tersimpan lokal.'}</span></div></div>}
      {app.error && <div className="login-error" role="alert">{app.error}</div>}{message && <div className="login-error" role="alert">{message}</div>}
      {isSupabaseConfigured && <form className="login-form" onSubmit={submit}><label className="field">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" placeholder="nama@instansi.go.id" /></label><label className="field">Kata sandi<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Masukkan kata sandi" /></label><button className="button-primary login-submit" disabled={busy}>{busy ? 'Memeriksa akun…' : <>Masuk<ArrowRight size={16} /></>}</button><p className="login-security">Akses dilindungi Supabase Auth dan kebijakan database berbasis peran.</p></form>}
      {app.demo && <div className="demo-role-section"><div className="demo-role-caption">MASUK SEBAGAI PERAN DEMO</div><div className="demo-role-list">{demoAccounts.map(account => <button key={account.role} onClick={() => app.signInDemo(account.role)} className="demo-role-button"><span className={`demo-role-avatar role-${account.role}`}>{account.label.slice(0,1)}</span><span><strong>{account.label}</strong><small>{account.email}</small></span><ArrowRight size={16} /></button>)}</div><small className="demo-password-note">Akun demo terisolasi · data operasional contoh · tanpa kata sandi</small></div>}
      {!isSupabaseConfigured && <div className="login-config-note"><strong>Siap dihubungkan ke Supabase</strong><span>Isi <code>.env</code> dari <code>.env.example</code> untuk mengaktifkan autentikasi dan basis data produksi.</span></div>}
      <div className="login-legal">Akun dibuat dan dikelola Admin. Registrasi publik tidak tersedia.</div>
    </div></div>
  </main>;
}
