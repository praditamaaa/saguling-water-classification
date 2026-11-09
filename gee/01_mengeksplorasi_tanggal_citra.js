// =====================================================================
// LANGKAH 01 — MENGEKSPLORASI TANGGAL CITRA
// ---------------------------------------------------------------------
// Tujuan   : Mengetahui tanggal mana saja citra Sentinel-2 di Waduk
//            Saguling yang cukup bersih dari awan, dan bagaimana kondisi
//            permukaan waduk (air terbuka, vegetasi, sisa) di tiap tanggal.
// Masukan  : tidak ada (ini langkah pertama).
// Keluaran : - Console: jumlah tanggal, grafik awan, grafik kondisi waduk,
//              tabel kandidat layak.
//            - CSV di Google Drive: 01_statistik_per_tanggal.csv
// Dipakai  : Langkah 02 memakai kriteria yang sama lalu menyaring lagi
//            tanggal ketika waduk PENUH.
// Cara pakai:
//   1. Tempel ke Code Editor GEE, klik Run.
//   2. Baca grafik dan tabel di Console.
//   3. (Opsional) isi TANGGAL_TAMPIL dengan satu tanggal dari tabel,
//      Run lagi untuk melihat citranya.
//   4. Tab Tasks -> RUN pada task CSV. Catat hasilnya di Excel Tabel 2.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER — ubah di sini saja
// ---------------------------------------------------------------------
// Kotak area studi yang mencakup seluruh Waduk Saguling (bujur, lintang).
var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);

// Rentang tanggal yang diperiksa. Ganti END dengan tanggal hari ini.
var START = '2023-01-01';
var END   = '2026-10-23';

// Saringan kasar: buang tile yang awannya > 60% menurut metadata.
// Longgar karena satu tile (100 x 100 km) jauh lebih luas dari waduk.
var MAX_TILE_CLOUD = 60;

// Kriteria tanggal "layak", dihitung KHUSUS di dalam batas waduk.
var MIN_TEREKAM_PCT = 95;   // minimal 95% batas waduk terekam sensor
var MAX_AWAN_PCT    = 10;   // maksimal 10% batas waduk tertutup awan

// Kosongkan ('') bila tidak ingin menampilkan citra.
var TANGGAL_TAMPIL = '';


// ---------------------------------------------------------------------
// 1. BATAS MAKSIMUM WADUK (L) DARI JRC GLOBAL SURFACE WATER
//    max_extent = 1 bila piksel pernah tergenang selama 1984–2021.
//    Dipakai sebagai MASKER (area hitung), BUKAN sebagai kunci jawaban.
// ---------------------------------------------------------------------
var L = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('max_extent')
  .unmask(0).eq(1).clip(AOI);


// ---------------------------------------------------------------------
// 2. KOLEKSI SENTINEL-2 DAN MOSAIK HARIAN
//    Satu tanggal bisa terdiri dari beberapa tile. mosaic() menempelkan
//    tile-tile itu menjadi satu citra per tanggal.
// ---------------------------------------------------------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(AOI)
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_TILE_CLOUD));

function mosaikPerTanggal(koleksi) {
  // Daftar tanggal unik dalam format teks 'YYYY-MM-dd'.
  var tanggal = koleksi.aggregate_array('system:time_start')
    .map(function (t) { return ee.Date(t).format('YYYY-MM-dd'); })
    .distinct();
  // Untuk tiap tanggal: ambil semua tile hari itu, tempel jadi satu.
  return ee.ImageCollection.fromImages(tanggal.map(function (d) {
    var hari = ee.Date.parse('YYYY-MM-dd', d);
    return koleksi.filterDate(hari, hari.advance(1, 'day')).mosaic().set({
      'system:time_start': hari.millis(),
      'tanggal': d
    });
  }));
}
var harian = mosaikPerTanggal(s2);


// ---------------------------------------------------------------------
// 3. STATISTIK PER TANGGAL DI DALAM BATAS WADUK
//    Operasi PCD yang dipakai:
//    - Masker awan: operasi LOGIKA per piksel pada band SCL.
//      SCL 3 = bayangan awan, 8 = awan sedang, 9 = awan tinggi, 10 = cirrus.
//    - MNDWI dan NDVI: operasi TITIK (aritmetika antarband per piksel).
//    - Ambang 0 (air) dan 0,3 (vegetasi): thresholding sederhana,
//      hanya untuk gambaran kasar, bukan hasil penelitian.
// ---------------------------------------------------------------------
function musim(bulan) {
  bulan = ee.Number(bulan);
  return ee.Algorithms.If(bulan.gte(6).and(bulan.lte(9)), 'kemarau',
         ee.Algorithms.If(bulan.gte(11).or(bulan.lte(3)), 'hujan', 'peralihan'));
}

function hitungStatistik(img) {
  var scl = img.select('SCL');
  var adaData = img.select('B3').mask().gt(0);                 // piksel terekam
  var awan = scl.eq(3).or(scl.eq(8)).or(scl.eq(9)).or(scl.eq(10))
    .unmask(0).and(adaData);                                   // piksel awan
  var bersih = adaData.and(awan.not());                        // piksel bersih

  var mndwi = img.normalizedDifference(['B3', 'B11']);         // (hijau-SWIR)/(hijau+SWIR)
  var ndvi  = img.normalizedDifference(['B8', 'B4']);          // (NIR-merah)/(NIR+merah)

  // Hitung jumlah piksel tiap kategori di dalam L (skala 20 m).
  var n = ee.Image.cat(
    L.rename('n_waduk'),
    adaData.and(L).rename('n_terekam'),
    awan.and(L).rename('n_awan'),
    bersih.and(L).rename('n_bersih'),
    mndwi.gt(0).unmask(0).and(bersih).and(L).rename('n_air'),
    ndvi.gt(0.3).unmask(0).and(bersih).and(L).rename('n_veg')
  ).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: AOI, scale: 20, maxPixels: 1e9, tileScale: 4
  });

  var nWaduk   = ee.Number(n.get('n_waduk')).max(1);
  var nTerekam = ee.Number(n.get('n_terekam')).max(1);
  var nBersih  = ee.Number(n.get('n_bersih')).max(1);
  var airPct   = ee.Number(n.get('n_air')).divide(nBersih).multiply(100);
  var vegPct   = ee.Number(n.get('n_veg')).divide(nBersih).multiply(100);

  return ee.Feature(null, {
    'tanggal': img.get('tanggal'),
    'system:time_start': img.get('system:time_start'),
    'musim': musim(ee.Date(img.get('system:time_start')).get('month')),
    'terekam_pct': ee.Number(n.get('n_terekam')).divide(nWaduk).multiply(100),
    'awan_pct': ee.Number(n.get('n_awan')).divide(nTerekam).multiply(100),
    'air_terbuka_pct': airPct,
    'vegetasi_pct': vegPct,
    // Sisa = bukan air dan bukan vegetasi (persamaan 2 naskah).
    //   naik pelan berminggu-minggu  -> dasar waduk terbuka karena surut
    //   melonjak di satu tanggal saja -> awan tipis yang lolos masker
    'sisa_pct': ee.Number(100).subtract(airPct).subtract(vegPct)
  });
}

var statistik = ee.FeatureCollection(harian.map(hitungStatistik))
  .sort('system:time_start');
var layak = statistik
  .filter(ee.Filter.gte('terekam_pct', MIN_TEREKAM_PCT))
  .filter(ee.Filter.lte('awan_pct', MAX_AWAN_PCT));


// ---------------------------------------------------------------------
// 4. KELUARAN DI CONSOLE
// ---------------------------------------------------------------------
print('Jumlah tanggal citra:', statistik.size());
print('Jumlah tanggal layak (terekam >= ' + MIN_TEREKAM_PCT + '%, awan <= ' + MAX_AWAN_PCT + '%):',
  layak.size());

print(ui.Chart.feature.byFeature(statistik, 'tanggal', ['awan_pct'])
  .setChartType('LineChart')
  .setOptions({
    title: 'Awan di dalam batas waduk per tanggal (%)',
    vAxis: {title: '% awan', viewWindow: {min: 0, max: 100}},
    hAxis: {title: 'Tanggal', slantedText: true},
    pointSize: 4, lineWidth: 0, legend: {position: 'none'}
  }));

print(ui.Chart.feature.byFeature(layak, 'tanggal',
    ['air_terbuka_pct', 'vegetasi_pct', 'sisa_pct'])
  .setChartType('LineChart')
  .setOptions({
    title: 'Tanggal layak: kondisi permukaan di batas waduk (%)',
    vAxis: {title: '%'}, hAxis: {title: 'Tanggal', slantedText: true},
    pointSize: 4, lineWidth: 1
  }));

print('Tabel tanggal layak:', ui.Chart.feature.byFeature(layak, 'tanggal',
    ['musim', 'awan_pct', 'terekam_pct', 'air_terbuka_pct', 'vegetasi_pct', 'sisa_pct'])
  .setChartType('Table'));

// CSV lengkap (semua tanggal, bukan hanya yang layak).
Export.table.toDrive({
  collection: statistik,
  description: '01_statistik_per_tanggal',
  folder: 'PCD_Saguling',
  fileFormat: 'CSV',
  selectors: ['tanggal', 'musim', 'terekam_pct', 'awan_pct',
    'air_terbuka_pct', 'vegetasi_pct', 'sisa_pct']
});


// ---------------------------------------------------------------------
// 5. PETA
// ---------------------------------------------------------------------
Map.centerObject(AOI, 12);
Map.setOptions('SATELLITE');

if (TANGGAL_TAMPIL !== '') {
  // Ambil mosaik pada tanggal TERDEKAT, supaya tidak error bila tanggal
  // yang diisi bukan tanggal perekaman (Sentinel-2 merekam tiap ±5 hari).
  var target = ee.Date(TANGGAL_TAMPIL).millis();
  var img = ee.Image(harian.map(function (i) {
    return i.set('selisih', ee.Number(i.get('system:time_start')).subtract(target).abs());
  }).sort('selisih').first()).clip(AOI);
  print('Diminta ' + TANGGAL_TAMPIL + ', ditampilkan tanggal:', img.get('tanggal'));

  Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 2500, gamma: 1.2},
    'True color');
  Map.addLayer(img, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
    'False color (vegetasi tampak merah)', false);
  Map.addLayer(img.normalizedDifference(['B3', 'B11']),
    {min: -0.6, max: 0.6, palette: ['8c510a', 'f6e8c3', '01665e']}, 'MNDWI', false);
}

// Garis batas L: tepi luar masker (dilasi 1 piksel dikurangi masker).
Map.addLayer(L.focalMax(1).subtract(L).selfMask(), {palette: ['00ffff']},
  'Batas maksimum waduk (JRC)');
