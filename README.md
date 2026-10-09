# Shell Shock: Live Action

A 15-level, side-scrolling beat-'em-up for the browser, in the style of the
1989 arcade brawlers. Plain HTML5 canvas and JavaScript: no build step, no
framework, no dependencies to run. It works offline as a PWA after the first load.

Live build: https://shellshock-live.surge.sh

> Fan-made, non-commercial. The characters (Lenny, Donny, Rafe, Miko and the
> rest) are original designs inspired by 80s/90s turtle cartoons. Keep it
> non-commercial and add a LICENSE before you make the repo public.

## Play locally

```bash
cd game
python3 -m http.server 8000
# open http://localhost:8000
```

You must use a web server, because `file://` blocks the service worker and the
level script fetches.

Deep links: `?level=N` starts scene N. `?debug` exposes `window.__SS` / `window.__SSENG`.
Options: `?shake=off`, `?light=low|off`, `?record`, `?replay=last`.

## Controls

| Action | Keyboard | Gamepad (standard mapping) | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Left stick / D-pad | Virtual stick |
| Attack | J | X (button 2) | On-screen button |
| Jump | K | A (button 0) | On-screen button |
| Power / special | L | B (1) or RB (5) | On-screen button |
| Start / confirm | Enter / Space | Start (9) | Tap |
| Back | Esc / Backspace | B | "< BACK" |
| Mute | M | | |

## Modes (title, then PUSH START)

The menu is one list: **Arcade → Speed Run → Boss Rush → Level Select → Gallery**.

- **Arcade**: the full game, with saved progress. Each level runs zone 1, then a
  twist set piece, then zone 2, then the boss.
- **Speed Run**: starts at scene 1, cuts each level down, and times the run. Best
  times are saved.
- **Boss Rush**: boss arenas only, back to back, with the boss entrance cinematics.
- **Level Select**: a grid of all 15 scenes.
- **Gallery**: every painted hero, enemy and boss, with its poses.

## Repo layout

```
game/            the shippable site (deploy this folder as-is)
  index.html     the whole engine: loop, input, audio, menus, modes, gallery, entrances
  levels/        level2.js ... level15.js + each level's art (level 1 is built into index.html)
  atlas_*.png    character sprite atlases; sp_*.png = special poses
  assets.json    per-level image manifest (generated)
  sw.js          offline service worker (generated, versioned)
tools/           the scripts that built and tested it (see tools/README.md)
art-source/      raw AI-generated art before slicing, plus 16-bit/Genesis experiments
docs/            engineering log and the AI handoff
scripts/         serve, check, and deploy helpers
```

## Before every deploy

```bash
python3 tools/engine/build_assets.py game   # refreshes assets.json and stamps a new sw.js VERSION
bash scripts/check.sh                        # node --check on every script
```

If you skip `build_assets.py`, returning players keep stale cached images.

## Deploy

Any static host works: GitHub Pages, Netlify, or surge. For GitHub Pages, publish
the `game/` folder. One way is a `gh-pages` branch containing only `game/`'s contents.
`scripts/deploy_surge.sh` shows the surge flow, and it reads the token from the
environment.

## For another AI picking this up

Read `docs/AI_HANDOFF.md` first.
