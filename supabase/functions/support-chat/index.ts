import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

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
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization') || ''
    const sessionClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await sessionClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sesi login tidak sah atau sudah berakhir.' }, 401, origin)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: actor, error: actorError } = await admin.from('profiles').select('id,display_name,role,active').eq('id', user.id).single()
    if (actorError || !actor?.active) return json({ error: 'Akun tidak aktif.' }, 403, origin)
    const input = await request.json()
    const action = String(input.action || '')
    const isAdmin = actor.role === 'admin'
    if (!['list', 'send'].includes(action)) return json({ error: 'Aksi tidak dikenal.' }, 400, origin)

    const targetId = isAdmin ? String(input.targetUserId || '') : user.id
    if (!targetId) return json({ error: 'Pilih pengguna yang akan dihubungi.' }, 400, origin)
    if (isAdmin) {
      const { data: target, error: targetError } = await admin.from('profiles').select('id').eq('id', targetId).single()
      if (targetError || !target || targetId === user.id) return json({ error: 'Pengguna tujuan tidak ditemukan.' }, 404, origin)
    }

    if (action === 'send') {
      const body = String(input.body || '').trim()
      if (!body || body.length > 2000) return json({ error: 'Pesan harus berisi 1–2.000 karakter.' }, 400, origin)
      const { data: message, error } = await admin.from('support_messages').insert({ user_id: targetId, sender_id: user.id, body }).select('id,user_id,sender_id,body,created_at').single()
      if (error) throw error
      if (!isAdmin) {
        const { error: notificationError } = await admin.from('admin_notifications').insert({ type: 'support_message', reference_id: message.id, user_id: targetId, title: 'Pesan CS baru', body: `${actor.display_name || 'Pengguna'} mengirim pesan bantuan.` })
        if (notificationError) console.error('Pesan CS terkirim tetapi notifikasi gagal dibuat:', notificationError)
      }
      return json({ message }, 201, origin)
    }

    const { data: messages, error } = await admin.from('support_messages').select('id,user_id,sender_id,body,created_at,admin_read_at,user_read_at')
      .eq('user_id', targetId).order('created_at', { ascending: true }).limit(300)
    if (error) throw error
    if (isAdmin) await admin.from('support_messages').update({ admin_read_at: new Date().toISOString() }).eq('user_id', targetId).eq('admin_read_at', null).neq('sender_id', user.id)
    else await admin.from('support_messages').update({ user_read_at: new Date().toISOString() }).eq('user_id', targetId).eq('user_read_at', null).neq('sender_id', user.id)
    return json({ messages: messages || [] }, 200, origin)
  } catch (error) {
    console.error('support-chat:', error)
    return json({ error: error instanceof Error ? error.message : 'Chat gagal diproses.' }, 500, origin)
  }
})
