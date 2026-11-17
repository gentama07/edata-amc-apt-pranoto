# E-data AMC · APT Pranoto · Samarinda

Website pencatatan dan pemantauan operasional Apron Movement Control Bandar Udara A.P.T. Pranoto (AAP / WALS). Aplikasi menyediakan ringkasan harian, log pergerakan, laporan, Persuratan, kontrol peran, serta mode pratinjau lokal jika Supabase belum dikonfigurasi.

## Menjalankan pratinjau lokal

Gunakan Node.js 20.19+ atau Node.js 22 LTS.

```powershell
npm install
npm run dev
```

Jika `.env.local` belum berisi konfigurasi Supabase, pilih peran demo pada layar masuk. Data pratinjau tersimpan hanya di browser itu dan bukan database operasional.

Untuk menghubungkan Supabase secara lokal, salin `.env.example` menjadi `.env.local`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dengan Project URL dan publishable/anon key dari **Project Settings → API**. Kunci tersebut memang dikirim ke browser. Jangan gunakan `service_role` atau secret key di variabel `VITE_`.

## Supabase

### Migrasi database

Repo sudah memiliki skema awal `supabase/migrations/001_schema.sql`. Migrasi `002_react_app_compat.sql` menambah kolom yang diperlukan aplikasi React dan membuat `incoming_letters`. Data pergerakan lama tetap berada di tabel `movements`; surat lama di `surat` disalin ke `incoming_letters`. Migrasi tidak menghapus tabel lama.

Di SQL Editor proyek Supabase, jalankan migrasi sesuai kebutuhan:

1. Jika proyek belum pernah memakai skema AMC, jalankan `supabase/migrations/001_schema.sql`.
2. Jalankan `supabase/migrations/002_react_app_compat.sql`.
3. Jalankan `supabase/migrations/003_correspondence_portal.sql` untuk portal Ground Handling, percakapan real-time, status surat, dan kebijakan RLS peran baru.

Jika proyek sudah menerapkan migrasi `001_schema.sql` dan `002_react_app_compat.sql`, jalankan hanya migrasi `003_correspondence_portal.sql`. Simpan cadangan database sebelum menerapkan perubahan skema.

### Auth dan peran

Matikan registrasi publik di **Authentication → Providers → Email**. Tambahkan akun melalui **Authentication → Users**. Trigger membuat profil `personel` untuk akun baru. Untuk menetapkan admin pertama, jalankan SQL berikut dengan alamat email admin:

```sql
update public.profiles p
set role = 'admin', display_name = 'Admin AMC', nama = 'Admin AMC'
from auth.users u
where p.id = u.id and u.email = 'admin@contoh.id';
```

Peran `pimpinan` hanya dapat membaca data operasional dan mengubah status surat; `personel` dapat mengelola pergerakan dan surat; `admin` juga dapat mengatur profil dan akun; `ground_handling` hanya melihat surat milik perusahaannya dan mengirim chat. RLS memisahkan data pergerakan dari akun Ground Handling dan membatasi surat berdasarkan pengirim. Trigger melindungi peran/status akun dari perubahan pemilik profil.

Akun tanpa registrasi publik dibuat oleh Admin. Fungsi `manage-users` menangani pembuatan akun, perubahan peran/status, dan email melalui Supabase Auth Admin API; jangan pernah menempatkan service role key di frontend. Aktifkan `movements`, `incoming_letters`, dan `correspondence_messages` pada **Database → Publications → supabase_realtime** jika belum aktif.

## Google Drive melalui Google Apps Script

Arsitektur unggah:

```text
Browser → Supabase Edge Function drive-sync → Google Apps Script Web App → folder Drive
```

Token Apps Script dan URL deployment disimpan sebagai Supabase secrets. Keduanya tidak dikirim ke browser dan tidak boleh dimasukkan ke repo.

1. Siapkan folder root `DATA AMC/SURAT` dengan tiga subfolder langsung bernama persis `ADMIN/PIMPINAN`, `GROUND HANDLING`, dan `PETUGAS AMC`.
2. Buka [Google Apps Script](https://script.google.com), lalu salin `supabase/apps-script/Code.gs` ke proyek Web App.
3. Simpan `APPS_SCRIPT_TOKEN` dan `DRIVE_ROOT_FOLDER_ID` di **Project Settings → Script properties**. Token yang sama disimpan sebagai Supabase secret `APPS_SCRIPT_TOKEN`. Jangan commit nilai asli ke GitHub.
4. Pilih **Deploy → New deployment → Web app**, set **Execute as: Me** dan **Who has access: Anyone**. Berikan izin Drive pada akun Google yang dipakai. Salin URL yang berakhiran `/exec`.
5. Deploy fungsi Supabase:

   ```powershell
   supabase functions deploy drive-sync
   supabase secrets set APPS_SCRIPT_URL="https://script.google.com/macros/s/ID_DEPLOYMENT/exec" APPS_SCRIPT_TOKEN="TOKEN_ACAK"
   ```

   Gerbang JWT gateway untuk `drive-sync` dan `manage-users` dimatikan (`verify_jwt = false`); fungsi memvalidasi sesi dengan `auth.getUser()`, memeriksa profil/peran aktif, dan memakai service role hanya di sisi server. Folder arsip ditentukan dari pemilik/pengirim surat: Ground Handling ke `GROUND HANDLING`, Personel AMC ke `PETUGAS AMC`, dan Admin/Pimpinan ke `ADMIN/PIMPINAN`.

6. Setelah mengubah kode Apps Script, deploy versi baru melalui **Deploy → Manage deployments → Edit → New version**. Setelah rotasi token, pastikan versi deployment terbaru dan Supabase secret berisi token yang sama.

7. Jalankan migrasi yang belum diterapkan di SQL Editor Supabase secara berurutan: `006_profiles_chat_identity.sql`, lalu `007_letter_routing_completion_and_position.sql`. Ini menambahkan foto/NIP/profil dan jabatan, pengiriman berdasarkan peran penerima, serta konfirmasi selesai dari kedua pihak.

Apps Script berjalan atas nama pemilik deployment. Gunakan akun Google khusus yang hanya memiliki akses ke folder arsip yang diperlukan. Endpoint Web App dapat dijangkau publik karena setelan Google, sehingga token harus panjang dan disimpan hanya di Apps Script serta Supabase secrets.

## GitHub Pages

Repo publik ini sudah memiliki workflow `.github/workflows/deploy.yml`. Pada GitHub, pastikan **Settings → Pages → Build and deployment → Source** disetel ke **GitHub Actions**. Di **Settings → Secrets and variables → Actions**, isi repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Workflow memeriksa dua nilai tersebut sebelum build. Push ke branch `main` akan membangun situs dengan base path repo dan menerbitkannya ke `https://gentama07.github.io/edata-amc-apt-pranoto/`.

Nilai Supabase boleh disimpan sebagai Actions variables, namun secrets lebih konsisten dengan workflow yang ada. Publishable/anon key akan terlihat di bundle frontend. RLS tetap wajib aktif untuk setiap tabel.

## Pengembangan dan pemeriksaan

```powershell
npm run lint
npm test
npm run build
```

`npm test` memeriksa KPI, validasi waktu, jam WITA, okupansi apron, peringatan keterlambatan/kepadatan, dan sanitasi CSV.

## Persuratan dan kata sandi

Menu **Persuratan** menyediakan portal pengiriman Ground Handling melalui tautan pada halaman login, status, percakapan, unggah surat PDF, serta balasan AMC. Arsip Google Drive tidak ikut dihapus saat catatan surat dihapus dari aplikasi. Admin membuat akun Ground Handling/Pimpinan di menu Pengguna. Portal lupa kata sandi mengirim tautan Supabase Auth; tambahkan URL situs GitHub Pages dengan query `?recovery=1` ke **Authentication → URL Configuration → Redirect URLs**. Pengguna yang masuk dapat mengubah kata sandi dari menu akun setelah mengisi kata sandi lama.

## Struktur utama

```text
src/components/    Komponen aplikasi dan formulir pergerakan
src/config/        Opsi bandar udara
src/hooks/         Status Supabase dan pratinjau lokal
src/lib/           Waktu, analitik, CSV, dan klien Supabase
src/pages/         Ringkasan, log, input, laporan, surat, pengguna
supabase/          Migrasi SQL, Edge Function, dan source Apps Script
.github/workflows/ Build dan deploy GitHub Pages
public/assets/     Logo APT Pranoto dan AMC
```


