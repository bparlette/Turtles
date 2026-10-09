# AI handoff: Shell Shock: Live Action

The current state, the rules that keep it working, and where things live.
`ENGINEERING_LOG.md` is the full working log, written in order as the work happened.

## State (2026-10-09)
- Live: https://shellshock-live.surge.sh. `game/index.html` md5 prefix `8828e867`.
  Also live: `sw.js` `ee65138c`, `assets.json` `b0ac855f`.
- Latest change: the title menu is a single list
  (Arcade → Speed Run → Boss Rush → Level Select → Gallery).
- The last full test pass was clean:
  - Arcade L1–L15 played with 0 page or frame errors.
  - A Speed Run of L1–L15 finished in 13:57.88, and best times persisted.
  - Boss Rush ran 16 entrances, ending Shredder → Super Shredder.
  - Entrance skips passed 14 of 14.
  - A 310 s soak had 0 errors and at most 11 live audio nodes.
  - An offline reload passed.

## Known risks / open items
1. A Krang (L14) freeze was seen once and never reproduced, then ran clean 17 times
   in a row. The frame loop now has a try/catch, so check `window.__frameErrors`
   if it happens again.
2. The Boss Rush back-to-back entrance queue (`STATE.entrQ`) has not been exercised directly.
3. The trailer video and the ES-DE/Electron package (RetroArch frontend launcher)
   are older than the current build.
4. Explored, not started: a 16-bit / Sega Genesis port. See "16-bit direction" below.

## Hard rules (break these and things regress)
- Keep `#fsbtn { display: none !important; }` in index.html. The user wants the
  fullscreen button hidden.
- Never let a canvas `arc`/`ellipse` radius go negative. That used to throw and
  freeze the whole loop on iPhone. A global clamp is installed, so keep it.
- `requestAnimationFrame` is scheduled first in `frame()`, and update and draw run
  inside try/catch. Don't move that.
- Audio nodes must disconnect on `ended`. The voice caps are SFX 56 and music 80.
  Text-to-speech never queues.
- Gameplay code inside a sim step may use `Math.random`, which is swapped for a
  seeded RNG during steps. Draw-only randomness uses `NRAND()`. Mixing them up
  breaks record and replay determinism.
- Run `python3 tools/engine/build_assets.py game` before every deploy.
- The patchers in `tools/*/patch*.py` are history. They have already been applied to
  `game/index.html`, are idempotent through marker comments, and use hard-coded
  `/workspace/work/...` paths. Edit `game/index.html` directly from now on.

## Architecture cheat sheet (all in game/index.html)
- Engine v2 runs a fixed 60 Hz step with an accumulator, a seeded RNG, input
  record/replay with an FNV state hash, `hitStop`, a shake step, and low-res
  lights with an automatic low-power fallback.
- Data-driven entities live in the `DATA-DRIVEN ENTITIES` section: `ENEMY_DEFS`,
  `PROP_DEFS`, `PICKUP_DEFS`, `PROJ_DEFS`. From a level you can call
  `api.defineEnemy/defineProp/definePickup/defineProjectile`. Bosses stay as code.
- Levels: `levels/levelN.js` registers sections. `section.seg` is one of
  zone1 | twist | zone2 | arena*. Speed and Rush modes filter sections through
  `modeSections()`.
- Twists: `section.twist.kind` is one of collapse | searchlight | chase | run | turret
  | ride | ice | elevator | miniboss | defend | freefall. Each twist has a 65 s
  safety cap.
- Boss entrances use `cfg.entrance` on the boss config, then `entrStart`/`entrFinish`.
  A second entrance waits in `STATE.entrQ`. Players can skip after 24 frames.
- Gallery: to list new art, add one line to `galRegistry()`.
- Saves in localStorage: `ssla_progress`, `ssla_mode`, `ssla_mode_best`,
  `ssla_shake`, `ssla_light`.
- The service worker serves index.html and level scripts network-first, and images
  cache-first.

## Testing
The test harnesses are Playwright scripts under `tools/engine/t`, `tools/modes/t`,
`tools/gallery`, and `tools/boss-entrances`. They emulate an iPhone 13 in landscape
with WebKit and touch input. Headless autoplay lives in `tools/engine/h`.
Setup: `npm i -D playwright && npx playwright install webkit`. Then fix the
hard-coded `/workspace/...` paths, or serve `game/` on the port the script expects.

## 16-bit direction (exploration only)
Platform discussion: the user wants one build that runs on RetroArch, a Raspberry
Pi, a computer, and maybe a console.
- **Now:** Chromium fullscreen on a PC or Pi, with a USB or Bluetooth pad.
- **Genesis ROM (SGDK):** the broadest retro reach, but every asset needs redrawn
  pixel art plus a C rewrite.
- **Dreamcast:** keeps more of the painted art, but it is a bigger rewrite.

Findings from the sprite tests in `art-source/genesis-tests/` (code in `tools/genesis/`):
- Converting the paintings directly turns to mud. What works is an AI redraw as a
  sprite, then a mode or nearest-neighbour shrink, then a palette of 12 learned
  colours plus 3 anchors (mask blue, steel, black), snapped to 9-bit Genesis levels
  (0, 36, 73, 109, 146, 182, 219, 255).
- A chroma-green background removal deletes green turtle skin. Fill the alpha
  holes afterwards (`lenny64.py`).
- The target is about 56×64 per character. The user prefers the painting's darker
  olive and bronze tones over bright arcade greens. A palette remap in HSV does it.
- `tools/genesis/genesis_sprite.py` is the user's script. It writes CRAM words and
  the 32×32 hardware-sprite split. Run it on a redraw, not a painting, and add
  anchor colours so the blades stay steel.
- Backgrounds: one 320×224 screen came to about 1,075 unique 8×8 tiles, against
  2,048 tiles of VRAM in total. Plan on tile reuse or streaming.
