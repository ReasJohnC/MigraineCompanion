#!/usr/bin/env python3
"""Static dev server that disables caching, so edits are picked up on reload."""
import functools
import http.server
import pathlib
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173

# The site root is this file's directory, not the cwd: launched from anywhere else,
# serving the cwd would expose that directory instead of the site.
ROOT = pathlib.Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), functools.partial(Handler, directory=str(ROOT))) as httpd:
    print(f"serving {ROOT} on {PORT} (no-cache)")
    httpd.serve_forever()
