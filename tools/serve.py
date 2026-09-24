#!/usr/bin/env python3
"""serve.py — run the site locally:  python tools/serve.py  ->  http://localhost:8000"""
import http.server, os, socketserver, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".lpk": "application/octet-stream", ".js": "text/javascript"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache"); super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
with socketserver.TCPServer(("", port), H) as s:
    print(f"Lot Profiler at http://localhost:{port}"); s.serve_forever()
