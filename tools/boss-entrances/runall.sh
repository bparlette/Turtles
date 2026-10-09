#!/bin/bash
# runall.sh case... : serial harness runs in the background; results appended to runs.log
cd /workspace/work/boss_ent; source /workspace/work/freeze_test/env.sh
for c in "$@"; do timeout ${TO:-170} node ent.js $c > log_$c.txt 2>&1; echo "$(date +%T) $c $(grep -h 'RESULT' log_$c.txt | cut -c1-420) PE=$(grep -c PAGEERROR log_$c.txt)" >> runs.log; done
echo "DONE $*" >> runs.log
