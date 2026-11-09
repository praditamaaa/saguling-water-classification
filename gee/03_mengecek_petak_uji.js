// =====================================================================
// LANGKAH 03 — MENGECEK PETAK UJI
// ---------------------------------------------------------------------
// Tujuan   : Memilih dan memverifikasi tiga petak uji 1 x 1 km:
//              A = air terbuka dan tepian,
//              B = eceng gondok (vegetasi apung),
//              C = keramba jaring apung (KJA).
// Masukan  : T1 dan T2 dari Langkah 02.
// Keluaran : - Console: tabel statistik per petak per tanggal + penilaian.
//            - Peta T1 | T2 berdampingan (geser garis tengah).
// Dipakai  : Koordinat petak yang lolos diisi ke Langkah 04 dan 05.
//
// Dua mode otomatis:
//   MODE PILIH  — bila ada koordinat yang masih null. Peta menampilkan
//                 citra T1 dan peta frekuensi; klik peta untuk mendapat
//                 koordinat pusat petak (tercetak di Console).
//   MODE CEK    — bila ketiga koordinat sudah terisi. Menghitung tabel
//                 statistik dan menampilkan peta T1 | T2 berdampingan.
//
// Kriteria lolos (bisa diubah di bagian 0):
//   A : bagian petak di dalam batas waduk 30–70% (ada garis tepi),
//       air tinggi dan vegetasi apung kecil di kedua tanggal.
//   B : vegetasi apung >= 5 ha di KEDUA tanggal, bentuknya berubah.
//   C : terlihat deretan keramba (titik keputihan berpola grid) di
//       true color / basemap. Indeks tidak bisa memastikan KJA.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER — ISI DARI HASIL LANGKAH SEBELUMNYA
// ---------------------------------------------------------------------
var T1 = '';   // format 'YYYY-MM-DD'  (dari Langkah 02)
var T2 = '';   // format 'YYYY-MM-DD'  (dari Langkah 02)

// Pusat petak [bujur, lintang]. Biarkan null untuk MODE PILIH.
var PETAK = [
  {id: 'A', zona: 'Air terbuka dan tepian', pusat: null, warna: 'ffff00'},
  {id: 'B', zona: 'Eceng gondok',           pusat: null, warna: 'ff9100'},
  {id: 'C', zona: 'KJA',                    pusat: null, warna: 'ffffff'}
];

var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);
var OKUR_MIN = 80;                 // zona inti JRC, sama dengan Langkah 02
var SISI_M = 1000;                 // sisi petak (m)
var KRITERIA = {aMin: 30, aMaks: 70, bMinHa: 5};

if (T1 === '' || T2 === '') {
  throw new Error('Isi T1 dan T2 dulu dari hasil Langkah 02.');
}


// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);
function citra(tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic().clip(AOI);
}
var img1 = citra(T1);
var img2 = citra(T2);

var gsw  = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var L    = gsw.select('max_extent').unmask(0).eq(1).clip(AOI);
var inti = gsw.select('occurrence').gte(OKUR_MIN).unmask(0).clip(AOI);
var tepiL = L.focalMax(1).subtract(L).selfMask();

var visTrue  = {bands: ['B4', 'B3', 'B2'], min: 0, max: 2500, gamma: 1.2};
var visFalse = {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000};

function kotak(pusat) {
  return ee.Geometry.Point(pusat).buffer(SISI_M / 2).bounds();
}

var modePilih = PETAK.some(function (p) { return p.pusat === null; });


// ---------------------------------------------------------------------
// 2. MODE PILIH — klik peta untuk mendapat koordinat
// ---------------------------------------------------------------------
if (modePilih) {
  Map.centerObject(AOI, 12);
  Map.setOptions('SATELLITE');
  Map.addLayer(img1, visTrue, 'T1 · true color', false);
  Map.addLayer(img1, visFalse, 'T1 · false color (vegetasi merah)');
  Map.addLayer(tepiL, {palette: ['00ffff']}, 'Batas maksimum waduk (JRC)');
  Map.addLayer(inti.selfMask(), {palette: ['2166ac'], opacity: 0.3}, 'Zona inti JRC', false);
  // Petak yang sudah terisi ikut digambar.
  PETAK.forEach(function (p) {
    if (p.pusat !== null) {
      Map.addLayer(ee.FeatureCollection([ee.Feature(kotak(p.pusat))]).style({
        color: p.warna, fillColor: '00000000', width: 2}), {}, 'Petak ' + p.id);
    }
  });
  print('MODE PILIH: klik pusat petak di peta. Untuk KJA, matikan layer ' +
    'Sentinel-2 dan perbesar basemap (zoom 16–17) untuk melihat grid keramba.');
  var nomor = 0;
  Map.onClick(function (c) {
    nomor += 1;
    Map.addLayer(ee.FeatureCollection([ee.Feature(kotak([c.lon, c.lat]))]).style({
      color: '00ff00', fillColor: '00000000', width: 2}), {}, 'Klik #' + nomor);
    print('Klik #' + nomor + ' — pusat [bujur, lintang]:',
      [Number(c.lon.toFixed(5)), Number(c.lat.toFixed(5))]);
  });
}


// ---------------------------------------------------------------------
// 3. MODE CEK — statistik per petak per tanggal
// ---------------------------------------------------------------------
if (!modePilih) {
  var petakFC = ee.FeatureCollection(PETAK.map(function (p) {
    return ee.Feature(kotak(p.pusat), {id: p.id, zona: p.zona});
  }));

  var statistik = function (img, kode) {
    var scl = img.select('SCL');
    var bersih = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
    var ndvi = img.normalizedDifference(['B8', 'B4']);
    var stack = ee.Image.cat(
      L.rename('waduk'),
      L.and(bersih.not()).rename('awan'),
      L.and(bersih).and(img.normalizedDifference(['B3', 'B11']).gt(0)).rename('air'),
      L.and(bersih).and(ndvi.gt(0.3)).rename('veg'),
      inti.and(bersih).and(ndvi.gt(0.3)).rename('apung')
    ).unmask(0);

    // Rata-rata biner = proporsi piksel di dalam petak.
    return stack.reduceRegions({collection: petakFC, reducer: ee.Reducer.mean(), scale: 20})
      .map(function (f) {
        var fw = ee.Number(f.get('waduk')).max(1e-6);
        var wadukPct = ee.Number(f.get('waduk')).multiply(100);
        var apungHa = ee.Number(f.get('apung')).multiply(f.geometry().area(1)).divide(1e4);
        var id = ee.String(f.get('id'));
        var nilai = ee.Algorithms.If(id.equals('A'),
          ee.Algorithms.If(wadukPct.gte(KRITERIA.aMin).and(wadukPct.lte(KRITERIA.aMaks)),
            'Lolos', 'Geser petak'),
          ee.Algorithms.If(id.equals('B'),
            ee.Algorithms.If(apungHa.gte(KRITERIA.bMinHa), 'Lolos', 'Tidak lolos'),
            'Cek visual KJA'));
        return f.set({
          'label': id.cat(' · ').cat(kode),
          'waduk_pct': wadukPct,                                        // % petak di batas waduk
          'awan_pct': ee.Number(f.get('awan')).divide(fw).multiply(100),
          'air_pct': ee.Number(f.get('air')).divide(fw).multiply(100),   // % dari bagian waduk
          'veg_pct': ee.Number(f.get('veg')).divide(fw).multiply(100),
          'apung_ha': apungHa,
          'penilaian': nilai
        });
      });
  };

  var tabel = statistik(img1, 'T1').merge(statistik(img2, 'T2')).sort('label');
  print('Statistik per petak (air/veg = % dari bagian petak di dalam batas waduk):',
    ui.Chart.feature.byFeature(tabel, 'label',
      ['waduk_pct', 'awan_pct', 'air_pct', 'veg_pct', 'apung_ha', 'penilaian'])
      .setChartType('Table'));

  // Peta berdampingan: kiri T1, kanan T2, digeser dengan garis tengah.
  var garis = ee.FeatureCollection(PETAK.map(function (p) {
    return ee.Feature(kotak(p.pusat), {style: {color: p.warna, fillColor: '00000000', width: 3}});
  })).style({styleProperty: 'style'});

  var isiPeta = function (peta, img, judul) {
    peta.setOptions('SATELLITE');
    peta.addLayer(img, visTrue, judul + ' · true color', false);
    peta.addLayer(img, visFalse, judul + ' · false color');
    peta.addLayer(tepiL, {palette: ['00ffff']}, 'Batas maksimum waduk (JRC)');
    peta.addLayer(garis, {}, 'Petak A kuning · B oranye · C putih');
    peta.add(ui.Label(judul, {position: 'top-left', fontWeight: 'bold'}));
  };
  var peta1 = ui.Map(), peta2 = ui.Map();
  ui.Map.Linker([peta1, peta2]);
  isiPeta(peta1, img1, 'T1 · ' + T1 + ' (kiri)');
  isiPeta(peta2, img2, 'T2 · ' + T2 + ' (kanan)');
  ui.root.widgets().reset([ui.SplitPanel({
    firstPanel: peta1, secondPanel: peta2, wipe: true, style: {stretch: 'both'}
  })]);
  peta1.centerObject(petakFC, 13);
}
