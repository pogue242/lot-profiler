#!/usr/bin/env python3
"""units.py — rebuild a release's units-per-building band: 0-8 any lot with units, 254 = 0 units, 255 = UnitsRes blank (from --gdb)."""
import argparse, json, os, shutil, subprocess, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lp_build as L

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--release", required=True); ap.add_argument("--gdb"); ap.add_argument("--layer")
    ap.add_argument("--data", default=os.path.join(ROOT, "data")); ap.add_argument("--parquet")
    ap.add_argument("--no-tiles", action="store_true")
    a = ap.parse_args()
    import geopandas as gpd
    t0 = time.time()
    out = os.path.join(a.data, a.release); work = os.path.join(ROOT, "work")
    core_path = os.path.join(out, "core.lpk"); tiles = os.path.join(out, "lots.pmtiles"); pq = os.path.join(work, f"{a.release}_lots.parquet")
    if not os.path.exists(pq):
        if not a.parquet: sys.exit(f"NOTICE: {pq} is missing; pass --parquet with the lot file from the build")
        os.makedirs(work, exist_ok=True); shutil.copy2(a.parquet, pq)
    bak = os.path.join(work, "pre-units", a.release); os.makedirs(bak, exist_ok=True)
    for p in (core_path, tiles, pq):
        if os.path.exists(p) and not os.path.exists(os.path.join(bak, os.path.basename(p))): shutil.copy2(p, bak)

    P = L.read_pack(core_path); H = dict(P["H"]); H.pop("sections"); n = H["n"]
    units = P["units"].astype(np.float64)
    if a.gdb:
        import pyogrio
        layer = a.layer or next(nm for nm, g in pyogrio.list_layers(a.gdb) if g and "Polygon" in g)
        df = pyogrio.read_dataframe(a.gdb, layer=layer, columns=["BBL", "UnitsRes"], read_geometry=False).sort_values("BBL", kind="stable")
        if len(df) != n: sys.exit(f"NOTICE: {len(df)} lots in the gdb, {n} in the release")
        blank = df.UnitsRes.isna().to_numpy()
        units[blank] = np.nan
    ub = L.unit_band(units)
    old = P["ub"]
    secs = {k: v for k, v in P.items() if k not in ("H", "_magic", "ub")}
    H["dict"] = {**H["dict"], "ub": L.UNIT_BUCKETS}
    H["tileProps"] = {**H.get("tileProps", {}), "ub": "units-per-building band 0-8, 254 = 0 units, 255 = unit count blank"}
    raw, size = L.write_pack(core_path, b"LPK3", H, {**secs, "ub": ub})
    moved = int(((old == 255) & (ub < 9)).sum())
    print(f"{a.release}: core.lpk {size:,} bytes; {int((ub < 9).sum()):,} with units, {int((ub == 254).sum()):,} with 0, "
          f"{int((ub == 255).sum()):,} blank; {moved:,} lots outside residential land uses now in a band", flush=True)

    g = gpd.read_parquet(pq)
    if not (g["i"].to_numpy() == np.arange(n)).all(): sys.exit("NOTICE: the work parquet isn't in lot order")
    g["ub"] = ub.astype(np.int16)
    g.to_parquet(pq)

    man_path = os.path.join(a.data, "releases.json"); man = json.load(open(man_path, encoding="utf-8"))
    entry = next(m for m in man if m["id"] == a.release)
    if not a.no_tiles:
        if entry.get("far"):
            tab = os.path.join(ROOT, "far", f"far_{a.release}.csv"); meta = os.path.join(ROOT, "far", f"far_{a.release}.meta.json")
            subprocess.run([sys.executable, os.path.join(HERE, "far_join.py"), "--release", a.release, tab, "--data", a.data]
                           + (["--meta", meta] if os.path.exists(meta) else []), check=True)
            man = json.load(open(man_path, encoding="utf-8")); entry = next(m for m in man if m["id"] == a.release)
        else:
            tmp = os.path.join(out, "lots.new.pmtiles")
            L.write_tiles(tmp, g[[c for c in ("i", "lu", "ub", "zn", "yb", "bf", "fl", "geometry")]], "lots", L.LOT_TILE_MINZOOM, 16, name=f"Lot Profiler {a.release} lots")
            os.replace(tmp, tiles)
    entry["core"] = os.path.getsize(core_path); entry["bytes"] = L.folder_bytes(out)
    json.dump(man, open(man_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{a.release}: unit bands rebuilt in {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    main()
