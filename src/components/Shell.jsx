import { useEffect, useState } from 'react';
import { Activity, ClipboardList, FileBarChart2, FileText, LayoutDashboard, LogOut, Menu, Moon, Sun, UserRoundCog, X } from 'lucide-react';
import { formatWita } from '../lib/time';
import ServiceStatus from './ServiceStatus';

const navItems = [
  { id: 'summary', label: 'Ringkasan', Icon: LayoutDashboard },
  { id: 'movements', label: 'Log pergerakan', Icon: Activity },
  { id: 'input', label: 'Input data', Icon: ClipboardList, write: true },
  { id: 'reports', label: 'Laporan', Icon: FileBarChart2 },
  { id: 'letters', label: 'Persuratan', Icon: FileText },
];

export function Shell({ app, active, setActive, children }) {
  const { profile, demo, modeLabel, signOut } = app;
  const canWrite = ['admin', 'personel'].includes(profile.role);
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem('amc-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('amc-theme', theme); document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18181a' : '#f5f5f7'); }, [theme]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const items = profile.role === 'ground_handling'
    ? [{ id: 'letters', label: 'Persuratan', Icon: FileText }]
    : [...navItems.filter(item => !item.write || canWrite), ...(profile.role === 'admin' ? [{ id: 'users', label: 'Pengguna', Icon: UserRoundCog }] : [])];
  const navigate = id => { setActive(id); setMenuOpen(false); };

  return <div className="app-frame min-h-screen">
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    {demo && <div className="demo-banner" role="status"><span className="demo-dot" />{modeLabel} <span className="demo-banner-detail">· Data tersimpan hanya di browser ini; bukan database produksi.</span></div>}
    <header className="topbar">
      <button className="mobile-menu-icon icon-button" aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      <div className="brand-lockup">
        <div className="apt-mark apt-mark-image"><img width="810" height="308" src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="Logo Bandar Udara A.P.T. Pranoto" /></div>
        <div className="brand-copy"><strong>E-data AMC</strong><span>APT Pranoto · Samarinda</span></div>
      </div>
      <ServiceStatus demo={demo} compact />
      <div className="topbar-right">
        <div className="clock-block"><span className="clock-time">{formatWita(now, false)}</span><span className="clock-date">{formatWita(now).split(' · ')[1]}</span></div>
        <span className={`role-badge role-${profile.role}`}>{profile.role === 'ground_handling' ? 'Ground Handling' : profile.role}</span>
        <button className="icon-button theme-toggle" title={theme === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'} aria-label="Ganti tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="logout-button" aria-label="Keluar" onClick={signOut}><LogOut size={16} /><span>Keluar</span></button>
      </div>
    </header>
    <div className="workspace">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Navigasi utama">
        <div className="sidebar-heading">OPERASIONAL</div>
        {items.map(({ id, label, Icon }) => <button key={id} className={`nav-link ${active === id ? 'nav-active' : ''}`} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'summary' && <span className="nav-live" title="Data harian" />}</button>)}
        <div className="sidebar-bottom"><div className="airport-card"><video className="airport-card-video" aria-hidden="true" autoPlay muted loop playsInline preload="metadata"><source src={`${import.meta.env.BASE_URL}assets/airport-card.mp4`} type="video/mp4" /></video><span className="airport-card-label">BANDAR UDARA</span><strong>AAP <span>·</span> WALS</strong><small>Apron Movement Control</small></div><button className="signed-in signed-in-button" onClick={() => navigate('profile')} aria-label={`Buka profil ${profile.name}`}>
          {profile.avatarUrl ? <img className="avatar" src={profile.avatarUrl} alt="" /> : <span className="avatar">{profile.name?.slice(0, 1).toUpperCase()}</span>}
          <span className="signed-copy"><strong>{profile.name}</strong><span>{profile.email}</span>{profile.nip && <small>NIP {profile.nip}</small>}</span>
        </button></div>
      </aside>
      {menuOpen && <button className="nav-scrim" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
      <main className="main-content" id="main-content" tabIndex="-1">{app.error && <div className="toast-error" role="status" aria-live="polite"><span>{app.error}</span><button onClick={() => app.setError('')} aria-label="Tutup pesan">×</button></div>}{children}</main>
    </div>
    <nav className="bottom-nav" aria-label="Navigasi bawah">{items.map(({ id, label, Icon }) => <button key={id} onClick={() => navigate(id)} className={active === id ? 'bottom-active' : ''} aria-current={active === id ? 'page' : undefined}><Icon size={19} /><span>{label === 'Log pergerakan' ? 'Log' : label === 'Input data' ? 'Input' : label === 'Pengguna' ? 'Pengguna' : label}</span></button>)}</nav>
  </div>;
}

export function PageHeading({ title, description, action }) {
  return <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function EmptyState({ title, body }) { return <div className="empty-state"><div className="empty-icon"><Activity size={22} /></div><strong>{title}</strong><p>{body}</p></div>; }

export function StatCard({ label, value, note, Icon, tone = 'blue' }) { return <article className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={19} strokeWidth={1.8} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>; }


