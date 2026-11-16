# E-data AMC · APT Pranoto · Samarinda

Website pencatatan dan pemantauan operasional Apron Movement Control Bandar Udara A.P.T. Pranoto (AAP / WALS). Aplikasi menyediakan ringkasan harian, log pergerakan, laporan, surat masuk, kontrol peran, serta mode pratinjau lokal jika Supabase belum dikonfigurasi.

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

Jika proyek sudah menerapkan migrasi `001_schema.sql`, cukup jalankan migrasi `002_react_app_compat.sql`. Simpan cadangan database sebelum menerapkan perubahan skema.

### Auth dan peran

Matikan registrasi publik di **Authentication → Providers → Email**. Tambahkan akun melalui **Authentication → Users**. Trigger membuat profil `personel` untuk akun baru. Untuk menetapkan admin pertama, jalankan SQL berikut dengan alamat email admin:

```sql
update public.profiles p
set role = 'admin', display_name = 'Admin AMC', nama = 'Admin AMC'
from auth.users u
where p.id = u.id and u.email = 'admin@contoh.id';
```

Peran `pimpinan` hanya dapat membaca data; `personel` dapat mengelola pergerakan dan surat; `admin` juga dapat mengatur profil. RLS dan trigger database menolak perubahan peran atau status akun oleh pemilik profil biasa.

Aktifkan `movements` dan `incoming_letters` pada **Database → Publications → supabase_realtime** jika belum aktif.

## Google Drive melalui Google Apps Script

Arsitektur unggah:

```text
Browser → Supabase Edge Function drive-sync → Google Apps Script Web App → folder Drive
```

Token Apps Script dan URL deployment disimpan sebagai Supabase secrets. Keduanya tidak dikirim ke browser dan tidak boleh dimasukkan ke repo.

1. Buat folder Google Drive untuk arsip surat, lalu salin ID folder dari URL Drive.
2. Buka [Google Apps Script](https://script.google.com), buat proyek, lalu salin `supabase/apps-script/Code.gs` ke editor.
3. Isi konstanta `FOLDER_ID` dengan ID folder tadi. Buat token acak panjang, isi konstanta `TOKEN` dengan nilai yang sama persis, lalu simpan di Apps Script. Jangan commit nilai asli ke GitHub.
4. Pilih **Deploy → New deployment → Web app**, set **Execute as: Me** dan **Who has access: Anyone**. Berikan izin Drive pada akun Google yang dipakai. Salin URL yang berakhiran `/exec`.
5. Deploy fungsi Supabase:

   ```powershell
   supabase functions deploy drive-sync
   supabase secrets set APPS_SCRIPT_URL="https://script.google.com/macros/s/ID_DEPLOYMENT/exec" APPS_SCRIPT_TOKEN="TOKEN_ACAK"
   ```

   `verify_jwt` untuk `drive-sync` tetap aktif. Fungsi memvalidasi sesi Supabase dan peran pengguna sebelum meneruskan berkas ke Apps Script.

6. Setelah mengubah kode Apps Script, deploy versi baru melalui **Deploy → Manage deployments → Edit → New version**.

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
