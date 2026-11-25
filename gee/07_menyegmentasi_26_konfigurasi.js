// =====================================================================
// LANGKAH 07 — MENYEGMENTASI AIR DENGAN 26 KONFIGURASI
// ---------------------------------------------------------------------
// Tujuan   : Inti PCD penelitian. Untuk setiap tanggal berlabel, membuat
//            26 peta biner air (1) / bukan air (0) dari kombinasi:
//              5 transformasi satu kanal: NDWI, MNDWI, NDVI, Grayscale (RGB),
//                                         PCA1 (komponen utama pertama)
//              3 ambang   : tetap 0 (hanya indeks ternormalisasi), Otsu global,
//                           Canny–Otsu
//              2 pascaproses: tanpa, closing + hole filling
//            K1–K12 sama persis dengan versi 12 konfigurasi (NDWI, MNDWI),
//            K13–K18 = NDVI, K19–K22 = Grayscale, K23–K26 = PCA1.
// Masukan  : Asset saguling_petak_<versi> (Langkah 05; T1 dan T2) dan
//            saguling_tambahan_<versi> (Langkah 05b; T3, D1, D2, D3).
// Keluaran : Asset saguling_peta_<kode>_<versi> untuk T1, T2, T3, D1, D2, D3
//            (26 band K1–K26; nilai parameter ikut disimpan sebagai properti)
//            CSV 07_ambang_otomatis_<versi>.csv
// Dipakai  : Langkah 08 (evaluasi), 09 (tabel), dan 10 (konfigurasi terbaik).
//
// MENGAPA LIMA TRANSFORMASI
//   Semua transformasi mengubah citra multipita menjadi SATU kanal (operasi
//   titik), lalu diberi aturan ambang dan morfologi yang sama, sehingga
//   perbandingannya adil:
//     NDWI, MNDWI  indeks air (hijau dengan NIR / SWIR)
//     NDVI         indeks vegetasi; air bernilai rendah
//     GRAY         grayscale dari RGB: 0,299 R + 0,587 G + 0,114 B (ITU-R
//                  BT.601); pembanding "hanya citra RGB"
//     PCA1         komponen utama pertama dari 10 pita, dihitung per tanggal
//                  di daerah histogram; transformasi berbasis data
//   Semua kanal diorientasikan "air bernilai tinggi" sehingga aturannya
//   seragam: air = kanal > ambang. Untuk NDVI kanal = -NDVI; GRAY dan PCA1
//   diskalakan ke kira-kira -1..1 agar TAU_C Canny yang sama bisa dipakai.
//   Ambang tetap 0 hanya untuk indeks ternormalisasi (NDWI, MNDWI, NDVI)
//   karena hanya pada indeks itu nilai 0 bermakna fisik.
//
// TIGA MODE (ubah MODE di bagian 0), jalankan berurutan:
//   'setel'   Tampilkan tepi Canny, pita histogram, ambang, dan peta satu
//             transformasi (TRANSFORMASI_SETEL) untuk SATU tanggal. Semua
//             petak (A–F) DITUTUP hitam, supaya parameter tidak disetel
//             dengan melihat data latih maupun uji.
//             Ubah TAU_C / L_MIN sampai tepi merah menempel garis air–darat.
//   'ekspor'  Buat task ekspor Asset peta per tanggal + 1 CSV ambang.
//   'periksa' Tampilkan 26 peta hasil ekspor satu tanggal untuk cek visual.
//
// LETAK OPERASI PCD (Gambar 1 naskah):
//   Tahap 2 Praproses  : masker awan SCL (logika), resampling 10->20 m (geometri)
//   Tahap 3 Transformasi: NDWI, MNDWI, NDVI, grayscale (operasi titik);
//                        PCA (transformasi linear berbasis statistik citra)
//   Tahap 4 Ambang     : histogram + Otsu; Gaussian, gradien, Canny; dilasi
//   Tahap 5 Pascaproses: closing (dilasi lalu erosi), hole filling
//                        (komponen terhubung), dibatasi L (logika AND)
//
// CATATAN TEKNIS
//   Mode 'setel' hanya menghitung satu transformasi agar Console tidak
//   memicu "Too many concurrent aggregations". Mode 'ekspor' tidak mencetak
//   ambang ke Console; nilainya ada di CSV.
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
//   Peta v1 berisi 12 band; peta 26 band harus memakai versi baru (v2).
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var MODE = 'setel';           // 'setel' | 'ekspor' | 'periksa'
var KODE_SETEL = 'T1';        // tanggal yang dipakai di mode 'setel' dan 'periksa'
var TRANSFORMASI_SETEL = 'MNDWI';   // NDWI | MNDWI | NDVI | GRAY | PCA1

var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK    = 'v1';   // versi Asset petak yang DIBACA (dari Langkah 05)
var VERSI_TAMBAHAN = 'v1';   // versi Asset tanggal/petak tambahan yang DIBACA (Langkah 05b)
var VERSI_PETA     = 'v2';   // versi Asset peta yang DITULIS (mode ekspor) / DIBACA (mode periksa)
var KODE = ['T1', 'T2', 'T3', 'D1', 'D2', 'D3'];   // tanggal yang dipetakan
var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);

// Parameter Tabel V naskah. Nilai di bawah adalah NILAI AWAL;
// nilai final ditentukan di mode 'setel' lalu dicatat di Excel Tabel 8.
var BUFFER_OTSU_M = 500;   // lebar daratan di sekitar L untuk histogram Otsu global (m)
var TAU_C   = 0.3;         // ambang magnitudo gradien Canny
var SIGMA   = 1;           // simpangan baku filter Gaussian Canny (piksel)
var L_MIN   = 10;          // panjang tepi minimum (piksel)
var RB_PX   = 3;           // jari-jari pita di sekitar tepi (piksel; 3 = 60 m)
var R_CLOSE = 1;           // jari-jari elemen struktur closing (piksel; 1 = 20 m)
var A_MAX   = 1024;        // ukuran lubang maksimum (piksel; batas GEE 1024 = ±41 ha)
var SKALA_GRAY = 0.3;      // reflektansi grayscale yang dipetakan ke -1 (kanal = 1 - 2*gray/SKALA_GRAY)
var SKALA_PCA  = 3;        // PCA1 (dalam simpangan baku) dibagi angka ini agar kira-kira -1..1

var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];
var P10 = ee.Projection(CRS).atScale(10);
var P20 = ee.Projection(CRS).atScale(20);


// ---------------------------------------------------------------------
// 1. DATA DAN MASKER
// ---------------------------------------------------------------------
var petakFC = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var TANGGAL = {
  T1: ee.String(petakFC.first().get('t1')),
  T2: ee.String(petakFC.first().get('t2'))
};
// T3, D1, D2, D3 dari Langkah 05b. Bila Asset belum ada, hanya T1 dan T2.
var idTambahan = ASSET + 'saguling_tambahan_' + VERSI_TAMBAHAN;
var adaTambahan = false;
try { adaTambahan = ee.data.getAsset(idTambahan) !== null; } catch (e) { adaTambahan = false; }
var tambahan = adaTambahan ? ee.FeatureCollection(idTambahan) : ee.FeatureCollection([]);
if (adaTambahan) {
  var fTgl = ee.Feature(tambahan.filter(ee.Filter.eq('jenis', 'tanggal')).first());
  ['T3', 'D1', 'D2', 'D3'].forEach(function (k) { TANGGAL[k] = ee.String(fTgl.get(k.toLowerCase())); });
} else {
  print('PERINGATAN: ' + idTambahan + ' belum ada; hanya T1 dan T2 yang dipetakan.');
  KODE = KODE.filter(function (k) { return k === 'T1' || k === 'T2'; });
}
// Semua petak (A–F) untuk ditutup di mode 'setel' dan digambar di peta.
var semuaPetak = petakFC.merge(tambahan.filter(ee.Filter.eq('jenis', 'petak')));
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);

// L = batas maksimum waduk (JRC), di grid 20 m. Masker bantu, bukan referensi.
var L = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('max_extent')
  .unmask(0).eq(1).reproject(P20);

// Daerah histogram Otsu global: L diperlebar (dilasi) agar daratan ikut
// terwakili; tanpa daratan histogram hanya punya satu puncak.
var daerahHist = L.focalMax({radius: BUFFER_OTSU_M, units: 'meters'}).reproject(P20);

// TAHAP 2 — PRAPROSES
// Pita 10 m (B2, B3, B4, B8) dirata-rata 2 x 2 piksel menjadi 20 m agar
// sejajar dengan pita 20 m. Semua transformasi lalu dibandingkan pada
// resolusi yang sama. Reflektansi dibagi 10000 (sama dengan Langkah 10).
var PITA = ['B2', 'B3', 'B4', 'B8', 'B5', 'B6', 'B7', 'B8A', 'B11', 'B12'];
function citra20(tgl) {
  var d = ee.Date(tgl);
  var m = s2.filterDate(d, d.advance(1, 'day')).mosaic();
  var b10 = m.select(['B2', 'B3', 'B4', 'B8']).setDefaultProjection(P10)
    .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 16})
    .reproject(P20);
  var b20 = m.select(['B5', 'B6', 'B7', 'B8A', 'B11', 'B12']).setDefaultProjection(P20).reproject(P20);
  var scl = m.select('SCL').setDefaultProjection(P20).reproject(P20);
  return b10.addBands(b20).toFloat().divide(10000).select(PITA).addBands(scl);
}

// Masker awan (persamaan 1): valid bila SCL bukan 3, 8, 9, 10.
function maskerBersih(img) {
  var scl = img.select('SCL');
  return scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
}


// ---------------------------------------------------------------------
// 1b. TAHAP 3 — TRANSFORMASI SATU KANAL (air bernilai tinggi)
//     SALIN BAGIAN INI KE LANGKAH 10 BILA DIUBAH.
// ---------------------------------------------------------------------
var TRANSFORMASI = [
  {nama: 'NDWI',  tetap: true},
  {nama: 'MNDWI', tetap: true},
  {nama: 'NDVI',  tetap: true},
  {nama: 'GRAY',  tetap: false},
  {nama: 'PCA1',  tetap: false}
];
var NAMA_METODE = {tetap: 'Tetap 0', otsu: 'Otsu global', canny: 'Canny-Otsu'};

// Daftar 26 konfigurasi dengan nomor K yang tetap (urutan Tabel IV naskah).
function daftarKonfigurasi() {
  var out = [], k = 0;
  TRANSFORMASI.forEach(function (tr) {
    (tr.tetap ? ['tetap', 'otsu', 'canny'] : ['otsu', 'canny']).forEach(function (m) {
      ['Tanpa', 'Dengan'].forEach(function (p) {
        k += 1;
        out.push({k: 'K' + k, indeks: tr.nama, kunci: m, metode: NAMA_METODE[m], pasca: p});
      });
    });
  });
  return out;
}
var KONF = daftarKonfigurasi();

// PCA per tanggal: rata-rata dan kovarians 10 pita di daerah histogram
// (piksel bersih), lalu proyeksi ke vektor eigen pertama. Tanda diatur agar
// air bernilai tinggi: muatan B8 (NIR) positif berarti air bernilai rendah,
// jadi dikalikan -1.
function pca1(img, ok) {
  var daerah = daerahHist.and(ok);
  var x = img.select(PITA);
  var rata = x.updateMask(daerah).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: AOI, crs: CRS, crsTransform: GRID,
    maxPixels: 1e10, tileScale: 4
  });
  var pusat = x.subtract(ee.Image.constant(rata.values(PITA)).rename(PITA));
  var arr = pusat.toArray();
  var cov = arr.updateMask(daerah).reduceRegion({
    reducer: ee.Reducer.centeredCovariance(), geometry: AOI, crs: CRS, crsTransform: GRID,
    maxPixels: 1e10, tileScale: 4
  });
  var eig = ee.Array(cov.get('array')).eigen();            // baris urut nilai eigen menurun
  var lambda1 = ee.Number(eig.get([0, 0]));
  var total = ee.Number(eig.slice(1, 0, 1).reduce(ee.Reducer.sum(), [0]).get([0, 0]));
  var v1 = eig.slice(1, 1).slice(0, 0, 1);                  // 1 x 10
  var tanda = ee.Number(v1.get([0, PITA.indexOf('B8')])).gte(0).multiply(-2).add(1);
  var pc1 = ee.Image(v1).matrixMultiply(arr.toArray(1)).arrayGet([0, 0]);
  return {
    idx: pc1.divide(lambda1.sqrt()).multiply(tanda).divide(SKALA_PCA),
    varRasio: lambda1.divide(total), tanda: tanda
  };
}

// Mengembalikan {idx: citra 1 band bernama 'idx', info: {...}}.
function transformasi(img, nama, ok) {
  var x = img.select(PITA);
  var idx, info = {};
  if (nama === 'NDWI') idx = x.normalizedDifference(['B3', 'B8']);
  if (nama === 'MNDWI') idx = x.normalizedDifference(['B3', 'B11']);
  if (nama === 'NDVI') idx = x.normalizedDifference(['B8', 'B4']).multiply(-1);
  if (nama === 'GRAY') {
    idx = x.expression('0.299 * R + 0.587 * G + 0.114 * B',
      {R: x.select('B4'), G: x.select('B3'), B: x.select('B2')})
      .divide(SKALA_GRAY).min(1).multiply(-2).add(1);
  }
  if (nama === 'PCA1') {
    var p = pca1(img, ok);
    idx = p.idx;
    info = {pca_var_rasio: p.varRasio, pca_tanda: p.tanda};
  }
  return {idx: idx.rename('idx').updateMask(ok), info: info};
}


// ---------------------------------------------------------------------
// 2. TAHAP 4 — AMBANG OTOMATIS
// ---------------------------------------------------------------------
// Otsu (persamaan 7–8). Untuk setiap titik potong i pada histogram,
// piksel dibagi dua kelas; ambang terbaik = titik potong dengan varians
// ANTARKELAS terbesar:  sigma_B^2 = w0 * (mu0 - mu)^2 + w1 * (mu1 - mu)^2
function otsu(hist) {
  hist = ee.Dictionary(hist);
  var counts = ee.Array(hist.get('histogram'));      // jumlah piksel per kelas histogram
  var means = ee.Array(hist.get('bucketMeans'));     // nilai tengah tiap kelas
  var size = means.length().get([0]);
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
  var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
  var mean = sum.divide(total);
  var titik = ee.List.sequence(1, size.subtract(1));
  var bss = titik.map(function (i) {
    var aCounts = counts.slice(0, 0, i);
    var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var aMean = means.slice(0, 0, i).multiply(aCounts)
      .reduce(ee.Reducer.sum(), [0]).get([0]).divide(aCount);
    var bCount = total.subtract(aCount);
    var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);
    return aCount.multiply(aMean.subtract(mean).pow(2))
      .add(bCount.multiply(bMean.subtract(mean).pow(2)));
  });
  var kandidat = means.slice(0, 0, size.subtract(1));
  return ee.Number(kandidat.sort(ee.Array(bss)).get([-1]));   // yang varians-nya terbesar
}

function histogram(idx, masker) {
  return idx.updateMask(masker).reduceRegion({
    reducer: ee.Reducer.histogram({maxBuckets: 256}),
    geometry: AOI, crs: CRS, crsTransform: GRID, maxPixels: 1e10, tileScale: 4
  }).get('idx');
}

// Otsu global: histogram dari seluruh daerahHist.
function ambangOtsuGlobal(idx) {
  return otsu(histogram(idx, daerahHist));
}

// Canny–Otsu: histogram HANYA dari pita sempit di sekitar tepi air,
// sehingga jumlah piksel air dan darat seimbang (histogram dua puncak).
//   1) Canny: haluskan dengan Gaussian (SIGMA), hitung gradien, ambil
//      puncak gradien di atas TAU_C  -> piksel tepi.
//   2) Buang tepi pendek: komponen terhubung < L_MIN piksel.
//   3) Dilasi tepi dengan jari-jari RB_PX -> pita.
//   4) Otsu pada piksel di dalam pita.
function cannyOtsu(idx) {
  var tepi = ee.Algorithms.CannyEdgeDetector({
    image: idx.reproject(P20), threshold: TAU_C, sigma: SIGMA
  }).gt(0).reproject(P20);
  var panjang = tepi.selfMask().connectedPixelCount(256, true).reproject(P20);
  var tepiPanjang = panjang.gte(L_MIN).unmask(0);
  var pita = tepiPanjang.focalMax({radius: RB_PX, kernelType: 'square', units: 'pixels'})
    .reproject(P20).and(daerahHist);
  var hist = histogram(idx, pita);
  var nPita = pita.reduceRegion({
    reducer: ee.Reducer.sum(), geometry: AOI, crs: CRS, crsTransform: GRID,
    maxPixels: 1e10, tileScale: 4
  }).values().get(0);
  // Bila pita kosong, ambang diberi tanda -9 (lihat rencana cadangan).
  var t = ee.Number(ee.Algorithms.If(hist, otsu(hist), -9));
  return {t: t, tepi: tepiPanjang, pita: pita, nPita: nPita};
}


// ---------------------------------------------------------------------
// 3. TAHAP 5 — PASCAPROSES MORFOLOGI (persamaan 11–14)
// ---------------------------------------------------------------------
// w: citra biner 0/1 TANPA masker, di grid 20 m.
function pascaproses(w) {
  // Closing = dilasi lalu erosi dengan elemen struktur lingkaran.
  // Menutup celah sempit, misalnya lorong air di antara keramba.
  var tutup = w
    .focalMax({radius: R_CLOSE, kernelType: 'circle', units: 'pixels'}).reproject(P20)
    .focalMin({radius: R_CLOSE, kernelType: 'circle', units: 'pixels'}).reproject(P20);
  // Hole filling: komponen bukan-air (4-tetangga) yang ukurannya < A_MAX
  // piksel dianggap lubang dan diisi menjadi air. Hamparan yang menempel
  // ke daratan tergabung dengan daratan (komponen besar) -> TIDAK terisi.
  var ukuran = tutup.not().selfMask().connectedPixelCount(A_MAX, false).reproject(P20);
  var lubang = ukuran.lt(A_MAX).unmask(0);
  // Dibatasi L agar koreksi tidak meluber ke daratan.
  return tutup.or(lubang).and(L);
}


// ---------------------------------------------------------------------
// 4. DUA PULUH ENAM KONFIGURASI UNTUK SATU TANGGAL (Tabel IV naskah)
//    Urutan band mengikuti KONF: K1–K6 NDWI, K7–K12 MNDWI, K13–K18 NDVI,
//    K19–K22 Grayscale, K23–K26 PCA1. Tiap transformasi: ambang (tetap,)
//    Otsu, Canny–Otsu; tiap ambang: tanpa, dengan pascaproses.
//    Peta "tanpa" juga dibatasi L, supaya selisih tanpa vs dengan
//    murni berasal dari closing + hole filling.
//    hanya: daftar nama transformasi (mode 'setel'); kosong = semua.
// ---------------------------------------------------------------------
function semuaKonfigurasi(kode, hanya) {
  var tgl = TANGGAL[kode];
  var img = citra20(tgl);
  var ok = maskerBersih(img);
  var band = [];
  var info = {kode: kode, tanggal: tgl, versi_peta: VERSI_PETA};
  var detail = {};
  TRANSFORMASI.forEach(function (tr) {
    if (hanya && hanya.indexOf(tr.nama) < 0) return;
    var t = transformasi(img, tr.nama, ok);
    var idx = t.idx;
    Object.keys(t.info).forEach(function (kunci) { info[kunci] = t.info[kunci]; });
    var co = cannyOtsu(idx);
    var ambang = {tetap: ee.Number(0), otsu: ambangOtsuGlobal(idx), canny: co.t};
    info['t_' + tr.nama + '_otsu'] = ambang.otsu;
    info['t_' + tr.nama + '_canny'] = ambang.canny;
    info['n_pita_' + tr.nama] = co.nPita;
    detail[tr.nama] = {idx: idx, canny: co};
    KONF.filter(function (c) { return c.indeks === tr.nama; }).forEach(function (c) {
      var w = idx.gt(ambang[c.kunci]).unmask(0);          // persamaan 6
      var peta = c.pasca === 'Tanpa' ? w.and(L) : pascaproses(w);
      band.push(peta.updateMask(ok).rename(c.k));
    });
  });
  return {peta: ee.Image.cat(band).toByte(), ambang: ee.Feature(null, info),
          img: img, detail: detail};
}


// ---------------------------------------------------------------------
// 5. MODE
// ---------------------------------------------------------------------
Map.setOptions('SATELLITE');
var garisPetak = semuaPetak.style({color: 'ffff00', fillColor: '00000000', width: 2});
var visFalse = {bands: ['B8', 'B4', 'B3'], min: 0, max: 0.4};

if (MODE === 'setel') {
  var r = semuaKonfigurasi(KODE_SETEL, [TRANSFORMASI_SETEL]);
  // Tutup semua petak (+100 m) agar penyetelan tidak memakai data latih/uji.
  var luarPetak = ee.Image(1).paint(semuaPetak.map(function (f) { return f.buffer(100); }), 0);
  var tutupi = function (x) { return x.updateMask(luarPetak); };
  var d = r.detail[TRANSFORMASI_SETEL];

  Map.centerObject(AOI, 12);
  print('Ambang ' + TRANSFORMASI_SETEL + ' ' + KODE_SETEL +
    ' (skala kanal: air tinggi; t = -9 berarti pita Canny kosong):', r.ambang);
  Map.addLayer(tutupi(r.img), visFalse, KODE_SETEL + ' · false color 20 m');
  Map.addLayer(tutupi(d.idx), {min: -0.6, max: 0.6, palette: ['8c510a', 'f6e8c3', '01665e']},
    TRANSFORMASI_SETEL + ' (air tinggi)', false);
  Map.addLayer(tutupi(d.canny.pita.selfMask()), {palette: ['ffff00'], opacity: 0.4},
    'Pita tepi (histogram Canny–Otsu)', false);
  Map.addLayer(tutupi(d.canny.tepi.selfMask()), {palette: ['ff0000']}, 'Tepi Canny panjang (merah)');
  KONF.filter(function (c) { return c.indeks === TRANSFORMASI_SETEL; }).forEach(function (c) {
    Map.addLayer(tutupi(r.peta.select(c.k).selfMask()), {palette: ['2166ac']},
      c.k + ' ' + c.metode + ' ' + c.pasca, false);
  });
  Map.addLayer(ee.Image(1).updateMask(luarPetak.not()), {palette: ['000000'], opacity: 0.7},
    'Petak A–F (ditutup)');
  print('Petunjuk:', 'Tepi merah harus menempel garis air–darat dan jarang muncul di daratan. ' +
    'Terlalu sedikit tepi: turunkan TAU_C. Banyak tepi di daratan: naikkan TAU_C atau L_MIN. ' +
    'Setel pada MNDWI, lalu cek transformasi lain dengan nilai yang sama.');

} else if (MODE === 'ekspor') {
  var daftarAmbang = [];
  KODE.forEach(function (kode) {
    var hasil = semuaKonfigurasi(kode);
    daftarAmbang.push(hasil.ambang);
    Export.image.toAsset({
      // Parameter ikut disimpan, supaya setiap versi peta bisa ditelusuri.
      image: hasil.peta.set({
        versi_petak: VERSI_PETAK, versi_tambahan: VERSI_TAMBAHAN, versi_peta: VERSI_PETA,
        kode: kode, tanggal: TANGGAL[kode], buffer_otsu_m: BUFFER_OTSU_M,
        tau_c: TAU_C, sigma: SIGMA, l_min: L_MIN, rb_px: RB_PX, r_close: R_CLOSE, a_max: A_MAX,
        skala_gray: SKALA_GRAY, skala_pca: SKALA_PCA
      }),
      description: 'peta_' + kode + '_' + VERSI_PETA,
      assetId: ASSET + 'saguling_peta_' + kode + '_' + VERSI_PETA,
      region: AOI, crs: CRS, crsTransform: GRID, maxPixels: 1e10,
      pyramidingPolicy: {'.default': 'mode'}
    });
  });
  // Ambang TIDAK dicetak ke Console (puluhan agregasi sekaligus); lihat CSV.
  var kolomAmbang = ['kode', 'tanggal', 'versi_peta'];
  TRANSFORMASI.forEach(function (tr) {
    kolomAmbang.push('t_' + tr.nama + '_otsu', 't_' + tr.nama + '_canny', 'n_pita_' + tr.nama);
  });
  kolomAmbang.push('pca_var_rasio', 'pca_tanda');
  Export.table.toDrive({
    collection: ee.FeatureCollection(daftarAmbang), description: '07_ambang_otomatis_' + VERSI_PETA,
    folder: 'PCD_Saguling', fileFormat: 'CSV', selectors: kolomAmbang
  });
  print('Buka tab Tasks, lalu klik RUN pada ' + (KODE.length + 1) + ' task (' +
    KODE.join(', ') + ' + CSV ambang).');

} else if (MODE === 'periksa') {
  Map.centerObject(semuaPetak, 12);
  var peta = ee.Image(ASSET + 'saguling_peta_' + KODE_SETEL + '_' + VERSI_PETA);
  Map.addLayer(citra20(TANGGAL[KODE_SETEL]), visFalse, KODE_SETEL + ' · false color');
  KONF.forEach(function (c) {
    Map.addLayer(peta.select(c.k).selfMask(), {palette: ['2166ac']},
      KODE_SETEL + ' · ' + c.k + ' ' + c.indeks + ' ' + c.metode + ' ' + c.pasca, false);
  });
  print('Nyalakan K1–K26 satu per satu. Catat di Excel Tabel 10: lubang besar, ' +
    'air di daratan, tepi bergerigi, atau peta kosong. Ganti KODE_SETEL untuk tanggal lain.');
}

Map.addLayer(garisPetak, {}, 'Petak A–F');
