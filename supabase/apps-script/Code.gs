// Tempel di https://script.google.com (proyek baru), isi dua konstanta di bawah, lalu
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
// JANGAN commit nilai asli FOLDER_ID dan TOKEN ke GitHub. Token yang sama diisi
// sebagai secret APPS_SCRIPT_TOKEN di Supabase.
const FOLDER_ID = 'ISI_ID_FOLDER';
const TOKEN = 'ISI_TOKEN_ACAK';

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function info_(f) {
  return { id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), webViewLink: f.getUrl(), modifiedTime: f.getLastUpdated().toISOString() };
}
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== TOKEN) throw new Error('Token salah');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    if (b.action === 'upload') {
      const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mime || 'application/octet-stream', b.name);
      return out_({ ok: true, file: info_(folder.createFile(blob)) });
    }
    const it = folder.getFiles(), files = [];
    while (it.hasNext()) files.push(info_(it.next()));
    return out_({ ok: true, files: files });
  } catch (err) {
    return out_({ error: String(err.message || err) });
  }
}
