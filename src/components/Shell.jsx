import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, ClipboardList, FileBarChart2, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Moon, Plane, Sun, UserRoundCog, X } from 'lucide-react';
import { formatWita } from '../lib/time';
import { supabase } from '../lib/supabase';
import { getServiceHistory, markServiceNotificationRead, subscribeServiceHealth } from '../lib/serviceMonitor';
import ServiceStatus from './ServiceStatus';
import SupportChatPanel from './SupportChatPanel';

const navItems = [
  { id: 'summary', label: 'Ringkasan', Icon: LayoutDashboard },
  { id: 'movements', label: 'Log pergerakan', Icon: Activity },
  { id: 'input', label: 'Input data', Icon: ClipboardList, write: true },
  { id: 'reports', label: 'Laporan', Icon: FileBarChart2 },
  { id: 'letters', label: 'Persuratan', Icon: FileText },
  { id: 'flights', label: 'Tracking penerbangan', Icon: Plane },
];

export function Shell({ app, active, setActive, children }) {
  const { profile, demo, modeLabel, signOut } = app;
  const canWrite = ['admin', 'personel'].includes(profile.role);
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem('amc-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [menuOpen, setMenuOpen] = useState(false);
  const openingKey = `amc-opening-shown:${profile.id}`;
  const [showOpening, setShowOpening] = useState(false);
  const finishOpening = useCallback(() => setShowOpening(false), []);
  const [airportVideo, setAirportVideo] = useState('');
  const [openingVideo, setOpeningVideo] = useState('');
  const [openingVideoReady, setOpeningVideoReady] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutButtonRef = useRef(null);
  const cancelLogoutRef = useRef(null);
  const confirmLogoutRef = useRef(null);
  useEffect(() => {
    if (!app.openingRequested || window.matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem(openingKey)) return;
    sessionStorage.setItem(openingKey, '1');
    setShowOpening(true);
  }, [app.openingRequested, openingKey]);
  useEffect(() => {
    if (!app.session || !supabase) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [cardResult, openingResult] = await Promise.all([
          supabase.storage.from('airport-video').createSignedUrl('airport-card.mp4', 3600),
          supabase.storage.from('airport-video').createSignedUrl('animasi-logo.mp4', 3600),
        ]);
        if (cancelled) return;
        setAirportVideo(cardResult.error ? '' : cardResult.data?.signedUrl || '');
        setOpeningVideo(openingResult.error ? '' : openingResult.data?.signedUrl || '');
        setOpeningVideoReady(false);
        if (openingResult.error || !openingResult.data?.signedUrl) setShowOpening(false);
      } catch {
        if (cancelled) return;
        setAirportVideo('');
        setOpeningVideo('');
        setShowOpening(false);
      }
    };
    refresh();
    const timer = setInterval(refresh, 45 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [app.session, app.openingRequested]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('amc-theme', theme); document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18181a' : '#f5f5f7'); }, [theme]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const items = profile.role === 'ground_handling'
    ? [{ id: 'flights', label: 'Tracking penerbangan', Icon: Plane }, { id: 'letters', label: 'Persuratan', Icon: FileText }]
    : [...navItems.filter(item => !item.write || canWrite), ...(profile.role === 'admin' ? [{ id: 'users', label: 'Pengguna', Icon: UserRoundCog }] : [])];
  const navigate = id => { if (id !== 'summary') setShowOpening(false); setActive(id); setMenuOpen(false); };
  const handleSignOut = () => { sessionStorage.removeItem(openingKey); signOut(); };
  const cancelSignOut = useCallback(() => {
    setLogoutConfirmOpen(false);
    window.requestAnimationFrame(() => logoutButtonRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!logoutConfirmOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelLogoutRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); cancelSignOut(); }
      if (event.key === 'Tab') {
        const first = cancelLogoutRef.current;
        const last = confirmLogoutRef.current;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [logoutConfirmOpen, cancelSignOut]);

  return <div className="app-frame min-h-screen">
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    {demo && <div className="demo-banner" role="status"><span className="demo-dot" />{modeLabel} <span className="demo-banner-detail">· Data tersimpan hanya di browser ini; bukan database produksi.</span></div>}
    <header className="topbar">
      <button className="mobile-menu-icon icon-button" aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      <div className="brand-lockup">
        <div className="apt-mark apt-mark-image"><img width="810" height="308" src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="Logo Bandar Udara A.P.T. Pranoto" /></div>
        <div className="brand-copy"><strong>E-data AMC</strong><span>APT Pranoto · Samarinda</span></div>
      </div>
      <div className="topbar-right">
        <span className={`role-badge role-${profile.role}`}>{profile.role === 'ground_handling' ? 'Ground Handling' : profile.role}</span>
        <div className="clock-block"><span className="clock-time">{formatWita(now, false)}</span><span className="clock-date">{formatWita(now).split(' · ')[1]}</span></div>
        {!demo && <WebNotificationCenter app={app} onOpenUsers={() => navigate('users')} onOpenSupport={() => setSupportOpen(true)} />}
        <button className="icon-button theme-toggle" title={theme === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'} aria-label={theme === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button ref={logoutButtonRef} className="logout-button" aria-label="Keluar" title="Keluar" onClick={() => setLogoutConfirmOpen(true)}><LogOut size={17} aria-hidden="true" /></button>
      </div>
    </header>
    <div className="workspace">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Navigasi utama">
        <div className="sidebar-heading"><span>OPERASIONAL</span><ServiceStatus demo={demo} compact /></div>
        {items.map(({ id, label, Icon }) => <button key={id} className={`nav-link ${active === id ? 'nav-active' : ''}`} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>)}
        <div className="sidebar-bottom"><div className="airport-card">{airportVideo && <video className="airport-card-video" aria-hidden="true" autoPlay muted loop playsInline preload="metadata" src={airportVideo} />}<span className="airport-card-label">BANDAR UDARA</span><strong>AAP <span>·</span> WALS</strong><small>Apron Movement Control</small></div><button className="signed-in signed-in-button" onClick={() => navigate('profile')} aria-label={`Buka profil ${profile.name}`}>
          {profile.avatarUrl ? <img className="avatar" src={profile.avatarUrl} alt="" /> : <span className="avatar">{profile.name?.slice(0, 1).toUpperCase()}</span>}
          <span className="signed-copy"><strong>{profile.name}</strong><span>{profile.email}</span>{profile.nip && <small>NIP {profile.nip}</small>}</span>
        </button></div>
      </aside>
      {menuOpen && <button className="nav-scrim" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
      <main className="main-content" id="main-content" tabIndex="-1">{app.error && <div className="toast-error" role="status" aria-live="polite"><span>{app.error}</span><button onClick={() => app.setError('')} aria-label="Tutup pesan">×</button></div>}{active === 'summary' && showOpening ? openingVideo ? <>{!openingVideoReady && <div className="opening-video" role="status" aria-label="Menyiapkan video pembuka" />}<Opening src={openingVideo} visible={openingVideoReady} onReady={() => setOpeningVideoReady(true)} onDone={finishOpening} /></> : <div className="opening-video" role="status" aria-label="Memuat video pembuka" /> : children}</main>
    </div>
    <nav className="bottom-nav" aria-label="Navigasi bawah">{items.map(({ id, label, Icon }) => <button key={id} onClick={() => navigate(id)} className={active === id ? 'bottom-active' : ''} aria-current={active === id ? 'page' : undefined}><Icon size={19} /><span>{label === 'Log pergerakan' ? 'Log' : label === 'Input data' ? 'Input' : label === 'Pengguna' ? 'Pengguna' : label}</span></button>)}</nav>
    {logoutConfirmOpen && <div className="signout-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) cancelSignOut(); }}><section className="signout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description"><span className="signout-warning-icon"><AlertTriangle size={21} aria-hidden="true" /></span><h2 id="signout-title">Keluar dari akun?</h2><p id="signout-description">Sesi operasional Anda akan diakhiri pada perangkat ini.</p><div className="signout-actions"><button ref={cancelLogoutRef} type="button" className="button-secondary" onClick={cancelSignOut}>Batal</button><button ref={confirmLogoutRef} type="button" className="button-danger signout-confirm-button" onClick={handleSignOut}><LogOut size={15} />Keluar</button></div></section></div>}
    {profile.role !== 'admin' && !demo && <><button className="support-fab" onClick={() => setSupportOpen(true)}><MessageCircle size={17} /><span>Bantuan</span></button>{supportOpen && <SupportChatPanel app={app} onClose={() => setSupportOpen(false)} />}</>}
  </div>;
}

function WebNotificationCenter({ app, onOpenUsers, onOpenSupport }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const isAdmin = app.profile.role === 'admin';
  const unread = items.filter(item => !item.read_at).length;
  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    const load = async () => {
      const [adminResult, messageResult] = await Promise.all([
        isAdmin
          ? supabase.from('admin_notifications').select('id,type,reference_id,user_id,title,body,created_at,read_at').order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] }),
        isAdmin
          ? Promise.resolve({ data: [] })
          : supabase.from('support_messages').select('id,user_id,sender_id,body,created_at,user_read_at').eq('user_id', app.profile.id).neq('sender_id', app.profile.id).order('created_at', { ascending: false }).limit(30),
      ]);
      if (!alive) return;
      const serviceItems = getServiceHistory().filter(event => event.notification).map(event => ({
        id: event.id,
        type: 'service_status',
        reference_id: event.id,
        user_id: null,
        title: event.title,
        body: event.message,
        created_at: event.checkedAt,
        read_at: event.readAt,
        localOnly: true,
      }));
      const messageItems = (messageResult.data || []).map(message => ({
        id: `support-${message.id}`,
        type: 'support_message',
        reference_id: message.id,
        user_id: message.user_id,
        title: 'Pesan baru dari Admin',
        body: message.body,
        created_at: message.created_at,
        read_at: message.user_read_at,
      }));
      setItems([...(adminResult.data || []), ...messageItems, ...serviceItems].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 30));
    };
    load();
    const channel = isAdmin
      ? supabase.channel('admin-web-notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, load).subscribe()
      : supabase.channel(`support-user-notifications-${app.profile.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${app.profile.id}` }, load).subscribe();
    const unsubscribe = subscribeServiceHealth(load);
    const onStorage = event => { if (event.key === 'amc-service-health-history-v1') load(); };
    window.addEventListener('storage', onStorage);
    return () => { alive = false; unsubscribe(); window.removeEventListener('storage', onStorage); supabase.removeChannel(channel); };
  }, [app.profile.id, isAdmin]);
  const openNotification = async item => {
    if (item.type === 'service_status') {
      markServiceNotificationRead(item.reference_id);
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
      if (!isAdmin) { setOpen(false); return; }
    } else if (item.type === 'support_message') {
      setOpen(false);
      onOpenSupport();
      return;
    } else if (!item.read_at) {
      await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
    }
    const target = { type: item.type, referenceId: item.reference_id, userId: item.user_id };
    localStorage.setItem('amc-admin-notification-target', JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('amc-admin-notification-open', { detail: target }));
    setOpen(false);
    onOpenUsers(item);
  };
  return <div className="admin-notification-center">
    <button className="admin-notification-button" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell size={18} />{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</button>
    {open && <><button className="notification-dismiss" aria-label="Tutup notifikasi" onClick={() => setOpen(false)} /><section className="admin-notification-popover" aria-label="Notifikasi"><header><strong>Notifikasi</strong><span>{unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</span></header>{items.length ? <div className="admin-notification-list">{items.map(item => {
      const service = item.type === 'service_status';
      const recovery = item.type === 'account_recovery';
      return <button key={item.id} className={`admin-notification-item ${item.read_at ? '' : 'notification-unread'}`} onClick={() => openNotification(item)}><i className={service ? 'notification-service-icon' : recovery ? 'notification-recovery-icon' : 'notification-chat-icon'}>{service ? <Activity size={15} /> : recovery ? <UserRoundCog size={15} /> : <MessageCircle size={15} />}</i><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}{service && ' · Riwayat di perangkat ini'}</time></span>{!item.read_at && <b aria-label="Belum dibaca" />}</button>;
    })}</div> : <div className="notification-empty">{isAdmin ? 'Belum ada pesan CS, permintaan pemulihan, atau perubahan status layanan.' : 'Belum ada pesan baru atau perubahan status layanan.'}</div>}<footer><button onClick={() => { setOpen(false); isAdmin ? onOpenUsers() : onOpenSupport(); }}>{isAdmin ? 'Buka manajemen pengguna' : 'Buka bantuan'}</button></footer></section></>}
  </div>;
}

function Opening({ src, visible, onReady, onDone }) {
  const videoRef = useRef(null);
  const readyRef = useRef(visible);
  useEffect(() => {
    if (visible) videoRef.current?.play().catch(onDone);
  }, [visible, onDone]);
  useEffect(() => {
    if (!visible) return undefined;
    const resumeAfterFocus = () => {
      const video = videoRef.current;
      if (document.visibilityState === 'visible' && video && video.paused && !video.ended) video.play().catch(onDone);
    };
    document.addEventListener('visibilitychange', resumeAfterFocus);
    return () => document.removeEventListener('visibilitychange', resumeAfterFocus);
  }, [visible, onDone]);
  useEffect(() => {
    const timeout = window.setTimeout(onDone, 45000);
    return () => window.clearTimeout(timeout);
  }, [onDone]);
  return <div className={visible ? 'opening-video' : 'opening-video-preload'} aria-label={visible ? 'Video pembuka' : undefined} aria-hidden={!visible}>
    <video ref={videoRef} className="opening-video-media" autoPlay muted playsInline preload="auto" onCanPlay={event => { if (!readyRef.current) { readyRef.current = true; event.currentTarget.pause(); onReady(); } }} onEnded={onDone} onError={onDone} onStalled={onDone} src={src} />
  </div>;
}

export function PageHeading({ title, description, action }) {
  const keepSummaryDescription = title === 'Ringkasan operasional';
  return <div className="page-heading"><div>{keepSummaryDescription && <span className="eyebrow">PUSAT KENDALI APRON</span>}<h1>{title}</h1>{keepSummaryDescription && description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function EmptyState({ title, body }) { return <div className="empty-state"><div className="empty-icon"><Activity size={22} /></div><strong>{title}</strong><p>{body}</p></div>; }

export function StatCard({ label, value, note, Icon, tone = 'blue', visual = 'flights' }) { return <article className={`stat-card stat-card-${visual}`}><div className={`stat-icon stat-${tone}`}><Icon size={19} strokeWidth={1.8} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>; }


