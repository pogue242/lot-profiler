#!/usr/bin/env python3
"""factfinder.py — download DCP Population FactFinder ACS and 2020 Census profiles for every NTA, census tract, community district, CDTA and borough into work/pff, compared with NYC"""
import argparse, gzip, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
HOST = "https://factfinder-api.herokuapp.com"
KEEP = {"acs": ["sum", "marginOfError", "correlationCoefficient", "percent", "percentMarginOfError", "isReliable", "comparisonSum", "comparisonPercent",
                "previousSum", "previousPercent", "previousIsReliable", "changeSum", "changePercent", "changePercentagePoint", "changeIsReliable", "changePercentagePointIsReliable"],
        "decennial": ["sum", "percent", "comparisonSum", "comparisonPercent", "previousSum", "previousComparisonSum", "previousPercent", "changeSum", "changePercent", "changePercentagePoint"]}

def areas(release):
    d = json.loads(gzip.decompress(open(os.path.join(ROOT, "data", release, "areas.json.gz"), "rb").read()))
    out = [("ntas", c) for c in sorted(d["nta"])] + [("tracts", c) for c in sorted(d["tract"])]
    mp = os.path.join(ROOT, "data", release, "more_areas.json.gz")
    if os.path.exists(mp):
        G = {"cd": "districts", "cdta": "cdtas", "boro": "boroughs"}
        out += [(G[e["kind"]], e["code"]) for e in json.loads(gzip.decompress(open(mp, "rb").read()))["entries"]]
    return out

def fetch(survey, geotype, geoid, out):
    path = os.path.join(out, survey, geotype, f"{geoid}.json.gz")
    if os.path.exists(path): return "cached"
    url = f"{HOST}/survey/{survey}/{geotype}/{geoid}?compareTo=0"
    for k in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LotProfiler-build/1.9.2", "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read(); raw = gzip.decompress(raw) if r.headers.get("Content-Encoding") == "gzip" else raw
            rows = json.loads(raw)
            slim = {x["variable"]: [x.get("category"), x.get("base")] + [x.get(f) for f in KEEP[survey]] for x in rows}
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as fh: fh.write(gzip.compress(json.dumps({"fields": ["category", "base"] + KEEP[survey], "v": slim}, separators=(",", ":")).encode(), 9))
            return "ok"
        except urllib.error.HTTPError as e:
            if e.code == 500: return f"error 500"
            time.sleep(5 * (k + 1))
        except Exception:
            time.sleep(5 * (k + 1))
    return "failed"

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", default="26v2"); ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--out", default=os.path.join(ROOT, "work", "pff"))
    a = ap.parse_args()
    jobs = [(s, g, c) for g, c in areas(a.release) for s in ("acs", "decennial")]
    t = time.time(); stats = {}; bad = []
    with ThreadPoolExecutor(a.workers) as ex:
        for n, ((s, g, c), r) in enumerate(zip(jobs, ex.map(lambda j: fetch(*j, a.out), jobs)), 1):
            stats[r] = stats.get(r, 0) + 1
            if r not in ("ok", "cached"): bad.append(f"{s}/{g}/{c}: {r}")
            if n % 200 == 0: print(f"  {n:,}/{len(jobs):,} {stats} {time.time()-t:.0f}s", flush=True)
    print(f"done {stats} in {time.time()-t:.0f}s")
    if bad: open(os.path.join(a.out, "missing.txt"), "w").write("\n".join(bad) + "\n"); print(f"  {len(bad)} not available, listed in missing.txt")

if __name__ == "__main__":
    main()
