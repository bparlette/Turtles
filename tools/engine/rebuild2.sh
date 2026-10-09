#!/bin/bash
# rebuild test copy site2 from the CURRENT deploy dir (carries entr v1 + fsbtn line) + all patch groups + assets.json/sw.js
cd /workspace/work/ss_engine
rm -rf site2 && cp -a /workspace/work/deploy/shell-shock-live-action site2 && mkdir -p site2/rec && cp -a rec/*.json site2/rec/ 2>/dev/null
python3 patch.py site2/index.html "$@" && python3 build_assets.py site2 && ./chk.sh site2/index.html | tail -1
