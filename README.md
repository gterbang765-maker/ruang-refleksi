# Ruang Refleksi (React + Supabase)

Website kritik/saran presentasi kelompok. Frontend menggunakan React + Vite; data disimpan di Supabase.

## Fitur

- Halaman utama responsif dan ilustrasi kelompok placeholder.
- Form feedback: nama opsional (kosong menjadi `Anonim`) dan pesan.
- Dashboard admin dengan login email/password Supabase.
- Pencarian, urut nama A–Z/Z–A, urut waktu terbaru/terlama.
- Pilih pesan, hapus pesan terpilih, hapus semua pesan.
- RLS: pengunjung boleh INSERT feedback; hanya UUID yang didaftarkan di `admin_users` bisa membaca/menghapus.

## 1. Jalankan di VS Code

Install Node.js versi LTS terlebih dahulu: https://nodejs.org/

Buka folder ini di VS Code, lalu buka Terminal > New Terminal:

```bash
npm install
```

Buat file `.env.local` di folder utama (selevel dengan `package.json`) dengan isi:

```env
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=PASTE_PUBLISHABLE_OR_ANON_KEY
```

Ganti nilainya dari Supabase Dashboard > Project Settings > API. Gunakan publishable key atau legacy anon key saja. **Jangan pernah masukkan `service_role` atau secret key ke frontend.**

Jalankan:

```bash
npm run dev
```

Vite akan menampilkan alamat lokal, biasanya http://localhost:5173

Sebelum deploy, tes build:

```bash
npm run build
```

## 2. Siapkan Supabase

1. Buat project di https://supabase.com/
2. Buka SQL Editor, lalu jalankan seluruh isi `supabase/schema.sql`.
3. Buka Authentication > Users, lalu buat user admin dengan email dan password yang kuat.
4. Salin UUID user admin tersebut.
5. Buka SQL Editor dan jalankan query berikut, ganti UUID dengan milik akunmu:

```sql
insert into public.admin_users (user_id)
values ('GANTI_DENGAN_UUID_USER_ADMIN');
```

6. Ambil Project URL dan publishable/anon key dari Project Settings > API, lalu masukkan ke `.env.local`.
7. Restart server lokal setelah mengubah `.env.local` (Ctrl+C lalu `npm run dev`).

### Tentang privasi dan satu kali kirim

Pengunjung tidak perlu login dan nama boleh anonim. `localStorage` hanya membatasi pengiriman ulang dari browser yang sama; pengguna masih dapat menghapus data browser atau memakai perangkat lain. Jangan menganggap ini sebagai verifikasi satu orang satu kiriman. Jika aturan satu kali kirim harus benar-benar ditegakkan, gunakan kode undangan unik atau autentikasi pengirim.

## 3. Upload ke GitHub

Jangan commit `.env.local`. File itu sudah masuk `.gitignore`.

Cara termudah:
1. Buat repository kosong di GitHub.
2. Buka terminal pada folder proyek.
3. Jalankan perintah berikut (ganti URL repository):

```bash
git init
git add .
git commit -m "Create Ruang Refleksi"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Jika Git sudah diinisialisasi, jangan ulangi `git init` atau `git remote add origin`; cek `git remote -v` terlebih dahulu.

## 4. Deploy ke Vercel

1. Buka https://vercel.com/ dan login dengan GitHub.
2. Pilih Add New > Project, lalu import repository.
3. Framework Preset biasanya terdeteksi sebagai Vite. Build command `npm run build`, output directory `dist`.
4. Di bagian Environment Variables tambahkan:
   - `VITE_SUPABASE_URL` = Project URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = publishable/anon key
5. Klik Deploy.
6. Jika mengubah environment variables, lakukan redeploy.

## 5. Mengganti ilustrasi dengan foto kelompok

Ganti bagian JSX `<div className="group-card"> ... </div>` di `src/App.jsx` dengan elemen gambar, misalnya:

```jsx
<div className="group-card real-group-photo">
  <img src="/foto-kelompok.jpg" alt="Foto kelompok presentasi" />
  <div className="group-card-caption">Ruang untuk belajar bersama.</div>
</div>
```

Letakkan `foto-kelompok.jpg` di folder `public/` (buat foldernya jika belum ada), lalu tambahkan CSS agar gambar pas:

```css
.real-group-photo { padding: 0; }
.real-group-photo img { width: 100%; height: 100%; min-height: 285px; object-fit: cover; }
.real-group-photo .group-card-caption { position: absolute; left: 24px; right: 24px; bottom: 20px; text-shadow: 0 1px 8px #000; }
```

## Struktur folder

```text
ruang-refleksi-react/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles.css
│   └── supabaseClient.js
└── supabase/
    └── schema.sql
```
