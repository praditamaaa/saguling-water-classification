# Catatan perubahan

Perubahan metode dan skrip, terbaru di atas. Setiap entri menyebut alasannya.

## 2026-11-20

- **Digitasi ulang v2** setelah kalibrasi ulang dengan kunci interpretasi citra resolusi tinggi di area latihan. Alasan: kesepakatan v1 rendah untuk eceng gondok dan KJA (κ r_eg B_T1 = 0,21; IoU r_kja antarpenilai 0,31–0,43), sedangkan judul menjanjikan peta objek apung.
  - `06b_digitasi_p1_v2` … `p5_v2` (baru): file baru agar gambar v1 tidak menjadi patokan; basemap satelit dimatikan; 12 kombinasi per penilai (A–C × T1, T2, T3; D–D1, E–D2, F–D3).
  - Asset v1 tetap disimpan untuk membandingkan kesepakatan sebelum dan sesudah kalibrasi.
- **Data latih diperluas**: petak D (eceng gondok) pada D1, E (KJA) pada D2, F (eceng gondok) pada D3, digitasi lima penilai. Alasan: data latih semula hanya 3 lokasi dan 2 tanggal (keduanya Agustus); voting v1 menunjukkan eceng gondok (34,9 ha latih) dan KJA (45,4 ha) seimbang tetapi masing-masing dari satu kawasan, dan eceng gondok paling berubah antartanggal. Satu tanggal per petak tambahan memberi lebih banyak kondisi waktu daripada dua tanggal untuk ketiganya, dengan biaya lebih kecil (12 vs 15 kombinasi). 05b memeriksa syarat petak (≥ 1 km dari A–C, ≥ 50% di dalam waduk, tidak tumpang tindih) dan vegetasi apung ≥ 5 ha di D dan F.
- **T3 sebelum Oktober 2025**: tanggal uji tidak harus sesudah T1. Alasan: data uji tanpa PLTS terapung agar kelasnya sama dengan data latih. T1, T2, T3, D1, D2, D3 saling berjarak ≥ 60 hari.
- `05b_memilih_tanggal_dan_petak_tambahan.js` menggantikan `05b_memilih_tanggal_uji_T3.js`. Versi lama memicu "Too many concurrent aggregations" karena menghitung `reduceRegion` per petak di dalam `map` per tanggal. Kini satu `reduceRegion` per tanggal (semua petak dalam satu citra berlabel), Console dibatasi pada `TAHUN_TAMPIL`, dan tabel lengkap diekspor ke CSV.
- Pencegahan galat yang sama di skrip lain:
  - `06c`: semua tanggal dan ukuran satu petak dihitung dalam satu `reduceRegion` (6 agregasi, bukan 2 per kombinasi); hasil kappa dan IoU tidak berubah. Kombinasi diatur lewat `PETAK_KODE`.
  - `07`: ambang otomatis dicetak per tanggal.
  - `08`: Console hanya menampilkan petak B tanggal T1; tabel lengkap tetap di CSV.
  - `10`: jumlah piksel per kelas memakai satu `frequencyHistogram` per tanggal.
- `08`: bawaan `VERSI_REF = 'vote_v2'`. `09`: tabel bias tim hanya memakai petak A–C pada T1, T2.
- **Naskah 2 (machine learning)**:
  - `10_membuat_dataset_ml.js` (baru): 22 fitur PCD per piksel dan label voting; CSV per tanggal (T1, T2, T3 untuk A–C; D1, D2, D3 untuk D, E, F); peta ilustrasi opsional untuk tanggal terbaru dengan PLTS dimasker.
  - `ml/11_pelatihan_model.ipynb` (baru): model terbaik dipilih dari skor validasi silang (bukan skor T3); tabel selisih validasi vs uji untuk mendeteksi *overfitting*; 5 model × 4 set fitur, GroupKFold per blok, McNemar + Holm, bootstrap per blok, kepentingan fitur, uji silang tanggal, E5 dengan/tanpa petak tambahan, peta dan luas seluruh waduk. Berjalan di Kaggle dan Colab; diuji dengan data tiruan.
  - `docs/metodologi-ml.md` (baru): rancangan eksperimen yang dikunci sebelum data uji dilihat; bagian 10 berisi dasar setiap keputusan (rujukan terverifikasi, data penelitian, atau keputusan tim) dan daftar pustakanya.
  - Notebook: ukuran blok validasi silang ditentukan dari jangkauan autokorelasi label (diperbesar otomatis bila perlu) dan diperiksa lagi dengan autokorelasi residu (Roberts dkk., 2017); bias proporsi kelas di T3 dilaporkan (Millard & Richardson, 2015).
  - `tools/buat_06b_v2.py`: pembuat lima file 06b v2 dari satu templat.

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
