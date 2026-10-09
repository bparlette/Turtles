# Shell Shock games

Self-contained static folders. All links between them are relative, so the whole `games/` folder can be dropped into any static host (GitHub Pages: copy into `public/games/` of the Aistudio repo, or the repo root).

| Folder | What |
| --- | --- |
| `index.html` | Hub: links to both games and both home pages |
| `shell-shock-live/` | Live game |
| `shell-shock-16bit/` | 16-bit game (same engine, auto-converted art) |
| `shell-shock-live-home/` | Live home page + trailer |
| `shell-shock-16bit-home/` | 16-bit home page + trailer |
| `sprites/` | Every sprite pose, Live and 16-bit, plus sprites.json |

Live mirrors: shellshock-live.surge.sh, shellshock16bit.surge.sh, shellshock-trailer.surge.sh, shellshock16bit-trailer.surge.sh, shellshock-sprites.surge.sh.
Lint: `node shell-shock-live/tools/lint-random.mjs shell-shock-live`
