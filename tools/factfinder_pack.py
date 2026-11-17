#!/usr/bin/env python3
"""factfinder_pack.py — pack the downloaded Population FactFinder profiles (work/pff) into data/factfinder.json.gz for the NTA, tract, community district, CDTA and borough profiles"""
import argparse, gzip, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
BANDS = ["0t5", "5t9", "10t14", "15t19", "20t24", "25t29", "30t34", "35t39", "40t44", "45t49", "50t54", "55t59", "60t64", "65t69", "70t74", "75t79", "80t84", "85pl"]
RACE = ["hsp1", "wnh", "bnh", "anh", "onh", "twoplnh"]
DEC = ["pop1", "mdage", "ochu_1", "avghhsz", "hunits", "vachus"]
AGE = ["ageu5", "age5t9", "age10t14", "age15t17", "age18t19", "age20", "age21", "age22t24", "age25t29", "age30t34", "age35t39", "age40t44", "age45t49",
       "age50t54", "age55t59", "age60t61", "age62t64", "age65t66", "age67t69", "age70t74", "age75t79", "age80t84", "age85pl"]
DSUM = ["pop1", "ochu_1", "hunits", "vachus", "popinhh_1"]
INC = ["mdhhiu10", "mdhhi10t14", "mdhhi15t19", "mdhhi20t24", "mdhhi25t29", "mdhhi30t34", "mdhhi35t39", "mdhhi40t44", "mdhhi45t49", "mdhhi50t59", "mdhhi60t74",
       "mdhhi75t99", "mdhi100t124", "mdhi125t149", "mdhi150t199", "mdhhi200pl"]
RENT = ["ru100", "r100t149", "r150t199", "r200t249", "r250t299", "r300t349", "r350t399", "r400t449", "r450t499", "r500t549", "r550t599", "r600t649", "r650t699",
        "r700t749", "r750t799", "r800t899", "r900t999", "r1kt1249", "r1250t1p5", "r1p5t1999", "r2kt2499", "r2p5t2999", "r3kt3499", "r3500pl"]
ASUM = ["pbwpv", "poppvu1", "rochu1", "ochu2", "grpi30pl", "grpi50pl", "ochuprnt2", "fb1", "pop_4", "ea_bchdh", "ea_p25pl", "cvlfuem2", "cvlf2",
        "novhclav", "ochu4", "cw_pbtrns", "wrkr16pl"] + INC + RENT
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
    cnt = [v[k]["sum"] or 0 for k in DSUM] + [v["pop1"]["previousSum"]] + [v[f"{s}pop{b}"]["sum"] or 0 for s in "mf" for b in BANDS] + [v[k]["sum"] or 0 for k in RACE] + [v[k]["sum"] or 0 for k in AGE]
    return {"b": base, "pyr": pyr, "race": race, "c": cnt}, {"b": cbase, "pyr": cpyr, "race": crace}

def pack_acs(v):
    out, nyc = [], []
    for k, kind in ACS:
        x = v.get(k) or {}
        if kind == "p":
            out.append([r(x.get("percent"), 4), r(x.get("percentMarginOfError"), 4), int(bool(x.get("isReliable")))]); nyc.append(r(x.get("comparisonPercent"), 4))
        else:
            out.append([r(x.get("sum"), 0), r(x.get("marginOfError"), 0), int(bool(x.get("isReliable")))]); nyc.append(r(x.get("comparisonSum"), 0))
    cnt = []
    for k in ASUM:
        x = v.get(k) or {}; cnt += [round(x.get("sum") or 0), round(x.get("marginOfError") or 0)]
    return out, nyc, cnt

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default=os.path.join(ROOT, "work", "pff")); ap.add_argument("--out", default=os.path.join(ROOT, "data", "factfinder.json.gz"))
    a = ap.parse_args()
    A, nyc, bad = {}, {}, []
    for geo, kind in (("ntas", "nta"), ("tracts", "tract"), ("districts", "cd"), ("cdtas", "cdta"), ("boroughs", "boro")):
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
                    elif any((v.get(k) or {}).get("sum") is not None for k, _ in ACS): e["a"], c, e["ac"] = pack_acs(v); nyc.setdefault("a", c)
                except Exception as ex:
                    bad.append(f"{survey}/{geo}/{fn}: {ex}")
            if e: A[f"{kind}:{code}"] = e
    meta = {"acs": "2020-2024 American Community Survey 5-year estimates", "dec": "2020 Census", "prev": "2010 Census", "compare": "New York City",
            "source": "NYC Department of City Planning, Population FactFinder", "acsVars": [k for k, _ in ACS], "bands": BANDS, "race": RACE, "decVars": DEC,
            "dc": DSUM + ["pop2010"] + [f"{s}pop{b}" for s in "mf" for b in BANDS] + RACE + AGE, "ac": ASUM}
    with open(a.out, "wb") as fh: fh.write(gzip.compress(json.dumps({"meta": meta, "nyc": nyc, "a": A}, separators=(",", ":")).encode(), 9))
    print(f"{a.out}: {len(A):,} areas, {os.path.getsize(a.out)/1e6:.2f} MB")
    for b in bad: print("  unreadable:", b)

if __name__ == "__main__":
    main()
