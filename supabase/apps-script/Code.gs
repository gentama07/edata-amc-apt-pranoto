// Google Apps Script Web App for the Supabase drive-sync Edge Function.
// Keep both properties in Project Settings → Script properties:
//   APPS_SCRIPT_TOKEN
//   DRIVE_ROOT_FOLDER_ID
// Never place production values in this file or commit them to GitHub.
const TOKEN_PROPERTY = 'APPS_SCRIPT_TOKEN';
const ROOT_FOLDER_PROPERTY = 'DRIVE_ROOT_FOLDER_ID';
const ALLOWED_DESTINATIONS = ['ADMIN/PIMPINAN', 'GROUND HANDLING', 'PETUGAS AMC'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function out_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonBody_(event) {
  const encodedPayload = event && event.parameter && event.parameter.payload;
  if (encodedPayload) return JSON.parse(encodedPayload);
  const contents = event && event.postData && event.postData.contents;
  if (contents) return JSON.parse(contents);
  throw new Error('Google Apps Script menerima permintaan tanpa isi. Perbarui deployment Web App ke versi terbaru, lalu pastikan URL berakhiran /exec.');
}

function getProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('Properti skrip belum dikonfigurasi: ' + name);
  return value;
}

function findDestination_(root, name) {
  if (!ALLOWED_DESTINATIONS.includes(name)) throw new Error('Folder tujuan tidak diizinkan.');
  const matches = root.getFoldersByName(name);
  if (!matches.hasNext()) throw new Error('Subfolder arsip tidak ditemukan: ' + name);
  const folder = matches.next();
  if (matches.hasNext()) throw new Error('Ada lebih dari satu subfolder bernama ' + name + '. Pastikan hanya ada satu folder tujuan di dalam folder arsip.');
  return folder;
}

function info_(file) {
  return {
    id: file.getId(),
    name: file.getName(),
    mimeType: file.getMimeType(),
    webViewLink: file.getUrl(),
    modifiedTime: file.getLastUpdated().toISOString(),
  };
}

function doGet() {
  return out_({ ok: true, service: 'E-data AMC Drive Sync' });
}

function doPost(event) {
  try {
    const body = jsonBody_(event);
    const token = getProperty_(TOKEN_PROPERTY);
    if (typeof body.token !== 'string' || body.token !== token) throw new Error('Token tidak sah.');
    if (body.action !== 'upload') throw new Error('Aksi tidak dikenal.');
    if (!body.data || !body.name) throw new Error('Nama dan isi berkas wajib diisi.');

    const bytes = Utilities.base64Decode(body.data);
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error('Ukuran berkas harus antara 1 byte dan 10 MB.');
    if (String(body.mime || '').toLowerCase() !== 'application/pdf' || !/\.pdf$/i.test(String(body.name))) {
      throw new Error('Berkas surat harus berupa PDF.');
    }
    const viewerEmails = Array.isArray(body.viewerEmails)
      ? body.viewerEmails.map(email => String(email || '').trim()).filter(Boolean)
      : String(body.viewerEmail || '').trim().split(',').map(email => email.trim()).filter(Boolean);
    if (viewerEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Email penerima surat tidak valid.');
    const destination = findDestination_(DriveApp.getFolderById(getProperty_(ROOT_FOLDER_PROPERTY)), body.destination);
    const safeName = String(body.name).replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180) || 'surat.pdf';
    const blob = Utilities.newBlob(bytes, 'application/pdf', safeName);
    const file = destination.createFile(blob);
    if (viewerEmails.length) {
      try {
        viewerEmails.forEach(email => file.addViewer(email));
      } catch (shareError) {
        try { file.setTrashed(true); } catch (cleanupError) { /* Keep the sharing error as the primary failure. */ }
        throw new Error('Google Drive gagal memberi akses baca kepada pengirim. Berkas dibatalkan agar tidak tertinggal tanpa catatan. Periksa izin berbagi folder.');
      }
    }
    return out_({ ok: true, file: info_(file) });
  } catch (error) {
    return out_({ error: String(error && error.message ? error.message : error) });
  }
}


