#!/usr/bin/env python3
"""far_engine.py — maximum FAR for every lot by its use, from the portions made by far_geom.py and the ZR tables in Lot_Profiler_FAR_engine_plan.md section 7."""
import argparse, json, os, time
import numpy as np, pandas as pd, pyogrio

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.normpath(os.path.join(ROOT, "..", "..", "Data"))

def rows(*pairs):
    out = {}
    for names, v in pairs:
        for n in names.split(): out[n] = v
    return out

RES = rows(("R1-1 R1-2 R1-2A R2 R2A R3A R3X R3-1 R3-2", 0.75), ("R2X R4A R4B R4 R4-1", 1.00), ("R5A R5B R5", 1.50), ("R5D", 2.00),
           ("R6A R6-1 R7B", 3.00), ("R6", 2.20), ("R6B", 2.00), ("R6D R6-2", 2.50), ("R7A", 4.00), ("R7-1 R7-2", 3.44),
           ("R7D", 4.66), ("R7X R7-3", 5.00), ("R8A R8X R8", 6.02), ("R8B", 4.00), ("R9A R9", 7.52), ("R9D R9X R9-1", 9.00),
           ("R10A R10X R10", 10.00), ("R11", 12.00), ("R12", 15.00))
WIDE = {"R6": 3.00, "R7-1": 4.00, "R7-2": 4.00, "R8": 7.20}
ROW075 = set("R1-1 R1-2 R1-2A R2 R2A R3A R3X R3-1 R3-2".split())
CF_R = rows(("R1-1 R1-2 R1-2A R2 R2A R2X R3-1 R3-2 R3A R3X", 1.00), ("R4 R4-1 R4A R4B R5 R5A R5B R5D", 2.00),
            ("R6A", 3.00), ("R6B", 2.00), ("R6D", 2.50), ("R7A", 4.00), ("R7B", 3.00), ("R7D", 4.66), ("R7X", 5.00), ("R8A", 6.50),
            ("R8B", 4.00), ("R8X", 6.00), ("R9A", 7.50), ("R9D R9X", 9.00), ("R10A R10X", 10.00), ("R11A", 12.00),
            ("R6 R6-1", 4.80), ("R6-2", 2.50), ("R7-1", 4.80), ("R7-2 R7-3", 6.50), ("R8", 6.50), ("R9 R9-1", 10.00), ("R10", 10.00),
            ("R11", 12.00), ("R12", 15.00))
OV_COMM = rows(("R1-1 R1-2 R1-2A R2 R2A R2X", 1.00), ("R3-1 R3A R3X", 1.00), ("R3-2", 1.60), ("R4 R4-1 R4A R4B R5 R5A R5B", 2.00),
               ("R5D R6B R6D R6-2 R6A R7B R7A R8B R7D R6 R6-1 R7-1 R7X R7-2 R7-3 R8 R8A R8X R9 R9-1 R9A R9D R9X R10 R11 R12", 2.00))
OV_CF = rows(("R1-1 R1-2 R1-2A R2 R2A R2X", 0.50), ("R3-1 R3A R3X", 1.00), ("R3-2", 1.60), ("R4 R4-1 R4A R4B R5 R5A R5B", 2.00),
             ("R5D R6B", 2.00), ("R6D R6-2", 2.50), ("R6A R7B", 3.00), ("R7A R8B", 4.00), ("R7D", 4.66), ("R6 R6-1 R7-1", 4.80),
             ("R7X", 5.00), ("R7-2 R7-3 R8 R8A", 6.50), ("R8X", 6.00), ("R9 R9-1", 10.00), ("R9A", 7.50), ("R9D R9X", 9.00),
             ("R10", 10.00), ("R11", 12.00), ("R12", 15.00))
C_EQ = rows(("C3", "R3-2"), ("C4-1", "R5"), ("C4-2 C4-3 C6-1A", "R6"), ("C4-2A C4-3A", "R6A"), ("C1-6 C2-6 C4-4 C4-5 C6-1", "R7-2"),
            ("C1-6A C2-6A C4-4A C4-4L C4-5A", "R7A"), ("C4-5D", "R7D"), ("C4-5X", "R7X"), ("C1-7 C4-2F C4-8 C6-2", "R8"),
            ("C1-7A C4-4D C6-2A", "R8A"), ("C1-8 C2-7 C4-9 C6-3", "R9"), ("C1-8A C2-7A C6-3A", "R9A"), ("C6-3D", "R9D"),
            ("C1-8X C2-7X C6-3X", "R9X"), ("C1-9 C2-8 C4-6 C4-7 C5 C6-4 C6-5 C6-6 C6-7 C6-8 C6-9", "R10"),
            ("C1-9A C2-8A C4-6A C4-7A C5-1A C5-2A C6-4A", "R10A"), ("C6-4X", "R10X"), ("C4-11 C6-11", "R11"), ("C4-11A", "R11A"),
            ("C4-12 C6-12", "R12"))
C_COMM = rows(("C3", 0.50), ("C4-1 C8-1", 1.00), ("C1-6 C1-7 C1-8 C1-9 C2-6 C2-7 C2-8 C7-1 C8-2 C8-3", 2.00), ("C4-2A C4-3A C7-2", 3.00),
              ("C4-2 C4-2F C4-3 C4-4 C4-4D C4-5 C4-6 C4-8 C4-9 C4-11 C4-12", 3.40), ("C4-4A C4-4L C4-5A C4-5X C5-1 C7-3", 4.00),
              ("C4-5D", 4.20), ("C7-4 C8-4", 5.00), ("C6-1 C6-2 C6-3", 6.00), ("C7-5", 6.50), ("C7-6", 8.00), ("C6-3D", 9.00),
              ("C4-7 C5-2 C5-4 C6-4 C6-5 C6-8 C7-7", 10.00), ("C6-11 C7-8", 12.00), ("C5-3 C5-5 C6-6 C6-7 C6-9 C6-12 C7-9", 15.00))
C_CF = rows(("C3", 1.00), ("C4-1 C7-1", 2.00), ("C8-1", 2.40), ("C4-2A C4-3A C7-2", 3.00), ("C1-6A C2-6A C4-4A C4-4L C4-5A C7-3", 4.00),
            ("C4-5D", 4.20), ("C4-2 C4-3 C8-2", 4.80), ("C4-5X C7-4", 5.00), ("C6-1A", 6.00),
            ("C1-6 C1-7 C2-6 C4-2F C4-4 C4-4D C4-5 C4-8 C6-1 C6-2 C7-5 C8-3 C8-4", 6.50), ("C1-8A C2-7A C6-3A", 7.50), ("C7-6", 8.00),
            ("C1-8X C2-7X C6-3D C6-3X", 9.00), ("C1-8 C1-9 C2-7 C2-8 C4-6 C4-7 C4-9 C5-1 C5-2 C5-4 C6-3 C6-4 C6-5 C6-8 C7-7", 10.00),
            ("C4-11 C6-11 C7-8", 12.00), ("C4-12 C5-3 C5-5 C6-6 C6-7 C6-9 C6-12 C7-9", 15.00))
M_FAR = rows(("M1-1", 1.00), ("M1-2 M1-4 M2-1 M2-3 M3-1 M3-2", 2.00), ("M1-3 M1-5 M2-2 M2-4", 5.00), ("M1-6", 10.00))
M_CF = rows(("M1-1", 2.40), ("M1-2", 4.80), ("M1-3 M1-4 M1-5", 6.50), ("M1-6", 10.00))
SF = set("R1-1 R1-2 R1-2A R2 R2A R3A R3X R3-1 R2X R4A R4-1 R4B".split())
SP_OK = {"LC", "SV-1", "HP"}
USE = {"01": "res", "02": "res", "03": "res", "04": "mix", "05": "comm", "06": "ind", "07": "ug4", "08": "cf", "09": "open", "10": "park", "11": "vac"}
USE_LABEL = {"res": "Residential", "mix": "Mixed residential and commercial", "comm": "Commercial and office", "ind": "Industrial and manufacturing",
             "ug4": "Use Group IV (transportation and utility)", "cf": "Community facility", "open": "Open space", "park": "Parking", "vac": "Vacant",
             "none": "No land use recorded"}
TEST_EQ = {k: v for k, v in C_EQ.items() if v in WIDE}

SLIVER = 0.10
FALLBACK = []

def look(table, k, src):
    if k in table: return table[k], src
    base = k[:-1] if k[-1:] in ("A", "D", "X", "L") else None
    if base and base in table:
        FALLBACK.append(k)
        return table[base], f"{src}, {base} row; {k} is not listed"
    return None, src

def fam(k):
    if k.startswith("R"): return "R"
    if k.startswith("C"): return k.split("-")[0]
    if k.startswith("M"): return k.split("-")[0]
    return k

def res_far(k, band, s, big):
    rk = k if k.startswith("R") else C_EQ.get(k)
    if rk is None or rk not in RES: return None, None
    if k.startswith("C") and (k.startswith("C7") or k.startswith("C8")): return None, None
    base = RES[rk]; src = "23-21" if rk in ROW075 or base <= 2.0 and rk[:2] in ("R1", "R2", "R3", "R4", "R5") else "23-22"
    if rk in ROW075 and big:
        return 0.60 * s, f"{k} {s:.0%}: 0.60 (23-21¹, lot ≥ 4,000 sq ft)"
    if rk in WIDE:
        b = min(max(band or 0.0, 0.0), s)
        v = b * WIDE[rk] + (s - b) * base
        eq = f" as {rk} (34-112)" if rk != k else ""
        if b > s - 0.0005:
            return v, f"{k}{eq} {s:.0%}: within 100 ft of a wide street {WIDE[rk]:.2f} (23-22¹)"
        if b > 0.0005:
            return v, f"{k}{eq} {s:.0%}: {b:.0%} within 100 ft of a wide street {WIDE[rk]:.2f} (23-22¹), {s-b:.0%} {base:.2f} (23-22)"
        return v, f"{k}{eq} {s:.0%}: {base:.2f} (23-22, not within 100 ft of a wide street)"
    eq = f" as {rk} (34-112)" if rk != k else ""
    return base * s, f"{k}{eq} {s:.0%}: {base:.2f} ({src})"

def res_allowed(k):
    if k.startswith("R"): return True
    if k.startswith("C"): return not (k.startswith("C7") or k.startswith("C8"))
    return False

def portion(k, s, ov, band, big):
    o = min(ov, s); p = s - o
    out = {}
    if k.startswith("R"):
        r = res_far(k, band, s, big)
        out["res"] = r
        cfv, cs = look(CF_R, k, "24-11")
        cfo, os_ = look(OV_CF, k, "33-121 B")
        out["cf"] = (None, None) if cfv is None or (o > 0 and cfo is None) else (cfv * p + (cfo or 0) * o, (f"{k} {s:.0%}: community facility under a C1/C2 overlay {cfo:.2f} ({os_})" if p < 0.0005 else f"{k} {s:.0%}: community facility {cfv:.2f} ({cs})" + (f", {o:.0%} under a C1/C2 overlay {cfo:.2f} ({os_})" if o > 0 else "")))
        com, ms = look(OV_COMM, k, "33-121 A")
        out["comm"] = (0.0, f"{k} {s:.0%}: commercial not permitted (no C1/C2 overlay)") if o <= 0 else (None, None) if com is None else (com * o, f"{k} {s:.0%}: commercial {com:.2f} on the {o:.0%} under a C1/C2 overlay ({ms}), 0 elsewhere")
        out["ind"] = out["comm"]
        ok = s if o > 0 else 0.0
        out["ok"] = {"res": s, "cf": s, "comm": ok, "ind": ok, "mix": ok}
    elif k.startswith("C"):
        com, ms = look(C_COMM, k, "33-122"); cfv, cs = look(C_CF, k, "33-123")
        out["res"] = res_far(k, band, s, big) if res_allowed(k) else (0.0, f"{k} {s:.0%}: residences not permitted (32-121)")
        out["comm"] = (None, None) if com is None else (com * s, f"{k} {s:.0%}: commercial {com:.2f} ({ms})")
        out["ind"] = out["comm"]
        out["cf"] = (None, None) if cfv is None else (cfv * s, f"{k} {s:.0%}: community facility {cfv:.2f} ({cs})")
        ra = s if res_allowed(k) else 0.0
        out["ok"] = {"res": ra, "cf": s, "comm": s, "ind": s, "mix": ra}
    elif k.startswith("M") and "/" not in k:
        m, ms = look(M_FAR, k, "43-12"); cfv, cs = look(M_CF, k, "43-122")
        out["res"] = (0.0, f"{k} {s:.0%}: residences not permitted (42-12)")
        out["comm"] = (None, None) if m is None else (m * s, f"{k} {s:.0%}: {m:.2f} ({ms})")
        out["ind"] = out["comm"]
        if k.startswith("M1"): out["cf"] = (None, None) if cfv is None else (cfv * s, f"{k} {s:.0%}: community facility {cfv:.2f} ({cs})")
        else: out["cf"] = (0.0, f"{k} {s:.0%}: community facilities not permitted (42-131)")
        out["ok"] = {"res": 0.0, "cf": s if k.startswith("M1") else 0.0, "comm": s, "ind": s, "mix": 0.0}
    else:
        return None
    r, rt = out["res"]
    if res_allowed(k) and k.startswith(("R", "C")):
        out["vac"] = out["res"]
    else:
        out["vac"] = out["comm"] if out["comm"][0] is None else (out["comm"][0], out["comm"][1] + " (residences not permitted, Adrian's decision)")
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", default="26v2"); ap.add_argument("--pluto")
    ap.add_argument("--work", default=os.path.join(ROOT, "work", "far"))
    ap.add_argument("--out", default=os.path.join(ROOT, "far"))
    a = ap.parse_args()
    t0 = time.time()
    pluto = a.pluto or os.path.join(DATA, f"nyc_mappluto_{a.release}_fgdb", f"MapPLUTO{a.release}.gdb")
    attrs = pyogrio.read_dataframe(pluto, columns=["BBL", "LandUse", "LotArea", "BldgArea", "BuiltFAR", "UnitsRes", "Overlay1", "Overlay2"], read_geometry=False, use_arrow=True)
    attrs["bbl"] = attrs.BBL.astype(np.int64); attrs = attrs.drop(columns="BBL").set_index("bbl")
    por = pd.read_parquet(os.path.join(a.work, f"portions_{a.release}.parquet"))
    lots = pd.read_parquet(os.path.join(a.work, f"lots_{a.release}.parquet")).set_index("bbl")
    zd = por[por.kind == "zd"]; co = por[por.kind == "co"]; sp = por[por.kind == "sp"]
    co = co.assign(dist=co.key.str.split("|").str[1])
    ovs = co.groupby(["bbl", "dist"]).share.sum()
    spx = sp[(sp.share >= SLIVER) & ~sp.key.isin(SP_OK) & ~sp.key.str.startswith("EC-")].groupby("bbl").key.apply(lambda s: ", ".join(sorted(set(s)))).to_dict()
    ovs = {k: v for k, v in ovs.items()}
    dsmall = lots["dsmall"].dropna().to_dict()
    zd = zd.sort_values("bbl", kind="stable")
    zb = zd.bbl.to_numpy(); cut = np.flatnonzero(np.diff(zb)) + 1
    starts = np.concatenate([[0], cut]); ends = np.concatenate([cut, [len(zb)]])
    zk, zs, zband, zub = zd.key.to_numpy(), zd.share.to_numpy(), zd.band.to_numpy(), zd.uband.to_numpy()
    zgroups = {int(zb[a0]): (a0, b0) for a0, b0 in zip(starts, ends)}
    out = []
    for at in attrs.itertuples():
        bbl = at.Index
        lu = str(at.LandUse).zfill(2) if at.LandUse not in (None, "") and not pd.isna(at.LandUse) else ""
        use = USE.get(lu, "none")
        rec = {"bbl": bbl, "far_use": USE_LABEL[use], "far_std": np.nan, "far_res": np.nan, "far_comm": np.nan, "far_cf": np.nan,
               "far_status": "modeled", "far_zc": "", "far_trace": "", "split_shares": "", "wide_share": np.nan, "far_note": ""}
        r0 = zgroups.get(bbl)
        if r0 is None or zs[r0[0]:r0[1]].sum() < 0.5:
            rec.update(far_status="not_modeled", far_zc="Not yet modeled", far_note="no zoning district covers the lot"); out.append(rec); continue
        rows_ = list(zip(zk[r0[0]:r0[1]], zs[r0[0]:r0[1]], zband[r0[0]:r0[1]], zub[r0[0]:r0[1]]))
        slivers = [(k, s0) for k, s0, _, _ in rows_ if 0.005 <= s0 < SLIVER]
        rows_ = [r for r in rows_ if r[1] >= SLIVER] or [max(rows_, key=lambda r: r[1])]
        park = sum(r[1] for r in rows_ if r[0] == "PARK")
        rows_ = [r for r in rows_ if r[0] != "PARK"]
        tot = sum(r[1] for r in rows_)
        rec["split_shares"] = ("; ".join(f"{k} {s0/tot:.0%}" for k, s0, _, _ in rows_) if rows_ else "PARK 100%") + (
            " (" + ", ".join(f"{k} {s0:.0%}" for k, s0 in slivers) + " left out as boundary slivers, under 10%)" if slivers else "")
        if park >= 0.5 or not rows_:
            rec.update(far_status="not_rated", far_zc="Not rated", far_note="mapped park"); out.append(rec); continue
        if bbl in spx:
            rec.update(far_status="not_modeled", far_zc="Not yet modeled", far_note=f"special district {spx[bbl]} (left blank until reviewed)"); out.append(rec); continue
        nfb = len(FALLBACK)
        plo = any(isinstance(x, str) and x.strip() for x in (at.Overlay1, at.Overlay2))
        ovmin = 0.0005 if plo else SLIVER
        big = (at.LotArea or 0) >= 4000
        parts = []; bad = []; unres = 0.0; wide = 0.0
        for k, s0, b0, u0 in rows_:
            s = s0 / tot
            b = 0.0 if pd.isna(b0) else min(b0 / tot, s)
            u = 0.0 if pd.isna(u0) else u0 / tot
            ov = ovs.get((bbl, k), 0.0)
            p = portion(k, s, (ov if ov >= ovmin else 0.0) / tot, b, big)
            if p is None: bad.append(k); continue
            parts.append((k, s, b, p)); unres += u
            if (k in WIDE or k in TEST_EQ): wide += b
        if bad:
            rec.update(far_status="not_modeled", far_zc="Not yet modeled", far_note=f"no rule yet for {', '.join(sorted(set(bad)))}"); out.append(rec); continue
        rec["wide_share"] = wide
        sums = {}
        for u in ("res", "comm", "ind", "cf", "vac"):
            vals = [p[u] for _, _, _, p in parts]
            sums[u] = (None if any(v[0] is None for v in vals) else sum(v[0] for v in vals), [v[1] for v in vals if v[1]])
        okshare = {u: sum(p["ok"][u] for _, _, _, p in parts) for u in ("res", "cf", "comm", "ind", "mix")}
        notes = []
        dsm = dsmall.get(bbl, np.nan)
        if len(parts) == 2 and not pd.isna(dsm):
            (k1, s1, b1, _), (k2, s2, b2, _) = sorted(parts, key=lambda x: x[1])
            d = dsm
            f1, f2 = fam(k1), fam(k2)
            rule = None
            if s2 > 0.5 and d <= 25.0:
                if k1 in SF and k2 in SF: rule = "77-211"
                elif f1 == f2 and f1[0] in "CM": rule = "77-211"
                elif f1 != f2 and not (f1 == "R" and f2 == "R"): rule = "77-11"
            if rule:
                ov2 = ovs.get((bbl, k2), 0.0)
                whole = portion(k2, 1.0, (ov2 if ov2 >= ovmin else 0.0) / tot / s2 if s2 else 0.0, (b2 / s2) if s2 else 0.0, big)
                notes.append((rule, k2, whole, d))
        def pick(u):
            v, tr = sums[u]
            if v is None: return None, tr, None
            for rule, k2, whole, d in notes:
                w = whole[u][0]
                if w is not None and w > v + 1e-9:
                    return w, tr + [f"{rule}: the larger district ({k2}) may apply to the whole lot; the smaller part reaches {d:.0f} ft from the boundary; {w:.2f} is more than {v:.2f} (assumes the lot existed on 12/15/1961)"], rule
            return v, tr, None
        res, rtr, r1 = pick("res"); comm, ctr, r2 = pick("comm"); ind, itr, _ = pick("ind"); cf, ftr, r3 = pick("cf"); vac, vtr, _ = pick("vac")
        rec["far_res"] = np.nan if res is None else round(res, 4)
        rec["far_comm"] = np.nan if comm is None else round(comm, 4)
        rec["far_cf"] = np.nan if cf is None else round(cf, 4)
        if use == "res": std, tr, okv = res, rtr, okshare["res"]
        elif use == "mix":
            std = None if res is None or comm is None else max(res, comm); tr = rtr + ctr + ["the greater of residential and commercial (35-31)"]; okv = okshare["mix"]
        elif use == "comm": std, tr, okv = comm, ctr, okshare["comm"]
        elif use == "ind": std, tr, okv = ind, itr, okshare["ind"]
        elif use == "cf": std, tr, okv = cf, ftr, okshare["cf"]
        elif use in ("vac", "park"): std, tr, okv = vac, vtr, 1.0
        else:
            rec.update(far_status="not_rated", far_zc="Not rated", far_note=USE_LABEL[use]); out.append(rec); continue
        if std is None:
            rec.update(far_status="not_modeled", far_zc="Not yet modeled", far_note="no rule yet for " + "; ".join(t for t in tr if t)); out.append(rec); continue
        rec["far_std"] = round(std, 4)
        used = "77-211" if any(t and t.startswith("77-211:") for t in tr) else "77-11" if any(t and t.startswith("77-11:") for t in tr) else "77-22" if len(parts) > 1 else ""
        rec["far_trace"] = " + ".join(t for t in tr if t) + f" = {std:.2f}" + (f" ({used})" if used else "")
        pn = []
        if unres > 0.01: pn.append(f"{unres:.0%} of the lot is near a street whose mapped width is unclear in the DCM")
        if len(FALLBACK) > nfb: pn.append(f"{', '.join(sorted(set(FALLBACK[nfb:])))} not listed in the table; the row without the suffix is used")
        if pn: rec["far_status"] = "provisional"; rec["far_note"] = "; ".join(pn)
        built = at.BuiltFAR if not pd.isna(at.BuiltFAR) else 0.0
        empty = use in ("vac", "park") or (at.BldgArea or 0) == 0
        if okv < 0.5: zc = "Non-conforming use"
        elif empty: zc = "Entire FAR available"
        elif built > std + 0.005: zc = "Non-complying (over maximum FAR)"
        else: zc = "Within maximum FAR"
        rec["far_zc"] = zc
        out.append(rec)
    df = pd.DataFrame(out)
    os.makedirs(a.out, exist_ok=True)
    path = os.path.join(a.out, f"far_{a.release}.csv")
    df.to_csv(path, index=False)
    meta = {"source": f"Lot Profiler FAR engine 1.9.2 (ZR text read November 15, 2026; MapPLUTO {a.release}; DCM 2025-10-31; zoning 2026-08)",
            "columns": {"far_std": {"label": "Maximum FAR for the lot's use", "kind": "base"},
                        "far_res": {"label": "Residential FAR", "kind": "other"},
                        "far_comm": {"label": "Commercial / manufacturing FAR", "kind": "other"},
                        "far_cf": {"label": "Community facility FAR", "kind": "other"},
                        "wide_share": {"label": "Share within 100 ft of a wide street", "kind": "other"}}}
    json.dump(meta, open(os.path.join(a.out, f"far_{a.release}.meta.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(df.far_status.value_counts().to_string()); print(df.far_zc.value_counts().to_string())
    print(f"{path}: {len(df):,} lots in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
