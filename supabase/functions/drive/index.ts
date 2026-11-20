// Edge Function: jembatan aman antara aplikasi dan folder Google Drive "Surat Masuk".
// Akses ke Drive dijaga oleh skrip Apps Script (supabase/apps-script/Code.gs); URL dan token-nya
// hanya ada di secrets Supabase, tidak pernah sampai ke browser atau ke repo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { readRequestBody } from '../_shared/request.js'

const allowedOrigins = ['https://gentama07.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})
const j = (b: unknown, s = 200, origin: string | null = null) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const E = (k: string) => Deno.env.get(k)!

const guess = (n: string) => /cancel/i.test(n) ? 'Surat Cancel' : /re-?etd/i.test(n) ? 'Re-ETD' : /\bptr\b/i.test(n) ? 'PTR' : 'Lainnya'
const toRow = (f: any, kategori: string, uid: string) => ({
  drive_file_id: f.id, nama_file: f.name, kategori, mime: f.mimeType, drive_url: f.webViewLink,
  tanggal: (f.modifiedTime || new Date().toISOString()).slice(0, 10), uploaded_by: uid,
})

// Memanggil skrip Apps Script yang menjaga akses ke folder Drive
async function script(body: Record<string, unknown>) {
  const r = await fetch(E('APPS_SCRIPT_URL'), {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: E('APPS_SCRIPT_TOKEN'), ...body }),
  })
  let d: any
  try { d = JSON.parse(await r.text()) } catch { throw new Error('Apps Script tidak membalas JSON. Cek deploy: Who has access harus Anyone.') }
  if (d.error) throw new Error(d.error)
  return d
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (origin && !allowedOrigins.includes(origin)) return j({ error: 'Asal permintaan tidak diizinkan.' }, 403, origin)
  if (req.method !== 'POST') return j({ error: 'Metode tidak didukung.' }, 405, origin)
  if (Number(req.headers.get('Content-Length') || 0) > 10 * 1024 * 1024 + 64 * 1024) return j({ error: 'Ukuran permintaan melampaui batas.' }, 413, origin)
  try {
    const url = E('SUPABASE_URL')
    const me = createClient(url, E('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await me.auth.getUser()
    if (!user) return j({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)
    const { data: p } = await me.from('profiles').select('role,active').eq('id', user.id).single()
    if (!p?.active || !['personel', 'admin'].includes(p.role)) return j({ error: 'Hanya Personel AMC atau Admin aktif yang boleh mengakses arsip.' }, 403, origin)
    const db = createClient(url, E('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

    if ((req.headers.get('content-type') || '').includes('multipart')) {
      // Unggah surat ke folder Drive, lalu catat di tabel surat
      const requestBody = await readRequestBody(req, 10 * 1024 * 1024 + 64 * 1024)
      if (!requestBody.ok) return j({ error: requestBody.error }, requestBody.status, origin)
      let fd: FormData
      try { fd = await new Request(req.url, { method: 'POST', headers: req.headers, body: requestBody.bytes }).formData() }
      catch { return j({ error: 'Formulir unggahan tidak valid.' }, 400, origin) }
      const file = fd.get('file'), kategori = String(fd.get('kategori') || 'Lainnya')
      if (!(file instanceof File)) return j({ error: 'Berkas unggahan tidak ditemukan.' }, 400, origin)
      if (file.size > 10 * 1024 * 1024) return j({ error: 'Ukuran file maksimal 10 MB.' }, 400)
      if (!/\.pdf$/i.test(file.name) || file.type !== 'application/pdf') return j({ error: 'Lampiran harus berupa berkas PDF.' }, 415, origin)
      const bytes = await file.arrayBuffer()
      if (!bytes.byteLength || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return j({ error: 'Isi berkas bukan PDF yang valid.' }, 415, origin)
      const d = await script({ action: 'upload', name: file.name, mime: 'application/pdf', data: encodeBase64(bytes) })
      await db.from('surat').upsert(toRow(d.file, kategori, user.id), { onConflict: 'drive_file_id' })
      return j({ ok: true, file: d.file.name }, 200, origin)
    }

    // Sinkron: salin berkas baru di folder Drive ke tabel surat
    const d = await script({ action: 'list' })
    const rows = d.files.map((f: any) => toRow(f, guess(f.name), user.id))
    if (rows.length) await db.from('surat').upsert(rows, { onConflict: 'drive_file_id', ignoreDuplicates: true })
    return j({ ok: true, count: rows.length }, 200, origin)
  } catch (e) {
    console.error('drive request failed')
    return j({ error: 'Layanan arsip gagal memproses permintaan. Hubungi Admin AMC jika masalah berulang.' }, 500, origin)
  }
})
