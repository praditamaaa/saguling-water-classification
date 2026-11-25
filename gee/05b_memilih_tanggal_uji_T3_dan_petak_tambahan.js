// =====================================================================
// LANGKAH 05b — MEMILIH TANGGAL UJI T3 DAN PETAK LATIH TAMBAHAN D, E, F
// ---------------------------------------------------------------------
// Tujuan   : Menyiapkan data untuk machine learning (Naskah 2):
//              T3 = tanggal UJI untuk petak A, B, C (tidak pernah dipakai melatih)
//              D  = eceng gondok, lokasi 2, digambar pada tanggal D1
//              E  = KJA, lokasi 2,          digambar pada tanggal D2
//              F  = eceng gondok, lokasi 3, digambar pada tanggal D3
//            Data latih menjadi 6 lokasi x 5 tanggal (A–C pada T1, T2; D, E, F
//            masing-masing pada tanggalnya sendiri) = 12 kombinasi bersama T3.
// Masukan  : Asset saguling_petak_<v> (Langkah 05: petak A, B, C, T1, T2)
// Keluaran : CSV 05b_kandidat_tanggal_<v>   (mode 'cari')
//            Asset saguling_tambahan_<v>    (mode 'simpan'):
//              - fitur jenis 'tanggal' berisi t3, d1, d2, d3
//              - fitur jenis 'petak' id D, E, F (properti kode = D1/D2/D3)
// Dipakai  : 06b_digitasi_pN_v2, 06c, 10.
//
// MENGAPA D, E, F BERISI INI
//   Dari voting v1, luas latih eceng gondok (setelah petak C dibuang) 34,9 ha
//   dan KJA 45,4 ha, keduanya hampir seluruhnya dari SATU kawasan (B dan C).
//   Eceng gondok paling berubah antartanggal dan paling sulit disepakati
//   penilai, sehingga mendapat dua lokasi tambahan; KJA mendapat satu.
//
// SYARAT PETAK D, E, F (diputuskan SEBELUM melihat tanggal; catat di Excel Tabel 4)
//   1. Tidak tumpang tindih dengan A, B, C, satu sama lain, maupun area
//      latihan kalibrasi; berjarak >= JARAK_MIN_M dari tepi petak A, B, C.
//   2. Di lengan waduk yang berbeda dari petak sejenis (D dan F berbeda dari
//      B dan dari satu sama lain; E berbeda dari C).
//   3. >= MIN_WADUK_PCT luas petak di dalam batas waduk (JRC max extent).
//   4. D dan F: sering tertutup vegetasi apung di peta frekuensi (Langkah 02/04);
//      bila bisa, D hamparan rapat dan F hamparan lebih jarang/sedang tumbuh.
//      E: kisi keramba jelas di basemap dan tekstur NIR tinggi (Langkah 04).
//   5. 1 x 1 km sejajar grid 20 m (fungsi sama dengan Langkah 05).
//
// SYARAT TANGGAL (mode 'simpan' memeriksa otomatis)
//   1. Waduk penuh seperti Langkah 02: air terbuka >= 70%, sisa <= 10%,
//      awan di batas waduk <= 10%, terekam >= 95%.
//   2. Selisih air terbuka terhadap T1 DAN T2 <= 2 poin.
//   3. SEBELUM 1 Oktober 2025 (sebelum PLTS terapung).
//   4. T1, T2, T3, D1, D2, D3 saling berjarak >= JARAK_MIN_HARI.
//   5. Petak yang dipakai 100% bebas awan pada tanggalnya
//      (A, B, C pada T3; D pada D1; E pada D2; F pada D3).
//   6. D1 dan D3: vegetasi apung di petaknya >= MIN_APUNG_HA (objek ada).
//   7. Utamakan bulan yang berbeda dari Agustus dan berbeda satu sama lain.
//   8. Pilih dari tabel berdasarkan kriteria, bukan dari citra yang terlihat
//      paling mudah. Catat alasan di Excel Tabel 3.
//
// CATATAN TEKNIS
//   Statistik tiap tanggal dihitung dengan SATU reduceRegion (semua petak
//   dalam satu citra berlabel) agar tidak memicu "Too many concurrent
//   aggregations". Console dibatasi pada TAHUN_TAMPIL; tabel lengkap di CSV.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var MODE = 'simpan';               // 'cari' | 'simpan'
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK    = 'v1';       // dibaca (Langkah 05)
var VERSI_TAMBAHAN = 'v1';       // ditulis langkah ini

var MULAI = '2019-01-01';        // Sentinel-2 L2A di Indonesia tersedia sejak sekitar akhir 2018
var BATAS_PLTS = '2025-10-01';   // semua tanggal terpilih harus SEBELUM ini
var TAHUN_TAMPIL = [2024];       // tahun yang dihitung untuk Console, misal [2022, 2023]
var JARAK_MIN_HARI = 30;
var JARAK_MIN_M = 1000;          // jarak minimal petak D–F ke tepi petak A–C
var MIN_WADUK_PCT = 50;          // minimal bagian petak di dalam batas waduk
var MIN_APUNG_HA = 5;            // minimal vegetasi apung di petak D/F pada tanggalnya

// Pusat petak [bujur, lintang]. Klik peta (Inspector) untuk membaca koordinat.
var PETAK_BARU = [
  {id: 'D', zona: 'Eceng gondok (lokasi 2)', kode: 'D1', pusat: [107.47059, -6.91453]},
  {id: 'E', zona: 'KJA (lokasi 2)',          kode: 'D2', pusat: [107.41968, -6.91193]},
  {id: 'F', zona: 'Eceng gondok (lokasi 3)', kode: 'D3', pusat: [107.46099, -6.93737]}
];

// Diisi setelah mode 'cari' (format 'YYYY-MM-DD').
var T3 = '2025-05-28';
var D1 = '2023-04-24';   // untuk petak D
var D2 = '2023-07-18';   // untuk petak E
var D3 = '2024-06-22';   // untuk petak F

// Kriteria waduk penuh (sama dengan Langkah 02)
var MAX_TILE_CLOUD   = 60;
var MIN_TEREKAM_PCT  = 95;
var MAX_AWAN_PCT     = 10;
var MIN_AIR_PENUH    = 70;
var MAX_SISA_PENUH   = 10;
var MAKS_SELISIH_AIR = 5;

var AOI = ee.Geometry.Rectangle([107.28, -7.02, 107.58, -6.80]);
var CRS = 'EPSG:32748';
var GRID = [20, 0, 0, 0, -20, 0];
var P20 = ee.Projection(CRS).atScale(20);
var SISI_M = 1000;


// ---------------------------------------------------------------------
// 1. DATA DAN PETAK
// ---------------------------------------------------------------------
var petakUtama = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var T1 = ee.String(petakUtama.first().get('t1'));
var T2 = ee.String(petakUtama.first().get('t2'));
var L = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('max_extent')
  .unmask(0).eq(1).reproject(P20);
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(AOI);

// Kotak 1 x 1 km sejajar grid 20 m (sama dengan Langkah 05).
function kotakUTM(lonlat) {
  var xy = ee.Geometry.Point(lonlat).transform(CRS, 1).coordinates();
  var x = ee.Number(xy.get(0)).divide(20).round().multiply(20);
  var y = ee.Number(xy.get(1)).divide(20).round().multiply(20);
  var h = SISI_M / 2;
  return ee.Geometry.Rectangle(ee.List([x.subtract(h), y.subtract(h), x.add(h), y.add(h)]), CRS, false);
}
var baruTerisi = PETAK_BARU.filter(function (p) { return p.pusat !== null; });
var petakBaru = ee.FeatureCollection(baruTerisi.map(function (p) {
  return ee.Feature(kotakUTM(p.pusat), {
    id: p.id, zona: p.zona, kode: p.kode, bujur: p.pusat[0], lintang: p.pusat[1]});
}));

// Citra label petak: A=1, B=2, C=3, D=4, E=5, F=6 (0 = di luar petak).
var IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
var semuaPetak = petakUtama.select(['id']).merge(petakBaru.select(['id']))
  .map(function (f) { return f.set('kode_petak', ee.List(IDS).indexOf(f.get('id')).add(1)); });
var labelPetak = ee.Image(0).paint(semuaPetak, 'kode_petak').reproject(P20).rename('petak');

function mosaik(tgl) {
  var d = ee.Date(tgl);
  return s2.filterDate(d, d.advance(1, 'day')).mosaic()
    .set({'system:time_start': d.millis(), tanggal: d.format('YYYY-MM-dd')});
}

// SATU reduceRegion per tanggal: statistik waduk, piksel bersih, dan
// vegetasi apung (NDVI > 0,3 di dalam batas waduk) per petak.
function statistik(img) {
  img = ee.Image(img);
  var ada = img.select('B3').mask().gt(0);
  var scl = img.select('SCL');
  var bersih = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).unmask(0).and(ada);
  var air = img.normalizedDifference(['B3', 'B11']).gt(0).unmask(0);
  var veg = img.normalizedDifference(['B8', 'B4']).gt(0.3).unmask(0);
  var band = [
    L.rename('n_waduk'), ada.and(L).rename('n_terekam'),
    ada.and(bersih.not()).and(L).rename('n_awan'), bersih.and(L).rename('n_bersih'),
    air.and(bersih).and(L).rename('n_air'), veg.and(bersih).and(L).rename('n_veg')
  ];
  IDS.forEach(function (id, i) {
    var di = labelPetak.eq(i + 1);
    band.push(di.rename('p_' + id));
    band.push(di.and(bersih).rename('b_' + id));
    band.push(di.and(bersih).and(veg).and(L).rename('v_' + id));
  });
  var n = ee.Image.cat(band).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: AOI, crs: CRS, crsTransform: GRID,
    maxPixels: 1e10, tileScale: 4
  });
  var nb = ee.Number(n.get('n_bersih')).max(1);
  var airPct = ee.Number(n.get('n_air')).divide(nb).multiply(100);
  var sifat = {
    tanggal: img.get('tanggal'),
    'system:time_start': img.get('system:time_start'),
    bulan: ee.Date(img.get('system:time_start')).get('month'),
    terekam_pct: ee.Number(n.get('n_terekam')).divide(ee.Number(n.get('n_waduk')).max(1)).multiply(100),
    awan_pct: ee.Number(n.get('n_awan')).divide(ee.Number(n.get('n_terekam')).max(1)).multiply(100),
    air_terbuka_pct: airPct,
    sisa_pct: ee.Number(100).subtract(airPct)
      .subtract(ee.Number(n.get('n_veg')).divide(nb).multiply(100))
  };
  IDS.forEach(function (id) {
    var np = ee.Number(n.get('p_' + id));
    sifat['bersih_' + id] = ee.Algorithms.If(np.gt(0),
      ee.Number(n.get('b_' + id)).divide(np).multiply(100), -1);   // -1 = petak belum diisi
    sifat['apung_ha_' + id] = ee.Number(n.get('v_' + id)).multiply(0.04);
  });
  return ee.Feature(null, sifat);
}

// Pemeriksaan petak D–F yang tidak bergantung tanggal (satu reduceRegion).
function cekPetak() {
  if (baruTerisi.length === 0) {
    print('Pusat petak D, E, F belum diisi.');
    return;
  }
  var band = [];
  baruTerisi.forEach(function (p) {
    var di = labelPetak.eq(IDS.indexOf(p.id) + 1);
    band.push(di.rename('p_' + p.id));
    band.push(di.and(L).rename('w_' + p.id));
  });
  var n = ee.Image.cat(band).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: AOI, crs: CRS, crsTransform: GRID, maxPixels: 1e10, tileScale: 4
  });
  var gUtama = petakUtama.geometry();
  var baris = baruTerisi.map(function (p) {
    var g = kotakUTM(p.pusat);
    var wadukPct = ee.Number(n.get('w_' + p.id)).divide(ee.Number(n.get('p_' + p.id)).max(1)).multiply(100);
    var jarak = g.distance(gUtama, 1);
    var tumpangLain = baruTerisi.filter(function (q) { return q.id !== p.id; })
      .map(function (q) { return g.intersects(kotakUTM(q.pusat), 1); });
    var tumpangLainAda = tumpangLain.length ? ee.List(tumpangLain).contains(true) : ee.Algorithms.IsEqual(1, 0);
    var overlapUtama = g.intersects(gUtama, 1);
    var tumpang = ee.Algorithms.If(overlapUtama, 'YA', ee.Algorithms.If(tumpangLainAda, 'YA', 'tidak'));
    var lolos = ee.Algorithms.If(
      wadukPct.gte(MIN_WADUK_PCT).and(jarak.gte(JARAK_MIN_M)),
      ee.Algorithms.If(overlapUtama, 'TIDAK', ee.Algorithms.If(tumpangLainAda, 'TIDAK', 'Ya')),
      'TIDAK'
    );
    return ee.Feature(null, {
      petak: p.id, zona: p.zona, kode: p.kode,
      waduk_pct: wadukPct,
      jarak_ke_ABC_m: jarak,
      tumpang_tindih: tumpang,
      lolos: lolos
    });
  });
  print('Syarat petak D–F (waduk_pct >= ' + MIN_WADUK_PCT + ', jarak >= ' + JARAK_MIN_M +
    ' m, tidak tumpang tindih):', ui.Chart.feature.byFeature(ee.FeatureCollection(baris), 'petak',
      ['zona', 'kode', 'waduk_pct', 'jarak_ke_ABC_m', 'tumpang_tindih', 'lolos']).setChartType('Table'));
}


// ---------------------------------------------------------------------
// 2. MODE 'cari'
// ---------------------------------------------------------------------
Map.setOptions('SATELLITE');
Map.addLayer(petakUtama.style({color: 'ffff00', fillColor: '00000000', width: 2}), {}, 'Petak A, B, C (uji)');
Map.addLayer(petakBaru.style({color: '00ffff', fillColor: '00000000', width: 2}), {}, 'Petak D, E, F (latih)');

if (MODE === 'cari') {
  cekPetak();
  var acuan = ee.FeatureCollection([statistik(mosaik(T1)), statistik(mosaik(T2))]);
  var air1 = ee.Number(ee.Feature(acuan.toList(2).get(0)).get('air_terbuka_pct'));
  var air2 = ee.Number(ee.Feature(acuan.toList(2).get(1)).get('air_terbuka_pct'));
  var ms1 = ee.Date(T1).millis(), ms2 = ee.Date(T2).millis();
  var koleksi = s2.filterDate(MULAI, BATAS_PLTS)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_TILE_CLOUD));

  // ImageCollection.map + satu reduceRegion per citra (pola yang sama dengan Langkah 02).
  var kandidatDari = function (kol) {
    var tanggal = kol.aggregate_array('system:time_start')
      .map(function (t) { return ee.Date(t).format('YYYY-MM-dd'); }).distinct();
    var harian = ee.ImageCollection.fromImages(tanggal.map(mosaik));
    return ee.FeatureCollection(harian.map(statistik))
      .filter(ee.Filter.gte('terekam_pct', MIN_TEREKAM_PCT))
      .filter(ee.Filter.lte('awan_pct', MAX_AWAN_PCT))
      .filter(ee.Filter.gte('air_terbuka_pct', MIN_AIR_PENUH))
      .filter(ee.Filter.lte('sisa_pct', MAX_SISA_PENUH))
      .map(function (f) {
        var a = ee.Number(f.get('air_terbuka_pct'));
        var t = ee.Number(f.get('system:time_start'));
        var s1 = a.subtract(air1).abs(), s2b = a.subtract(air2).abs();
        var j1 = t.subtract(ms1).abs().divide(864e5).round();
        var j2 = t.subtract(ms2).abs().divide(864e5).round();
        var setara = s1.lte(MAKS_SELISIH_AIR).and(s2b.lte(MAKS_SELISIH_AIR))
          .and(j1.gte(JARAK_MIN_HARI)).and(j2.gte(JARAK_MIN_HARI));
        var bersih = function (id) { return ee.Number(f.get('bersih_' + id)); };
        var abc = bersih('A').min(bersih('B')).min(bersih('C'));
        var cocok = function (syarat, id) {
          return ee.Algorithms.If(bersih(id).lt(0), 'isi petak', ee.Algorithms.If(syarat, 'Ya', '-'));
        };
        var apungCukup = function (id) { return ee.Number(f.get('apung_ha_' + id)).gte(MIN_APUNG_HA); };
        return f.set({
          selisih_T1: s1, selisih_T2: s2b, jarak_T1_hari: j1, jarak_T2_hari: j2,
          cocok_T3: ee.Algorithms.If(setara.and(abc.gte(100)), 'Ya', '-'),
          cocok_D1: cocok(setara.and(bersih('D').gte(100)).and(apungCukup('D')), 'D'),
          cocok_D2: cocok(setara.and(bersih('E').gte(100)), 'E'),
          cocok_D3: cocok(setara.and(bersih('F').gte(100)).and(apungCukup('F')), 'F')
        });
      })
      .sort('system:time_start', false);
  };
  var kandidat = kandidatDari(koleksi);   // lengkap, untuk CSV
  // Untuk Console, koleksi DIFILTER per tahun SEBELUM statistik dihitung.
  var filterTahun = ee.Filter.or.apply(null, TAHUN_TAMPIL.map(function (th) {
    return ee.Filter.calendarRange(th, th, 'year');
  }).concat([ee.Filter.calendarRange(0, 0, 'year')]));
  var kandidatTampil = kandidatDari(koleksi.filter(filterTahun));

  var KOLOM = ['tanggal', 'bulan', 'awan_pct', 'air_terbuka_pct', 'selisih_T1', 'selisih_T2',
    'jarak_T1_hari', 'jarak_T2_hari', 'bersih_A', 'bersih_B', 'bersih_C',
    'bersih_D', 'bersih_E', 'bersih_F', 'apung_ha_D', 'apung_ha_F',
    'cocok_T3', 'cocok_D1', 'cocok_D2', 'cocok_D3'];
  Export.table.toDrive({
    collection: kandidat, description: '05b_kandidat_tanggal_' + VERSI_TAMBAHAN,
    folder: 'PCD_Saguling', fileFormat: 'CSV', selectors: KOLOM
  });
  print('Air terbuka T1 dan T2 (%):', air1, air2);
  print('Kandidat tahun ' + TAHUN_TAMPIL.join(', ') + ' (tabel lengkap 2019–2025: CSV di tab Tasks):',
    ui.Chart.feature.byFeature(kandidatTampil, 'tanggal', KOLOM.slice(1)).setChartType('Table'));
  print('Pilih T3 dari cocok_T3 = Ya; D1, D2, D3 dari cocok_D1/D2/D3 = Ya. Keempatnya saling ' +
    'berjarak >= ' + JARAK_MIN_HARI + ' hari, dan bulannya sebaiknya berbeda.');
  Map.centerObject(AOI, 12);


// ---------------------------------------------------------------------
// 3. MODE 'simpan'
// ---------------------------------------------------------------------
} else if (MODE === 'simpan') {
  if (T3 === '' || D1 === '' || D2 === '' || D3 === '') throw new Error('Isi T3, D1, D2, dan D3 dulu.');
  if (baruTerisi.length < 3) throw new Error('Isi pusat ketiga petak D, E, F dulu.');
  [T3, D1, D2, D3].forEach(function (d) {
    if (!(d < BATAS_PLTS)) throw new Error(d + ' tidak sebelum ' + BATAS_PLTS + ' (PLTS terapung).');
  });
  cekPetak();

  // Jarak antartanggal dan bulan (dihitung di sisi klien).
  var hari = function (s) { return Date.parse(s) / 864e5; };
  T1.evaluate(function (t1) {
    T2.evaluate(function (t2) {
      var semua = {T1: t1, T2: t2, T3: T3, D1: D1, D2: D2, D3: D3};
      var nama = Object.keys(semua);
      var langgar = [];
      nama.forEach(function (a, i) {
        nama.slice(i + 1).forEach(function (b) {
          var j = Math.abs(hari(semua[a]) - hari(semua[b]));
          if (j < JARAK_MIN_HARI) langgar.push(a + '–' + b + ': ' + Math.round(j) + ' hari');
        });
      });
      print(langgar.length ? 'PERINGATAN, jarak tanggal kurang dari ' + JARAK_MIN_HARI + ' hari: ' +
        langgar.join('; ') + '. Jangan RUN task; pilih tanggal lain.' : 'Jarak antartanggal memenuhi aturan.');
      if (D1.slice(5, 7) === D3.slice(5, 7)) {
        print('Catatan: D1 dan D3 (dua petak eceng gondok) jatuh di bulan yang sama. ' +
          'Bila ada kandidat lain, pilih bulan berbeda.');
      }
    });
  });

  // Statistik tanggal terpilih (empat reduceRegion).
  print('Statistik tanggal terpilih (cek: A/B/C bersih 100 di T3; D di D1, E di D2, F di D3; ' +
    'apung_ha_D dan apung_ha_F >= ' + MIN_APUNG_HA + ' pada tanggalnya):',
    ui.Chart.feature.byFeature(ee.FeatureCollection([T3, D1, D2, D3].map(function (d) {
      return statistik(mosaik(d));
    })), 'tanggal', ['awan_pct', 'air_terbuka_pct', 'bersih_A', 'bersih_B', 'bersih_C',
      'bersih_D', 'bersih_E', 'bersih_F', 'apung_ha_D', 'apung_ha_F']).setChartType('Table'));

  var fitur = petakBaru.map(function (f) {
    return f.set({jenis: 'petak', versi_tambahan: VERSI_TAMBAHAN});
  }).merge(ee.FeatureCollection([ee.Feature(AOI, {
    jenis: 'tanggal', t3: T3, d1: D1, d2: D2, d3: D3,
    versi_petak: VERSI_PETAK, versi_tambahan: VERSI_TAMBAHAN
  })]));
  Map.centerObject(AOI, 12);
  [['T3', T3], ['D1', D1], ['D2', D2], ['D3', D3]].forEach(function (x) {
    Map.addLayer(mosaik(x[1]), {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000}, x[0] + ' · false color', false);
  });
  Export.table.toAsset({
    collection: fitur,
    description: 'saguling_tambahan_' + VERSI_TAMBAHAN,
    assetId: ASSET + 'saguling_tambahan_' + VERSI_TAMBAHAN
  });
  print('Bila semua pemeriksaan lolos: tab Tasks -> RUN. Catat T3, D1–D3, petak D–F, ' +
    'dan alasannya di Excel Tabel 3 dan 4.');
}