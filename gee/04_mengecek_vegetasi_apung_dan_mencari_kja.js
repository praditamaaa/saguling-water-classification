// =====================================================================
// LANGKAH 04 — MENGECEK VEGETASI APUNG DAN MENCARI KJA
// ---------------------------------------------------------------------
// Tujuan   : (1) Memastikan vegetasi di petak B benar-benar MENGAPUNG.
//                Rawa yang berakar di endapan sedimen bersifat menetap;
//                eceng gondok datang dan pergi. Bila luas vegetasi petak
//                B pernah mendekati 0 ha saat waduk penuh, vegetasinya
//                dinamis (mengapung).
//            (2) Mencari kompleks KJA untuk petak C dengan FILTER TEKSTUR.
//                Keramba lebih kecil dari piksel, tetapi membuat permukaan
//                air "berbintik". Air terbuka itu halus.
// Masukan  : - Asset saguling_tanggal_penuh_<versi> (Langkah 02)
//            - T1 (Langkah 02) dan koordinat petak (Langkah 03)
// Keluaran : - Console: grafik dan tabel deret waktu vegetasi apung.
//            - Peta: tekstur menetap (kandidat KJA).
// Dipakai  : Koordinat final A, B, C diisi ke Langkah 05.
// Cara pakai:
//   1. Run. Lihat grafik: apakah garis B pernah turun mendekati 0?
//   2. Matikan layer Sentinel-2, perbesar basemap (zoom 16–17) di titik
//      kuning-merah layer tekstur. Grid keramba = kandidat petak C.
//   3. Klik pusat petak baru bila perlu; catat di Excel Tabel 5.
//
// Operasi PCD:
//   Simpangan baku lokal (persamaan 15 naskah) = filter spasial statistik.
//   Untuk tiap piksel, hitung simpangan baku nilai B8 di jendela 5 x 5.
//   Lalu ambil nilai MINIMUM di semua tanggal waduk penuh pada tahun T1
//   (persamaan 16): hanya objek yang MENETAP (keramba) yang tetap tinggi;
//   riak, kabut, dan perahu hilang.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER — ISI DARI HASIL LANGKAH SEBELUMNYA
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_TANGGAL = 'v1';   // versi Asset tanggal penuh yang DIBACA (dari Langkah 02)
var T1 = '';    // dari Langkah 02, format 'YYYY-MM-DD'

// Pusat petak [bujur, lintang] dari Langkah 03 (null = belum ada).
var PETAK = [
  {id: 'A', pusat: null, warna: 'ffff00'},
  {id: 'B', pusat: null, warna: 'ff9100'},
  {id: 'C', pusat: null, warna: 'ffffff'}
];

var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);
var OKUR_MIN = 80;      // zona inti JRC
var EROSI_M  = 20;      // jauhkan filter tekstur 20 m dari tepi zona inti
var CRS = 'EPSG:32748'; // UTM zona 48S

if (T1 === '') {
  throw new Error('Isi T1 dulu dari hasil Langkah 02.');
}
var petakTerisi = PETAK.filter(function (p) { return p.pusat !== null; });


// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
var gsw  = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var L    = gsw.select('max_extent').unmask(0).eq(1).clip(AOI);
var inti = gsw.select('occurrence').gte(OKUR_MIN).unmask(0).clip(AOI);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);

// Daftar tanggal waduk penuh dari Asset Langkah 02.
var tanggalPenuh = ee.FeatureCollection(ASSET + 'saguling_tanggal_penuh_' + VERSI_TANGGAL)
  .aggregate_array('tanggal');

var koleksi = ee.ImageCollection(tanggalPenuh.map(function (tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic()
    .set({'tanggal': tgl, 'system:time_start': d.millis()});
}));

function maskerBersih(img) {
  var scl = img.select('SCL');
  return scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
}

function kotak(pusat) {
  return ee.Geometry.Point(pusat).buffer(500).bounds();
}


// ---------------------------------------------------------------------
// 2. DERET WAKTU VEGETASI APUNG PER PETAK
// ---------------------------------------------------------------------
if (petakTerisi.length > 0) {
  var petakFC = ee.FeatureCollection(petakTerisi.map(function (p) {
    return ee.Feature(kotak(p.pusat), {id: p.id});
  }));

  var deret = koleksi.map(function (img) {
    var apung = img.normalizedDifference(['B8', 'B4']).gt(0.3)
      .and(inti).and(maskerBersih(img)).unmask(0).rename('apung');
    return apung.reduceRegions({
      collection: petakFC, reducer: ee.Reducer.mean(), scale: 20
    }).map(function (f) {
      return f.set({
        // proporsi piksel apung x luas petak = luas apung (ha)
        'apung_ha': ee.Number(f.get('mean')).multiply(f.geometry().area(1)).divide(1e4),
        'system:time_start': img.get('system:time_start'),
        'tanggal': img.get('tanggal')
      });
    });
  }).flatten();

  print(ui.Chart.feature.groups(deret, 'system:time_start', 'apung_ha', 'id')
    .setChartType('LineChart')
    .setOptions({
      title: 'Vegetasi di zona inti per petak — tanggal waduk penuh',
      vAxis: {title: 'ha'}, hAxis: {title: 'Tanggal'}, pointSize: 4, lineWidth: 1
    }));
  print('Tabel deret waktu (urut petak, lalu tanggal):',
    ui.Chart.feature.byFeature(deret.sort('system:time_start').sort('id'),
      'tanggal', ['apung_ha']).setChartType('Table'));
} else {
  print('Koordinat petak belum diisi; deret waktu dilewati, peta tekstur tetap dibuat.');
}


// ---------------------------------------------------------------------
// 3. FILTER TEKSTUR UNTUK MENCARI KJA
// ---------------------------------------------------------------------
// Zona inti dikikis (erosi) 20 m agar piksel campuran di tepi air
// tidak ikut terbaca sebagai "berbintik".
var intiErosi = inti.focalMin({radius: EROSI_M, units: 'meters'});

function tekstur(img) {
  // B8 dipaksa ke grid 10 m agar ukuran jendela tetap 5 x 5 piksel
  // berapa pun zoom peta.
  var nir = img.select('B8').reproject({crs: CRS, scale: 10});
  var sd = nir.reduceNeighborhood({
    reducer: ee.Reducer.stdDev(),
    kernel: ee.Kernel.square(2)          // radius 2 piksel = jendela 5 x 5
  });
  // Abaikan piksel awan dan piksel bervegetasi (eceng gondok juga berbintik).
  var bukanVeg = img.normalizedDifference(['B8', 'B4']).lt(0.2);
  return sd.updateMask(intiErosi.and(maskerBersih(img)).and(bukanVeg)).rename('sd_nir');
}

var tahun = ee.Date(T1).get('year');
var koleksiTahun = koleksi.filter(ee.Filter.calendarRange(tahun, tahun, 'year'));
print('Jumlah tanggal penuh untuk tekstur (tahun T1):', koleksiTahun.size());
var teksturMenetap = koleksiTahun.map(tekstur).min().clip(AOI);


// ---------------------------------------------------------------------
// 4. PETA
// ---------------------------------------------------------------------
Map.centerObject(AOI, 12);
Map.setOptions('SATELLITE');

var imgT1 = s2.filterDate(ee.Date(T1), ee.Date(T1).advance(1, 'day')).mosaic().clip(AOI);
Map.addLayer(imgT1, {bands: ['B4', 'B3', 'B2'], min: 0, max: 2500, gamma: 1.2},
  'T1 · true color', false);
Map.addLayer(imgT1, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000}, 'T1 · false color', false);

// Ambang tampilan 100–500 hanya tebakan awal; ubah lewat ikon roda gigi layer.
Map.addLayer(teksturMenetap.updateMask(teksturMenetap.gt(100)),
  {min: 100, max: 500, palette: ['ffff66', 'ff8800', 'ff0000']},
  'Tekstur menetap (kandidat KJA)');
Map.addLayer(L.focalMax(1).subtract(L).selfMask(), {palette: ['00ffff']},
  'Batas maksimum waduk (JRC)');
petakTerisi.forEach(function (p) {
  Map.addLayer(ee.FeatureCollection([ee.Feature(kotak(p.pusat))]).style({
    color: p.warna, fillColor: '00000000', width: 2}), {}, 'Petak ' + p.id);
});

var nomor = 0;
Map.onClick(function (c) {
  nomor += 1;
  Map.addLayer(ee.FeatureCollection([ee.Feature(kotak([c.lon, c.lat]))]).style({
    color: '00ff00', fillColor: '00000000', width: 2}), {}, 'Klik #' + nomor);
  print('Klik #' + nomor + ' — pusat [bujur, lintang]:',
    [Number(c.lon.toFixed(5)), Number(c.lat.toFixed(5))]);
});
