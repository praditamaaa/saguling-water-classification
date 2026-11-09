// =====================================================================
// LANGKAH 02 — MEMILIH TANGGAL WADUK PENUH (T1 dan T2)
// ---------------------------------------------------------------------
// Tujuan   : Memilih dua tanggal citra (T1 dan T2) dengan:
//            - muka air hampir sama (agar pengaruh SURUT tidak tercampur),
//            - luas vegetasi apung berbeda (agar ada dua kondisi).
// Mengapa  : Saat waduk surut, rumput di dasar waduk tampak sama dengan
//            eceng gondok. Karena itu kedua tanggal harus dari kondisi
//            waduk PENUH.
// Masukan  : tidak ada (menghitung ulang statistik seperti Langkah 01).
// Keluaran : - Console: daftar tanggal waduk penuh, grafik vegetasi apung,
//              10 usulan pasangan T1–T2.
//            - Peta frekuensi vegetasi apung (lokasi kandidat petak B).
//            - Asset  : saguling_tanggal_penuh_<versi>  (dipakai Langkah 04)
//            - CSV    : 02_tanggal_waduk_penuh_<versi>.csv
// Dipakai  : T1 dan T2 yang kamu pilih diisi ke Langkah 03, 04, dan 05.
// Cara pakai:
//   1. Run. Baca tabel "usulan pasangan" di Console.
//   2. Pilih satu pasangan (cek juga visualnya: isi TAMPIL_T1/TAMPIL_T2).
//   3. Tab Tasks -> RUN pada task Asset dan CSV.
//   4. Catat T1, T2, dan alasannya di Excel Tabel 3.
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
//
// Cara mengenali vegetasi apung tanpa digitasi:
//   Zona inti = piksel yang menurut JRC tergenang >= OKUR_MIN% dari
//   seluruh pengamatan 1984–2021. Dasar waduk di zona ini hampir tidak
//   pernah kering, jadi vegetasi yang muncul di sana hampir pasti
//   MENGAPUNG. Angka ini batas bawah untuk memilih tanggal, BUKAN luas
//   eceng gondok sebenarnya.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';   // ganti bila proyek GEE berbeda
var VERSI_TANGGAL = 'v1';   // versi Asset yang DITULIS langkah ini; naikkan bila diulang
var AOI   = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);
var START = '2023-01-01';
var END   = '2026-10-23';

var MAX_TILE_CLOUD  = 60;
var MIN_TEREKAM_PCT = 95;
var MAX_AWAN_PCT    = 10;

// Syarat "waduk penuh".
var MIN_AIR_PENUH  = 70;   // air terbuka minimal 70% dari batas waduk
var MAX_SISA_PENUH = 10;   // sisa maksimal 10% (tidak surut, tidak berkabut)
var OKUR_MIN       = 80;   // ambang occurrence JRC untuk zona inti (%)

// Syarat pasangan T1–T2.
var MAKS_SELISIH_AIR = 2;              // selisih air terbuka maksimal (poin %)
var BATAS_AKHIR = '2025-09-30';        // sebelum PLTS terapung mulai dibangun (Okt 2025)

// Isi untuk melihat citra pasangan yang dipilih (boleh dikosongkan).
var TAMPIL_T1 = '';
var TAMPIL_T2 = '';


// ---------------------------------------------------------------------
// 1. MASKER DARI JRC
// ---------------------------------------------------------------------
var gsw  = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var L    = gsw.select('max_extent').unmask(0).eq(1).clip(AOI);          // batas maksimum
var inti = gsw.select('occurrence').gte(OKUR_MIN).unmask(0).clip(AOI);  // zona inti


// ---------------------------------------------------------------------
// 2. MOSAIK HARIAN (sama dengan Langkah 01)
// ---------------------------------------------------------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(AOI).filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_TILE_CLOUD));

function mosaikPerTanggal(koleksi) {
  var tanggal = koleksi.aggregate_array('system:time_start')
    .map(function (t) { return ee.Date(t).format('YYYY-MM-dd'); }).distinct();
  return ee.ImageCollection.fromImages(tanggal.map(function (d) {
    var hari = ee.Date.parse('YYYY-MM-dd', d);
    return koleksi.filterDate(hari, hari.advance(1, 'day')).mosaic()
      .set({'system:time_start': hari.millis(), 'tanggal': d});
  }));
}
var harian = mosaikPerTanggal(s2);

// Masker piksel bersih (bukan awan/bayangan/cirrus) — operasi logika.
function maskerBersih(img) {
  var scl = img.select('SCL');
  return scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
}


// ---------------------------------------------------------------------
// 3. STATISTIK PER TANGGAL + VEGETASI APUNG DI ZONA INTI
// ---------------------------------------------------------------------
var HA_PER_PIKSEL = 0.04;   // piksel 20 m x 20 m = 400 m2 = 0,04 ha

function hitungStatistik(img) {
  var adaData = img.select('B3').mask().gt(0);
  var bersih  = maskerBersih(img).unmask(0).and(adaData);
  var air = img.normalizedDifference(['B3', 'B11']).gt(0).unmask(0);   // MNDWI > 0
  var veg = img.normalizedDifference(['B8', 'B4']).gt(0.3).unmask(0);  // NDVI > 0,3

  var n = ee.Image.cat(
    L.rename('n_waduk'),
    adaData.and(L).rename('n_terekam'),
    adaData.and(bersih.not()).and(L).rename('n_awan'),
    bersih.and(L).rename('n_bersih'),
    air.and(bersih).and(L).rename('n_air'),
    veg.and(bersih).and(L).rename('n_veg'),
    bersih.and(inti).rename('n_inti'),
    veg.and(bersih).and(inti).rename('n_apung')     // vegetasi di zona inti
  ).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: AOI, scale: 20, maxPixels: 1e9, tileScale: 4
  });

  var nBersih = ee.Number(n.get('n_bersih')).max(1);
  var airPct  = ee.Number(n.get('n_air')).divide(nBersih).multiply(100);
  var vegPct  = ee.Number(n.get('n_veg')).divide(nBersih).multiply(100);

  // Geometri AOI wajib ada: Export ke Asset menolak fitur tanpa geometri
  // ("Unable to export features with null geometry").
  return ee.Feature(AOI, {
    'tanggal': img.get('tanggal'),
    'system:time_start': img.get('system:time_start'),
    'terekam_pct': ee.Number(n.get('n_terekam')).divide(ee.Number(n.get('n_waduk')).max(1)).multiply(100),
    'awan_pct': ee.Number(n.get('n_awan')).divide(ee.Number(n.get('n_terekam')).max(1)).multiply(100),
    'air_terbuka_pct': airPct,
    'vegetasi_pct': vegPct,
    'sisa_pct': ee.Number(100).subtract(airPct).subtract(vegPct),
    'veg_apung_ha': ee.Number(n.get('n_apung')).multiply(HA_PER_PIKSEL),
    'veg_apung_pct': ee.Number(n.get('n_apung')).divide(ee.Number(n.get('n_inti')).max(1)).multiply(100)
  });
}

var statistik = ee.FeatureCollection(harian.map(hitungStatistik));
var layak = statistik
  .filter(ee.Filter.gte('terekam_pct', MIN_TEREKAM_PCT))
  .filter(ee.Filter.lte('awan_pct', MAX_AWAN_PCT));
var penuh = layak
  .filter(ee.Filter.gte('air_terbuka_pct', MIN_AIR_PENUH))
  .filter(ee.Filter.lte('sisa_pct', MAX_SISA_PENUH))
  .sort('system:time_start');


// ---------------------------------------------------------------------
// 4. USULAN PASANGAN T1–T2
//    Semua kombinasi dua tanggal penuh diperiksa. Syarat:
//    - selisih air terbuka <= MAKS_SELISIH_AIR (muka air setara),
//    - keduanya <= BATAS_AKHIR,
//    - T1 = tanggal dengan vegetasi apung LEBIH BANYAK.
//    Diurutkan dari selisih vegetasi apung terbesar.
// ---------------------------------------------------------------------
var daftar = penuh.toList(penuh.size());
var batas = ee.Date(BATAS_AKHIR).millis();
var pasangan = ee.FeatureCollection(daftar.map(function (a) {
  a = ee.Feature(a);
  return daftar.map(function (b) {
    b = ee.Feature(b);
    return ee.Feature(null, {
      'T1_tinggi': a.get('tanggal'),
      'T2_rendah': b.get('tanggal'),
      'selisih_air_poin': ee.Number(a.get('air_terbuka_pct'))
        .subtract(b.get('air_terbuka_pct')).abs(),
      'selisih_apung_ha': ee.Number(a.get('veg_apung_ha')).subtract(b.get('veg_apung_ha')),
      'waktu_a': a.get('system:time_start'),
      'waktu_b': b.get('system:time_start')
    });
  });
}).flatten())
  .filter(ee.Filter.gt('selisih_apung_ha', 0))
  .filter(ee.Filter.lte('selisih_air_poin', MAKS_SELISIH_AIR))
  .filter(ee.Filter.lte('waktu_a', batas))
  .filter(ee.Filter.lte('waktu_b', batas))
  .sort('selisih_apung_ha', false)
  .limit(10);


// ---------------------------------------------------------------------
// 5. KELUARAN
// ---------------------------------------------------------------------
print('Tanggal layak:', layak.size());
print('Tanggal waduk penuh:', penuh.size());

print(ui.Chart.feature.byFeature(penuh, 'tanggal', ['veg_apung_ha'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Vegetasi apung di zona inti (ha) — tanggal waduk penuh',
    vAxis: {title: 'ha'}, hAxis: {title: 'Tanggal', slantedText: true},
    legend: {position: 'none'}
  }));

print('Tabel tanggal waduk penuh:', ui.Chart.feature.byFeature(penuh, 'tanggal',
    ['awan_pct', 'air_terbuka_pct', 'sisa_pct', 'veg_apung_ha', 'veg_apung_pct'])
  .setChartType('Table'));

print('Usulan 10 pasangan T1–T2 (muka air setara, apung berbeda):',
  ui.Chart.feature.byFeature(pasangan, 'T1_tinggi',
    ['T2_rendah', 'selisih_air_poin', 'selisih_apung_ha']).setChartType('Table'));

var KOLOM = ['tanggal', 'awan_pct', 'terekam_pct', 'air_terbuka_pct', 'vegetasi_pct',
  'sisa_pct', 'veg_apung_ha', 'veg_apung_pct'];
Export.table.toDrive({
  collection: penuh, description: '02_tanggal_waduk_penuh_' + VERSI_TANGGAL,
  folder: 'PCD_Saguling', fileFormat: 'CSV', selectors: KOLOM
});
// Asset dipakai Langkah 04 (deret waktu per petak).
Export.table.toAsset({
  collection: penuh.select(KOLOM.concat(['system:time_start'])),
  description: 'saguling_tanggal_penuh_' + VERSI_TANGGAL,
  assetId: ASSET + 'saguling_tanggal_penuh_' + VERSI_TANGGAL
});


// ---------------------------------------------------------------------
// 6. PETA FREKUENSI VEGETASI APUNG
//    Untuk tiap piksel zona inti: berapa kali (proporsi) piksel itu
//    bervegetasi di seluruh tanggal waduk penuh. Merah = sering =
//    hotspot eceng gondok -> kandidat lokasi petak B (Langkah 03).
// ---------------------------------------------------------------------
Map.centerObject(AOI, 12);
Map.setOptions('SATELLITE');

var harianPenuh = harian.filter(ee.Filter.inList('tanggal', penuh.aggregate_array('tanggal')));
var frekuensi = harianPenuh.map(function (img) {
  return img.normalizedDifference(['B8', 'B4']).gt(0.3).and(inti)
    .updateMask(maskerBersih(img));
}).mean().clip(AOI);

Map.addLayer(frekuensi.updateMask(frekuensi.gt(0.05)),
  {min: 0.05, max: 0.6, palette: ['ffffb2', 'fd8d3c', 'bd0026']},
  'Frekuensi vegetasi apung (tanggal penuh)');
Map.addLayer(inti.selfMask(), {palette: ['2166ac'], opacity: 0.35},
  'Zona inti JRC', false);
Map.addLayer(L.focalMax(1).subtract(L).selfMask(), {palette: ['00ffff']},
  'Batas maksimum waduk (JRC)');

function tampil(tgl, label) {
  if (tgl === '') return;
  var d = ee.Date(tgl);
  var img = s2.filterDate(d, d.advance(1, 'day')).mosaic().clip(AOI);
  Map.addLayer(img, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
    label + ' ' + tgl + ' · false color', false);
}
tampil(TAMPIL_T1, 'T1');
tampil(TAMPIL_T2, 'T2');
