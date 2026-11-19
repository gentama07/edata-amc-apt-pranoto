import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const allowedOrigins = ['https://gentama07.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})
const json = (data: unknown, status: number, origin: string | null) => new Response(JSON.stringify(data), {
  status, headers: { ...cors(origin), 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (request.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405, origin)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization') || ''
    const sessionClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await sessionClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)

    const admin = createClient(url, serviceKey)
    const { data: actor, error: actorError } = await admin.from('profiles')
      .select('role,active').eq('id', user.id).single()
    if (actorError || actor?.role !== 'admin' || !actor.active) return json({ error: 'Aksi ini hanya dapat dilakukan Admin aktif.' }, 403, origin)

    const input = await request.json()
    if (input.action === 'create') {
      const email = String(input.email || '').trim().toLowerCase()
      const password = String(input.password || '')
      const name = String(input.displayName || '').trim()
      const role = String(input.role || '')
      const organization = String(input.organization || '').trim()
      if (!email || !name || password.length < 8) return json({ error: 'Nama, email, dan kata sandi minimal 8 karakter wajib diisi.' }, 400, origin)
      if (!['admin', 'personel', 'pimpinan', 'ground_handling'].includes(role)) return json({ error: 'Peran tidak dikenal.' }, 400, origin)
      if (role === 'ground_handling' && !organization) return json({ error: 'Perusahaan Ground Handling wajib dipilih.' }, 400, origin)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name, organization },
      })
      if (error) return json({ error: error.message }, 400, origin)
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
      if (!userId) return json({ error: 'Akun yang akan diperbarui tidak ditemukan.' }, 400, origin)
      if (userId === user.id && input.active === false) return json({ error: 'Admin tidak dapat menjeda akunnya sendiri.' }, 409, origin)
      const profilePatch: Record<string, unknown> = {}
      if (typeof input.role === 'string') {
        if (!['admin', 'personel', 'pimpinan', 'ground_handling'].includes(input.role)) return json({ error: 'Peran tidak dikenal.' }, 400, origin)
        profilePatch.role = input.role
      }
      if (typeof input.active === 'boolean') profilePatch.active = input.active
      if (typeof input.organization === 'string') profilePatch.organization = input.organization.trim() || null
      if (typeof input.displayName === 'string') profilePatch.display_name = input.displayName.trim()
      if (typeof input.email === 'string' && input.email.trim()) {
        const { error } = await admin.auth.admin.updateUserById(userId, { email: input.email.trim().toLowerCase(), email_confirm: true })
        if (error) return json({ error: error.message }, 400, origin)
      }
      if (Object.keys(profilePatch).length) {
        const { error } = await admin.from('profiles').update(profilePatch).eq('id', userId)
        if (error) return json({ error: error.message }, 400, origin)
      }
      return json({ ok: true }, 200, origin)
    }
    return json({ error: 'Aksi tidak dikenal.' }, 400, origin)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Pengelolaan akun gagal.' }, 500, origin)
  }
})

