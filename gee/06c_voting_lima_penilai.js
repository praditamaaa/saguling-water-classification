// =====================================================================
// LANGKAH 06c — MENGGABUNGKAN LIMA PENILAI DENGAN VOTING
// ---------------------------------------------------------------------
// Tujuan   : Menggabungkan referensi lima penilai menjadi satu referensi
//            per petak x tanggal dengan voting mayoritas (minimal 3 dari 5),
//            lalu mengukur seberapa sepakat para penilai.
// Masukan  : Asset saguling_ref_<petak>_<T>_<pN>_<versi> dari Langkah 06b,
//            untuk setiap kombinasi di PETAK_KODE x 5 penilai
//            (12 kombinasi x 5 = 60 Asset pada v2), masing-masing 4 band:
//            r_air, r_waduk, r_eg, r_kja.
// Keluaran : - 1 Asset per kombinasi saguling_ref_<petak>_<T>_vote_<versi>:
//                r_air, r_waduk, r_eg, r_kja   hasil voting (0/1)
//                sepakat_r_air ... sepakat_r_kja
//                    jumlah penilai di pihak mayoritas:
//                    5 = sepakat penuh, 4 = cukup yakin, 3 = zona ragu
//            - CSV 06c_kesepakatan_<versi>  : Fleiss' kappa dan persentase
//              piksel per tingkat kesepakatan, per petak x tanggal x band.
//            - CSV 06c_iou_pasangan_<versi> : IoU 10 pasangan penilai.
//            - Console: silsilah versi, kesetaraan penilai, uji bias tim.
// Dipakai  : Langkah 08 (VERSI_REF = 'vote_v2') dan Langkah 10 (dataset ML).
//
// CATATAN
//   - Voting dilakukan terpisah per band. Di tiap penilai r_air selalu di
//     dalam r_waduk, dan r_eg tidak pernah tumpang tindih dengan r_kja;
//     kedua sifat itu tetap berlaku setelah voting.
//   - Piksel bisa masuk r_waduk tanpa satu kelas pun (air, eceng gondok,
//     KJA) mencapai mayoritas, misalnya suara 2-2-1. Piksel itu tetap
//     dihitung waduk; persentasenya dicetak sebagai pct_tanpa_kelas.
//   - Kappa dihitung di seluruh petak, termasuk daratan dan air yang jelas,
//     sehingga cenderung tinggi. Baca bersama persentase zona ragu.
//   - Dengan dua anggota tim, kelompok "tim-tim" hanya berisi satu
//     pasangan (p1-p2) per petak x tanggal x band.
//   - Langkah ini membuat Asset baru. Bila diulang, naikkan VERSI_VOTE.
//   - Agar tidak memicu "Too many concurrent aggregations", semua tanggal
//     dan semua ukuran satu petak dihitung dalam SATU reduceRegion
//     (6 agregasi untuk 6 petak). Kappa, persentase kesepakatan, dan IoU
//     diturunkan dari jumlah-jumlah tersebut.
// =====================================================================


// ---------------------------------------------------------------------
// 0. PARAMETER
// ---------------------------------------------------------------------
var ASSET = 'projects/earth-engine-511102/assets/';
var VERSI_PETAK    = 'v1';   // dari Langkah 05
var VERSI_TAMBAHAN = 'v1';   // dari Langkah 05b (petak D, E, F)
var VERSI_PENILAI  = 'v2';   // akhiran Asset penilai: saguling_ref_A_T1_p1_<v>
var VERSI_VOTE     = 'v2';   // Asset yang DITULIS: saguling_ref_A_T1_vote_<v>

var PENILAI = ['p1', 'p2', 'p3', 'p4', 'p5'];
var TIM     = ['p1', 'p2'];  // anggota tim; sisanya penilai luar tim

// Kombinasi yang di-voting. Hapus yang belum selesai digambar, misalnya
// jalankan dulu hanya {A: ['T1','T2'], B: ['T1','T2'], C: ['T1','T2']}.
var PETAK_KODE = {
  A: ['T1', 'T2', 'T3'], B: ['T1', 'T2', 'T3'], C: ['T1', 'T2', 'T3'],
  D: ['D1'], E: ['D2'], F: ['D3']
};

// Peta yang ditampilkan di layar.
var TAMPIL = {petak: 'B', kode: 'T1', band: 'r_waduk'};

var CRS = 'EPSG:32748';
var GRID = [10, 0, 0, 0, -10, 0];   // grid analisis 10 m
var BAND = ['r_air', 'r_waduk', 'r_eg', 'r_kja'];
var N = PENILAI.length;
var AMBANG = Math.floor(N / 2) + 1;   // 3 dari 5


// ---------------------------------------------------------------------
// 1. DATA DAN PEMERIKSAAN AWAL
// ---------------------------------------------------------------------
var petakUtama = ee.FeatureCollection(ASSET + 'saguling_petak_' + VERSI_PETAK);
var PETAK = Object.keys(PETAK_KODE);
var perluTambahan = PETAK.some(function (id) { return ['D', 'E', 'F'].indexOf(id) >= 0; }) ||
  PETAK.some(function (id) { return PETAK_KODE[id].indexOf('T3') >= 0; });
var tambahan = ee.FeatureCollection([]);
if (perluTambahan) {
  var idTambahan = ASSET + 'saguling_tambahan_' + VERSI_TAMBAHAN;
  var adaTambahan = false;
  try { adaTambahan = ee.data.getAsset(idTambahan) !== null; } catch (e) { adaTambahan = false; }
  if (!adaTambahan) throw new Error('Asset ' + idTambahan + ' belum ada. Jalankan Langkah 05b, ' +
    'atau keluarkan T3 dan petak D–F dari PETAK_KODE.');
  tambahan = ee.FeatureCollection(idTambahan);
}
function utama(id) { return ['A', 'B', 'C'].indexOf(id) >= 0; }
function geomPetak(id) {
  var fc = utama(id) ? petakUtama : tambahan.filter(ee.Filter.eq('jenis', 'petak'));
  return fc.filter(ee.Filter.eq('id', id)).geometry();
}
function silsilahPetak(id) {
  return utama(id) ? VERSI_PETAK : 'tambahan_' + VERSI_TAMBAHAN;
}
function tanggal(kode) {
  if (kode === 'T1' || kode === 'T2') return ee.String(petakUtama.first().get(kode.toLowerCase()));
  return ee.String(ee.Feature(tambahan.filter(ee.Filter.eq('jenis', 'tanggal')).first())
    .get(kode.toLowerCase()));
}
function pathPenilai(kunci, p) {
  return ASSET + 'saguling_ref_' + kunci + '_' + p + '_' + VERSI_PENILAI;
}

var KUNCI = [];
PETAK.forEach(function (id) {
  PETAK_KODE[id].forEach(function (kode) { KUNCI.push(id + '_' + kode); });
});

// Hentikan skrip bila ada Asset penilai yang belum diekspor.
var hilang = [];
KUNCI.forEach(function (k) {
  PENILAI.forEach(function (p) {
    var info = null;
    try { info = ee.data.getAsset(pathPenilai(k, p)); } catch (e) { info = null; }
    if (!info) hilang.push('saguling_ref_' + k + '_' + p + '_' + VERSI_PENILAI);
  });
});
if (hilang.length > 0) {
  print('Asset penilai yang belum ada:', hilang);
  throw new Error('Masih ada ' + hilang.length + ' dari ' + (KUNCI.length * N) +
    ' Asset penilai yang belum ada. Lihat daftar di Console, atau kurangi PETAK_KODE.');
}

// Silsilah: hanya membaca properti Asset (tanpa agregasi piksel).
var silsilah = [];
KUNCI.forEach(function (k) {
  PENILAI.forEach(function (p) {
    var v = ee.Image(pathPenilai(k, p)).get('versi_petak');
    silsilah.push(ee.Feature(null, {
      referensi: k + '_' + p,
      versi_petak_saat_digambar: v,
      cocok: ee.Algorithms.If(ee.Algorithms.IsEqual(v, silsilahPetak(k.slice(0, 1))), 'Ya', 'TIDAK')
    }));
  });
});
print('Silsilah ' + (KUNCI.length * N) + ' referensi penilai (semua harus "Ya"):',
  ui.Chart.feature.byFeature(ee.FeatureCollection(silsilah), 'referensi',
    ['versi_petak_saat_digambar', 'cocok']).setChartType('Table'));


// ---------------------------------------------------------------------
// 2. VOTING
//    s       = jumlah penilai yang memilih 1, per band (0..5)
//    vote    = 1 bila s >= 3
//    sepakat = jumlah penilai di pihak mayoritas = max(s, 5 - s)
// ---------------------------------------------------------------------
function citraPenilai(kunci, p) {
  return ee.Image(pathPenilai(kunci, p)).select(BAND).unmask(0).toByte();
}

function gabung(kunci) {
  var g = geomPetak(kunci.slice(0, 1));
  var imgs = PENILAI.map(function (p) { return citraPenilai(kunci, p); });
  var s = ee.ImageCollection.fromImages(imgs).sum();
  var vote = s.gte(AMBANG).rename(BAND);
  var sepakat = s.max(s.multiply(-1).add(N))
    .rename(BAND.map(function (b) { return 'sepakat_' + b; }));
  return {g: g, imgs: imgs, s: s, vote: vote, sepakat: sepakat};
}

KUNCI.forEach(function (k) {
  var r = gabung(k);
  var hasil = r.vote.addBands(r.sepakat).toByte().clip(r.g).set({
    versi_petak: silsilahPetak(k.slice(0, 1)),
    versi_ref: 'vote_' + VERSI_VOTE,
    versi_penilai: VERSI_PENILAI,
    tanggal: tanggal(k.slice(2)),
    penilai: PENILAI.join(','),
    tim: TIM.join(','),
    jumlah_penilai: N,
    ambang_voting: AMBANG
  });
  Export.image.toAsset({
    image: hasil,
    description: 'ref_' + k + '_vote_' + VERSI_VOTE,
    assetId: ASSET + 'saguling_ref_' + k + '_vote_' + VERSI_VOTE,
    region: r.g,
    crs: CRS, crsTransform: GRID,
    pyramidingPolicy: {'.default': 'mode'}
  });
});


// ---------------------------------------------------------------------
// 3. BAND UKURAN PER KOMBINASI
//    Fleiss' kappa (dua kelas, N penilai), per piksel i:
//      P_i = [s(s-1) + (N-s)(N-s-1)] / [N(N-1)]
//    P_bar = rata-rata P_i;  p = rata-rata s / N;  P_e = p^2 + (1-p)^2
//    kappa = (P_bar - P_e) / (1 - P_e)      [Fleiss, 1971]
//    kappa = -1 bila tidak terdefinisi (semua penilai menjawab 0 di
//    seluruh petak, misalnya KJA di petak A).
//    IoU pasangan = |A dan B| / |A atau B|; -1 bila keduanya kosong.
//    Semua ukuran dinyatakan sebagai JUMLAH, sehingga satu reduceRegion
//    per petak cukup; rata-rata = jumlah / n.
// ---------------------------------------------------------------------
var TINGKAT = [];
for (var t = AMBANG; t <= N; t++) TINGKAT.push(t);
var PASANGAN = [];
for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) PASANGAN.push([i, j]);

function bandUkuran(kunci) {
  var r = gabung(kunci);
  var pre = kunci + '__';
  var band = [ee.Image(1).rename(pre + 'n')];
  BAND.forEach(function (b) {
    var sb = r.s.select(b).toFloat();
    var lawan = sb.multiply(-1).add(N);
    band.push(sb.rename(pre + 's_' + b));
    band.push(sb.multiply(sb.subtract(1)).add(lawan.multiply(lawan.subtract(1)))
      .divide(N * (N - 1)).rename(pre + 'pi_' + b));
    TINGKAT.forEach(function (t) {
      band.push(r.sepakat.select('sepakat_' + b).eq(t).rename(pre + 'f' + t + '_' + b));
    });
    PASANGAN.forEach(function (ij) {
      var a = r.imgs[ij[0]].select(b), c = r.imgs[ij[1]].select(b);
      var key = ij[0] + '_' + ij[1] + '_' + b;
      band.push(a.and(c).rename(pre + 'i_' + key));
      band.push(a.or(c).rename(pre + 'u_' + key));
    });
  });
  var v = r.vote;
  band.push(v.select('r_waduk')
    .and(v.select('r_air').or(v.select('r_eg')).or(v.select('r_kja')).not())
    .rename(pre + 'tanpa_kelas'));
  return ee.Image.cat(band).toFloat();
}

function kelompok(pa, pb) {
  var ta = TIM.indexOf(pa) >= 0, tb = TIM.indexOf(pb) >= 0;
  return (ta && tb) ? 'tim-tim' : ((ta || tb) ? 'tim-luar' : 'luar-luar');
}

// SATU reduceRegion per petak (semua tanggalnya sekaligus).
var barisK = [], barisP = [];
PETAK.forEach(function (id) {
  var kunciPetak = PETAK_KODE[id].map(function (kode) { return id + '_' + kode; });
  var jumlah = ee.Image.cat(kunciPetak.map(bandUkuran)).reduceRegion({
    reducer: ee.Reducer.sum(), geometry: geomPetak(id),
    crs: CRS, crsTransform: GRID, maxPixels: 1e9, tileScale: 4
  });
  kunciPetak.forEach(function (kunci) {
    var pre = kunci + '__';
    var n = ee.Number(jumlah.get(pre + 'n'));
    var rata = function (nama) { return ee.Number(jumlah.get(pre + nama)).divide(n); };
    BAND.forEach(function (b) {
      var p = rata('s_' + b).divide(N);
      var pe = p.pow(2).add(ee.Number(1).subtract(p).pow(2));
      var pbar = rata('pi_' + b);
      var sifat = {
        kunci: kunci, petak: id, kode: kunci.slice(2), band: b,
        kappa: ee.Algorithms.If(pe.lt(1), pbar.subtract(pe).divide(ee.Number(1).subtract(pe)), -1),
        proporsi_ya: p,
        pct_tanpa_kelas: rata('tanpa_kelas').multiply(100),
        versi: 'vote_' + VERSI_VOTE
      };
      TINGKAT.forEach(function (t) {
        sifat['pct_sepakat_' + t] = rata('f' + t + '_' + b).multiply(100);
      });
      barisK.push(ee.Feature(null, sifat));
      PASANGAN.forEach(function (ij) {
        var key = ij[0] + '_' + ij[1] + '_' + b;
        var I = ee.Number(jumlah.get(pre + 'i_' + key));
        var U = ee.Number(jumlah.get(pre + 'u_' + key));
        barisP.push(ee.Feature(null, {
          kunci: kunci, petak: id, kode: kunci.slice(2), band: b,
          penilai_a: PENILAI[ij[0]], penilai_b: PENILAI[ij[1]],
          kelompok: kelompok(PENILAI[ij[0]], PENILAI[ij[1]]),
          irisan: I, gabungan: U,
          iou: ee.Algorithms.If(U.gt(0), I.divide(U), -1)
        }));
      });
    });
  });
});
var fcK = ee.FeatureCollection(barisK);
var fcP = ee.FeatureCollection(barisP);


// ---------------------------------------------------------------------
// 4. RINGKASAN DI CONSOLE
// ---------------------------------------------------------------------
var kolomK = ['kappa'].concat(TINGKAT.slice().reverse().map(function (t) {
  return 'pct_sepakat_' + t;
})).concat(['pct_tanpa_kelas']);
BAND.forEach(function (b) {
  print('Kesepakatan ' + b + ' (pct_sepakat_5 = sepakat penuh, _3 = zona ragu):',
    ui.Chart.feature.byFeature(fcK.filter(ee.Filter.eq('band', b)), 'kunci', kolomK)
      .setChartType('Table'));
});

function rataIoU(fc) {
  fc = fc.filter(ee.Filter.gte('iou', 0));
  return ee.Algorithms.If(fc.size().gt(0), fc.aggregate_mean('iou'), -1);
}

// Kesetaraan penilai: rata-rata IoU tiap penilai terhadap empat penilai lain.
var kesetaraan = ee.FeatureCollection(PENILAI.map(function (p) {
  var sifat = {penilai: p, status: TIM.indexOf(p) >= 0 ? 'tim' : 'luar'};
  BAND.forEach(function (b) {
    sifat['iou_' + b] = rataIoU(fcP.filter(ee.Filter.and(
      ee.Filter.eq('band', b),
      ee.Filter.or(ee.Filter.eq('penilai_a', p), ee.Filter.eq('penilai_b', p)))));
  });
  return ee.Feature(null, sifat);
}));
print('Kesetaraan penilai: rata-rata IoU terhadap empat penilai lain (semua kombinasi):',
  ui.Chart.feature.byFeature(kesetaraan, 'penilai',
    ['status'].concat(BAND.map(function (b) { return 'iou_' + b; }))).setChartType('Table'));

// Uji bias tim: bila tim-tim jauh lebih tinggi daripada tim-luar dan
// luar-luar, ada tanda bias bersama di antara anggota tim.
var biasTim = ee.FeatureCollection(['tim-tim', 'tim-luar', 'luar-luar'].map(function (kel) {
  var sifat = {kelompok: kel};
  BAND.forEach(function (b) {
    var f = fcP.filter(ee.Filter.and(ee.Filter.eq('band', b), ee.Filter.eq('kelompok', kel)));
    sifat['iou_' + b] = rataIoU(f);
  });
  return ee.Feature(null, sifat);
}));
print('Uji bias tim: rata-rata IoU per kelompok pasangan:',
  ui.Chart.feature.byFeature(biasTim, 'kelompok',
    BAND.map(function (b) { return 'iou_' + b; })).setChartType('Table'));


// ---------------------------------------------------------------------
// 5. EKSPOR CSV
// ---------------------------------------------------------------------
Export.table.toDrive({
  collection: fcK, description: '06c_kesepakatan_vote_' + VERSI_VOTE,
  folder: 'PCD_Saguling', fileFormat: 'CSV',
  selectors: ['petak', 'kode', 'band', 'proporsi_ya'].concat(kolomK).concat(['versi'])
});
Export.table.toDrive({
  collection: fcP, description: '06c_iou_pasangan_vote_' + VERSI_VOTE,
  folder: 'PCD_Saguling', fileFormat: 'CSV',
  selectors: ['petak', 'kode', 'band', 'penilai_a', 'penilai_b', 'kelompok',
    'irisan', 'gabungan', 'iou']
});


// ---------------------------------------------------------------------
// 6. PETA KESEPAKATAN
//    Hanya piksel yang TIDAK disepakati penuh yang diwarnai:
//    oranye tua = zona ragu (3-2), oranye muda = cukup yakin (4-1).
// ---------------------------------------------------------------------
var kT = TAMPIL.petak + '_' + TAMPIL.kode;
if (KUNCI.indexOf(kT) < 0) throw new Error('TAMPIL ' + kT + ' tidak ada di PETAK_KODE.');
var rT = gabung(kT);
var dT = ee.Date(tanggal(TAMPIL.kode));
var citraT = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(rT.g)
  .filterDate(dT, dT.advance(1, 'day')).mosaic().clip(rT.g);
var spT = rT.sepakat.select('sepakat_' + TAMPIL.band);

Map.centerObject(rT.g, 15);
Map.setOptions('SATELLITE');
Map.addLayer(citraT, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000}, 'False color ' + kT);
Map.addLayer(rT.vote.select(TAMPIL.band).selfMask().clip(rT.g),
  {palette: ['2166ac'], opacity: 0.5}, 'Hasil voting ' + TAMPIL.band, false);
Map.addLayer(spT.updateMask(spT.lt(N)).clip(rT.g),
  {min: AMBANG, max: N - 1, palette: ['e66101', 'fdb863']},
  'Kesepakatan tidak penuh ' + TAMPIL.band);
PENILAI.forEach(function (p, i) {
  Map.addLayer(rT.imgs[i].select(TAMPIL.band).selfMask().clip(rT.g),
    {palette: ['ffffff'], opacity: 0.4}, 'Penilai ' + p, false);
});
