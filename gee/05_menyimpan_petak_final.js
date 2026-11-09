// =====================================================================
// LANGKAH 05 — MENYIMPAN PETAK FINAL (dan T1, T2)
// ---------------------------------------------------------------------
// Tujuan   : Menyimpan tiga petak final sebagai SATU Asset, sekaligus
//            mencatat T1 dan T2 di dalamnya. Semua langkah berikutnya
//            (06, 07, 08) membaca Asset ini, sehingga koordinat dan
//            tanggal tidak perlu disalin ulang.
// Masukan  : T1, T2 (Langkah 02) dan koordinat final (Langkah 03/04).
// Keluaran : Asset saguling_petak_<versi> (3 fitur: A, B, C; properti t1, t2).
// Cara pakai:
//   1. Isi parameter, Run. Pastikan luas = 100 ha dan tumpang tindih = false.
//   2. Tab Tasks -> RUN. Catat di Excel Tabel 6.
//
// VERSI ASSET
//   Setiap Asset diberi akhiran versi (v1, v2, ...). Asset lama TIDAK
//   ditimpa atau dihapus; versi lama otomatis menjadi arsip. Bila langkah
//   ini diulang, naikkan versinya, lalu sesuaikan versi yang DIBACA di
//   langkah sesudahnya. Catat setiap versi baru di Excel Tabel 13.
//   Petak berubah -> ulangi 05 (versi baru), 06 untuk petak yang pindah,
//   lalu 08. Lihat tabel di 00_BACA_DULU.txt.
//
// Mengapa kotak dibuat di sistem UTM?
//   Citra Sentinel-2 di Saguling memakai UTM zona 48S (EPSG:32748)
//   dengan grid 10/20 m. Pusat petak dibulatkan ke kelipatan 20 m dan
//   sisinya 1000 m, sehingga tiap petak TEPAT 50 x 50 piksel dan
//   sejajar grid. Referensi (Langkah 06) dan peta hasil (Langkah 07)
//   akan bertumpuk piksel demi piksel tanpa geser.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER — ISI DARI HASIL LANGKAH SEBELUMNYA
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK = 'v1';   // versi Asset yang DITULIS langkah ini; naikkan bila diulang
var T1 = '';    // format 'YYYY-MM-DD'
var T2 = '';    // format 'YYYY-MM-DD'

var PETAK = [
  {id: 'A', zona: 'Air terbuka dan tepian', pusat: null},   // [bujur, lintang]
  {id: 'B', zona: 'Eceng gondok',           pusat: null},
  {id: 'C', zona: 'KJA',                    pusat: null}
];
var SISI_M = 1000;
var CRS = 'EPSG:32748';

if (T1 === '' || T2 === '' || PETAK.some(function (p) { return p.pusat === null; })) {
  throw new Error('Isi T1, T2, dan ketiga koordinat petak dulu.');
}


// ---------------------------------------------------------------------
// 1. KOTAK PETAK SEJAJAR GRID 20 m
// ---------------------------------------------------------------------
function kotakUTM(lonlat) {
  var xy = ee.Geometry.Point(lonlat).transform(CRS, 1).coordinates();
  var x = ee.Number(xy.get(0)).divide(20).round().multiply(20);   // bulatkan ke 20 m
  var y = ee.Number(xy.get(1)).divide(20).round().multiply(20);
  var h = SISI_M / 2;
  return ee.Geometry.Rectangle(
    ee.List([x.subtract(h), y.subtract(h), x.add(h), y.add(h)]), CRS, false);
}

var petak = ee.FeatureCollection(PETAK.map(function (p) {
  return ee.Feature(kotakUTM(p.pusat), {
    id: p.id, zona: p.zona,
    bujur: p.pusat[0], lintang: p.pusat[1],
    t1: T1, t2: T2,                      // tanggal ikut disimpan
    versi_petak: VERSI_PETAK
  });
}));


// ---------------------------------------------------------------------
// 2. PEMERIKSAAN
// ---------------------------------------------------------------------
print('Luas tiap petak (ha) — harus 100:', petak.map(function (f) {
  return f.set('luas_ha', f.geometry().area(1).divide(1e4));
}).aggregate_array('luas_ha'));

PETAK.forEach(function (p, i) {
  PETAK.slice(i + 1).forEach(function (q) {
    print('Petak ' + p.id + ' dan ' + q.id + ' tumpang tindih? (harus false)',
      kotakUTM(p.pusat).intersects(kotakUTM(q.pusat), 1));
  });
});

Map.centerObject(petak, 12);
Map.setOptions('SATELLITE');
Map.addLayer(petak.style({color: 'ffff00', fillColor: '00000000', width: 2}), {}, 'Petak final');


// ---------------------------------------------------------------------
// 3. EKSPOR
// ---------------------------------------------------------------------
Export.table.toAsset({
  collection: petak,
  description: 'saguling_petak_' + VERSI_PETAK,
  assetId: ASSET + 'saguling_petak_' + VERSI_PETAK
});
