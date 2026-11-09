// =====================================================================
// LANGKAH 06b — MENDIGITASI REFERENSI · PENILAI p5 (luar tim)
// ---------------------------------------------------------------------
// Tujuan   : Membuat data referensi untuk 3 petak x 2 tanggal dengan
//            menggambar poligon secara manual, lalu mengubahnya menjadi
//            raster 0/1 pada grid 20 m yang sama dengan peta hasil.
// Masukan  : Asset saguling_petak_<versi> (Langkah 05; memuat T1 dan T2).
// Keluaran : Asset saguling_ref_<petak>_<T>_<versi>, masing-masing 4 band:
//              r_air   = air terbuka saja
//              r_waduk = seluruh permukaan waduk (air + objek apung)
//              r_eg    = piksel eceng gondok (untuk menelusuri sumber galat)
//              r_kja   = piksel keramba jaring apung (idem)
//            Setiap Asset menyimpan properti versi_petak, agar Langkah 08
//            bisa memeriksa bahwa referensi dan petak berasal dari versi sama.
//
// FILE INI KHUSUS PENILAI p5
//   Lapisan gambar (Geometry Imports) tersimpan DI DALAM file skrip. Bila
//   lima penilai menggambar di satu file, poligon mereka bercampur dan
//   saling terlihat. Karena itu setiap penilai punya file sendiri:
//   06b_digitasi_p1 ... 06b_digitasi_p5. Isinya sama; yang berbeda hanya
//   VERSI_REF, sehingga nama Asset menjadi saguling_ref_<petak>_<T>_p5_v1.
//   Jangan membuka file penilai lain. Lihat dokumen Panduan Penilai.
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
// Dipakai  : Langkah 06c (voting lima penilai), lalu Langkah 08.
//
// CARA MENGGAMBAR (alat poligon di kiri atas peta):
//   Untuk tiap petak dan tanggal, buat TIGA lapisan dengan nama persis:
//     air_<petak>_<T>  seluruh permukaan waduk di dalam petak. Boleh
//                      SATU poligon besar mengikuti tepi air–darat;
//                      objek apung ikut tercakup.
//     eg_<petak>_<T>   hamparan eceng gondok DI ATAS poligon air.
//                      Tidak perlu dibuat bila tidak ada.
//     kja_<petak>_<T>  batas luar blok keramba DI ATAS poligon air.
//                      Tidak perlu dibuat bila tidak ada.
//   Contoh: air_B_T1, eg_B_T1, kja_B_T1.  (Klik "+ new layer", lalu ganti
//   nama lewat ikon roda gigi di bagian Imports.)
//   Skrip menghitung sendiri:
//     kja     = poligon kja (keramba menang bila tumpang tindih)
//     eg      = poligon eg DAN BUKAN kja
//     apung   = eg ATAU kja
//     r_air   = air DAN BUKAN apung
//     r_waduk = air ATAU apung
//
// ATURAN AGAR REFERENSI INDEPENDEN
//   - Digitasi pada citra Sentinel-2 tanggal yang SAMA (layer di bawah).
//   - Jangan menyalakan layer indeks atau hasil segmentasi.
//   - Basemap resolusi tinggi hanya untuk mengenali JENIS objek, bukan
//     untuk menarik garis tepi air (tanggalnya berbeda).
//   - Tepi yang meragukan: ikuti batas piksel 20 m yang lebih dari
//     separuhnya air.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK = 'v1';   // versi Asset petak yang DIBACA (dari Langkah 05)
var VERSI_REF   = 'p5_v1';  // kode penilai + versi. Ubah hanya bila menggambar ulang ('p5_v2')
var PETAK_ID = 'A';      // petak yang sedang digambar: 'A', 'B', atau 'C'
var KODE_TGL = 'T1';     // tanggal yang sedang digambar: 'T1' atau 'T2'

var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];                 // grid 20 m UTM, sejajar Sentinel-2
var P10 = ee.Projection(CRS).atScale(10);
var P20 = ee.Projection(CRS).atScale(20);


// ---------------------------------------------------------------------
// 1. DATA DARI ASSET LANGKAH 05
// ---------------------------------------------------------------------
var petakFC = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var TANGGAL = {
  T1: ee.String(petakFC.first().get('t1')),
  T2: ee.String(petakFC.first().get('t2'))
};
print('T1 dan T2 dari Asset:', TANGGAL.T1, TANGGAL.T2);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(petakFC.geometry());
function mosaik(tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic();
}
function geomPetak(id) {
  return petakFC.filter(ee.Filter.eq('id', id)).geometry();
}


// ---------------------------------------------------------------------
// 2. TAMPILAN UNTUK DIGITASI
// ---------------------------------------------------------------------
var gAktif = geomPetak(PETAK_ID);
var konteks = gAktif.buffer(300).bounds();     // sedikit area di luar petak
var m = mosaik(TANGGAL[KODE_TGL]);

Map.centerObject(gAktif, 16);
Map.setOptions('SATELLITE');
// 10 m: bentuk objek lebih jelas. 20 m: piksel yang benar-benar dinilai.
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
// 3. LAPISAN YANG SUDAH DIGAMBAR
//    typeof dipakai agar skrip tetap jalan walau lapisan belum dibuat.
// ---------------------------------------------------------------------
// Urutan isi tiap kunci: [air, eceng gondok, KJA].
var LAPISAN = {
  A_T1: [typeof air_A_T1 !== 'undefined' ? air_A_T1 : null,
         typeof eg_A_T1  !== 'undefined' ? eg_A_T1  : null,
         typeof kja_A_T1 !== 'undefined' ? kja_A_T1 : null],
  A_T2: [typeof air_A_T2 !== 'undefined' ? air_A_T2 : null,
         typeof eg_A_T2  !== 'undefined' ? eg_A_T2  : null,
         typeof kja_A_T2 !== 'undefined' ? kja_A_T2 : null],
  B_T1: [typeof air_B_T1 !== 'undefined' ? air_B_T1 : null,
         typeof eg_B_T1  !== 'undefined' ? eg_B_T1  : null,
         typeof kja_B_T1 !== 'undefined' ? kja_B_T1 : null],
  B_T2: [typeof air_B_T2 !== 'undefined' ? air_B_T2 : null,
         typeof eg_B_T2  !== 'undefined' ? eg_B_T2  : null,
         typeof kja_B_T2 !== 'undefined' ? kja_B_T2 : null],
  C_T1: [typeof air_C_T1 !== 'undefined' ? air_C_T1 : null,
         typeof eg_C_T1  !== 'undefined' ? eg_C_T1  : null,
         typeof kja_C_T1 !== 'undefined' ? kja_C_T1 : null],
  C_T2: [typeof air_C_T2 !== 'undefined' ? air_C_T2 : null,
         typeof eg_C_T2  !== 'undefined' ? eg_C_T2  : null,
         typeof kja_C_T2 !== 'undefined' ? kja_C_T2 : null]
};

function keFC(x) {
  return x === null ? ee.FeatureCollection([]) : ee.FeatureCollection(x);
}

// Rasterisasi: paint() memberi nilai 1 pada piksel yang PUSATNYA ada di
// dalam poligon. Hasilnya dipaksa ke grid 20 m dan dipotong ke petak.
// Bila eceng gondok menempel atau menutupi keramba, piksel itu dihitung KJA.
function rasterReferensi(kunci) {
  var air   = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][0]), 1);
  var kja   = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][2]), 1);
  var eg    = ee.Image(0).byte().paint(keFC(LAPISAN[kunci][1]), 1).and(kja.not());
  var apung = eg.or(kja);
  return ee.Image.cat(
    air.and(apung.not()).rename('r_air'),     // air terbuka
    air.or(apung).rename('r_waduk'),          // seluruh permukaan waduk
    eg.rename('r_eg'),                        // eceng gondok
    kja.rename('r_kja')                       // keramba jaring apung
  ).toByte().reproject(P20).clip(geomPetak(kunci.slice(0, 1)));
}


// ---------------------------------------------------------------------
// 4. PRATINJAU UNTUK PETAK DAN TANGGAL AKTIF
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
// 5. EKSPOR SEMUA REFERENSI YANG SUDAH ADA
//    Tiap kombinasi yang punya lapisan air_* menjadi satu task.
// ---------------------------------------------------------------------
Object.keys(LAPISAN).forEach(function (kunci) {
  if (LAPISAN[kunci][0] === null) return;
  Export.image.toAsset({
    image: rasterReferensi(kunci).set({versi_petak: VERSI_PETAK, versi_ref: VERSI_REF}),
    description: 'ref_' + kunci + '_' + VERSI_REF,
    assetId: ASSET + 'saguling_ref_' + kunci + '_' + VERSI_REF,
    region: geomPetak(kunci.slice(0, 1)),
    crs: CRS, crsTransform: GRID,
    pyramidingPolicy: {'.default': 'mode'}
  });
});
print('Task ekspor dibuat untuk:', Object.keys(LAPISAN).filter(function (k) {
  return LAPISAN[k][0] !== null;
}));
