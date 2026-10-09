# Targeted in-place patch of Shell Shock index.html: painted shared art.
# usage: python3 patch.py <index.html> [more...]   (idempotent: skips if marker present)
import sys, json
MARK = "// ---- Painted shared art (shared_art) ----"
SH = json.load(open('/workspace/work/shared_art/out/meta.json'))['shared']
SP = json.load(open('/workspace/work/shared_art/out/meta_sp.json'))
PO = json.load(open('/workspace/work/shared_art/out/meta_port.json'))
BLOCK = MARK + """
  // Painted sprites replace the old code-drawn props, pickups, projectiles, special poses, HUD portraits, title and map art.
  // Every draw falls back to the old code art while its image loads. Shared sheet: 4 px per world px, frames [x, y, w, h].
  const mkArt = (src) => { const im = document.createElement("img"); im.src = src; return im; };
  const artOk = (im) => (im && im.complete && im.naturalWidth ? im : null);
  const SH_IM = mkArt("shared_sprites.png"), SH_K = 0.25;
  const SHF = %s;
  const SP_IM = { lenny: mkArt("sp_lenny.png"), rafe: mkArt("sp_rafe.png"), miko: mkArt("sp_miko.png"), donny: mkArt("sp_donny.png") };
  const SPF = %s; // painted special-move poses, same scale as the brother's atlas (TURTLE_K)
  const PORT_IM = mkArt("hud_portraits.png"), PORT_T = 72, PORT_I = %s;
  const BOSS_PORT = { RAMROD: "ramrod", "ZAP-ROLLER": "zap", SCORCHER: "scorcher", BRICKJAW: "brickjaw", "GULCH GATOR": "gulch", JETWASH: "jetwash", GRIMWALE: "grimwale", "COLD FRONT": "coldfront",
    RUSTMAUL: "rustmaul", RAZORBACK: "razorback", KARAI: "karai", ARMAGGON: "armaggon", LEATHERHEAD: "leatherhead", VIRAL: "viral", "GENERAL TRAAG": "traag", TRAAG: "traag", "LT. GRANITOR": "granitor", GRANITOR: "granitor",
    KRANG: "krang", SHREDDER: "shredder", "THE SHREDDER": "shredder", "SUPER SHREDDER": "super" };
  const TITLE_BG = mkArt("title_bg.jpg"), TITLE_LOGO = mkArt("title_logo.png"), MAP_BG = mkArt("map_bg.jpg");
  const shSpr = (name) => { const im = artOk(SH_IM); return im && SHF[name] ? im : null; };
  function drawPortrait(key, x, y, s) { // one painted bust, drawn into an s x s box
    const im = artOk(PORT_IM), i = PORT_I[key]; if (!im || i === undefined) return false;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, i * PORT_T, 0, PORT_T, PORT_T, x, y, s, s); ctx.restore(); return true;
  }
  function bossPortraitKey(name) { name = String(name || "").toUpperCase(); if (BOSS_PORT[name]) return BOSS_PORT[name]; for (const k in BOSS_PORT) if (name.includes(k)) return BOSS_PORT[k]; return null; }
  function specFrame(p, name) { // which painted special pose the brother shows (render-only; timing untouched)
    const im = artOk(SP_IM[name]), F = SPF[name]; if (!im || !F || !p.spec) return null;
    const pr = 1 - p.attackT / p.atkDur, air = p.z > 0.5;
    let f;
    if (name === "lenny") f = !air && pr > 0.5 ? "land" : Math.cos(pr * Math.PI * 8) >= 0 ? "spin1" : "spin2";
    else if (name === "rafe") f = pr < 0.18 ? "dive1" : !air && pr > 0.8 ? "land" : "dive2";
    else if (name === "miko") f = air ? (Math.floor(STATE.t / 4) %% 2 ? "copter2" : "copter1") : pr > 0.5 ? "land" : "copter1";
    else f = p.z <= 2 && pr > 0.3 ? "slam" : pr < 0.25 ? "vault" : "flip";
    return { im, fr: F[f], f };
  }
  function drawSlicePainted(x, y, len) { // the cutscene slice, tip pointing left at (x, y); len shrinks as it is eaten (bites off the tip)
    const im = shSpr("slice"); if (!im) return false;
    const [fx, fy, fw, fh] = SHF.slice, keep = Math.max(0.3, Math.min(1, len / 16)), sh = fh * keep, k = 18 / fh;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    // after rotating, +y points left: crust end sits at -(len) and the (bitten) tip at the origin
    ctx.drawImage(exposed(im, SPRITE_EXPOSE), fx, fy, fw, sh, -fw * k / 2, -sh * k, fw * k, sh * k);
    ctx.restore(); return true;
  }
""" % (json.dumps(SH, separators=(',', ':')), json.dumps(SP, separators=(',', ':')), json.dumps(PO, separators=(',', ':')))

R = []  # (old, new) exact replacements, each must match exactly once
A = "  const atlasImg = (name) => { const im = document.getElementById(\"atlas-\" + name); return im && im.complete && im.naturalWidth ? im : null; };\n"
R.append((A, A + BLOCK))
# props
R.append(("""    const fa = flashAll; if (pr.flash > 0 && pr.flash % 2) flashAll = true;
    const ol = "#0c0c10";
""", """    const fa = flashAll; if (pr.flash > 0 && pr.flash % 2) flashAll = true;
    const psp = shSpr(pr.kind);
    if (psp) { // painted prop (rolling / thrown barrel tumbles on its side about its middle)
      if (pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless))) {
        const f = SHF.barrel_side; ctx.save(); ctx.translate(sx, sy - 7 * PROP_K); ctx.rotate(pr.rot || pr.t * 0.3); drawFrame(psp, f, 0, f[3] * SH_K / 2, SH_K, 1); ctx.restore();
      } else drawFrame(psp, SHF[pr.kind], sx, sy + 1, SH_K, 1);
      flashAll = fa; return;
    }
    const ol = "#0c0c10";
"""))
# items
R.append(("""    ctx.save(); ctx.translate(sx, y); ctx.scale(ITEM_K, ITEM_K); ctx.translate(-sx, -y);
    const crust = "#c8862a",""", """    const isp = shSpr(it.kind);
    if (isp) drawFrame(isp, SHF[it.kind], sx, y + 1, SH_K, 1);
    else {
    ctx.save(); ctx.translate(sx, y); ctx.scale(ITEM_K, ITEM_K); ctx.translate(-sx, -y);
    const crust = "#c8862a","""))
R.append(("""      rect(sx - 3, y - 11, 3, 1, ch2); rect(sx - 2, y - 10, 2, 2, pep); rect(sx + 2, y - 9, 2, 2, pep); rect(sx - 1, y - 6, 2, 2, pep);
    }
    ctx.restore();
""", """      rect(sx - 3, y - 11, 3, 1, ch2); rect(sx - 2, y - 10, 2, 2, pep); rect(sx + 2, y - 9, 2, 2, pep); rect(sx - 1, y - 6, 2, 2, pep);
    }
    ctx.restore();
    }
"""))
# projectiles
R.append(("""    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(k === "snowball" || k === "sludge" ? 0 : spin);
    if (k === "brick")""", """    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(k === "snowball" || k === "sludge" ? 0 : spin);
    const ssp = k !== "ray" && shSpr(SHF[k] ? k : "rock");
    if (ssp) { const f = SHF[SHF[k] ? k : "rock"]; drawFrame(ssp, f, 0, f[3] * SH_K / 2, SH_K, 1); ctx.restore(); return; }
    if (k === "brick")"""))
R.append(("""    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(STATE.t * 0.5);
    rect(-4, -1, 8, 2, "#dfe4ea");""", """    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(STATE.t * 0.5);
    const ssp = shSpr("star"); if (ssp) { const f = SHF.star; drawFrame(ssp, f, 0, f[3] * SH_K / 2, SH_K, 1); ctx.restore(); return; }
    rect(-4, -1, 8, 2, "#dfe4ea");"""))
# specials: painted pose in place of the attack frame
R.append(("""    const name = p.bro.name.toLowerCase(), im = atlasImg(name);
    if (!im) return false;
    drawFrame(im, ATLAS[name][playerFrame(p, name)], x, y, TURTLE_K, facing);""", """    const name = p.bro.name.toLowerCase(), im = atlasImg(name);
    if (!im) return false;
    const spf = p.atk === "power" && p.spec && !(p.deadT > 0 || p.downT > 0 || p.hurtT > 0) ? specFrame(p, name) : null;
    if (spf) { drawFrame(spf.im, spf.fr, x, y, TURTLE_K, facing); return true; }
    drawFrame(im, ATLAS[name][playerFrame(p, name)], x, y, TURTLE_K, facing);"""))
R.append(("""if (nm === "RAFE") { ctx.translate(0, -14); ctx.rotate(p.facing * 1.2); ctx.translate(0, 14); } else if (nm === "DONNY" && p.z > 2) { ctx.translate(0, -16); ctx.rotate(p.facing * pr2 * Math.PI * 2); ctx.translate(0, 16); } }""",
"""const painted = !!specFrame(p, nm.toLowerCase()); if (nm === "RAFE" && !painted) { ctx.translate(0, -14); ctx.rotate(p.facing * 1.2); ctx.translate(0, 14); } else if (nm === "DONNY" && p.z > 2 && (!painted || pr2 >= 0.25)) { const a = painted ? (pr2 - 0.25) / 0.75 : pr2; ctx.translate(0, -16); ctx.rotate(p.facing * a * Math.PI * 2); ctx.translate(0, 16); } }"""))
R.append(("""        if (p.atk === "power" && p.bro.name !== "DONNY") ctx.scale(""", """        if (p.atk === "power" && p.bro.name !== "DONNY" && !(p.bro.name === "RAFE" && p.spec && specFrame(p, "rafe"))) ctx.scale("""))
# HUD P1 portrait
R.append(("""    rect(11, 9, 12, 14, "#3fae3a"); rect(10, 11, 14, 10, "#3fae3a"); rect(9, 13, 16, 4, p.bro.mask); rect(24, 16, 2, 4, p.bro.mask);
    rect(12, 14, 4, 2, "#fff"); rect(18, 14, 4, 2, "#fff"); rect(15, 14, 1, 2, "#000"); rect(21, 14, 1, 2, "#000"); rect(14, 20, 6, 1, "#24702a");""",
"""    if (!drawPortrait(p.bro.name.toLowerCase(), 8, 7, 18)) {
    rect(11, 9, 12, 14, "#3fae3a"); rect(10, 11, 14, 10, "#3fae3a"); rect(9, 13, 16, 4, p.bro.mask); rect(24, 16, 2, 4, p.bro.mask);
    rect(12, 14, 4, 2, "#fff"); rect(18, 14, 4, 2, "#fff"); rect(15, 14, 1, 2, "#000"); rect(21, 14, 1, 2, "#000"); rect(14, 20, 6, 1, "#24702a"); }"""))
# HUD boss portrait
R.append(("""      const by = Math.round(3 - 28 * (1 - HUDS.slide)), x0 = 160, bw = 186, bx = x0 + 5; // v1.1: top bar, keeps the front floor lane clear
      rect(x0, by, 196, 26, "#fff"); rect(x0 + 1, by + 1, 194, 24, "#10101c");""",
"""      const bName = rr ? (rr.name || "RAMROD") : HUDS.lastName || "ZAP-ROLLER", bKey = bossPortraitKey(bName), hasP = !!(bKey && artOk(PORT_IM));
      const by = Math.round(3 - 28 * (1 - HUDS.slide)), x0 = 160, bw = hasP ? 164 : 186, bx = x0 + (hasP ? 27 : 5); // v1.1: top bar, keeps the front floor lane clear
      rect(x0, by, 196, 26, "#fff"); rect(x0 + 1, by + 1, 194, 24, "#10101c");
      if (hasP) { rect(x0 + 3, by + 3, 20, 20, "#2a2a40"); drawPortrait(bKey, x0 + 4, by + 4, 18); }"""))
# title backdrop
R.append(("""  function drawNight() {
    const grd""", """  function drawNight() {
    const tb = artOk(TITLE_BG);
    if (tb) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(tb, 0, 0, W, H); ctx.restore(); return; }
    const grd"""))
R.append(("""    drawLogo("SHELL SHOCK:", W / 2, Math.round(12 - (1 - e) * 110), 5);
    drawLogo("LIVE ACTION", W / 2, Math.round(56 - (1 - e) * 110), 3);
    if (titleT > 40) { const n = startLevelQ(), d = LEVELS[n - 1]; text("LEVEL " + n + (d ? ": " + d.name : ""), W / 2, 84, 10, "#ffd27a"); }""",
"""    const lg = artOk(TITLE_LOGO);
    if (lg) { const lw = 172, lh = 80; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(lg, Math.round(W / 2 - lw / 2), Math.round(3 - (1 - e) * 110), lw, lh); ctx.restore(); }
    else { drawLogo("SHELL SHOCK:", W / 2, Math.round(12 - (1 - e) * 110), 5); drawLogo("LIVE ACTION", W / 2, Math.round(56 - (1 - e) * 110), 3); }
    if (titleT > 40) { const n = startLevelQ(), d = LEVELS[n - 1]; text("LEVEL " + n + (d ? ": " + d.name : ""), W / 2, lg ? 89 : 84, 10, "#ffd27a"); }"""))
# map backdrop
R.append(("""    const M = MAP; drawNight(); ctx.globalAlpha = 0.5; rect(0, 0, W, H, "#05040a"); ctx.globalAlpha = 1;
    if (!M) return;""", """    const M = MAP, mb = artOk(MAP_BG);
    if (mb) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(mb, 0, 0, W, H); ctx.restore(); ctx.globalAlpha = 0.38; rect(0, 0, W, H, "#05040a"); ctx.globalAlpha = 1; }
    else { drawNight(); ctx.globalAlpha = 0.5; rect(0, 0, W, H, "#05040a"); ctx.globalAlpha = 1; }
    if (!M) return;"""))
# pizza-break cutscene: painted slice + painted pie in the box
R.append(("""    drawSlice(sx, sy, len);
    for (const c of z.crumbs)""", """    if (!drawSlicePainted(sx, sy, len)) drawSlice(sx, sy, len);
    for (const c of z.crumbs)"""))
R.append(("""    rect(-30, -24, 60, 10, "#a8743a"); rect(-29, -23, 58, 8, "#c8945a"); rect(-29, -23, 58, 1, "#e0b47a");
    rect(-32, -14, 64, 13, "#b8844a"); rect(-32, -14, 64, 2, "#e0b47a"); rect(-32, -2, 64, 2, "#6a4420");
    rect(-26, -13, 52, 3, "#f6cf4a"); for (let i = 0; i < 5; i++) rect(-22 + i * 10, -13, 3, 2, "#a8241a");
    ctx.restore();""", """    const pz = shSpr("pizza");
    if (!pz) {
    rect(-30, -24, 60, 10, "#a8743a"); rect(-29, -23, 58, 8, "#c8945a"); rect(-29, -23, 58, 1, "#e0b47a");
    rect(-32, -14, 64, 13, "#b8844a"); rect(-32, -14, 64, 2, "#e0b47a"); rect(-32, -2, 64, 2, "#6a4420");
    rect(-26, -13, 52, 3, "#f6cf4a"); for (let i = 0; i < 5; i++) rect(-22 + i * 10, -13, 3, 2, "#a8241a"); }
    // the painted pie in its open box, lower half only so the lid never covers the brother
    if (pz) { const [fx, fy, fw, fh] = SHF.pizza, c0 = Math.round(fh * 0.5), k = 66 / fw; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(exposed(pz, SPRITE_EXPOSE), fx, fy + c0, fw, fh - c0, -fw * k / 2, 1 - (fh - c0) * k, fw * k, (fh - c0) * k); ctx.restore(); }
    ctx.restore();"""))

# pre-existing render bug: Donny's 2nd landing ring starts at t=-6 -> negative ellipse radius throws inside the draw pass
R.append(("""else if (f.kind === "ring") { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff6c0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx0, f.y, 8 + k * 40, 3 + k * 12, 0, 0, 6.29);""",
"""else if (f.kind === "ring") { ctx.globalAlpha = k < 0 ? 0 : 1 - k; ctx.strokeStyle = "#fff6c0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx0, f.y, 8 + Math.max(0, k) * 40, 3 + Math.max(0, k) * 12, 0, 0, 6.29);"""))

def apply(path):
    s = open(path).read()
    if MARK in s: print(path, 'already patched'); return False
    for i, (o, n) in enumerate(R):
        c = s.count(o)
        if c != 1: raise SystemExit(f'{path}: replacement {i} matched {c} times: {o[:80]!r}')
        s = s.replace(o, n)
    open(path, 'w').write(s); print(path, 'patched', len(R), 'edits'); return True
if __name__ == '__main__':
    for p in sys.argv[1:]: apply(p)
