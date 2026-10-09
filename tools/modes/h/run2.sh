#!/bin/bash
# run2.sh <site dir> <level> <maxFrames> <log> ; env MODE=arcade|speed|rush STOPAT=...
cd /workspace/work/phase2/h
G=/workspace/work/phase2/h/game_$$.js
python3 -c "
import re;s=open('$1/index.html').read();big=max(re.findall(r'<script>(.*?)</script>',s,re.S),key=len);open('$G','w').write(big)"
Q="?level=$2&nocache"; [ "$2" = 1 ] && Q="?nocache"
GAME=$G SITE=$1 SEED=${SEED:-7} STOPAT="${STOPAT:-results lvl=$2}" timeout ${TO:-1500} node play2.js "$Q" $3 > $4 2>&1; echo "EXIT $?" >> $4; rm -f $G
