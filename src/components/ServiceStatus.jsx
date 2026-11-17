import { useEffect, useState } from 'react';

export default function ServiceStatus({ demo, compact = false }) {
  const [state, setState] = useState(demo ? 'demo' : 'checking');

  useEffect(() => {
    if (demo) return undefined;
    let disposed = false;
    let controller;
    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6500);
      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '');
        const options = { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, signal: controller.signal, cache: 'no-store' };
        const responses = await Promise.all([
          fetch(`${baseUrl}/auth/v1/health`, options),
          fetch(`${baseUrl}/rest/v1/profiles?select=id&limit=0`, { ...options, method: 'HEAD' }),
        ]);
        if (!disposed) setState(responses.every(response => response.ok) ? 'online' : 'issue');
      } catch {
        if (!disposed) setState('issue');
      } finally {
        window.clearTimeout(timeout);
      }
    };
    check();
    const interval = window.setInterval(check, 30000);
    return () => { disposed = true; controller?.abort(); window.clearInterval(interval); };
  }, [demo]);

  const labels = {
    checking: 'Memeriksa layanan',
    online: 'Layanan data aktif',
    issue: 'Layanan sulit dijangkau',
    demo: 'Pratinjau lokal',
  };
  return <span className={`service-status service-${state} ${compact ? 'service-status-compact' : ''}`} role="status" aria-live="polite">
    <i aria-hidden="true" />
    {compact && <strong>Sistem Operasional AMC</strong>}
    <span>{labels[state]}</span>
  </span>;
}

