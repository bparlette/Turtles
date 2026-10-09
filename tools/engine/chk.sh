#!/bin/bash
# node --check every inline script of an index.html + every levels/*.js
f=$1; d=$(dirname $f); ok=1
python3 -c "
import re,sys;s=open('$f').read()
for i,b in enumerate(re.findall(r'<script>(.*?)</script>',s,re.S)): open('/tmp/chk_%d.js'%i,'w').write(b)
print(len(re.findall(r'<script>(.*?)</script>',s,re.S)))" > /tmp/chk_n
for i in $(seq 0 $(( $(cat /tmp/chk_n) - 1 ))); do node --check /tmp/chk_$i.js || ok=0; done
for j in $d/levels/*.js $d/*.js; do [ -f "$j" ] && { node --check $j || { ok=0; echo "FAIL $j"; }; }; done
[ $ok = 1 ] && echo "CHECK OK $f" || echo "CHECK FAIL $f"
