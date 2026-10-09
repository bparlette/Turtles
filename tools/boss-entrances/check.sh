#!/bin/bash
# node --check every inline script of both index.html copies + every level script
set -e
for f in /workspace/work/deploy/shell-shock-live-action/index.html /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html; do
python3 - "$f" <<'PY'
import re,sys,subprocess
s=open(sys.argv[1]).read()
for i,sc in enumerate(re.findall(r'<script>(.*?)</script>',s,re.S)):
    p='/tmp/chk_%d.js'%i; open(p,'w').write(sc)
    r=subprocess.run(['node','--check',p],capture_output=True,text=True)
    if r.returncode: print('FAIL',sys.argv[1],i,r.stderr[:800]); sys.exit(1)
print('OK', sys.argv[1])
PY
done
for f in /workspace/work/deploy/shell-shock-live-action/levels/*.js /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels/*.js; do node --check "$f" || { echo FAIL $f; exit 1; }; done
echo LEVELS_OK
