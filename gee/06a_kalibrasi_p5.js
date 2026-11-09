// =====================================================================
// LANGKAH 06a — KALIBRASI PENILAI · PENILAI p5 (luar tim)
// ---------------------------------------------------------------------
// Tujuan   : Latihan menggambar di satu petak di luar A, B, dan C agar
//            kelima penilai memahami aturan dengan cara yang sama.
//            Ini BUKAN referensi: tidak diekspor, tidak divoting, tidak
//            dipakai di evaluasi. Hasilnya adalah aturan yang diperjelas
//            di Panduan Penilai bagian 6.
// Masukan  : Asset saguling_petak_<versi> (untuk tanggal T1 dan T2).
// Keluaran : Console: luas latihan (ha) untuk dicatat koordinator.
//
// FILE INI KHUSUS PENILAI p5. Gambar tiga lapisan:
//   air_L  seluruh permukaan waduk di petak latihan
//   eg_L   hamparan eceng gondok di atas air (bila ada)
//   kja_L  batas luar blok keramba di atas air (bila ada)
// Aturan kelas sama dengan Langkah 06b.
//
// KOORDINATOR: isi PUSAT dengan koordinat yang SAMA di kelima file
// 06a_kalibrasi_p1 ... p5 sebelum sesi dimulai.
// =====================================================================

var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK = 'v1';
var PUSAT = null;        // [bujur, lintang] pusat petak latihan, contoh [107.40, -6.90]
var KODE_TGL = 't1';     // 't1' atau 't2' (ulangi di 't2' bila perlu)

if (PUSAT === null) {
  throw new Error('Koordinator belum mengisi PUSAT petak latihan.');
}

var petakFC = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var tgl = ee.Date(ee.String(petakFC.first().get(KODE_TGL)));
var CRS = 'EPSG:32748';
var P20 = ee.Projection(CRS).atScale(20);

// Kotak 1 x 1 km di proyeksi UTM, sama ukurannya dengan petak uji.
// PERBAIKAN: Transformasi titik ke UTM (CRS) terlebih dahulu agar buffer 500 meter 
// dieksekusi dengan mulus tanpa konflik satuan derajat vs meter.
var kotak = ee.Geometry.Point(PUSAT)
  .transform(CRS, 1)
  .buffer(500)
  .bounds(1, ee.Projection(CRS));
  
var konteks = kotak.buffer(300).bounds();
var m = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(kotak).filterDate(tgl, tgl.advance(1, 'day')).mosaic();
print('Tanggal latihan:', tgl.format('YYYY-MM-dd'));

Map.centerObject(kotak, 16);
Map.setOptions('SATELLITE');
Map.addLayer(m.clip(konteks), {bands: ['B4', 'B3', 'B2'], min: 0, max: 2500, gamma: 1.2},
  'true color 10 m');
Map.addLayer(m.clip(konteks), {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
  'false color 10 m (eceng gondok merah)', false);
Map.addLayer(m.select(['B11', 'B8', 'B4']).setDefaultProjection(P20).reproject(P20).clip(konteks),
  {min: 0, max: 4000}, 'SWIR 20 m (air gelap)', false);
Map.addLayer(ee.FeatureCollection([ee.Feature(kotak)]).style({
  color: 'ffff00', fillColor: '00000000', width: 2}), {}, 'Petak latihan');

// Setelah menggambar air_L (dan eg_L / kja_L bila ada), klik Run lagi.
if (typeof air_L !== 'undefined') {
  var lapis = function (x) { return ee.Image(0).byte().paint(ee.FeatureCollection(x), 1); };
  var air = lapis(air_L);
  var kja = (typeof kja_L !== 'undefined') ? lapis(kja_L) : ee.Image(0).byte();
  var eg = ((typeof eg_L !== 'undefined') ? lapis(eg_L) : ee.Image(0).byte()).and(kja.not());
  var apung = eg.or(kja);
  var ref = ee.Image.cat(
    air.and(apung.not()).rename('r_air'),
    air.or(apung).rename('r_waduk'),
    eg.rename('r_eg'),
    kja.rename('r_kja')
  ).reproject(P20).clip(kotak);
  Map.addLayer(ref.select('r_waduk').selfMask(), {palette: ['ff9100'], opacity: 0.5},
    'Pratinjau r_waduk (oranye)', false);
  Map.addLayer(ref.select('r_air').selfMask(), {palette: ['2166ac'], opacity: 0.6},
    'Pratinjau r_air (biru)', false);
  print('Luas latihan penilai p5 (ha) — salin ke tabel kalibrasi:',
    ref.multiply(ee.Image.pixelArea()).divide(1e4).reduceRegion({
      reducer: ee.Reducer.sum(), geometry: kotak, crs: CRS, scale: 20}));
} else {
  print('Lapisan air_L belum ada. Gambar dulu, lalu Run lagi.');
}
