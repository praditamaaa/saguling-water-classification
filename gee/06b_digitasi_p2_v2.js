// =====================================================================
// LANGKAH 06b v2 — MENDIGITASI REFERENSI · PENILAI p2 (anggota tim)
// ---------------------------------------------------------------------
// Tujuan   : Membuat data referensi dengan menggambar poligon secara
//            manual, lalu mengubahnya menjadi raster 0/1 pada grid 20 m:
//              petak A, B, C pada T1, T2 (latih/Naskah 1) dan T3 (uji ML)
//              petak D pada D1, E pada D2, F pada D3 (latih tambahan ML)
//            Total 12 kombinasi petak-tanggal per penilai.
// Masukan  : Asset saguling_petak_<v>     (Langkah 05: petak A–C, T1, T2)
//            Asset saguling_tambahan_<v>  (Langkah 05b: petak D–F, T3, D1–D3)
// Keluaran : Asset saguling_ref_<petak>_<T>_p2_v2, masing-masing 4 band:
//              r_air   = air terbuka saja
//              r_waduk = seluruh permukaan waduk (air + objek apung)
//              r_eg    = piksel eceng gondok
//              r_kja   = piksel keramba jaring apung
//            Properti versi_petak menyimpan asal petak (silsilah), dicek di 06c.
// Dipakai  : Langkah 06c (voting lima penilai), 08, dan 10.
//
// FILE INI KHUSUS PENILAI p2
//   Lapisan gambar (Geometry Imports) tersimpan DI DALAM file skrip, jadi
//   setiap penilai punya file sendiri. Jangan membuka file penilai lain.
//
// MENGAPA FILE BARU (v2)
//   Digitasi v2 dilakukan setelah kalibrasi ulang dengan kunci
//   interpretasi citra resolusi tinggi. File baru dipakai agar gambar v1
//   tidak terlihat dan tidak menjadi patokan. JANGAN membuka file v1.
//   Asset v1 tetap disimpan sebagai arsip pembanding.
//
// CARA MENGGAMBAR (alat poligon di kiri atas peta):
//   1. Isi PETAK_ID dan KODE_TGL di bagian 0, lalu Run.
//   2. Buat TIGA lapisan dengan nama persis (huruf besar-kecil sama):
//        air_<petak>_<T>  seluruh permukaan waduk di dalam petak; boleh SATU
//                         poligon besar mengikuti tepi air–darat.
//        eg_<petak>_<T>   hamparan eceng gondok di atas poligon air.
//        kja_<petak>_<T>  batas luar BLOK keramba di atas poligon air.
//      Contoh: air_B_T3, eg_B_T3, kja_B_T3, atau air_E_D2, kja_E_D2.
//      Lapisan eg_ dan kja_ tidak perlu dibuat bila objeknya tidak ada.
//   3. Run lagi untuk melihat pratinjau dan luasnya.
//   Skrip menghitung: kja menang bila tumpang tindih; eg = eg DAN BUKAN kja;
//   r_air = air DAN BUKAN (eg ATAU kja); r_waduk = air ATAU eg ATAU kja.
//
// KOMBINASI YANG DIGAMBAR (12)
//   A, B, C : T1, T2, T3
//   D (eceng gondok, lokasi 2) : D1
//   E (KJA, lokasi 2)          : D2
//   F (eceng gondok, lokasi 3) : D3
//
// ATURAN AGAR REFERENSI INDEPENDEN (lihat Panduan Penilai bagian 11)
//   - Digitasi pada citra Sentinel-2 tanggal yang SAMA (layer di bawah).
//   - Jangan menyalakan layer indeks atau hasil segmentasi.
//   - Basemap satelit TIDAK dipakai; peta dasar ROADMAP. Pengetahuan dari
//     citra tajam diberikan lewat kunci interpretasi saat kalibrasi.
//   - Tepi yang meragukan: ikuti batas piksel 20 m yang lebih dari
//     separuhnya air.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK    = 'v1';      // dibaca (Langkah 05)
var VERSI_TAMBAHAN = 'v1';      // dibaca (Langkah 05b)
var VERSI_REF      = 'p2_v2';  // kode penilai + versi
var PETAK_ID = 'A';             // 'A' 'B' 'C' 'D' 'E' 'F'
var KODE_TGL = 'T1';            // A–C: 'T1' 'T2' 'T3';  D: 'D1', E: 'D2', F: 'D3'

var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];
var P10 = ee.Projection(CRS).atScale(10);
var P20 = ee.Projection(CRS).atScale(20);
var PETAK_KODE = {A: ['T1', 'T2', 'T3'], B: ['T1', 'T2', 'T3'], C: ['T1', 'T2', 'T3'],
                  D: ['D1'], E: ['D2'], F: ['D3']};


// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
var petakUtama = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var TANGGAL = {
  T1: ee.String(petakUtama.first().get('t1')),
  T2: ee.String(petakUtama.first().get('t2'))
};
var idTambahan = ASSET + 'saguling_tambahan_' + VERSI_TAMBAHAN;
var adaTambahan = false;
try { adaTambahan = ee.data.getAsset(idTambahan) !== null; } catch (e) { adaTambahan = false; }
var tambahan = adaTambahan ? ee.FeatureCollection(idTambahan) : ee.FeatureCollection([]);
if (adaTambahan) {
  var fTgl = ee.Feature(tambahan.filter(ee.Filter.eq('jenis', 'tanggal')).first());
  TANGGAL.T3 = ee.String(fTgl.get('t3'));
  TANGGAL.D1 = ee.String(fTgl.get('d1'));
  TANGGAL.D2 = ee.String(fTgl.get('d2'));
  TANGGAL.D3 = ee.String(fTgl.get('d3'));
}
if (!(PETAK_ID in PETAK_KODE) || PETAK_KODE[PETAK_ID].indexOf(KODE_TGL) < 0) {
  throw new Error('Kombinasi ' + PETAK_ID + '_' + KODE_TGL + ' tidak dipakai. Lihat KOMBINASI di atas.');
}
if (!(KODE_TGL in TANGGAL)) {
  throw new Error('Tanggal ' + KODE_TGL + ' belum ada. Jalankan Langkah 05b (mode simpan) dulu.');
}

function utama(id) { return ['A', 'B', 'C'].indexOf(id) >= 0; }
function geomPetak(id) {
  var fc = utama(id) ? petakUtama : tambahan.filter(ee.Filter.eq('jenis', 'petak'));
  return fc.filter(ee.Filter.eq('id', id)).geometry();
}
function silsilahPetak(id) {
  return utama(id) ? VERSI_PETAK : 'tambahan_' + VERSI_TAMBAHAN;
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
function mosaik(tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic();
}
print('Sedang menggambar ' + PETAK_ID + '_' + KODE_TGL + ', tanggal:', TANGGAL[KODE_TGL]);


// ---------------------------------------------------------------------
// 2. TAMPILAN UNTUK DIGITASI
// ---------------------------------------------------------------------
var gAktif = geomPetak(PETAK_ID);
var konteks = gAktif.buffer(300).bounds();
var m = mosaik(TANGGAL[KODE_TGL]);

Map.centerObject(gAktif, 16);
Map.setOptions('ROADMAP');   // v2: tanpa basemap satelit
Map.addLayer(m.clip(konteks), {bands: ['B4', 'B3', 'B2'], min: 0, max: 2500, gamma: 1.2},
  KODE_TGL + ' · true color 10 m');
Map.addLayer(m.clip(konteks), {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
  KODE_TGL + ' · false color 10 m (eceng gondok merah)', false);
Map.addLayer(m.select(['B11', 'B8', 'B4']).setDefaultProjection(P20).reproject(P20).clip(konteks),
  {min: 0, max: 4000}, KODE_TGL + ' · SWIR 20 m (air gelap)', false);
Map.addLayer(m.select(['B8', 'B4', 'B3']).setDefaultProjection(P10)
    .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 16}).reproject(P20).clip(konteks),
  {min: 0, max: 4000}, KODE_TGL + ' · false color 20 m (grid penilaian)', false);
Map.addLayer(ee.FeatureCollection([ee.Feature(gAktif)]).style({
  color: 'ffff00', fillColor: '00000000', width: 2}), {}, 'Petak ' + PETAK_ID);


// ---------------------------------------------------------------------
// 3. LAPISAN YANG SUDAH DIGAMBAR [air, eceng gondok, KJA]
//    typeof dipakai agar skrip tetap jalan walau lapisan belum dibuat.
// ---------------------------------------------------------------------
var LAPISAN = {
  A_T1: [typeof air_A_T1 !== 'undefined' ? air_A_T1 : null,
         typeof eg_A_T1  !== 'undefined' ? eg_A_T1  : null,
         typeof kja_A_T1 !== 'undefined' ? kja_A_T1 : null],
  A_T2: [typeof air_A_T2 !== 'undefined' ? air_A_T2 : null,
         typeof eg_A_T2  !== 'undefined' ? eg_A_T2  : null,
         typeof kja_A_T2 !== 'undefined' ? kja_A_T2 : null],
  A_T3: [typeof air_A_T3 !== 'undefined' ? air_A_T3 : null,
         typeof eg_A_T3  !== 'undefined' ? eg_A_T3  : null,
         typeof kja_A_T3 !== 'undefined' ? kja_A_T3 : null],
  B_T1: [typeof air_B_T1 !== 'undefined' ? air_B_T1 : null,
         typeof eg_B_T1  !== 'undefined' ? eg_B_T1  : null,
         typeof kja_B_T1 !== 'undefined' ? kja_B_T1 : null],
  B_T2: [typeof air_B_T2 !== 'undefined' ? air_B_T2 : null,
         typeof eg_B_T2  !== 'undefined' ? eg_B_T2  : null,
         typeof kja_B_T2 !== 'undefined' ? kja_B_T2 : null],
  B_T3: [typeof air_B_T3 !== 'undefined' ? air_B_T3 : null,
         typeof eg_B_T3  !== 'undefined' ? eg_B_T3  : null,
         typeof kja_B_T3 !== 'undefined' ? kja_B_T3 : null],
  C_T1: [typeof air_C_T1 !== 'undefined' ? air_C_T1 : null,
         typeof eg_C_T1  !== 'undefined' ? eg_C_T1  : null,
         typeof kja_C_T1 !== 'undefined' ? kja_C_T1 : null],
  C_T2: [typeof air_C_T2 !== 'undefined' ? air_C_T2 : null,
         typeof eg_C_T2  !== 'undefined' ? eg_C_T2  : null,
         typeof kja_C_T2 !== 'undefined' ? kja_C_T2 : null],
  C_T3: [typeof air_C_T3 !== 'undefined' ? air_C_T3 : null,
         typeof eg_C_T3  !== 'undefined' ? eg_C_T3  : null,
         typeof kja_C_T3 !== 'undefined' ? kja_C_T3 : null],
  D_D1: [typeof air_D_D1 !== 'undefined' ? air_D_D1 : null,
         typeof eg_D_D1  !== 'undefined' ? eg_D_D1  : null,
         typeof kja_D_D1 !== 'undefined' ? kja_D_D1 : null],
  E_D2: [typeof air_E_D2 !== 'undefined' ? air_E_D2 : null,
         typeof eg_E_D2  !== 'undefined' ? eg_E_D2  : null,
         typeof kja_E_D2 !== 'undefined' ? kja_E_D2 : null],
  F_D3: [typeof air_F_D3 !== 'undefined' ? air_F_D3 : null,
         typeof eg_F_D3  !== 'undefined' ? eg_F_D3  : null,
         typeof kja_F_D3 !== 'undefined' ? kja_F_D3 : null]
};

function keFC(x) {
  return x === null ? ee.FeatureCollection([]) : ee.FeatureCollection(x);
}

// paint() memberi 1 pada piksel yang PUSATNYA di dalam poligon; hasil
// dipaksa ke grid 20 m dan dipotong ke petak.
function rasterReferensi(kunci) {
  var air   = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][0]), 1);
  var kja   = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][2]), 1);
  var eg    = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][1]), 1).and(kja.not());
  var apung = eg.or(kja);
  return ee.Image.cat(
    air.and(apung.not()).rename('r_air'),
    air.or(apung).rename('r_waduk'),
    eg.rename('r_eg'),
    kja.rename('r_kja')
  ).toByte().reproject(P20).clip(geomPetak(kunci.slice(0, 1)));
}


// ---------------------------------------------------------------------
// 4. PRATINJAU KOMBINASI AKTIF (satu reduceRegion)
// ---------------------------------------------------------------------
var kunciAktif = PETAK_ID + '_' + KODE_TGL;
if (LAPISAN[kunciAktif][0] !== null) {
  var ref = rasterReferensi(kunciAktif);
  Map.addLayer(ref.select('r_waduk').selfMask(), {palette: ['ff9100'], opacity: 0.5},
    'Pratinjau r_waduk (oranye)', false);
  Map.addLayer(ref.select('r_air').selfMask(), {palette: ['2166ac'], opacity: 0.6},
    'Pratinjau r_air (biru)', false);
  Map.addLayer(ref.select('r_eg').selfMask(), {palette: ['e7298a'], opacity: 0.7},
    'Pratinjau eceng gondok (magenta)', false);
  Map.addLayer(ref.select('r_kja').selfMask(), {palette: ['ffffff'], opacity: 0.8},
    'Pratinjau KJA (putih)', false);
  print('Luas referensi ' + kunciAktif + ' (ha):',
    ref.multiply(ee.Image.pixelArea()).divide(1e4).reduceRegion({
      reducer: ee.Reducer.sum(), geometry: gAktif, crs: CRS, crsTransform: GRID
    }));
} else {
  print('Lapisan air_' + kunciAktif + ' belum ada. Gambar dulu, lalu Run lagi.');
}


// ---------------------------------------------------------------------
// 5. EKSPOR SEMUA KOMBINASI YANG SUDAH DIGAMBAR
// ---------------------------------------------------------------------
var dibuat = [];
Object.keys(LAPISAN).forEach(function (kunci) {
  if (LAPISAN[kunci][0] === null) return;
  if (!(kunci.slice(2) in TANGGAL)) return;   // tanggal belum disimpan di 05b
  var id = kunci.slice(0, 1);
  Export.image.toAsset({
    image: rasterReferensi(kunci).set({
      versi_petak: silsilahPetak(id), versi_ref: VERSI_REF,
      tanggal: TANGGAL[kunci.slice(2)]
    }),
    description: 'ref_' + kunci + '_' + VERSI_REF,
    assetId: ASSET + 'saguling_ref_' + kunci + '_' + VERSI_REF,
    region: geomPetak(id),
    crs: CRS, crsTransform: GRID,
    pyramidingPolicy: {'.default': 'mode'}
  });
  dibuat.push(kunci);
});
print('Task ekspor dibuat untuk ' + dibuat.length + ' dari 12 kombinasi:', dibuat);
