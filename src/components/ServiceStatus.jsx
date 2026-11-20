import { useEffect, useState } from 'react';
import { getServiceSnapshot, startServiceMonitor, subscribeServiceHealth } from '../lib/serviceMonitor';

const labels = {
  checking: 'Memeriksa layanan',
  online: 'Layanan data aktif',
  issue: 'Layanan sulit dijangkau',
  demo: 'Pratinjau lokal',
};

export default function ServiceStatus({ demo, compact = false }) {
  const [health, setHealth] = useState(() => demo
    ? { status: 'demo', message: 'Mode pratinjau lokal tidak terhubung ke layanan produksi.' }
    : getServiceSnapshot());
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    if (demo) return undefined;
    const unsubscribe = subscribeServiceHealth(setHealth);
    const stop = startServiceMonitor();
    return () => { unsubscribe(); stop(); };
  }, [demo]);

  const label = labels[health.status] || labels.issue;
  if (compact) return <button
    type="button"
    className={`service-status service-status-compact service-${health.status} ${showLabel ? 'is-open' : ''}`}
    aria-label={`Status layanan: ${label}. ${health.message} Tekan untuk menampilkan keterangannya.`}
    aria-expanded={showLabel}
    title={health.message}
    onClick={() => setShowLabel(value => !value)}
    onBlur={() => setShowLabel(false)}
  >
    <i aria-hidden="true" />
    <span aria-hidden="true"><strong>{label}</strong><small>{health.message}</small></span>
  </button>;

  return <span className={`service-status service-${health.status}`} role="status" aria-live="polite" title={health.message}>
    <i aria-hidden="true" />
    <span>{label}</span>
  </span>;
}
