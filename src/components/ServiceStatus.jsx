import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const statusButton = useRef(null);
  const tooltipHideTimer = useRef(null);

  useEffect(() => {
    if (demo) return undefined;
    const unsubscribe = subscribeServiceHealth(setHealth);
    const stop = startServiceMonitor();
    return () => { unsubscribe(); stop(); };
  }, [demo]);

  const label = labels[health.status] || labels.issue;
  const tooltipVisible = hovered || focused || pinned;
  const placeTooltip = useCallback(() => {
    const rect = statusButton.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(270, window.innerWidth - 24);
    const height = 104;
    let left = rect.right + 10;
    if (left + width > window.innerWidth - 12) left = rect.left - width - 10;
    left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
    let top = rect.top + (rect.height - height) / 2;
    if (top < 12 || top + height > window.innerHeight - 12) top = rect.bottom + 8;
    top = Math.min(Math.max(12, top), window.innerHeight - height - 12);
    setTooltipPosition({ left, top, width });
  }, []);
  const showTooltip = () => {
    window.clearTimeout(tooltipHideTimer.current);
    placeTooltip();
    setHovered(true);
  };
  const scheduleTooltipHide = () => {
    window.clearTimeout(tooltipHideTimer.current);
    tooltipHideTimer.current = window.setTimeout(() => setHovered(false), 220);
  };
  useEffect(() => () => window.clearTimeout(tooltipHideTimer.current), []);
  useEffect(() => {
    if (!tooltipVisible) return undefined;
    const reposition = () => placeTooltip();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [tooltipVisible, placeTooltip]);
  if (compact) return <>
    <button
    ref={statusButton}
    type="button"
    className={`service-status service-status-compact service-${health.status} ${tooltipVisible ? 'is-open' : ''}`}
    aria-label={`Status layanan: ${label}. ${health.message} Tekan untuk menampilkan keterangannya.`}
    aria-expanded={tooltipVisible}
    aria-describedby={tooltipVisible ? 'service-status-tooltip' : undefined}
    onPointerEnter={showTooltip}
    onPointerLeave={scheduleTooltipHide}
    onFocus={() => { placeTooltip(); setFocused(true); }}
    onBlur={() => { setFocused(false); setPinned(false); }}
    onClick={() => { placeTooltip(); setPinned(value => !value); }}
    onKeyDown={event => { if (event.key === 'Escape') setPinned(false); }}
  >
    <i aria-hidden="true" />
    </button>
    {tooltipVisible && tooltipPosition && createPortal(
      <span id="service-status-tooltip" className="service-status-portal-tooltip" role="tooltip" style={tooltipPosition} onPointerEnter={showTooltip} onPointerLeave={scheduleTooltipHide}>
        <strong>{label}</strong><small>{health.message}</small>
      </span>,
      document.body,
    )}
  </>;

  return <span className={`service-status service-${health.status}`} role="status" aria-live="polite" title={health.message}>
    <i aria-hidden="true" />
    <span>{label}</span>
  </span>;
}
