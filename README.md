# Segmentasi Permukaan Waduk Saguling di Bawah Objek Apung

Tugas besar mata kuliah Pengolahan Citra Digital (PCD), D4 Teknik Informatika, Politeknik Negeri Bandung.

Penelitian ini menguji seberapa andal metode segmentasi air yang sudah terbit (indeks NDWI dan MNDWI dengan ambang tetap, Otsu, dan Canny–Otsu, ditambah morfologi) ketika permukaan waduk tertutup eceng gondok dan keramba jaring apung (KJA). Data: citra Sentinel-2 di Google Earth Engine (GEE).

**Tim:** Muhammad Nabil Syauqi Rasyiq - 241524018, Praditama Ajmal Hasan - 241524023  · **Status:** protokol data referensi selesai; berikutnya sesi kalibrasi dan digitasi lima penilai.

## Latar belakang singkat

PLN Indonesia Power dan Pemkab Bandung Barat mengendalikan eceng gondok di Saguling setiap tahun; pada pertengahan 2026 sekitar 120 ha permukaan tertutup dan berpotensi mengganggu pasokan PLTA hingga 700 MW. Dispernakan Bandung Barat mencatat 45.464 petak KJA sampai 2025, melebihi kapasitas. Kedua masalah itu butuh data luas dan lokasi yang diperbarui rutin. Sentinel-2 gratis dan rutin, tetapi metode indeks air hanya membaca air yang terlihat, sehingga permukaan di bawah objek apung hilang dari peta. Sumber berita ada di [docs/referensi.md](docs/referensi.md).

## Rumusan masalah

1. Seberapa akurat 12 konfigurasi segmentasi pada air terbuka (titik A) dibandingkan akurasi yang dilaporkan jurnal?
2. Seberapa besar akurasi dan luas waduk turun pada permukaan yang tertutup eceng gondok (titik B) dan keramba (titik C)?
3. Apakah closing dan hole filling memulihkan hasil, dan apakah konfigurasi terbaik tetap sama di ketiga titik?

## Rancangan

| Komponen | Isi | Rujukan utama |
| --- | --- | --- |
| Indeks | NDWI, MNDWI | Du dkk. (2016) |
| Ambang | Tetap 0, Otsu global, Canny–Otsu | Du dkk. (2016); Donchyts dkk. (2016); Markert dkk. (2024) |
| Pascaproses | Tanpa, atau closing + hole filling | Soille (2003); Gonzalez & Woods (2018) |
| Titik uji | A air terbuka, B eceng gondok, C KJA; petak 1 × 1 km | Chuzaimah dkk. (2025); Ji dkk. (2009) |
| Tanggal | T1 dan T2 saat waduk penuh dengan muka air setara | Keputusan tim dari keterbatasan Chuzaimah dkk. (2025) |
| Referensi | Lima penilai, voting minimal 3 dari 5 | Stehman & Foody (2019); Olofsson dkk. (2014) |
| Evaluasi | IoU, F1, bias luas, Spearman ρ, per tingkat kesepakatan | Olofsson dkk. (2014) |

12 konfigurasi = 2 indeks × 3 ambang × 2 pascaproses. Alasan tiap keputusan ada di [docs/laporan/](docs/laporan/) dan [docs/panduan-penilai.md](docs/panduan-penilai.md).

## Alur langkah

```mermaid
flowchart LR
  A["01–02<br/>Pilih tanggal<br/>waduk penuh"] --> B["03–05<br/>Tetapkan petak<br/>A, B, C"]
  B --> C["06a<br/>Kalibrasi<br/>penilai"]
  C --> D["06b<br/>Digitasi<br/>5 penilai"]
  D --> E["06c<br/>Voting dan<br/>kesepakatan"]
  B --> F["07<br/>Segmentasi<br/>12 konfigurasi"]
  E --> G["08<br/>Evaluasi<br/>akurasi"]
  F --> G
  G --> H["09<br/>Tabel hasil<br/>naskah"]
```

Anggota tim menggambar referensi (06b) sebelum Langkah 07 dijalankan, agar referensi tidak terpengaruh hasil segmentasi.

## Struktur repository

```
gee/        skrip Earth Engine 01–08; 00_BACA_DULU.txt berisi urutan, versi Asset, dan panduan galat
python/     09_membuat_tabel_hasil.py (hanya pustaka standar Python 3.8+)
docs/       panduan penilai, referensi, laporan progres, materi kalibrasi, Excel pemetaan skrip
data/       CSV kecil hasil ekspor GEE
hasil/      tabel_hasil.md dan gambar untuk naskah
presentasi/ PDF deck tiap presentasi progres
```

## Cara menjalankan

1. Baca `gee/00_BACA_DULU.txt`.
2. Di [code.earthengine.google.com](https://code.earthengine.google.com), buat skrip dengan nama yang sama seperti di `gee/`, tempel isinya, lalu jalankan berurutan. Setiap skrip punya bagian `0. PARAMETER` di atas.
3. Untuk Langkah 06, ikuti [docs/panduan-penilai.md](docs/panduan-penilai.md). Satu penilai memakai satu file `06a_kalibrasi_pN.js` dan satu file `06b_digitasi_pN.js`.
4. Unduh CSV dari Google Drive (folder `PCD_Saguling`) ke `data/`, lalu:

```bash
python python/09_membuat_tabel_hasil.py data/08_evaluasi_vote_v1_v1.csv data/07_ambang_otomatis_v1.csv \
    data/06c_kesepakatan_vote_v1.csv data/06c_iou_pasangan_vote_v1.csv
```

Hasilnya `tabel_hasil.md`; pindahkan ke `hasil/`.

Skrip GEE di repository ini adalah sumber utama. Ubah di sini dulu, commit, lalu tempel ke GEE, supaya versi di GEE dan di laporan tidak berbeda.

## Privasi

Penilai ditulis dengan kode p1–p5 saja. Nama penilai dan lembar catatan bernama disimpan di luar repository.

## Laporan progres

| Tanggal | Laporan | Tag |
| --- | --- | --- |
| 23 Oktober 2026 | [Progres 1: penentuan titik uji A, B, C](docs/laporan/2026-10-23-progres-1.md) | `progres-1` |
| 9 November 2026 | [Progres 2: protokol data referensi lima penilai](docs/laporan/2026-11-09-progres-2.md) | `progres-2` |
