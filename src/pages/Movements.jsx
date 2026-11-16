import { useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpDown, Download, FilterX, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { airportOptions } from '../config/airportOptions';
import { useModalFocus } from '../hooks/useModalFocus';
import { getDirection } from '../lib/analytics';
import { downloadCsv } from '../lib/csv';
import { PageHeading } from '../components/Shell';

export default function Movements({ rows, selectedDate, canWrite, onInput, onEdit, onDelete }) {
  const [query, setQuery] = useState(''); const [operator, setOperator] = useState(''); const [direction, setDirection] = useState(''); const [confirm, setConfirm] = useState(null); const [sort, setSort] = useState({ key: 'date', asc: false }); const [page, setPage] = useState(0);
  const dialogRef = useRef(null);
  useModalFocus(dialogRef, { enabled: Boolean(confirm), onEscape: () => setConfirm(null), initialFocusSelector: '.button-secondary' });
  const filtered = useMemo(() => rows.filter(row => {
    const text = [row.operator, row.registration, row.flightArr, row.flightDep, row.origin, row.destination, row.remark].join(' ').toLocaleLowerCase('id-ID');
    const directionValue = getDirection(row);
    return (!query || text.includes(query.toLocaleLowerCase('id-ID'))) && (!operator || row.operator === operator) && (!direction || direction === directionValue || direction === 'arr' && row.flightArr || direction === 'dep' && row.flightDep || direction === 'turnaround' && row.flightArr && row.flightDep) && (!selectedDate || row.date === selectedDate);
  }).sort((a, b) => { const av = a[sort.key] || ''; const bv = b[sort.key] || ''; return String(av).localeCompare(String(bv), 'id') * (sort.asc ? 1 : -1); }), [rows, query, operator, direction, selectedDate, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50)); const currentPage = Math.min(page, pageCount - 1); const visibleRows = filtered.slice(currentPage * 50, currentPage * 50 + 50);
  const reset = () => { setQuery(''); setOperator(''); setDirection(''); setPage(0); };
  const changeSort = key => setSort(current => ({ key, asc: current.key === key ? !current.asc : true }));
  const exportRows = () => downloadCsv(filtered, `log-amc-${selectedDate || 'semua-tanggal'}.csv`);
  const confirmDelete = async () => { if (confirm) { await onDelete(confirm.id); setConfirm(null); } };

  return <>
    <PageHeading eyebrow="DATA OPERASIONAL" title="Log pergerakan" description="Catatan kedatangan, keberangkatan, dan aktivitas apron." action={canWrite && <button className="button-primary" onClick={onInput}><Plus size={17} />Input data</button>} />
    <section className="panel log-panel">
      <div className="log-toolbar"><div className="search-field"><Search size={17} /><input autoComplete="off" name="movement-search" aria-label="Cari pergerakan" placeholder="Cari operator, registrasi, penerbangan…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div>
        <label className="filter-label">Operator<select name="operator-filter" aria-label="Filter operator" value={operator} onChange={event => { setOperator(event.target.value); setPage(0); }}><option value="">Semua operator</option>{airportOptions.operators.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-label">Arah<select name="direction-filter" aria-label="Filter arah penerbangan" value={direction} onChange={event => { setDirection(event.target.value); setPage(0); }}><option value="">Semua arah</option><option value="arr">Kedatangan (ARR)</option><option value="dep">Keberangkatan (DEP)</option><option value="turnaround">Transit / Turnaround</option></select></label>
        <button className="button-secondary filter-reset" onClick={reset}><FilterX size={15} />Reset filter</button>
      </div>
      <div className="table-summary"><span>Menampilkan <strong>{filtered.length ? `${currentPage * 50 + 1}–${Math.min(filtered.length, currentPage * 50 + 50)}` : '0'}</strong> dari <strong>{filtered.length}</strong> cocok · {rows.filter(r => r.date === selectedDate).length} total hari ini</span><button className="text-action" onClick={exportRows}><Download size={15} />Ekspor CSV</button></div>
      <div className="table-scroll"><table className="movement-table"><thead><tr>
        {[["operator","Operator"],["aircraftType","Tipe"],["registration","Registrasi"],["flightArr","No. ARR"],["flightDep","No. DEP"],["origin","Origin"],["destination","Destination"],["sta","STA"],["ata","ATA"],["blockOn","Block ON"],["std","STD"],["blockOff","Block OFF"],["atd","ATD"],["handler","Ground handling"],["stand","Stand"],["riu","RIU"],["paxArr","Pax ARR"],["paxDep","Pax DEP"],["baggageKg","Bagasi kg"],["cargoKg","Kargo kg"],["remark","Remark"]].map(([key,label]) => <th key={key}><button className="sort-button" onClick={() => changeSort(key)}>{label}<ArrowUpDown size={11} /></button></th>)}{canWrite && <th>Aksi</th>}
      </tr></thead><tbody>{filtered.length ? visibleRows.map(row => <tr key={row.id}>
        <td className="cell-operator">{row.operator}</td><td>{row.aircraftType}</td><td><span className="reg-chip">{row.registration}</span></td><td>{row.flightArr || '—'}</td><td>{row.flightDep || '—'}</td><td>{row.origin || '—'}</td><td>{row.destination || '—'}</td><td>{row.sta || '—'}</td><td>{row.ata || '—'}</td><td>{row.blockOn || '—'}</td><td>{row.std || '—'}</td><td>{row.blockOff || <span className="onblock-chip">On-block</span>}</td><td>{row.atd || '—'}</td><td>{row.handler || '—'}</td><td>{row.stand || '—'}</td><td>{row.riu || '—'}</td><td>{Number(row.paxArr || 0).toLocaleString('id-ID')}</td><td>{Number(row.paxDep || 0).toLocaleString('id-ID')}</td><td>{Number(row.baggageKg || 0).toLocaleString('id-ID')}</td><td>{Number(row.cargoKg || 0).toLocaleString('id-ID')}</td><td className="cell-remark">{row.remark || '—'}</td>{canWrite && <td><div className="row-actions"><button aria-label={`Ubah ${row.registration}`} title="Ubah" onClick={() => onEdit(row)}><Pencil size={14} /></button><button aria-label={`Hapus ${row.registration}`} title="Hapus" className="delete-action" onClick={() => setConfirm(row)}><Trash2 size={14} /></button></div></td>}
      </tr>) : <tr><td className="table-empty" colSpan={canWrite ? 22 : 21}><div className="empty-table-icon"><ArrowDownToLine size={18} /></div><strong>Tidak ada data yang cocok</strong><span>Coba ubah filter atau pilih tanggal operasional lain.</span></td></tr>}</tbody></table></div>
      <div className="table-foot"><span>Data diperbarui mengikuti koneksi aktif.</span><div className="table-pagination">{pageCount > 1 && <><button className="button-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><span>Halaman {currentPage + 1} dari {pageCount}</span><button className="button-secondary" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></>}</div><span>Arah: ARR · DEP · Transit</span></div>
    </section>
    {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setConfirm(null)}><section ref={dialogRef} className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" tabIndex="-1"><div className="confirm-icon"><Trash2 size={19} aria-hidden="true" /></div><h2 id="delete-title">Hapus pergerakan?</h2><p>Data {confirm.registration} · {confirm.flightArr || confirm.flightDep || 'penerbangan ini'} akan dihapus dari log.</p><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setConfirm(null)}>Batal</button><button type="button" className="button-danger" onClick={confirmDelete}>Hapus data</button></div></section></div>}
  </>;
}
