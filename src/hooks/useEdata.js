import { useCallback, useEffect, useRef, useState } from 'react';
import { demoAccounts } from '../config/airportOptions';
import { initialLetters, initialMovements } from '../lib/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const STORE = 'e-data-amc-demo-v1';
const MESSAGE_STORE = 'e-data-amc-demo-messages-v1';
const normalizeDemoMovement = row => ({
  ...row,
  baggageArrKg: row.baggageArrKg ?? row.baggageKg ?? 0,
  baggageDepKg: row.baggageDepKg ?? 0,
  cargoArrKg: row.cargoArrKg ?? row.cargoKg ?? 0,
  cargoDepKg: row.cargoDepKg ?? 0,
});
const readDemo = () => {
  try { const value = JSON.parse(localStorage.getItem(STORE) || 'null'); return value ? { ...value, movements: (value.movements || []).map(normalizeDemoMovement) } : { movements: initialMovements, letters: initialLetters }; }
  catch { return { movements: initialMovements, letters: initialLetters }; }
};
const fromDb = row => ({
  id: row.id,
  date: row.operating_date || row.tanggal,
  operator: row.operator,
  aircraftType: row.aircraft_type || row.ac_type,
  registration: row.registration || row.reg,
  flightArr: row.flt_arr || row.flight_arr,
  flightDep: row.flt_dep || row.flight_dep,
  origin: row.orig,
  destination: row.dest,
  sta: (row.sta || row.sched_arr)?.slice(0, 5) || '',
  ata: row.ata?.slice(0, 5) || '',
  blockOn: row.block_on?.slice(0, 5) || '',
  std: (row.std || row.sched_dep)?.slice(0, 5) || '',
  blockOff: row.block_off?.slice(0, 5) || '',
  atd: row.atd?.slice(0, 5) || '',
  handler: row.ground_handler || row.gh,
  stand: row.parking_stand ? `Stand ${row.parking_stand}` : '',
  riu: row.riu || row.riu_arr || row.riu_dep,
  paxArr: row.pax_arr,
  paxDep: row.pax_dep,
  baggageArrKg: row.bagasi_arr ?? row.baggage_kg ?? 0,
  baggageDepKg: row.bagasi_dep ?? 0,
  cargoArrKg: row.kargo_arr ?? row.cargo_kg ?? 0,
  cargoDepKg: row.kargo_dep ?? 0,
  remark: row.remark,
});

const toDb = row => ({
  // Both date and registration pairs exist in production; the legacy columns
  // remain NOT NULL and are also used by the original daily summary view.
  tanggal: row.date,
  operating_date: row.date,
  operator: row.operator,
  ac_type: row.aircraftType,
  aircraft_type: row.aircraftType,
  reg: row.registration,
  registration: row.registration,
  flt_arr: row.flightArr || null,
  flt_dep: row.flightDep || null,
  orig: row.origin || null,
  dest: row.destination || null,
  sched_arr: row.sta || null,
  sta: row.sta || null,
  ata: row.ata || null,
  block_on: row.blockOn || null,
  sched_dep: row.std || null,
  std: row.std || null,
  block_off: row.blockOff || null,
  atd: row.atd || null,
  gh: row.handler || null,
  ground_handler: row.handler || null,
  parking_stand: Number.parseInt(String(row.stand || '').replace(/\D/g, ''), 10) || null,
  riu: row.riu || null,
  pax_arr: Number(row.paxArr || 0),
  pax_dep: Number(row.paxDep || 0),
  bagasi_arr: Number(row.baggageArrKg || 0),
  bagasi_dep: Number(row.baggageDepKg || 0),
  kargo_arr: Number(row.cargoArrKg || 0),
  kargo_dep: Number(row.cargoDepKg || 0),
  baggage_kg: Number(row.baggageArrKg || 0) + Number(row.baggageDepKg || 0),
  cargo_kg: Number(row.cargoArrKg || 0) + Number(row.cargoDepKg || 0),
  remark: row.remark || '',
});

export function useEdata() {
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [openingRequested, setOpeningRequested] = useState(false);
  const [movements, setMovements] = useState([]);
  const [letters, setLetters] = useState([]);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recoveryInvalid, setRecoveryInvalid] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(!isSupabaseConfigured || new URLSearchParams(location.search).get('recovery') !== '1');
  const recoveryEventSeen = useRef(false);
  const demo = !isSupabaseConfigured;
  const modeLabel = 'Pratinjau lokal terisolasi';

  const loadDemo = useCallback(() => {
    const data = readDemo(); setMovements(data.movements); setLetters(data.letters);
    try { setMessages(JSON.parse(localStorage.getItem(MESSAGE_STORE) || '[]')); } catch { setMessages([]); }
  }, []);
  const persistDemo = useCallback((nextMovements, nextLetters) => {
    localStorage.setItem(STORE, JSON.stringify({ movements: nextMovements, letters: nextLetters }));
  }, []);

  const loadRemote = useCallback(async () => {
    if (!session) return;
    const [initialProfileResult, movementsResult, lettersResult, messageResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,email,role,active,organization,nip,position,avatar_url').eq('id', session.user.id).single(),
      supabase.from('movements').select('*').order('operating_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
      supabase.from('incoming_letters').select('*').order('received_date', { ascending: false }).limit(500),
      supabase.from('correspondence_messages').select('*').order('created_at', { ascending: true }).limit(2000),
    ]);
    let profileResult = initialProfileResult;
    const profileSelections = [
      'id,display_name,email,role,active,organization,nip,avatar_url',
      'id,display_name,email,role,active,organization',
    ];
    for (const fields of profileSelections) {
      if (!profileResult.error || !/column .* does not exist|could not find .* in the schema cache/i.test(profileResult.error.message || '')) break;
      profileResult = await supabase.from('profiles').select(fields).eq('id', session.user.id).single();
    }
    if (profileResult.error) throw profileResult.error;
    if (profileResult.data.active === false) { await supabase.auth.signOut(); throw new Error('Akun ini dinonaktifkan. Hubungi Admin AMC.'); }
    let avatarUrl = '';
    if (profileResult.data.avatar_url) {
      const { data: avatarData } = await supabase.storage.from('profile-avatars').createSignedUrl(profileResult.data.avatar_url, 3600);
      avatarUrl = avatarData?.signedUrl || '';
    }
    setProfile({ id: profileResult.data.id, name: profileResult.data.display_name || profileResult.data.email, role: profileResult.data.role, email: profileResult.data.email || session.user.email, organization: profileResult.data.organization || '', nip: profileResult.data.nip || '', position: profileResult.data.position || '', avatarPath: profileResult.data.avatar_url || '', avatarUrl });
    if (movementsResult.error) throw movementsResult.error;
    if (lettersResult.error) throw lettersResult.error;
    if (messageResult.error) throw messageResult.error;
    setMovements((movementsResult.data || []).map(fromDb));
    setLetters((lettersResult.data || []).map(row => ({ id: row.id, date: row.received_date, createdAt: row.created_at, reference: row.reference, sender: row.sender, senderOrganization: row.sender_organization || row.sender, subject: row.subject, status: row.status, fileName: row.file_name, driveFileId: row.drive_file_id, driveWebViewLink: row.drive_web_view_link, driveFolder: row.drive_folder, direction: row.direction || 'inbound', requesterId: row.requester_id, createdById: row.created_by, replyToId: row.reply_to_id, recipientRole: row.recipient_role || '', senderConfirmedAt: row.sender_confirmed_at || null, recipientConfirmedAt: row.recipient_confirmed_at || null })));
    setMessages((messageResult.data || []).map(row => ({ ...row, sender_name: row.sender_name || 'Petugas AMC' })));
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured) loadDemo();
  }, [loadDemo]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      setSession(data.session);
      if (new URLSearchParams(location.search).get('recovery') === '1') {
        setPasswordRecovery(recoveryEventSeen.current && Boolean(data.session) && !sessionError);
        setRecoveryInvalid(!recoveryEventSeen.current || !data.session || Boolean(sessionError));
      }
      setRecoveryChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') { recoveryEventSeen.current = true; setPasswordRecovery(true); setRecoveryInvalid(false); }
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { if (!isSupabaseConfigured) loadDemo(); return; }
    setBusy(true); setError('');
    loadRemote().catch(err => setError(err.message || 'Gagal memuat data.')).finally(() => setBusy(false));
  }, [session, loadRemote, loadDemo]);
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel('amc-live-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => loadRemote().catch(err => setError(err.message)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incoming_letters' }, () => loadRemote().catch(err => setError(err.message)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'correspondence_messages' }, () => loadRemote().catch(err => setError(err.message)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => loadRemote().catch(err => setError(err.message)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, loadRemote]);

  const signIn = async (email, password) => {
    setError('');
    if (!isSupabaseConfigured) throw new Error('Mode lokal tidak menerima akun produksi. Pilih salah satu peran demo.');
    setOpeningRequested(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setOpeningRequested(false); throw authError; }
  };
  const signInDemo = (role) => {
    if (isSupabaseConfigured) throw new Error('Akun demo hanya tersedia saat Supabase belum dikonfigurasi.');
    const account = demoAccounts.find(item => item.role === role);
    setOpeningRequested(true);
    setProfile({ id: `demo-${role}`, name: account.label, role, email: account.email, organization: account.organization || '', nip: '', avatarPath: '', avatarUrl: '', active: true });
    loadDemo();
  };
  const createLetter = async (row) => {
    if (session) {
      if (profile?.role === 'ground_handling') {
        const { data: letterId, error: submitError } = await supabase.rpc('submit_ground_handling_letter', {
          p_reference: row.reference || `AMC-${Date.now()}`,
          p_received_date: row.date || new Date().toISOString().slice(0, 10),
          p_sender: row.sender,
          p_sender_organization: row.senderOrganization || '',
          p_subject: row.subject,
          p_file_name: row.fileName || null,
        });
        if (submitError) throw submitError;
        await loadRemote();
        return { ...row, id: letterId };
      }
      const payload = {
        reference: row.reference || `AMC-${Date.now()}`,
        received_date: row.date || new Date().toISOString().slice(0, 10),
        sender: row.sender,
        sender_organization: row.senderOrganization || row.sender,
        subject: row.subject,
        file_name: row.fileName || null,
        direction: row.direction || 'inbound',
        requester_id: row.requesterId || (row.direction === 'inbound' ? session.user.id : null),
        reply_to_id: row.replyToId || null,
        recipient_role: row.recipientRole || null,
        created_by: session.user.id,
      };
      const { data, error: insertError } = await supabase.from('incoming_letters').insert(payload).select().single();
      if (insertError) throw insertError;
      await loadRemote();
      return { ...row, id: data.id };
    }
    const data = readDemo(); const saved = { ...row, createdById: profile.id, id: row.id || `letter-${crypto.randomUUID()}` };
    const next = [saved, ...data.letters]; setLetters(next); persistDemo(data.movements, next); return saved;
  };
  const createReply = async (parent, row) => {
    const senderOrganization = profile.role === 'pimpinan' ? 'Kepala Bandara · A.P.T. Pranoto'
      : profile.role === 'admin' ? 'Admin AMC · A.P.T. Pranoto'
        : 'Personel AMC · A.P.T. Pranoto';
    if (!session) {
      const saved = { ...row, id: `letter-${crypto.randomUUID()}`, date: new Date().toISOString().slice(0, 10), direction: 'outbound', replyToId: parent.id, sender: profile.name, senderOrganization, createdById: profile.id };
      const next = [saved, ...letters]; setLetters(next); persistDemo(readDemo().movements, next); return saved;
    }
    const { data, error: insertError } = await supabase.from('incoming_letters').insert({
      reference: row.reference || `BAL-${Date.now()}`, received_date: new Date().toISOString().slice(0, 10),
      sender: profile.name, sender_organization: senderOrganization, subject: row.subject || `Balasan: ${parent.subject}`,
      direction: 'outbound', requester_id: parent.requesterId || parent.requester_id || parent.createdById,
      recipient_role: parent.recipientRole === 'pimpinan' ? 'amc' : 'ground_handling',
      reply_to_id: parent.id, file_name: row.fileName || null, created_by: session.user.id,
    }).select().single();
    if (insertError) throw insertError;
    await loadRemote();
    return { ...row, id: data.id };
  };
  const sendMessage = async (letterId, body) => {
    if (!session) {
      const next = [...messages, { id: `message-${crypto.randomUUID()}`, letter_id: letterId, body: body.trim(), sender_id: profile.id, sender_name: profile.name, created_at: new Date().toISOString() }];
      setMessages(next); localStorage.setItem(MESSAGE_STORE, JSON.stringify(next)); return;
    }
    const { error: insertError } = await supabase.from('correspondence_messages').insert({ letter_id: letterId, body: body.trim() });
    if (insertError) throw insertError;
  };
  const signOut = async () => { if (session) await supabase.auth.signOut(); setSession(null); setProfile(null); setOpeningRequested(false); setError(''); };

  const saveMovement = async (row) => {
    if (session) {
      const payload = toDb(row);
      const result = row.id && !String(row.id).startsWith('demo-') ? await supabase.from('movements').update(payload).eq('id', row.id).select().single() : await supabase.from('movements').insert(payload).select().single();
      if (result.error) throw result.error;
      await loadRemote(); return;
    }
    const data = readDemo();
    const saved = { ...row, id: row.id || `demo-${crypto.randomUUID()}` };
    const next = row.id ? data.movements.map(item => item.id === row.id ? saved : item) : [saved, ...data.movements];
    setMovements(next); persistDemo(next, data.letters);
  };
  const deleteMovement = async (id) => {
    if (session) { const { error: deleteError } = await supabase.from('movements').delete().eq('id', id); if (deleteError) throw deleteError; await loadRemote(); return; }
    const data = readDemo(); const next = data.movements.filter(row => row.id !== id); setMovements(next); persistDemo(next, data.letters);
  };
  const deleteLetter = async (id) => {
    if (!['admin', 'personel'].includes(profile?.role)) throw new Error('Hanya Admin atau Personel AMC yang dapat menghapus surat.');
    if (!session) {
      const next = letters.filter(row => row.id !== id && row.replyToId !== id); setLetters(next); persistDemo(readDemo().movements, next);
      const nextMessages = messages.filter(row => row.letter_id !== id); setMessages(nextMessages); localStorage.setItem(MESSAGE_STORE, JSON.stringify(nextMessages)); return;
    }
    const { error: deleteError } = await supabase.from('incoming_letters').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await loadRemote();
  };
  const updateProfile = async (userId, updates) => {
    if (!session || profile?.role !== 'admin') throw new Error('Hanya Admin yang dapat mengelola profil.');
    await manageUser({ action: 'update', userId, ...updates });
    await loadRemote();
  };
  const updateOwnProfile = async ({ name, nip, position }) => {
    const next = { name: name.trim(), nip: nip.trim(), position: position.trim() };
    if (!session) { setProfile(current => ({ ...current, ...next })); return; }
    let updates = { display_name: next.name, nip: next.nip || null, position: next.position || null };
    let { error: updateError } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
    let omittedFields = [];
    while (updateError && /column .* does not exist|could not find .* in the schema cache/i.test(updateError.message || '')) {
      const missing = ['position', 'nip'].find(field => updates[field] !== undefined && new RegExp(`(?:profiles\\.)?${field}\\b`, 'i').test(updateError.message));
      if (!missing) break;
      omittedFields.push(missing);
      delete updates[missing];
      const retry = await supabase.from('profiles').update(updates).eq('id', session.user.id);
      updateError = retry.error;
    }
    if (updateError) throw updateError;
    await loadRemote();
    if (omittedFields.includes('position')) throw new Error('Nama tersimpan, tetapi Jabatan belum dapat disimpan. Admin perlu menerapkan migrasi Supabase 007.');
  };
  const uploadProfilePhoto = async file => {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Pilih foto JPG, PNG, atau WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB.');
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = file.type === 'image/png' && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
    const isWebp = file.type === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    if (!(isJpeg || isPng || isWebp)) throw new Error('Isi file tidak sesuai dengan format foto JPG, PNG, atau WebP.');
    if (!session) {
      const avatarUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
        reader.readAsDataURL(file);
      });
      setProfile(current => ({ ...current, avatarUrl }));
      return;
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', session.user.id);
    if (updateError) {
      await supabase.storage.from('profile-avatars').remove([path]);
      throw updateError;
    }
    await loadRemote();
  };
  const manageUser = async payload => {
    if (!session || profile?.role !== 'admin') throw new Error('Hanya Admin yang dapat mengelola akun.');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Pengelolaan akun gagal.');
    return result;
  };
  const syncDrive = async (file, letterId) => {
    if (!session) throw new Error('Sinkronisasi Drive hanya tersedia pada mode Supabase.');
    if (!file?.size || !letterId) throw new Error(!letterId ? 'Simpan surat sebelum mengunggah PDF.' : 'Berkas PDF kosong. Pilih ulang berkas dari perangkat.');
    const form = new FormData(); form.append('file', file, file.name); form.append('letterId', letterId);
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-sync`, { method: 'POST', headers: { Authorization: `Bearer ${activeSession.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, body: form });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sesi login tidak sah atau sudah berakhir.');
      if (response.status === 403) throw new Error(result.error || 'Akses unggah Google Drive ditolak.');
      throw new Error(result.error || `Layanan Google Drive merespons HTTP ${response.status}.`);
    }
    await loadRemote(); return result;
  };
  const confirmLetterComplete = async letter => {
    if (!session) {
      const senderSide = letter.createdById === profile.id || (letter.direction === 'inbound' && letter.requesterId === profile.id);
      const key = senderSide ? 'senderConfirmedAt' : 'recipientConfirmedAt';
      const updated = { ...letter, [key]: new Date().toISOString() };
      const next = letters.map(item => item.id === letter.id ? updated : item);
      setLetters(next); persistDemo(readDemo().movements, next); return updated;
    }
    const { error: confirmError } = await supabase.rpc('confirm_correspondence_complete', { p_letter_id: letter.id });
    if (confirmError) throw confirmError;
    await loadRemote();
  };

  const requestPasswordReset = async (email) => {
    if (!supabase) throw new Error('Pemulihan akun produksi belum terhubung.');
    const { data, error: requestError } = await supabase.functions.invoke('account-recovery', {
      body: { action: 'request', email: email.trim() },
    });
    if (requestError) {
      const payload = await requestError.context?.json?.().catch(() => null);
      throw new Error(payload?.error || requestError.message);
    }
    return data;
  };
  const finishAdminPasswordRecovery = async (email, token, password) => {
    if (!supabase) throw new Error('Pemulihan akun produksi belum terhubung.');
    const { error: resetError } = await supabase.functions.invoke('account-recovery', {
      body: { action: 'reset', email: email.trim(), token, password },
    });
    if (resetError) {
      const payload = await resetError.context?.json?.().catch(() => null);
      throw new Error(payload?.error || resetError.message);
    }
  };
  const changePassword = async (currentPassword, newPassword) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Ubah kata sandi hanya tersedia saat akun terhubung ke Supabase.');
    if (newPassword.length < 12 || newPassword.length > 72) throw new Error('Kata sandi baru harus 12–72 karakter.');
    const { data: currentAuth, error: sessionError } = await supabase.auth.getSession();
    const email = currentAuth?.session?.user?.email || session?.user?.email;
    if (sessionError || !email) throw new Error('Sesi login sudah berakhir. Masuk kembali, lalu ubah kata sandi.');

    // Verify the old password on the same auth client that updates it. This also
    // establishes a fresh Supabase session before updateUser, avoiding a stale
    // React session being mistaken for an active auth session.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      if (/invalid login credentials|invalid password/i.test(verifyError.message || '')) {
        throw new Error('Kata sandi lama tidak sesuai.');
      }
      throw verifyError;
    }
    const { data: verifiedAuth, error: verifiedSessionError } = await supabase.auth.getSession();
    if (verifiedSessionError || !verifiedAuth?.session) {
      throw new Error('Sesi login tidak dapat diperbarui. Masuk kembali, lalu ulangi.');
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      if (/auth session missing/i.test(updateError.message || '')) {
        throw new Error('Sesi login sudah berakhir. Masuk kembali, lalu ulangi perubahan kata sandi.');
      }
      throw updateError;
    }
  };
  const finishPasswordRecovery = async (newPassword) => {
    if (newPassword.length < 12 || newPassword.length > 72) throw new Error('Kata sandi baru harus 12–72 karakter.');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
    setPasswordRecovery(false);
    setRecoveryInvalid(false);
    history.replaceState({}, '', location.pathname);
  };

  return { profile, session, demo, modeLabel, movements, letters, messages, busy, error, passwordRecovery, recoveryInvalid, recoveryChecked, openingRequested, signIn, signInDemo, signOut, saveMovement, deleteMovement, createLetter, createReply, sendMessage, deleteLetter, updateProfile, updateOwnProfile, uploadProfilePhoto, manageUser, syncDrive, confirmLetterComplete, requestPasswordReset, finishAdminPasswordRecovery, changePassword, finishPasswordRecovery, setError, isSupabaseConfigured };
}



