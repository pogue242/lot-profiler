#!/usr/bin/env python3
"""
transit.py — download NYC subway data for the Lot Profiler into data/transit.json.
No API keys are needed; all four sources are open.

    python tools/transit.py            # all of New York City (default)
    python tools/transit.py --study    # only around the newest release's lots

Sources
  Stations       MTA Subway Stations (data.ny.gov, 39hk-dx4f)
  Entrances      MTA Subway Entrances and Exits: 2024 (data.ny.gov, i9wp-a4ja)
  Route lines    OpenStreetMap route=subway relations (Overpass API)
  Platforms      OpenStreetMap railway=platform footprints (Overpass API)

The file keeps the source rows lightly trimmed; the app does the joining, so the
same code handles this file and the app's live-download fallback. Rerun any time
the MTA updates its data. Offline? Pass files you downloaded yourself with
--stations stations.csv --entrances entrances.csv --osm overpass.json
"""
import argparse, csv, gzip, io, json, os, re, struct, sys, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATIONS = "https://data.ny.gov/api/views/39hk-dx4f/rows.csv?accessType=DOWNLOAD"
ENTRANCES = "https://data.ny.gov/api/views/i9wp-a4ja/rows.csv?accessType=DOWNLOAD"
OVERPASS = "https://overpass-api.de/api/interpreter"
NYC = [-74.26, 40.49, -73.70, 40.92]
UA = {"User-Agent": "LotProfiler/2 (transit.py)"}

def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()

def norm(row):
    return {re.sub(r"[^a-z0-9]", "", k.lower()): v for k, v in row.items()}

def latlon(r, lat_keys, lon_keys):
    for a, b in zip(lat_keys, lon_keys):
        try: return float(r[a]), float(r[b])
        except (KeyError, TypeError, ValueError): pass
    return None, None

def study_bbox(pad):
    man = json.load(open(os.path.join(ROOT, "data", "releases.json")))
    raw = gzip.decompress(open(os.path.join(ROOT, "data", man[-1]["file"]), "rb").read())
    hl = struct.unpack("<I", raw[4:8])[0]
    h = json.loads(raw[8:8 + hl])
    xs = [p[0] for a in h["areas"] for poly in a["polys"] for p in poly[0]]
    ys = [p[1] for a in h["areas"] for poly in a["polys"] for p in poly[0]]
    return [min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--study", action="store_true", help="only the area around the newest release instead of all of NYC")
    ap.add_argument("--pad", type=float, default=0.03, help="degrees added around the study area (0.03 ≈ 1.5 mi)")
    ap.add_argument("--stations"); ap.add_argument("--entrances"); ap.add_argument("--osm")
    a = ap.parse_args()
    w, s, e, n = study_bbox(a.pad) if a.study else NYC
    inside = lambda la, lo: la is not None and s <= la <= n and w <= lo <= e

    print("stations…")
    txt = open(a.stations, encoding="utf-8-sig").read() if a.stations else get(STATIONS).decode("utf-8-sig")
    st = [norm(r) for r in csv.DictReader(io.StringIO(txt))]
    keep_st = []
    for r in st:
        la, lo = latlon(r, ["gtfslatitude", "latitude"], ["gtfslongitude", "longitude"])
        if inside(la, lo): keep_st.append(r)
    ids = {r.get("complexid") for r in keep_st}

    print("entrances…")
    txt = open(a.entrances, encoding="utf-8-sig").read() if a.entrances else get(ENTRANCES).decode("utf-8-sig")
    en = [norm(r) for r in csv.DictReader(io.StringIO(txt))]
    keep_en = [r for r in en if r.get("complexid") in ids]
    for r in keep_en + keep_st: r.pop("entrancegeoreference", None); r.pop("georeference", None)

    print("OpenStreetMap lines + platforms…")
    q = (f"[out:json][timeout:120];relation[\"route\"=\"subway\"]({s},{w},{n},{e});out geom;"
         f"(way[\"railway\"=\"platform\"]({s},{w},{n},{e});"
         f"relation[\"railway\"=\"platform\"]({s},{w},{n},{e}););out geom;")
    osm = json.load(open(a.osm)) if a.osm else json.loads(get(OVERPASS, urllib.parse.urlencode({"data": q}).encode()))

    out = {"built": time.strftime("%Y-%m-%d"), "bbox": [w, s, e, n],
           "stations": keep_st, "entrances": keep_en, "osm": osm,
           "sources": ["MTA Subway Stations, data.ny.gov", "MTA Subway Entrances and Exits: 2024, data.ny.gov",
                       "© OpenStreetMap contributors (ODbL)"]}
    path = os.path.join(ROOT, "data", "transit.json")
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print(f"{len(ids)} station complexes, {len(keep_en)} entrances, "
          f"{sum(1 for x in osm.get('elements', []) if x.get('tags', {}).get('route') == 'subway')} route relations, "
          f"{sum(1 for x in osm.get('elements', []) if x.get('tags', {}).get('railway') == 'platform')} platforms "
          f"-> data/transit.json ({os.path.getsize(path)/1e6:.1f} MB)")

if __name__ == "__main__":
    try: main()
    except urllib.error.URLError as err:
        sys.exit(f"Download failed ({err}). Check your connection, or pass files with --stations/--entrances/--osm.")
