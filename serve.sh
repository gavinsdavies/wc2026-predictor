#!/usr/bin/env bash
# Serve the predictor locally. Must be HTTP (not file://) so ES-module
# imports and fetch() of data/*.json work.
#
# Uses a custom handler that stays quiet on successful requests and only
# logs failures (4xx/5xx), so a broken path still surfaces but routine
# GETs don't flood the terminal. Set SERVE_VERBOSE=1 for the full access log.
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
echo "Serving WC2026 predictor at http://localhost:${PORT}  (Ctrl-C to stop)"

exec python3 - "$PORT" <<'PY'
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERBOSE = bool(__import__("os").environ.get("SERVE_VERBOSE"))

class Handler(SimpleHTTPRequestHandler):
    def log_request(self, code="-", size="-"):
        status = code.value if hasattr(code, "value") else int(code)
        if VERBOSE or status >= 400:
            super().log_request(code, size)

ThreadingHTTPServer(("", int(sys.argv[1])), Handler).serve_forever()
PY
