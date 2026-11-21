import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpDown, Download, FilterX, Pause, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { airportOptions } from '../config/airportOptions';
import { useModalFocus } from '../hooks/useModalFocus';
import { getDirection } from '../lib/analytics';
import { downloadCsv } from '../lib/csv';
import { advanceHorizontalLoop } from '../lib/horizontalLoop';
import { PageHeading } from '../components/Shell';

const columns = [
  ['operator', 'Operator'], ['aircraftType', 'Tipe'], ['registration', 'Registrasi'],
  ['flightArr', 'No. ARR'], ['flightDep', 'No. DEP'], ['origin', 'Origin'], ['destination', 'Destination'],
  ['sta', 'STA'], ['ata', 'ATA'], ['blockOn', 'Block ON'], ['std', 'STD'], ['blockOff', 'Block OFF'], ['atd', 'ATD'],
  ['handler', 'Ground handling'], ['stand', 'Stand'], ['riu', 'RIU'], ['paxArr', 'Pax ARR'], ['paxDep', 'Pax DEP'],
  ['baggageArrKg', 'Bagasi ARR (kg)'], ['baggageDepKg', 'Bagasi DEP (kg)'],
  ['cargoArrKg', 'Kargo ARR (kg)'], ['cargoDepKg', 'Kargo DEP (kg)'], ['remark', 'Remark'],
];

export default function Movements({ rows, selectedDate, canWrite, onInput, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [operator, setOperator] = useState('');
  const [direction, setDirection] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [sort, setSort] = useState({ key: 'date', asc: false });
  const operatorFilterOptions = useMemo(() => {
    const knownOperators = new Set(airportOptions.operators);
    const previousOperators = [...new Set(rows.map(row => row.operator).filter(value => value && !knownOperators.has(value)))];
    return [...airportOptions.operators, ...previousOperators];
  }, [rows]);
  const [autoScroll, setAutoScroll] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dialogRef = useRef(null);
  const tableScrollRef = useRef(null);
  const lastManualScrollRef = useRef(0);
  useModalFocus(dialogRef, { enabled: Boolean(confirm), onEscape: () => setConfirm(null), initialFocusSelector: '.button-secondary' });

  const filtered = useMemo(() => rows.filter(row => {
    const text = [row.operator, row.registration, row.flightArr, row.flightDep, row.origin, row.destination, row.remark].join(' ').toLocaleLowerCase('id-ID');
    const directionValue = getDirection(row);
    const matchesDirection = !direction || direction === directionValue || (direction === 'arr' && row.flightArr) || (direction === 'dep' && row.flightDep) || (direction === 'turnaround' && row.flightArr && row.flightDep);
    return (!query || text.includes(query.toLocaleLowerCase('id-ID'))) && (!operator || row.operator === operator) && matchesDirection && (!selectedDate || row.date === selectedDate);
  }).sort((a, b) => {
    const av = a[sort.key] ?? '';
    const bv = b[sort.key] ?? '';
    return String(av).localeCompare(String(bv), 'id', { numeric: true }) * (sort.asc ? 1 : -1);
  }), [rows, query, operator, direction, selectedDate, sort]);

  const visibleRows = filtered;
  const hasLoop = autoScroll && visibleRows.length > 0;
  useEffect(() => {
    const viewport = tableScrollRef.current;
    if (!hasLoop || !viewport) return undefined;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let motionAllowed = true;
    let previousTime = 0;
    let frame = 0;
    let loop = { position: viewport.scrollLeft, holdRemaining: 0 };
    const tick = time => {
      const delta = previousTime ? Math.min(time - previousTime, 40) : 0;
      previousTime = time;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      if (motionAllowed && time - lastManualScrollRef.current > 1200 && document.visibilityState === 'visible' && maxScroll > 1) {
        const next = advanceHorizontalLoop(loop, maxScroll, delta);
        if (next.position !== loop.position) viewport.scrollLeft = next.position;
        loop = next;
      } else if (loop.holdRemaining === 0) loop = { ...loop, position: viewport.scrollLeft };
      frame = window.requestAnimationFrame(tick);
    };
    const handleMotionPreference = event => { motionAllowed = !event.matches; previousTime = 0; if (event.matches) setAutoScroll(false); };
    motionPreference.addEventListener('change', handleMotionPreference);
    frame = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(frame); motionPreference.removeEventListener('change', handleMotionPreference); };
  }, [hasLoop, visibleRows]);
  const reset = () => { setQuery(''); setOperator(''); setDirection(''); };
  const changeSort = key => setSort(current => ({ key, asc: current.key === key ? !current.asc : true }));
  const exportRows = () => downloadCsv(filtered, `log-amc-${selectedDate || 'semua-tanggal'}.csv`);
  const confirmDelete = async () => { if (confirm) { await onDelete(confirm.id); setConfirm(null); } };

  return <>
    <PageHeading eyebrow="DATA OPERASIONAL" title="Log pergerakan" description="Catatan kedatangan, keberangkatan, dan aktivitas apron." action={canWrite && <button className="button-primary" onClick={onInput}><Plus size={17} />Input data</button>} />
    <section className="panel log-panel">
      <div className="log-toolbar">
        <div className="search-field"><Search size={17} /><input autoComplete="off" name="movement-search" aria-label="Cari pergerakan" placeholder="Cari operator, registrasi, penerbangan…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <label className="filter-label">Operator<select name="operator-filter" aria-label="Filter operator" value={operator} onChange={event => setOperator(event.target.value)}><option value="">Semua operator</option>{operatorFilterOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-label">Arah<select name="direction-filter" aria-label="Filter arah penerbangan" value={direction} onChange={event => setDirection(event.target.value)}><option value="">Semua arah</option><option value="arr">Kedatangan (ARR)</option><option value="dep">Keberangkatan (DEP)</option><option value="turnaround">Transit / Turnaround</option></select></label>
        <button className="button-secondary filter-reset" onClick={reset}><FilterX size={15} />Reset filter</button>
      </div>
      <div className="table-summary"><span>Menampilkan <strong>{filtered.length}</strong> dari <strong>{rows.filter(row => !selectedDate || row.date === selectedDate).length}</strong> pergerakan</span><div className="table-summary-actions">{visibleRows.length > 0 && <button className="text-action auto-scroll-toggle" aria-label={autoScroll ? 'Jeda gulir otomatis' : 'Jalankan gulir otomatis'} onClick={() => setAutoScroll(value => !value)}>{autoScroll ? <Pause size={14} /> : <Play size={14} />}{autoScroll ? 'Jeda gulir' : 'Gulir otomatis'}</button>}<button className="text-action" onClick={exportRows}><Download size={15} />Ekspor CSV</button></div></div>
      <div ref={tableScrollRef} className={`table-scroll ${visibleRows.length > 5 ? 'table-scroll-loop' : ''}`} onPointerDown={() => { lastManualScrollRef.current = performance.now(); }} onPointerMove={event => { if (event.buttons) lastManualScrollRef.current = performance.now(); }} onWheel={() => { lastManualScrollRef.current = performance.now(); }}>
        <table className="movement-table"><thead><tr>
          {columns.map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => changeSort(key)}>{label}<ArrowUpDown size={11} /></button></th>)}{canWrite && <th>Aksi</th>}
        </tr></thead>
        <tbody>{filtered.length ? visibleRows.map((row, index) => <MovementRow key={row.id} row={row} index={index} canWrite={canWrite} onEdit={onEdit} onDelete={setConfirm} />) : <tr><td className="table-empty" colSpan={columns.length + (canWrite ? 1 : 0)}><div className="empty-table-icon"><ArrowDownToLine size={18} /></div><strong>Tidak ada data yang cocok</strong><span>Coba ubah filter atau pilih tanggal operasional lain.</span></td></tr>}</tbody>
        </table>
      </div>
      <div className="table-foot"><span>{hasLoop ? 'Tabel bergeser ke kanan, berhenti 5 detik, lalu kembali ke awal.' : 'Data mengikuti koneksi aktif.'}</span><span>Arah: ARR · DEP · Transit</span></div>
    </section>
    {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setConfirm(null)}><section ref={dialogRef} className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" tabIndex="-1"><div className="confirm-icon"><Trash2 size={19} aria-hidden="true" /></div><h2 id="delete-title">Hapus pergerakan?</h2><p>Data {confirm.registration} · {confirm.flightArr || confirm.flightDep || 'penerbangan ini'} akan dihapus dari log.</p><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setConfirm(null)}>Batal</button><button type="button" className="button-danger" onClick={confirmDelete}>Hapus data</button></div></section></div>}
  </>;
}

function MovementRow({ row, index, canWrite, onEdit, onDelete }) {
  return <tr className="movement-row" style={{ '--row-index': index }}>
    <td className="cell-operator">{row.operator}</td><td>{row.aircraftType || '—'}</td><td><span className="reg-chip">{row.registration}</span></td><td>{row.flightArr || '—'}</td><td>{row.flightDep || '—'}</td><td>{row.origin || '—'}</td><td>{row.destination || '—'}</td><td>{row.sta || '—'}</td><td>{row.ata || '—'}</td><td>{row.blockOn || '—'}</td><td>{row.std || '—'}</td><td>{row.blockOff || <span className="onblock-chip">On-block</span>}</td><td>{row.atd || '—'}</td><td>{row.handler || '—'}</td><td>{row.stand || '—'}</td><td>{row.riu || '—'}</td><td>{Number(row.paxArr || 0).toLocaleString('id-ID')}</td><td>{Number(row.paxDep || 0).toLocaleString('id-ID')}</td><td>{Number(row.baggageArrKg ?? row.baggageKg ?? 0).toLocaleString('id-ID')}</td><td>{Number(row.baggageDepKg || 0).toLocaleString('id-ID')}</td><td>{Number(row.cargoArrKg ?? row.cargoKg ?? 0).toLocaleString('id-ID')}</td><td>{Number(row.cargoDepKg || 0).toLocaleString('id-ID')}</td><td className="cell-remark">{row.remark || '—'}</td>{canWrite && <td><div className="row-actions"><button aria-label={`Ubah ${row.registration}`} title="Ubah" onClick={() => onEdit(row)}><Pencil size={14} /></button><button aria-label={`Hapus ${row.registration}`} title="Hapus" className="delete-action" onClick={() => onDelete(row)}><Trash2 size={14} /></button></div></td>}
  </tr>;
}
