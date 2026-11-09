"""
LANGKAH 09 — MEMBUAT TABEL HASIL UNTUK NASKAH
-----------------------------------------------------------------------
Tujuan   : Mengubah CSV dari GEE menjadi tabel siap tempel ke naskah:
             Tabel VIII  IoU terhadap air terbuka + peringkat konfigurasi
             Tabel IX    bias luas terhadap permukaan waduk (tanpa vs dengan
                         morfologi)
             Tabel X     nilai ambang otomatis di T1 dan T2
             Tabel XI    ketahanan peringkat terhadap keraguan referensi
             Tabel XII   objek apung yang ikut terpetakan sebagai air
             Tabel XIII  kesepakatan lima penilai (bila CSV 06c diberikan)
           dan korelasi peringkat Spearman rho antara T1 dan T2.
           Tabel VIII-X dan XII memakai semua piksel (tingkat 'semua').
Masukan  : 08_evaluasi_<vref>_<vpeta>.csv (Langkah 08)
           07_ambang_otomatis_<vpeta>.csv  (Langkah 07, mode 'ekspor')
           opsional: 06c_kesepakatan_vote_<v>.csv dan
                     06c_iou_pasangan_vote_<v>.csv (Langkah 06c)
Keluaran : tabel di layar + file tabel_hasil.md
Catatan  : Excel Tabel 12 menghitung hal yang sama dengan rumus.
           Cukup pakai salah satu.

Pemakaian (Python 3 standar, tanpa pustaka tambahan):
    python 09_membuat_tabel_hasil.py 08_evaluasi_vote_v1_v1.csv 07_ambang_otomatis_v1.csv
    python 09_membuat_tabel_hasil.py 08_evaluasi_vote_v1_v1.csv 07_ambang_otomatis_v1.csv \
        06c_kesepakatan_vote_v1.csv 06c_iou_pasangan_vote_v1.csv
"""
import csv
import sys
from collections import defaultdict

KONF = [f"K{i}" for i in range(1, 13)]          # urutan sama dengan Tabel IV naskah
PETAK = ["A", "B", "C"]
KODE = ["T1", "T2"]
# Pasangan (indeks, metode ambang); tiap pasangan punya versi tanpa (K ganjil)
# dan dengan pascaproses (K genap).
LABEL_IM = [
    ("NDWI", "Tetap 0"), ("NDWI", "Otsu global"), ("NDWI", "Canny-Otsu"),
    ("MNDWI", "Tetap 0"), ("MNDWI", "Otsu global"), ("MNDWI", "Canny-Otsu"),
]


def angka(x):
    """Ubah teks CSV ke angka. -1 (dibagi nol) dan -9 (pita Canny kosong) = kosong."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if v in (-1, -9) else v


def rata(nilai):
    """Rata-rata yang mengabaikan nilai kosong."""
    nilai = [v for v in nilai if v is not None]
    return sum(nilai) / len(nilai) if nilai else None


def fmt(v, desimal=3):
    """Format angka Indonesia (koma desimal); kosong ditulis tanda pisah."""
    return "—" if v is None else f"{v:.{desimal}f}".replace(".", ",")


def peringkat(skor):
    """Peringkat 1 = skor tertinggi; skor seri mendapat rata-rata peringkat."""
    urut = sorted(skor.items(), key=lambda kv: -kv[1])
    hasil, i = {}, 0
    while i < len(urut):
        j = i
        while j + 1 < len(urut) and urut[j + 1][1] == urut[i][1]:
            j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1):
            hasil[urut[k][0]] = r
        i = j + 1
    return hasil


def spearman(r1, r2):
    """Spearman rho = korelasi Pearson antar peringkat (benar juga bila ada seri)."""
    kunci = sorted(r1)
    a = [r1[k] for k in kunci]
    b = [r2[k] for k in kunci]
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va = sum((x - ma) ** 2 for x in a) ** 0.5
    vb = sum((y - mb) ** 2 for y in b) ** 0.5
    return cov / (va * vb) if va and vb else None


def peringkat_iou(data, referensi, tingkat):
    """Peringkat konfigurasi dari IoU rata-rata tiga petak dan dua tanggal."""
    skor = {}
    for k in KONF:
        v = rata([angka(data[(p, t, k, referensi, tingkat)].get("iou"))
                  for p in PETAK for t in KODE])
        skor[k] = v if v is not None else -1
    return peringkat(skor)


def main(path_eval, path_ambang, path_sepakat=None, path_pasangan=None):
    # Baca CSV evaluasi: kunci = (petak, kode, konfigurasi, referensi, tingkat).
    # CSV lama tanpa kolom 'tingkat' dianggap 'semua'.
    semua = defaultdict(dict)
    with open(path_eval, newline="", encoding="utf-8") as f:
        for b in csv.DictReader(f):
            semua[(b["petak"], b["kode"], b["konf"], b["referensi"],
                   b.get("tingkat") or "semua")] = b
    # Tampilan khusus tingkat 'semua' untuk Tabel VIII, IX, dan XII.
    data = defaultdict(dict)
    for (p, t, k, r, tk), b in semua.items():
        if tk == "semua":
            data[(p, t, k, r)] = b

    out = []

    # ---- TABEL VIII -----------------------------------------------------
    # Peringkat per tanggal memakai IoU rata-rata tiga petak (referensi r_air).
    rank = {}
    for kode in KODE:
        skor = {}
        for k in KONF:
            v = rata([angka(data[(p, kode, k, "r_air")].get("iou")) for p in PETAK])
            skor[k] = v if v is not None else -1
        rank[kode] = peringkat(skor)
    rho = spearman(rank["T1"], rank["T2"])

    out.append("TABEL VIII. IoU terhadap referensi air terbuka (rata-rata T1 dan T2) dan peringkat\n")
    out.append("| Kode | IoU A | IoU B | IoU C | Peringkat T1 | Peringkat T2 |")
    out.append("| --- | --- | --- | --- | --- | --- |")
    for k in KONF:
        sel = [fmt(rata([angka(data[(p, t, k, "r_air")].get("iou")) for t in KODE])) for p in PETAK]
        r1, r2 = rank["T1"][k], rank["T2"][k]
        out.append(f"| {k} | {sel[0]} | {sel[1]} | {sel[2]} | "
                   f"{fmt(r1, 0 if r1 == int(r1) else 1)} | {fmt(r2, 0 if r2 == int(r2) else 1)} |")
    out.append(f"\nKorelasi peringkat Spearman T1 vs T2: rho = {fmt(rho)}\n")

    # ---- TABEL IX -------------------------------------------------------
    # Bias luas terhadap r_waduk; negatif = luas waduk terukur terlalu kecil.
    out.append("TABEL IX. Bias luas terhadap permukaan waduk (%), rata-rata T1 dan T2\n")
    out.append("| Indeks dan ambang | A tanpa | A dengan | B tanpa | B dengan | C tanpa | C dengan |")
    out.append("| --- | --- | --- | --- | --- | --- | --- |")
    for n, (indeks, metode) in enumerate(LABEL_IM):
        k_tanpa, k_dengan = KONF[2 * n], KONF[2 * n + 1]
        sel = []
        for p in PETAK:
            for k in (k_tanpa, k_dengan):
                sel.append(fmt(rata([angka(data[(p, t, k, "r_waduk")].get("bias_luas_pct"))
                                     for t in KODE]), 1))
        label = "tetap 0" if metode == "Tetap 0" else metode.replace("Canny-Otsu", "Canny–Otsu")
        out.append(f"| {indeks}, {label} | " + " | ".join(sel) + " |")
    out.append("")

    # ---- TABEL X --------------------------------------------------------
    ambang = {}
    with open(path_ambang, newline="", encoding="utf-8") as f:
        for b in csv.DictReader(f):
            ambang[b["kode"]] = b
    out.append("TABEL X. Nilai ambang otomatis pada dua tanggal\n")
    out.append("| Indeks dan metode | t* pada T1 | t* pada T2 | Selisih |")
    out.append("| --- | --- | --- | --- |")
    for kolom, label in [("t_NDWI_otsu", "NDWI, Otsu global"), ("t_NDWI_canny", "NDWI, Canny–Otsu"),
                         ("t_MNDWI_otsu", "MNDWI, Otsu global"), ("t_MNDWI_canny", "MNDWI, Canny–Otsu")]:
        a = angka(ambang.get("T1", {}).get(kolom))
        b = angka(ambang.get("T2", {}).get(kolom))
        beda = None if a is None or b is None else b - a
        out.append(f"| {label} | {fmt(a)} | {fmt(b)} | {fmt(beda)} |")
    out.append("")

    # ---- TABEL XI -------------------------------------------------------
    # Apakah peringkat konfigurasi berubah bila piksel yang diperdebatkan
    # penilai dibuang? rho mendekati 1 = kesimpulan tidak bergantung padanya.
    tingkat_ada = sorted({tk for (_, _, _, _, tk) in semua})
    out.append("TABEL XI. Ketahanan peringkat konfigurasi terhadap keraguan referensi "
               "(Spearman rho terhadap peringkat 'semua piksel')\n")
    out.append("| Referensi | Minimal 4 dari 5 | Sepakat penuh 5 dari 5 |")
    out.append("| --- | --- | --- |")
    for referensi in ("r_air", "r_waduk"):
        dasar = peringkat_iou(semua, referensi, "semua")
        sel = []
        for tk in ("min4", "penuh"):
            sel.append(fmt(spearman(dasar, peringkat_iou(semua, referensi, tk)))
                       if tk in tingkat_ada else "—")
        out.append(f"| {referensi} | {sel[0]} | {sel[1]} |")
    out.append("")

    # ---- TABEL XII ------------------------------------------------------
    # Bagian piksel objek apung yang dipetakan sebagai air (%), rata-rata
    # T1 dan T2. Untuk permukaan waduk, makin tinggi makin baik.
    out.append("TABEL XII. Piksel objek apung yang ikut terpetakan sebagai air (%), "
               "rata-rata T1 dan T2\n")
    out.append("| Indeks dan ambang | Eceng gondok di B, tanpa | Eceng gondok di B, dengan "
               "| KJA di C, tanpa | KJA di C, dengan |")
    out.append("| --- | --- | --- | --- | --- |")
    for n, (indeks, metode) in enumerate(LABEL_IM):
        k_tanpa, k_dengan = KONF[2 * n], KONF[2 * n + 1]
        sel = []
        for p, kolom in (("B", "eg_terbaca_air"), ("C", "kja_terbaca_air")):
            for k in (k_tanpa, k_dengan):
                v = rata([angka(data[(p, t, k, "r_waduk")].get(kolom)) for t in KODE])
                sel.append(fmt(None if v is None else v * 100, 1))
        label = "tetap 0" if metode == "Tetap 0" else metode.replace("Canny-Otsu", "Canny–Otsu")
        out.append(f"| {indeks}, {label} | " + " | ".join(sel) + " |")
    out.append("")

    # ---- TABEL XIII -----------------------------------------------------
    if path_sepakat:
        out.append("TABEL XIII. Kesepakatan lima penilai per petak dan tanggal\n")
        out.append("| Petak | Tanggal | Kappa r_air | Kappa r_waduk | Sepakat penuh r_waduk (%) "
                   "| Zona ragu r_waduk (%) |")
        out.append("| --- | --- | --- | --- | --- | --- |")
        sep = {}
        with open(path_sepakat, newline="", encoding="utf-8") as f:
            for b in csv.DictReader(f):
                sep[(b["petak"], b["kode"], b["band"])] = b
        for p in PETAK:
            for t in KODE:
                a = sep.get((p, t, "r_air"), {})
                w = sep.get((p, t, "r_waduk"), {})
                out.append(f"| {p} | {t} | {fmt(angka(a.get('kappa')))} | "
                           f"{fmt(angka(w.get('kappa')))} | "
                           f"{fmt(angka(w.get('pct_sepakat_5')), 1)} | "
                           f"{fmt(angka(w.get('pct_sepakat_3')), 1)} |")
        out.append("")
    if path_pasangan:
        out.append("Uji bias tim: rata-rata IoU antarpasangan penilai\n")
        out.append("| Kelompok pasangan | r_air | r_waduk | r_eg | r_kja |")
        out.append("| --- | --- | --- | --- | --- |")
        iou = defaultdict(list)
        with open(path_pasangan, newline="", encoding="utf-8") as f:
            for b in csv.DictReader(f):
                iou[(b["kelompok"], b["band"])].append(angka(b["iou"]))
        for kel in ("tim-tim", "tim-luar", "luar-luar"):
            sel = [fmt(rata(iou[(kel, band)])) for band in ("r_air", "r_waduk", "r_eg", "r_kja")]
            out.append(f"| {kel} | " + " | ".join(sel) + " |")
        out.append("")

    teks = "\n".join(out)
    print(teks)
    with open("tabel_hasil.md", "w", encoding="utf-8") as f:
        f.write(teks + "\n")
    print("\nTersimpan: tabel_hasil.md")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 5):
        sys.exit("Pemakaian: python 09_membuat_tabel_hasil.py 08_evaluasi.csv 07_ambang_otomatis.csv "
                 "[06c_kesepakatan.csv 06c_iou_pasangan.csv]")
    main(*sys.argv[1:])
