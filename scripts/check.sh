#!/bin/bash
# node --check every inline script in game/index.html and every game/levels/*.js
R="$(cd "$(dirname "$0")/.." && pwd)"
bash "$R/tools/engine/chk.sh" "$R/game/index.html"
