#!/bin/bash
# Serve the game locally at http://localhost:${PORT:-8000}
cd "$(dirname "$0")/../game" && python3 -m http.server "${PORT:-8000}"
