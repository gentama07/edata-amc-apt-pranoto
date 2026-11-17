import { Suspense, lazy, useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { useEdata } from './hooks/useEdata';
const Dashboard = lazy(() => import('./pages/Dashboard'));
import Letters from './pages/Letters';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Movements from './pages/Movements';
const Reports = lazy(() => import('./pages/Reports'));
import Users from './pages/Users';
import Profile from './pages/Profile';
import MovementForm from './components/MovementForm';
import { airportDate } from './lib/time';
import PasswordRecovery from './pages/PasswordRecovery';
import './styles.css';

export default function App() {
  const app = useEdata();
  const [active, setActive] = useState('summary');
  const [selectedDate, setSelectedDate] = useState(airportDate());
  const [editing, setEditing] = useState(null);
  const portalMode = new URLSearchParams(location.search).get('portal') === 'ground-handling';
  const [showLogin, setShowLogin] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('login') === '1' || params.get('portal') === 'ground-handling' || params.has('recovery');
  });
  const profileRole = app.profile?.role;
  useEffect(() => {
    const syncLoginRoute = () => {
      const params = new URLSearchParams(location.search);
      setShowLogin(params.get('login') === '1' || params.get('portal') === 'ground-handling' || params.has('recovery'));
    };
    window.addEventListener('popstate', syncLoginRoute);
    return () => window.removeEventListener('popstate', syncLoginRoute);
  }, []);
  const openLogin = () => {
    const url = new URL(location.href);
    url.searchParams.set('login', '1');
    history.pushState({}, '', url);
    setShowLogin(true);
    window.scrollTo(0, 0);
  };
  const returnToLanding = () => {
    const url = new URL(location.href);
    url.searchParams.delete('login');
    history.replaceState({}, '', url);
    setShowLogin(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => { if (!profileRole) { setActive('summary'); setEditing(null); window.scrollTo(0, 0); } else if (profileRole === 'ground_handling') setActive(current => current === 'profile' ? current : 'letters'); }, [profileRole]);
  if (app.passwordRecovery) return <PasswordRecovery finishPasswordRecovery={app.finishPasswordRecovery} />;
  if (!app.recoveryChecked && new URLSearchParams(location.search).get('recovery') === '1') return <main className="password-recovery-screen"><section className="panel password-recovery-card" role="status">Memeriksa tautan pemulihan…</section></main>;
  if (app.recoveryInvalid) return <PasswordRecovery invalid finishPasswordRecovery={app.finishPasswordRecovery} />;
  if (!app.profile) return showLogin ? <Login app={app} portalMode={portalMode} onBack={portalMode ? undefined : returnToLanding} /> : <Landing onLogin={openLogin} />;
  const canWrite = ['admin', 'personel'].includes(app.profile.role);
  const currentPage = app.profile.role === 'ground_handling' ? (active === 'profile' ? 'profile' : 'letters') : active;
  const openInput = row => { if (!canWrite || app.profile.role === 'ground_handling') return; setEditing(row || null); setActive('input'); };
  const saveMovement = async row => { await app.saveMovement(row); setActive('movements'); setEditing(null); };
  const content = currentPage === 'input' && canWrite ? <MovementForm date={selectedDate} initial={editing} onCancel={() => { setActive('movements'); setEditing(null); }} onSave={saveMovement} setError={app.setError} />
    : currentPage === 'movements' ? <Movements rows={app.movements} selectedDate={selectedDate} canWrite={canWrite} onInput={() => openInput()} onEdit={row => openInput(row)} onDelete={async id => { try { await app.deleteMovement(id); } catch (error) { app.setError(error.message); } }} />
    : currentPage === 'reports' ? <Reports rows={app.movements} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
    : currentPage === 'letters' ? <Letters letters={app.letters} messages={app.messages} profile={app.profile} canWrite={canWrite} canReply={['admin', 'personel', 'pimpinan'].includes(app.profile.role)} demo={app.demo} onCreate={app.createLetter} onReply={app.createReply} onMessage={app.sendMessage} onDelete={app.deleteLetter} syncDrive={app.syncDrive} confirmLetterComplete={app.confirmLetterComplete} setError={app.setError} />
    : currentPage === 'users' && app.profile.role === 'admin' ? <Users app={app} />
    : currentPage === 'profile' ? <Profile app={app} />
    : <Dashboard rows={app.movements} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
  return <Shell app={app} active={currentPage} setActive={id => { if (id === 'input' && !canWrite) return; if (app.profile.role === 'ground_handling' && !['letters', 'profile'].includes(id)) return; setActive(id); setEditing(null); }}>
    {app.busy && <div className="loading-strip"><span />Memuat data operasional…</div>}
    <Suspense fallback={<div className="panel loading-page">Membuka halaman…</div>}>{content}</Suspense>
  </Shell>;
}


