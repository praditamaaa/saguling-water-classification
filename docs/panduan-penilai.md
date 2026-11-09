# Panduan Penilai: Digitasi Data Referensi Waduk Saguling

Diperbarui 9 November 2026. Versi yang bisa diedit bersama ada di dokumen Panduan Penilai tim; berkas ini salinannya untuk repository.

## 1. Mengapa referensi dibuat dengan cara ini

Data referensi (ground truth) penelitian ini dibuat oleh lima penilai (dua anggota tim dan tiga penilai luar tim) dan ditetapkan dengan voting mayoritas, mengikuti praktik baik penilaian akurasi yang sudah terbit. Kualitasnya diukur dengan angka, bukan diasumsikan.

Referensi adalah kunci jawaban untuk menilai 12 konfigurasi segmentasi. Karena dibuat manusia, referensi bisa keliru. Tujuan protokol ini adalah membuat kekeliruan itu kecil, terukur, dan bisa diperiksa orang lain.

| Keputusan | Alasan | Rujukan dan bagiannya |
| --- | --- | --- |
| Referensi dibuat manual dari citra, bukan dari produk otomatis | Referensi boleh berasal dari citra yang sama dengan peta, asalkan dibuat dengan protokol terpisah yang kualitasnya lebih tinggi. Referensi juga harus lebih akurat daripada peta yang dinilai. Peta air seperti JRC dibuat dari indeks air juga, sehingga perbandingannya melingkar. | Stehman & Foody (2019), Bagian 3 *Response design*; Congalton & Green (2019), Bab 7 *Reference Data Collection* |
| Disebut data referensi, bukan kebenaran mutlak | Referensi yang tidak sempurna bisa menggeser akurasi dan luas perubahan yang dilaporkan. | Foody (2010); Olofsson dkk. (2014) |
| Protokol tertulis: kelas, unit terkecil 20 m, aturan kasus sulit | Protokol pelabelan harus menetapkan unit pemetaan minimum dan aturan pemberian kelas. | Stehman & Foody (2019), Bagian 3 |
| Lima penilai, piksel masuk referensi bila dipilih minimal 3 dari 5 | Ground truth segmentasi lazim dibuat dari beberapa orang per citra, lalu konsistensinya diukur. Jumlah ganjil membuat setiap piksel selalu punya mayoritas. Lima penilai memenuhi arahan minimal tiga dan membuat satu kekeliruan perorangan hampir tidak pernah lolos. | Arahan dosen; Martin dkk. (2001), Bagian 2–3; Warfield dkk. (2004) |
| Dua anggota tim dan tiga penilai luar tim | Anggota tim sudah melihat hasil eksplorasi dan mengetahui hipotesis. Dengan tiga penilai luar, mayoritas suara dipegang penilai yang buta terhadap hasil. Kesepakatan di dalam tim dibandingkan dengan kesepakatan tim–luar untuk menguji bias tim. | Stehman & Foody (2019), Bagian 1.2 kriteria 3 dan Bagian 3 |
| Satu perangkat dan satu akun, sesi terpisah dan diawasi | Semua penilai melihat citra di layar yang sama. Setiap sesi diawasi koordinator agar penilai tidak membuka gambar penilai lain di akun yang sama. | Stehman & Foody (2019), Bagian 1.2 kriteria 3 |
| Penilai bekerja terpisah dan tidak melihat hasil segmentasi | Dua penilai atau lebih menilai lokasi yang sama tanpa mengetahui kelas peta, agar konsistensinya terukur. | Stehman & Foody (2019), Bagian 1.2 kriteria 3 *Quality assured* |
| Kalibrasi penilai dan pencatatan latar belakangnya | Latar belakang, pelatihan, dan apakah penilai buta terhadap kelas peta harus dilaporkan. | Stehman & Foody (2019), Bagian 3 |
| Semua penilai berbobot sama | Penilai dikalibrasi lalu kesesuaiannya diperiksa. Dengan voting mayoritas, bobot berbeda baru mengubah hasil bila gabungan bobot pihak minoritas melebihi pihak mayoritas, misalnya dua orang mengalahkan tiga. STAPLE dipakai sebagai uji pembanding karena memberi bobot tiap penilai dari kinerjanya. | Warfield dkk. (2004) |
| Kesepakatan antarpenilai dilaporkan | Variabilitas antarpenilai yang kecil adalah tanda penilaian yang andal. Diukur dengan Fleiss' kappa dan IoU antarpasangan. | Stehman & Foody (2019), kriteria 4 *Reliable*; Fleiss (1971); Landis & Koch (1977); Martin dkk. (2001), Bagian 3 |
| Tiga tingkat kesepakatan: 5–0 penuh, 4–1 cukup yakin, 3–2 zona ragu | Kesalahan pelabelan paling besar terjadi pada unit campuran yang proporsinya dekat ambang, seperti piksel tepi dan KJA. Akurasi dilaporkan per tingkat. | Radoux dkk. (2019, pracetak) |
| Aset referensi dan protokol dibuka | Laporan harus memuat detail yang memengaruhi kualitas referensi. | Stehman & Foody (2019), kriteria 5 *Transparent* |

Yang kami klaim: referensi dibuat dengan prosedur standar, kualitasnya terukur, dan bisa diaudit. Kami tidak mengklaim referensi ini pasti benar.

Daftar rujukan lengkap ada di [referensi.md](referensi.md).

## 2. Ringkasan tugas

Setiap penilai menggambar batas air dan objek apung di 3 petak × 2 tanggal, sendiri-sendiri, lalu mengekspor 6 aset referensi dan mengisi lembar catatan.

| Aspek | Isi |
| --- | --- |
| Penilai | p1 dan p2: anggota tim. p3, p4, p5: luar tim. Nama penilai tidak ditulis di repository. |
| Koordinator | Anggota tim. Mengawasi setiap sesi; tidak memutuskan piksel yang diperdebatkan |
| Perangkat dan akun | Satu laptop dan satu akun Earth Engine tim. Penilai bergiliran, satu sesi per orang |
| Wilayah | Petak A (air terbuka), B (eceng gondok), C (KJA), masing-masing 1 × 1 km |
| Tanggal citra | T1 [tanggal] dan T2 [tanggal], Sentinel-2 |
| Lapisan yang digambar | Hingga 3 per petak per tanggal (air, eceng gondok, KJA); lapisan objek yang tidak ada tidak perlu dibuat |
| Hasil yang diserahkan | 6 aset `saguling_ref_<petak>_<T>_<kode penilai>_v1` dan lembar catatan (bagian 9) |
| Perkiraan waktu | Kalibrasi sekitar 2,5–3 jam bersama, lalu digitasi sekitar 3–4 jam per penilai; petak B dan C paling lama |
| Tenggat | [tanggal] |

Urutannya: sesi kalibrasi bersama (bagian 8), lalu digitasi utama sendiri-sendiri (bagian 7), lalu daftar periksa (bagian 9). Materi pengarahan bergerak ada di [materi/kalibrasi_awal_penilai.html](materi/kalibrasi_awal_penilai.html).

## 3. Persiapan

Tidak ada skrip yang perlu disalin sendiri. Folder `gee/` sudah menyediakan satu file per penilai untuk kalibrasi (`06a_kalibrasi_p1` sampai `p5`) dan digitasi (`06b_digitasi_p1` sampai `p5`). Isinya sama; yang berbeda hanya kode penilai. File terpisah diperlukan karena lapisan gambar GEE tersimpan di dalam file skrip, sehingga lima penilai di satu file akan saling melihat gambar.

**Oleh koordinator, sebelum sesi kalibrasi**

- [ ] Pastikan aset `saguling_petak_v1` dari Langkah 05 sudah ada.
- [ ] Di akun tim, buat 11 skrip baru dengan nama persis seperti di `gee/`, lalu tempel isinya: `06a_kalibrasi_p1` sampai `p5`, `06b_digitasi_p1` sampai `p5`, dan `06c_voting_lima_penilai`.
- [ ] Pilih satu petak latihan 1 × 1 km di luar A, B, dan C yang berisi air terbuka, eceng gondok, dan KJA. Isi koordinatnya sebagai `PUSAT` di kelima file `06a_kalibrasi`, dengan nilai yang sama.
- [ ] Susun jadwal sesi. Anggota tim (p1, p2) menggambar sebelum Langkah 07 pernah dijalankan.
- [ ] Siapkan satu lembar catatan (bagian 9) untuk tiap penilai.

**Oleh penilai, sebelum mulai menggambar**

1. Koordinator membuka [code.earthengine.google.com](https://code.earthengine.google.com) dengan akun tim, lalu membukakan **hanya** file skripmu, misalnya `06b_digitasi_p3`.
2. Jangan membuka file lain di panel **Scripts** dan jangan menambahkan aset `saguling_ref_*` dari panel **Assets**. Keduanya berisi gambar penilai lain.
3. Di bagian `0. PARAMETER`, kode penilaimu sudah terisi di `VERSI_REF`, misalnya `'p3_v1'`. Jangan diubah.
4. Yang kamu isi hanya `PETAK_ID` dan `KODE_TGL`, sesuai petak dan tanggal yang sedang digambar.
5. Jangan mengubah bagian skrip yang lain.

## 4. Aturan independensi

Setiap penilai menggambar sendiri, tanpa melihat gambar penilai lain dan tanpa melihat hasil segmentasi. Aturan ini berlaku sejak sesi kalibrasi selesai sampai semua penilai menyerahkan hasil.

| Boleh | Tidak boleh |
| --- | --- |
| Membaca dokumen ini dan bertanya ke koordinator soal aturan | Berdiskusi dengan penilai lain soal petak A, B, atau C |
| Menyalakan layer citra dari skrip: true color, false color, SWIR, dan grid 20 m | Menyalakan layer indeks (NDWI, MNDWI) atau peta hasil Langkah 07 |
| Memakai basemap satelit untuk mengenali **jenis** objek (keramba, rumah, pohon) | Menarik garis tepi air mengikuti basemap, karena tanggalnya berbeda dari citra |
| Membuka file skripmu sendiri | Membuka file skrip penilai lain di panel Scripts |
| Melihat citra tanggal lain lewat `KODE_TGL` | Menambahkan aset `saguling_ref_*` milik penilai lain dari panel Assets |
| Menggambar T2 dari awal | Menyalin poligon T1 ke T2, walaupun lokasinya mirip |
| Beristirahat di tengah sesi setelah menyimpan skrip | Melihat layar saat penilai lain sedang bekerja |

Karena kelima penilai memakai akun yang sama, gambar penilai lain secara teknis bisa dibuka. Itulah sebabnya setiap sesi diawasi koordinator, dan koordinator mencatat waktu mulai dan selesainya di lembar catatan.

Kalau aturan ini terlanggar, misalnya kamu tidak sengaja membuka skrip penilai lain, catat di lembar catatan dan beri tahu koordinator. Jangan ditutupi; koordinator akan memutuskan apakah petak itu perlu digambar ulang.

## 5. Definisi kelas

Penilai menggambar hingga tiga lapisan per petak per tanggal: **air** (seluruh permukaan waduk), **eceng gondok**, dan **KJA**. Lapisan objek yang tidak ada di petak itu tidak perlu dibuat. Semua yang tidak digambar dianggap bukan air.

| Lapisan | Yang termasuk | Cara mengenalinya | Yang tidak termasuk |
| --- | --- | --- | --- |
| `air_<petak>_<T>` | Seluruh permukaan di dalam garis tepi air–darat pada tanggal citra, **termasuk** bagian yang tertutup eceng gondok atau keramba | SWIR 20 m: sangat gelap. False color: gelap kebiruan. True color: biru tua sampai hijau keruh | Daratan, pulau, sawah, bangunan, tanah dasar waduk yang kering |
| `eg_<petak>_<T>` | Hamparan eceng gondok di atas air | Merah terang di false color 10 m, hamparan rata dengan tepi tegas berbatasan air gelap, bentuk dan letaknya berubah antara T1 dan T2 | Rumput atau semak yang berakar di daratan, pohon tepian |
| `kja_<petak>_<T>` | Batas luar blok keramba, termasuk lorong air yang lebih sempit dari 20 m dan rumah jaga di atasnya | Kisi kotak teratur di true color, abu-abu atau cokelat; letaknya sama di T1 dan T2 | Dermaga di darat, perahu, pelampung tunggal |

Skrip menghitung sendiri referensi dari lapisan itu:

- **r_air** (air terbuka) = air dan bukan (eceng gondok atau KJA)
- **r_waduk** (seluruh permukaan waduk) = air atau eceng gondok atau KJA
- **r_eg** dan **r_kja** = piksel tiap jenis objek, dipakai untuk menelusuri sumber kesalahan segmentasi

Karena itu, poligon eceng gondok dan KJA harus selalu berada di dalam poligon air. Bila eceng gondok menempel atau menutupi keramba, gambar keduanya sesuai yang terlihat; skrip otomatis menghitung piksel yang tumpang tindih sebagai KJA, karena keramba adalah struktur tetap.

Saat dijadikan raster 20 m, sebuah piksel dihitung masuk bila **titik tengahnya** berada di dalam poligon. Jadi garis tepi yang ditarik melewati tengah antara air dan darat sudah cukup; tidak perlu mengikuti batas kotak piksel satu per satu.

## 6. Aturan untuk kasus sulit

Ukuran terkecil yang dinilai adalah satu piksel 20 × 20 m. Objek atau celah yang lebih kecil dari itu tidak digambar terpisah.

| Kasus | Aturan |
| --- | --- |
| Tepi air–darat landai atau berlumpur | Tarik garis di tempat yang lebih dari separuhnya air. Pakai layer SWIR 20 m; batasnya paling tegas di sana. |
| Pulau atau daratan di tengah air | Alat gambar GEE tidak bisa membuat lubang. Pecah poligon air menjadi beberapa poligon yang mengelilingi pulau, masih di lapisan yang sama. Pulau lebih kecil dari satu piksel diabaikan. |
| Eceng gondok jarang atau berbintik | Masuk lapisan eceng gondok bila hamparan merah menutupi lebih dari separuh piksel 20 m. Bercak terpisah yang lebih kecil dari satu piksel tetap dianggap air. |
| Vegetasi di garis tepi: eceng gondok atau rumput? | Tarik garis tepi air mengikuti bentuk garis pantai di kiri dan kanannya. Vegetasi di sisi air dari garis itu adalah eceng gondok; di sisi darat adalah darat dan tidak digambar. Bila ragu, bandingkan dengan citra tanggal lain lewat `KODE_TGL`: eceng gondok bergeser, rumput tetap. |
| Blok keramba (KJA) | Gambar satu poligon di lapisan KJA mengikuti batas luar blok, yaitu deretan keramba yang saling berdekatan. Lorong air yang lebih sempit dari 20 m ikut masuk blok. Lorong yang lebih lebar dari 20 m dibiarkan sebagai air. Rumah jaga di atas keramba ikut KJA. |
| Eceng gondok menempel atau menutupi keramba | Gambar keduanya sesuai yang terlihat. Skrip menghitung bagian yang tumpang tindih sebagai KJA. |
| Perahu, pelampung, objek kecil terpisah | Abaikan; tetap air. |
| Bayangan bukit atau pohon di atas air | Tetap air. Bayangan bukan objek apung. |
| Air keruh atau kecokelatan | Tetap air. Pastikan di layer SWIR 20 m: air tetap gelap. |
| Awan atau bayangan awan di dalam petak | Jangan ditebak. Catat lokasinya dan beri tahu koordinator. |
| Poligon melewati batas petak | Boleh. Skrip memotongnya otomatis ke batas petak. |
| Masih ragu setelah semua aturan di atas | Pilih kelas yang paling mungkin, lalu catat di lembar catatan dengan keyakinan 1. Jangan bertanya ke penilai lain. |

Aturan yang ternyata ambigu saat kalibrasi diperjelas di tabel ini **sebelum** digitasi utama dimulai. Setelah digitasi utama berjalan, aturan tidak diubah lagi.

## 7. Langkah kerja di Google Earth Engine

Kerjakan petak demi petak: A T1, A T2, B T1, B T2, C T1, C T2. Simpan skrip (Ctrl+S) setiap selesai satu lapisan; gambar yang belum disimpan hilang bila halaman tertutup.

**Menggambar satu petak dan satu tanggal**

1. Isi `PETAK_ID = 'A'` dan `KODE_TGL = 'T1'`, lalu klik **Run**. Peta akan memperbesar ke petak A, ditandai kotak kuning.
2. Buka panel **Layers** di kanan atas peta. Lihat keempat layer citra satu per satu: true color 10 m, false color 10 m, SWIR 20 m, dan false color 20 m (grid penilaian). Perbesar sampai zoom 17–18 untuk melihat tepi.
3. Buat lapisan air. Arahkan kursor ke **Geometry Imports** di kiri atas peta, klik **+ new layer**. Di panel **Imports** di atas kode, klik ikon roda gigi pada lapisan baru itu, ganti namanya menjadi persis `air_A_T1`, lalu klik **OK**.
4. Pilih lapisan `air_A_T1`, klik alat poligon, lalu klik titik demi titik di sepanjang tepi air. Tutup poligon dengan mengklik titik pertama. Satu lapisan boleh berisi beberapa poligon, misalnya untuk mengelilingi pulau (bagian 6).
5. Bila ada eceng gondok, buat lapisan `eg_A_T1` dengan cara yang sama, lalu gambar hamparannya.
6. Bila ada keramba, buat lapisan `kja_A_T1`, lalu gambar batas luar tiap blok.
7. Sebelum mengklik peta, pastikan lapisan yang benar sedang terpilih. Poligon yang masuk ke lapisan salah adalah kesalahan yang paling sering terjadi.
8. Klik **Run** lagi. Nyalakan layer pratinjau, lalu periksa:
    - **r_waduk (oranye)** menutupi seluruh permukaan waduk di dalam petak;
    - **r_air (biru)** tidak menutupi eceng gondok atau keramba;
    - **eceng gondok (magenta)** dan **KJA (putih)** berada di tempat yang benar.
9. Salin angka luas (ha) yang tercetak di **Console** ke lembar catatan.

**Pindah ke tanggal dan petak berikutnya**

1. Di **Geometry Imports**, hilangkan centang semua lapisan yang sudah selesai, supaya tidak terlihat saat menggambar lapisan baru.
2. Ganti `KODE_TGL = 'T2'`, klik **Run**, lalu gambar `air_A_T2`, `eg_A_T2`, dan `kja_A_T2` dari awal, tanpa menyalin poligon T1.
3. Ulangi untuk `PETAK_ID = 'B'` dan `PETAK_ID = 'C'`.

**Mengekspor hasil**

1. Setelah semua lapisan selesai, klik **Run** sekali lagi. Console harus mencetak 6 kunci: `A_T1`, `A_T2`, `B_T1`, `B_T2`, `C_T1`, `C_T2`.
2. Buka tab **Tasks** di panel kanan. Klik **RUN** pada keenam task. Di jendela yang muncul, pastikan Asset ID berakhiran kodemu, misalnya `saguling_ref_A_T1_p1_v1`, lalu klik **Run**.
3. Tunggu sampai keenam task bertanda selesai. Bila ada yang gagal, salin pesan galatnya ke lembar catatan dan beri tahu koordinator.
4. Buka tab **Assets** dan pastikan keenam aset ada.

**Menutup sesi (oleh koordinator)**

1. Pastikan skrip penilai sudah disimpan dan keenam task selesai.
2. Tutup skrip penilai itu, lalu kosongkan peta dan Console, sehingga penilai berikutnya mulai dari layar kosong.
3. Catat waktu selesai dan hal yang perlu diketahui di lembar catatan.
4. Buka file skrip penilai berikutnya hanya ketika sesinya dimulai.

## 8. Sesi kalibrasi

Kalibrasi adalah latihan untuk menyamakan pemahaman aturan, bukan pembuatan referensi. Gambar latihan tidak divoting dan tidak dipakai di evaluasi; hasil kalibrasi adalah tabel bagian 6 yang lebih jelas. Voting oleh skrip (Langkah 06c) baru dilakukan setelah digitasi utama petak A, B, dan C (bagian 10).

| | Kalibrasi | Digitasi utama |
| --- | --- | --- |
| Petak | Satu petak latihan di luar A, B, C | A, B, C × T1, T2 |
| Boleh berdiskusi? | Ya, setelah semua selesai menggambar | Tidak sama sekali |
| Diekspor dan divoting? | Tidak | Ya, oleh skrip |
| Hasilnya | Aturan yang diperjelas dan contoh kasus | Aset referensi untuk evaluasi |

Skrip digitasi hanya menampilkan citra di sekitar petak A, B, dan C. Untuk petak latihan, pakai file `06a_kalibrasi_p1` sampai `06a_kalibrasi_p5`. Skrip ini tidak mengekspor apa pun; ia hanya mencetak luas latihan di Console.

Yang diisi koordinator di kelima file, dengan nilai yang sama:

```javascript
var PUSAT = [107.40, -6.90];   // contoh; ganti dengan [bujur, lintang] petak latihan
var KODE_TGL = 't1';           // 't1', atau 't2' bila latihan diulang
```

**Urutan sesi (sekitar 2,5–3 jam)**

1. **Pengarahan, 15 menit.** Koordinator mengisi `PUSAT` dengan nilai yang sama di kelima file 06a_kalibrasi, lalu membacakan bagian 5 dan 6 bersama semua penilai. Pakai halaman [Kalibrasi Awal Penilai](materi/kalibrasi_awal_penilai.html) beserta kuisnya.
2. **Menggambar bergiliran, sekitar 25 menit per orang.** Di laptop yang sama, tiap penilai membuka filenya sendiri dan menggambar `air_L`, `eg_L`, dan `kja_L`. Penilai yang menunggu tidak melihat layar. Koordinator mencatat luas yang tercetak di Console ke tabel di bawah.
3. **Membandingkan, sekitar 30 menit.** Setelah kelimanya selesai, buka kelima file bergantian di layar yang sama, atau tampilkan tangkapan layarnya berdampingan. Tunjuk tempat garis mereka berbeda.
4. **Memperjelas aturan.** Untuk tiap perbedaan, tanyakan aturan mana yang dipakai masing-masing. Bila aturannya ambigu, koordinator memperjelas tabel bagian 6 dan mencatatnya di tabel perubahan. Simpan tangkapan layar contoh "ini eceng gondok" dan "ini bukan" sebagai kartu contoh.
5. **Ulangi bila perlu.** Bila luas r_waduk antarpenilai berbeda lebih dari 5%, ulangi latihan pada `KODE_TGL = 't2'` setelah aturan diperjelas. Batas 5% ini kesepakatan tim, bukan angka dari jurnal.
6. **Tutup.** Setelah sesi selesai, aturan bagian 4 berlaku: tidak ada lagi diskusi soal petak A, B, dan C.

| Penilai | r_air (ha) | r_waduk (ha) | Eceng gondok (ha) | KJA (ha) |
| --- | --- | --- | --- | --- |
| p1 | | | | |
| p2 | | | | |
| p3 | | | | |
| p4 | | | | |
| p5 | | | | |

| Tanggal | Aturan yang diperjelas | Alasan |
| --- | --- | --- |
| [tanggal] | [isi bila ada] | [isi bila ada] |

## 9. Lembar catatan dan daftar periksa

Setiap penilai mengisi satu lembar catatan sendiri, lalu menyerahkannya bersama daftar asetnya. Lembar yang memuat nama penilai disimpan di luar repository.

**Lembar catatan penilai: [kode penilai]**

- Status: anggota tim / luar tim
- Latar belakang singkat: [program studi, pengalaman dengan citra satelit]
- Pernah melihat hasil eksplorasi atau segmentasi: ya / tidak
- Tanggal sesi: [tanggal] · Pengawas: [koordinator]

| Petak | Tanggal | Mulai | Selesai | r_air (ha) | r_waduk (ha) | Keyakinan (1–3) | Kasus sulit dan lokasinya |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | T1 | | | | | | |
| A | T2 | | | | | | |
| B | T1 | | | | | | |
| B | T2 | | | | | | |
| C | T1 | | | | | | |
| C | T2 | | | | | | |

Keyakinan: 3 = yakin hampir di seluruh petak; 2 = ragu di beberapa bagian; 1 = ragu di banyak bagian.

**Daftar periksa sebelum menyerahkan**

- [ ] Nama lapisan persis sesuai aturan, misalnya `air_B_T2`, `eg_B_T2`, dan `kja_B_T2`.
- [ ] Setiap poligon eceng gondok dan KJA berada di dalam poligon air.
- [ ] Keenam task ekspor selesai, dan nama asetnya berakhiran kodemu, misalnya `_p2_v1`.
- [ ] Lembar catatan terisi untuk keenam baris.
- [ ] Aturan independensi tidak terlanggar, atau pelanggarannya sudah dicatat.
- [ ] Koordinator sudah menutup sesi (bagian 7).

## 10. Setelah digitasi

Koordinator menggabungkan kelima digitasi lewat voting, mengukur kesepakatannya, lalu baru menjalankan evaluasi.

1. **Voting.** Untuk tiap petak dan tanggal, piksel masuk referensi akhir bila dipilih minimal 3 dari 5 penilai, terpisah untuk r_air, r_waduk, r_eg, dan r_kja. Hasilnya disimpan sebagai `saguling_ref_<petak>_<T>_vote_v1` (Langkah 06c).
2. **Peta kesepakatan.** Piksel 5–0 ditandai sepakat penuh, 4–1 cukup yakin, dan 3–2 zona ragu.
3. **Ukuran kesepakatan.** Hitung Fleiss' kappa, IoU untuk kesepuluh pasangan penilai, dan persentase piksel di tiap tingkat kesepakatan, per petak dan tanggal.
4. **Kesetaraan penilai.** Hitung rata-rata IoU tiap penilai terhadap empat penilai lainnya. Bila satu penilai jauh lebih rendah, cari penyebabnya di lembar catatan dulu sebelum memutuskan apa pun.
5. **Uji bias tim.** Bandingkan IoU p1–p2 (sesama anggota tim) dengan rata-rata IoU tim–luar dan luar–luar. Bila p1–p2 jauh lebih tinggi, ada tanda bias bersama, yang sudah dinetralkan oleh mayoritas penilai luar.
6. **Evaluasi.** Langkah 08 dijalankan pada semua piksel, pada piksel yang minimal 4–1, dan pada piksel 5–0 saja.
7. **Uji pembanding (opsional).** Bentuk referensi dengan STAPLE, lalu laporkan persentase piksel yang berbeda dari hasil voting.

Kalimat untuk naskah: *"Referensi ditetapkan dengan voting mayoritas lima penilai (dua anggota tim dan tiga penilai luar tim) yang dikalibrasi pada petak latihan. Kesepakatan antarpenilai sebesar κ = [__], dengan [__]% piksel disepakati penuh."*
