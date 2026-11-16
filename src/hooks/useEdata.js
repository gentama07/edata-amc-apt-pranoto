import { useCallback, useEffect, useState } from 'react';
import { demoAccounts } from '../config/airportOptions';
import { initialLetters, initialMovements } from '../lib/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const STORE = 'e-data-amc-demo-v1';
const readDemo = () => {
  try { const value = JSON.parse(localStorage.getItem(STORE) || 'null'); return value || { movements: initialMovements, letters: initialLetters }; }
  catch { return { movements: initialMovements, letters: initialLetters }; }
};
const fromDb = (row) => ({ id: row.id, date: row.operating_date, operator: row.operator, aircraftType: row.aircraft_type, registration: row.registration, flightArr: row.flight_arr, flightDep: row.flight_dep, origin: row.origin, destination: row.destination, sta: row.sta?.slice(0, 5) || '', ata: row.ata?.slice(0, 5) || '', blockOn: row.block_on?.slice(0, 5) || '', std: row.std?.slice(0, 5) || '', blockOff: row.block_off?.slice(0, 5) || '', atd: row.atd?.slice(0, 5) || '', handler: row.ground_handler, stand: row.parking_stand ? `Stand ${row.parking_stand}` : '', riu: row.riu, paxArr: row.pax_arr, paxDep: row.pax_dep, baggageKg: row.baggage_kg, cargoKg: row.cargo_kg, remark: row.remark });
const toDb = (row) => ({ operating_date: row.date, operator: row.operator, aircraft_type: row.aircraftType, registration: row.registration, flight_arr: row.flightArr || null, flight_dep: row.flightDep || null, origin: row.origin || null, destination: row.destination || null, sta: row.sta || null, ata: row.ata || null, block_on: row.blockOn || null, std: row.std || null, block_off: row.blockOff || null, atd: row.atd || null, ground_handler: row.handler || null, parking_stand: Number.parseInt(String(row.stand || '').replace(/\D/g, ''), 10) || null, riu: row.riu || null, pax_arr: Number(row.paxArr || 0), pax_dep: Number(row.paxDep || 0), baggage_kg: Number(row.baggageKg || 0), cargo_kg: Number(row.cargoKg || 0), remark: row.remark || '' });

export function useEdata() {
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [movements, setMovements] = useState([]);
  const [letters, setLetters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = !isSupabaseConfigured || !session;
  const modeLabel = 'Pratinjau lokal terisolasi';

  const loadDemo = useCallback(() => {
    const data = readDemo(); setMovements(data.movements); setLetters(data.letters);
  }, []);
  const persistDemo = useCallback((nextMovements, nextLetters) => {
    localStorage.setItem(STORE, JSON.stringify({ movements: nextMovements, letters: nextLetters }));
  }, []);

  const loadRemote = useCallback(async () => {
    if (!session) return;
    const [profileResult, movementsResult, lettersResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,email,role,active').eq('id', session.user.id).single(),
      supabase.from('movements').select('*').order('operating_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
      supabase.from('incoming_letters').select('*').order('received_date', { ascending: false }).limit(500),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (profileResult.data.active === false) { await supabase.auth.signOut(); throw new Error('Akun ini dinonaktifkan. Hubungi Admin AMC.'); }
    setProfile({ id: profileResult.data.id, name: profileResult.data.display_name || profileResult.data.email, role: profileResult.data.role, email: profileResult.data.email || session.user.email });
    if (movementsResult.error) throw movementsResult.error;
    if (lettersResult.error) throw lettersResult.error;
    setMovements((movementsResult.data || []).map(fromDb));
    setLetters((lettersResult.data || []).map(row => ({ id: row.id, reference: row.reference, date: row.received_date, sender: row.sender, subject: row.subject, status: row.status, fileName: row.file_name, driveFileId: row.drive_file_id })));
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured) loadDemo();
  }, [loadDemo]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, loadRemote]);

  const signIn = async (email, password) => {
    setError('');
    if (!isSupabaseConfigured) throw new Error('Mode lokal tidak menerima akun produksi. Pilih salah satu peran demo.');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
  };
  const signInDemo = (role) => {
    const account = demoAccounts.find(item => item.role === role);
    setProfile({ id: `demo-${role}`, name: account.label, role, email: account.email, active: true });
    loadDemo();
  };
  const signOut = async () => { if (session) await supabase.auth.signOut(); setSession(null); setProfile(null); setError(''); };

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
  const saveLetter = async (row) => {
    if (session) {
      const { data, error: insertError } = await supabase.from('incoming_letters').insert({ reference: row.reference, received_date: row.date, sender: row.sender, subject: row.subject, status: row.status, file_name: row.fileName || null }).select().single();
      if (insertError) throw insertError; await loadRemote(); return data;
    }
    const data = readDemo(); const saved = { ...row, id: `letter-${crypto.randomUUID()}` }; const next = [saved, ...data.letters]; setLetters(next); persistDemo(data.movements, next); return saved;
  };
  const updateLetter = async (id, updates) => {
    if (session) { const { error: updateError } = await supabase.from('incoming_letters').update(updates).eq('id', id); if (updateError) throw updateError; await loadRemote(); return; }
    const data = readDemo(); const next = data.letters.map(row => row.id === id ? { ...row, ...updates } : row); setLetters(next); persistDemo(data.movements, next);
  };
  const updateProfile = async (userId, updates) => {
    if (!session || profile?.role !== 'admin') throw new Error('Hanya Admin yang dapat mengelola profil.');
    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (updateError) throw updateError; await loadRemote();
  };
  const syncDrive = async (file, letterId) => {
    if (!session) throw new Error('Sinkronisasi Drive hanya tersedia pada mode Supabase.');
    const form = new FormData(); form.append('file', file); form.append('letterId', letterId || '');
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-sync`, { method: 'POST', headers: { Authorization: `Bearer ${activeSession.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, body: form });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Sinkronisasi Google Drive gagal.');
    await loadRemote(); return result;
  };

  return { profile, session, demo, modeLabel, movements, letters, busy, error, signIn, signInDemo, signOut, saveMovement, deleteMovement, saveLetter, updateLetter, updateProfile, syncDrive, setError, isSupabaseConfigured };
}
