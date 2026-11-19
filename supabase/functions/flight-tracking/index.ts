import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const cache = new Map<string, { expiresAt: number; payload: unknown }>()
const airportIata = 'AAP'
const cacheTtlMs = 30_000
const aviationstackPaused = true

function publishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    return keys.default || Object.values(keys)[0]
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metode permintaan tidak didukung.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') || ''
    const key = publishableKey()
    if (!key) return json({ error: 'Konfigurasi autentikasi Supabase belum tersedia.' }, 503)
    const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Silakan masuk kembali untuk memakai tracking penerbangan.' }, 401)
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profileError || !['admin', 'personel', 'pimpinan', 'ground_handling'].includes(profile?.role)) {
      return json({ error: 'Akun ini belum memiliki akses tracking penerbangan.' }, 403)
    }

    if (aviationstackPaused) {
      return json({ error: 'Tracking penerbangan dijeda sementara. Tidak ada permintaan yang dikirim ke Aviationstack.' }, 503)
    }

    let body: { direction?: unknown; flightIata?: unknown }
    try { body = await req.json() } catch { return json({ error: 'Isi permintaan tidak valid.' }, 400) }
    const direction = body.direction === 'departures' ? 'departures' : body.direction === 'arrivals' ? 'arrivals' : ''
    if (!direction) return json({ error: 'Pilih kedatangan atau keberangkatan.' }, 400)
    const flightIata = typeof body.flightIata === 'string' ? body.flightIata.trim().toUpperCase().replace(/\s+/g, '') : ''
    if (flightIata && !/^[A-Z0-9]{2,10}$/.test(flightIata)) {
      return json({ error: 'Kode penerbangan harus berisi 2–10 huruf atau angka.' }, 400)
    }

    const cacheKey = `${direction}:${flightIata}`
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) return json({ ...cached.payload as object, cached: true })
    if (!Deno.env.get('AVIATIONSTACK_ACCESS_KEY')) return json({ error: 'Secret Aviationstack belum dikonfigurasi di Supabase.' }, 503)

    const url = new URL('https://api.apilayer.net/aviationstack/v1/flights')
    url.searchParams.set('access_key', Deno.env.get('AVIATIONSTACK_ACCESS_KEY') || '')
    url.searchParams.set('limit', '100')
    url.searchParams.set(direction === 'arrivals' ? 'arr_iata' : 'dep_iata', airportIata)
    if (flightIata) url.searchParams.set('flight_iata', flightIata)

    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    let provider: any
    try { provider = await response.json() } catch { return json({ error: 'Penyedia data penerbangan mengirim respons yang tidak terbaca.' }, 502) }
    if (!response.ok || provider?.error) {
      const code = String(provider?.error?.code || '')
      const providerReason = `${code} ${provider?.error?.type || ''} ${provider?.error?.message || ''}`.toLowerCase()
      if (response.status === 401 || /access.?key|unauthori[sz]ed/.test(providerReason)) return json({ error: 'Kunci Aviationstack tidak valid. Periksa secret di Supabase.' }, 502)
      if (response.status === 403 || /access.?restricted|plan|subscription/.test(providerReason)) return json({ error: 'Paket Aviationstack belum mengizinkan permintaan ini.' }, 502)
      if (response.status === 429 || /usage.?limit|rate.?limit/.test(providerReason)) return json({ error: 'Kuota bulanan atau batas permintaan Aviationstack telah tercapai.' }, 429)
      const safeCode = code.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)
      if (safeCode) return json({ error: `Aviationstack menolak permintaan dengan kode ${safeCode}. Periksa izin paket dan parameter penerbangan.` }, 502)
      return json({ error: 'Penyedia data penerbangan sedang tidak dapat dihubungi.' }, 502)
    }

    const payload = {
      data: Array.isArray(provider?.data) ? provider.data : [],
      pagination: provider?.pagination || null,
      direction,
      airport: airportIata,
      retrievedAt: new Date().toISOString(),
      cached: false,
    }
    cache.set(cacheKey, { expiresAt: now + cacheTtlMs, payload })
    if (cache.size > 80) {
      for (const [entryKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(entryKey)
      if (cache.size > 80) cache.delete(cache.keys().next().value!)
    }
    return json(payload)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') return json({ error: 'Permintaan data penerbangan melewati batas waktu. Coba lagi.' }, 504)
    return json({ error: 'Terjadi kendala saat mengambil data penerbangan.' }, 500)
  }
})

