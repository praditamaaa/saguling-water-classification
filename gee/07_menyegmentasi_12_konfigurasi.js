// =====================================================================
// LANGKAH 07 — MENYEGMENTASI AIR DENGAN 12 KONFIGURASI
// ---------------------------------------------------------------------
// Tujuan   : Inti PCD penelitian. Untuk T1 dan T2, membuat 12 peta biner
//            air (1) / bukan air (0) dari kombinasi:
//              2 indeks   : NDWI, MNDWI
//              3 ambang   : tetap 0, Otsu global, Canny–Otsu
//              2 pascaproses: tanpa, closing + hole filling
// Masukan  : Asset saguling_petak_<versi> (Langkah 05; memuat T1 dan T2).
// Keluaran : Asset saguling_peta_T1_<versi> dan saguling_peta_T2_<versi>
//            (12 band K1–K12; nilai parameter ikut disimpan sebagai properti)
//            CSV 07_ambang_otomatis_<versi>.csv
// Dipakai  : Langkah 08 (evaluasi) dan Tabel X naskah.
//
// TIGA MODE (ubah MODE di bagian 0), jalankan berurutan:
//   'setel'   Tampilkan tepi Canny, pita histogram, ambang, dan 12 peta
//             untuk SATU tanggal. Petak uji DITUTUP hitam, supaya
//             parameter tidak disetel dengan melihat data uji.
//             Ubah TAU_C / L_MIN sampai tepi merah menempel garis air–darat.
//   'ekspor'  Buat task ekspor 2 Asset peta + 1 CSV ambang.
//   'periksa' Tampilkan 24 peta hasil ekspor untuk cek visual.
//
// LETAK OPERASI PCD (Gambar 1 naskah):
//   Tahap 2 Praproses  : masker awan SCL (logika), resampling 10->20 m (geometri)
//   Tahap 3 Indeks     : NDWI, MNDWI (operasi titik)
//   Tahap 4 Ambang     : histogram + Otsu; Gaussian, gradien, Canny; dilasi
//   Tahap 5 Pascaproses: closing (dilasi lalu erosi), hole filling
//                        (komponen terhubung), dibatasi L (logika AND)
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var MODE = 'setel';           // 'setel' | 'ekspor' | 'periksa'
var KODE_SETEL = 'T1';        // tanggal yang dipakai di mode 'setel'
var INDEKS_SETEL = 'MNDWI';   // indeks yang tepi Canny-nya ditampilkan

var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK = 'v1';   // versi Asset petak yang DIBACA (dari Langkah 05)
var VERSI_PETA  = 'v1';   // versi Asset peta yang DITULIS (mode ekspor) / DIBACA (mode periksa)
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
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);

// L = batas maksimum waduk (JRC), di grid 20 m. Masker bantu, bukan referensi.
var L = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('max_extent')
  .unmask(0).eq(1).reproject(P20);

// Daerah histogram Otsu global: L diperlebar (dilasi) agar daratan ikut
// terwakili; tanpa daratan histogram hanya punya satu puncak.
var daerahHist = L.focalMax({radius: BUFFER_OTSU_M, units: 'meters'}).reproject(P20);

// TAHAP 2 — PRAPROSES
// Band 10 m (B3, B4, B8) dirata-rata 2 x 2 piksel menjadi 20 m agar
// sejajar dengan B11 (20 m). NDWI dan MNDWI lalu dibandingkan pada
// resolusi yang sama.
function citra20(tgl) {
  var d = ee.Date(tgl);
  var m = s2.filterDate(d, d.advance(1, 'day')).mosaic();
  var b10 = m.select(['B3', 'B4', 'B8']).setDefaultProjection(P10)
    .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 16})
    .reproject(P20);
  var b20 = m.select(['B11', 'SCL']).setDefaultProjection(P20).reproject(P20);
  return b10.addBands(b20);
}

// Masker awan (persamaan 1): valid bila SCL bukan 3, 8, 9, 10.
function maskerBersih(img) {
  var scl = img.select('SCL');
  return scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
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
// 4. DUA BELAS KONFIGURASI UNTUK SATU TANGGAL (Tabel IV naskah)
//    Urutan band: K1–K6 = NDWI, K7–K12 = MNDWI.
//    Tiap indeks: tetap, Otsu, Canny–Otsu; tiap metode: tanpa, dengan.
//    Peta "tanpa" juga dibatasi L, supaya selisih tanpa vs dengan
//    murni berasal dari closing + hole filling.
// ---------------------------------------------------------------------
function duaBelas(kode) {
  var tgl = TANGGAL[kode];
  var img = citra20(tgl);
  var ok = maskerBersih(img);
  // TAHAP 3 — indeks (operasi titik)
  var indeks = {
    NDWI: img.normalizedDifference(['B3', 'B8']).rename('idx').updateMask(ok),
    MNDWI: img.normalizedDifference(['B3', 'B11']).rename('idx').updateMask(ok)
  };
  var band = [];
  var info = {kode: kode, tanggal: tgl, versi_peta: VERSI_PETA};
  var detail = {};
  var k = 0;
  ['NDWI', 'MNDWI'].forEach(function (nama) {
    var idx = indeks[nama];
    var co = cannyOtsu(idx);
    var ambang = {tetap: ee.Number(0), otsu: ambangOtsuGlobal(idx), canny: co.t};
    info['t_' + nama + '_otsu'] = ambang.otsu;
    info['t_' + nama + '_canny'] = ambang.canny;
    info['n_pita_' + nama] = co.nPita;
    detail[nama] = {idx: idx, canny: co};
    ['tetap', 'otsu', 'canny'].forEach(function (metode) {
      var w = idx.gt(ambang[metode]).unmask(0);          // persamaan 6
      k += 1;
      band.push(w.and(L).updateMask(ok).rename('K' + k));            // tanpa pascaproses
      k += 1;
      band.push(pascaproses(w).updateMask(ok).rename('K' + k));      // dengan pascaproses
    });
  });
  return {peta: ee.Image.cat(band).toByte(), ambang: ee.Feature(null, info),
          img: img, detail: detail};
}


// ---------------------------------------------------------------------
// 5. MODE
// ---------------------------------------------------------------------
Map.setOptions('SATELLITE');
var garisPetak = petakFC.style({color: 'ffff00', fillColor: '00000000', width: 2});

if (MODE === 'setel') {
  var r = duaBelas(KODE_SETEL);
  // Tutup petak uji (+100 m) agar penyetelan tidak memakai data uji.
  var luarPetak = ee.Image(1).paint(petakFC.map(function (f) { return f.buffer(100); }), 0);
  var tutupi = function (x) { return x.updateMask(luarPetak); };
  var d = r.detail[INDEKS_SETEL];

  Map.centerObject(AOI, 12);
  print('Ambang ' + KODE_SETEL + ' (t = -9 berarti pita Canny kosong):', r.ambang);
  Map.addLayer(tutupi(r.img), {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
    KODE_SETEL + ' · false color 20 m');
  Map.addLayer(tutupi(d.idx), {min: -0.6, max: 0.6, palette: ['8c510a', 'f6e8c3', '01665e']},
    INDEKS_SETEL, false);
  Map.addLayer(tutupi(d.canny.pita.selfMask()), {palette: ['ffff00'], opacity: 0.4},
    'Pita tepi (histogram Canny–Otsu)', false);
  Map.addLayer(tutupi(d.canny.tepi.selfMask()), {palette: ['ff0000']}, 'Tepi Canny panjang (merah)');
  for (var i = 1; i <= 12; i++) {
    Map.addLayer(tutupi(r.peta.select('K' + i).selfMask()), {palette: ['2166ac']}, 'K' + i, false);
  }
  Map.addLayer(ee.Image(1).updateMask(luarPetak.not()), {palette: ['000000'], opacity: 0.7},
    'Petak uji (ditutup)');
  print('Petunjuk:', 'Tepi merah harus menempel garis air–darat dan jarang muncul di daratan. ' +
    'Terlalu sedikit tepi: turunkan TAU_C. Banyak tepi di daratan: naikkan TAU_C atau L_MIN.');

} else if (MODE === 'ekspor') {
  var daftarAmbang = [];
  ['T1', 'T2'].forEach(function (kode) {
    var hasil = duaBelas(kode);
    daftarAmbang.push(hasil.ambang);
    Export.image.toAsset({
      // Parameter ikut disimpan, supaya setiap versi peta bisa ditelusuri.
      image: hasil.peta.set({
        versi_petak: VERSI_PETAK, versi_peta: VERSI_PETA, buffer_otsu_m: BUFFER_OTSU_M,
        tau_c: TAU_C, sigma: SIGMA, l_min: L_MIN, rb_px: RB_PX, r_close: R_CLOSE, a_max: A_MAX
      }),
      description: 'peta_' + kode + '_' + VERSI_PETA,
      assetId: ASSET + 'saguling_peta_' + kode + '_' + VERSI_PETA,
      region: AOI, crs: CRS, crsTransform: GRID, maxPixels: 1e10,
      pyramidingPolicy: {'.default': 'mode'}
    });
  });
  var tabelAmbang = ee.FeatureCollection(daftarAmbang);
  print('Ambang otomatis:', tabelAmbang);
  Export.table.toDrive({
    collection: tabelAmbang, description: '07_ambang_otomatis_' + VERSI_PETA,
    folder: 'PCD_Saguling', fileFormat: 'CSV',
    selectors: ['kode', 'tanggal', 'versi_peta', 't_NDWI_otsu', 't_NDWI_canny',
      't_MNDWI_otsu', 't_MNDWI_canny', 'n_pita_NDWI', 'n_pita_MNDWI']
  });
  print('Buka tab Tasks, lalu klik RUN pada 3 task.');

} else if (MODE === 'periksa') {
  Map.centerObject(petakFC, 12);
  ['T1', 'T2'].forEach(function (kode) {
    var peta = ee.Image(ASSET + 'saguling_peta_' + kode + '_' + VERSI_PETA);
    Map.addLayer(citra20(TANGGAL[kode]), {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
      kode + ' · false color', kode === 'T1');
    for (var j = 1; j <= 12; j++) {
      Map.addLayer(peta.select('K' + j).selfMask(), {palette: ['2166ac']}, kode + ' · K' + j, false);
    }
  });
  print('Nyalakan K1–K12 satu per satu. Catat di Excel Tabel 10: lubang besar, ' +
    'air di daratan, tepi bergerigi, atau peta kosong.');
}

Map.addLayer(garisPetak, {}, 'Petak uji');
