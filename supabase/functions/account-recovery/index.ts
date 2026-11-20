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
const digest = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
const newToken = () => {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(values[0] % 1_000_000).padStart(6, '0')
}
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase()

Deno.serve(async request => {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (origin && !allowedOrigins.includes(origin)) return json({ error: 'Asal permintaan tidak diizinkan.' }, 403, origin)
  if (request.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405, origin)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const parsed = await readJsonBody(request, 8 * 1024)
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status, origin)
    const input = parsed.value
    const action = String(input.action || '')

    if (action === 'list' || action === 'approve' || action === 'reject') {
      const authorization = request.headers.get('Authorization') || ''
      const sessionClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
      const { data: { user }, error: authError } = await sessionClient.auth.getUser()
      if (authError || !user) return json({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)
      const { data: actor, error: actorError } = await admin.from('profiles').select('role,active').eq('id', user.id).single()
      if (actorError || actor?.role !== 'admin' || !actor.active) return json({ error: 'Aksi ini hanya dapat dilakukan Admin aktif.' }, 403, origin)

      if (action === 'list') {
        const { data: requests, error } = await admin.from('account_recovery_requests')
          .select('id,user_id,status,request_count,requested_at,last_requested_at,approved_at,token_expires_at,token_attempts,completed_at')
          .order('last_requested_at', { ascending: false }).limit(100)
        if (error) throw error
        const userIds = [...new Set((requests || []).map(row => row.user_id))]
        const { data: profiles, error: profileError } = userIds.length
          ? await admin.from('profiles').select('id,display_name,email,role,active').in('id', userIds)
          : { data: [], error: null }
        if (profileError) throw profileError
        const byId = new Map((profiles || []).map(profile => [profile.id, profile]))
        return json({ requests: (requests || []).map(row => ({ ...row, profile: byId.get(row.user_id) || null })) }, 200, origin)
      }

      const requestId = String(input.requestId || '')
      const { data: row, error: findError } = await admin.from('account_recovery_requests')
        .select('id,user_id,status').eq('id', requestId).single()
      if (findError || !row) return json({ error: 'Permintaan pemulihan tidak ditemukan.' }, 404, origin)
      if (row.status !== 'pending') return json({ error: 'Permintaan ini sudah diproses.' }, 409, origin)
      const { data: target, error: targetError } = await admin.from('profiles').select('active').eq('id', row.user_id).single()
      if (targetError || !target?.active) return json({ error: 'Akun pemohon sudah tidak aktif.' }, 409, origin)
      if (action === 'reject') {
        const { error } = await admin.from('account_recovery_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'pending')
        if (error) throw error
        return json({ ok: true }, 200, origin)
      }

      const token = newToken()
      const tokenHash = await digest(serviceKey, token)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString()
      const { data: approved, error } = await admin.from('account_recovery_requests').update({
        status: 'approved', approved_by: user.id, approved_at: now.toISOString(), token_hash: tokenHash,
        token_expires_at: expiresAt, token_attempts: 0, token_claimed_at: null, updated_at: now.toISOString(),
      }).eq('id', row.id).eq('status', 'pending').select('id').maybeSingle()
      if (error) throw error
      if (!approved) return json({ error: 'Permintaan sudah diproses oleh Admin lain.' }, 409, origin)
      return json({ ok: true, token, expiresAt }, 200, origin)
    }

    if (action !== 'request' && action !== 'reset') return json({ error: 'Aksi tidak dikenal.' }, 400, origin)
    const email = normalizeEmail(input.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Masukkan alamat email yang valid.' }, 400, origin)
    // Trust only the platform-injected client IP. X-Forwarded-For may be supplied by callers.
    const ip = request.headers.get('cf-connecting-ip') || 'unknown'
    const emailHash = await digest(serviceKey, `email:${email}`)
    const ipHash = await digest(serviceKey, `ip:${ip}`)
    const { count: emailAttempts, error: emailRateError } = await admin.from('account_recovery_attempts')
      .select('id', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString())
    const { count: ipAttempts, error: ipRateError } = await admin.from('account_recovery_attempts')
      .select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString())
    if (emailRateError || ipRateError) throw emailRateError || ipRateError
    if ((emailAttempts || 0) >= 8 || (ipAttempts || 0) >= 30) return json({ error: 'Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.' }, 429, origin)
    const { error: attemptError } = await admin.from('account_recovery_attempts').insert({ email_hash: emailHash, ip_hash: ipHash, action })
    if (attemptError) throw attemptError
    await admin.from('account_recovery_attempts').delete().lt('created_at', new Date(Date.now() - 48 * 60 * 60_000).toISOString())

    if (action === 'request') {
      const { data: profile } = await admin.from('profiles').select('id').eq('email', email).eq('active', true).maybeSingle()
      if (!profile) return json({ stage: 'submitted' }, 200, origin)
      const now = new Date().toISOString()
      const { data: open, error } = await admin.from('account_recovery_requests').select('id,status,token_expires_at,request_count')
        .eq('user_id', profile.id).in('status', ['pending','approved','resetting']).maybeSingle()
      if (error) throw error
      if (open?.status === 'approved' && open.token_expires_at && new Date(open.token_expires_at).getTime() > Date.now()) {
        const { error: updateError } = await admin.from('account_recovery_requests').update({ request_count: open.request_count + 1, last_requested_at: now, updated_at: now }).eq('id', open.id)
        if (updateError) throw updateError
        return json({ stage: 'token_required' }, 200, origin)
      }
      if (open?.status === 'pending') {
        const { error: updateError } = await admin.from('account_recovery_requests').update({ request_count: open.request_count + 1, last_requested_at: now, updated_at: now }).eq('id', open.id)
        if (updateError) throw updateError
        return json({ stage: 'submitted' }, 200, origin)
      }
      const resettingExpired = open?.status === 'resetting' && open.token_expires_at && new Date(open.token_expires_at).getTime() <= Date.now()
      if (open?.status === 'approved' || resettingExpired) {
        const { error: expireError } = await admin.from('account_recovery_requests').update({ status: 'expired', token_hash: null, updated_at: now }).eq('id', open.id)
        if (expireError) throw expireError
      }
      // A resetting token is short-lived and single-use; wait until its claim expires before opening another request.
      if (open?.status === 'resetting' && !resettingExpired) return json({ stage: 'submitted' }, 200, origin)
      const { data: createdRequest, error: insertError } = await admin.from('account_recovery_requests').insert({ user_id: profile.id }).select('id').single()
      if (insertError) throw insertError
      const { data: account } = await admin.from('profiles').select('display_name').eq('id', profile.id).maybeSingle()
      const { error: notificationError } = await admin.from('admin_notifications').insert({
        type: 'account_recovery', reference_id: createdRequest.id, user_id: profile.id,
        title: 'Permintaan pemulihan akun', body: `${account?.display_name || 'Pengguna'} mengajukan pemulihan akun.`,
      })
      if (notificationError) console.error('Pemberitahuan pemulihan gagal dibuat')
      return json({ stage: 'submitted' }, 200, origin)
    }

    if (action === 'reset') {
      const token = String(input.token || '')
      const password = String(input.password || '')
      if (!/^\d{6}$/.test(token)) return json({ error: 'Token harus terdiri dari 6 digit.' }, 400, origin)
      if (password.length < 12 || password.length > 72) return json({ error: 'Kata sandi baru harus 12–72 karakter.' }, 400, origin)
      const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('email', email).eq('active', true).maybeSingle()
      if (profileError) throw profileError
      if (!profile) return json({ error: 'Token tidak valid atau sudah kedaluwarsa. Ajukan pemulihan kepada Admin.' }, 400, origin)
      const tokenHash = await digest(serviceKey, token)
      const { data: requestId, error: claimError } = await admin.rpc('claim_account_recovery_token', { p_user_id: profile.id, p_token_hash: tokenHash })
      if (claimError) throw claimError
      if (!requestId) return json({ error: 'Token tidak valid atau sudah kedaluwarsa. Periksa token atau hubungi Admin.' }, 400, origin)

      const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { password })
      if (passwordError) {
        await admin.from('account_recovery_requests').update({ status: 'approved', token_claimed_at: null, updated_at: new Date().toISOString() }).eq('id', requestId).eq('status', 'resetting')
        throw passwordError
      }
      const { error: completeError } = await admin.from('account_recovery_requests').update({
        status: 'completed', token_hash: null, token_claimed_at: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', requestId).eq('status', 'resetting')
      if (completeError) throw completeError
      return json({ ok: true }, 200, origin)
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400, origin)
  } catch (error) {
    console.error('account-recovery request failed')
    return json({ error: 'Pemulihan akun gagal diproses. Coba lagi nanti atau hubungi Admin AMC.' }, 500, origin)
  }
})

