// =====================================================================
// LANGKAH 10 — MEMBUAT DATASET MACHINE LEARNING
// ---------------------------------------------------------------------
// Tujuan   : Mengubah citra Sentinel-2 menjadi tabel fitur per piksel
//            (hasil ekstraksi fitur PCD) beserta label referensi lima
//            penilai, lalu mengekspornya sebagai CSV untuk dilatih di
//            Kaggle atau Google Colab (notebook ml/11_pelatihan_model.ipynb).
// Masukan  : Asset saguling_petak_<v>            (Langkah 05: petak A–C, T1, T2)
//            Asset saguling_tambahan_<v>         (Langkah 05b: petak D–F, T3, D1–D3)
//            Asset saguling_ref_<petak>_<T>_vote_<v> (Langkah 06c: label)
//            Asset saguling_peta_T1_<v>          (Langkah 07: cek konsistensi)
// Keluaran : CSV dataset_<T>_<VERSI_DATASET>      satu per tanggal:
//              T1, T2, T3 berisi petak A, B, C;  D1 petak D, D2 petak E, D3 petak F
//            CSV waduk_<T>_<VERSI_DATASET>        (mode 'ekspor_waduk') fitur
//                                                 seluruh waduk tanpa label,
//                                                 untuk peta dan luas akhir
//
// PERAN DATA DI NOTEBOOK 11
//   Latih : A–C pada T1, T2  +  D pada D1, E pada D2, F pada D3
//   Uji   : A–C pada T3 (tidak pernah dipakai melatih)
//
// TIGA MODE (jalankan berurutan):
//   'periksa'      Tampilkan fitur dan label di peta, jumlah piksel per
//                  kelas, dan uji konsistensi masker PCD dengan Langkah 07.
//   'ekspor'       Buat task CSV dataset petak untuk setiap tanggal di KODE.
//   'ekspor_waduk' Buat task CSV fitur seluruh waduk untuk KODE_WADUK.
//
// HUBUNGAN DENGAN NASKAH
//   Fitur F0–F3 = Tabel III Naskah 2. Masker waduk dan peta air PCD
//   berasal dari konfigurasi segmentasi TERBAIK hasil Langkah 08
//   (Naskah 1), sehingga parameter di bagian 0 HARUS sama dengan nilai
//   final Langkah 07 (Excel Tabel 8). Mode 'periksa' mengujinya.
//
// DEFINISI LABEL (kolom 'label')
//    0 = air terbuka      1 = eceng gondok      2 = KJA
//    3 = di luar permukaan waduk (r_waduk = 0)
//   -1 = di dalam waduk tetapi tidak ada kelas yang mencapai 3 suara
//        (misalnya suara 2-2-1). Dikeluarkan dari pelatihan dan pengujian.
//   Kolom 'sepakat' = jumlah penilai yang memilih label tersebut (3, 4, 5).
//   Semua tanggal berlabel sebelum PLTS terapung (Oktober 2025). Untuk
//   peta ilustrasi kondisi terbaru (ILUSTRASI), area PLTS dimasker
//   dengan lapisan Geometry Imports bernama 'plts'.
//
// CATATAN TEKNIS
//   Console hanya memuat beberapa agregasi kecil (satu per tanggal),
//   agar tidak memicu "Too many concurrent aggregations". Pekerjaan berat
//   dilakukan lewat Export (tab Tasks).
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var MODE = 'periksa';            // 'periksa' | 'ekspor' | 'ekspor_waduk'
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK   = 'v1';        // dibaca (Langkah 05)
var VERSI_TAMBAHAN = 'v1';       // dibaca (Langkah 05b)
var VERSI_VOTE    = 'v2';        // dibaca (Langkah 06c)
var VERSI_PETA    = 'v2';        // dibaca untuk cek konsistensi (Langkah 07, 26 konfigurasi)
var VERSI_DATASET = 'v2';        // ditulis langkah ini (nama CSV); v2 = label vote v2

var KODE = ['T1', 'T2', 'T3', 'D1', 'D2', 'D3'];   // tanggal yang diekspor dengan label
var PETAK_KODE = {A: ['T1', 'T2', 'T3'], B: ['T1', 'T2', 'T3'], C: ['T1', 'T2', 'T3'],
                  D: ['D1'], E: ['D2'], F: ['D3']};
var KODE_WADUK = ['T3'];         // tanggal untuk peta seluruh waduk (mode 'ekspor_waduk')
var ILUSTRASI = '';              // opsional: tanggal terbaru 'YYYY-MM-DD' untuk peta
                                 // ilustrasi; area PLTS dimasker dengan lapisan 'plts'
var TAMPIL = {petak: 'B', kode: 'T1'};

// Konfigurasi segmentasi TERBAIK dari Langkah 09 (peringkat 1 pada data LATIH).
// indeks: NDWI | MNDWI | NDVI | GRAY | PCA1; ambang: tetap | otsu | canny
// (ambang 'tetap' hanya untuk NDWI, MNDWI, NDVI).
var TERBAIK = {indeks: 'MNDWI', ambang: 'canny'};

// Parameter segmentasi: SALIN dari Langkah 07 (nilai final, Excel Tabel 8).
var BUFFER_OTSU_M = 500;
var TAU_C   = 0.3;
var SIGMA   = 1;
var L_MIN   = 10;
var RB_PX   = 3;
var R_CLOSE = 1;
var A_MAX   = 1024;
var SKALA_GRAY = 0.3;
var SKALA_PCA  = 3;

// Parameter ekstraksi fitur (Tabel III Naskah 2).
var RAD_SD     = 2;    // jendela simpangan baku lokal: (2*2+1) = 5x5 piksel 10 m
var GLCM_SIZE  = 1;    // jendela GLCM: 3x3 piksel 10 m
var GLCM_LEVEL = 64;   // jumlah tingkat keabuan setelah kuantisasi NIR
var NIR_MAX    = 4000; // reflektansi NIR (x10000) maksimum sebelum kuantisasi
var TAU_C_FITUR = 0.3; // ambang Canny pada NDVI 10 m untuk kepadatan tepi
var RAD_TEPI   = 2;    // jendela kepadatan tepi: 5x5 piksel 10 m
var R_TOPHAT   = 2;    // jari-jari elemen struktur top-hat (piksel 10 m)

var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);
var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];
var P10 = ee.Projection(CRS).atScale(10);
var P20 = ee.Projection(CRS).atScale(20);


// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
var petakFC = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var TANGGAL = {
  T1: ee.String(petakFC.first().get('t1')),
  T2: ee.String(petakFC.first().get('t2'))
};
var idTambahan = ASSET + 'saguling_tambahan_' + VERSI_TAMBAHAN;
var adaTambahan = false;
try { adaTambahan = ee.data.getAsset(idTambahan) !== null; } catch (e) { adaTambahan = false; }
var tambahan = adaTambahan ? ee.FeatureCollection(idTambahan) : ee.FeatureCollection([]);
if (adaTambahan) {
  var fTgl = ee.Feature(tambahan.filter(ee.Filter.eq('jenis', 'tanggal')).first());
  ['T3', 'D1', 'D2', 'D3'].forEach(function (k) { TANGGAL[k] = ee.String(fTgl.get(k.toLowerCase())); });
}
if (ILUSTRASI !== '') TANGGAL.IL = ee.String(ILUSTRASI);
var semuaKode = KODE.concat(KODE_WADUK);
semuaKode.forEach(function (k) {
  if (!(k in TANGGAL)) throw new Error('Tanggal ' + k + ' belum ada. Jalankan Langkah 05b (mode simpan) dulu.');
});
// Poligon PLTS (Geometry Imports 'plts'), hanya untuk peta ILUSTRASI.
var poligonPlts = (typeof plts !== 'undefined') ? ee.FeatureCollection(plts) : ee.FeatureCollection([]);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);
var L = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('max_extent')
  .unmask(0).eq(1).reproject(P20);
var daerahHist = L.focalMax({radius: BUFFER_OTSU_M, units: 'meters'}).reproject(P20);

function utama(id) { return ['A', 'B', 'C'].indexOf(id) >= 0; }
function geomPetak(id) {
  var fc = utama(id) ? petakFC : tambahan.filter(ee.Filter.eq('jenis', 'petak'));
  return fc.filter(ee.Filter.eq('id', id)).geometry();
}
// Petak yang punya label pada tanggal tertentu, misalnya D1 -> D, E, F.
function petakUntuk(kode) {
  return Object.keys(PETAK_KODE).filter(function (id) { return PETAK_KODE[id].indexOf(kode) >= 0; });
}
function mosaik(tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic();
}
function maskerBersih(scl) {
  return scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
}
// Rata-rata 2x2 piksel 10 m menjadi 1 piksel 20 m.
function ke20(img10) {
  return img10.setDefaultProjection(P10)
    .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 16}).reproject(P20);
}


// ---------------------------------------------------------------------
// 1b. TRANSFORMASI SATU KANAL (SALINAN PERSIS DARI LANGKAH 07 BAGIAN 1b)
// ---------------------------------------------------------------------
var PITA = ['B2', 'B3', 'B4', 'B8', 'B5', 'B6', 'B7', 'B8A', 'B11', 'B12'];
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

var konfTerbaik = KONF.filter(function (c) {
  return c.indeks === TERBAIK.indeks && c.kunci === TERBAIK.ambang;
});
if (konfTerbaik.length !== 2) {
  throw new Error('TERBAIK tidak dikenal: ' + JSON.stringify(TERBAIK) +
    '. Ambang tetap hanya untuk NDWI, MNDWI, NDVI.');
}


// ---------------------------------------------------------------------
// 2. SEGMENTASI (SALINAN FUNGSI LANGKAH 07) -> masker waduk dan peta air
// ---------------------------------------------------------------------
function otsu(hist) {
  hist = ee.Dictionary(hist);
  var counts = ee.Array(hist.get('histogram'));
  var means = ee.Array(hist.get('bucketMeans'));
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
  return ee.Number(kandidat.sort(ee.Array(bss)).get([-1]));
}
function histogram(idx, masker) {
  return idx.updateMask(masker).reduceRegion({
    reducer: ee.Reducer.histogram({maxBuckets: 256}),
    geometry: AOI, crs: CRS, crsTransform: GRID, maxPixels: 1e10, tileScale: 4
  }).get('idx');
}
function ambang(idx) {
  if (TERBAIK.ambang === 'tetap') return ee.Number(0);
  if (TERBAIK.ambang === 'otsu') return otsu(histogram(idx, daerahHist));
  var tepi = ee.Algorithms.CannyEdgeDetector({image: idx.reproject(P20), threshold: TAU_C, sigma: SIGMA})
    .gt(0).reproject(P20);
  var panjang = tepi.selfMask().connectedPixelCount(256, true).reproject(P20);
  var pita = panjang.gte(L_MIN).unmask(0)
    .focalMax({radius: RB_PX, kernelType: 'square', units: 'pixels'}).reproject(P20).and(daerahHist);
  var hist = histogram(idx, pita);
  return ee.Number(ee.Algorithms.If(hist, otsu(hist), -9));
}
function pascaproses(w) {
  var tutup = w
    .focalMax({radius: R_CLOSE, kernelType: 'circle', units: 'pixels'}).reproject(P20)
    .focalMin({radius: R_CLOSE, kernelType: 'circle', units: 'pixels'}).reproject(P20);
  var ukuran = tutup.not().selfMask().connectedPixelCount(A_MAX, false).reproject(P20);
  var lubang = ukuran.lt(A_MAX).unmask(0);
  return tutup.or(lubang).and(L);
}


// ---------------------------------------------------------------------
// 3. EKSTRAKSI FITUR (Tabel III Naskah 2)
//    F0 pita reflektansi      : B2 B3 B4 B8 B5 B6 B7 B8A B11 B12
//    F1 indeks spektral       : ndwi, mndwi, ndvi
//    F2 tekstur dan tepi      : sd_nir, glcm_kontras, glcm_homogen,
//                               glcm_entropi, kepadatan_tepi
//    F3 morfologi dan bentuk  : tophat_putih, tophat_hitam,
//                               luas_komponen, jarak_air
//    Kolom bantu              : air_pcd, waduk_pcd, bersih
// ---------------------------------------------------------------------
function fitur(kode) {
  var m = mosaik(TANGGAL[kode]);
  var bersih = maskerBersih(m.select('SCL').setDefaultProjection(P20).reproject(P20));

  // F0 — reflektansi (dibagi 10000). Pita 10 m dirata-rata ke 20 m.
  var b10 = ke20(m.select(['B2', 'B3', 'B4', 'B8']));
  var b20 = m.select(['B5', 'B6', 'B7', 'B8A', 'B11', 'B12']).setDefaultProjection(P20).reproject(P20);
  var F0 = b10.addBands(b20).toFloat().divide(10000);

  // F1 — indeks (operasi titik antarpita), dihitung pada 20 m.
  var F1 = ee.Image.cat(
    F0.normalizedDifference(['B3', 'B8']).rename('ndwi'),
    F0.normalizedDifference(['B3', 'B11']).rename('mndwi'),
    F0.normalizedDifference(['B8', 'B4']).rename('ndvi'));

  // F2 — tekstur dan tepi dari pita 10 m, lalu dirata-rata ke 20 m.
  var nir10 = m.select('B8').setDefaultProjection(P10).reproject(P10);
  var sd = nir10.toFloat().divide(10000)
    .reduceNeighborhood({reducer: ee.Reducer.stdDev(),
      kernel: ee.Kernel.square(RAD_SD, 'pixels')}).reproject(P10).rename('sd_nir');
  var q = nir10.min(NIR_MAX).divide(NIR_MAX).multiply(GLCM_LEVEL - 1).round().toInt().rename('q');
  var glcm = q.glcmTexture({size: GLCM_SIZE}).reproject(P10)
    .select(['q_contrast', 'q_idm', 'q_ent'], ['glcm_kontras', 'glcm_homogen', 'glcm_entropi']);
  var ndvi10 = m.select(['B8', 'B4']).setDefaultProjection(P10).reproject(P10)
    .normalizedDifference(['B8', 'B4']);
  var tepi10 = ee.Algorithms.CannyEdgeDetector({image: ndvi10, threshold: TAU_C_FITUR, sigma: SIGMA})
    .gt(0).reproject(P10);
  var kepadatan = tepi10.toFloat()
    .reduceNeighborhood({reducer: ee.Reducer.mean(), kernel: ee.Kernel.square(RAD_TEPI, 'pixels')})
    .reproject(P10).rename('kepadatan_tepi');
  var F2 = ke20(sd.addBands(glcm).addBands(kepadatan));

  // F3 — morfologi: top-hat pada NIR 10 m (objek kecil terang/gelap).
  var nirF = nir10.toFloat().divide(10000);
  var buka = nirF.focalMin({radius: R_TOPHAT, kernelType: 'circle', units: 'pixels'}).reproject(P10)
    .focalMax({radius: R_TOPHAT, kernelType: 'circle', units: 'pixels'}).reproject(P10);
  var tutup = nirF.focalMax({radius: R_TOPHAT, kernelType: 'circle', units: 'pixels'}).reproject(P10)
    .focalMin({radius: R_TOPHAT, kernelType: 'circle', units: 'pixels'}).reproject(P10);
  var tophat = ke20(ee.Image.cat(nirF.subtract(buka).rename('tophat_putih'),
    tutup.subtract(nirF).rename('tophat_hitam')));

  // F3 — bentuk dari hasil segmentasi terbaik:
  //   air_pcd   = peta air tanpa pascaproses (kanal > ambang, dibatasi L)
  //   waduk_pcd = peta setelah closing + hole filling (masker permukaan waduk)
  //   kandidat  = waduk_pcd DAN BUKAN air_pcd (lubang yang terisi = objek apung)
  var idx = transformasi(F0, TERBAIK.indeks, bersih).idx;   // kanal 'air tinggi'
  var t = ambang(idx);
  var w = idx.gt(t).unmask(0);
  var airPcd = w.and(L).rename('air_pcd');
  var wadukPcd = pascaproses(w).rename('waduk_pcd');
  var kandidat = wadukPcd.and(airPcd.not());
  var luas = kandidat.selfMask().connectedPixelCount(1024, false).reproject(P20)
    .unmask(0).rename('luas_komponen');          // piksel 20 m; 0 = bukan kandidat
  var jarak = airPcd.fastDistanceTransform(256).sqrt().multiply(20)
    .reproject(P20).rename('jarak_air');         // meter ke piksel air terdekat

  var xy = ee.Image.pixelCoordinates(P20).rename(['x', 'y']);
  return {
    img: ee.Image.cat(F0, F1, F2, tophat, luas, jarak, airPcd, wadukPcd,
      bersih.rename('bersih'), xy).updateMask(bersih),
    ambang: t, idx: idx
  };
}

var KOLOM_FITUR = ['B2', 'B3', 'B4', 'B8', 'B5', 'B6', 'B7', 'B8A', 'B11', 'B12',
  'ndwi', 'mndwi', 'ndvi',
  'sd_nir', 'glcm_kontras', 'glcm_homogen', 'glcm_entropi', 'kepadatan_tepi',
  'tophat_putih', 'tophat_hitam', 'luas_komponen', 'jarak_air'];
var KOLOM_BANTU = ['air_pcd', 'waduk_pcd', 'x', 'y'];


// ---------------------------------------------------------------------
// 4. LABEL DARI REFERENSI VOTING (Langkah 06c)
// ---------------------------------------------------------------------
function pathVote(id, kode) {
  return ASSET + 'saguling_ref_' + id + '_' + kode + '_vote_' + VERSI_VOTE;
}
function label(id, kode) {
  var v = ee.Image(pathVote(id, kode));
  var air = v.select('r_air'), eg = v.select('r_eg'), kja = v.select('r_kja');
  var waduk = v.select('r_waduk');
  var lab = ee.Image(-1)
    .where(air.eq(1), 0).where(eg.eq(1), 1).where(kja.eq(1), 2)
    .where(waduk.eq(0), 3).rename('label');
  var sep = ee.Image(0)
    .where(lab.eq(0), v.select('sepakat_r_air'))
    .where(lab.eq(1), v.select('sepakat_r_eg'))
    .where(lab.eq(2), v.select('sepakat_r_kja'))
    .where(lab.eq(3), v.select('sepakat_r_waduk'))
    .rename('sepakat');
  return lab.addBands(sep).toInt().reproject(P20);
}

// Hentikan bila ada Asset vote yang belum ada.
var hilang = [];
KODE.forEach(function (kode) {
  petakUntuk(kode).forEach(function (id) {
    var ada = false;
    try { ada = ee.data.getAsset(pathVote(id, kode)) !== null; } catch (e) { ada = false; }
    if (!ada) hilang.push('saguling_ref_' + id + '_' + kode + '_vote_' + VERSI_VOTE);
  });
});
if (hilang.length > 0 && MODE !== 'ekspor_waduk') {
  print('Asset label yang belum ada:', hilang);
  throw new Error('Label belum lengkap. Jalankan Langkah 06c (dengan KODE berisi tanggal itu), ' +
    'atau keluarkan tanggal tersebut dari KODE.');
}

// Piksel PLTS dikeluarkan (hanya berpengaruh pada peta ILUSTRASI).
var bukanPlts = ee.Image(1).paint(poligonPlts, 0).reproject(P20);

function samplePetak(id, kode, f) {
  var img = f.img.addBands(label(id, kode));
  return img.sample({
    region: geomPetak(id), projection: P20, scale: 20,
    geometries: false, tileScale: 4
  }).map(function (ft) {
    return ft.set({petak: id, kode: kode, tanggal: TANGGAL[kode]});
  });
}


// ---------------------------------------------------------------------
// 5. MODE
// ---------------------------------------------------------------------
var URUTAN_CSV = ['kode', 'tanggal', 'petak', 'x', 'y', 'label', 'sepakat']
  .concat(KOLOM_FITUR).concat(['air_pcd', 'waduk_pcd']);

if (MODE === 'periksa') {
  var fT = fitur(TAMPIL.kode);
  var g = geomPetak(TAMPIL.petak);
  Map.centerObject(g, 15);
  Map.setOptions('SATELLITE');
  Map.addLayer(fT.img.select(['B8', 'B4', 'B3']).clip(g.buffer(300)), {min: 0, max: 0.4}, 'False color 20 m');
  Map.addLayer(fT.img.select('ndvi').clip(g), {min: -0.5, max: 0.8, palette: ['0571b0', 'f7f7f7', '1a9641']}, 'F1 NDVI', false);
  Map.addLayer(fT.img.select('glcm_kontras').clip(g), {min: 0, max: 50, palette: ['000000', 'ffffff']}, 'F2 GLCM kontras', false);
  Map.addLayer(fT.img.select('kepadatan_tepi').clip(g), {min: 0, max: 0.5, palette: ['000000', 'ffff00']}, 'F2 kepadatan tepi', false);
  Map.addLayer(fT.img.select('tophat_putih').clip(g), {min: 0, max: 0.05, palette: ['000000', 'ff00ff']}, 'F3 top-hat putih', false);
  Map.addLayer(fT.img.select('luas_komponen').selfMask().clip(g), {min: 1, max: 300, palette: ['fee391', 'cc4c02']}, 'F3 luas komponen kandidat', false);
  Map.addLayer(fT.img.select('waduk_pcd').selfMask().clip(g), {palette: ['ff9100'], opacity: 0.4}, 'Masker waduk PCD', false);
  Map.addLayer(fT.img.select('air_pcd').selfMask().clip(g), {palette: ['2166ac'], opacity: 0.5}, 'Air PCD', false);
  if (KODE.indexOf(TAMPIL.kode) >= 0) {
    var lab = label(TAMPIL.petak, TAMPIL.kode).select('label').clip(g);
    Map.addLayer(lab.updateMask(lab.gte(0).and(lab.lte(2))),
      {min: 0, max: 2, palette: ['2166ac', 'e7298a', 'ffffff']}, 'Label: air / eceng gondok / KJA');
  }
  print('Ambang ' + TERBAIK.indeks + ' ' + TERBAIK.ambang + ' pada ' + TAMPIL.kode + ':', fT.ambang);

  // Jumlah piksel per kelas dan tingkat kesepakatan: SATU frequencyHistogram
  // per tanggal. Kode piksel = petak*100 + (label+1)*10 + sepakat, misalnya
  // 224 = petak B, eceng gondok, 4 dari 5 penilai (petak A=1 ... F=6).
  var IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
  KODE.forEach(function (kode) {
    var ids = petakUntuk(kode);
    var kodePiksel = ee.ImageCollection(ids.map(function (id) {
      var l = label(id, kode);
      return l.select('label').add(1).multiply(10).add(l.select('sepakat'))
        .add((IDS.indexOf(id) + 1) * 100).toInt().clip(geomPetak(id)).rename('kode');
    })).mosaic();
    var region = ee.FeatureCollection(ids.map(function (id) { return ee.Feature(geomPetak(id)); })).geometry();
    print('Jumlah piksel ' + kode + ' (petak*100 + (label+1)*10 + sepakat; label 0 air, 1 EG, 2 KJA, ' +
      '3 luar waduk, -1 tanpa kelas):',
      kodePiksel.reduceRegion({reducer: ee.Reducer.frequencyHistogram(), geometry: region,
        crs: CRS, crsTransform: GRID, maxPixels: 1e8}).get('kode'));
  });
  if (KODE.indexOf(TAMPIL.kode) >= 0) {
    print('Contoh 3 baris dataset (' + TAMPIL.petak + ', ' + TAMPIL.kode + '):',
      samplePetak(TAMPIL.petak, TAMPIL.kode, fT).limit(3));
  }

  // Uji konsistensi: masker PCD di skrip ini vs Asset peta Langkah 07 (T1).
  var kTanpa = konfTerbaik[0].k, kDengan = konfTerbaik[1].k;
  var peta07 = ee.Image(ASSET + 'saguling_peta_T1_' + VERSI_PETA);
  var f1 = fitur('T1').img;
  var cocok = ee.Image.cat(
    f1.select('air_pcd').eq(peta07.select(kTanpa)).rename('air'),
    f1.select('waduk_pcd').eq(peta07.select(kDengan)).rename('waduk'));
  print('Kecocokan dengan Langkah 07 (' + kTanpa + ' dan ' + kDengan + ', harus ~1.0):',
    cocok.reduceRegion({reducer: ee.Reducer.mean(), geometry: petakFC.geometry(),
      crs: CRS, crsTransform: GRID, maxPixels: 1e8}));

} else if (MODE === 'ekspor') {
  KODE.forEach(function (kode) {
    var f = fitur(kode);
    var ids = petakUntuk(kode);
    var fc = samplePetak(ids[0], kode, f);
    ids.slice(1).forEach(function (id) { fc = fc.merge(samplePetak(id, kode, f)); });
    Export.table.toDrive({
      collection: fc,
      description: 'dataset_' + kode + '_' + VERSI_DATASET,
      folder: 'PCD_Saguling', fileFormat: 'CSV', selectors: URUTAN_CSV
    });
  });
  print('Tab Tasks -> RUN pada ' + KODE.length + ' task. CSV muncul di Drive/PCD_Saguling.');

} else if (MODE === 'ekspor_waduk') {
  var daftarWaduk = KODE_WADUK.concat(ILUSTRASI !== '' ? ['IL'] : []);
  if (ILUSTRASI !== '' && typeof plts === 'undefined') {
    print('PERINGATAN: ILUSTRASI diisi tetapi lapisan plts belum digambar; PLTS tidak dimasker.');
  }
  daftarWaduk.forEach(function (kode) {
    var f = fitur(kode);
    var img = f.img.updateMask(f.img.select('waduk_pcd')).updateMask(bukanPlts);
    var fc = img.sample({region: AOI, projection: P20, scale: 20, geometries: false, tileScale: 8})
      .map(function (ft) { return ft.set({kode: kode, tanggal: TANGGAL[kode]}); });
    Export.table.toDrive({
      collection: fc,
      description: kode === 'IL' ? 'waduk_ilustrasi_' + ILUSTRASI.replace(/-/g, '') + '_' + VERSI_DATASET
                                 : 'waduk_' + kode + '_' + VERSI_DATASET,
      folder: 'PCD_Saguling', fileFormat: 'CSV',
      selectors: ['kode', 'tanggal', 'x', 'y'].concat(KOLOM_FITUR).concat(['air_pcd', 'waduk_pcd'])
    });
  });
  print('Tab Tasks -> RUN. Ukuran CSV seluruh waduk sekitar puluhan MB.');
}
