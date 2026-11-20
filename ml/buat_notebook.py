"""Membangun ml/11_pelatihan_model.ipynb dari sel-sel di bawah.

Notebook dibuat dari skrip ini agar isinya mudah dibandingkan di Git.
Jalankan:  python ml/buat_notebook.py
"""
import pathlib
import nbformat as nbf

nb = nbf.v4.new_notebook()
C = []
md = lambda s: C.append(nbf.v4.new_markdown_cell(s.strip()))
code = lambda s: C.append(nbf.v4.new_code_cell(s.strip()))

md(r"""
# Langkah 11 — Pelatihan dan Perbandingan Model Machine Learning
**Klasifikasi air terbuka, eceng gondok, dan KJA di Waduk Saguling (Sentinel-2, fitur PCD)**

Notebook ini berjalan di **Kaggle** dan **Google Colab** tanpa perubahan kode.

| Lingkungan | Cara menyiapkan data |
| --- | --- |
| Kaggle | *Add Input* → *Upload* → unggah CSV `dataset_T1_v1.csv`, `dataset_T2_v1.csv`, `dataset_D1_v1.csv`, `dataset_D2_v1.csv`, `dataset_D3_v1.csv`, `dataset_T3_v1.csv` (dan opsional `waduk_T3_v1.csv`) sebagai satu Dataset. Notebook mencarinya otomatis di `/kaggle/input`. |
| Colab | CSV sudah ada di Google Drive folder `PCD_Saguling` (hasil Langkah 10). Notebook akan meminta izin *mount* Drive. |

Hasil (tabel CSV, gambar PNG, model) disimpan ke `hasil_ml/`. Di Kaggle unduh dari tab *Output*; di Colab tersimpan di Drive.

**Urutan eksperimen** (lihat `docs/metodologi-ml.md`):
**Data:** latih = petak A–C pada T1, T2 + petak D (D1), E (D2), F (D3); uji = petak A–C pada T3.

**Pemilihan model terbaik memakai skor validasi silang pada data latih, bukan skor T3**, agar data uji tidak ikut menentukan keputusan apa pun.

1. **E1 Perbandingan model**: 5 model × fitur lengkap, dilatih pada semua data latih, diuji di T3.
2. **E2 Ablasi fitur PCD**: 4 kelompok fitur bertambah (F0 → F0–F3) untuk setiap model.
3. **E3 Uji statistik**: McNemar (koreksi Holm) dan interval kepercayaan bootstrap per blok.
4. **E4 Analisis**: matriks konfusi, kepentingan fitur, uji silang antartanggal, pembanding PCD.
5. **E5 Petak latih tambahan**: model terbaik dilatih dengan dan tanpa petak D–F, lalu dibandingkan di T3.
6. **(Opsional) Peta dan luas seluruh waduk.**

Jalankan **Runtime → Run all**. Waktu jalan biasanya beberapa menit; SVM adalah yang paling lama.
""")

md("## 0. Parameter")
code(r"""
# ====== PARAMETER YANG BOLEH DIUBAH ======
VERSI_DATASET = 'v1'          # akhiran CSV dari Langkah 10
LATIH = ['T1', 'T2', 'D1', 'D2', 'D3']   # tanggal data latih (D1 = petak D, D2 = E, D3 = F)
PETAK_TAMBAHAN = ['D', 'E', 'F']    # petak latih tambahan (Langkah 05b)
UJI = 'T3'                    # tanggal data uji (tidak pernah dilihat saat pelatihan)
MIN_SEPAKAT_LATIH = 4         # data latih hanya piksel yang disepakati >= 4 dari 5 penilai
BUANG_EG_PETAK_C = True       # piksel eceng gondok petak C tidak dipakai melatih (ambigu di sekitar KJA)
UKURAN_BLOK_M = 200           # blok spasial minimum (10 x 10 piksel) untuk validasi silang dan bootstrap
BLOK_OTOMATIS = True          # True: blok diperbesar bila jangkauan autokorelasi label > UKURAN_BLOK_M
BATAS_KORELASI = 0.05         # jangkauan autokorelasi = jarak pertama saat korelasi < nilai ini
N_FOLD = 5                    # GroupKFold pada blok untuk penyetelan hiperparameter
SEEDS = [0, 1, 2, 3, 4]       # pengulangan untuk model acak (RF, HGB, MLP)
N_BOOT = 1000                 # ulangan bootstrap
N_PERMUTASI = 10              # ulangan permutation importance
MAKS_LATIH_PER_KELAS = None   # mis. 3000 untuk mempercepat; None = pakai semua
SEED_UTAMA = 0
""")

md("## 1. Lingkungan dan lokasi data")
code(r"""
import os, sys, glob, json, time, warnings, platform
warnings.filterwarnings('ignore')

def deteksi_lingkungan():
    if os.environ.get('PCD_DATA_DIR'):                       # untuk uji lokal
        return 'lokal', os.environ['PCD_DATA_DIR'], os.environ.get('PCD_OUT_DIR', './hasil_ml')
    if os.path.exists('/kaggle/input'):
        return 'kaggle', '/kaggle/input', '/kaggle/working/hasil_ml'
    try:
        import google.colab  # noqa: F401
        from google.colab import drive
        drive.mount('/content/drive')
        d = '/content/drive/MyDrive/PCD_Saguling'
        return 'colab', d, d + '/hasil_ml'
    except ImportError:
        return 'lokal', './data', './hasil_ml'

LINGKUNGAN, DATA_DIR, OUT_DIR = deteksi_lingkungan()
os.makedirs(OUT_DIR, exist_ok=True)

def cari(nama):
    hasil = glob.glob(os.path.join(DATA_DIR, '**', nama), recursive=True)
    return sorted(hasil)[0] if hasil else None

print('Lingkungan :', LINGKUNGAN)
print('Folder data:', DATA_DIR)
print('Folder hasil:', OUT_DIR)
""")

code(r"""
import numpy as np, pandas as pd, sklearn, scipy
import matplotlib.pyplot as plt
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV, GroupKFold
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (accuracy_score, f1_score, cohen_kappa_score,
                             confusion_matrix, precision_recall_fscore_support)
from scipy.stats import chi2, binomtest

VERSI = {'python': platform.python_version(), 'numpy': np.__version__, 'pandas': pd.__version__,
         'scikit-learn': sklearn.__version__, 'scipy': scipy.__version__}
print(VERSI)
""")

md("## 2. Memuat dan memeriksa dataset")
code(r"""
KELAS = {0: 'Air', 1: 'Eceng gondok', 2: 'KJA'}
F0 = ['B2', 'B3', 'B4', 'B8', 'B5', 'B6', 'B7', 'B8A', 'B11', 'B12']
F1 = ['ndwi', 'mndwi', 'ndvi']
F2 = ['sd_nir', 'glcm_kontras', 'glcm_homogen', 'glcm_entropi', 'kepadatan_tepi']
F3 = ['tophat_putih', 'tophat_hitam', 'luas_komponen', 'jarak_air']
KELOMPOK = {'F0': F0, 'F1': F1, 'F2': F2, 'F3': F3}
SET_FITUR = {                         # E2: kelompok fitur bertambah
    'F0': F0,
    'F0-F1': F0 + F1,
    'F0-F2': F0 + F1 + F2,
    'F0-F3': F0 + F1 + F2 + F3,
}
LENGKAP = 'F0-F3'

def muat(kode):
    p = cari(f'dataset_{kode}_{VERSI_DATASET}.csv')
    if p is None:
        return None
    d = pd.read_csv(p)
    print(f'{kode}: {len(d):,} baris dari {p}')
    return d

data = {k: muat(k) for k in sorted(set(LATIH + [UJI]))}
UJI_COBA = data.get(UJI) is None
if UJI_COBA:
    # Uji coba sebelum T3 dilabeli: T2 menjadi data uji. JANGAN dipakai untuk naskah.
    print(f'PERINGATAN: dataset {UJI} tidak ditemukan. Mode uji coba: T2 menjadi data uji.')
    LATIH, UJI = [k for k in LATIH if k != 'T2'], 'T2'
tanpa = [k for k in LATIH if k in ('D1', 'D2', 'D3') and data.get(k) is None]
if tanpa:
    print(f'PERINGATAN: {tanpa} belum ada; dilatih tanpa petak tambahan pada tanggal itu.')
    LATIH = [k for k in LATIH if k not in tanpa]
hilang = [k for k in LATIH + [UJI] if data.get(k) is None]
assert not hilang, f'CSV tidak ditemukan untuk {hilang} di {DATA_DIR}'
df = pd.concat([data[k] for k in LATIH + [UJI]], ignore_index=True)

wajib = ['kode', 'petak', 'x', 'y', 'label', 'sepakat', 'air_pcd', 'waduk_pcd'] + sum(KELOMPOK.values(), [])
kurang = [c for c in wajib if c not in df.columns]
assert not kurang, f'Kolom hilang: {kurang}'

# Transformasi log untuk dua fitur yang sangat menceng (tidak mengubah urutan nilai).
for c in ['luas_komponen', 'jarak_air']:
    df[c] = np.log1p(df[c].clip(lower=0))

# Blok spasial 200 m per petak per tanggal (dipakai GroupKFold dan bootstrap).
x0 = df.groupby('petak')['x'].transform('min'); y0 = df.groupby('petak')['y'].transform('min')
df['blok'] = (df['kode'] + '_' + df['petak'] + '_' +
              ((df['x'] - x0) // UKURAN_BLOK_M).astype(int).astype(str) + '_' +
              ((df['y'] - y0) // UKURAN_BLOK_M).astype(int).astype(str))

nama_label = {-1: 'tanpa kelas', 0: 'air', 1: 'eceng gondok', 2: 'KJA', 3: 'luar waduk'}
ringkas = (df.assign(kelas=df['label'].map(nama_label))
             .pivot_table(index=['kode', 'petak'], columns='kelas', values='x', aggfunc='count', fill_value=0))
display(ringkas) if 'display' in globals() else print(ringkas)
ringkas.to_csv(f'{OUT_DIR}/jumlah_piksel_per_kelas.csv')
""")

md(r"""
## 2b. Jangkauan autokorelasi spasial (dasar ukuran blok)
Roberts dkk. (2017) menyatakan jarak pemisah minimum dalam validasi silang adalah jangkauan autokorelasi, dan blok sebaiknya lebih besar daripadanya. Sel ini mengukur korelogram label (indikator tiap kelas) dan dua fitur di dalam tiap petak-tanggal. Jangkauan = jarak pertama saat korelasi turun di bawah `BATAS_KORELASI`. Bila jangkauan label melebihi `UKURAN_BLOK_M`, blok diperbesar otomatis. Korelogram residu model diperiksa lagi setelah E1.
""")
code(r"""
def korelogram(d, kolom, maks=1000, langkah=40, n_pasang=40000, seed=0):
    # Korelasi rata-rata pasangan piksel per kelas jarak, dihitung di dalam tiap petak-tanggal.
    rng = np.random.RandomState(seed)
    tepi = np.arange(0, maks + langkah, langkah)
    jum = {c: np.zeros(len(tepi) - 1) for c in kolom}; n = np.zeros(len(tepi) - 1)
    for _, g in d.groupby(['kode', 'petak']):
        if len(g) < 50:
            continue
        xy = g[['x', 'y']].values.astype(float)
        i = rng.randint(0, len(g), n_pasang); j = rng.randint(0, len(g), n_pasang)
        jarak = np.hypot(*(xy[i] - xy[j]).T)
        b = np.digitize(jarak, tepi) - 1
        ok = (b >= 0) & (b < len(n)) & (jarak > 0)
        np.add.at(n, b[ok], 1)
        for c in kolom:
            v = g[c].values.astype(float)
            z = (v - v.mean()) / (v.std() + 1e-12)
            np.add.at(jum[c], b[ok], (z[i] * z[j])[ok])
    tengah = (tepi[:-1] + tepi[1:]) / 2
    return pd.DataFrame({c: jum[c] / np.maximum(n, 1) for c in kolom}, index=tengah)

def jangkauan(seri, batas=BATAS_KORELASI):
    di_bawah = seri[seri < batas]
    return float(di_bawah.index[0]) if len(di_bawah) else float('inf')

dlab = df[df['label'].isin([0, 1, 2])].copy()
for k, nama in KELAS.items():
    dlab[f'kelas_{k}'] = (dlab['label'] == k).astype(float)
kor = korelogram(dlab, [f'kelas_{k}' for k in KELAS] + ['ndvi', 'mndwi'])
rentang = {c: jangkauan(kor[c]) for c in kor.columns}
tabel_rentang = pd.Series(rentang, name='jangkauan_m')
display(tabel_rentang.to_frame()) if 'display' in globals() else print(tabel_rentang)
tabel_rentang.to_csv(f'{OUT_DIR}/autokorelasi_jangkauan.csv'); kor.round(4).to_csv(f'{OUT_DIR}/autokorelasi_korelogram.csv')

r_label = max(v for c, v in rentang.items() if c.startswith('kelas_') and np.isfinite(v)) if any(
    np.isfinite(v) for c, v in rentang.items() if c.startswith('kelas_')) else float('inf')
if BLOK_OTOMATIS and r_label > UKURAN_BLOK_M:
    baru = int(min(500, np.ceil(r_label / 100) * 100))
    print(f'Jangkauan autokorelasi label {r_label:.0f} m > blok {UKURAN_BLOK_M} m: blok diperbesar menjadi {baru} m.')
    if r_label > 500:
        print('PERINGATAN: jangkauan > 500 m; blok dibatasi 500 m agar tiap petak masih punya >= 4 blok. Laporkan.')
    UKURAN_BLOK_M = baru
    df['blok'] = (df['kode'] + '_' + df['petak'] + '_' +
                  ((df['x'] - x0) // UKURAN_BLOK_M).astype(int).astype(str) + '_' +
                  ((df['y'] - y0) // UKURAN_BLOK_M).astype(int).astype(str))
print(f'Ukuran blok dipakai: {UKURAN_BLOK_M} m; jarak petak latih tambahan ke petak uji >= 1000 m.')

fig, ax = plt.subplots(figsize=(6.5, 3.8))
for c in kor.columns:
    ax.plot(kor.index, kor[c], label=c.replace('kelas_', 'kelas ').replace('0', KELAS[0]).replace('1', KELAS[1]).replace('2', KELAS[2]))
ax.axhline(BATAS_KORELASI, color='grey', lw=0.8, ls=':')
ax.axvline(UKURAN_BLOK_M, color='black', lw=1, ls='--'); ax.text(UKURAN_BLOK_M + 10, 0.9, 'ukuran blok', fontsize=8)
ax.set_xlabel('Jarak (m)'); ax.set_ylabel('Korelasi'); ax.set_ylim(-0.2, 1); ax.grid(alpha=0.3)
ax.set_title('Korelogram label dan fitur di dalam petak'); ax.legend(fontsize=8, frameon=False)
fig.tight_layout(); fig.savefig(f'{OUT_DIR}/gbr_korelogram.png', dpi=300); plt.show()
""")

md("## 3. Data latih dan data uji")
code(r"""
kelas_ok = df['label'].isin([0, 1, 2])
latih = df[df['kode'].isin(LATIH) & kelas_ok & (df['sepakat'] >= MIN_SEPAKAT_LATIH)].copy()
if BUANG_EG_PETAK_C:
    latih = latih[~((latih['petak'] == 'C') & (latih['label'] == 1))]
uji = df[(df['kode'] == UJI) & kelas_ok].copy()        # semua tingkat kesepakatan
assert latih['label'].nunique() == 3, 'Data latih tidak memuat ketiga kelas.'

if MAKS_LATIH_PER_KELAS:
    latih = (latih.groupby('label', group_keys=False)
                  .apply(lambda g: g.sample(min(len(g), MAKS_LATIH_PER_KELAS), random_state=SEED_UTAMA)))

TINGKAT = {'semua': uji['sepakat'] >= 3, 'min 4 dari 5': uji['sepakat'] >= 4, '5 dari 5': uji['sepakat'] == 5}
tabel_n = pd.DataFrame({
    'latih': latih['label'].map(KELAS).value_counts(),
    **{f'uji ({t})': uji.loc[m, 'label'].map(KELAS).value_counts() for t, m in TINGKAT.items()}
}).fillna(0).astype(int)
tabel_n.loc['Jumlah'] = tabel_n.sum()
print(f'Latih: {LATIH} (sepakat >= {MIN_SEPAKAT_LATIH}), uji: {UJI}')
print('Petak di data latih:', sorted(latih['petak'].unique()), '| petak di data uji:', sorted(uji['petak'].unique()))
display(tabel_n) if 'display' in globals() else print(tabel_n)
tabel_n.to_csv(f'{OUT_DIR}/jumlah_data_latih_uji.csv')
""")

md(r"""
## 4. Model yang dibandingkan
Lima model mewakili lima keluarga pengklasifikasi yang umum di penginderaan jauh. Setiap model diberi penanganan ketidakseimbangan kelas yang setara: bobot kelas seimbang, atau *oversampling* di dalam fold untuk MLP. Hiperparameter disetel dengan **GroupKFold per blok 200 m pada data latih saja**; data uji tidak pernah dipakai untuk penyetelan.
""")
code(r"""
class Oversample(BaseEstimator, ClassifierMixin):
    # Menyamakan jumlah sampel tiap kelas dengan oversampling acak, hanya saat fit.
    def __init__(self, estimator=None, random_state=0):
        self.estimator = estimator
        self.random_state = random_state
    def fit(self, X, y):
        rng = np.random.RandomState(self.random_state)
        y = np.asarray(y); n = np.bincount(y).max()
        idx = np.concatenate([rng.choice(np.where(y == k)[0], n, replace=True) for k in np.unique(y)])
        self.estimator_ = clone(self.estimator).fit(np.asarray(X)[idx], y[idx])
        self.classes_ = self.estimator_.classes_
        return self
    def predict(self, X):
        return self.estimator_.predict(X)
    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)

def hgb(seed):
    try:
        return HistGradientBoostingClassifier(class_weight='balanced', random_state=seed)
    except TypeError:     # scikit-learn < 1.2
        return Oversample(HistGradientBoostingClassifier(random_state=seed), random_state=seed)

def bangun(nama, seed=0):
    if nama == 'LR':
        return Pipeline([('skala', StandardScaler()),
                         ('model', LogisticRegression(class_weight='balanced', max_iter=3000))])
    if nama == 'SVM':
        return Pipeline([('skala', StandardScaler()),
                         ('model', SVC(kernel='rbf', class_weight='balanced'))])
    if nama == 'RF':
        return RandomForestClassifier(n_estimators=300, class_weight='balanced', n_jobs=-1, random_state=seed)
    if nama == 'HGB':
        return hgb(seed)
    if nama == 'MLP':
        return Pipeline([('skala', StandardScaler()),
                         ('model', Oversample(MLPClassifier(max_iter=600, early_stopping=True,
                                                            random_state=seed), random_state=seed))])
    raise ValueError(nama)

def awalan_hgb():
    return 'estimator__' if isinstance(hgb(0), Oversample) else ''

GRID = {
    'LR':  {'model__C': [0.1, 1, 10]},
    'SVM': {'model__C': [1, 10, 100], 'model__gamma': ['scale', 0.05]},
    'RF':  {'max_features': ['sqrt', 0.33], 'min_samples_leaf': [1, 5]},
    'HGB': {awalan_hgb() + 'learning_rate': [0.05, 0.1], awalan_hgb() + 'max_leaf_nodes': [15, 31]},
    'MLP': {'model__estimator__hidden_layer_sizes': [(64,), (64, 32)],
            'model__estimator__alpha': [1e-4, 1e-3]},
}
ACAK = {'RF', 'HGB', 'MLP'}            # diulang dengan beberapa seed
NAMA_MODEL = {'LR': 'Regresi logistik', 'SVM': 'SVM (RBF)', 'RF': 'Random forest',
              'HGB': 'Gradient boosting (HGB)', 'MLP': 'MLP'}
""")

md("## 5. E1 dan E2 — Perbandingan model dan ablasi fitur")
code(r"""
def metrik(y, p):
    pr, rc, f1, _ = precision_recall_fscore_support(y, p, labels=[0, 1, 2], zero_division=0)
    return {'OA': accuracy_score(y, p), 'kappa': cohen_kappa_score(y, p),
            'F1_makro': f1_score(y, p, labels=[0, 1, 2], average='macro', zero_division=0),
            'F1_air': f1[0], 'F1_eg': f1[1], 'F1_kja': f1[2],
            'recall_air': rc[0], 'recall_eg': rc[1], 'recall_kja': rc[2]}

y_latih, g_latih, y_uji = latih['label'].values, latih['blok'].values, uji['label'].values
cv = GroupKFold(n_splits=min(N_FOLD, latih['blok'].nunique()))
baris, baris_tingkat, prediksi, param_terbaik, model_akhir = [], [], {}, {}, {}
mulai = time.time()

for fs, kolom in SET_FITUR.items():
    X_latih, X_uji = latih[kolom].values, uji[kolom].values
    for nama in GRID:
        gs = GridSearchCV(bangun(nama, SEED_UTAMA), GRID[nama], scoring='f1_macro', cv=cv, n_jobs=-1)
        gs.fit(X_latih, y_latih, groups=g_latih)
        param_terbaik[(nama, fs)] = gs.best_params_
        for seed in (SEEDS if nama in ACAK else [SEED_UTAMA]):
            m = bangun(nama, seed).set_params(**gs.best_params_).fit(X_latih, y_latih)
            p = m.predict(X_uji)
            baris.append({'model': nama, 'fitur': fs, 'seed': seed, 'cv_F1_makro': gs.best_score_, **metrik(y_uji, p)})
            if seed == SEED_UTAMA:
                prediksi[(nama, fs)] = p
                model_akhir[(nama, fs)] = m
                for t, msk in TINGKAT.items():
                    baris_tingkat.append({'model': nama, 'fitur': fs, 'tingkat': t, 'n': int(msk.sum()),
                                          **metrik(y_uji[msk.values], p[msk.values])})
        print(f'{fs:6s} {nama:4s} selesai  cv F1={gs.best_score_:.3f}  ({time.time() - mulai:.0f} dtk)')

hasil = pd.DataFrame(baris)
kolom_m = ['OA', 'kappa', 'F1_makro', 'F1_air', 'F1_eg', 'F1_kja']
ringkasan = (hasil.groupby(['fitur', 'model'])[kolom_m + ['cv_F1_makro']]
                  .agg(['mean', 'std']).round(4))
hasil.to_csv(f'{OUT_DIR}/e1e2_hasil_per_seed.csv', index=False)
ringkasan.to_csv(f'{OUT_DIR}/e1e2_ringkasan_mean_sd.csv')
pd.DataFrame(baris_tingkat).round(4).to_csv(f'{OUT_DIR}/e1e2_per_tingkat_kesepakatan.csv', index=False)
pd.Series({f'{k[0]}|{k[1]}': v for k, v in param_terbaik.items()}).to_csv(f'{OUT_DIR}/hiperparameter_terbaik.csv')
print('Selesai dalam', round(time.time() - mulai), 'detik')
""")

code(r"""
# Tabel utama (fitur lengkap) — Tabel IV Naskah 2
utama = (hasil[hasil['fitur'] == LENGKAP].groupby('model')[kolom_m].mean()
         .sort_values('F1_makro', ascending=False).round(4))
utama.index = [NAMA_MODEL[m] for m in utama.index]
display(utama) if 'display' in globals() else print(utama)
# Model terbaik dipilih dari skor VALIDASI SILANG pada data latih (GroupKFold per blok),
# BUKAN dari skor T3, agar data uji tidak ikut menentukan model yang dianalisis lanjut.
TERBAIK = hasil[hasil['fitur'] == LENGKAP].groupby('model')['cv_F1_makro'].mean().idxmax()
print('Model terbaik menurut validasi silang (fitur lengkap):', NAMA_MODEL[TERBAIK])

# Deteksi overfitting: selisih F1 makro validasi silang (data latih) dan uji (T3).
# Selisih besar = model terlalu menyesuaikan diri dengan data latih, atau T3 jauh berbeda.
celah = (hasil.groupby(['fitur', 'model'])[['cv_F1_makro', 'F1_makro']].mean()
              .rename(columns={'cv_F1_makro': 'F1_validasi', 'F1_makro': 'F1_uji'}))
celah['selisih'] = celah['F1_validasi'] - celah['F1_uji']
celah = celah.round(4)
display(celah.loc[LENGKAP]) if 'display' in globals() else print(celah.loc[LENGKAP])
celah.to_csv(f'{OUT_DIR}/e1_selisih_validasi_uji.csv')

# Autokorelasi RESIDU (Roberts dkk., 2017): galat prediksi out-of-fold model terbaik pada data latih.
from sklearn.model_selection import cross_val_predict
m_cv = bangun(TERBAIK, SEED_UTAMA).set_params(**param_terbaik[(TERBAIK, LENGKAP)])
p_oof = cross_val_predict(m_cv, latih[SET_FITUR[LENGKAP]].values, y_latih, groups=g_latih, cv=cv, n_jobs=-1)
dres = latih[['kode', 'petak', 'x', 'y']].copy(); dres['residu'] = (p_oof != y_latih).astype(float)
r_res = jangkauan(korelogram(dres, ['residu'])['residu'])
print(f'Jangkauan autokorelasi residu: {r_res:.0f} m; ukuran blok: {UKURAN_BLOK_M} m ->',
      'memadai' if r_res <= UKURAN_BLOK_M else 'blok LEBIH KECIL dari jangkauan residu; naikkan UKURAN_BLOK_M dan jalankan ulang')
pd.Series({'jangkauan_residu_m': r_res, 'ukuran_blok_m': UKURAN_BLOK_M}).to_csv(f'{OUT_DIR}/autokorelasi_residu.csv')

# Tabel ablasi: F1 makro rata-rata per set fitur x model
ablasi = hasil.groupby(['model', 'fitur'])['F1_makro'].mean().unstack()[list(SET_FITUR)].round(4)
ablasi.index = [NAMA_MODEL[m] for m in ablasi.index]
display(ablasi) if 'display' in globals() else print(ablasi)
ablasi.to_csv(f'{OUT_DIR}/e2_ablasi_f1_makro.csv')
""")

code(r"""
# Gambar ablasi: F1 makro per set fitur, satu garis per model (rata-rata seed; batang galat = SD)
fig, ax = plt.subplots(figsize=(7, 4.2))
stat = hasil.groupby(['model', 'fitur'])['F1_makro'].agg(['mean', 'std']).reset_index()
xs = np.arange(len(SET_FITUR))
penanda = {'LR': 'o', 'SVM': 's', 'RF': '^', 'HGB': 'D', 'MLP': 'v'}
for nama in GRID:
    s = stat[stat['model'] == nama].set_index('fitur').loc[list(SET_FITUR)]
    lebar = 2.4 if nama == TERBAIK else 1.2
    ax.errorbar(xs, s['mean'], yerr=s['std'].fillna(0), marker=penanda[nama], lw=lebar, capsize=3,
                label=NAMA_MODEL[nama])
ax.set_xticks(xs, ['F0\npita', '+F1\nindeks', '+F2\ntekstur, tepi', '+F3\nmorfologi'])
ax.set_ylabel(f'F1 makro pada {UJI}')
ax.set_title('Pengaruh penambahan kelompok fitur PCD')
ax.grid(axis='y', alpha=0.3); ax.legend(fontsize=8, frameon=False, loc='lower right')
fig.tight_layout(); fig.savefig(f'{OUT_DIR}/gbr_ablasi_fitur.png', dpi=300); plt.show()
""")

md("## 6. E3 — Uji statistik")
code(r"""
def mcnemar(y, pa, pb):
    a_benar, b_benar = pa == y, pb == y
    n01 = int(np.sum(a_benar & ~b_benar)); n10 = int(np.sum(~a_benar & b_benar))
    if n01 + n10 == 0:
        return n01, n10, np.nan, 1.0
    if n01 + n10 < 25:                                   # uji eksak untuk sel kecil
        return n01, n10, np.nan, binomtest(min(n01, n10), n01 + n10, 0.5).pvalue
    z2 = (abs(n01 - n10) - 1) ** 2 / (n01 + n10)       # dengan koreksi kontinuitas
    return n01, n10, z2, chi2.sf(z2, 1)

def holm(p):
    p = np.asarray(p, float); urut = np.argsort(p); adj = np.empty_like(p); m = len(p); maks = 0
    for i, j in enumerate(urut):
        maks = max(maks, (m - i) * p[j]); adj[j] = min(1, maks)
    return adj

uji_baris = []
for nama in GRID:                                         # terbaik vs model lain (fitur lengkap)
    if nama != TERBAIK:
        n01, n10, z2, p = mcnemar(y_uji, prediksi[(TERBAIK, LENGKAP)], prediksi[(nama, LENGKAP)])
        uji_baris.append({'perbandingan': f'{TERBAIK} vs {nama} ({LENGKAP})', 'benar_A_salah_B': n01,
                          'salah_A_benar_B': n10, 'z2': z2, 'p': p})
for fs in SET_FITUR:                                      # ablasi pada model terbaik
    if fs != LENGKAP:
        n01, n10, z2, p = mcnemar(y_uji, prediksi[(TERBAIK, LENGKAP)], prediksi[(TERBAIK, fs)])
        uji_baris.append({'perbandingan': f'{TERBAIK}: {LENGKAP} vs {fs}', 'benar_A_salah_B': n01,
                          'salah_A_benar_B': n10, 'z2': z2, 'p': p})
ujiM = pd.DataFrame(uji_baris)
ujiM['p_holm'] = holm(ujiM['p'])
ujiM['bermakna_5%'] = ujiM['p_holm'] < 0.05
display(ujiM.round(4)) if 'display' in globals() else print(ujiM.round(4))
ujiM.to_csv(f'{OUT_DIR}/e3_uji_mcnemar.csv', index=False)
""")

code(r"""
# Bootstrap per blok: blok 200 m diambil ulang dengan pengembalian (menghormati autokorelasi spasial)
rng = np.random.RandomState(SEED_UTAMA)
blok_uji = uji['blok'].values
daftar_blok = np.unique(blok_uji)
indeks_blok = {b: np.where(blok_uji == b)[0] for b in daftar_blok}
f1m = lambda y, p: f1_score(y, p, labels=[0, 1, 2], average='macro', zero_division=0)
boot = {nama: [] for nama in GRID}
for _ in range(N_BOOT):
    idx = np.concatenate([indeks_blok[b] for b in rng.choice(daftar_blok, len(daftar_blok), replace=True)])
    for nama in GRID:
        boot[nama].append(f1m(y_uji[idx], prediksi[(nama, LENGKAP)][idx]))
ci = pd.DataFrame({nama: {'F1_makro': f1m(y_uji, prediksi[(nama, LENGKAP)]),
                          'CI95_bawah': np.percentile(v, 2.5), 'CI95_atas': np.percentile(v, 97.5)}
                   for nama, v in boot.items()}).T.sort_values('F1_makro', ascending=False).round(4)
urut_cv = hasil[hasil['fitur'] == LENGKAP].groupby('model')['cv_F1_makro'].mean().sort_values(ascending=False)
kedua = [m for m in urut_cv.index if m != TERBAIK][0]   # peringkat kedua menurut validasi silang
selisih = np.array(boot[TERBAIK]) - np.array(boot[kedua])
print(f'Selisih F1 makro {TERBAIK} - {kedua}: {selisih.mean():.4f} '
      f'(CI95 {np.percentile(selisih, 2.5):.4f} s.d. {np.percentile(selisih, 97.5):.4f})')
display(ci) if 'display' in globals() else print(ci)
ci.to_csv(f'{OUT_DIR}/e3_bootstrap_ci.csv')
""")

md("## 7. E4 — Matriks konfusi, kepentingan fitur, uji silang tanggal, pembanding PCD")
code(r"""
p_best = prediksi[(TERBAIK, LENGKAP)]
cm = confusion_matrix(y_uji, p_best, labels=[0, 1, 2])
tabel_cm = pd.DataFrame(cm, index=[f'Ref: {KELAS[k]}' for k in range(3)],
                        columns=[f'Pred: {KELAS[k]}' for k in range(3)])
tabel_cm['Recall (%)'] = (np.diag(cm) / cm.sum(1).clip(min=1) * 100).round(1)
presisi = (np.diag(cm) / cm.sum(0).clip(min=1) * 100).round(1)
tabel_cm.loc['Presisi (%)'] = list(presisi) + [np.nan]
display(tabel_cm) if 'display' in globals() else print(tabel_cm)
tabel_cm.to_csv(f'{OUT_DIR}/e4_matriks_konfusi_{TERBAIK}.csv')

fig, ax = plt.subplots(figsize=(4.6, 4))
cm_pct = cm / cm.sum(1, keepdims=True).clip(min=1)
ax.imshow(cm_pct, cmap='Blues', vmin=0, vmax=1)
for i in range(3):
    for j in range(3):
        ax.text(j, i, f'{cm[i, j]}\n({cm_pct[i, j]*100:.0f}%)', ha='center', va='center', fontsize=9,
                color='white' if cm_pct[i, j] > 0.6 else 'black')
ax.set_xticks(range(3), [KELAS[k] for k in range(3)]); ax.set_yticks(range(3), [KELAS[k] for k in range(3)])
ax.set_xlabel('Prediksi'); ax.set_ylabel('Referensi'); ax.set_title(f'{NAMA_MODEL[TERBAIK]}, {UJI}')
fig.tight_layout(); fig.savefig(f'{OUT_DIR}/gbr_matriks_konfusi.png', dpi=300); plt.show()
""")

code(r"""
# Permutation importance pada data uji (penurunan F1 makro), per kelompok dan per fitur
m_best = model_akhir[(TERBAIK, LENGKAP)]
kolom = SET_FITUR[LENGKAP]
X_uji_df = uji[kolom].reset_index(drop=True)
dasar = f1m(y_uji, m_best.predict(X_uji_df.values))
rng = np.random.RandomState(SEED_UTAMA)

def turun(cols):
    nilai = []
    for _ in range(N_PERMUTASI):
        X = X_uji_df.copy()
        perm = rng.permutation(len(X))
        X[cols] = X[cols].values[perm]                    # kolom satu kelompok diacak bersama
        nilai.append(dasar - f1m(y_uji, m_best.predict(X.values)))
    return np.mean(nilai), np.std(nilai)

imp_kel = pd.DataFrame({k: dict(zip(['penurunan_F1', 'sd'], turun(v))) for k, v in KELOMPOK.items()}).T
imp_fit = pd.DataFrame({c: dict(zip(['penurunan_F1', 'sd'], turun([c]))) for c in kolom}).T
imp_fit = imp_fit.sort_values('penurunan_F1', ascending=False)
imp_kel.round(4).to_csv(f'{OUT_DIR}/e4_kepentingan_kelompok.csv'); imp_fit.round(4).to_csv(f'{OUT_DIR}/e4_kepentingan_fitur.csv')
display(imp_kel.round(4)) if 'display' in globals() else print(imp_kel.round(4))

warna_kel = {**{c: '#4c78a8' for c in F0}, **{c: '#f58518' for c in F1},
             **{c: '#54a24b' for c in F2}, **{c: '#b279a2' for c in F3}}
top = imp_fit.head(15)[::-1]
fig, ax = plt.subplots(figsize=(6, 5))
ax.barh(top.index, top['penurunan_F1'], xerr=top['sd'], color=[warna_kel[c] for c in top.index])
from matplotlib.patches import Patch
ax.legend(handles=[Patch(color=w, label=k) for k, w in [('F0 pita', '#4c78a8'), ('F1 indeks', '#f58518'),
                   ('F2 tekstur/tepi', '#54a24b'), ('F3 morfologi', '#b279a2')]],
          frameon=False, fontsize=8, loc='lower right')
ax.set_xlabel('Penurunan F1 makro bila fitur diacak'); ax.set_title(f'Kepentingan fitur {NAMA_MODEL[TERBAIK]}')
ax.grid(axis='x', alpha=0.3)
fig.tight_layout(); fig.savefig(f'{OUT_DIR}/gbr_kepentingan_fitur.png', dpi=300); plt.show()
""")

code(r"""
# Uji silang antartanggal (pemeriksaan internal) pada petak yang sama (A-C):
# latih T1 uji T2, dan sebaliknya.
silang = []
SAMA = [k for k in LATIH if k in ('T1', 'T2')]
if len(SAMA) >= 2:
    for a in SAMA:
        for b in SAMA:
            if a == b:
                continue
            la = latih[latih['kode'] == a]
            ub = df[(df['kode'] == b) & kelas_ok]
            if la['label'].nunique() < 3:
                continue
            m = bangun(TERBAIK, SEED_UTAMA).set_params(**param_terbaik[(TERBAIK, LENGKAP)])
            m.fit(la[SET_FITUR[LENGKAP]].values, la['label'].values)
            silang.append({'latih': a, 'uji': b, **metrik(ub['label'].values, m.predict(ub[SET_FITUR[LENGKAP]].values))})
silang.append({'latih': '+'.join(LATIH), 'uji': UJI, **metrik(y_uji, p_best)})
silang = pd.DataFrame(silang).round(4)
display(silang) if 'display' in globals() else print(silang)
silang.to_csv(f'{OUT_DIR}/e4_uji_silang_tanggal.csv', index=False)
""")

code(r"""
# Pembanding PCD: kelas air dari ambang indeks (air_pcd) vs kelas air dari model terbaik
y_air = (y_uji == 0).astype(int)
banding = pd.DataFrame([
    {'metode': 'Ambang indeks (PCD, tanpa pascaproses)', **dict(zip(['presisi', 'recall', 'F1'],
        precision_recall_fscore_support(y_air, uji['air_pcd'].values.astype(int), average='binary', zero_division=0)[:3]))},
    {'metode': f'{NAMA_MODEL[TERBAIK]} (F0-F3)', **dict(zip(['presisi', 'recall', 'F1'],
        precision_recall_fscore_support(y_air, (p_best == 0).astype(int), average='binary', zero_division=0)[:3]))},
]).round(4)
cakupan = (uji['waduk_pcd'] == 1).mean()
print(f'Piksel uji di dalam masker waduk PCD: {cakupan*100:.1f}% (sisanya tidak akan terpetakan pada peta seluruh waduk)')
display(banding) if 'display' in globals() else print(banding)
banding.to_csv(f'{OUT_DIR}/e4_pembanding_pcd_kelas_air.csv', index=False)

# Bias proporsi kelas: bobot kelas seimbang bisa menggeser proporsi kelas hasil prediksi
# (Millard & Richardson, 2015). Bandingkan proporsi referensi dan prediksi di T3.
prop = pd.DataFrame({
    'referensi_%': pd.Series(y_uji).map(KELAS).value_counts(normalize=True) * 100,
    'prediksi_%': pd.Series(p_best).map(KELAS).value_counts(normalize=True) * 100,
}).fillna(0)
prop['bias_poin'] = prop['prediksi_%'] - prop['referensi_%']
display(prop.round(2)) if 'display' in globals() else print(prop.round(2))
prop.round(3).to_csv(f'{OUT_DIR}/e4_bias_proporsi_kelas.csv')
print('Luas dari peta adalah luas terpetakan, bukan estimasi luas tak bias (Olofsson dkk., 2014).')
""")

md(r"""
## 8. E5 — Pengaruh petak latih tambahan
Model terbaik (hiperparameter sama) dilatih dua kali: (a) hanya petak A–C pada T1, T2; (b) ditambah petak D, E, F pada D1, D2, D3. Keduanya diuji di T3. Bila (b) lebih baik dan bermakna, keragaman lokasi dan waktu terbukti membantu generalisasi.
""")
code(r"""
tambahan_ada = latih['petak'].isin(PETAK_TAMBAHAN).any()
if not tambahan_ada:
    print('Data latih tidak memuat petak tambahan; E5 dilewati.')
else:
    kol = SET_FITUR[LENGKAP]
    hasil_e5, pred_e5 = [], {}
    for nama_set, bagian in [('A-C saja', latih[~latih['petak'].isin(PETAK_TAMBAHAN)]), ('A-C + D-F', latih)]:
        for seed in (SEEDS if TERBAIK in ACAK else [SEED_UTAMA]):
            m = bangun(TERBAIK, seed).set_params(**param_terbaik[(TERBAIK, LENGKAP)])
            m.fit(bagian[kol].values, bagian['label'].values)
            p = m.predict(uji[kol].values)
            hasil_e5.append({'data_latih': nama_set, 'seed': seed, 'n_latih': len(bagian), **metrik(y_uji, p)})
            if seed == SEED_UTAMA:
                pred_e5[nama_set] = p
    e5 = pd.DataFrame(hasil_e5).groupby('data_latih')[['n_latih'] + kolom_m].agg(['mean', 'std']).round(4)
    n01, n10, z2, pval = mcnemar(y_uji, pred_e5['A-C + D-F'], pred_e5['A-C saja'])
    print(f'McNemar (A-C + D-F) vs (A-C saja): benar_A_salah_B={n01}, salah_A_benar_B={n10}, p={pval:.4f}')
    display(e5) if 'display' in globals() else print(e5)
    e5.to_csv(f'{OUT_DIR}/e5_petak_tambahan.csv')
""")

md("## 9. Simpan model dan ringkasan")
code(r"""
import joblib
joblib.dump({'model': m_best, 'fitur': SET_FITUR[LENGKAP], 'kelas': KELAS, 'log1p': ['luas_komponen', 'jarak_air']},
            f'{OUT_DIR}/model_terbaik_{TERBAIK}.joblib')
ringkas = {
    'lingkungan': LINGKUNGAN, 'versi_pustaka': VERSI, 'versi_dataset': VERSI_DATASET,
    'latih': LATIH, 'uji': UJI, 'uji_coba': bool(UJI_COBA), 'min_sepakat_latih': MIN_SEPAKAT_LATIH, 'buang_eg_petak_c': BUANG_EG_PETAK_C,
    'n_latih': int(len(latih)), 'n_uji': int(len(uji)), 'model_terbaik': TERBAIK,
    'hiperparameter_terbaik': {f'{k[0]}|{k[1]}': {kk: str(vv) for kk, vv in v.items()} for k, v in param_terbaik.items()},
    'f1_makro_terbaik': float(ci.loc[TERBAIK, 'F1_makro']),
}
json.dump(ringkas, open(f'{OUT_DIR}/ringkasan.json', 'w'), indent=2, ensure_ascii=False)
print('Tersimpan di', OUT_DIR); print(sorted(os.listdir(OUT_DIR)))
""")

md(r"""
## 10. (Opsional) Peta dan luas seluruh waduk
Membutuhkan `waduk_<UJI>_<versi>.csv` dari Langkah 10 mode `ekspor_waduk`. Luas dihitung dari jumlah piksel × 0,04 ha. Piksel di luar masker waduk PCD dan area PLTS sudah dikeluarkan di GEE.
""")
code(r"""
p_waduk = cari(f'waduk_{UJI}_{VERSI_DATASET}.csv')
if p_waduk is None:
    print(f'waduk_{UJI}_{VERSI_DATASET}.csv tidak ditemukan; bagian ini dilewati.')
else:
    w = pd.read_csv(p_waduk)
    for c in ['luas_komponen', 'jarak_air']:
        w[c] = np.log1p(w[c].clip(lower=0))
    w['prediksi'] = m_best.predict(w[SET_FITUR[LENGKAP]].values)
    luas = w['prediksi'].map(KELAS).value_counts().mul(0.04).round(1).rename('luas_ha')
    display(luas.to_frame()) if 'display' in globals() else print(luas)
    luas.to_csv(f'{OUT_DIR}/luas_kelas_seluruh_waduk_{UJI}.csv')

    # Raster dari koordinat piksel (x, y = pusat piksel UTM 48S, grid 20 m)
    xs, ys = np.sort(w['x'].unique()), np.sort(w['y'].unique())[::-1]
    kol = np.round((w['x'] - xs.min()) / 20).astype(int); bar = np.round((ys.max() - w['y']) / 20).astype(int)
    grid = np.full((bar.max() + 1, kol.max() + 1), -1, dtype=np.int8); grid[bar, kol] = w['prediksi']
    from matplotlib.colors import ListedColormap
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.imshow(np.ma.masked_less(grid, 0), cmap=ListedColormap(['#2166ac', '#e7298a', '#fdb863']),
              vmin=0, vmax=2, interpolation='nearest')
    for k, c in [(0, '#2166ac'), (1, '#e7298a'), (2, '#fdb863')]:
        ax.plot([], [], 's', color=c, label=f'{KELAS[k]} ({luas.get(KELAS[k], 0)} ha)')
    ax.legend(loc='lower left', frameon=True, fontsize=8); ax.set_axis_off()
    ax.set_title(f'Klasifikasi permukaan Waduk Saguling, {UJI} ({NAMA_MODEL[TERBAIK]})')
    fig.tight_layout(); fig.savefig(f'{OUT_DIR}/gbr_peta_seluruh_waduk_{UJI}.png', dpi=300); plt.show()
    try:
        import rasterio
        from rasterio.transform import from_origin
        with rasterio.open(f'{OUT_DIR}/peta_{UJI}_{TERBAIK}.tif', 'w', driver='GTiff', height=grid.shape[0],
                           width=grid.shape[1], count=1, dtype='int8', crs='EPSG:32748', nodata=-1,
                           transform=from_origin(xs.min() - 10, ys.max() + 10, 20, 20)) as dst:
            dst.write(grid, 1)
        print('GeoTIFF tersimpan (bisa dibuka di QGIS).')
    except ImportError:
        print('rasterio tidak terpasang; GeoTIFF dilewati (PNG tetap tersimpan). Colab: !pip install rasterio')
""")

nb['cells'] = C
nb['metadata'] = {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                  'language_info': {'name': 'python'}}
out = pathlib.Path(__file__).with_name('11_pelatihan_model.ipynb')
nbf.write(nb, out)
print('Notebook ditulis:', out)
