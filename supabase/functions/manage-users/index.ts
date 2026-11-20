import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { readJsonBody } from '../_shared/request.js'

const allowedOrigins = ['https://gentama07.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})
const json = (data: unknown, status: number, origin: string | null) => new Response(JSON.stringify(data), {
  status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async request => {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (origin && !allowedOrigins.includes(origin)) return json({ error: 'Asal permintaan tidak diizinkan.' }, 403, origin)
  if (request.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405, origin)
  if (Number(request.headers.get('Content-Length') || 0) > 32 * 1024) return json({ error: 'Ukuran permintaan melampaui batas.' }, 413, origin)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization') || ''
    const sessionClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await sessionClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: actor, error: actorError } = await admin.from('profiles')
      .select('role,active').eq('id', user.id).single()
    if (actorError || actor?.role !== 'admin' || !actor.active) return json({ error: 'Aksi ini hanya dapat dilakukan Admin aktif.' }, 403, origin)

    const parsed = await readJsonBody(request, 32 * 1024)
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status, origin)
    const input = parsed.value
    if (input.action === 'create') {
      const email = String(input.email || '').trim().toLowerCase()
      const password = String(input.password || '')
      const name = String(input.displayName || '').trim()
      const role = String(input.role || '')
      const organization = String(input.organization || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 100 || password.length < 12 || password.length > 72) return json({ error: 'Nama, email valid, dan kata sandi 12–72 karakter wajib diisi.' }, 400, origin)
      if (!['admin', 'personel', 'pimpinan', 'ground_handling'].includes(role)) return json({ error: 'Peran tidak dikenal.' }, 400, origin)
      if (role === 'ground_handling' && (!organization || organization.length > 120)) return json({ error: 'Perusahaan Ground Handling wajib dipilih.' }, 400, origin)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name, organization },
      })
      if (error) return json({ error: 'Akun tidak dapat dibuat. Periksa email atau hubungi administrator sistem.' }, 400, origin)
      const { error: profileError } = await admin.from('profiles').update({
        display_name: name, role, organization: role === 'ground_handling' ? organization : null, active: true,
      }).eq('id', data.user.id)
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id)
        return json({ error: 'Akun dibuat tetapi profil gagal disimpan; akun sementara dibatalkan.' }, 500, origin)
      }
      return json({ ok: true, userId: data.user.id }, 201, origin)
    }

    if (input.action === 'update') {
      const userId = String(input.userId || '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json({ error: 'Akun yang akan diperbarui tidak valid.' }, 400, origin)
      if (userId === user.id && input.active === false) return json({ error: 'Admin tidak dapat menjeda akunnya sendiri.' }, 409, origin)
      if (userId === user.id && input.role && input.role !== 'admin') return json({ error: 'Admin tidak dapat mengubah peran akunnya sendiri.' }, 409, origin)
      const profilePatch: Record<string, unknown> = {}
      if (typeof input.role === 'string') {
        if (!['admin', 'personel', 'pimpinan', 'ground_handling'].includes(input.role)) return json({ error: 'Peran tidak dikenal.' }, 400, origin)
        profilePatch.role = input.role
      }
      if (typeof input.active === 'boolean') profilePatch.active = input.active
      if (typeof input.organization === 'string') {
        if (input.organization.trim().length > 120) return json({ error: 'Nama perusahaan terlalu panjang.' }, 400, origin)
        profilePatch.organization = input.organization.trim() || null
      }
      if (typeof input.displayName === 'string') {
        if (input.displayName.trim().length < 2 || input.displayName.trim().length > 100) return json({ error: 'Nama harus terdiri dari 2–100 karakter.' }, 400, origin)
        profilePatch.display_name = input.displayName.trim()
      }
      if (typeof input.email === 'string' && input.email.trim()) {
        const email = input.email.trim().toLowerCase()
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Format email tidak valid.' }, 400, origin)
        const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
        if (error) return json({ error: 'Email akun tidak dapat diperbarui.' }, 400, origin)
      }
      if (Object.keys(profilePatch).length) {
        const { error } = await admin.from('profiles').update(profilePatch).eq('id', userId)
        if (error) return json({ error: 'Profil akun tidak dapat diperbarui.' }, 400, origin)
      }
      return json({ ok: true }, 200, origin)
    }
    return json({ error: 'Aksi tidak dikenal.' }, 400, origin)
  } catch (error) {
    console.error('manage-users request failed')
    return json({ error: 'Pengelolaan akun gagal diproses. Coba lagi nanti.' }, 500, origin)
  }
})

