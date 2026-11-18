#!/usr/bin/env python3
"""zone_split.py — build data/<release>/zone_split.json.gz: every zoning district PLUTO lists for each split lot (ZoneDist1–4), with its share of the lot from far_geom.py's exact cut, largest first"""
import argparse, gzip, json, os
import numpy as np, pandas as pd, pyogrio
from lp_build import read_pack

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.abspath(os.path.join(ROOT, "..", "..", "Data"))
COLS = ["ZoneDist1", "ZoneDist2", "ZoneDist3", "ZoneDist4"]

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", default="26v2"); ap.add_argument("--gdb", default=os.path.join(DATA, "nyc_mappluto_26v2_fgdb", "MapPLUTO26v2.gdb"))
    ap.add_argument("--portions", default=None)
    a = ap.parse_args()
    out_dir = os.path.join(ROOT, "data", a.release)
    core = read_pack(os.path.join(out_dir, "core.lpk"))
    bbl = core["blkKey"][core["blk"]].astype(np.int64) * 10000 + core["lotno"].astype(np.int64)
    idx = {int(b): i for i, b in enumerate(bbl)}
    df = pyogrio.read_dataframe(a.gdb, columns=["BBL"] + COLS, read_geometry=False)
    df = df[df.ZoneDist2.notna()]
    p = pd.read_parquet(a.portions or os.path.join(ROOT, "work", "far", f"portions_{a.release}.parquet"))
    p = p[(p.kind == "zd") & p.bbl.isin(df.BBL.astype(np.int64))]
    sh = {b: dict(zip(x.key, x.share)) for b, x in p.groupby("bbl")}
    names, nid, rows, measured = [], {}, [], 0
    for r in df.itertuples():
        b = int(r.BBL)
        if b not in idx: continue
        zs = [v for v in (getattr(r, c) for c in COLS) if isinstance(v, str) and v]
        s = sh.get(b, {}); v = [s.get(z) for z in zs]
        full = None not in v
        if full: measured += 1; zs = [z for _, z in sorted(zip(v, zs), key=lambda t: -t[0])]
        row = [idx[b]]
        for z in zs:
            if z not in nid: nid[z] = len(names); names.append(z)
            row += [nid[z], int(round(s[z] * 1000)) if full else -1]
        rows.append(row)
    rows.sort()
    doc = {"d": names, "l": rows}
    path = os.path.join(out_dir, "zone_split.json.gz")
    with open(path, "wb") as fh: fh.write(gzip.compress(json.dumps(doc, separators=(",", ":")).encode(), 9))
    print(f"{path}: {len(rows):,} split lots, {measured:,} with measured shares, {os.path.getsize(path)/1e3:.0f} KB")

if __name__ == "__main__":
    main()
