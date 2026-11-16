import { Suspense, lazy, useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { useEdata } from './hooks/useEdata';
const Dashboard = lazy(() => import('./pages/Dashboard'));
import Letters from './pages/Letters';
import Login from './pages/Login';
import Movements from './pages/Movements';
const Reports = lazy(() => import('./pages/Reports'));
import Users from './pages/Users';
import MovementForm from './components/MovementForm';
import { airportDate } from './lib/time';
import './styles.css';

export default function App() {
  const app = useEdata();
  const [active, setActive] = useState('summary');
  const [selectedDate, setSelectedDate] = useState(airportDate());
  const [editing, setEditing] = useState(null);
  useEffect(() => { if (!app.profile) { setActive('summary'); setEditing(null); } }, [app.profile]);
  if (!app.profile) return <Login app={app} />;
  const canWrite = ['admin', 'personel'].includes(app.profile.role);
  const openInput = row => { if (!canWrite) return; setEditing(row || null); setActive('input'); };
  const saveMovement = async row => { await app.saveMovement(row); setActive('movements'); setEditing(null); };
  const content = active === 'input' && canWrite ? <MovementForm date={selectedDate} initial={editing} onCancel={() => { setActive('movements'); setEditing(null); }} onSave={saveMovement} setError={app.setError} />
    : active === 'movements' ? <Movements rows={app.movements} selectedDate={selectedDate} canWrite={canWrite} onInput={() => openInput()} onEdit={row => openInput(row)} onDelete={async id => { try { await app.deleteMovement(id); } catch (error) { app.setError(error.message); } }} />
    : active === 'reports' ? <Reports rows={app.movements} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
    : active === 'letters' ? <Letters letters={app.letters} canWrite={canWrite} demo={app.demo} onSave={app.saveLetter} onUpdate={app.updateLetter} syncDrive={app.syncDrive} setError={app.setError} />
    : active === 'users' && app.profile.role === 'admin' ? <Users app={app} />
    : <Dashboard rows={app.movements} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
  return <Shell app={app} active={active} setActive={id => { if (id === 'input' && !canWrite) return; setActive(id); setEditing(null); }}>
    {app.busy && <div className="loading-strip"><span />Memuat data operasional…</div>}
    <Suspense fallback={<div className="panel loading-page">Membuka halaman…</div>}>{content}</Suspense>
  </Shell>;
}
