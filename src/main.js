import { createClient } from '@supabase/supabase-js'
import './style.css'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const n = (x) => Number(x || 0), fmt = (x) => n(x).toLocaleString('id-ID'), hm = (t) => (t ? t.slice(0, 5) : '-')
const LOGO = import.meta.env.BASE_URL + 'logo.png', RT = ['BDJ', 'SUB', 'CGK', 'UPG', 'BEJ']
const OPS = { 'Wings Air': ['AT7', 'GSA'], Citilink: ['A320', 'GAPURA'], 'Garuda Indonesia': ['B738', 'GAPURA'], 'Super Air Jet': ['A320', 'GSA'], 'Batik Air': ['A320', 'GSA'], 'Indonesia Army': ['B412', 'AMC'] }
const S = { uid: null, role: null, view: 'dash', date: new Date(Date.now() + 288e5).toISOString().slice(0, 10), rows: [], month: [], surat: [], q: '' } // 288e5 = WITA (UTC+8)
const can = () => S.role === 'personel' || S.role === 'admin'
const dl = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const idle = () => !['INPUT', 'SELECT'].includes(document.activeElement?.tagName)
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('s'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('s'), 3600) }

async function load() {
  const p = S.date.slice(0, 7), last = new Date(+S.date.slice(0, 4), +S.date.slice(5, 7), 0).getDate()
  const [a, b] = await Promise.all([
    sb.from('movements').select('*').eq('tanggal', S.date).order('block_on', { nullsFirst: false }),
    sb.from('daily_summary').select('*').gte('tanggal', p + '-01').lte('tanggal', `${p}-${String(last).padStart(2, '0')}`).order('tanggal'),
  ])
  S.rows = a.data || []; S.month = b.data || []
}
const loadSurat = async () => { S.surat = (await sb.from('surat').select('*').order('tanggal', { ascending: false }).limit(300)).data || [] }

async function boot(session) {
  if (!session) { S.uid = null; S.role = null; sb.removeAllChannels(); S.ch = null; return render() }
  S.uid = session.user.id
  const { data: p } = await sb.from('profiles').select('role').eq('id', S.uid).single()
  S.role = p?.role || 'pimpinan'
  await Promise.all([load(), loadSurat()]); render()
  if (!S.ch) S.ch = sb.channel('live') // real-time: dashboard ikut berubah saat personel menyimpan data
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, async () => { await load(); if (idle()) render() })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'surat' }, async () => { await loadSurat(); if (idle()) render() })
    .subscribe()
}
sb.auth.onAuthStateChange((e, s) => {
  if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(e) || (e === 'SIGNED_IN' && s?.user.id === S.uid)) return
  setTimeout(() => boot(s), 0)
})

const dateBar = () => `<div class="db"><label for="dt">Tanggal</label><input type="date" id="dt" value="${S.date}"><b>${dl(S.date)}</b></div>`
function chart() {
  const days = new Date(+S.date.slice(0, 4), +S.date.slice(5, 7), 0).getDate(), m = {}, W = 620, H = 160, bw = W / days
  S.month.forEach((r) => (m[+r.tanggal.slice(8)] = r))
  const mx = Math.max(1, ...S.month.map((r) => r.flt_arr + r.flt_dep))
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%" role="img" aria-label="Jumlah pergerakan per hari">${[...Array(days)].map((_, i) => {
    const r = m[i + 1] || { flt_arr: 0, flt_dep: 0 }, a = r.flt_arr / mx * H, b = r.flt_dep / mx * H, x = i * bw + 2, on = i + 1 === +S.date.slice(8)
    return `<g opacity="${on ? 1 : .7}"><rect x="${x}" y="${H - a - b}" width="${bw - 4}" height="${b}" rx="2" fill="var(--amber)"/><rect x="${x}" y="${H - a}" width="${bw - 4}" height="${a}" rx="2" fill="var(--teal)"/><text x="${x + bw / 2 - 2}" y="${H + 14}" font-size="9" text-anchor="middle" fill="var(--mu)">${i + 1}</text></g>`
  }).join('')}</svg>`
}
function dash() {
  const k = S.month.find((r) => r.tanggal === S.date) || {}
  const cards = [['Penerbangan', n(k.flt_arr) + n(k.flt_dep), `Datang ${n(k.flt_arr)} · Berangkat ${n(k.flt_dep)}`], ['Penumpang', n(k.pax_arr) + n(k.pax_dep), `Datang ${fmt(k.pax_arr)} · Berangkat ${fmt(k.pax_dep)}`],
    ['Bagasi (kg)', n(k.bagasi_arr) + n(k.bagasi_dep), `Datang ${fmt(k.bagasi_arr)} · Berangkat ${fmt(k.bagasi_dep)}`], ['Kargo (kg)', n(k.kargo_arr) + n(k.kargo_dep), `Datang ${fmt(k.kargo_arr)} · Berangkat ${fmt(k.kargo_dep)}`]]
  return `<section class="hero"><div><h2>${dl(S.date)}</h2><p>Apron Movement Control · Bandar Udara APT Pranoto, Samarinda</p></div><div class="tenun"></div></section>${dateBar()}
  <div class="kpis">${cards.map(([l, v, s]) => `<div class="card kpi"><small>${l}</small><b>${fmt(v)}</b><small>${s}</small></div>`).join('')}</div>
  <div class="card"><h3>Pergerakan per hari bulan ini</h3><div class="lgd"><span><i style="background:var(--teal)"></i>Datang</span><span><i style="background:var(--amber)"></i>Berangkat</span></div>${chart()}</div>`
}
const log = () => `${dateBar()}<div class="tw"><table><thead><tr>${['Operator', 'Reg', 'Flt ARR', 'Flt DEP', 'Rute', 'ATA', 'Block ON', 'Block OFF', 'ATD', 'GH', 'PS', 'Pax ARR', 'Pax DEP', 'Remark'].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
  S.rows.map((r) => `<tr><td>${esc(r.operator)}</td><td>${esc(r.reg)}</td><td>${esc(r.flt_arr || '-')}</td><td>${esc(r.flt_dep || '-')}</td><td>${esc([r.orig, r.dest].filter(Boolean).join('–') || '-')}</td><td>${hm(r.ata)}</td><td>${hm(r.block_on)}</td><td>${hm(r.block_off)}</td><td>${hm(r.atd)}</td><td>${esc(r.gh)}</td><td>${esc(r.parking_stand)}</td><td>${r.pax_arr}</td><td>${r.pax_dep}</td><td>${esc(r.remark)}</td></tr>`).join('') ||
  '<tr><td colspan="14" class="empty">Belum ada pergerakan pada tanggal ini.</td></tr>'}</tbody></table></div>`

const F = [['operator', 'Operator', 's', Object.keys(OPS)], ['reg', 'Registrasi', 't'], ['flt_arr', 'Flight ARR', 't'], ['flt_dep', 'Flight DEP', 't'], ['orig', 'Origin', 's', RT], ['dest', 'Destination', 's', RT], ['parking_stand', 'Parking stand', 'n'], ['riu', 'RIU', 's', ['22', '04']],
  ['sched_arr', 'Sched ARR', 'h'], ['ata', 'ATA', 'h'], ['block_on', 'Block ON', 'h'], ['sched_dep', 'Sched DEP', 'h'], ['block_off', 'Block OFF', 'h'], ['atd', 'ATD', 'h'],
  ['pax_arr', 'Pax datang', 'n'], ['pax_dep', 'Pax berangkat', 'n'], ['bagasi_arr', 'Bagasi datang (kg)', 'n'], ['bagasi_dep', 'Bagasi berangkat (kg)', 'n'], ['kargo_arr', 'Kargo datang (kg)', 'n'], ['kargo_dep', 'Kargo berangkat (kg)', 'n'], ['remark', 'Remark', 't']]
const field = ([id, l, t, o]) => `<div><label for="${id}">${l}</label>${t === 's' ? `<select id="${id}">${o.map((x) => `<option>${x}</option>`).join('')}</select>` : `<input id="${id}" type="${{ h: 'time', n: 'number', t: 'text' }[t]}" ${t === 'n' ? 'min="0"' : ''}>`}</div>`
const inp = () => `${dateBar()}<form id="f" class="card"><h3>Pergerakan pesawat baru</h3><div class="g">${F.map(field).join('')}</div><p id="hint" class="err" style="color:var(--mu)"></p><p id="fe" class="err"></p><button class="btn pri">Simpan pergerakan</button></form>`
async function save(e) {
  e.preventDefault()
  const v = (id) => $('#' + id).value.trim(), [t, gh] = OPS[v('operator')]
  const o = { tanggal: S.date, operator: v('operator'), ac_type: t, gh, reg: v('reg').toUpperCase(), riu_arr: v('flt_arr') ? v('riu') : null, riu_dep: v('flt_dep') ? v('riu') : null, remark: v('remark') || null, parking_stand: +v('parking_stand') || null }
  ;['flt_arr', 'flt_dep', 'orig', 'dest', 'sched_arr', 'ata', 'block_on', 'sched_dep', 'block_off', 'atd'].forEach((k) => (o[k] = v(k).toUpperCase() || null))
  ;['pax_arr', 'pax_dep', 'bagasi_arr', 'bagasi_dep', 'kargo_arr', 'kargo_dep'].forEach((k) => (o[k] = +v(k) || 0))
  if (!o.reg) return ($('#fe').textContent = 'Isi registrasi pesawat.')
  const { error } = await sb.from('movements').insert(o)
  if (error) return ($('#fe').textContent = error.message.includes('time_order') ? 'Urutan waktu tidak logis: ATA ≤ Block ON ≤ Block OFF ≤ ATD.' : error.message.includes('ada_flight') ? 'Isi minimal satu nomor penerbangan (ARR atau DEP).' : error.message)
  toast('Pergerakan tersimpan'); S.view = 'log'; await load(); render()
}

const sList = () => {
  const q = S.q.toLowerCase(), f = S.surat.filter((x) => (x.nama_file + ' ' + x.kategori).toLowerCase().includes(q))
  return f.map((x) => `<a class="file" href="${esc(x.drive_url)}" target="_blank" rel="noopener"><div><b>${esc(x.nama_file)}</b><small>${esc(x.kategori)} · ${esc(x.tanggal)}</small></div><span class="btn">Buka di Drive</span></a>`).join('') || '<p class="empty">Belum ada surat. Unggah surat pertama atau sinkronkan dari folder Drive.</p>'
}
const arc = () => `<div class="card"><h3>Surat masuk (Google Drive)</h3><div class="bar"><input id="q" placeholder="Cari nama file atau kategori" value="${esc(S.q)}" aria-label="Cari surat">${can() ? `<select id="kat" aria-label="Kategori"><option>Surat Cancel</option><option>Re-ETD</option><option>PTR</option><option>Lainnya</option></select><button class="btn" id="sync">Sinkronkan dari Drive</button><label class="btn pri">Unggah ke Drive<input id="up" type="file" hidden></label>` : ''}</div><div id="sl">${sList()}</div></div>`
async function drive(body) {
  toast('Menghubungi Google Drive…')
  const { data, error } = await sb.functions.invoke('drive', { body })
  let m = data?.error
  if (error) { m = error.message; try { m = (await error.context.json()).error } catch {} }
  if (m) return toast('Drive: ' + m)
  await loadSurat(); render(); toast(data.file ? `Terunggah ke Drive: ${data.file}` : `Sinkron selesai · ${data.count} berkas di folder`)
}

const VIEW = { dash, log, inp, arc }
function login(app) {
  app.innerHTML = `<div class="lg"><div class="zig"></div><form id="lf"><img src="${LOGO}" alt="APT Pranoto Airport"><h1>Masuk ke E-data AMC</h1><label for="em">Email</label><input id="em" type="email" required autocomplete="username"><label for="pw">Kata sandi</label><input id="pw" type="password" required autocomplete="current-password"><p id="le" class="err"></p><button class="btn pri">Masuk</button></form><div class="tenun"></div></div>`
  $('#lf').onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value }); if (error) $('#le').textContent = 'Email atau kata sandi salah.' }
}
function render() {
  const app = $('#app'); if (!S.uid) return login(app)
  if (S.view === 'inp' && !can()) S.view = 'dash'
  app.innerHTML = `<header><img class="logo" src="${LOGO}" alt="APT Pranoto Airport"><span class="sp"></span><span class="pill"><i class="dot"></i>${esc(S.role)}</span><button class="btn" id="out">Keluar</button></header><div class="tenun"></div>
  <nav>${[['dash', 'Ringkasan'], ['log', 'Log pergerakan'], ...(can() ? [['inp', 'Input data']] : []), ['arc', 'Surat masuk']].map(([v, l]) => `<button class="${S.view === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</nav><main>${VIEW[S.view]()}</main>`
  $('#out').onclick = () => sb.auth.signOut()
  document.querySelectorAll('nav [data-v]').forEach((b) => (b.onclick = () => { S.view = b.dataset.v; S.q = ''; render() }))
  const dt = $('#dt'); if (dt) dt.onchange = async () => { if (dt.value) { S.date = dt.value; await load(); render() } }
  const q = $('#q'); if (q) q.oninput = () => { S.q = q.value; $('#sl').innerHTML = sList() }
  const f = $('#f'); if (f) { const op = $('#operator'), h = () => ($('#hint').textContent = `Otomatis: A/C ${OPS[op.value][0]} · Ground handling ${OPS[op.value][1]}`); op.onchange = h; h(); f.onsubmit = save }
  const sy = $('#sync'); if (sy) sy.onclick = () => drive({ action: 'sync' })
  const up = $('#up'); if (up) up.onchange = () => { if (up.files[0]) { const fd = new FormData(); fd.append('file', up.files[0]); fd.append('kategori', $('#kat').value); drive(fd) } }
}
