# Metodologi Eksperimen Machine Learning

Dokumen ini mengunci rancangan eksperimen **sebelum** data uji dilihat. Perubahan setelah hasil keluar harus dicatat di bagian 12 beserta alasannya. Dasar setiap keputusan ada di bagian 10.

## 1. Tujuan dan pertanyaan penelitian

Mengklasifikasikan permukaan Waduk Saguling menjadi **air terbuka, eceng gondok, dan KJA** dari citra Sentinel-2 memakai fitur hasil pengolahan citra digital (PCD), lalu membandingkan beberapa model machine learning secara adil.

| RQ | Pertanyaan | Dijawab oleh |
| --- | --- | --- |
| RQ1 | Seberapa akurat klasifikasi tiga kelas pada tanggal yang tidak dipakai melatih? | E1 |
| RQ2 | Model mana yang paling akurat, dan apakah perbedaannya bermakna secara statistik? | E1, E3 |
| RQ3 | Seberapa besar tiap kelompok fitur PCD menaikkan akurasi dibanding pita mentah? | E2, E3 |
| RQ4 | Fitur apa yang paling penting, dan kelas mana yang paling sering tertukar? | E4 |
| RQ5 | Apakah menambah lokasi dan tanggal latih (petak D–F) memperbaiki generalisasi? | E5 |
| RQ6 | Apakah ML lebih akurat daripada aturan PCD tiga kelas tanpa pembelajaran? | E0, E3 |
| RQ7 | Apakah pita NIR/SWIR diperlukan, atau citra RGB saja sudah cukup? | E2 (FRGB), E3 |

## 2. Alur dan skrip

| Langkah | Skrip | Keluaran |
| --- | --- | --- |
| 05b | `gee/05b_memilih_tanggal_uji_T3_dan_petak_tambahan.js` | Asset `saguling_tambahan_v1` (T3, D1, D2, D3; petak D, E, F) |
| 06a | kalibrasi ulang dengan kunci interpretasi citra tajam (di area latihan) | catatan Excel Tabel 7a |
| 06b v2 | `gee/06b_digitasi_pN_v2.js` (5 file) | Asset `saguling_ref_<petak>_<T>_pN_v2`, 12 kombinasi per penilai |
| 06c | `gee/06c_voting_lima_penilai.js` (`PETAK_KODE`) | Asset `saguling_ref_<petak>_<T>_vote_v2` |
| 07 | `gee/07_menyegmentasi_26_konfigurasi.js` | peta 26 konfigurasi (5 transformasi satu kanal × ambang × pascaproses) untuk T1, T2, T3, D1–D3 |
| 08–09 | evaluasi 12 kombinasi petak–tanggal; `python/09_membuat_tabel_hasil.py` Tabel XIV | konfigurasi segmentasi terbaik dipilih dari kombinasi **latih** saja |
| 10 | `gee/10_membuat_dataset_ml.js` | CSV `dataset_T1/T2/T3/D1/D2/D3_v2`, `waduk_T3_v2` |
| 11 | `ml/11_pelatihan_model.ipynb` (Kaggle atau Colab) | tabel, gambar, model di `hasil_ml/` |

Langkah 10 bergantung pada hasil Langkah 09, karena masker waduk dan fitur bentuk memakai konfigurasi segmentasi terbaik dari Naskah 1.

**Segmentasi air (Langkah 07).** Lima transformasi mengubah citra multipita menjadi satu kanal, lalu diberi aturan ambang dan morfologi yang sama:

| Transformasi | Kanal (air bernilai tinggi) | Ambang | Konfigurasi |
| --- | --- | --- | --- |
| NDWI | (B3 − B8)/(B3 + B8) | tetap 0, Otsu, Canny–Otsu | K1–K6 |
| MNDWI | (B3 − B11)/(B3 + B11) | tetap 0, Otsu, Canny–Otsu | K7–K12 |
| NDVI | −(B8 − B4)/(B8 + B4) | tetap 0, Otsu, Canny–Otsu | K13–K18 |
| Grayscale (RGB) | 1 − 2·min(gray/0,3; 1), gray = 0,299 B4 + 0,587 B3 + 0,114 B2 | Otsu, Canny–Otsu | K19–K22 |
| PCA1 | komponen utama pertama 10 pita per tanggal, dibakukan, tanda diatur | Otsu, Canny–Otsu | K23–K26 |

Ambang tetap 0 hanya untuk indeks ternormalisasi karena hanya di sana nilai 0 bermakna fisik. K1–K12 sama dengan rancangan 12 konfigurasi sebelumnya. Grayscale menjawab pertanyaan apakah citra RGB saja cukup; PCA1 mewakili transformasi berbasis data. Konfigurasi terbaik dipilih dari IoU air rata-rata seluruh kombinasi latih (A–C pada T1, T2; D, E, F), bukan dari T3.

## 3. Data

**Pembagian data**

| Peran | Petak | Tanggal | Penilai |
| --- | --- | --- | --- |
| Latih | A, B, C | T1 (26 Agustus 2025), T2 (1 Agustus 2024) | 5, voting |
| Latih tambahan | D: eceng gondok, lokasi 2 | D1 | 5, voting |
| Latih tambahan | E: KJA, lokasi 2 | D2 | 5, voting |
| Latih tambahan | F: eceng gondok, lokasi 3 | D3 | 5, voting |
| **Uji** | A, B, C | T3 | 5, voting |

Total 12 kombinasi petak–tanggal per penilai. Data latih berasal dari 6 lokasi dan 5 tanggal; data uji adalah lokasi uji pada tanggal yang tidak pernah dipakai melatih.

**Mengapa D, E, F berisi ini.** Dari voting v1, luas latih eceng gondok (setelah petak C dibuang) 34,9 ha dan KJA 45,4 ha, dibanding air 256,5 ha. Jumlah keduanya seimbang, tetapi masing-masing hampir hanya berasal dari satu kawasan (eceng gondok dari B, 81% KJA dari C). Eceng gondok mendapat dua lokasi tambahan karena luasnya paling sedikit, paling berubah antartanggal (243–1.165 ha pada 2019–2023; Chuzaimah dkk., 2025), dan paling sulit disepakati penilai. KJA mendapat satu lokasi karena strukturnya hampir tidak berubah. Kelas air tidak ditambah karena sudah dominan dan berada di luar fokus judul.

**Mengapa tiap petak tambahan memakai tanggalnya sendiri.** Dengan jumlah kombinasi yang sama, tiga tanggal berbeda menambah lebih banyak kondisi waktu daripada tiga petak pada satu tanggal. Untuk mencegah *overfitting*, jumlah kondisi berbeda (lokasi × waktu) lebih menentukan daripada jumlah piksel.

**Syarat petak D, E, F** (ditetapkan sebelum melihat tanggal; Langkah 05b memeriksa butir 1 dan 3):
1. tidak tumpang tindih dengan A–C, satu sama lain, maupun area latihan kalibrasi, dan berjarak ≥ 1 km dari tepi petak A–C;
2. berada di lengan waduk yang berbeda dari petak sejenis (D dan F berbeda dari B dan dari satu sama lain; E berbeda dari C);
3. ≥ 50% luas petak di dalam batas waduk (JRC *max extent*);
4. D dan F sering tertutup vegetasi apung di peta frekuensi; bila memungkinkan D hamparan rapat dan F hamparan jarang atau sedang tumbuh. E menunjukkan kisi keramba di basemap dan tekstur NIR tinggi;
5. 1 × 1 km sejajar grid 20 m.

**Aturan tanggal T3, D1, D2, D3** (Langkah 05b, diperiksa otomatis):
- waduk penuh: air terbuka ≥ 70%, sisa ≤ 10%, awan di batas waduk ≤ 10%;
- selisih air terbuka terhadap T1 dan T2 ≤ 2 poin;
- **sebelum Oktober 2025** (sebelum PLTS terapung), agar kelas data uji sama dengan data latih;
- T1, T2, T3, D1, D2, D3 saling berjarak ≥ 60 hari;
- petak yang dipakai 100% bebas awan pada tanggalnya (A–C pada T3; D pada D1; E pada D2; F pada D3);
- pada D1 dan D3, vegetasi apung di petaknya ≥ 5 ha (objek memang ada);
- utamakan bulan yang berbeda dari Agustus dan berbeda satu sama lain.

Karena T3 boleh lebih lama dari T1, pengujian bersifat **antartanggal**, bukan peramalan. Untuk kondisi terbaru, peta seluruh waduk pada tanggal ilustrasi (PLTS dimasker) disajikan terpisah dan tidak masuk angka akurasi.

**Unit analisis.** Piksel 20 m pada grid UTM 48S. Enam petak 1 × 1 km (2.500 piksel per petak per tanggal).

**Label** (dari voting lima penilai, Asset `vote_v2`):

| Nilai | Kelas | Dipakai |
| --- | --- | --- |
| 0 | air terbuka | ya |
| 1 | eceng gondok | ya |
| 2 | KJA | ya |
| 3 | di luar permukaan waduk | tidak (ditangani masker segmentasi) |
| −1 | di dalam waduk, tanpa kelas mayoritas (mis. 2–2–1) | tidak |

Kolom `sepakat` = jumlah penilai yang memilih label itu (3, 4, atau 5).

**Data latih:** piksel berlabel 0–2 dengan `sepakat` ≥ 4 dari A–C pada T1, T2, D pada D1, E pada D2, dan F pada D3. Piksel eceng gondok di petak C dibuang, karena penilai melaporkan eceng gondok di sekitar KJA tidak dapat dipastikan pada 20 m (Elmes dkk., 2020: galat label latih harus dikendalikan).
**Data uji:** semua piksel T3 berlabel 0–2, dilaporkan pada tiga tingkat: semua, ≥ 4 dari 5, dan 5 dari 5.

## 4. Fitur (Tabel III Naskah 2)

| Kelompok | Fitur | Teknik PCD | Parameter | Alasan |
| --- | --- | --- | --- | --- |
| F0 Pita (10) | B2, B3, B4, B8, B5, B6, B7, B8A, B11, B12 | reflektansi, pita 10 m dirata-rata 2 × 2 ke 20 m | — | pembanding dasar; pita *red-edge* dipakai studi vegetasi apung (Ade dkk., 2022) |
| F1 Indeks (3) | NDWI, MNDWI, NDVI | aritmetika antarpita | — | air vs vegetasi |
| F2 Tekstur dan tepi (5) | simpangan baku lokal NIR; GLCM kontras, homogenitas, entropi; kepadatan tepi | statistik jendela, GLCM, Canny | jendela 5 × 5 (SD, tepi) dan 3 × 3 (GLCM) piksel 10 m; 64 tingkat keabuan; Canny pada NDVI τ = 0,3, σ = 1 | kisi KJA kasar dan banyak tepi |
| F3 Morfologi dan bentuk (4) | *top-hat* putih dan hitam NIR; luas komponen kandidat objek apung; jarak ke air terbuka | *opening*, *closing*, komponen terhubung, transformasi jarak | cakram r = 2 piksel 10 m; komponen ≤ 1.024 piksel | ukuran dan posisi hamparan vs blok KJA |

Total 22 fitur (set F0123). Set pembanding **FRGB** hanya berisi B2, B3, B4, untuk menguji apakah pita NIR/SWIR diperlukan.

| Set | Isi | Jumlah |
| --- | --- | --- |
| FRGB | B2, B3, B4 | 3 |
| F0 | F0 | 10 |
| F01 | F0 + F1 | 13 |
| F012 | F0 + F1 + F2 | 18 |
| F0123 | F0 + F1 + F2 + F3 | 22 |

`luas_komponen` dan `jarak_air` ditransformasi log(1 + x) di notebook. Transformasi ini tidak mengubah hasil model pohon, tetapi menstabilkan model berbasis jarak dan gradien.

## 5. Model yang dibandingkan

Lima model mewakili lima keluarga pengklasifikasi yang umum di penginderaan jauh. Kelimanya cocok untuk data tabular dengan ribuan sampel.

| Kode | Model | Keluarga | Alasan dipilih | Grid hiperparameter |
| --- | --- | --- | --- | --- |
| LR | Regresi logistik multinomial | linear | pembanding sederhana; menunjukkan apakah batas kelas linear | C ∈ {0,1; 1; 10} |
| SVM | SVM kernel RBF | kernel | klasik di penginderaan jauh, kuat pada sampel kecil | C ∈ {1; 10; 100}, γ ∈ {scale; 0,05} |
| RF | Random forest, 300 pohon | ansambel *bagging* | paling banyak dipakai untuk eceng gondok (Singh 2020; Bayable 2023) | max_features ∈ {√p; 0,33}, min_samples_leaf ∈ {1; 5} |
| HGB | Histogram gradient boosting | ansambel *boosting* | setara XGBoost/LightGBM, tersedia di scikit-learn | learning_rate ∈ {0,05; 0,1}, max_leaf_nodes ∈ {15; 31} |
| MLP | Jaringan saraf 1–2 lapis tersembunyi | jaringan saraf | mewakili jaringan saraf dalam batas data tabular | lapis ∈ {(64); (64, 32)}, α ∈ {10⁻⁴; 10⁻³} |

**Ketidakseimbangan kelas** ditangani setara: bobot kelas seimbang (LR, SVM, RF, HGB), atau *oversampling* acak di dalam fold untuk MLP.

**Batas lingkup.** *Deep learning* berbasis citra (CNN, U-Net) tidak dipakai. Data berlabel hanya berasal dari tiga petak di tiga tanggal, sehingga model jenis itu mudah *overfit*. Selain itu, pertanyaan penelitiannya adalah sumbangan fitur PCD, yang paling jelas diukur dengan fitur eksplisit.

## 6. Rancangan eksperimen

| Eksperimen | Rancangan | Ukuran |
| --- | --- | --- |
| E0 Pembanding PCD | Lima aturan tiga kelas tanpa ML (R1–R5, tabel di bawah); ambang Otsu dari data latih tanpa label; aturan terbaik dipilih dari F1 makro data latih | F1 makro, OA, kappa |
| E1 Perbandingan model | 5 model × 5 set fitur = 25 kombinasi (ID M01–M25 di spreadsheet) | OA, kappa, F1 per kelas, **F1 makro** |
| E2 Ablasi fitur | set bertambah FRGB → F0 → F01 → F012 → F0123 untuk setiap model | F1 makro |
| E3 Uji statistik | Empat McNemar dalam satu keluarga, koreksi Holm: (1) terbaik vs kedua; (2) terbaik vs aturan PCD terbaik; (3) set terbaik vs F0, model sama; (4) set terbaik vs FRGB, model sama. Bootstrap 1.000 kali per blok untuk IK F1 makro dan selisihnya | p, IK 95% |
| E4 Analisis | matriks konfusi; *permutation importance* per fitur dan per kelompok; uji silang T1→T2 dan T2→T1; pembanding kelas air dengan ambang indeks PCD | — |
| E5 Petak tambahan | model terbaik dilatih dengan A–C saja vs A–C + D–F, diuji di T3; McNemar | F1 makro, p |
| Diagnosis *overfitting* | selisih F1 makro validasi silang (data latih) dan uji (T3) per model dan set fitur | selisih |
| Opsional | peta dan luas seluruh waduk pada T3 | ha per kelas |

**Aturan PCD tiga kelas (E0).** Air dari peta air terbaik Langkah 07 (`air_pcd`), kecuali R5.

| Aturan | Air | EG vs KJA pada piksel bukan air |
| --- | --- | --- |
| R1 | `air_pcd` | NDVI ≥ t_ndvi → EG, selain itu KJA |
| R2 | `air_pcd` | R1, lalu komponen kandidat kecil (0 < luas < t_luas) → KJA |
| R3 | `air_pcd` | R1, lalu tekstur tinggi (sd_nir ≥ t_sd) → KJA |
| R4 | `air_pcd` | R1, lalu tekstur tinggi dan komponen kecil → KJA |
| R5 | gray < t_g1 | gray ≥ t_g2 → KJA, selain itu EG (pembanding RGB) |

**Ukuran utama adalah F1 makro**, karena kelas air jauh lebih banyak. OA bisa tinggi walaupun KJA salah semua.

**Pemilihan model terbaik** memakai F1 makro **validasi silang pada data latih** dari ke-25 kombinasi model × set fitur, bukan skor T3. Kombinasi terbaik inilah yang dianalisis lanjut (E3–E5). Aturan PCD terbaik dipilih dari F1 makro pada data latih. Skor T3 semua kombinasi tetap dilaporkan apa adanya. Dengan begitu data uji tidak ikut menentukan keputusan apa pun.

**Pengulangan.** Model acak (RF, HGB, MLP) dijalankan dengan 5 seed; skor T3 dilaporkan rata-rata ± simpangan baku antarseed. Skor validasi silang dihitung sekali (seed 0) dengan simpangan baku **antarlipatan** GroupKFold. Uji McNemar, bootstrap, dan kepentingan fitur memakai seed 0.

## 7. Skema validasi (kontrol kebocoran data)

1. **Penyetelan hiperparameter** hanya pada data latih, dengan GroupKFold 5 lipatan berbasis blok spasial, sehingga piksel bertetangga tidak terpisah ke lipatan latih dan validasi (Roberts dkk., 2017). Ukuran blok minimum 200 m (10 × 10 piksel) dan diperbesar otomatis bila jangkauan autokorelasi label lebih besar (bagian 2b notebook). Setelah E1, jangkauan autokorelasi residu model diperiksa dan harus ≤ ukuran blok.
2. **Pengujian** pada T3, tanggal yang tidak pernah dilihat saat pelatihan maupun penyetelan (Ploton dkk., 2020).
3. **Uji silang antartanggal** T1→T2 dan T2→T1 sebagai pemeriksaan internal atas pergeseran antartanggal.
4. **Bootstrap per blok**, bukan per piksel, agar interval kepercayaan tidak terlalu sempit.

## 8. Kontrol bias

- Penilai tidak melihat hasil segmentasi atau prediksi model saat menggambar.
- Kalibrasi dengan citra tajam hanya di area latihan; citra tajam petak uji disimpan untuk pemeriksaan mutu referensi.
- Parameter fitur dan grid hiperparameter ditetapkan di dokumen ini sebelum T3 dievaluasi.
- Semua model mendapat prosedur penyetelan dan penanganan ketidakseimbangan yang sama.
- Seed, versi pustaka, dan hiperparameter terbaik disimpan di `hasil_ml/ringkasan.json`.

## 9. Pemetaan keluaran ke naskah

| Berkas di `hasil_ml/` | Isi naskah |
| --- | --- |
| `jumlah_data_latih_uji.csv` | Tabel II (jumlah piksel per kelas) |
| `e0_pcd_tiga_kelas.csv`, `e0_ambang_pcd.csv` | pembanding PCD tanpa ML (spreadsheet tab 3_PCD_3Kelas) |
| `e1e2_cv_untuk_spreadsheet.csv` | skor validasi silang M01–M25 (spreadsheet tab 4_ML_CV) |
| `e3_uji_t3_untuk_spreadsheet.csv` | empat baris uji T3 (spreadsheet tab 5_Uji_T3) |
| `e1e2_ringkasan_mean_sd.csv` (fitur F0123) | Tabel IV (perbandingan model) |
| `e2_ablasi_f1_makro.csv`, `gbr_ablasi_fitur.png` | Tabel V dan Gbr. 2 (ablasi) |
| `e3_uji_mcnemar.csv`, `e3_bootstrap_ci.csv` | teks Bagian IV-B (spreadsheet tab 6_Uji_Statistik) |
| `e4_matriks_konfusi_*.csv`, `gbr_matriks_konfusi.png` | Tabel VI dan Gbr. 3 |
| `e4_kepentingan_*.csv`, `gbr_kepentingan_fitur.png` | Gbr. 4 |
| `e1e2_per_tingkat_kesepakatan.csv` | Tabel VII (akurasi per tingkat kesepakatan) |
| `e4_uji_silang_tanggal.csv`, `e4_pembanding_pcd_kelas_air.csv` | pembahasan |
| `e5_petak_tambahan.csv` | pembahasan generalisasi (RQ5) |
| `e1_selisih_validasi_uji.csv` | pembahasan *overfitting* |
| `autokorelasi_*.csv`, `gbr_korelogram.png` | dasar ukuran blok dan jarak petak (metode) |
| `e4_bias_proporsi_kelas.csv` | pembahasan luas terpetakan |
| `luas_kelas_seluruh_waduk_T3.csv`, `gbr_peta_seluruh_waduk_T3.png` | Gbr. 5 dan manfaat bagi pengelola |

## 10. Dasar setiap keputusan pengumpulan data latih dan validasi

Jenis dasar: **R** = rujukan terbit, **D** = data penelitian ini, **T** = keputusan tim yang ditetapkan sebelum melihat data uji, dengan alasan tertulis.

| Keputusan | Dasar | Jenis |
| --- | --- | --- |
| Lima penilai, voting mayoritas, kesepakatan dilaporkan | Referensi segmentasi lazim dibuat beberapa orang (Martin dkk., 2001); protokol dan mutu referensi harus dilaporkan (Stehman & Foody, 2019); kappa Fleiss (Fleiss, 1971) | R |
| Petak latih dipilih secara sengaja, bukan acak | Sampel probabilistik diwajibkan untuk penilaian akurasi dan estimasi luas, bukan untuk data latih (Olofsson dkk., 2014); pengambilan data latih yang diarahkan terbukti efektif (Foody & Mathur, 2004). Data uji tetap terpisah | R |
| Data latih hanya piksel yang disepakati ≥ 4 dari 5 | Label berderau menurunkan kinerja pengklasifikasi dan penyaringan sampel meragukan adalah pendekatan baku (Frénay & Verleysen, 2014); galat label latih harus dikendalikan (Elmes dkk., 2020); derau label juga mendistorsi hasil validasi silang (Pelletier dkk., 2017) | R |
| Eceng gondok di petak C tidak dipakai melatih | Kesepakatan penilai rendah di area KJA dan laporan penilai (κ r_eg C_T2 = 0,25 pada v1) | D + R (Elmes dkk., 2020) |
| Menambah lokasi dan tanggal latih (petak D–F) | Pada data v1 tiap kelas objek apung hampir hanya dari satu petak, sehingga model berisiko mempelajari ciri lokasi. Klasifikasi Sentinel-2 dengan RF, SVM, dan MLP turun akurasinya pada tahun yang tidak terwakili data latih, dan penurunan itu berkurang bila data latih mencakup beberapa tahun (Verhulst dkk., 2024). Studi objek apung menyarankan keragaman data antarwilayah dan akuisisi (Mifdal dkk., 2021) dan data latih vegetasi air yang heterogen (Ade dkk., 2022). Kinerja validasi silang hanya berlaku di ruang prediktor yang tercakup data latih (Meyer & Pebesma, 2021); validasi *leave-location-out* dan *leave-time-out* memerlukan lebih dari satu lokasi dan waktu (Meyer dkk., 2018). Manfaatnya diuji, bukan diasumsikan (E5) | D + R |
| Dua lokasi eceng gondok, satu KJA | Luas latih v1: eceng gondok 34,9 ha (hanya dari B), KJA 45,4 ha (81% dari C); luas eceng gondok Saguling 243–1.165 ha pada 2019–2023 (Chuzaimah dkk., 2025); KJA berupa struktur tetap | D + R |
| Satu tanggal per petak tambahan | Dengan jumlah kombinasi yang sama, tiga tanggal berbeda mencakup lebih banyak kondisi prediktor (Meyer & Pebesma, 2021); pemisahan waktu menjaga independensi (Roberts dkk., 2017) | R + T |
| Jarak antartanggal ≥ 60 hari | Waktu ganda eceng gondok 9,6–10,8 hari di Danau Rawapening (Prasetyo dkk., 2021); 60 hari ≈ lebih dari lima kali waktu ganda, sehingga kondisi hamparan sudah berubah | R |
| Semua tanggal sebelum PLTS terapung | Prediksi tidak dapat diandalkan di luar kondisi yang tercakup data latih (Meyer & Pebesma, 2021); PLTS tidak ada di data latih | R + T |
| Petak D–F ≥ 1 km dari petak uji | Pemisah minimum adalah jangkauan autokorelasi (Roberts dkk., 2017); jangkauan diukur di notebook bagian 2b. Data uji juga dipisah waktu (T3), sehingga jarak ini adalah pengaman tambahan | R + D |
| Ukuran blok validasi silang | Blok harus melebihi jangkauan autokorelasi; jarak pemisah minimum = jangkauan autokorelasi residu (Roberts dkk., 2017); diukur dari data (bagian 2b dan setelah E1) | R + D |
| ≥ 50% petak di dalam waduk; vegetasi apung ≥ 5 ha di D dan F | Memastikan piksel kelas sasaran cukup banyak; ukuran sampel latih yang lebih besar menurunkan galat (Millard & Richardson, 2015). Angka ambang ditetapkan tim sebelum melihat tanggal | R + T |
| Bobot kelas seimbang | Standar untuk data tidak seimbang (He & Garcia, 2009). Karena bobot setara dapat menggeser proporsi kelas hasil peta (Millard & Richardson, 2015), bias proporsi di T3 dilaporkan (`e4_bias_proporsi_kelas.csv`) | R + D |
| F1 makro sebagai ukuran utama | Rata-rata makro memberi bobot sama pada tiap kelas (Sokolova & Lapalme, 2009) | R |
| Model terbaik dipilih dari validasi silang, bukan dari data uji | Memakai data yang sama untuk memilih dan mengevaluasi model menimbulkan bias seleksi (Cawley & Talbot, 2010) | R |
| McNemar dengan koreksi Holm | Uji beda akurasi pada sampel yang sama (Foody, 2004); koreksi perbandingan berganda (Holm, 1979) | R |
| Luas seluruh waduk = luas terpetakan | Penghitungan piksel peta bukan estimasi luas tak bias (Olofsson dkk., 2014) | R |
| Model yang dibandingkan | RF (Belgiu & Drăguţ, 2016), SVM (Mountrakis dkk., 2011), dan tiga keluarga lain sebagai pembanding | R |
| Lima transformasi satu kanal di segmentasi air, termasuk grayscale dan PCA1 | Semua mengubah citra multipita menjadi satu kanal (operasi titik atau transformasi linear) sehingga bisa dibandingkan dengan aturan ambang dan morfologi yang sama; grayscale menguji cukup-tidaknya RGB | T |
| Aturan PCD tiga kelas sebagai pembanding ML (E0) | Kebutuhan ML harus dibuktikan terhadap pembanding tanpa pembelajaran yang memakai fitur PCD yang sama; ambang dari Otsu pada data latih agar setara | T |
| Set FRGB | Menguji apakah pita NIR/SWIR diperlukan; hasilnya menentukan apakah metode dapat dipindah ke citra RGB lain | T |
| KJA digitasi sebagai blok, piksel dominan | Unit referensi disamakan dengan unit peta (piksel 20 m) (Olofsson dkk., 2014); unit keramba lebih kecil dari piksel sehingga tidak terbaca | R + D |

### Daftar pustaka bagian ini

Rujukan di bawah dicocokkan dengan laman penerbit, Crossref, atau JMLR pada 20 November 2026; Verhulst dkk. (2024) dan Meyer dkk. (2018) pada 21 November 2026. Judul Meyer dkk. (2018) dan data lengkap Ade dkk. (2022) belum dicocokkan ke laman penerbit.

- Ade, C., dkk. (2022). *Remote Sensing*, 14(13), 3013. https://doi.org/10.3390/rs14133013 [lengkapi judul dan penulis]
- Belgiu, M., & Drăguţ, L. (2016). Random forest in remote sensing: A review of applications and future directions. *ISPRS Journal of Photogrammetry and Remote Sensing*, 114, 24–31. https://doi.org/10.1016/j.isprsjprs.2016.01.011
- Cawley, G. C., & Talbot, N. L. C. (2010). On over-fitting in model selection and subsequent selection bias in performance evaluation. *Journal of Machine Learning Research*, 11, 2079–2107.
- Chuzaimah, S., Arief, M. C. W., Maulina, I., & Sahidin, A. (2025). Luasan dan distribusi eceng gondok secara spasio-temporal di Waduk Saguling, Jawa Barat. *Akuatika Indonesia*, 10(1), 20–29. https://doi.org/10.24198/jaki.v10i1.57350
- Elmes, A., dkk. (2020). Accounting for training data error in machine learning applied to Earth observations. *Remote Sensing*, 12(6), 1034. https://doi.org/10.3390/rs12061034
- Fleiss, J. L. (1971). Measuring nominal scale agreement among many raters. *Psychological Bulletin*, 76(5), 378–382.
- Foody, G. M. (2004). Thematic map comparison: Evaluating the statistical significance of differences in classification accuracy. *Photogrammetric Engineering & Remote Sensing*, 70(5), 627–633.
- Foody, G. M., & Mathur, A. (2004). Toward intelligent training of supervised image classifications: Directing training data acquisition for SVM classification. *Remote Sensing of Environment*, 93(1–2), 107–117. https://doi.org/10.1016/j.rse.2004.06.017
- Frénay, B., & Verleysen, M. (2014). Classification in the presence of label noise: A survey. *IEEE Transactions on Neural Networks and Learning Systems*, 25(5), 845–869. https://doi.org/10.1109/TNNLS.2013.2292894
- He, H., & Garcia, E. A. (2009). Learning from imbalanced data. *IEEE Transactions on Knowledge and Data Engineering*, 21(9), 1263–1284. https://doi.org/10.1109/TKDE.2008.239
- Holm, S. (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics*, 6(2), 65–70.
- Martin, D., Fowlkes, C., Tal, D., & Malik, J. (2001). A database of human segmented natural images and its application to evaluating segmentation algorithms and measuring ecological statistics. *Proc. ICCV*, 2, 416–423.
- Meyer, H., Reudenbach, C., Hengl, T., Katurji, M., & Nauss, T. (2018). Improving performance of spatio-temporal machine learning models using forward feature selection and target-oriented validation. *Environmental Modelling & Software*, 101, 1–9.
- Meyer, H., & Pebesma, E. (2021). Predicting into unknown space? Estimating the area of applicability of spatial prediction models. *Methods in Ecology and Evolution*, 12(9), 1620–1633. https://doi.org/10.1111/2041-210X.13650
- Mifdal, J., Longépé, N., & Rußwurm, M. (2021). Towards detecting floating objects on a global scale with learned spatial features using Sentinel 2. *ISPRS Annals*, V-3-2021, 285–293.
- Millard, K., & Richardson, M. (2015). On the importance of training data sample selection in random forest image classification: A case study in peatland ecosystem mapping. *Remote Sensing*, 7(7), 8489–8515. https://doi.org/10.3390/rs70708489
- Mountrakis, G., Im, J., & Ogole, C. (2011). Support vector machines in remote sensing: A review. *ISPRS Journal of Photogrammetry and Remote Sensing*, 66(3), 247–259. https://doi.org/10.1016/j.isprsjprs.2010.11.001
- Olofsson, P., dkk. (2014). Good practices for estimating area and assessing accuracy of land change. *Remote Sensing of Environment*, 148, 42–57. https://doi.org/10.1016/j.rse.2014.02.015
- Pelletier, C., Valero, S., Inglada, J., Champion, N., Marais Sicre, C., & Dedieu, G. (2017). Effect of training class label noise on classification performances for land cover mapping with satellite image time series. *Remote Sensing*, 9(2), 173. https://doi.org/10.3390/rs9020173
- Prasetyo, S., Anggoro, S., & Soeprobowati, T. R. (2021). The growth rate of water hyacinth (*Eichhornia crassipes* (Mart.) Solms) in Rawapening Lake, Central Java. *Journal of Ecological Engineering*, 22(6), 222–231. https://doi.org/10.12911/22998993/137678
- Roberts, D. R., dkk. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. *Ecography*, 40(8), 913–929. https://doi.org/10.1111/ecog.02881
- Sokolova, M., & Lapalme, G. (2009). A systematic analysis of performance measures for classification tasks. *Information Processing & Management*, 45(4), 427–437. https://doi.org/10.1016/j.ipm.2009.03.002
- Stehman, S. V., & Foody, G. M. (2019). Key issues in rigorous accuracy assessment of land cover products. *Remote Sensing of Environment*, 231, 111199. https://doi.org/10.1016/j.rse.2019.05.018
- Verhulst, M., Heremans, S., Blaschko, M. B., & Somers, B. (2024). Temporal transferability of tree species classification in temperate forests with Sentinel-2 time series. *Remote Sensing*, 16(14), 2653. https://doi.org/10.3390/rs16142653

Catatan: Prasetyo dkk. (2021) mengukur di mesokosmos 1 × 1 m di Rawapening, bukan di Saguling; pakai sebagai gambaran laju pertumbuhan, bukan nilai pasti untuk Saguling.

## 11. Keterbatasan yang dilaporkan

- Tiga petak purposif; akurasi berlaku per kondisi, bukan seluruh waduk (Olofsson dkk., 2014).
- Satu tanggal uji. Hasil menggambarkan satu pergeseran antartanggal.
- Semua tanggal berlabel sebelum PLTS terapung; kinerja pada kondisi dengan PLTS tidak diukur.
- KJA dipetakan sebagai kawasan blok, bukan petak keramba, karena resolusi 20 m. Luas KJA = luas piksel 20 m yang didominasi KJA, bukan luas fisik atau jumlah petak keramba.
- PLTS terapung tidak menjadi kelas.

## 12. Catatan perubahan rancangan

| Tanggal | Perubahan | Alasan |
| --- | --- | --- |
| 2026-11-20 | Dari RF saja menjadi perbandingan 5 model | permintaan eksperimen pembanding model |
| 2026-11-20 | F0 menjadi 10 pita (tambah B5, B6, B7, B8A) | pita *red-edge* relevan untuk vegetasi apung |
| 2026-11-20 | Pelatihan dipindah dari GEE ke scikit-learn (Kaggle/Colab) | lima model dan uji statistik tidak tersedia di GEE |
| 2026-11-20 | `luas_komponen` dihitung tanpa *opening* lebih dulu | menyederhanakan; diganti transformasi log |
| 2026-11-20 | Referensi v2 setelah kalibrasi ulang dengan kunci interpretasi | kesepakatan v1 rendah pada eceng gondok dan KJA |
| 2026-11-20 | Petak latih tambahan D (eceng gondok, D1), E (KJA, D2), F (eceng gondok, D3), 5 penilai; 12 kombinasi | data latih semula hanya 3 lokasi dan 2 tanggal Agustus; eceng gondok kelas paling sedikit dan paling berubah |
| 2026-11-20 | Model terbaik dipilih dari skor validasi silang, bukan skor T3 | data uji tidak boleh ikut menentukan model |
| 2026-11-20 | Ukuran blok ditentukan dari jangkauan autokorelasi; bias proporsi kelas dilaporkan; dasar setiap keputusan ditulis (bagian 10) | agar setiap keputusan punya rujukan atau bukti data |
| 2026-11-20 | T3 sebelum Oktober 2025, tidak harus sesudah T1 | data uji tanpa PLTS agar kelasnya sama dengan data latih |
| 2026-11-25 | Segmentasi air menjadi 26 konfigurasi (tambah NDVI, grayscale RGB, PCA1); peta dibuat untuk keenam tanggal; konfigurasi terbaik dipilih dari kombinasi latih | eksperimen transformasi satu kanal dan pembanding RGB; pemilihan tidak boleh memakai T3 |
| 2026-11-25 | E0 aturan PCD tiga kelas (R1–R5) sebagai pembanding ML | membuktikan kebutuhan ML |
| 2026-11-25 | Set fitur FRGB; nama set F01, F012, F0123; kombinasi terbaik dipilih dari 25 kombinasi | pembanding RGB; nama disamakan dengan spreadsheet |
| 2026-11-25 | E3 menjadi empat perbandingan terencana dengan Holm | keluarga uji sama dengan yang dilaporkan |
| 2026-11-25 | Skor CV mencatat OA, kappa, F1 per kelas, dan SD antarlipatan | SD antarseed CV selalu nol karena CV dihitung sekali |
| 2026-11-25 | Aturan digitasi KJA sebagai blok dengan piksel dominan dan lorong < 40 m | unit referensi = unit peta 20 m |
