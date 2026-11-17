import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === 'https://gentama07.github.io' || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173'
    ? origin
    : 'https://gentama07.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})
const json = (data: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsFor(origin), 'Content-Type': 'application/json' },
})
const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Secret ${name} belum dikonfigurasi di Supabase.`)
  return value
}

async function callAppsScript(payload: Record<string, unknown>) {
  const encodedPayload = new URLSearchParams({ payload: JSON.stringify({ ...payload, token: env('APPS_SCRIPT_TOKEN') }) })
  const response = await fetch(env('APPS_SCRIPT_URL'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: encodedPayload.toString(),
    redirect: 'follow',
  })
  const body = await response.text()
  let result: any
  try { result = JSON.parse(body) } catch {
    throw new Error('Google Apps Script tidak mengembalikan JSON. Periksa deployment Web App dan aksesnya.')
  }
  if (!response.ok || result.error) throw new Error(result.error || `Apps Script merespons HTTP ${response.status}.`)
  return result
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsFor(origin) })
  if (request.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405, origin)

  try {
    const authorization = request.headers.get('Authorization') || ''
    const supabaseUrl = env('SUPABASE_URL')
    const anonKey = env('SUPABASE_ANON_KEY')
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)

    const adminClient = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: profile, error: profileError } = await adminClient
      .from('profiles').select('role, active').eq('id', user.id).single()
    if (profileError) throw new Error('Profil pengguna tidak ditemukan.')
    if (!profile.active) return json({ error: 'Akun ini dinonaktifkan.' }, 403, origin)
    if (!['personel', 'admin', 'pimpinan', 'ground_handling'].includes(profile.role)) return json({ error: 'Peran ini tidak dapat mengakses Persuratan.' }, 403, origin)

    const form = await request.formData()
    const file = form.get('file')
    const letterId = String(form.get('letterId') || '')
    if (!(file instanceof File)) return json({ error: 'Berkas unggahan tidak ditemukan.' }, 400, origin)
    if (file.size === 0) return json({ error: 'Berkas kosong tidak dapat diunggah.' }, 400, origin)
    if (file.size > 10 * 1024 * 1024) return json({ error: 'Ukuran berkas maksimal 10 MB.' }, 400, origin)

    if (!letterId) return json({ error: 'Data surat harus disimpan sebelum berkas dikirim.' }, 400, origin)
    const { data: letter, error: letterError } = await userClient.from('incoming_letters')
      .select('id,direction,requester_id,reply_to_id,created_by,recipient_role').eq('id', letterId).single()
    if (letterError || !letter) return json({ error: 'Surat tidak ditemukan atau Anda tidak memiliki akses.' }, 404, origin)
    if (profile.role === 'ground_handling' && (letter.direction !== 'inbound' || letter.requester_id !== user.id)) {
      return json({ error: 'Akun Ground Handling hanya dapat mengunggah PDF pada surat miliknya.' }, 403, origin)
    }
    if (profile.role === 'pimpinan' && (letter.direction !== 'outbound' || !letter.reply_to_id)) {
      return json({ error: 'Pimpinan hanya dapat mengunggah PDF balasan surat.' }, 403, origin)
    }
    const { data: senderProfile, error: senderProfileError } = await adminClient.from('profiles')
      .select('role').eq('id', letter.created_by).maybeSingle()
    if (senderProfileError) throw senderProfileError
    const destinationByRole: Record<string, string> = {
      ground_handling: 'GROUND HANDLING',
      personel: 'PETUGAS AMC',
      admin: 'ADMIN/PIMPINAN',
      pimpinan: 'ADMIN/PIMPINAN',
    }
    const destination = destinationByRole[senderProfile?.role || profile.role]
    if (!destination) return json({ error: 'Peran akun tidak memiliki folder arsip.' }, 403, origin)
    let viewerEmails: string[] = []
    if (letter.reply_to_id && letter.requester_id) {
      const { data: requester, error: requesterError } = await adminClient.from('profiles')
        .select('email').eq('id', letter.requester_id).eq('active', true).maybeSingle()
      if (requesterError) throw requesterError
      if (requester?.email) viewerEmails = [requester.email]
    } else {
      const viewerRoles = letter.recipient_role === 'ground_handling'
        ? ['ground_handling']
        : letter.recipient_role === 'pimpinan'
          ? ['pimpinan']
          : ['admin', 'personel', 'pimpinan']
      const { data: recipients, error: recipientError } = await adminClient.from('profiles')
        .select('email').in('role', viewerRoles).eq('active', true)
      if (recipientError) throw recipientError
      viewerEmails = (recipients || []).map(row => row.email).filter(Boolean)
      if (profile.role === 'ground_handling' && user.email && !viewerEmails.includes(user.email)) viewerEmails.push(user.email)
    }
    if (viewerEmails.length === 0) return json({ error: 'Tidak ada akun penerima aktif untuk surat ini. Hubungi Admin AMC.' }, 422, origin)

    const drive = await callAppsScript({
      action: 'upload',
      name: file.name,
      mime: file.type || 'application/octet-stream',
      data: encodeBase64(await file.arrayBuffer()),
      destination,
      viewerEmails,
    })
    const storedFile = drive.file
    if (!storedFile?.id) throw new Error('Google Apps Script tidak mengembalikan identitas berkas.')

    const attachment = {
      file_name: storedFile.name || file.name,
      drive_file_id: storedFile.id,
      drive_web_view_link: storedFile.webViewLink || null,
      drive_folder: destination,
    }
    const { data: updated, error: updateError } = await adminClient.from('incoming_letters')
      .update(attachment).eq('id', letterId).select('id').maybeSingle()
    if (updateError) throw updateError
    if (!updated) return json({ error: 'Data surat yang akan dilampiri tidak ditemukan.' }, 404, origin)

    return json({ ok: true, file: attachment.file_name, driveFileId: attachment.drive_file_id, destination }, 200, origin)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unggah ke Google Drive gagal.' }, 500, origin)
  }
})


