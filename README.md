# E-data AMC APT Pranoto

Sistem pelaporan Unit Apron Movement Control (AMC) Bandar Udara APT Pranoto Samarinda, versi online dengan database asli. Dikembangkan dari rancangan Tugas Akhir "Digitalisasi Sistem Pelaporan Unit AMC".

| Lapisan | Teknologi |
|---|---|
| Tampilan | Vite + JavaScript, dihosting di GitHub Pages |
| Database, login, real-time | Supabase (PostgreSQL, Auth, Row Level Security, Realtime) |
| Surat masuk | Supabase Edge Function `drive` yang terhubung ke folder Google Drive |

Peran pengguna (kolom `profiles.role`): `pimpinan` hanya memantau, `personel` dan `admin` boleh input data dan mengakses Drive. Aturan ini dijaga di database (RLS), bukan hanya di tampilan.

## 1. Database

1. Buat proyek di https://supabase.com.
2. Buka **SQL Editor**, jalankan isi `supabase/migrations/001_schema.sql`. Opsional: jalankan `supabase/seed.sql` (data nyata 1 Januari 2026 dari TA).
3. Di **Authentication → Sign In / Providers**, matikan *Allow new users to sign up*. Tambahkan pengguna lewat **Authentication → Users → Add user**. Semua akun baru otomatis berperan `pimpinan`.
4. Beri peran personel atau admin lewat SQL Editor:
   ```sql
   update profiles set role = 'personel', nama = 'Nama Petugas' where id = (select id from auth.users where email = 'petugas@contoh.id');
   ```

## 2. Folder Google Drive (surat masuk)

1. Buat folder, misalnya `DATA AMC/SURAT`. ID folder ada di URL: `drive.google.com/drive/folders/<ID>`.
2. Di Google Cloud Console: aktifkan **Google Drive API**, lalu buat **OAuth client ID** (Web application) dengan redirect URI `https://developers.google.com/oauthplayground`. Ubah status OAuth consent screen ke **In production**, kalau tidak refresh token kedaluwarsa dalam 7 hari.
3. Buka https://developers.google.com/oauthplayground, klik ikon gerigi, centang *Use your own OAuth credentials*, isi client ID dan secret. Otorisasi scope `https://www.googleapis.com/auth/drive` memakai akun Google yang memiliki folder, lalu salin **refresh token**.
4. Pasang Supabase CLI, lalu:
   ```bash
   supabase login && supabase link --project-ref <PROJECT_REF>
   supabase secrets set G_CLIENT_ID=... G_CLIENT_SECRET=... G_REFRESH_TOKEN=... DRIVE_FOLDER_ID=...
   supabase functions deploy drive
   ```
Gunakan akun Google khusus unit, bukan akun pribadi: token itu punya akses ke seluruh Drive akun tersebut.

## 3. Jalankan lokal

```bash
cp .env.example .env     # isi URL dan anon key dari Project Settings → API
npm install
npm run dev
```

## 4. Masukkan ke GitHub dan online

```bash
git init && git add . && git commit -m "E-data AMC APT Pranoto"
git branch -M main && git remote add origin https://github.com/<akun>/<repo>.git && git push -u origin main
```
Di repo GitHub: **Settings → Pages → Source: GitHub Actions**, lalu **Settings → Secrets and variables → Actions** tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Setiap push ke `main` otomatis dibangun dan dipublikasikan. Anon key memang publik; keamanan data ada di RLS. Jangan pernah commit `service_role` key atau kunci Google.

## Catatan

- Sinkron Drive menyalin berkas baru di folder ke tabel `surat`. Untuk sinkron otomatis, jadwalkan pemanggilan function `drive` memakai Supabase Cron.
- Fitur dari TA yang belum dibuat di versi ini: laporan harian/bulanan otomatis (PDF), notifikasi anomali kepadatan apron, dan input dari HP.
