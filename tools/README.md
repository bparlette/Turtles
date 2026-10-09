# tools/

These are the scripts that built and verified the game. Most were written as one-off
patchers that edit `index.html` in place. All of them have already been applied, and
they contain hard-coded `/workspace/work/...` paths from the original build sandbox.

| Folder | What it is |
|---|---|
| engine/ | Engine v2 blocks (`blocks/engine.js`, `entities.js`, `assets.js`). `build_assets.py` writes assets.json and the versioned sw.js from `tpl/sw.js`. `chk.sh` runs node --check. `t/` holds the Playwright harness (record, replay, soak, offline, perf). `h/` holds headless autoplay. |
| modes/ | Game modes and twist set pieces: `modes_block.js`, `twist_block.js`, patchers p1 to p4, and harnesses. |
| boss-entrances/ | Entrance engine `block.js`, per-level entrance patchers l2 to l15, `ent.js` and `rush.js` tests. |
| level-select/ | Menu, scene grid, and saved progress (v1, since superseded by the single-list menu). |
| gallery/ | Gallery module `core.js` and registry `reg_ss.js`. |
| art-pipeline/ | Slicing and building sprite sheets, portraits, props, and contact sheets from art-source raws. |
| genesis/ | 16-bit / Genesis conversion experiments (see docs/AI_HANDOFF.md). |

Only `engine/build_assets.py` is needed for normal work: `python3 tools/engine/build_assets.py game`.
