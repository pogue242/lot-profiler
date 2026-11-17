#!/usr/bin/env python3
"""more_areas.py — build data/<release>/more_areas.json.gz: community district, CDTA and borough outlines plus each lot's community district from MapPLUTO"""
import argparse, gzip, json, os
import numpy as np, geopandas as gpd, pyogrio
from lp_build import read_pack

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.abspath(os.path.join(ROOT, "..", "..", "Data"))
BORO = {1: "Manhattan", 2: "Bronx", 3: "Brooklyn", 4: "Queens", 5: "Staten Island"}
JIA = {164: "Central Park", 226: "Van Cortlandt Park", 227: "Bronx Park", 228: "Pelham Bay Park", 355: "Prospect Park", 356: "Brooklyn Gateway National Recreation Area",
       480: "LaGuardia Airport", 481: "Flushing Meadows-Corona Park", 482: "Forest Park", 483: "JFK Airport", 484: "Queens Gateway National Recreation Area",
       595: "Staten Island Gateway National Recreation Area"}

def polys(geom, tol):
    g = geom.simplify(tol, preserve_topology=True)
    parts = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    r = lambda ring: [[round(x, 6), round(y, 6)] for x, y in ring.coords]
    return [[r(p.exterior)] + [r(h) for h in p.interiors] for p in parts if not p.is_empty]

def entry(kind, code, name, geom, tol):
    pt = geom.representative_point(); x0, y0, x1, y1 = geom.bounds
    return {"kind": kind, "code": code, "name": name, "bbox": [round(x0, 6), round(y0, 6), round(x1, 6), round(y1, 6)], "label": [round(pt.x, 6), round(pt.y, 6)]}, polys(geom, tol)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", default="26v2"); ap.add_argument("--gdb", default=os.path.join(DATA, "nyc_mappluto_26v2_fgdb", "MapPLUTO26v2.gdb"))
    ap.add_argument("--boundaries", default=os.path.join(DATA, "boundaries_2020")); ap.add_argument("--tol", type=float, default=0.00003)
    a = ap.parse_args()
    out_dir = os.path.join(ROOT, "data", a.release)
    rd = lambda f: gpd.read_file(os.path.join(a.boundaries, f)).to_crs(4326)
    cd, cdta, boro, nta = rd("5crt-au7u.geojson"), rd("xn3r-zk6y.geojson"), rd("gthc-hcne.geojson"), rd("9nt8-h7nd.geojson")
    entries, P = [], {"cd": {}, "cdta": {}, "boro": {}}
    for _, r in boro.sort_values("borocode").iterrows():
        e, p = entry("boro", str(int(r.borocode)), r.boroname, r.geometry, a.tol); entries.append(e); P["boro"][e["code"]] = p
    for _, r in cd.assign(k=cd.boro_cd.astype(int)).sort_values("k").iterrows():
        k = int(r.k); b, n = divmod(k, 100)
        name = f"{JIA[k]} (joint interest area)" if k in JIA else f"{BORO[b]} Community District {n}"
        e, p = entry("cd", str(k), name, r.geometry, a.tol); entries.append(e); P["cd"][e["code"]] = p
    for _, r in cdta.sort_values("cdta2020").iterrows():
        nm = str(r.cdtaname); nm = nm[len(r.cdta2020):].strip() if nm.startswith(r.cdta2020) else nm
        e, p = entry("cdta", r.cdta2020, f"{nm.split(' (')[0]} ({r.cdta2020})", r.geometry, a.tol); entries.append(e); P["cdta"][e["code"]] = p
    core = read_pack(os.path.join(out_dir, "core.lpk"))
    bbl = core["blkKey"][core["blk"]].astype(np.int64) * 10000 + core["lotno"].astype(np.int64)
    df = pyogrio.read_dataframe(a.gdb, columns=["BBL", "CD"], read_geometry=False)
    m = dict(zip(df.BBL.astype(np.int64), df.CD.fillna(0).astype(int)))
    lot_cd = [m.get(int(b), 0) for b in bbl]
    codes = set(P["cd"]); runs, prev = [], None
    for i, c in enumerate(lot_cd):
        c = str(c) if str(c) in codes else ""
        if c != prev: runs.append([i, c]); prev = c
    miss = sum(1 for c in lot_cd if str(c) not in codes)
    doc = {"entries": entries, "polys": P, "ntaCdta": dict(zip(nta.nta2020, nta.cdta2020)), "cdRuns": runs}
    path = os.path.join(out_dir, "more_areas.json.gz")
    with open(path, "wb") as fh: fh.write(gzip.compress(json.dumps(doc, separators=(",", ":")).encode(), 9))
    print(f"{path}: {len(entries)} areas, {len(runs):,} CD runs, {miss:,} of {len(bbl):,} lots without a community district, {os.path.getsize(path)/1e6:.2f} MB")

if __name__ == "__main__":
    main()
