#!/usr/bin/env python3
"""bus.py — build data/bus_<date>.json with MTA bus stops and route lines from the official GTFS feeds."""
import argparse, collections, csv, datetime, io, json, math, os, re, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")
FEEDS = ["b", "bx", "m", "q", "si", "busco"]
URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_{}.zip"
KX, KY = 111320 * math.cos(math.radians(40.7)), 110574
CELL = 40
UPPER = {"CUNY", "JFK", "LIRR", "MTA", "NYU", "PS", "IS", "HS", "US", "VA", "FDR", "LIU", "SI", "II", "III", "IV"}

def read(z, name):
    return csv.DictReader(io.TextIOWrapper(z.open(name), "utf-8-sig"))

def pretty(s):
    def word(m):
        w = m.group(0)
        if w in UPPER or re.fullmatch(r"[A-Z]", w): return w
        if re.match(r"^\d", w): return w.lower()
        return w.capitalize()
    return re.sub(r"\s*/\s*", " / ", re.sub(r"[A-Za-z0-9']+", word, s.strip()))

def simplify(pts, tol):
    if len(pts) < 3: return pts
    keep, stack = [0, len(pts) - 1], [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay, bx, by = pts[a][0] * KX, pts[a][1] * KY, pts[b][0] * KX, pts[b][1] * KY
        dx, dy, far, at = bx - ax, by - ay, tol, None
        ll = dx * dx + dy * dy or 1
        for i in range(a + 1, b):
            px, py = pts[i][0] * KX - ax, pts[i][1] * KY - ay
            t = max(0, min(1, (px * dx + py * dy) / ll))
            d = math.hypot(px - t * dx, py - t * dy)
            if d > far: far, at = d, i
        if at is not None:
            keep.append(at); stack += [(a, at), (at, b)]
    return [pts[i] for i in sorted(keep)]

def cells(pts):
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot((x1 - x0) * KX, (y1 - y0) * KY) / (CELL / 2)))
        for i in range(n + 1):
            out.add((int((x0 + (x1 - x0) * i / n) * KX / CELL), int((y0 + (y1 - y0) * i / n) * KY / CELL)))
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cache", help="folder that holds or receives gtfs_<feed>.zip")
    ap.add_argument("--tolerance", type=float, default=6)
    a = ap.parse_args()
    stops, routes, serve, dates = {}, {}, collections.defaultdict(set), []
    use = collections.defaultdict(collections.Counter)
    geo = {}
    for f in FEEDS:
        path = os.path.join(a.cache, f"gtfs_{f}.zip") if a.cache else None
        if path and os.path.exists(path): src = path
        else:
            print(f"downloading {f} …")
            raw = urllib.request.urlopen(urllib.request.Request(URL.format(f), headers={"User-Agent": "LotProfiler (bus.py)"}), timeout=170).read()
            if path: open(path, "wb").write(raw)
            src = io.BytesIO(raw)
        z = zipfile.ZipFile(src)
        for x in read(z, "feed_info.txt"): dates.append(x["feed_version"])
        info = {x["route_id"]: x for x in read(z, "routes.txt")}
        trip = {}
        for t in read(z, "trips.txt"):
            trip[t["trip_id"]] = t["route_id"]
            use[(t["route_id"], t.get("direction_id", ""))][t["shape_id"]] += 1
        for r in {v for v in trip.values()}:
            x = info[r]; routes[r] = dict(id=r, n=x["route_short_name"] or r, name=x["route_long_name"].strip(), via=x.get("route_desc", "").strip(), c="#" + (x.get("route_color") or "6E7B88"), t="#" + (x.get("route_text_color") or "FFFFFF"))
        for s in read(z, "stops.txt"):
            if s.get("location_type", "0") in ("", "0"):
                stops.setdefault(s["stop_id"], (round(float(s["stop_lon"]), 5), round(float(s["stop_lat"]), 5), pretty(s["stop_name"])))
        for x in read(z, "stop_times.txt"):
            r = trip.get(x["trip_id"])
            if r: serve[x["stop_id"]].add(r)
        pts = collections.defaultdict(list)
        for x in read(z, "shapes.txt"):
            pts[x["shape_id"]].append((int(x["shape_pt_sequence"]), float(x["shape_pt_lon"]), float(x["shape_pt_lat"])))
        for k, v in pts.items():
            geo.setdefault(k, [(p[1], p[2]) for p in sorted(v)])
        print(f"  {f}: {len(trip):,} trips, {len(pts):,} shapes")
    order = sorted(routes, key=lambda r: (re.sub(r"\d.*", "", routes[r]["n"]), int((re.search(r"\d+", routes[r]["n"]) or [0])[0]), routes[r]["n"]))
    ix = {r: i for i, r in enumerate(order)}
    lines, missing = [], 0
    for r in order:
        seen = set()
        ranked = collections.Counter()
        for (rid, _), c in use.items():
            if rid == r: ranked.update(c)
        for sid, _ in ranked.most_common():
            p = geo.get(sid)
            if not p: missing += 1; continue
            c = cells(p)
            if len(c - seen) >= max(4, 0.08 * len(c)):
                seen |= c
                lines.append({"r": ix[r], "g": [[round(x, 5), round(y, 5)] for x, y in simplify(p, a.tolerance)]})
    out_stops = [[*stops[s], sorted(ix[r] for r in serve[s])] for s in sorted(stops) if serve.get(s)]
    date = max(dates)
    date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
    out = {"feed": date, "built": datetime.date.today().isoformat(), "source": "MTA GTFS bus feeds", "routes": [routes[r] for r in order], "stops": out_stops, "lines": lines}
    name = f"bus_{date}.json"
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as fh: json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(DATA, "bus_index.json"), "w", encoding="utf-8") as fh: json.dump({"file": name, "feed": date}, fh)
    print(f"{name}: {len(out_stops):,} stops, {len(order)} routes, {len(lines)} lines, {os.path.getsize(os.path.join(DATA, name)) / 1e6:.1f} MB, {missing} missing shapes")

if __name__ == "__main__":
    main()
