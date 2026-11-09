# Referensi

Kolom "Dipakai untuk" menunjukkan keputusan yang bersandar pada rujukan itu. Entri bertanda [lengkapi] perlu dicocokkan dengan dokumen SLR tim sebelum masuk naskah.

## Metode segmentasi

| Rujukan | Dipakai untuk | 
| --- | --- | 
| Y. Du, Y. Zhang, F. Ling, Q. Wang, W. Li, dan X. Li, "Water bodies' mapping from Sentinel-2 imagery with modified normalized difference water index at 10-m spatial resolution produced by sharpening the SWIR band," *Remote Sens.*, vol. 8, no. 4, 354, 2016. [doi:10.3390/rs8040354](https://doi.org/10.3390/rs8040354) | NDWI, MNDWI, ambang Otsu pada Sentinel-2 |
| G. Donchyts, J. Schellekens, H. Winsemius, E. Eisemann, dan N. van de Giesen, "A 30 m resolution surface water mask including estimation of positional and thematic differences using Landsat 8, SRTM and OpenStreetMap: A case study in the Murray-Darling Basin, Australia," *Remote Sens.*, vol. 8, no. 5, 386, 2016. [doi:10.3390/rs8050386](https://doi.org/10.3390/rs8050386) | Ambang adaptif Canny–Otsu |
| K. N. Markert dkk., bab pemetaan air permukaan dalam *Cloud-Based Remote Sensing with Google Earth Engine*, Springer, 2024. [lengkapi nomor bab dan judul] | Implementasi Otsu dan Canny–Otsu di GEE |
| Y. Zhou dkk., "Open surface water mapping algorithms: A comparison of water-related spectral indices and sensors," *Water*, vol. 9, no. 4, 256, 2017. [doi:10.3390/w9040256](https://doi.org/10.3390/w9040256) | Pembanding akurasi indeks air pada air terbuka (titik A) |
| L. Ji, L. Zhang, dan B. Wylie, "Analysis of dynamic thresholds for the normalized difference water index," *Photogramm. Eng. Remote Sens.*, vol. 75, no. 11, hlm. 1307–1317, 2009. | Pergeseran ambang NDWI pada piksel campuran (titik C) |
| P. Soille, *Morphological Image Analysis: Principles and Applications*, ed. ke-2. Berlin: Springer, 2003. | Closing dan hole filling |
| R. C. Gonzalez dan R. E. Woods, *Digital Image Processing*, ed. ke-4. Pearson, 2018. | Dasar operasi morfologi dan Otsu |

## Studi kasus dan data

| Rujukan | Dipakai untuk |
| --- | --- |
| Chuzaimah dkk., pemetaan eceng gondok di Waduk Saguling dengan Sentinel-2, *Akuatika Indonesia*, 2025. [Halaman artikel](https://jurnal.unpad.ac.id/akuatika-indonesia/article/view/57350) [lengkapi judul dan penulis] | Luas eceng gondok 243–1.165 ha; sebaran dekat KJA (Gambar 2 hlm. 24, Gambar 4 hlm. 26); keterbatasan vegetasi lain ikut terhitung (hlm. 23–24) |
| Suwarsono dkk., pemetaan genangan Waduk Cirata dengan indeks air, 2020. [lengkapi] | NDWI terbaik di waduk satu kaskade (titik A) |
| J.-F. Pekel, A. Cottam, N. Gorelick, dan A. S. Belward, "High-resolution mapping of global surface water and its long-term changes," *Nature*, vol. 540, hlm. 418–422, 2016. [doi:10.1038/nature20584](https://doi.org/10.1038/nature20584) | Batas maksimum waduk dan zona inti (JRC Global Surface Water) |
| Kurekin dkk. (2022); Mullen dkk. (2021); Ade dkk. (2022). [lengkapi] | Objek buatan dan vegetasi apung di atas air |
| Copernicus Sentinel-2 Level-2A, koleksi GEE `COPERNICUS/S2_SR_HARMONIZED`. | Citra |

## Data referensi dan penilaian akurasi

| Rujukan | Dipakai untuk |
| --- | --- |
| S. V. Stehman dan G. M. Foody, "Key issues in rigorous accuracy assessment of land cover products," *Remote Sens. Environ.*, vol. 231, art. 111199, 2019. [doi:10.1016/j.rse.2019.05.018](https://doi.org/10.1016/j.rse.2019.05.018) · [naskah terbuka](https://nottingham-repository.worktribe.com/output/2306994) | Bagian 1.2 kriteria 3–5: penilai lebih dari satu, buta terhadap kelas peta, andal, transparan. Bagian 3: protokol pelabelan, unit terkecil, pelaporan latar belakang penilai |
| R. G. Congalton dan K. Green, *Assessing the Accuracy of Remotely Sensed Data: Principles and Practices*, ed. ke-3. CRC Press, 2019, Bab 7. [Halaman penerbit](https://www.routledge.com/Assessing-the-Accuracy-of-Remotely-Sensed-Data-Principles-and-Practices/Congalton-Green/p/book/9780367656676) | Pengumpulan data referensi |
| P. Olofsson, G. M. Foody, M. Herold, S. V. Stehman, C. E. Woodcock, dan M. A. Wulder, "Good practices for estimating area and assessing accuracy of land change," *Remote Sens. Environ.*, vol. 148, hlm. 42–57, 2014. [doi:10.1016/j.rse.2014.02.015](https://doi.org/10.1016/j.rse.2014.02.015) | Istilah data referensi; syarat sampel acak untuk klaim seluruh waduk (keterbatasan) |
| G. M. Foody, "Assessing the accuracy of land cover change with imperfect ground reference data," *Remote Sens. Environ.*, vol. 114, no. 10, hlm. 2271–2285, 2010. [doi:10.1016/j.rse.2010.05.003](https://doi.org/10.1016/j.rse.2010.05.003) | Pengaruh referensi yang tidak sempurna |
| D. Martin, C. Fowlkes, D. Tal, dan J. Malik, "A database of human segmented natural images and its application to evaluating segmentation algorithms and measuring ecological statistics," *Proc. ICCV*, 2001. [PDF](https://vision.ics.uci.edu/papers/MartinFTM_ICCV_2001/MartinFTM_ICCV_2001.pdf) | Ground truth segmentasi dari beberapa orang per citra (Bagian 2–3) |
| S. K. Warfield, K. H. Zou, dan W. M. Wells, "Simultaneous truth and performance level estimation (STAPLE): An algorithm for the validation of image segmentation," *IEEE Trans. Med. Imaging*, vol. 23, no. 7, hlm. 903–921, 2004. [Halaman abstrak](https://nac.spl.harvard.edu/publications/simultaneous-truth-and-performance-level-estimation-staple-algorithm-validation-image) | Uji pembanding bobot penilai |
| J. L. Fleiss, "Measuring nominal scale agreement among many raters," *Psychol. Bull.*, vol. 76, no. 5, hlm. 378–382, 1971. | Fleiss' kappa |
| J. R. Landis dan G. G. Koch, "The measurement of observer agreement for categorical data," *Biometrics*, vol. 33, no. 1, hlm. 159–174, 1977. [PubMed](https://pubmed.ncbi.nlm.nih.gov/843571/) | Tafsiran nilai kappa |
| J. Radoux, F. Waldner, dan P. Bogaert, "How response designs and class proportions affect the accuracy of validation data," pracetak arXiv:1906.11396, 2019. [arXiv](https://arxiv.org/abs/1906.11396) | Kesalahan pelabelan terbesar di piksel campuran (zona ragu) |

## Sumber berita untuk latar belakang

| Sumber | Fakta yang dipakai |
| --- | --- |
| [Beritasatu, 30 Juni 2026](https://www.beritasatu.com/sport/3006772/120-ha-waduk-saguling-tertutup-eceng-gondok-pasokan-listrik-terancam) | ±120 ha tertutup eceng gondok; pasokan hingga 700 MW berpotensi terganggu |
| [Galapos, Juli 2026](https://www.galapos.id/2026/07/lautan-eceng-gondok-kepung-waduk.html) | Tujuh titik, hampir tiga bulan; 2 alat berat dan 4 ponton; target tuntas akhir 2026 |
| [PLN Indonesia Power](https://www.plnindonesiapower.co.id/news/pln-indonesia-power-ubp-saguling-perkuat-kolaborasi-bersama-pemkab-bandung-barat-selamatkan-waduk-saguling-dari-eceng-gondok) | Program pengendalian eceng gondok bersama Pemkab Bandung Barat |
| [Republika, 23 Oktober 2026](https://rejabar.republika.co.id/berita/tnced9416/kja-di-waduk-saguling-dan-cirata-kelebihan-kapasitas-petambak-diminta-beralih) | 45.464 petak KJA sampai 2025, melebihi kapasitas |
| [Satgas Citarum Harum](https://citarumharum.jabarprov.go.id/satgas-citarum-akan-lanjutkan-penertiban-keramba-jaring-apung-di-waduk-saguling/) | Penertiban KJA dilanjutkan 2026 |
