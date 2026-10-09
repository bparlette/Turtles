#!/bin/bash
# Deploy game/ to surge. Needs SURGE_LOGIN and SURGE_TOKEN in the environment.
# Usage: SURGE_LOGIN=you@example.com SURGE_TOKEN=xxxx scripts/deploy_surge.sh [domain]
set -e
R="$(cd "$(dirname "$0")/.." && pwd)"; DOMAIN="${1:-shellshock-live.surge.sh}"
: "${SURGE_TOKEN:?set SURGE_TOKEN}"; : "${SURGE_LOGIN:?set SURGE_LOGIN}"
python3 "$R/tools/engine/build_assets.py" "$R/game" | tail -2
bash "$R/scripts/check.sh" | tail -1 | grep -q "CHECK OK" || { echo "CHECK FAILED"; exit 1; }
grep -q '#fsbtn { display: none !important; }' "$R/game/index.html" || { echo "fsbtn hide line missing"; exit 1; }
ST=$(mktemp -d); cp -a "$R/game/." "$ST/"; find "$ST" -name '*.bak' -delete
(cd "$ST" && npx -y surge@0.24.6 . "$DOMAIN")
for f in index.html sw.js assets.json; do
  L=$(curl -s "https://$DOMAIN/$f?nc=$RANDOM" | md5sum | cut -c1-8); M=$(md5sum "$ST/$f" | cut -c1-8)
  echo "$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
done
