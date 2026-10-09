#!/bin/bash
# runall2.sh TAG case... : like runall.sh; env TOUCH/SKIP/OUT pass through; logs log_TAG_case.txt, results -> runs2.log
cd /workspace/work/boss_ent; source /workspace/work/freeze_test/env.sh
T=$1; shift
for c in "$@"; do timeout ${TO:-240} node ent.js $c ${OUT:-shots_$T} > log_${T}_$c.txt 2>&1; echo "$(date +%T) $T $c $(grep -h 'RESULT' log_${T}_$c.txt | cut -c1-330) PE=$(grep -c PAGEERROR log_${T}_$c.txt)" >> runs2.log; done
echo "DONE $T $*" >> runs2.log
