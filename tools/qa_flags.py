#!/usr/bin/env python3
"""qa_flags.py — flag lots whose PLUTO figures don't add up and store each lot's measured outline area"""
import argparse, json, os, sys, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lp_build as L

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

def main():
    import pyogrio
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("gdb"); ap.add_argument("--release", required=True); ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    a = ap.parse_args()
    out = os.path.join(a.data, a.release)
    core = L.read_pack(os.path.join(out, "core.lpk"))
    bbl = core["blkKey"][core["blk"]].astype(np.int64) * 10000 + core["lotno"].astype(np.int64)
    layer = next(n for n, g in pyogrio.list_layers(a.gdb) if g and "Polygon" in g)
    cols = ["BBL", "LotArea", "BldgArea", "ResArea", "BuiltFAR", "NumFloors", "UnitsRes", "BldgClass", "LandUse", "Shape_Area"]
    d = pyogrio.read_dataframe(a.gdb, layer=layer, columns=cols, read_geometry=False)
    d["BBL"] = d["BBL"].astype(np.int64)
    d = d.drop_duplicates("BBL").set_index("BBL")
    missing = int((~np.isin(bbl, d.index.values)).sum())
    d = d.reindex(bbl)
    num = lambda c: d[c].astype(float).fillna(0).values
    la, ba, ra, bf, fl, u, sa = num("LotArea"), num("BldgArea"), num("ResArea"), num("BuiltFAR"), num("NumFloors"), num("UnitsRes"), num("Shape_Area")
    clsA = d["BldgClass"].fillna("").astype(str).str.startswith("A").values
    lu = d["LandUse"].fillna("").astype(str).values
    flags = np.zeros(len(bbl), np.uint8)
    flags |= np.where((fl > 0) & (bf > fl * 1.05 + 0.05), 1, 0).astype(np.uint8)
    flags |= np.where((u > 0) & (ba == 0), 2, 0).astype(np.uint8)
    flags |= np.where((u > 0) & np.isin(lu, ["09", "10", "11"]), 4, 0).astype(np.uint8)
    flags |= np.where((u >= 3) & (ra > 0) & (ra < 250 * np.maximum(u, 1)), 8, 0).astype(np.uint8)
    flags |= np.where(clsA & (u >= 3), 16, 0).astype(np.uint8)
    ratio = np.where(la > 0, sa / np.where(la > 0, la, 1), 1.0)
    keep = (flags > 0) | (ratio > 1.1) | (ratio < 1 / 1.1)
    idx = np.nonzero(keep)[0].astype(np.uint32)
    header = {"format": 1, "release": a.release, "built": time.strftime("%Y-%m-%d"), "source": os.path.basename(os.path.normpath(a.gdb)),
              "flags": {"1": "Built FAR above the floor count", "2": "Housing units but no building floor area",
                        "4": "Housing units on vacant land, parking or open space", "8": "Under 250 sq ft of residential floor area per unit",
                        "16": "One-family building class with 3 or more units"}}
    raw, size = L.write_pack(os.path.join(out, "qa.lpk"), b"LPQ1", header,
                             {"idx": idx, "outA": sa[idx].astype(np.float32), "flags": flags[idx]})
    man_path = os.path.join(a.data, "releases.json")
    man = json.load(open(man_path, encoding="utf-8"))
    for m in man:
        if m["id"] == a.release:
            m["qa"] = {"file": "qa.lpk", "built": header["built"]}
            m["bytes"] = L.folder_bytes(out)
    json.dump(man, open(man_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    off = lambda t: int(((ratio > 1 + t) | (ratio < 1 / (1 + t))).sum())
    print(f"{a.release}: {len(idx):,} lots stored, qa.lpk {size/1e3:.0f} KB; {missing} lots not in the FGDB")
    for b, t in header["flags"].items(): print(f"  {t}: {int(((flags & int(b)) > 0).sum()):,}")
    print(f"  lot area vs outline off by >25%: {off(0.25):,}, >50%: {off(0.5):,}")

if __name__ == "__main__":
    main()
