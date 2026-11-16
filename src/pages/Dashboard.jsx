import { useMemo } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, Clock3, Luggage, Package, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { alertsForDay, dailyKpis, hourlyOccupancy, monthlyTraffic, parkingIntervals } from '../lib/analytics';
import { airportDate, formatDateLong, monthDays } from '../lib/time';
import { EmptyState, PageHeading, StatCard } from '../components/Shell';

function TrafficChart({ rows, date }) {
  const data = monthlyTraffic(rows, date); const days = monthDays(date);
  const ticks = Array.from({ length: Math.ceil(days / 5) + 1 }, (_, index) => Math.min(1 + index * 5, days));
  if (!data.length) return <EmptyState title="Belum ada pergerakan bulan ini" body="Grafik akan terisi setelah data pergerakan dicatat." />;
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height={205}><BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={3}>
    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
    <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} ticks={ticks} />
    <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
    <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 12 }} labelFormatter={label => `${label} ${new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'Asia/Makassar' }).format(new Date(`${date.slice(0, 7)}-01T12:00:00+08:00`))}`} />
    <Bar dataKey="arr" name="Kedatangan (ARR)" fill="var(--blue)" radius={[4, 4, 0, 0]} maxBarSize={12} />
    <Bar dataKey="dep" name="Keberangkatan (DEP)" fill="var(--blue-soft)" radius={[4, 4, 0, 0]} maxBarSize={12} />
  </BarChart></ResponsiveContainer><div className="chart-legend"><span><i className="legend-dot legend-arr" /> Kedatangan</span><span><i className="legend-dot legend-dep" /> Keberangkatan</span></div></div>;
}

function ParkingTimeline({ rows, date }) {
  const stands = ['Stand 1', 'Stand 2', 'Stand 3', 'Stand 4', 'Stand 5', 'Stand 6'];
  const intervals = parkingIntervals(rows, date);
  if (!intervals.length) return <EmptyState title="Apron belum memiliki blok pergerakan" body="Blok ON/OFF akan terlihat di timeline setelah dicatat." />;
  return <div className="timeline-scroll"><div className="timeline-axis"><span className="timeline-caption">PARKING STAND</span><div className="time-labels">{Array.from({ length: 7 }, (_, hour) => <span key={hour}>{String(hour * 4).padStart(2, '0')}:00</span>)}</div></div>
    {stands.map((stand, index) => <div className="timeline-row" key={stand}><div className="stand-name">{stand}</div><div className="timeline-track">{[1, 2, 3, 4, 5].map(n => <i key={n} className="timeline-grid-line" style={{ left: `${n * 16.666}%` }} />)}{intervals.filter(row => row.stand === stand).map(row => <div key={row.id} className={`flight-block flight-block-${index % 4} ${row.ongoing ? 'flight-ongoing' : ''}`} style={{ left: `${Math.max(0, row.start / 1440 * 100)}%`, width: `${Math.max(1.7, (row.end - row.start) / 1440 * 100)}%` }} title={`${row.registration} · ${row.flightArr || row.flightDep || 'Penerbangan'} · ${row.blockOn}–${row.blockOff || 'berlangsung'}`}><strong>{row.registration}</strong><span>{row.flightArr || row.flightDep || 'Rotasi'}</span></div>)}</div></div>)}
    <div className="timeline-foot"><span>00:00 WITA</span><span>Waktu lokal Asia/Makassar · Blok tanpa OFF ditampilkan sampai waktu sekarang.</span><span>24:00</span></div>
  </div>;
}

function Occupancy({ rows, date }) {
  const hours = hourlyOccupancy(rows, date); const max = Math.max(1, ...hours.map(item => item.count));
  if (!hours.some(item => item.count)) return <EmptyState title="Belum ada data okupansi" body="Isi Block ON untuk memantau jumlah pesawat per jam." />;
  return <div className="occupancy-chart"><div className="occupancy-y"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div><div className="occupancy-grid">{hours.map(item => <div className="occupancy-col" key={item.hour} title={`${String(item.hour).padStart(2, '0')}:00 · ${item.count} pesawat`}><div className={`occupancy-bar ${item.count >= 4 ? 'occupancy-high' : ''}`} style={{ height: `${item.count / max * 100}%` }} /><span>{item.hour % 3 === 0 ? String(item.hour).padStart(2, '0') : ''}</span></div>)}</div></div>;
}

export default function Dashboard({ rows, selectedDate, setSelectedDate }) {
  const dayRows = useMemo(() => rows.filter(row => row.date === selectedDate), [rows, selectedDate]);
  const kpis = useMemo(() => dailyKpis(dayRows), [dayRows]);
  const alerts = useMemo(() => alertsForDay(rows, selectedDate), [rows, selectedDate]);
  const remarks = dayRows.filter(row => row.remark?.trim());
  const dateLabel = formatDateLong(selectedDate);
  return <>
    <PageHeading eyebrow="PUSAT KENDALI APRON" title="Ringkasan operasional" description={`${dateLabel} · Bandar Udara A.P.T. Pranoto`} action={<label className="date-picker-label">Tanggal operasional<input name="operating-date" type="date" value={selectedDate || airportDate()} onChange={event => setSelectedDate(event.target.value || airportDate())} /></label>} />
    {dayRows.length ? <div className="stats-grid">
      <StatCard label="Total penerbangan" value={kpis.arr + kpis.dep} note={`${kpis.arr} kedatangan · ${kpis.dep} keberangkatan`} Icon={BriefcaseBusiness} />
      <StatCard label="Penumpang" value={(kpis.paxArr + kpis.paxDep).toLocaleString('id-ID')} note={`${kpis.paxArr.toLocaleString('id-ID')} ARR · ${kpis.paxDep.toLocaleString('id-ID')} DEP`} Icon={Users} tone="navy" />
      <StatCard label="Bagasi" value={`${kpis.baggage.toLocaleString('id-ID')} kg`} note="Akumulasi hari ini" Icon={Luggage} tone="amber" />
      <StatCard label="Kargo" value={`${kpis.cargo.toLocaleString('id-ID')} kg`} note="Akumulasi hari ini" Icon={Package} tone="green" />
    </div> : <div className="empty-day"><div className="empty-day-mark"><Clock3 size={22} /></div><div><strong>Belum ada data pada tanggal ini</strong><span>Ringkasan menampilkan data operasional yang benar-benar tercatat.</span></div></div>}
    <div className="dashboard-grid dashboard-grid-top">
      <section className="panel traffic-panel"><div className="panel-heading"><div><span className="panel-kicker">PERGERAKAN BULANAN</span><h2>Arus penerbangan</h2></div><span className="panel-period">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }).format(new Date(`${selectedDate.slice(0, 7)}-01T12:00:00+08:00`))}</span></div><TrafficChart rows={rows} date={selectedDate} /></section>
      <section className="panel alerts-panel"><div className="panel-heading"><div><span className="panel-kicker">PEMANTAUAN OTOMATIS</span><h2>Peringatan & catatan</h2></div><span className={`count-pill ${alerts.length ? 'count-warn' : ''}`}>{alerts.length} peringatan</span></div>
        {alerts.length ? <div className="alerts-list">{alerts.map((alert, index) => <div className="alert-item" key={`${alert.title}-${index}`}><div className={`alert-icon ${alert.type}`}><AlertTriangle size={16} /></div><div><strong>{alert.title}</strong><span>{alert.detail}</span></div></div>)}</div> : <div className="all-clear"><span className="all-clear-check">✓</span><div><strong>Tidak ada peringatan</strong><span>Semua pemeriksaan otomatis dalam batas normal.</span></div></div>}
        <div className="remarks-heading">REMARK OPERASIONAL <span>{remarks.length}</span></div>{remarks.length ? <ul className="remarks-list">{remarks.slice(0, 4).map(row => <li key={row.id}><span>{row.flightArr || row.flightDep || row.registration}</span>{row.remark}</li>)}</ul> : <div className="remarks-empty">Tidak ada catatan pada tanggal ini.</div>}
      </section>
    </div>
    <section className="panel timeline-panel"><div className="panel-heading"><div><span className="panel-kicker">00:00 — 24:00 WITA</span><h2>Okupansi parking stand</h2></div><span className="panel-note">Block ON sampai Block OFF</span></div><ParkingTimeline rows={rows} date={selectedDate} /></section>
    <section className="panel occupancy-panel"><div className="panel-heading"><div><span className="panel-kicker">PESAWAT DI APRON</span><h2>Okupansi apron per jam</h2></div><span className="panel-note">Waktu kedatangan dan keberangkatan pesawat</span></div><Occupancy rows={rows} date={selectedDate} /></section>
  </>;
}
