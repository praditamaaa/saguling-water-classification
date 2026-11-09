// =====================================================================
// LANGKAH 08 — MENGEVALUASI AKURASI
// ---------------------------------------------------------------------
// Tujuan   : Membandingkan 24 peta hasil (Langkah 07) dengan referensi
//            hasil voting lima penilai (Langkah 06c), piksel demi piksel.
// Masukan  : Asset saguling_petak_<v>, saguling_peta_T1/T2_<v>,
//            saguling_ref_<petak>_<T>_vote_<v>.
// Keluaran : - Console: tabel silsilah versi (referensi cocok dengan petak?).
//            - CSV 08_evaluasi_<versi ref>_<versi peta>.csv (432 baris =
//              3 petak x 2 tanggal x 12 konfigurasi x 2 referensi x
//              3 tingkat kesepakatan)
//            - Peta galat dan 4 tautan PNG untuk Gambar 2 naskah.
// Dipakai  : Langkah 09 dan Excel Tabel 11–12.
//
// TINGKAT KESEPAKATAN (kolom 'tingkat')
//   semua = semua piksel petak
//   min4  = hanya piksel yang disepakati minimal 4 dari 5 penilai
//   penuh = hanya piksel yang disepakati 5 dari 5 penilai
//   Bila peringkat konfigurasi sama di ketiga tingkat, kesimpulan tidak
//   bergantung pada piksel yang diperdebatkan penilai.
//
// SUMBER GALAT PER JENIS OBJEK (kolom eg_* dan kja_*, tingkat 'semua')
//   eg_n            = jumlah piksel eceng gondok di referensi
//   eg_terbaca_air  = bagian piksel eceng gondok yang dipetakan sebagai air
//   kja_n, kja_terbaca_air = idem untuk KJA
//   Untuk r_waduk, makin tinggi makin baik (permukaan waduk di bawah objek
//   apung ikut terpetakan). Untuk r_air, makin rendah makin baik.
//
// Istilah (persamaan 17–20 naskah):
//   TP = air terdeteksi benar        FP = bukan air dianggap air
//   FN = air yang terlewat           TN = bukan air terdeteksi benar
//   Precision = TP/(TP+FP)           Recall = TP/(TP+FN)
//   F1  = 2TP/(2TP+FP+FN)            IoU = TP/(TP+FP+FN)
//   OA  = (TP+TN)/semua              Bias luas = (FP−FN)/(TP+FN) x 100%
//   Bias negatif = luas air terukur TERLALU KECIL.
//   Nilai -1 = tidak terdefinisi (pembagi nol).
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
//   Langkah ini hanya MEMBACA. Isi tiga versi di bawah sesuai Asset
//   yang ingin dievaluasi bersama.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK = 'v1';   // dari Langkah 05
var VERSI_REF   = 'vote_v1';   // dari Langkah 06c
var VERSI_PETA  = 'v1';        // dari Langkah 07
var N_PENILAI   = 5;
var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];

// Gambar 2: petak, tanggal, konfigurasi, dan referensi yang ditampilkan.
var TAMPIL = {petak: 'B', kode: 'T1', konf: 'K12', ref: 'r_waduk'};

// Piksel dihitung bila jumlah penilai di pihak mayoritas >= min.
var TINGKAT = [
  {t: 'semua', min: 0},
  {t: 'min4',  min: N_PENILAI - 1},
  {t: 'penuh', min: N_PENILAI}
];

var KONF = [
  {k: 'K1', indeks: 'NDWI', metode: 'Tetap 0', pasca: 'Tanpa'},
  {k: 'K2', indeks: 'NDWI', metode: 'Tetap 0', pasca: 'Dengan'},
  {k: 'K3', indeks: 'NDWI', metode: 'Otsu global', pasca: 'Tanpa'},
  {k: 'K4', indeks: 'NDWI', metode: 'Otsu global', pasca: 'Dengan'},
  {k: 'K5', indeks: 'NDWI', metode: 'Canny-Otsu', pasca: 'Tanpa'},
  {k: 'K6', indeks: 'NDWI', metode: 'Canny-Otsu', pasca: 'Dengan'},
  {k: 'K7', indeks: 'MNDWI', metode: 'Tetap 0', pasca: 'Tanpa'},
  {k: 'K8', indeks: 'MNDWI', metode: 'Tetap 0', pasca: 'Dengan'},
  {k: 'K9', indeks: 'MNDWI', metode: 'Otsu global', pasca: 'Tanpa'},
  {k: 'K10', indeks: 'MNDWI', metode: 'Otsu global', pasca: 'Dengan'},
  {k: 'K11', indeks: 'MNDWI', metode: 'Canny-Otsu', pasca: 'Tanpa'},
  {k: 'K12', indeks: 'MNDWI', metode: 'Canny-Otsu', pasca: 'Dengan'}
];
var REF = ['r_air', 'r_waduk'];
var PETAK = ['A', 'B', 'C'];
var KODE = ['T1', 'T2'];


// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
var petakFC = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
function pathRef(kunci) { return ASSET + 'saguling_ref_' + kunci + '_' + VERSI_REF; }
function pathPeta(kode) { return ASSET + 'saguling_peta_' + kode + '_' + VERSI_PETA; }
var TANGGAL = {
  T1: ee.String(petakFC.first().get('t1')),
  T2: ee.String(petakFC.first().get('t2'))
};
function geomPetak(id) {
  return petakFC.filter(ee.Filter.eq('id', id)).geometry();
}
// Pembagian aman: -1 bila pembagi nol.
function bagi(a, b) {
  a = ee.Number(a); b = ee.Number(b);
  return ee.Number(ee.Algorithms.If(b.gt(0), a.divide(b), -1));
}


// ---------------------------------------------------------------------
// 1b. SILSILAH VERSI
//     Setiap referensi menyimpan versi petak tempat ia digambar. Bila ada
//     yang "TIDAK", referensi itu digambar di petak lama: gambar ulang
//     petak tersebut di Langkah 06 dengan versi referensi baru.
//     Peta (Langkah 07) mencakup seluruh waduk, jadi tidak wajib cocok;
//     parameternya dicetak untuk dicatat.
// ---------------------------------------------------------------------
var daftarRef = [];
PETAK.forEach(function (id) {
  KODE.forEach(function (kode) { daftarRef.push(id + '_' + kode); });
});
var silsilah = ee.FeatureCollection(daftarRef.map(function (kunci) {
  var v = ee.Image(pathRef(kunci)).get('versi_petak');
  return ee.Feature(null, {
    referensi: kunci + '_' + VERSI_REF,
    versi_petak_saat_digambar: v,
    cocok: ee.Algorithms.If(ee.Algorithms.IsEqual(v, VERSI_PETAK), 'Ya', 'TIDAK, gambar ulang')
  });
}));
print('Silsilah referensi vs petak ' + VERSI_PETAK + ' (semua harus "Ya"):',
  ui.Chart.feature.byFeature(silsilah, 'referensi',
    ['versi_petak_saat_digambar', 'cocok']).setChartType('Table'));
print('Parameter peta T1 ' + VERSI_PETA + ':', ee.Image(pathPeta('T1')).toDictionary());


// ---------------------------------------------------------------------
// 2. MATRIKS KESALAHAN
//    Agar hemat, untuk tiap petak x tanggal dibuat satu citra berisi
//    12 konfigurasi x 2 referensi x 3 tingkat x TP/FP/FN/TN, ditambah
//    hitungan piksel eceng gondok dan KJA, lalu dijumlahkan SEKALI.
// ---------------------------------------------------------------------
function evaluasi(idPetak, kode) {
  var geom = geomPetak(idPetak);
  var pred = ee.Image(pathPeta(kode));                    // K1..K12
  var ref = ee.Image(pathRef(idPetak + '_' + kode));     // hasil voting
  var valid = pred.select('K1').mask().gt(0);     // piksel tak berawan
  var eg = ref.select('r_eg').unmask(0);
  var kja = ref.select('r_kja').unmask(0);

  var band = [eg.rename('EG_N'), kja.rename('KJA_N')];
  KONF.forEach(function (c) {
    var p = pred.select(c.k).unmask(0);
    band.push(p.and(eg).rename(c.k + '_EG_AIR'));
    band.push(p.and(kja).rename(c.k + '_KJA_AIR'));
    REF.forEach(function (rn) {
      var r = ref.select(rn).unmask(0);
      var sepakat = ref.select('sepakat_' + rn).unmask(0);
      TINGKAT.forEach(function (tk) {
        var m = sepakat.gte(tk.min);
        var pre = c.k + '_' + rn + '_' + tk.t + '_';
        band.push(p.and(r).and(m).rename(pre + 'TP'));
        band.push(p.and(r.not()).and(m).rename(pre + 'FP'));
        band.push(p.not().and(r).and(m).rename(pre + 'FN'));
        band.push(p.not().and(r.not()).and(m).rename(pre + 'TN'));
      });
    });
  });
  var jumlah = ee.Image.cat(band).updateMask(valid).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: geom, crs: CRS, crsTransform: GRID, maxPixels: 1e9
  });
  var egN = ee.Number(jumlah.get('EG_N'));
  var kjaN = ee.Number(jumlah.get('KJA_N'));

  var baris = [];
  KONF.forEach(function (c) {
    var egAir = bagi(jumlah.get(c.k + '_EG_AIR'), egN);
    var kjaAir = bagi(jumlah.get(c.k + '_KJA_AIR'), kjaN);
    REF.forEach(function (rn) {
      TINGKAT.forEach(function (tk) {
        var pre = c.k + '_' + rn + '_' + tk.t + '_';
        var TP = ee.Number(jumlah.get(pre + 'TP'));
        var FP = ee.Number(jumlah.get(pre + 'FP'));
        var FN = ee.Number(jumlah.get(pre + 'FN'));
        var TN = ee.Number(jumlah.get(pre + 'TN'));
        var semua = tk.t === 'semua';
        baris.push(ee.Feature(null, {
          petak: idPetak, kode: kode, tanggal: TANGGAL[kode],
          versi_petak: VERSI_PETAK, versi_ref: VERSI_REF, versi_peta: VERSI_PETA,
          konf: c.k, indeks: c.indeks, metode: c.metode, pasca: c.pasca, referensi: rn,
          tingkat: tk.t,
          TP: TP, FP: FP, FN: FN, TN: TN,
          precision: bagi(TP, TP.add(FP)),
          recall: bagi(TP, TP.add(FN)),
          f1: bagi(TP.multiply(2), TP.multiply(2).add(FP).add(FN)),
          iou: bagi(TP, TP.add(FP).add(FN)),
          oa: bagi(TP.add(TN), TP.add(TN).add(FP).add(FN)),
          bias_luas_pct: bagi(FP.subtract(FN), TP.add(FN)).multiply(100),
          eg_n: semua ? egN : -1,
          eg_terbaca_air: semua ? egAir : -1,
          kja_n: semua ? kjaN : -1,
          kja_terbaca_air: semua ? kjaAir : -1
        }));
      });
    });
  });
  return baris;
}

var semua = [];
PETAK.forEach(function (id) {
  KODE.forEach(function (kode) { semua = semua.concat(evaluasi(id, kode)); });
});
var hasil = ee.FeatureCollection(semua);   // urutan: petak, tanggal, konfigurasi, referensi, tingkat

print('Contoh 12 baris pertama:', hasil.limit(12));
print('IoU terhadap r_air, petak B, T1, semua piksel:', ui.Chart.feature.byFeature(
  hasil.filter(ee.Filter.and(ee.Filter.eq('petak', 'B'), ee.Filter.eq('kode', 'T1'),
    ee.Filter.eq('referensi', 'r_air'), ee.Filter.eq('tingkat', 'semua'))),
  'konf', ['iou']).setChartType('ColumnChart'));

Export.table.toDrive({
  collection: hasil, description: '08_evaluasi_' + VERSI_REF + '_' + VERSI_PETA,
  folder: 'PCD_Saguling', fileFormat: 'CSV',
  selectors: ['petak', 'kode', 'tanggal', 'konf', 'indeks', 'metode', 'pasca', 'referensi',
    'tingkat', 'TP', 'FP', 'FN', 'TN', 'precision', 'recall', 'f1', 'iou', 'oa',
    'bias_luas_pct', 'eg_n', 'eg_terbaca_air', 'kja_n', 'kja_terbaca_air',
    'versi_petak', 'versi_ref', 'versi_peta']
});


// ---------------------------------------------------------------------
// 3. PETA GALAT UNTUK GAMBAR 2
//    0 = TN (putih), 1 = TP (biru muda), 2 = FP (oranye), 3 = FN (ungu)
// ---------------------------------------------------------------------
var gT = geomPetak(TAMPIL.petak);
var predT = ee.Image(pathPeta(TAMPIL.kode)).select(TAMPIL.konf).unmask(0);
var refT = ee.Image(pathRef(TAMPIL.petak + '_' + TAMPIL.kode))
  .select(TAMPIL.ref).unmask(0);
var galat = predT.and(refT).multiply(1)
  .add(predT.and(refT.not()).multiply(2))
  .add(predT.not().and(refT).multiply(3)).clip(gT);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(gT);
var dT = ee.Date(TANGGAL[TAMPIL.kode]);
var citraT = s2.filterDate(dT, dT.advance(1, 'day')).mosaic().clip(gT);

Map.centerObject(gT, 15);
Map.setOptions('SATELLITE');
Map.addLayer(citraT, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000}, '(a) false color');
Map.addLayer(refT.selfMask().clip(gT), {palette: ['ff9100']}, '(b) referensi ' + TAMPIL.ref, false);
Map.addLayer(predT.selfMask().clip(gT), {palette: ['2166ac']}, '(c) hasil ' + TAMPIL.konf, false);
Map.addLayer(galat.selfMask(), {min: 0, max: 3, palette: ['ffffff', 'abd9e9', 'e66100', '5e3c99']},
  '(d) peta galat');

var panel = {
  '(a) false color': citraT.visualize({bands: ['B8', 'B4', 'B3'], min: 0, max: 4000}),
  '(b) referensi': refT.visualize({min: 0, max: 1, palette: ['f2f2f2', 'ff9100']}),
  '(c) hasil': predT.visualize({min: 0, max: 1, palette: ['f2f2f2', '2166ac']}),
  '(d) galat': galat.visualize({min: 0, max: 3, palette: ['f2f2f2', 'abd9e9', 'e66100', '5e3c99']})
};
Object.keys(panel).forEach(function (nama) {
  print('Gambar 2 ' + nama + ' — tautan PNG:', panel[nama].clip(gT).getThumbURL({
    region: gT, dimensions: 500, format: 'png'
  }));
});
print('Legenda peta galat:', 'biru muda = TP, oranye = FP, ungu = FN, putih = TN');
// Kesepakatan antarpenilai sudah dihitung di Langkah 06c.
