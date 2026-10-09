#!/bin/bash
# rebuild the test copy: pristine index (pre-engine backup) + all patch groups
cd /workspace/work/ss_engine
cp bak/deploy_pre_engine/index.html site/index.html
python3 patch.py site/index.html "$@" && ./chk.sh site/index.html
