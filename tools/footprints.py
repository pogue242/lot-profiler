#!/usr/bin/env python3
"""footprints.py — build building-footprint tiles (roof height, year built, BBL, and the lot's land use and units band from MapPLUTO) from NYC Open Data's Building Footprints"""
import argparse, os, sys
import numpy as np, pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lp_build as L

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.abspath(os.path.join(HERE, "..", "..", "..", "Data"))

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default=os.path.join(DATA, "footprints_2026-10-30", "footprints.geojson"))
    ap.add_argument("--release", default="26v2")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data", "buildings_2026-10-30.pmtiles"))
    ap.add_argument("--minzoom", type=int, default=15)
    a = ap.parse_args()
    import pyogrio
    df = pyogrio.read_dataframe(a.src, columns=["height_roof", "construction_year", "mappluto_bbl", "base_bbl", "bin", "feature_code", "last_status_type", "name"])
    print(f"{len(df):,} footprints", flush=True)
    df = df[df.geometry.notna() & ~df.geometry.is_empty & (df.last_status_type.fillna("Constructed") != "Demolition")].reset_index(drop=True)
    num = lambda c: pd.to_numeric(df[c], errors="coerce")
    bbl = num("mappluto_bbl").fillna(num("base_bbl")).fillna(0).astype("int64")
    gdb = os.path.join(DATA, f"nyc_mappluto_{a.release}_fgdb", f"MapPLUTO{a.release}.gdb")
    p = pyogrio.read_dataframe(gdb, columns=["BBL", "LandUse", "UnitsRes"], read_geometry=False, use_arrow=True)
    p = pd.DataFrame({"b": p.BBL.astype("int64"), "lu": L.land_use_index(p.LandUse.fillna("").astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2).values),
                      "ub": L.unit_band(pd.to_numeric(p.UnitsRes, errors="coerce").clip(0, 65535).to_numpy(np.float64))}).drop_duplicates("b").set_index("b")
    j = p.reindex(bbl.values)
    props = pd.DataFrame({
        "h": num("height_roof").fillna(0).round(1).astype("float32"),
        "y": num("construction_year").fillna(0).astype("int32"),
        "b": bbl.values,
        "n": num("bin").fillna(0).astype("int64"),
        "f": num("feature_code").fillna(0).astype("int32"),
        "nm": df.name.fillna(""),
        "lu": j.lu.fillna(255).astype("int16").values,
        "ub": j.ub.fillna(255).astype("int16").values})
    print(f"  {len(props):,} kept; {(props.h > 0).mean() * 100:.1f}% with a roof height, {(props.y > 0).mean() * 100:.1f}% with a year, "
          f"{(props.b > 0).mean() * 100:.1f}% with a BBL, {(props.lu < 255).mean() * 100:.1f}% matched to a {a.release} lot; tallest {props.h.max():,.0f} ft", flush=True)
    L.write_tiles(a.out, L.tile_frame(df.geometry.values, props), "bldg", a.minzoom, 16, simplification=0.25, name="NYC building footprints")

if __name__ == "__main__":
    main()
