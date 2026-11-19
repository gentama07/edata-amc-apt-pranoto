import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Clock3, MapPin, Plane, RefreshCw, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState } from '../components/Shell';
import { supabase } from '../lib/supabase';

const airportCode = 'AAP';
const airportPosition = [-0.375556, 117.251389];

function validCoordinates(live) {
  if (!live || typeof live !== 'object') return false;
  const latitude = Number(live.latitude);
  const longitude = Number(live.longitude);
  return live.latitude !== null && live.latitude !== undefined && live.latitude !== ''
    && live.longitude !== null && live.longitude !== undefined && live.longitude !== ''
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function flightMapPopup(flights) {
  const popup = document.createElement('div');
  popup.className = 'flight-map-popup';
  flights.forEach(flight => {
    const item = document.createElement('div');
    item.className = 'flight-map-popup-item';
    const title = document.createElement('strong');
    title.textContent = flight.flight?.iata || flight.flight?.icao || flight.flight?.number || 'Penerbangan';
    const airline = document.createElement('span');
    airline.textContent = flight.airline?.name || 'Maskapai tidak diketahui';
    const route = document.createElement('small');
    const coordinates = validCoordinates(flight.live)
      ? `${Number(flight.live.latitude).toFixed(3)}, ${Number(flight.live.longitude).toFixed(3)}`
      : 'Koordinat tidak tersedia';
    const altitude = flight.live?.altitude != null ? ` · ${Number(flight.live.altitude).toLocaleString('id-ID')} ft` : '';
    route.textContent = `${flight.departure?.iata || '—'} → ${flight.arrival?.iata || '—'} · ${coordinates}${altitude}`;
    item.append(title, airline, route);
    popup.append(item);
  });
  return popup;
}

function FlightMap({ flights, updatedAt }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false, preferCanvas: true }).setView(airportPosition, 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    const timer = window.setTimeout(resize, 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const airportIcon = L.divIcon({ className: 'flight-map-airport-icon', html: '<span>AAP</span>', iconSize: [38, 38], iconAnchor: [19, 19] });
    L.marker(airportPosition, { icon: airportIcon, keyboard: true }).bindPopup('<strong>Bandara A.P.T. Pranoto · AAP</strong>').addTo(layer);

    const groups = new Map();
    flights.filter(flight => validCoordinates(flight.live)).forEach(flight => {
      const lat = Number(flight.live.latitude);
      const lng = Number(flight.live.longitude);
      const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
      groups.set(key, [...(groups.get(key) || []), flight]);
    });
    const positions = [airportPosition];
    groups.forEach((items, key) => {
      const [lat, lng] = key.split(':').map(Number);
      const direction = Number(items[0]?.live?.direction);
      const rotation = Number.isFinite(direction) ? ((direction % 360) + 360) % 360 : 0;
      const icon = L.divIcon({
        className: 'flight-map-aircraft-icon',
        html: `<span><svg viewBox="0 0 24 24" style="transform:rotate(${rotation}deg)" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z"/></svg>${items.length > 1 ? `<b>${items.length}</b>` : ''}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      L.marker([lat, lng], { icon, keyboard: true }).bindPopup(flightMapPopup(items)).addTo(layer);
      positions.push([lat, lng]);
    });
    if (positions.length > 1) map.fitBounds(L.latLngBounds(positions).pad(0.18), { maxZoom: 8, animate: true });
    else map.setView(airportPosition, 7, { animate: true });
  }, [flights, updatedAt]);

  const liveCount = flights.filter(flight => validCoordinates(flight.live)).length;
  return <section className="flight-map-panel" aria-label="Peta posisi pesawat">
    <div className="flight-map-heading">
      <div className="flight-map-heading-copy"><strong>Peta pergerakan</strong><span>Posisi tersedia untuk {liveCount} dari {flights.length} penerbangan</span></div>
      <span className="flight-map-source"><i />Data posisi · Aviationstack</span>
    </div>
    <div className="flight-map-canvas" ref={containerRef} role="application" aria-label="Peta interaktif posisi penerbangan di sekitar Samarinda" />
    {!liveCount && <p className="flight-map-note">Koordinat pesawat belum tersedia pada hasil ini. Tekan Perbarui data untuk meminta hasil baru dari penyedia.</p>}
    {!!liveCount && <p className="flight-map-note">Peta memakai koordinat terakhir yang dikirim Aviationstack. Posisi tidak bergerak otomatis; Perbarui data meminta pengambilan berikutnya.</p>}
  </section>;
}

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
    <td><strong>{localTime(departure.estimated || departure.scheduled || departure.actual)}</strong><span className="flight-airline">{departure.gate ? `Gate ${departure.gate}` : departure.terminal ? `Terminal ${departure.terminal}` : 'Waktu WITA'}</span></td>
    <td><strong>{localTime(arrival.estimated || arrival.scheduled || arrival.actual)}</strong><span className="flight-airline">{arrival.gate ? `Gate ${arrival.gate}` : arrival.terminal ? `Terminal ${arrival.terminal}` : 'Waktu WITA'}</span></td>
    <td>{validCoordinates(live)
      ? <span className="flight-position"><MapPin size={13} /><span>{Number(live.latitude).toFixed(3)}, {Number(live.longitude).toFixed(3)}{live.altitude != null && <small>{Number(live.altitude).toLocaleString('id-ID')} ft</small>}</span></span>
      : <span className="flight-muted">Belum ada koordinat</span>}</td>
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
  const liveCount = flights.filter(flight => validCoordinates(flight.live)).length;
  const activeCount = flights.filter(flight => String(flight.flight_status || '').toLowerCase() === 'active').length;
  const landedCount = flights.filter(flight => String(flight.flight_status || '').toLowerCase() === 'landed').length;

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
      const response = invokeError?.context;
      const responseBody = response && typeof response.clone === 'function'
        ? await response.clone().json().catch(() => null)
        : null;
      setError(data?.error || responseBody?.error || invokeError?.message || 'Data penerbangan belum dapat diambil.');
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

  const setFlightDirection = nextDirection => {
    setDirection(nextDirection);
    setAppliedSearch('');
    setSearch('');
    loadFlights('', nextDirection);
  };

  const title = direction === 'arrivals' ? 'Kedatangan ke AAP' : 'Keberangkatan dari AAP';
  return <>
    <div className="flight-page-heading">
      <div><span className="flight-page-kicker">BANDAR UDARA A.P.T. PRANOTO · AAP / WALS</span><h1>Tracking penerbangan</h1><p>Pantau jadwal, status, dan posisi yang tersedia untuk kedatangan atau keberangkatan.</p></div>
      <button className="button-primary" onClick={() => loadFlights()} disabled={loading}><RefreshCw size={15} className={loading ? 'flight-refreshing' : ''} />Perbarui data</button>
    </div>
    {!loading && !error && flights.length > 0 && <section className="flight-summary" aria-label="Ringkasan penerbangan">
      <article className="flight-summary-card"><span className="flight-summary-icon"><Plane size={17} /></span><div><small>Penerbangan</small><strong>{flights.length}</strong><span>hasil untuk AAP</span></div></article>
      <article className="flight-summary-card"><span className="flight-summary-icon is-active"><Activity size={17} /></span><div><small>Sedang berlangsung</small><strong>{activeCount}</strong><span>status dari penyedia</span></div></article>
      <article className="flight-summary-card"><span className="flight-summary-icon is-position"><MapPin size={17} /></span><div><small>Posisi tersedia</small><strong>{liveCount}</strong><span>dapat dilihat di peta</span></div></article>
      <article className="flight-summary-card"><span className="flight-summary-icon is-landed"><CheckCircle2 size={17} /></span><div><small>Sudah mendarat</small><strong>{landedCount}</strong><span>status dari penyedia</span></div></article>
    </section>}
    <section className="flight-tracking-panel">
      <div className="flight-tracking-toolbar">
        <div className="flight-tracking-title"><span className="flight-tracking-icon"><Plane size={18} /></span><div><strong>{appliedSearch ? `Penerbangan ${appliedSearch}` : title}</strong><span>{direction === 'arrivals' ? 'Menuju Bandar Udara A.P.T. Pranoto' : 'Berangkat dari Bandar Udara A.P.T. Pranoto'}</span></div></div>
        <form className="flight-search" onSubmit={submitSearch}>
          <label className="flight-search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} maxLength={12} placeholder="Cari kode · mis. QG422" aria-label="Cari kode penerbangan" /></label>
          <button className="button-secondary" type="submit" disabled={loading}>Cari</button>
        </form>
      </div>
      <div className="flight-tracking-meta">
        <div className="flight-direction-group" role="group" aria-label="Pilih arah penerbangan">
          <button type="button" className={direction === 'arrivals' ? 'is-selected' : ''} aria-pressed={direction === 'arrivals'} onClick={() => setFlightDirection('arrivals')} disabled={loading}>Kedatangan</button>
          <button type="button" className={direction === 'departures' ? 'is-selected' : ''} aria-pressed={direction === 'departures'} onClick={() => setFlightDirection('departures')} disabled={loading}>Keberangkatan</button>
        </div>
        <span className="flight-updated"><Clock3 size={15} /><span>{lastUpdated ? <>Pembaruan manual<strong>{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(lastUpdated)} WITA</strong></> : <>Pembaruan<strong>Menunggu data</strong></>}</span></span>
      </div>
      {error ? <div className="flight-error" role="alert"><strong>Data penerbangan belum tersedia</strong><span>{error}</span><button className="button-secondary" onClick={() => loadFlights()}>Coba lagi</button></div>
        : loading ? <div className="flight-loading" role="status"><span className="flight-loading-mark"><Plane size={18} /></span><strong>Mengambil data penerbangan…</strong></div>
          : flights.length ? <><FlightMap flights={flights} updatedAt={lastUpdated} /><div className="flight-list-heading"><div><h2>Daftar penerbangan</h2><p>Waktu ditampilkan dalam WITA. Pilih pesawat di peta untuk melihat detail posisi.</p></div><span>{flights.length} hasil</span></div><div className="flight-table-scroll"><table className="flight-table"><thead><tr><th>Penerbangan</th><th>Rute</th><th>Berangkat · WITA</th><th>Tiba · WITA</th><th>Posisi terakhir</th><th>Status</th></tr></thead><tbody>{flights.map((flight, index) => <FlightRow key={`${flight.flight?.iata || flight.flight?.icao || 'flight'}-${flight.flight_date || ''}-${index}`} flight={flight} />)}</tbody></table></div></>
            : <div className="flight-empty"><EmptyState title="Belum ada data penerbangan" body={appliedSearch ? 'Kode penerbangan belum ditemukan. Periksa kembali kode lalu coba lagi.' : `Aviationstack belum mengembalikan penerbangan untuk ${direction === 'arrivals' ? 'kedatangan' : 'keberangkatan'} AAP.`} /></div>}
      <div className="flight-source"><span><i />Sumber data: Aviationstack</span><span>{lastUpdated ? `Terakhir diminta ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(lastUpdated)} WITA` : 'Belum ada pembaruan'}</span></div>
    </section>
  </>;
}

