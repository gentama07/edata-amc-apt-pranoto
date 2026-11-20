const HISTORY_KEY = 'amc-service-health-history-v1';
const MAX_HISTORY = 60;
const CHECK_INTERVAL = 30_000;
const listeners = new Set();

const readHistory = () => {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const lastRecord = () => readHistory()[0] || null;
let snapshot = (() => {
  const last = lastRecord();
  return last
    ? { status: last.status, message: last.message, checkedAt: last.checkedAt }
    : { status: 'checking', message: 'Pemeriksaan awal sedang berjalan.', checkedAt: null };
})();
let timer;
let inFlight;

const publish = () => {
  const detail = { ...snapshot, history: readHistory() };
  listeners.forEach(listener => listener(detail));
  window.dispatchEvent(new CustomEvent('amc-service-health-update', { detail }));
};

export function getServiceHistory() {
  return readHistory();
}

export function getServiceSnapshot() {
  return { ...snapshot, history: readHistory() };
}

export function subscribeServiceHealth(listener) {
  listeners.add(listener);
  listener(getServiceSnapshot());
  return () => listeners.delete(listener);
}

const checkEndpoints = async () => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !publicKey) {
    return { status: 'issue', message: 'URL atau public key Supabase belum tersedia di build website.' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6500);
  const options = { headers: { apikey: publicKey }, signal: controller.signal, cache: 'no-store' };
  try {
    const [authResult, restResult] = await Promise.allSettled([
      fetch(`${baseUrl}/auth/v1/health`, options),
      fetch(`${baseUrl}/rest/v1/profiles?select=id&limit=0`, options),
    ]);
    if (authResult.status === 'rejected') throw authResult.reason;
    if (restResult.status === 'rejected') throw restResult.reason;
    const authResponse = authResult.value;
    const restResponse = restResult.value;
    const restBody = await restResponse.clone().json().catch(() => null);
    if (!authResponse.ok) {
      return {
        status: 'issue',
        message: authResponse.status === 401 || authResponse.status === 403
          ? 'Supabase Auth menolak public key. Pastikan URL dan key di GitHub Actions berasal dari proyek yang sama, lalu build ulang.'
          : `Supabase Auth merespons HTTP ${authResponse.status}. Periksa status proyek Supabase.`,
      };
    }
    if (restResponse.ok) {
      return { status: 'online', message: 'Supabase Auth dan Data API merespons normal.' };
    }

    const restMessage = String(restBody?.message || restBody?.details || '').toLowerCase();
    const expectedAnonymousBlock = restBody?.code === '42501'
      && restMessage.includes('permission denied')
      && (restMessage.includes('schema public') || restMessage.includes('profiles'));
    if (expectedAnonymousBlock) {
      return {
        status: 'online',
        message: 'Layanan dapat dijangkau. Akses data tanpa login dibatasi sesuai kebijakan keamanan; pemeriksaan ini tidak membaca profil.',
      };
    }

    if (restResponse.status === 401 || restResponse.status === 403) {
      return {
        status: 'issue',
        message: restMessage.includes('api key') || restMessage.includes('jwt')
          ? 'Data API menolak public key. Pastikan URL dan key di GitHub Actions berasal dari proyek Supabase yang sama, lalu build ulang.'
          : `Data API merespons HTTP ${restResponse.status}, tetapi pemeriksaan dibatasi. Kode: ${restBody?.code || 'tidak tersedia'}.`,
      };
    }
    return {
      status: 'issue',
      message: `Data API merespons HTTP ${restResponse.status}. Periksa konfigurasi proyek Supabase.`,
    };
  } catch (error) {
    return {
      status: 'issue',
      message: error?.name === 'AbortError'
        ? 'Pemeriksaan melewati batas waktu 6,5 detik. Periksa koneksi internet atau status Supabase.'
        : 'Supabase tidak merespons dari browser ini. Periksa koneksi internet atau status proyek.',
    };
  } finally {
    window.clearTimeout(timeout);
  }
};

export async function checkServiceHealth() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const result = await checkEndpoints();
    const checkedAt = new Date().toISOString();
    const previous = snapshot;
    const previousStatus = previous.status;
    const stateChanged = previousStatus !== 'checking' && previousStatus !== result.status;
    const firstCheckIssue = previousStatus === 'checking' && result.status === 'issue';
    const history = readHistory();
    const previousRecord = history[0];
    const reasonChanged = previousRecord?.message !== result.message;
    const hourlyCheckpoint = !previousRecord || Date.now() - Date.parse(previousRecord.checkedAt) >= 60 * 60 * 1000;

    snapshot = { ...result, checkedAt };
    if (!previousRecord || stateChanged || reasonChanged || hourlyCheckpoint) {
      const recovering = result.status === 'online' && previousStatus === 'issue';
      const event = {
        id: `service-${Date.now()}-${crypto.randomUUID()}`,
        status: result.status,
        title: result.status === 'issue' ? 'Layanan sulit dijangkau' : recovering ? 'Layanan kembali terjangkau' : 'Pemeriksaan layanan selesai',
        message: result.message,
        checkedAt,
        notification: stateChanged || firstCheckIssue,
        readAt: null,
      };
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify([event, ...history].slice(0, MAX_HISTORY))); } catch { /* Keep the live status even when storage is unavailable. */ }
    }
    publish();
    return getServiceSnapshot();
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function markServiceNotificationRead(id) {
  const history = readHistory();
  const updated = history.map(event => event.id === id ? { ...event, readAt: new Date().toISOString() } : event);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* The notification remains clickable for this session. */ }
  publish();
}

export function startServiceMonitor(demo = false) {
  if (demo) return () => {};
  if (!timer) {
    checkServiceHealth();
    timer = window.setInterval(checkServiceHealth, CHECK_INTERVAL);
  }
  return () => {
    window.clearInterval(timer);
    timer = undefined;
  };
}
