for f in "$@"; do python3 -c "
import re,sys;s=open('$f').read();big=max(re.findall(r'<script>(.*?)</script>',s,re.S),key=len);open('/tmp/chk.js','w').write(big)"; node --check /tmp/chk.js && echo "OK $f" || echo "FAIL $f"; done
