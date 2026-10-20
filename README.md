# DMB Compliance — Smart Screening APU-PPT & DTTOT

Aplikasi demo untuk **PT DIDI MAX BERJANGKA** yang mengimplementasikan program
APU-PPT dan anti-terorisme (DTTOT) sesuai **POJK No. 8 Tahun 2023** dan
**UU TPPT No. 9 Tahun 2013**. Dokumen acuan: `DMB-ERD-DaMeL-IT-2410 v1.0`.

Aplikasi berjalan mandiri tanpa layanan eksternal: data demo disimpan pada
`data/screening-db.json` dan di-seed otomatis saat pertama kali dijalankan.

---

## 1. Menjalankan aplikasi

```bash
npm install
npm run dev
```

Buka **http://localhost:3000**.

Perintah lain:

```bash
npm run typecheck   # pemeriksaan TypeScript
npm run build       # build produksi
npm run smoke       # smoke test end-to-end (server harus berjalan)
```

> Smoke test menggunakan `http://localhost:3000`. Jika memakai port lain:
> `SMOKE_BASE=http://localhost:3100 npm run smoke`.

---

## 2. Persona demo

Gunakan pemilih persona di header untuk berpindah peran. Prinsip **four-eyes**
ditegakkan di server: maker tidak dapat menyetujui pengajuannya sendiri.

| Persona | ID | Peran | Kewenangan utama |
|---|---|---|---|
| Rani Pratama | `user-analyst` | Maker / Analis AML | Upload, screening, kelola data nasabah, buka kasus, ajukan approval, buat draft laporan |
| Dimas Wijaya | `user-supervisor` | Checker / Supervisor | Verifikasi kelengkapan bukti, teruskan ke Approver |
| Lestari Handayani | `user-approver` | Approver / Compliance Head | Keputusan final, pemblokiran rekening, kirim laporan ke regulator, cabut freeze, whitelist |
| Bagus Santoso | `user-auditor` | Auditor | Baca hasil screening, kasus, laporan, dan log system (tanpa perubahan) |
| Admin IT | `user-admin` | Admin Sistem | Kelola pengguna, peran, status aktif, dan matriks akses modul |

---

## 3. Modul aplikasi

| Modul | Rute | Ringkasan |
|---|---|---|
| Ringkasan | `/` | Dashboard interaktif dengan jumlah **nasabah, DTTOT, dan APU-PPT terpisah**, tren screening, distribusi risiko, temuan prioritas |
| Smart Search | `/smart-search` | Pencarian lintas nasabah (termasuk NIK terenkripsi), entitas DTTOT/APU-PPT, dan kasus investigasi |
| Hasil Screening | `/results` | Filter severity/sumber/status, komparator berdampingan, buka kasus |
| Kasus & Persetujuan | `/cases` | Investigasi, verifikasi checker, keputusan approver, pemblokiran |
| Data Nasabah | `/customers` | Manajemen data nasabah: profil, jabatan, riwayat kepegawaian, transaksi, penilaian kualitas, ekspor Excel |
| Dashboard Profil Nasabah | `/customers/[id]` | Profil lengkap, skor kualitas per komponen, riwayat, temuan matching, edit profil |
| Data DTTOT | `/dttot` | Dataset DTTOT (PPATK/BNPT): entitas, alias, dokumen identitas, versi sumber, impor/ekspor |
| Data APU-PPT | `/apuppt` | Dataset DPPSPM, PEP, dan UN Sanctions dengan impor/ekspor serta pengelolaan versi |
| Matching Engine | `/matching` | Sinkronisasi ulang seluruh nasabah vs watchlist terkini, cakupan sumber, riwayat eksekusi |
| Laporan Kepatuhan | `/reports` | LTKM PPATK, SIPESAT, laporan berkala OJK, dan **laporan eksekutif** |
| Admin Management | `/admin` | Manajemen pengguna, peran, status aktif, dan matriks akses per modul |
| Log System | `/audit` | Audit trail WORM: snapshot sebelum/sesudah, filter modul/aksi/pengguna, ekspor Excel |

---

## 4. Alur demo yang disarankan

1. **Ringkasan** — perhatikan kartu terpisah untuk nasabah, entitas DTTOT, dan
   entitas APU-PPT, lalu buka temuan prioritas.
2. **Data Nasabah** — telusuri daftar 48 nasabah, filter risiko/kualitas/status,
   buka **profil nasabah** untuk melihat identitas, jabatan, riwayat
   kepegawaian, transaksi, dan skor kualitas; coba **Edit profil** dan
   tampilkan NIK lengkap.
3. **Data DTTOT** dan **Data APU-PPT** — lihat pemisahan dataset per kategori,
   buka detail entitas, unduh template, lalu **Ekspor Excel**.
4. **Smart Search** — cari `syarif`, `CIF-2026-1001`, atau `DTTOT` untuk
   mendapatkan hasil lintas nasabah, watchlist, dan kasus dalam satu tampilan.
5. **Matching Engine** — tekan **Jalankan sinkronisasi** untuk menilai ulang
   seluruh nasabah terhadap 12 entitas aktif; setiap eksekusi membuat batch job
   dan entri audit.
6. **Upload & Screening** — unduh template nasabah, unggah kembali
   (xlsx/xls/csv), lihat auto-mapping kolom, validasi NIK/tanggal lahir, dan
   hasil matching.
7. **Hasil Screening** — buka **komparator** berdampingan dengan penyorotan
   kemiripan teks, lalu buka kasus.
8. **Kasus & Persetujuan** — tambah catatan investigasi, ubah rekomendasi,
   ajukan ke Checker. Berpindah persona: Checker menyetujui → Approver
   menetapkan **Confirmed Hit** → perintah pemblokiran rekening terbit otomatis
   dengan nomor surat perintah.
9. **Laporan Kepatuhan** — buat draft **LTKM PPATK / SIPESAT / Berkala OJK**,
   pratinjau XML, tandai siap kirim, lalu kirim sebagai Approver. Tab
   **Laporan eksekutif** merangkum KPI untuk manajemen dan dapat dicetak.
10. **Admin Management** — sebagai **Admin IT**, tambah pengguna, ubah peran,
    nonaktifkan akun, dan tinjau matriks akses. Setiap perubahan tercatat.
11. **Log System** — filter per modul/aksi/pengguna, lihat snapshot
    `state_before`/`state_after`, dan ekspor jejak audit ke Excel.

Data demo dapat dikembalikan ke kondisi awal kapan saja:

```bash
# Windows PowerShell
Invoke-RestMethod -Method Post http://localhost:3000/api/demo/reset

# macOS/Linux
curl -X POST http://localhost:3000/api/demo/reset
```

---

## 5. Fitur utama

- **Dashboard interaktif** dengan jumlah **nasabah, entitas DTTOT, dan entitas
  APU-PPT terpisah**, tren screening, distribusi risiko, saldo diblokir, serta
  temuan prioritas.
- **Manajemen data nasabah**: profil, jabatan, riwayat kepegawaian, transaksi
  90 hari, filter risiko/kualitas/status, dan ekspor Excel.
- **Dashboard profil nasabah** dengan **penilaian kualitas 0–100 (grade A–D)**
  per komponen: kelengkapan identitas, profil & pekerjaan, data keuangan,
  aktivitas transaksi, serta profil risiko & kepatuhan.
- **Dataset DTTOT dan APU-PPT terpisah** dengan alias, dokumen identitas, dasar
  hukum, versi sumber, template, impor, dan ekspor Excel.
- **Smart Search** lintas nasabah, entitas watchlist, dan kasus, termasuk
  pencarian NIK terenkripsi dan nomor CIF.
- **Matching engine berlapis**:
  - Exact NIK/paspor → **CRITICAL 100%**
  - Token Sort Ratio, Jaro-Winkler, Double Metaphone
  - Bobot: nama 50%, tanggal lahir 25%, tempat lahir 15%, kewarganegaraan 10%
  - Ambang: **≥85 HIGH**, **70–84 POTENTIAL**, **<70 CLEAN**
- **Sinkronisasi matching engine** atas seluruh nasabah dengan cakupan sumber
  aktif, riwayat job, dan pembuatan entri audit; match yang sudah memiliki kasus
  tetap dipertahankan.
- **Maker–checker–approver** berjenjang dengan penolakan self-approval.
- **Pemblokiran seketika** dengan nomor surat perintah, saldo, dan pencabutan
  oleh Approver.
- **Laporan regulator**: LTKM PPATK, SIPESAT pemblokiran, laporan berkala OJK,
  plus rekap screening/kasus/pemblokiran dalam satu workbook.
- **Admin management**: pengguna, peran, status aktif, dan matriks akses per
  modul dengan pengamanan agar admin terakhir tidak dapat dinonaktifkan.
- **Log system append-only (WORM)** untuk seluruh aktivitas create/update/edit
  dengan snapshot state dan ekspor Excel.
- **Privasi data**: NIK dan nomor rekening dienkripsi AES-256-GCM dan dimasking
  pada tampilan serta XML.

---

## 6. Arsitektur

```
src/
  app/                     # Next.js App Router (halaman + API route)
    api/                   # endpoint screening, watchlist, customers, search,
                           # matching, kasus, approval, freeze, laporan,
                           # admin, audit, export, demo
    customers/             # manajemen data nasabah + profil nasabah
    dttot/  apuppt/        # dataset DTTOT & APU-PPT
    smart-search/          # pencarian lintas modul
    matching/              # matching engine & sinkronisasi
    admin/                 # admin management (pengguna, peran, akses)
    reports/               # generator & register laporan + laporan eksekutif
    audit/                 # log system WORM
  components/              # app shell, provider, UI bersama, quality, dataset
  lib/
    matching.ts            # mesin matching & pembobotan
    screening.ts           # ingest Excel + orkestrasi screening
    customer-profile.ts    # profil & skor kualitas nasabah deterministik
    customers.ts           # daftar/detail/metrik/ekspor nasabah
    matching-sync.ts       # sinkronisasi ulang & snapshot matching
    search.ts              # smart search lintas modul
    rbac.ts                # matriks akses per peran & modul
    watchlist-categories.ts# pemetaan kategori DTTOT vs APU-PPT
    crypto.ts              # enkripsi PII & masking
    db.ts                  # persistensi JSON + audit helper
    seed.ts                # data demo deterministik
    reports.ts             # builder XML regulator
scripts/smoke.mjs          # pengujian end-to-end alur utama
data/screening-db.json     # database demo (dibuat otomatis)
```

### API utama

| Endpoint | Keterangan |
|---|---|
| `GET /api/dashboard` | Metrik dashboard + `dataUniverse` (nasabah/DTTOT/APU-PPT) |
| `GET /api/customers` · `GET/PATCH /api/customers/[id]` | Daftar, detail, dan perubahan profil nasabah |
| `GET /api/customers/export` | Ekspor data nasabah ke Excel |
| `GET /api/watchlist?category=DTTOT\|APUPPT` | Dataset terfilter per kategori |
| `GET /api/watchlist/export` | Ekspor dataset watchlist ke Excel |
| `GET /api/search?q=` | Smart search lintas nasabah, entitas, dan kasus |
| `GET/POST /api/matching` | Snapshot dan sinkronisasi matching engine |
| `GET/POST/PATCH /api/admin/users` | Manajemen pengguna (khusus peran Admin) |
| `GET /api/audit` · `GET /api/audit/export` | Log system dan ekspornya |

Demo ini sengaja memakai penyimpanan JSON agar dapat dijalankan tanpa
PostgreSQL/Redis. Seluruh akses data terpusat di `src/lib/db.ts` sehingga dapat
diganti dengan adaptor PostgreSQL (dan Redis untuk antrean job screening) tanpa
mengubah lapisan API/UI.

---

## 7. Catatan kepatuhan dan batasan demo

- Keputusan akhir hanya dapat dilakukan oleh Approver yang ditunjuk.
- Setiap perubahan status, keputusan, pemblokiran, ekspor, perubahan profil
  nasabah, sinkronisasi matching, dan perubahan pengguna menghasilkan entri
  audit baru; entri lama tidak diubah atau dihapus.
- XML laporan memuat identitas institusi, kasus, nasabah (dimasking), entitas
  watchlist, skor, dan dasar hukum.
- Autentikasi disederhanakan menjadi pemilih persona demo (`x-user-id`), bukan
  login produksi; otorisasi tetap divalidasi di server.
- Penyimpanan memakai berkas JSON, bukan PostgreSQL/Redis, dan data nasabah
  dibuat secara deterministik untuk keperluan demonstrasi.
- Batch historis `BATCH-2026-0915-002` (1.197 record) disertakan untuk
  menggambarkan volume arsip; angka "record diproses" pada dashboard mencakup
  arsip tersebut, sedangkan modul nasabah menampilkan 48 nasabah aktif.
- Data pada aplikasi ini adalah **data simulasi** untuk keperluan demonstrasi.
