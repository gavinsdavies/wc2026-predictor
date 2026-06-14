#!/usr/bin/env bash
# Serve the predictor locally. Must be HTTP (not file://) so ES-module
# imports and fetch() of data/*.json work.
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
echo "Serving WC2026 predictor at http://localhost:${PORT}  (Ctrl-C to stop)"
exec python3 -m http.server "$PORT"
