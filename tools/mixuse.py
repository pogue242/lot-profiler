#!/usr/bin/env python3
"""mixuse.py — write data/<release>/mix.lpk, each lot's residential share of its residential plus commercial floor area."""
import argparse, json, os, sys, time, zlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lp_build as L

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--release", required=True); ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    a = ap.parse_args()
    t0 = time.time(); out = os.path.join(a.data, a.release)
    core = L.read_pack(os.path.join(out, "core.lpk")); H = core["H"]; n = H["n"]
    offs = core["rOff"].astype(np.int64); raw = open(os.path.join(out, H["files"]["rec"]), "rb").read()
    res = np.full(n, np.nan); com = np.full(n, np.nan); k = 0
    for c in range(len(offs) - 1):
        d = json.loads(zlib.decompress(raw[offs[c]:offs[c + 1]], -15))
        m = len(d["ResArea"])
        res[k:k + m] = [np.nan if v is None else v for v in d["ResArea"]]
        com[k:k + m] = [np.nan if v is None else v for v in d["ComArea"]]
        k += m
    if k != n: sys.exit(f"NOTICE: {k} lots in rec.bin, {n} in the release")
    r, c = np.nan_to_num(res), np.nan_to_num(com); tot = r + c
    rs = np.full(n, 255, np.uint8)
    has = tot > 0
    rs[has] = np.clip(np.round(r[has] / tot[has] * 100), 0, 100).astype(np.uint8)
    rs[has & (r > 0) & (c > 0) & (rs == 100)] = 99
    rs[has & (r > 0) & (c > 0) & (rs == 0)] = 1
    hdr = {"release": a.release, "built": time.strftime("%Y-%m-%d"), "n": n,
           "about": "residential share of ResArea + ComArea, 0-100; 255 = neither recorded"}
    L.write_pack(os.path.join(out, "mix.lpk"), b"LPM1", hdr, {"rs": rs})
    man_path = os.path.join(a.data, "releases.json"); man = json.load(open(man_path, encoding="utf-8"))
    entry = next(m for m in man if m["id"] == a.release)
    entry["mix"] = {"file": "mix.lpk", "built": hdr["built"]}; entry["bytes"] = L.folder_bytes(out)
    json.dump(man, open(man_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    mixed = (rs > 0) & (rs < 100)
    print(f"{a.release}: mix.lpk {os.path.getsize(os.path.join(out, 'mix.lpk')):,} bytes; {int((rs == 100).sum()):,} residential only, "
          f"{int(mixed.sum()):,} mixed, {int((rs == 0).sum()):,} commercial only, {int((rs == 255).sum()):,} neither; {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    main()
