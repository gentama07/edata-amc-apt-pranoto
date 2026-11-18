import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, MapPin, Plane, RefreshCw, Search } from 'lucide-react';
import { EmptyState, PageHeading } from '../components/Shell';
import { supabase } from '../lib/supabase';

const airportCode = 'AAP';

function localTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusLabel(status) {
  const labels = { active: 'Berlangsung', scheduled: 'Terjadwal', landed: 'Mendarat', cancelled: 'Dibatalkan', diverted: 'Dialihkan' };
  return labels[String(status || '').toLowerCase()] || status || 'Tidak diketahui';
}

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  return ['cancelled', 'diverted'].includes(value) ? 'flight-status-warn' : value === 'landed' ? 'flight-status-done' : value === 'active' ? 'flight-status-live' : 'flight-status-scheduled';
}

function FlightRow({ flight }) {
  const departure = flight.departure || {};
  const arrival = flight.arrival || {};
  const live = flight.live || {};
  const number = flight.flight?.iata || flight.flight?.icao || flight.flight?.number || '—';
  const route = [departure.iata, arrival.iata].filter(Boolean).join(' → ') || 'Rute belum tersedia';
  return <tr>
    <td><strong className="flight-number">{number}</strong><span className="flight-airline">{flight.airline?.name || 'Maskapai tidak diketahui'}</span></td>
    <td><span className="flight-route">{route}</span><span className="flight-airports">{departure.airport || 'Asal belum tersedia'} → {arrival.airport || 'Tujuan belum tersedia'}</span></td>
    <td><strong>{localTime(departure.estimated || departure.scheduled || departure.actual)}</strong><span className="flight-airline">{departure.gate ? `Gate ${departure.gate}` : departure.terminal ? `Terminal ${departure.terminal}` : departure.iata || '—'}</span></td>
    <td><strong>{localTime(arrival.estimated || arrival.scheduled || arrival.actual)}</strong><span className="flight-airline">{arrival.gate ? `Gate ${arrival.gate}` : arrival.terminal ? `Terminal ${arrival.terminal}` : arrival.iata || '—'}</span></td>
    <td>{Number.isFinite(Number(live.latitude)) && Number.isFinite(Number(live.longitude))
      ? <span className="flight-position"><MapPin size={13} />{Number(live.latitude).toFixed(2)}, {Number(live.longitude).toFixed(2)}{live.altitude != null && <small>{Number(live.altitude).toLocaleString('id-ID')} ft</small>}</span>
      : <span className="flight-muted">Posisi live belum tersedia</span>}</td>
    <td><span className={`flight-status ${statusClass(flight.flight_status)}`}>{statusLabel(flight.flight_status)}</span></td>
  </tr>;
}

export default function FlightTracking() {
  const [direction, setDirection] = useState('arrivals');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const initialRequestStarted = useRef(false);

  const loadFlights = useCallback(async (flightIata = appliedSearch, nextDirection = direction) => {
    if (!supabase) {
      setError('Koneksi layanan belum dikonfigurasi.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('flight-tracking', {
      body: { airport: airportCode, direction: nextDirection, flightIata },
    });
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Data penerbangan belum dapat diambil.');
      setLoading(false);
      return;
    }
    setFlights(Array.isArray(data?.data) ? data.data : []);
    setLastUpdated(new Date());
    setLoading(false);
  }, [appliedSearch, direction]);

  useEffect(() => {
    if (initialRequestStarted.current) return;
    initialRequestStarted.current = true;
    loadFlights('');
  }, [loadFlights]);

  const submitSearch = event => {
    event.preventDefault();
    const nextSearch = search.trim().toUpperCase().replace(/\s+/g, '');
    setAppliedSearch(nextSearch);
    loadFlights(nextSearch);
  };

  const setFlightDirection = event => {
    const nextDirection = event.target.value;
    setDirection(nextDirection);
    setAppliedSearch('');
    setSearch('');
    loadFlights('', nextDirection);
  };

  const title = direction === 'arrivals' ? 'Kedatangan ke AAP' : 'Keberangkatan dari AAP';
  return <>
    <PageHeading title="Tracking penerbangan" action={<button className="button-primary" onClick={() => loadFlights()} disabled={loading}><RefreshCw size={15} className={loading ? 'flight-refreshing' : ''} />Perbarui data</button>} />
    <section className="flight-tracking-panel">
      <div className="flight-tracking-toolbar">
        <div className="flight-tracking-title"><span className="flight-tracking-icon"><Plane size={18} /></span><div><strong>{appliedSearch ? `Penerbangan ${appliedSearch}` : title}</strong><span>Bandara A.P.T. Pranoto · {airportCode}</span></div></div>
        <form className="flight-search" onSubmit={submitSearch}>
          <label className="flight-search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} maxLength={12} placeholder="Cari kode penerbangan" aria-label="Cari kode penerbangan" /></label>
          <button className="button-secondary" type="submit" disabled={loading}>Cari</button>
        </form>
      </div>
      <div className="flight-tracking-meta">
        <label className="flight-direction-label" htmlFor="flight-direction">Pergerakan
          <select id="flight-direction" className="flight-direction" value={direction} onChange={setFlightDirection} disabled={loading}>
            <option value="arrivals">Kedatangan</option>
            <option value="departures">Keberangkatan</option>
          </select>
        </label>
        <span className="flight-updated"><Clock3 size={14} />{lastUpdated ? `Diperbarui ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(lastUpdated)} WITA` : 'Menunggu data'}</span>
      </div>
      {error ? <div className="flight-error" role="alert"><strong>Data penerbangan belum tersedia</strong><span>{error}</span><button className="button-secondary" onClick={() => loadFlights()}>Coba lagi</button></div>
        : loading ? <div className="flight-loading" role="status"><span className="flight-loading-mark"><Plane size={18} /></span><strong>Mengambil data penerbangan…</strong></div>
          : flights.length ? <div className="flight-table-scroll"><table className="flight-table"><thead><tr><th>Penerbangan</th><th>Rute</th><th>Berangkat</th><th>Tiba</th><th>Posisi</th><th>Status</th></tr></thead><tbody>{flights.map((flight, index) => <FlightRow key={`${flight.flight?.iata || flight.flight?.icao || 'flight'}-${flight.flight_date || ''}-${index}`} flight={flight} />)}</tbody></table></div>
            : <div className="flight-empty"><EmptyState title="Belum ada data penerbangan" body={appliedSearch ? 'Kode penerbangan belum ditemukan. Periksa kembali kode lalu coba lagi.' : `Aviationstack belum mengembalikan penerbangan untuk ${direction === 'arrivals' ? 'kedatangan' : 'keberangkatan'} AAP.`} /></div>}
      <div className="flight-source"><span><i />Sumber Aviationstack</span><span>{flights.length} penerbangan</span></div>
    </section>
  </>;
}

