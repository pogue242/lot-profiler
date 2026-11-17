#!/usr/bin/env python3
"""far_geom.py — cut every MapPLUTO lot into zoning, overlay, special district and wide-street portions for the FAR engine."""
import argparse, os, re, sys, time
import numpy as np, pandas as pd, shapely, pyogrio

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.normpath(os.path.join(ROOT, "..", "..", "Data"))
ZGDB = os.path.join(DATA, "nycgiszoningfeatures_202608fgdb", "zoning.gdb")
DCM = os.path.join(DATA, "dcm_20251031", "DCM.gdb")
CELL = 2000.0
BAND = 100.0
UNKNOWN = {"n/a", "na", "unknown", "width irregular", "irreg", "irregular width", "varies", "regular but unknown.", "none", ""}

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

def parse_width(s):
    t = str(s).strip().lower()
    if t in UNKNOWN: return np.nan, np.nan, "unknown"
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", t)]
    if not nums: return np.nan, np.nan, "unknown"
    if ">" in t or "higher" in t or "greater" in t or "over" in t: return min(nums), np.inf, "min"
    if "<" in t or "or less" in t: return 0.0, max(nums), "max"
    if "~" in t or "around" in t or "more or less" in t or "probably" in t or "+-" in t: return min(nums), max(nums), "approx"
    if len(nums) >= 2: return min(nums), max(nums), "range"
    return nums[0], nums[0], "exact"

def classify(lo, hi, how):
    if how == "unknown": return "unresolved"
    if how == "approx" and lo == hi:
        return "wide" if lo >= 80 else "narrow" if lo <= 70 else "unresolved"
    if lo >= 75: return "wide"
    if hi < 75: return "narrow"
    return "unresolved"

def cells_for(geoms):
    b = shapely.bounds(geoms)
    x0 = np.floor(b[:, 0] / CELL).astype(np.int64); x1 = np.floor(b[:, 2] / CELL).astype(np.int64)
    y0 = np.floor(b[:, 1] / CELL).astype(np.int64); y1 = np.floor(b[:, 3] / CELL).astype(np.int64)
    gi, cx, cy = [], [], []
    for i in range(len(geoms)):
        xs, ys = np.meshgrid(np.arange(x0[i], x1[i] + 1), np.arange(y0[i], y1[i] + 1))
        gi.append(np.full(xs.size, i)); cx.append(xs.ravel()); cy.append(ys.ravel())
    gi, cx, cy = np.concatenate(gi), np.concatenate(cx), np.concatenate(cy)
    return gi, cx, cy

def tile(geoms, keys):
    gi, cx, cy = cells_for(geoms)
    boxes = shapely.box(cx * CELL, cy * CELL, (cx + 1) * CELL, (cy + 1) * CELL)
    pieces = shapely.intersection(geoms[gi], boxes)
    ok = ~shapely.is_empty(pieces) & (shapely.area(pieces) > 0)
    return pieces[ok], np.asarray(keys)[gi[ok]], (cx * 100000 + cy)[ok]

def dissolve_tiles(geoms):
    gi, cx, cy = cells_for(geoms)
    cid = cx * 100000 + cy
    boxes = shapely.box(cx * CELL, cy * CELL, (cx + 1) * CELL, (cy + 1) * CELL)
    pieces = shapely.intersection(geoms[gi], boxes)
    df = pd.DataFrame({"c": cid, "g": pieces})
    out = [shapely.union_all(grp.g.to_numpy()) for _, grp in df.groupby("c")]
    out = np.array([g for g in out if not g.is_empty], dtype=object)
    return out

def shares(lots, area, pieces, keys):
    shapely.prepare(pieces)
    tree = shapely.STRtree(pieces)
    li, pj = tree.query(lots, predicate="intersects")
    inside = shapely.contains_properly(pieces[pj], lots[li])
    a = np.where(inside, area[li], 0.0)
    rest = ~inside
    a[rest] = shapely.area(shapely.intersection(lots[li[rest]], pieces[pj[rest]]))
    df = pd.DataFrame({"i": li, "key": keys[pj], "a": a})
    df = df[df.a > 0].groupby(["i", "key"], as_index=False).a.sum()
    df["share"] = df.a / area[df.i.to_numpy()]
    return df

def band_area(geoms, band):
    tree = shapely.STRtree(band)
    gi, bj = tree.query(geoms, predicate="intersects")
    a = shapely.area(shapely.intersection(geoms[gi], band[bj]))
    return np.bincount(gi, weights=a, minlength=len(geoms))

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", default="26v2"); ap.add_argument("--pluto")
    ap.add_argument("--out", default=os.path.join(ROOT, "work", "far"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    pluto = a.pluto or os.path.join(DATA, f"nyc_mappluto_{a.release}_fgdb", f"MapPLUTO{a.release}.gdb")
    t0 = time.time()
    lot = pyogrio.read_dataframe(pluto, columns=["BBL"], use_arrow=True)
    lot = lot.sort_values("BBL", kind="stable").reset_index(drop=True)
    lots = np.asarray(shapely.make_valid(np.asarray(lot.geometry, dtype=object)), dtype=object)
    area = shapely.area(lots)
    log(f"{len(lots):,} lots read")

    def layer(name, col):
        d = pyogrio.read_dataframe(ZGDB, layer=name)
        return np.asarray(shapely.make_valid(np.asarray(d.geometry, dtype=object)), dtype=object), d[col].astype(str).to_numpy(), d
    zg, zk, _ = layer("nyzd", "ZONEDIST")
    zp, zpk, _ = tile(zg, zk)
    zd = shares(lots, area, zp, zpk); zd["kind"] = "zd"
    log(f"zoning: {len(zd):,} lot portions")

    cg, ck, _ = layer("nyco", "OVERLAY")
    cp, cpk, _ = tile(cg, ck)
    tree = shapely.STRtree(zp)
    ci, zj = tree.query(cp, predicate="intersects")
    cz = shapely.intersection(cp[ci], zp[zj])
    ok = shapely.area(cz) > 0
    co = shares(lots, area, cz[ok], np.char.add(np.char.add(cpk[ci[ok]].astype(str), "|"), zpk[zj[ok]].astype(str)))
    co["kind"] = "co"
    log(f"overlays: {len(co):,} lot portions")

    sg, sk, _ = layer("nysp", "SDLBL")
    sp_, spk, _ = tile(sg, sk)
    sp = shares(lots, area, sp_, spk); sp["kind"] = "sp"
    sdd = pyogrio.read_dataframe(ZGDB, layer="nysp_sd")
    sdk = (sdd.SPLBL.astype(str) + "|" + sdd.SUBDIST_LBL.fillna("").astype(str) + "|" + sdd.SUBAREA_LBL.fillna("").astype(str)).to_numpy()
    sdp, sdpk, _ = tile(np.asarray(shapely.make_valid(np.asarray(sdd.geometry, dtype=object)), dtype=object), sdk)
    ssd = shares(lots, area, sdp, sdpk); ssd["kind"] = "sd"
    log(f"special districts: {len(sp):,} lot portions, subdistricts {len(ssd):,}")

    st = pyogrio.read_dataframe(DCM, layer="DCM_StreetCenterLine")
    w = st.Streetwidth.apply(parse_width)
    st["lo"] = [x[0] for x in w]; st["hi"] = [x[1] for x in w]; st["how"] = [x[2] for x in w]
    st["cls"] = [classify(lo, hi, how) for lo, hi, how in zip(st.lo, st.hi, st.how)]
    use = (st.Feat_Type == "Mapped_St") & (st.Feat_status != "Demapped") & (st.RoadwayType != "Subsurfc")
    st["used"] = use
    st.drop(columns="geometry").to_csv(os.path.join(a.out, "dcm_widths.csv"), index=False)
    sl = np.asarray(shapely.force_2d(np.asarray(st.geometry, dtype=object)), dtype=object)
    wide = (use & (st.cls == "wide")).to_numpy()
    unres = (use & (st.cls == "unresolved")).to_numpy()
    wb = shapely.buffer(sl[wide], st.lo.to_numpy()[wide] / 2 + BAND, quad_segs=64)
    uw = np.where(np.isfinite(st.hi.to_numpy()), st.hi.to_numpy(), np.where(np.isfinite(st.lo.to_numpy()), np.maximum(st.lo.to_numpy(), 75.0), 100.0))
    ub = shapely.buffer(sl[unres], uw[unres] / 2 + BAND, quad_segs=64)
    log(f"streets: {int(wide.sum()):,} wide and {int(unres.sum()):,} unresolved mapped segments of {int(use.sum()):,}")
    band = dissolve_tiles(wb); uband = dissolve_tiles(ub)
    shapely.prepare(band); shapely.prepare(uband)
    log(f"wide-street band: {len(band):,} tiles; unresolved band: {len(uband):,} tiles")

    test = {"R6", "R7-1", "R7-2", "R8", "C4-2", "C4-3", "C6-1A", "C1-6", "C2-6", "C4-4", "C4-5", "C6-1", "C1-7", "C4-2F", "C4-8", "C6-2"}
    zt = zd[zd.key.isin(test)].copy()
    one = zt.share > 0.999
    geo = np.empty(len(zt), dtype=object)
    geo[one.to_numpy()] = lots[zt.i.to_numpy()[one.to_numpy()]]
    multi = zt[~one]
    if len(multi):
        zt_sel = np.isin(zpk, list(test))
        tree = shapely.STRtree(zp[zt_sel]); zsub = zp[zt_sel]; zsubk = zpk[zt_sel]
        mg = []
        for i, k in zip(multi.i.to_numpy(), multi.key.to_numpy()):
            cand = tree.query(lots[i], predicate="intersects")
            cand = cand[zsubk[cand] == k]
            mg.append(shapely.intersection(lots[i], shapely.union_all(zsub[cand])))
        geo[(~one).to_numpy()] = mg
    zt["band"] = band_area(geo, band) / area[zt.i.to_numpy()]
    ua = band_area(geo, uband)
    hit = np.nonzero(ua > 0)[0]
    if len(hit):
        bt = shapely.STRtree(band)
        rest = np.empty(len(hit), dtype=object)
        for n, k in enumerate(hit):
            c = bt.query(geo[k], predicate="intersects")
            rest[n] = shapely.difference(geo[k], shapely.union_all(band[c])) if len(c) else geo[k]
        ua[hit] = band_area(rest, uband)
    zt["uband"] = ua / area[zt.i.to_numpy()]
    zd = zd.merge(zt[["i", "key", "band", "uband"]], on=["i", "key"], how="left")
    log(f"wide-street shares for {len(zt):,} portions")

    zz = zd[(zd.share >= 0.10) & (zd.key != "PARK")]
    two = zz.groupby("i").key.transform("size") == 2
    pairs = zz[two].sort_values(["i", "share"])
    d77 = [(i, g.key.iloc[0], g.key.iloc[1]) for i, g in pairs.groupby("i")]
    tree = shapely.STRtree(zp)
    rows = []
    for i, small, big in d77:
        cand = tree.query(lots[i], predicate="intersects")
        gs = shapely.intersection(lots[i], shapely.union_all(zp[cand[zpk[cand] == small]]))
        gb = shapely.intersection(lots[i], shapely.union_all(zp[cand[zpk[cand] == big]]))
        if gs.is_empty or gb.is_empty: continue
        pts = shapely.points(shapely.get_coordinates(gs))
        rows.append((i, float(shapely.distance(pts, gb).max())))
    dist = pd.DataFrame(rows, columns=["i", "dsmall"])
    log(f"77-11/77-211 distances for {len(dist):,} two-district lots")

    out = pd.concat([zd, co, sp, ssd], ignore_index=True)
    out["bbl"] = lot.BBL.to_numpy()[out.i.to_numpy()].astype(np.int64)
    out.to_parquet(os.path.join(a.out, f"portions_{a.release}.parquet"))
    lo = pd.DataFrame({"i": np.arange(len(lots)), "bbl": lot.BBL.to_numpy().astype(np.int64), "garea": area}).merge(dist, on="i", how="left")
    lo.to_parquet(os.path.join(a.out, f"lots_{a.release}.parquet"))
    log(f"done in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
