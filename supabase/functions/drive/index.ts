// Edge Function: jembatan aman antara aplikasi dan folder Google Drive "Surat Masuk".
// Kredensial Google hanya ada di secrets server, tidak pernah sampai ke browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const E = (k: string) => Deno.env.get(k)!
const FOLDER = E('DRIVE_FOLDER_ID')
const FIELDS = 'id,name,mimeType,webViewLink,modifiedTime'

async function accessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: E('G_CLIENT_ID'), client_secret: E('G_CLIENT_SECRET'), refresh_token: E('G_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
  }).then((x) => x.json())
  if (!r.access_token) throw new Error('Token Google gagal: ' + (r.error_description || r.error))
  return r.access_token as string
}
const guess = (n: string) => /cancel/i.test(n) ? 'Surat Cancel' : /re-?etd/i.test(n) ? 'Re-ETD' : /\bptr\b/i.test(n) ? 'PTR' : 'Lainnya'
const toRow = (f: any, kategori: string, uid: string) => ({
  drive_file_id: f.id, nama_file: f.name, kategori, mime: f.mimeType, drive_url: f.webViewLink,
  tanggal: (f.modifiedTime || new Date().toISOString()).slice(0, 10), uploaded_by: uid,
})

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
    const H = { Authorization: 'Bearer ' + (await accessToken()) }

    if ((req.headers.get('content-type') || '').includes('multipart')) {
      // Unggah surat ke folder Drive, lalu catat di tabel surat
      const fd = await req.formData(), file = fd.get('file') as File, kategori = String(fd.get('kategori') || 'Lainnya')
      const bd = 'amc' + crypto.randomUUID()
      const body = new Blob([
        `--${bd}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: file.name, parents: [FOLDER] })}\r\n--${bd}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
        await file.arrayBuffer(), `\r\n--${bd}--`,
      ])
      const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${FIELDS}`, {
        method: 'POST', headers: { ...H, 'Content-Type': `multipart/related; boundary=${bd}` }, body,
      }).then((x) => x.json())
      if (up.error) throw new Error(up.error.message)
      await db.from('surat').upsert(toRow(up, kategori, user.id), { onConflict: 'drive_file_id' })
      return j({ ok: true, file: up.name })
    }

    // Sinkron: salin berkas baru di folder Drive ke tabel surat
    const q = encodeURIComponent(`'${FOLDER}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`)
    const ls = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(${FIELDS})`, { headers: H }).then((x) => x.json())
    if (ls.error) throw new Error(ls.error.message)
    const rows = ls.files.map((f: any) => toRow(f, guess(f.name), user.id))
    if (rows.length) await db.from('surat').upsert(rows, { onConflict: 'drive_file_id', ignoreDuplicates: true })
    return j({ ok: true, count: rows.length })
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 500)
  }
})
