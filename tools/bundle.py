#!/usr/bin/env python3
"""
bundle.py — make a single self-contained HTML file (all releases inlined) for
previewing or emailing. The hosted site doesn't need this; it loads data/ directly.

    python tools/bundle.py --name prototype_2v1.html
"""
import argparse, base64, json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ap = argparse.ArgumentParser(); ap.add_argument("--name", default="prototype.html")
ap.add_argument("--title", default=None)
a = ap.parse_args()
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()
html, css, js = rd("index.html"), rd("style.css"), rd("app.js")
releases = json.load(open(os.path.join(ROOT, "data", "releases.json")))
packs = {r["id"]: base64.b64encode(open(os.path.join(ROOT, "data", r["file"]), "rb").read()).decode() for r in releases}
extra = {}
tp = os.path.join(ROOT, "data", "transit.json")
if os.path.exists(tp): extra["transit"] = json.load(open(tp))
payload = json.dumps({"releases": releases, "packs": packs, **extra}, separators=(",", ":"))
assert "</script" not in js
html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "</style>")
html = html.replace('<script src="app.js"></script>', "<script>window.__LP__=" + payload + ";</script>\n<script>\n" + js + "</script>")
if a.title: html = html.replace("<title>Lot Profiler</title>", f"<title>{a.title}</title>")
out = os.path.join(ROOT, a.name)
open(out, "w", encoding="utf-8").write(html)
print(f"{a.name}: {os.path.getsize(out)/1e6:.2f} MB, releases: {', '.join(r['id'] for r in releases)}"
      + (", subway data bundled" if extra else ", subway data loads live"))
