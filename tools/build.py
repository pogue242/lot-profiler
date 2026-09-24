#!/usr/bin/env python3
"""
build.py — turn MapPLUTO lot shapefiles into one compact, gzipped binary
"release pack" that the Lot Profiler loads in a single request.

    python tools/build.py data/raw/25v4/*.shp                 # release read from the .xml
    python tools/build.py MapPLUTO_26v1.shp --release 26v1 --released 2026-03

Each run writes   data/<release>.lpk   and adds/updates the entry in
data/releases.json, so every PLUTO release you build shows up in the
history bar at the top of the app. Older releases stay available.

Requires only: numpy, opencv-python-headless, scipy
"""
import argparse, glob, gzip, json, os, struct, sys, time
import numpy as np
import cv2
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from pluto_io import read_dbf, read_shp_polygons, group_polygons, sp_to_lnglat, read_release

# ── Category vocabularies (fixed order = stable colour/legend order) ───────
LAND_USE = ["1-2 family", "Multifamily walk-up", "Multifamily elevator",
            "Mixed residential/commercial", "Commercial/office", "Industrial/manufacturing",
            "Transportation/utility", "Public facilities/institutions", "Open space/recreation",
            "Parking", "Vacant land", "Other/unknown"]
UNIT_BUCKETS = ["1 unit", "2 units", "3 units", "4 units", "5-9 units", "10-19 units",
                "20-49 units", "50-99 units", "100+ units"]          # + 255 = not residential
FAR_CATS = ["High unused FAR", "Moderate unused FAR", "Low unused FAR", "Near FAR limit",
            "Over modeled FAR", "Use not allowed / no modeled FAR",
            "Excluded: park/transit/open space"]
REC_FIELDS = ["OwnerName","OwnerType","BldgClass","LandUse","BldgArea","ResArea","ComArea","OfficeArea",
    "RetailArea","GarageArea","StrgeArea","FactryArea","NumBldgs","NumFloors","UnitsTotal","LotFront","LotDepth",
    "BldgFront","BldgDepth","YearAlter1","YearAlter2","ZoneDist1","ZoneDist2","ZoneDist3","ZoneDist4","Overlay1",
    "Overlay2","SPDist1","SPDist2","SPDist3","LtdHeight","SplitZone","ResidFAR","CommFAR","FacilFAR","AdjResFar",
    "WideSt","ZoneMap","CD","Council","SchoolDist","PolicePrct","FireComp","ZipCode","HistDist","Landmark",
    "AssessLand","AssessTot","ExemptTot","CondoNo","EDesigNum","Sanborn","TaxMap","IrrLotCode","LotType",
    "ProxCode","BsmtCode","Ext","PFIRM15_FL","FIRM07_FLA","APPBBL","APPDate"]
Q = 1e6                                   # coordinate quantisation: 1e-6 deg ≈ 0.1 m
CELL = 10.0                               # raster cell (ft) used to trace area outlines

def code_of(vocab, value, missing):
    try: return vocab.index(value)
    except ValueError: return missing

def trace_outlines(label_img, n_labels, x0, y1, min_share):
    """Label raster -> {label: [polygon rings in lng/lat]} + label anchor point."""
    out = {}
    for lab in range(1, n_labels + 1):
        mask = (label_img == lab).astype(np.uint8)
        if not mask.any(): continue
        # keep the main body; drop crumbs (< min_share of the largest piece)
        ncomp, comp, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        if ncomp > 2:
            areas = stats[1:, cv2.CC_STAT_AREA]
            keep = [i + 1 for i, a in enumerate(areas) if a >= areas.max() * min_share]
            mask = np.isin(comp, keep).astype(np.uint8)
        contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for ci, c in enumerate(contours):
            if hier[0][ci][3] != -1: continue                # holes handled with parent
            rings = [c]
            child = hier[0][ci][2]
            while child != -1:
                if cv2.contourArea(contours[child]) > 40: rings.append(contours[child])
                child = hier[0][child][0]
            poly = []
            for r in rings:
                r = cv2.approxPolyDP(r, 1.2, True).reshape(-1, 2).astype(np.float64)
                if len(r) < 3: continue
                xs = x0 + (r[:, 0] + 0.5) * CELL
                ys = y1 - (r[:, 1] + 0.5) * CELL
                lng, lat = sp_to_lnglat(xs, ys)
                ring = [[round(a, 5), round(b, 5)] for a, b in zip(lng, lat)]
                ring.append(ring[0])
                poly.append(ring)
            if poly: polys.append(poly)
        dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
        py, px = np.unravel_index(int(dist.argmax()), dist.shape)
        la, lb = sp_to_lnglat([x0 + (px + .5) * CELL], [y1 - (py + .5) * CELL])
        out[lab] = (polys, [round(float(la[0]), 5), round(float(lb[0]), 5)])
    return out

def trace_blocks(polys_per_lot, bbls):
    """One outline per tax block (borough+block), traced from the lots at 5 ft."""
    cell = 5.0
    groups = {}
    for i, b in enumerate(bbls):
        groups.setdefault(int(b) // 10000, []).append(i)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    out = []
    for key in sorted(groups):
        idx = groups[key]
        pts = np.vstack([r for i in idx for poly in polys_per_lot[i] for r in poly]) if idx else None
        if pts is None or not len(pts): continue
        x0, y0 = pts[:, 0].min() - 20, pts[:, 1].min() - 20
        x1, y1 = pts[:, 0].max() + 20, pts[:, 1].max() + 20
        img = np.zeros((int((y1 - y0) / cell) + 2, int((x1 - x0) / cell) + 2), np.uint8)
        for i in idx:
            rings = [np.round(np.column_stack([(r[:, 0] - x0) / cell, (y1 - r[:, 1]) / cell])).astype(np.int32)
                     for poly in polys_per_lot[i] for r in poly]
            if rings: cv2.fillPoly(img, rings, 1)
        img = cv2.morphologyEx(img, cv2.MORPH_CLOSE, k)
        cs, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for c in cs:
            if cv2.contourArea(c) < 20: continue
            r = cv2.approxPolyDP(c, 0.8, True).reshape(-1, 2).astype(np.float64)
            if len(r) < 3: continue
            lng, lat = sp_to_lnglat(x0 + (r[:, 0] + .5) * cell, y1 - (r[:, 1] + .5) * cell)
            ring = [[round(a, 6), round(b, 6)] for a, b in zip(lng, lat)]; ring.append(ring[0])
            polys.append([ring])
        out.append({"key": key, "boro": key // 100000, "block": key % 100000, "polys": polys})
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shp", nargs="+", help="lot shapefiles (globs ok); lots are concatenated")
    ap.add_argument("--release", help="PLUTO release id, e.g. 25v4 (default: read from .xml)")
    ap.add_argument("--released", default="", help="release date shown in the history bar, e.g. 2025-12")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data"))
    args = ap.parse_args()
    t0 = time.time()
    paths = sorted({p for s in args.shp for p in glob.glob(s)})
    if not paths: sys.exit("no shapefiles matched")

    release = args.release or read_release(paths[0][:-4] + "_shp.xml") or read_release(paths[0][:-4] + ".shp.xml")
    if not release: sys.exit("could not detect the release; pass --release 25v4")

    # ── read + concatenate ──
    cols, geoms = {}, []
    for p in paths:
        n, c = read_dbf(p[:-4] + ".dbf")
        g = read_shp_polygons(p)
        assert len(g) == n, f"{p}: {len(g)} shapes vs {n} records"
        for k, v in c.items(): cols.setdefault(k, []).extend(v)
        geoms.extend(g)
        print(f"  {os.path.basename(p):<28}{n:>8,} lots")
    n = len(geoms)
    need = ["LotArea", "UnitsRes", "BuiltFAR", "MaxFARUse", "FARDiff", "YearBuilt", "LandUseTxt",
            "UnitBetter", "FARMapCat", "ZoneDist1", "Address", "ntaname", "nta2020", "BCT2020", "BBL"]
    missing = [f for f in need if f not in cols]
    if missing: sys.exit(f"missing fields: {missing}")

    # ── projected geometry, centroids ──
    polys_per_lot = [group_polygons(g) for g in geoms]
    allpts = np.vstack([r for g in geoms for r in g])
    lng_all, lat_all = sp_to_lnglat(allpts[:, 0], allpts[:, 1])
    ox, oy = round(float(lng_all.min()) - 0.001, 3), round(float(lat_all.min()) - 0.001, 3)

    cxs, cys = np.zeros(n), np.zeros(n)
    poly_off, ring_off, vert_off, verts = [0], [0], [0], []
    for i, polys in enumerate(polys_per_lot):
        # area-weighted centroid of all exterior rings (feet), then project
        ax = ay = at = 0.0
        for poly in polys:
            r = poly[0]; x, y = r[:, 0], r[:, 1]
            cr = x[:-1] * y[1:] - x[1:] * y[:-1]
            a = cr.sum() / 2
            if abs(a) > 1e-9:
                ax += ((x[:-1] + x[1:]) * cr).sum() / 6; ay += ((y[:-1] + y[1:]) * cr).sum() / 6; at += a
        if abs(at) > 1e-9: cx, cy = ax / at, ay / at
        else:
            pts = np.vstack(geoms[i]) if geoms[i] else np.zeros((1, 2)); cx, cy = pts.mean(0)
        cxs[i], cys[i] = cx, cy
        for poly in polys:
            for r in poly:
                lng, lat = sp_to_lnglat(r[:-1, 0], r[:-1, 1])     # drop closing vertex
                qx = np.round((lng - ox) * Q).astype(np.int64)
                qy = np.round((lat - oy) * Q).astype(np.int64)
                dx = np.diff(qx, prepend=0); dy = np.diff(qy, prepend=0)   # delta-encode
                verts.append(np.column_stack([dx, dy]).ravel())
                vert_off.append(vert_off[-1] + len(qx))
            ring_off.append(len(vert_off) - 1)
        poly_off.append(len(ring_off) - 1)
    clng, clat = sp_to_lnglat(cxs, cys)
    verts = np.concatenate(verts).astype(np.int32) if verts else np.zeros(0, np.int32)

    # ── attributes ──
    f = lambda k, d=np.nan: np.array([d if v is None else v for v in cols[k]], dtype=np.float64)
    zones = sorted({z or "" for z in cols["ZoneDist1"]})
    ntas = sorted({(c, nm) for c, nm in zip(cols["nta2020"], cols["ntaname"]) if c})
    tracts = sorted({c for c in cols["BCT2020"] if c})
    areas = ([{"kind": "nta", "code": c, "name": nm} for c, nm in ntas] +
             [{"kind": "tract", "code": c, "name": f"Tract {c[1:]}" if len(c) > 1 else c} for c in tracts])
    a_index = {(a["kind"], a["code"]): i for i, a in enumerate(areas)}

    sec = {
        "cx": np.round((clng - ox) * Q).astype(np.int32),
        "cy": np.round((clat - oy) * Q).astype(np.int32),
        "area": np.clip(np.nan_to_num(f("LotArea"), nan=0), 0, 2**32 - 1).astype(np.uint32),
        "units": np.clip(np.nan_to_num(f("UnitsRes"), nan=0), 0, 65535).astype(np.uint16),
        "bfar": f("BuiltFAR").astype(np.float32),
        "mfar": f("MaxFARUse").astype(np.float32),
        "fdiff": f("FARDiff").astype(np.float32),
        "year": np.clip(np.nan_to_num(f("YearBuilt"), nan=0), 0, 65535).astype(np.uint16),
        "lu": np.array([code_of(LAND_USE, v or "Other/unknown", 11) for v in cols["LandUseTxt"]], np.uint8),
        "ub": np.array([code_of(UNIT_BUCKETS, v, 255) for v in cols["UnitBetter"]], np.uint8),
        "fc": np.array([code_of(FAR_CATS, v, 255) for v in cols["FARMapCat"]], np.uint8),
        "zone": np.array([zones.index(z or "") for z in cols["ZoneDist1"]], np.uint16),
        "nta": np.array([a_index.get(("nta", c), 65535) for c in cols["nta2020"]], np.uint16),
        "tract": np.array([a_index.get(("tract", c), 65535) for c in cols["BCT2020"]], np.uint16),
        "bbl": f("BBL", 0).astype(np.float64),
        "polyOff": np.array(poly_off, np.uint32),
        "ringOff": np.array(ring_off, np.uint32),
        "vertOff": np.array(vert_off, np.uint32),
        "verts": verts,
    }

    # ── area outlines: rasterise lots, split streets between neighbours, trace ──
    x0, y0 = allpts[:, 0].min() - 400, allpts[:, 1].min() - 400
    x1, y1 = allpts[:, 0].max() + 400, allpts[:, 1].max() + 400
    W, H = int((x1 - x0) / CELL) + 1, int((y1 - y0) / CELL) + 1
    lotimg = np.zeros((H, W), np.int32)
    for i, polys in enumerate(polys_per_lot):
        rings = [np.round(np.column_stack([(r[:, 0] - x0) / CELL, (y1 - r[:, 1]) / CELL])).astype(np.int32)
                 for poly in polys for r in poly]
        if rings: cv2.fillPoly(lotimg, rings, i + 1)
    occupied = lotimg > 0
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))           # ~170 ft: bridges streets
    footprint = cv2.morphologyEx(occupied.astype(np.uint8), cv2.MORPH_CLOSE, k).astype(bool)
    footprint = ndimage.binary_fill_holes(footprint)
    _, (iy, ix) = ndimage.distance_transform_edt(~occupied, return_indices=True)
    nearest_lot = lotimg[iy, ix] - 1                                       # street cells -> nearest lot
    for kind, key, share in (("nta", "nta", 0.05), ("tract", "tract", 0.10)):
        lab = np.where(footprint, sec[key][nearest_lot].astype(np.int32) + 1, 0)
        lab[lab == 65536] = 0
        traced = trace_outlines(lab, len(areas), x0, y1, share)
        for li, (polys, anchor) in traced.items():
            a = areas[li - 1]
            if a["kind"] == kind:
                a["polys"], a["label"] = polys, anchor
    areas_out = [a for a in areas if "polys" in a]
    remap = {areas.index(a): j for j, a in enumerate(areas_out)}
    for key in ("nta", "tract"):
        sec[key] = np.array([remap.get(int(v), 65535) for v in sec[key]], np.uint16)

    # ── tax blocks + ZoLa-style lot record ──
    bbl_int = [int(b or 0) for b in cols["BBL"]]
    blocks = trace_blocks(polys_per_lot, bbl_int)
    bindex = {b["key"]: j for j, b in enumerate(blocks)}
    sec["blk"] = np.array([bindex.get(b // 10000, 65535) for b in bbl_int], np.uint16)
    def clean(v):
        if isinstance(v, float) and v.is_integer(): return int(v)
        return v
    rec = {f: [clean(v) for v in cols[f]] for f in REC_FIELDS if f in cols}
    sec["rec"] = np.frombuffer(json.dumps(rec, separators=(",", ":")).encode(), np.uint8)

    # ── pack: [LPK2][u32 header len][header json][pad8][sections...] -> gzip ──
    header = {
        "release": release, "released": args.released, "built": time.strftime("%Y-%m-%d"),
        "n": n, "origin": [ox, oy], "q": Q,
        "dict": {"lu": LAND_USE, "ub": UNIT_BUCKETS, "fc": FAR_CATS, "zone": zones},
        "areas": areas_out, "blocks": blocks,
        "addr": [a or "" for a in cols["Address"]],
        "sections": {},
    }
    body, offset = [], 0
    for name, arr in sec.items():
        pad = (-offset) % 8
        if pad: body.append(b"\0" * pad); offset += pad
        header["sections"][name] = [arr.dtype.str.lstrip("<|"), offset, int(arr.size)]
        b = arr.astype(arr.dtype.newbyteorder("<")).tobytes(); body.append(b); offset += len(b)
    hj = json.dumps(header, separators=(",", ":")).encode()
    head = b"LPK2" + struct.pack("<I", len(hj)) + hj
    head += b"\0" * ((-len(head)) % 8)
    raw = head + b"".join(body)
    os.makedirs(args.out, exist_ok=True)
    fn = f"{release}.lpk"
    with open(os.path.join(args.out, fn), "wb") as fh:
        fh.write(gzip.compress(raw, 9))
    size = os.path.getsize(os.path.join(args.out, fn))

    # ── releases manifest (history bar) ──
    man_path = os.path.join(args.out, "releases.json")
    man = json.load(open(man_path)) if os.path.exists(man_path) else []
    man = [m for m in man if m["id"] != release]
    man.append({"id": release, "label": f"PLUTO {release}", "released": args.released,
                "built": header["built"], "file": fn, "lots": n, "bytes": size,
                "ntas": [a["name"] for a in areas_out if a["kind"] == "nta"]})
    def order(m):  # 25v4 < 25v4.1 < 26v1
        yy, rest = m["id"].split("v"); return (int(yy), float(rest))
    man.sort(key=order)
    json.dump(man, open(man_path, "w"), indent=1)

    print(f"release {release}: {n:,} lots, {len(blocks)} blocks, {len(areas_out)} areas "
          f"({sum(a['kind']=='nta' for a in areas_out)} NTAs) -> {fn} {size/1e6:.2f} MB "
          f"(raw {len(raw)/1e6:.2f} MB) in {time.time()-t0:.1f}s")

if __name__ == "__main__":
    main()
