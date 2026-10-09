  // ---------- GALLERY + TITLE PARADE (gallery v1) ----------
  // Every painted character, from galRegistry() (one array, defined per game just below). Two views:
  //  * title parade: while the bare title sits idle, two spotlights in the top corners walk every character in and out
  //    with a name plate (never over the logo / PUSH START). Engine sheets are already resident; level sheets are fetched
  //    one at a time in the background only after the title has idled ~4 s, baked into small thumbs and the big sheet freed.
  //  * GALLERY menu entry: grouped grid (heroes / bosses / mini-bosses / enemies / allies) -> tap / ENTER for a full-size
  //    view that cycles every painted pose (idle, walk, attacks, specials, hurt, KO). Level sheets load only when needed.
  // Frame data comes from the real tables: ATLAS / ATLAS_E / ATLAS_SP / SPF / SCORCHER_FR in this file, and for level
  // sheets the level script is fetched as TEXT (never executed) and its `NAME = { pose: [x, y, w, h, anchorX], ... }`
  // literal is parsed. A sheet or script that is missing (not painted yet) fails to load and the character is skipped.
  let GAL = null, GAL_S = null, GAL_PT = 0, GAL_Q = 0;
  const GAL_BK = 2, GAL_TH = 62; // thumbs: GAL_BK px per world px, idle GAL_TH world px tall
  const GAL_GRP = { HERO: ["HEROES", "#7fd85a"], BOSS: ["BOSSES", "#ff5a4a"], "MINI-BOSS": ["MINI-BOSSES", "#ff9a3a"], ENEMY: ["ENEMIES", "#5ab0ff"], ALLY: ["ALLIES", "#ffd27a"] };
  const GAL_ORDER = ["HERO", "BOSS", "MINI-BOSS", "ENEMY", "ALLY"];
  const galTxt = {}; // level script url -> Promise<source text>
  function galFetchTxt(u) {
    if (!galTxt[u]) galTxt[u] = (window.fetch && location.protocol !== "file:" ? fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.text() : null)) : Promise.resolve(null)).catch(() => null);
    return galTxt[u];
  }
  function galLit(src, name, near) { // parse the object literal `name = {...}` (or, with no name, the first one with an idle pose after `near`)
    let i = -1;
    if (name) { const m = new RegExp("\\b" + name.replace(/[$]/g, "\\$") + "\\s*=\\s*\\{").exec(src); if (m) i = m.index + m[0].length - 1; }
    else {
      const v = near && new RegExp("\\b([A-Za-z_$][\\w$]*)\\s*=\\s*[\"']" + near.replace(/[.]/g, "\\.") + "[\"']").exec(src);
      if (v) { const P = v[1].replace(/_?(IMG|SRC|SHEET|IM)$/, ""); for (const nm of [P + "F", P + "_F", P + "FR", P + "_FR", P + "_FRAMES"]) { const o = galLit(src, nm); if (o && o.idle) return o; } }
      const at = near ? src.indexOf(near) : 0, re = /\b[A-Za-z_$][\w$]*\s*=\s*\{/g; re.lastIndex = Math.max(0, at);
      for (let m; (m = re.exec(src));) { const j = m.index + m[0].length - 1, body = galBrace(src, j); if (body && /["']?\bidle["']?\s*:\s*\[/.test(body)) { i = j; break; } }
    }
    if (i < 0) return null;
    const body = galBrace(src, i); if (!body) return null;
    try {
      const P = new Proxy({}, { has: (t, k) => typeof k === "string" && k !== "Math", get: (t, k) => (k === Symbol.unscopables ? undefined : 0) });
      return new Function("P", "with (P) { return (" + body + "); }")(P); // bare identifiers (src: TRS) read as 0
    } catch (_) { return null; }
  }
  function galBrace(src, i) { // the balanced {...} starting at src[i]
    let d = 0, q = null;
    for (let j = i; j < src.length && j < i + 20000; j++) {
      const c = src[j];
      if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "{") d++;
      else if (c === "}" && --d === 0) return src.slice(i, j + 1);
    }
    return null;
  }
  const GAL_LATE = /^(hurt|stun|daze|stagger|fall|lie|down|dying|dead|ko|getup|get_up|knock|dizzy)/i;
  function galPoses(fr, skip) { // frame table -> ordered [{ n, f }]: idle, walk, attacks/specials..., hurt/fall/down/KO last
    const out = [], seen = {};
    for (const n in fr) {
      const f = fr[n];
      if (!Array.isArray(f) || f.length < 4 || !f.slice(0, 4).every((v) => typeof v === "number") || f[2] < 4 || f[3] < 4) continue;
      if (skip && skip.test(n)) continue;
      const key = f.slice(0, 4).join(","); if (seen[key]) continue; seen[key] = 1;
      out.push({ n, f });
    }
    const idle = out.find((p) => /^idle/i.test(p.n)) || out[0]; if (!idle) return [];
    const ih = idle.f[3], rank = (p) => (/^idle/i.test(p.n) ? 0 : /^walk/i.test(p.n) ? 1 : GAL_LATE.test(p.n) ? 3 : 2);
    return out.filter((p) => Math.max(p.f[2], p.f[3]) >= ih * 0.45).map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((o) => o.p);
  }
  function galImg(src) { // resolves to a decoded <img> or null (missing = not painted yet)
    return new Promise((res) => {
      let im = src;
      if (typeof src === "string") { im = new Image(); im.decoding = "async"; im.src = src; }
      if (!im) return res(null);
      if (im.complete) return res(im.naturalWidth ? im : null);
      im.addEventListener("load", () => res(im.naturalWidth ? im : null), { once: true });
      im.addEventListener("error", () => res(null), { once: true });
    });
  }
  function galSheet(d) { // one sheet spec -> Promise<{ im, poses, lazy }>
    if (d.atlas !== undefined) {
      const el = document.getElementById("atlas-" + d.atlas), fr = d.fr || (typeof ATLAS !== "undefined" && ATLAS[d.atlas]);
      return galImg(el).then((im) => (im && fr ? { im, poses: galPoses(fr, d.skip), lazy: false } : null));
    }
    if (d.js) return galFetchTxt(d.js).then((txt) => {
      const fr = txt && galLit(txt, d.fr, d.src), t = fr && d.sub ? fr[d.sub] : fr;
      if (!t) return null;
      return galImg(d.src).then((im) => (im ? { im, poses: galPoses(t, d.skip), lazy: true } : null));
    });
    return galImg(d.img).then((im) => (im && d.fr ? { im, poses: galPoses(d.fr, d.skip), lazy: typeof d.img === "string" } : null));
  }
  const galRes = (e) => e.atlas !== undefined || (!!e.img && typeof e.img !== "string");
  function galInit() {
    if (GAL_S) return GAL_S;
    let reg = [];
    try { reg = galRegistry(); } catch (_) { reg = []; }
    GAL_S = reg.map((e, i) => ({ e, i, st: 0, th: null, poses: null }));
    return GAL_S;
  }
  function galLoad(s) { // load + bake thumbs; frees a lazy level sheet afterwards (the zoom view reloads it on demand)
    if (s.st) return; s.st = 1;
    galSheet(s.e).then((sh) => {
      if (!sh || !sh.poses.length) { s.st = 3; return; }
      const idle = sh.poses[0], k = (GAL_TH * GAL_BK) / idle.f[3] * (s.e.k || 1), th = {}, face = s.e.face || 1;
      const anim = sh.poses.filter((p) => /^(idle|walk|roll)/i.test(p.n)).slice(0, 5);
      for (const p of anim.length ? anim : [idle]) {
        const [x, y, w, h] = p.f, cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
        const g = cv.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        if (face < 0) { g.translate(cw, 0); g.scale(-1, 1); }
        g.drawImage(sh.im, x, y, w, h, 0, 0, cw, ch);
        const ax = p.f.length > 4 && p.f[4] > 0 && p.f[4] < w ? p.f[4] : w / 2;
        th[p.n] = { cv, ax: (face < 0 ? w - ax : ax) * k, w: cw, h: ch };
      }
      s.th = th; s.anim = Object.keys(th); s.poses = sh.poses.map((p) => ({ n: p.n, f: p.f }));
      s.idleH = idle.f[3]; s.k0 = 1 / k; s.res = sh.lazy ? null : sh.im; // engine sheets stay resident anyway
      const sp = (s.e.sp || []).map((d) => galSheet(d).then((x) => { // painted specials go before the hurt / KO poses
        if (!x) return;
        let at = s.poses.findIndex((q) => GAL_LATE.test(q.n)); if (at < 0) at = s.poses.length;
        s.poses.splice(at, 0, ...x.poses.map((p) => ({ n: p.n, f: p.f, im: x.im })));
      }));
      Promise.all(sp).then(() => { s.st = 2; });
      if (sh.lazy) { try { sh.im.src = ""; } catch (_) {} }
    }).catch(() => { s.st = 3; });
  }
  function galPump(n) { // keep at most n loads in flight, in registry order (lazy sheets only start when asked)
    const S = galInit(); let fl = S.filter((s) => s.st === 1).length;
    for (const s of S) { if (fl >= n) break; if (!s.st) { galLoad(s); fl++; } }
  }
  function galThumb(s, pose, x, y, hh, facing) { // baked pose, feet at (x, y), idle drawn hh world px tall
    const t = s.th && (s.th[pose] || s.th[s.anim[0]]); if (!t) return;
    const sc = hh / (GAL_TH * GAL_BK);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.translate(x, y); if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(t.cv, -t.ax * sc, -t.h * sc, t.w * sc, t.h * sc); ctx.restore();
  }
  function galWalk(s, t) { // walk cycle over the baked thumbs
    const w = s.anim.filter((n) => /^(walk|roll)/i.test(n)), idle = s.anim.find((n) => /^idle/i.test(n)) || s.anim[0];
    if (!w.length) return s.anim[Math.floor(t / 20) % s.anim.length];
    const cyc = w.length === 1 ? [w[0], idle] : w.length === 2 ? [w[0], idle, w[1], idle] : w;
    return cyc[Math.floor(t / 9) % cyc.length];
  }
  const galTag = (e) => (GAL_GRP[e.grp] ? e.grp : "ENEMY") + (e.lv ? " - " + PROG_WORD + " " + e.lv : e.grp === "HERO" ? "" : " - ALL " + PROG_WORD + "S");
  function galPlate(x, y, e, a) {
    ctx.globalAlpha = 0.72 * a; ctx.font = "bold 7px monospace"; const tg = galTag(e);
    const w = Math.max(ctx.measureText(e.name).width, tg.length * 3.7) + 10;
    rect(x - w / 2, y - 6, w, 19, "#05040a"); ctx.globalAlpha = a;
    rect(x - w / 2, y - 6, w, 1, (GAL_GRP[e.grp] || GAL_GRP.ENEMY)[1]);
    text(e.name, x, y, 7, "#fff"); text(tg, x, y + 8, 5, (GAL_GRP[e.grp] || GAL_GRP.ENEMY)[1]);
    ctx.globalAlpha = 1;
  }
  // Title parade: two corner spotlights, offset half a beat, each walks a character in, idles, and walks out.
  const GAL_SPOT = [{ x: 58, o: 0 }, { x: W - 64, o: 1 }], GAL_BEAT = 170;
  function galParade() {
    if (MENU || GAL) { GAL_PT = 0; return; }
    if (++GAL_PT < 70) return;
    const S = galInit();
    if (GAL_PT === 70) for (const s of S) if (galRes(s.e)) galLoad(s); // engine-resident sheets
    if (GAL_PT > 240 && GAL_PT % 20 === 0) galPump(1); // then level sheets, one at a time
    const list = S.filter((s) => s.st === 2); if (!list.length) return;
    for (const sp of GAL_SPOT) {
      const t = GAL_PT - 70 + sp.o * (GAL_BEAT / 2), beat = Math.floor(t / GAL_BEAT), u = t % GAL_BEAT;
      const s = list[(beat * 2 + sp.o) % list.length], dir = sp.o ? -1 : 1; // walk in from the screen edge
      const inK = Math.min(1, u / 34), outK = Math.max(0, (u - (GAL_BEAT - 30)) / 30);
      const x = sp.x - dir * (1 - inK) * 70 - dir * outK * 70; // in from the edge, out the way it came
      const a = Math.min(1, u / 12, (GAL_BEAT - u) / 12);
      const pose = u < 34 || outK > 0 ? galWalk(s, t) : (s.anim.find((n) => /^idle/i.test(n)) || s.anim[0]);
      ctx.globalAlpha = a * 0.45; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, 86, 20, 3, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = a;
      galThumb(s, pose, x, 86, s.e.grp === "HERO" || s.e.grp === "ENEMY" || s.e.grp === "ALLY" ? 58 : 66, outK > 0 ? -dir : dir);
      ctx.globalAlpha = 1;
      galPlate(sp.x, 10, s.e, a);
    }
  }
  // ---- GALLERY screen ----
  const GAL_COLS = 8, GAL_TW = 42, GAL_TH2 = 54, GAL_GAP = 3, GAL_HDR = 11, GAL_Y0 = 24, GAL_Y1 = 198;
  const GAL_X0 = Math.floor((W - (GAL_COLS * GAL_TW + (GAL_COLS - 1) * GAL_GAP)) / 2);
  const GAL_BACK = { x: 4, y: 4, w: 50, h: 16 }, GAL_UP = { x: 60, y: 4, w: 26, h: 16 }, GAL_DN = { x: 90, y: 4, w: 26, h: 16 }; // header: the bottom corners are the touch buttons
  const galIn = (t, b) => t && t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h;
  function galOpen() { galInit(); GAL = { mode: "grid", cur: 0, t: 0, sy: 0, zt: 0, zi: 0, auto: 1, full: null, hold: 0 }; GAL_PT = 0; }
  function galLayout() { // visible (not failed) tiles grouped, with header rows; positions in content space
    const S = galInit(), tiles = [], hdr = []; let y = 0;
    for (const g of GAL_ORDER) {
      const items = S.filter((s) => s.st !== 3 && (s.e.grp === g || (g === "ENEMY" && !GAL_GRP[s.e.grp])));
      if (!items.length) continue;
      hdr.push({ g, y, n: items.length }); y += GAL_HDR;
      items.forEach((s, j) => tiles.push({ s, x: GAL_X0 + (j % GAL_COLS) * (GAL_TW + GAL_GAP), y: y + Math.floor(j / GAL_COLS) * (GAL_TH2 + GAL_GAP), r: 0 }));
      y += Math.ceil(items.length / GAL_COLS) * (GAL_TH2 + GAL_GAP) + 2;
    }
    return { tiles, hdr, h: y };
  }
  function galZoomOpen(s) {
    const G = GAL; G.mode = "zoom"; G.zs = s; G.zi = 0; G.zt = 0; G.auto = 1; G.full = null; G.t = 0;
    if (s.st === 2 && s.res) G.full = s.res;
    else { const d = s.e; galImg(d.atlas !== undefined ? document.getElementById("atlas-" + d.atlas) : d.src || d.img).then((im) => { if (GAL && GAL.zs === s) GAL.full = im || "x"; else if (im && d.src) im.src = ""; }); }
  }
  function galZoomClose() { const G = GAL; if (G.full && G.full !== "x" && G.zs && G.zs.e.src) { try { G.full.src = ""; } catch (_) {} } G.full = null; G.mode = "grid"; G.t = 0; }
  function galUpdate() {
    const G = GAL; G.t++; if (G.hold > 0) G.hold--;
    const tp = tapPoint; tapPoint = null;
    const ok = G.t > 4 && anyPressed("enter", " ", "j", "k"), back = G.t > 4 && (anyPressed("escape", "backspace", "l") || (tp && galIn(tp, GAL_BACK)));
    galPump(2);
    const L = galLayout(), n = L.tiles.length;
    if (G.mode === "zoom") {
      const s = G.zs, np = (s.poses || []).length || 1;
      if (back) { galZoomClose(); SFX.menuMove(); return; }
      let step = 0;
      if (anyPressed("arrowright", "d") || ok) step = 1; if (anyPressed("arrowleft", "a")) step = -1;
      if (tp && tp.x >= 0 && G.t > 4) step = tp.x < W / 2 - 40 ? -1 : 1;
      if (step) { G.zi = (G.zi + step + np) % np; G.zt = 0; G.hold = 300; SFX.menuMove(); }
      let sw = 0; if (anyPressed("arrowdown", "s")) sw = 1; if (anyPressed("arrowup", "w")) sw = -1;
      if (sw && n) { const k = L.tiles.findIndex((t) => t.s === s); const nx = L.tiles[(Math.max(0, k) + sw + n) % n].s; galZoomClose(); G.cur = L.tiles.findIndex((t) => t.s === nx); galZoomOpen(nx); SFX.menuMove(); return; }
      if (++G.zt > 55 && G.hold <= 0) { G.zt = 0; G.zi = (G.zi + 1) % np; }
      return;
    }
    if (back) { GAL = null; SFX.menuMove(); return; }
    if (!n) return;
    G.cur = Math.max(0, Math.min(n - 1, G.cur));
    const c = L.tiles[G.cur], c0 = G.cur; let nc = G.cur;
    if (anyPressed("arrowright", "d")) nc = (G.cur + 1) % n;
    if (anyPressed("arrowleft", "a")) nc = (G.cur + n - 1) % n;
    const vert = anyPressed("arrowdown", "s") ? 1 : anyPressed("arrowup", "w") ? -1 : 0;
    if (vert) { // nearest tile on the next row up / down
      const rows = [...new Set(L.tiles.map((t) => t.y))].sort((a, b) => a - b), ri = rows.indexOf(c.y) + vert;
      if (ri >= 0 && ri < rows.length) { let best = -1, bd = 1e9; L.tiles.forEach((t, i) => { if (t.y === rows[ri] && Math.abs(t.x - c.x) < bd) { bd = Math.abs(t.x - c.x); best = i; } }); nc = best; }
    }
    if (nc !== G.cur) { G.cur = nc; SFX.menuMove(); }
    const cy = L.tiles[G.cur].y, vh = GAL_Y1 - GAL_Y0;
    if (tp && galIn(tp, GAL_UP)) G.sy -= vh - 30; else if (tp && galIn(tp, GAL_DN)) G.sy += vh - 30;
    else if (nc !== c0) { if (cy - G.sy < GAL_HDR) G.sy = cy - GAL_HDR - 2; if (cy + GAL_TH2 - G.sy > vh) G.sy = cy + GAL_TH2 - vh + 2; }
    G.sy = Math.max(0, Math.min(Math.max(0, L.h - vh), G.sy));
    if (tp && tp.x >= 0 && G.t > 4 && tp.y >= GAL_Y0 && tp.y < GAL_Y1) {
      const k = L.tiles.findIndex((t) => tp.x >= t.x && tp.x < t.x + GAL_TW && tp.y >= t.y - G.sy + GAL_Y0 && tp.y < t.y - G.sy + GAL_Y0 + GAL_TH2);
      if (k >= 0) { G.cur = k; if (L.tiles[k].s.st === 2) { SFX.confirm(); galZoomOpen(L.tiles[k].s); } }
    } else if (ok && L.tiles[G.cur].s.st === 2) { SFX.confirm(); galZoomOpen(L.tiles[G.cur].s); }
  }
  function galBtn(b, label, on) {
    rect(b.x, b.y, b.w, b.h, on ? "#ffe040" : "#3a2458"); rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, "#1a0e2c");
    ptext(label, b.x + b.w / 2, b.y + b.h / 2, 1, on ? "#ffe040" : "#c8ccd6");
  }
  function galDraw() {
    const G = GAL, blink = Math.floor(STATE.t / 8) % 2 === 0;
    rect(0, 0, W, H, "#0c0618");
    const g0 = ctx.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, "rgba(90,40,140,0.35)"); g0.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    const L = galLayout();
    if (G.mode === "zoom") return galDrawZoom(G, L);
    text("GALLERY", W / 2, 12, 14, "#fff");
    galBtn(GAL_BACK, "< BACK", false);
    ptext(L.tiles.filter((t) => t.s.st === 2).length + " PAINTED", W - 34, 12, 1, "#7fd85a", "right");
    ctx.save(); ctx.beginPath(); ctx.rect(0, GAL_Y0, W, GAL_Y1 - GAL_Y0); ctx.clip();
    for (const h of L.hdr) { const y = GAL_Y0 + h.y - G.sy + 5, c = GAL_GRP[h.g][1]; if (y < GAL_Y0 - 10 || y > GAL_Y1 + 10) continue; rect(GAL_X0, y + 4, GAL_COLS * (GAL_TW + GAL_GAP) - GAL_GAP, 1, c); ctx.globalAlpha = 1; rect(GAL_X0, y - 4, GAL_GRP[h.g][0].length * 6 + 6, 9, "#0c0618"); ptext(GAL_GRP[h.g][0] + " " + h.n, GAL_X0 + 2, y, 1, c, "left"); }
    L.tiles.forEach((tl, i) => {
      const x = tl.x, y = GAL_Y0 + tl.y - G.sy, s = tl.s, sel = i === G.cur, gc = (GAL_GRP[s.e.grp] || GAL_GRP.ENEMY)[1];
      if (y + GAL_TH2 < GAL_Y0 || y > GAL_Y1) return;
      rect(x - 1, y - 1, GAL_TW + 2, GAL_TH2 + 2, sel ? (blink ? "#ffe040" : "#c89a20") : "#2a1a40");
      const g = ctx.createLinearGradient(0, y, 0, y + GAL_TH2); g.addColorStop(0, sel ? "#3a2a6a" : "#1c1030"); g.addColorStop(1, sel ? "#6a3a5a" : "#120a20"); ctx.fillStyle = g; ctx.fillRect(x, y, GAL_TW, GAL_TH2);
      rect(x, y, GAL_TW, 1, gc);
      if (s.st === 2) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, GAL_TW, GAL_TH2); ctx.clip();
        galThumb(s, sel ? galWalk(s, STATE.t) : s.anim.find((n) => /^idle/i.test(n)) || s.anim[0], x + GAL_TW / 2, y + GAL_TH2 - 12, 36, 1);
        ctx.restore();
      } else ptext(blink ? "..." : "..", x + GAL_TW / 2, y + 20, 1, "#5a4a70");
      if (s.e.lv) ptext(String(s.e.lv), x + 2, y + 5, 1, gc, "left");
      ctx.globalAlpha = 0.8; rect(x, y + GAL_TH2 - 11, GAL_TW, 11, "#05040a"); ctx.globalAlpha = 1;
      const nm = s.e.name; let fs = 6; ctx.font = "bold 6px monospace"; if (ctx.measureText(nm).width > GAL_TW - 2) fs = 5;
      ctx.font = "bold " + fs + "px monospace"; let shown = nm; while (ctx.measureText(shown).width > GAL_TW - 2 && shown.length > 3) shown = shown.slice(0, -1);
      text(shown, x + GAL_TW / 2, y + GAL_TH2 - 5, fs, sel ? "#ffe040" : "#e8e0f0");
    });
    ctx.restore();
    const c = L.tiles[G.cur];
    rect(0, GAL_Y1 + 1, W, H - GAL_Y1 - 1, "#05040a");
    if (L.h > GAL_Y1 - GAL_Y0) { galBtn(GAL_UP, "▲", G.sy > 0); galBtn(GAL_DN, "▼", G.sy < L.h - (GAL_Y1 - GAL_Y0)); }
    if (c) { text(c.s.e.name, 8, GAL_Y1 + 8, 9, "#fff", "left"); ptext(galTag(c.s.e), 8, GAL_Y1 + 17, 1, (GAL_GRP[c.s.e.grp] || GAL_GRP.ENEMY)[1], "left"); }
    ptext("TAP: POSES  ESC: BACK", W - 6, GAL_Y1 + 12, 1, "#ffd27a", "right");
  }
  function galDrawZoom(G, L) {
    const s = G.zs, e = s.e, poses = s.poses || [], p = poses[G.zi % Math.max(1, poses.length)], gc = (GAL_GRP[e.grp] || GAL_GRP.ENEMY)[1];
    galBtn(GAL_BACK, "< BACK", false);
    text(e.name, W / 2, 12, 14, "#fff"); ptext(galTag(e), W / 2, 26, 1, gc);
    // stage floor + spotlight
    const fy = 186, gl = ctx.createRadialGradient(W / 2, fy - 60, 10, W / 2, fy - 60, 140); gl.addColorStop(0, "rgba(255,230,180,0.18)"); gl.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gl; ctx.fillRect(0, 30, W, fy - 30);
    rect(0, fy, W, H - fy, "#1a0e2c"); rect(0, fy, W, 1, gc);
    ctx.globalAlpha = 0.5; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(W / 2, fy, 34, 5, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
    const im = p && (p.im || (G.full && G.full !== "x" ? G.full : null));
    if (p && im) {
      const [x, y, w, h] = p.f, face = e.face || 1;
      let k = 128 / s.idleH; k = Math.min(k, 330 / w, 148 / h);
      const ax = p.f.length > 4 && p.f[4] > 0 && p.f[4] < w ? p.f[4] : w / 2;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.translate(W / 2, fy); if (face < 0) ctx.scale(-1, 1);
      ctx.drawImage(im, x, y, w, h, -ax * k, -h * k, w * k, h * k); ctx.restore();
    } else if (s.th) { ctx.globalAlpha = 0.5; galThumb(s, s.anim[0], W / 2, fy, 150, 1); ctx.globalAlpha = 1; ptext("LOADING...", W / 2, 110, 1, "#ffd27a"); }
    if (p) {
      const lbl = p.n.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/_/g, " ").toUpperCase();
      ptext(lbl, W / 2, fy + 10, 2, "#ffe040");
      ptext((G.zi % poses.length) + 1 + " / " + poses.length, W / 2, fy + 21, 1, "#c8b8e0");
    }
    ptext("<", 20, 110, 3, "#ffe040"); ptext(">", W - 20, 110, 3, "#ffe040");
    ptext("TAP: NEXT POSE", W - 6, fy + 21, 1, "#8a7ab0", "right"); ptext("UP/DOWN: NEXT", 6, fy + 21, 1, "#8a7ab0", "left");
  }
