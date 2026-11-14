// Edge Function: jembatan aman antara aplikasi dan folder Google Drive "Surat Masuk".
// Akses ke Drive dijaga oleh skrip Apps Script (supabase/apps-script/Code.gs); URL dan token-nya
// hanya ada di secrets Supabase, tidak pernah sampai ke browser atau ke repo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = E('SUPABASE_URL')
    const me = createClient(url, E('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await me.auth.getUser()
    if (!user) return j({ error: 'Belum login.' }, 401)
    const { data: p } = await me.from('profiles').select('role').eq('id', user.id).single()
    if (!['personel', 'admin'].includes(p?.role)) return j({ error: 'Hanya personel AMC yang boleh mengakses Drive.' }, 403)
    const db = createClient(url, E('SUPABASE_SERVICE_ROLE_KEY'))

    if ((req.headers.get('content-type') || '').includes('multipart')) {
      // Unggah surat ke folder Drive, lalu catat di tabel surat
      const fd = await req.formData(), file = fd.get('file') as File, kategori = String(fd.get('kategori') || 'Lainnya')
      if (file.size > 10 * 1024 * 1024) return j({ error: 'Ukuran file maksimal 10 MB.' }, 400)
      const d = await script({ action: 'upload', name: file.name, mime: file.type, data: encodeBase64(await file.arrayBuffer()) })
      await db.from('surat').upsert(toRow(d.file, kategori, user.id), { onConflict: 'drive_file_id' })
      return j({ ok: true, file: d.file.name })
    }

    // Sinkron: salin berkas baru di folder Drive ke tabel surat
    const d = await script({ action: 'list' })
    const rows = d.files.map((f: any) => toRow(f, guess(f.name), user.id))
    if (rows.length) await db.from('surat').upsert(rows, { onConflict: 'drive_file_id', ignoreDuplicates: true })
    return j({ ok: true, count: rows.length })
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 500)
  }
})
