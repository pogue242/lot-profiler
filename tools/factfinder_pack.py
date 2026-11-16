#!/usr/bin/env python3
"""factfinder_pack.py — pack the downloaded Population FactFinder profiles (work/pff) into data/factfinder.json.gz for the NTA and tract profiles"""
import argparse, gzip, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
BANDS = ["0t5", "5t9", "10t14", "15t19", "20t24", "25t29", "30t34", "35t39", "40t44", "45t49", "50t54", "55t59", "60t64", "65t69", "70t74", "75t79", "80t84", "85pl"]
RACE = ["hsp1", "wnh", "bnh", "anh", "onh", "twoplnh"]
DEC = ["pop1", "mdage", "ochu_1", "avghhsz", "hunits", "vachus"]
ACS = [("mdhhinc", "v"), ("pbwpv", "p"), ("rochu1", "p"), ("mdgr", "v"), ("grpi30pl", "p"), ("grpi50pl", "p"), ("fb1", "p"),
       ("ea_bchdh", "p"), ("cvlfuem2", "p"), ("novhclav", "p"), ("cw_pbtrns", "p")]

def load(path):
    d = json.loads(gzip.decompress(open(path, "rb").read())); F = d["fields"]
    return {k: dict(zip(F, v)) for k, v in d["v"].items()}

def r(x, n): return None if x is None else round(float(x), n)

def pack_dec(v):
    pop = v["pop5"]["sum"] or 0; cp = v["pop5"]["comparisonSum"] or 0
    pyr = [[r((v[f"{s}pop{b}"]["sum"] or 0) / pop, 4) if pop else None for b in BANDS] for s in "mf"]
    cpyr = [[r((v[f"{s}pop{b}"]["comparisonSum"] or 0) / cp, 4) if cp else None for b in BANDS] for s in "mf"]
    race = [r(v[k]["percent"], 4) for k in RACE]; crace = [r(v[k]["comparisonPercent"], 4) for k in RACE]
    base = [v[k]["sum"] for k in DEC] + [v["pop1"]["previousSum"]]
    cbase = [v[k]["comparisonSum"] for k in DEC] + [v["pop1"].get("previousComparisonSum") or 8175133]
    return {"b": base, "pyr": pyr, "race": race}, {"b": cbase, "pyr": cpyr, "race": crace}

def pack_acs(v):
    out, nyc = [], []
    for k, kind in ACS:
        x = v.get(k) or {}
        if kind == "p":
            out.append([r(x.get("percent"), 4), r(x.get("percentMarginOfError"), 4), int(bool(x.get("isReliable")))]); nyc.append(r(x.get("comparisonPercent"), 4))
        else:
            out.append([r(x.get("sum"), 0), r(x.get("marginOfError"), 0), int(bool(x.get("isReliable")))]); nyc.append(r(x.get("comparisonSum"), 0))
    return out, nyc

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default=os.path.join(ROOT, "work", "pff")); ap.add_argument("--out", default=os.path.join(ROOT, "data", "factfinder.json.gz"))
    a = ap.parse_args()
    A, nyc, bad = {}, {}, []
    for geo, kind in (("ntas", "nta"), ("tracts", "tract")):
        ls = lambda s: set(os.listdir(os.path.join(a.src, s, geo))) if os.path.isdir(os.path.join(a.src, s, geo)) else set()
        names = sorted(ls("decennial") | ls("acs"))
        for fn in names:
            code = fn.split(".")[0]; e = {}
            for survey in ("decennial", "acs"):
                p = os.path.join(a.src, survey, geo, fn)
                if not os.path.exists(p): continue
                try:
                    v = load(p)
                    if survey == "decennial": e["d"], c = pack_dec(v); nyc.setdefault("d", c)
                    else: e["a"], c = pack_acs(v); nyc.setdefault("a", c)
                except Exception as ex:
                    bad.append(f"{survey}/{geo}/{fn}: {ex}")
            if e: A[f"{kind}:{code}"] = e
    meta = {"acs": "2020-2024 American Community Survey 5-year estimates", "dec": "2020 Census", "prev": "2010 Census", "compare": "New York City",
            "source": "NYC Department of City Planning, Population FactFinder", "acsVars": [k for k, _ in ACS], "bands": BANDS, "race": RACE, "decVars": DEC}
    with open(a.out, "wb") as fh: fh.write(gzip.compress(json.dumps({"meta": meta, "nyc": nyc, "a": A}, separators=(",", ":")).encode(), 9))
    print(f"{a.out}: {len(A):,} areas, {os.path.getsize(a.out)/1e6:.2f} MB")
    for b in bad: print("  unreadable:", b)

if __name__ == "__main__":
    main()
