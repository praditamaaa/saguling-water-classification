# Catatan perubahan

Perubahan metode dan skrip, terbaru di atas. Setiap entri menyebut alasannya.

## 2026-11-09

- Repository dibuat. Skrip GEE dipindah ke `gee/`, skrip Python ke `python/`, dokumen ke `docs/`.
- `docs/10_pemetaan_skrip_dan_hasil.xlsx` diperbarui:
  - Tabel 1 memuat 06a, 06b, 06c, serta deskripsi baru 08 dan 09.
  - Sheet baru Tabel 7a (kalibrasi), Tabel 7 (log digitasi 30 baris), dan Tabel 7c (kesepakatan, kesetaraan penilai, uji bias tim).
  - Tabel 11 menjadi 432 baris dengan kolom Tingkat dan kolom objek apung yang terpetakan sebagai air; Tabel 12 hanya memakai tingkat `semua`.
  - Rumus OA di Tabel 11 diperbaiki menjadi (TP + TN) / total; versi sebelumnya hanya membagi TP.
- Laporan progres 1 dan 2 ditulis di `docs/laporan/`.

## 2026-11-07

- **Lima penilai** menggantikan satu digitator: dua anggota tim dan tiga penilai luar tim, satu perangkat dan satu akun, sesi terpisah dan diawasi. Alasan: arahan dosen minimal tiga penilai dengan voting; dengan tim dua orang, tiga penilai membuat tim memegang mayoritas.
- **Lapisan apung dipisah** menjadi eceng gondok (`eg_`) dan KJA (`kja_`). Alasan: keduanya punya mekanisme galat berbeda (vegetasi lebar vs piksel campuran) dan diurus pihak berbeda; rumusan masalah 2 menanyakan keduanya terpisah. Bila tumpang tindih, piksel dihitung KJA.
- `06_mendigitasi_referensi.js` diganti:
  - `06a_kalibrasi_p1` … `p5` (baru): latihan di petak di luar A, B, C.
  - `06b_digitasi_p1` … `p5`: satu file per penilai karena lapisan gambar GEE tersimpan di dalam file; Asset kini 4 band (r_air, r_waduk, r_eg, r_kja).
  - `06c_voting_lima_penilai.js` (baru): voting 3 dari 5, tingkat kesepakatan 5–0 / 4–1 / 3–2, Fleiss' kappa, IoU 10 pasangan, kesetaraan penilai, uji bias tim.
- `08_mengevaluasi_akurasi.js`: membaca referensi voting; evaluasi di tiga tingkat kesepakatan; kolom eceng gondok dan KJA yang terpetakan sebagai air; uji konsistensi `B_T1_p2` dihapus.
- `09_membuat_tabel_hasil.py`: Tabel XI (ketahanan peringkat), XII (objek apung terpetakan sebagai air), XIII (kesepakatan dan bias tim).
- `02_memilih_tanggal_waduk_penuh.js`: `ee.Feature(null, …)` diganti `ee.Feature(AOI, …)`. Alasan: ekspor ke Asset gagal dengan "Unable to export features with null geometry".
- Materi pengarahan `docs/materi/kalibrasi_awal_penilai.html` dibuat.

## 2026-11-06

- Protokol data referensi ditulis (Panduan Penilai): referensi manual, bukan dari produk otomatis seperti JRC, karena perbandingannya akan melingkar. Dasar: Olofsson dkk. (2014), Stehman & Foody (2019).

## 2026-10-23

- Titik uji A (air terbuka), B (eceng gondok), dan C (KJA) ditetapkan; presentasi progres 1.
- Semua skrip ditulis ulang dengan nama berurutan `01_` … `09_`, komentar penjelasan, dan versi Asset (`VERSI_TANGGAL`, `VERSI_PETAK`, `VERSI_REF`, `VERSI_PETA`) beserta pemeriksaan silsilah. Alasan: GEE tidak bisa menimpa Asset, dan hasil harus bisa ditelusuri ke versi masukannya.
- T1 dan T2 dipilih saat waduk penuh dengan muka air setara. Alasan: saat surut, rumput di dasar waduk tampak sama dengan eceng gondok; Chuzaimah dkk. (2025) mencatat vegetasi lain ikut terhitung sebagai eceng gondok.
