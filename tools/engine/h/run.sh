#!/bin/bash
# run.sh <site dir> <level> <maxFrames> <log>: node headless autoplay (existing lvl15 harness logic) on the engine extracted from <site>/index.html
cd /workspace/work/ss_engine/h
G=/workspace/work/ss_engine/h/game_$(basename $1)_$$.js
python3 -c "
import re;s=open('$1/index.html').read();big=max(re.findall(r'<script>(.*?)</script>',s,re.S),key=len);open('$G','w').write(big)"
Q="?level=$2&nocache"; [ "$2" = 1 ] && Q="?nocache"
GAME=$G SITE=$1 SEED=${SEED:-7} STOPAT="${STOPAT:-results lvl=$2}" timeout 1500 node play.js "$Q" $3 > $4 2>&1; echo "EXIT $?" >> $4; rm -f $G
