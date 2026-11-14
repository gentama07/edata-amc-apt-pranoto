# E-data AMC APT Pranoto

Sistem pelaporan Unit Apron Movement Control (AMC) Bandar Udara APT Pranoto Samarinda, versi online dengan database asli. Dikembangkan dari rancangan Tugas Akhir "Digitalisasi Sistem Pelaporan Unit AMC".

| Lapisan | Teknologi |
|---|---|
| Tampilan | Vite + JavaScript, dihosting di GitHub Pages |
| Database, login, real-time | Supabase (PostgreSQL, Auth, Row Level Security, Realtime) |
| Surat masuk | Supabase Edge Function `drive` yang memanggil Google Apps Script untuk membaca dan menulis folder Google Drive |

Peran pengguna (kolom `profiles.role`): `pimpinan` hanya memantau, `personel` dan `admin` boleh input data dan mengakses Drive. Aturan ini dijaga di database (RLS) dan di Edge Function, bukan hanya di tampilan.

```
Browser ──login──> Supabase Auth
   │                    │
   ├─ baca/tulis ─> PostgreSQL (RLS)         (movements, surat, profiles)
   └─ Sinkron/Unggah ─> Edge Function drive ─> Apps Script ─> Folder Drive
```

## 1. Database

1. Buat proyek di https://supabase.com.
2. Buka **SQL Editor**, tempel **isi** (bukan nama) file `supabase/migrations/001_schema.sql`, lalu Run. Opsional: lakukan hal yang sama untuk `supabase/seed.sql` (data nyata 1 Januari 2026 dari TA).
3. Di **Authentication → Sign In / Providers**, matikan *Allow new users to sign up*. Tambahkan pengguna lewat **Authentication → Users → Add user** (centang *Auto Confirm User*). Semua akun baru otomatis berperan `pimpinan`.
4. Beri peran personel atau admin lewat SQL Editor:
   ```sql
   update profiles set role = 'admin', nama = 'Nama Petugas' where id = (select id from auth.users where email = 'petugas@contoh.id');
   ```

## 2. Folder Google Drive (surat masuk)

Tanpa Google Cloud dan tanpa biaya. Gunakan akun Google khusus unit atau akun cadangan, karena skrip berjalan atas nama pemilik akun.

1. Buat folder di Drive. ID folder ada di URL setelah `/folders/`.
2. Buat token acak panjang (jangan sama dengan sandi akun). Di PowerShell:
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]).Replace('+','-').Replace('/','_').TrimEnd('=')
   ```
3. Buka https://script.google.com, proyek baru, tempel `supabase/apps-script/Code.gs`, isi `FOLDER_ID` dan `TOKEN`. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*. Setujui izin (Advanced → Go to ... → Allow). Salin URL berakhiran `/exec`. Setiap kali kode skrip diubah, deploy versi baru.
4. Di Supabase: **Edge Functions → Deploy a new function → Via Editor**, nama `drive`, tempel `supabase/functions/drive/index.ts`, lalu Deploy. Di pengaturan fungsi matikan **Verify JWT**.
5. **Edge Functions → Secrets**, tambahkan `APPS_SCRIPT_URL` (URL `/exec`) dan `APPS_SCRIPT_TOKEN` (token tadi).

Cara lain: dengan Supabase CLI, `supabase functions deploy drive` dan `supabase secrets set APPS_SCRIPT_URL=... APPS_SCRIPT_TOKEN=...`. Pengaturan Verify JWT sudah ada di `supabase/config.toml`.

Batas: unggahan maksimal 10 MB per berkas. Sinkron menyalin berkas baru di folder ke tabel `surat`. Kategori tebakan dari nama berkas (cancel, Re-ETD, PTR, selain itu Lainnya), tanggal diambil dari waktu terakhir berkas diubah di Drive.

## 3. Jalankan lokal

```bash
cp .env.example .env     # Windows: copy .env.example .env
```
Isi `.env` dengan Project URL dan kunci publishable dari **Project Settings → API Keys**:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```
```bash
npm install
npm run dev
```

## 4. Online di GitHub Pages

GitHub Pages gratis memerlukan repo **public**; pastikan tidak ada rahasia yang ter-commit (`git ls-files` tidak boleh menampilkan `.env`). Di repo: **Settings → Pages → Source: GitHub Actions**, lalu **Settings → Secrets and variables → Actions** tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Setiap push ke `main` otomatis dibangun dan dipublikasikan ke `https://<akun>.github.io/<repo>/`.

## Keamanan

- Kunci publishable memang publik; data dilindungi login dan RLS. Jangan pernah commit kunci `secret`/`service_role`, token Apps Script, atau URL `/exec`.
- Apps Script dibuka untuk "Anyone", jadi satu-satunya penjaga adalah token. Gunakan token panjang dan acak, dan ganti (di skrip dan di secret Supabase) bila bocor.
- Ini sistem demo TA. Untuk data operasional sungguhan di bandara, minta izin unit dan tinjauan keamanan terlebih dahulu.

## Laporan dan notifikasi

Menu **Laporan** menyusun Apron Movement Control Sheet harian dan rekap bulanan langsung dari database. Tombol **Cetak / Simpan PDF** memakai fitur cetak browser (pilih *Save as PDF*). Di **Ringkasan**, grafik kepadatan apron dihitung dari Block ON sampai Block OFF, dan notifikasi anomali muncul untuk apron padat (4 pesawat atau lebih bersamaan), kedatangan terlambat lebih dari 30 menit, dan penerbangan yang punya catatan remark.

## Belum ada

Antarmuka input yang dioptimalkan untuk HP, dan perbandingan sistem manual vs digital.
