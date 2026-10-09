// Level 3: SEWER SHOWDOWN. Built only on the public plugin API (window.SS); see ss_level_api.md.
// Glowing green sewer: the back lane is a wading channel (slow + splashes), sludge geysers erupt from floor grates
// (bubbling telegraph), and goons drop out of the wall pipes. Mutant sewer rats (brown dashers with tails) scurry about.
// Boss: GULCH GATOR (painted sheet levels/level3_gator.png), a hulking alligator sewer brute who surfs out of the outflow pipe and sends green-water waves across the floor.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  const WATER = 172;          // y < WATER = wading lane (the glowing channel in the art)
  const TILE = 903;           // strip tile width in world px (2064 * 224 / 512)
  let G = { pw: null, arena: null, geo: null }; // module state, released in onUnload

  // ---- Music: a murky, bouncing sewer groove (E minor, 120 BPM) + a re-keyed boss track ----
  const CH = ["Em", "Em", "C", "B", "Em", "Em", "Am", "B", "Em", "Em", "C", "D", "Am", "C", "B", "B"];
  const R1 = "E4:2 .:1 E4:1 G4:2 .:1 B4:1 A4:2 G4:2 E4:2 .:2";
  const music = A.track({ bpm: 120, loop: true, chords: CH,
    lead: [R1, "E4:2 .:2 D5:2 B4:2 G4:2 A4:2 B4:4", "C5:2 .:1 C5:1 E5:2 G5:2 E5:2 C5:2 .:4", "D#5:3 B4:1 F#4:2 B4:2 D#5:4 .:4",
      R1, "E5:2 D5:2 B4:2 G4:2 A4:2 B4:2 E4:4", "A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:4", "B4:2 D#5:2 F#5:2 B5:2 A5:4 .:4",
      R1, "G5:2 F#5:2 E5:2 B4:2 G4:2 B4:2 E5:4", "E5:2 G5:2 C6:4 B5:2 G5:2 E5:4", "F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4",
      "A5:3 G5:1 E5:2 C5:2 A4:4 .:4", "G5:2 E5:2 C5:2 E5:2 G5:4 .:4", "F#5:2 D#5:2 B4:2 D#5:2 F#5:4 B5:4", "D#6:2 B5:2 F#5:2 D#5:2 B4:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 10]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k..hs..hk.k.s.h.", 15).concat(["k.s.k.s.s.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -1, 168);

  // ---- helpers ----
  const splash = (api, x, y, big) => { // droplets + a ripple ring on the water surface
    api.STATE.fx.push({ kind: "x", x, y, t: 0, life: big ? 30 : 18, big, draw(api, f, sx, k) {
      const c = api.ctx, n = f.big ? 10 : 5, r = (f.big ? 22 : 9) * k;
      c.globalAlpha = 1 - k; c.strokeStyle = "#b8ffc8"; c.lineWidth = 1;
      c.beginPath(); c.ellipse(sx, f.y, 3 + r, 1 + r * 0.3, 0, 0, 6.29); c.stroke();
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / (n - 1))), v = (f.big ? 2.2 : 1.3) * (0.7 + api.hash(i + f.x) * 0.6), tt = f.t;
        const dx = Math.cos(a) * v * tt * 0.7, dy = -Math.sin(a) * v * tt + 0.09 * tt * tt;
        api.rect(sx + dx, f.y + dy - 2, f.big ? 2 : 1, f.big ? 2 : 1, i % 2 ? "#7dff9a" : "#e0ffe6");
      }
      c.globalAlpha = 1;
    } });
  };
  // ---- Painted stage props: levels/level3_props.png (photoreal cutouts on chroma, stored at 3x world size) ----
  // [x, y, w, h] source rects; gameplay/collision never reads these, they only replace the old code-drawn shapes.
  const PR_IMG = "levels/level3_props.png";
  const PR = {"grate":[0,0,84,30],"grateHot":[86,0,84,30],"puddle":[172,0,90,30],"gey0":[264,0,108,270],"gey1":[374,0,108,270],"gey2":[484,0,108,270],"wave0":[594,0,174,121],"wave1":[770,0,174,145],"gush0":[946,0,66,97],"gush1":[0,272,66,92],"tail":[68,272,51,57],"ladder":[121,272,54,450]};
  const prImg = (api) => { const im = api.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; };
  // draw sprite `n` into the world box (x, y, w, h); optional flip (-1), rotation about the box centre, alpha
  function prop(api, n, x, y, w, h, flip, rot, alpha) {
    const im = prImg(api), F = PR[n]; if (!im || !F) return false;
    const c = api.ctx; c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    if (alpha !== undefined) c.globalAlpha *= Math.max(0, Math.min(1, alpha));
    c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); if (flip < 0) c.scale(-1, 1);
    c.drawImage(im, F[0], F[1], F[2], F[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  const wet = (o) => o.y < WATER && (o.z || 0) < 3;
  const okFoe = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);

  // ---- Level-wide hazard: the wading lane (slows everyone who isn't knocked flying) + ripples ----
  const wading = {
    init: () => { G.pw = null; return { n: 0 }; },
    update(st, api, p) {
      if (!p) return;
      const pw = G.pw, free = p.deadT === 0 && p.downT === 0 && p.sinkT === 0 && !p.grabbedBy && p.z === 0;
      if (pw && free && p.y < WATER) {
        const dx = p.x - pw.x, dy = p.y - pw.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          p.x = pw.x + dx * 0.55; p.y = Math.max(api.floorTop, pw.y + dy * 0.7);
          if ((dx || dy) && api.t % 10 === 0) { splash(api, p.x - p.facing * 4, p.y, false); if (api.t % 30 === 0) api.SFX.chat(70, 1, 0.04); }
        }
      }
      G.pw = { x: p.x, y: p.y };
      for (const e of api.enemies) {
        if (e.boss || e._drop) continue;
        if (e._px !== undefined && (e.state === "walk" || e.state === "attack") && wet(e)) {
          const dx = e.x - e._px, dy = e.y - e._py;
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) { e.x = e._px + dx * 0.55; e.y = e._py + dy * 0.7; if ((dx || dy) && (api.t + (e.ring | 0)) % 14 === 0) splash(api, e.x, e.y, false); }
        }
        e._px = e.x; e._py = e.y;
      }
    },
    drawBack(st, api, cx) { // rat tails (brown dashers) drawn under the sprite
      for (const e of api.enemies) { // painted rat tail, rooted at the rump and swishing
        if (e.type !== "dasher" || e.state === "fly" || (api.hasSkin && api.hasSkin(e))) continue; // the painted sewer rat-man has his own tail
        const x = e.x - cx - e.facing * 5, y = e.y - (e.z || 0) - 7, w = Math.sin(api.t * 0.25 + e.ring) * 0.22;
        const c = api.ctx; c.save(); c.translate(x, y); c.rotate(e.facing * (0.6 + w)); // pivot on the tail root (sprite root = its top-right corner)
        prop(api, "tail", e.facing > 0 ? -16 : 0, -1, 16, 18, e.facing); c.restore();
      }
    },
    drawFront(st, api, cx) { // ripples hide the feet of anyone standing in the channel
      const c = api.ctx, list = api.enemies.filter((e) => e.state !== "fly" && e.state !== "dying").concat([api.player]);
      for (const o of list) {
        if (!o || !wet(o) || o.sinkT > 0) continue;
        const x = o.x - cx, y = o.y, big = o.boss ? 1.8 : 1, ph = (api.t * 0.08 + (o.ring || 0)) % 1;
        c.fillStyle = "rgba(70,210,110,0.55)"; c.beginPath(); c.ellipse(x, y, 11 * big, 3 * big, 0, 0, 6.29); c.fill();
        c.strokeStyle = `rgba(200,255,210,${(0.7 * (1 - ph)).toFixed(2)})`; c.lineWidth = 1;
        c.beginPath(); c.ellipse(x, y, (8 + ph * 8) * big, (2 + ph * 2) * big, 0, 0, 6.29); c.stroke();
      }
    },
  };

  // ---- Level-wide hazard: goons drop out of the wall pipes (or the big outflow pipe in the arena) ----
  const pipes = {
    init: (api, S) => ({ list: S.pipes || [], tile: S.pipeTile || 0, gush: [] }),
    update(st, api, p) {
      const cx = api.camX;
      for (const e of api.enemies) {
        if (e._l3 || e.boss) continue;
        e._l3 = 1;
        if (!st.list.length || !api.STATE.locked || Math.random() > (st.tile ? 0.5 : 0.9)) continue;
        const cand = [];
        for (const q of st.list) for (let k = st.tile ? Math.floor((cx - 400) / st.tile) : 0; k <= (st.tile ? Math.floor((cx + 800) / st.tile) : 0); k++) {
          const x = q.x + k * st.tile; if (x > cx + 24 && x < cx + api.W - 24) cand.push({ x, y: q.y });
        }
        if (!cand.length) continue;
        const q = cand[Math.random() * cand.length | 0], y = api.floorTop + 2 + Math.random() * 10;
        e.x = q.x; e.y = y; e.z = Math.max(8, y - q.y - 4); e._vz = 0.6; e._drop = { x: q.x, y }; e.entered = true; e.facing = p.x >= q.x ? 1 : -1;
        st.gush.push({ x: q.x, y: q.y, t: 0 }); api.SFX.chat(60, 2, 0.08);
      }
      for (const e of api.enemies) if (e._drop) {
        e._vz -= 0.3; e.z += e._vz; e.x = e._drop.x; e.y = e._drop.y; e.inv = Math.max(e.inv || 0, 2); e.cool = Math.max(e.cool || 0, 30); e.walkT = 0;
        if (e.state !== "walk" || e.z <= 0) { e.z = 0; e._drop = null; splash(api, e.x, e.y, true); api.SFX.land(); api.dust(e.x, e.y); }
      }
      st.gush = st.gush.filter((g) => ++g.t < 26);
    },
    drawFront(st, api, cx) { // a burst of green water out of the pipe mouth
      const c = api.ctx;
      for (const g of st.gush) { // painted green gush pouring from the pipe mouth (2-frame loop), fading out
        const x = g.x - cx, k = g.t / 26, F = PR[(g.t >> 2) & 1 ? "gush1" : "gush0"], w = 20 - k * 4, h = w * F[3] / F[2];
        if (!prop(api, (g.t >> 2) & 1 ? "gush1" : "gush0", x - w / 2, g.y, w, h, (g.x & 1) ? -1 : 1, 0, 1 - k)) {
          c.globalAlpha = 1 - k; c.fillStyle = "#6af08a"; c.beginPath(); c.ellipse(x, g.y + 6, 9 - k * 4, 6, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
        }
      }
    },
  };

  // ---- Sludge geysers: fixed floor grates (strip) + temporary vents the boss calls up ----
  const IDLE = 190, WARN = 52, BLAST = 38, CYC = IDLE + WARN + BLAST;
  const vent = (x, y, t, temp) => ({ x, y, t, temp, hit: null });
  const geysers = {
    init: (api, S) => { const st = { list: (S.grates || []).map((g, i) => vent(g[0], g[1], (i * 97) % CYC, false)) }; G.geo = st; return st; },
    update(st, api, p) {
      for (const g of st.list) {
        g.t++;
        if (!g.temp) g.t %= CYC; else if (g.t >= CYC) g.dead = true;
        const on = Math.abs(g.x - api.camX - api.W / 2) < api.W / 2 + 30;
        if (g.t === IDLE && on) api.SFX.rumble();
        if (g.t === IDLE + WARN && on) { api.SFX.boom(); api.shake(2, 10, true); }
        if (g.t < IDLE + WARN) { g.hit = null; continue; }
        g.hit = g.hit || new Set();
        if (!g.hit.has(p) && p.deadT === 0 && p.inv === 0 && p.z < 34 && Math.abs(p.x - g.x) < 12 && Math.abs(p.y - g.y) < 7) { g.hit.add(p); api.hurtPlayer(2, false, p.x < g.x ? -1 : 1); }
        for (const e of api.enemies) if (okFoe(e) && !g.hit.has(e) && Math.abs(e.x - g.x) < 12 && Math.abs(e.y - g.y) < 7) { g.hit.add(e); api.hitEnemy(e, 2, true, e.x < g.x ? -1 : 1); }
      }
      st.list = st.list.filter((g) => !g.dead);
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const g of st.list) {
        const x = Math.round(g.x - cx), y = g.y; if (x < -30 || x > api.W + 30) continue;
        const warn = g.t >= IDLE && g.t < IDLE + WARN, hot = g.t >= IDLE;
        if (g.temp && !hot) continue;
        if (!g.temp) { // painted iron grate; glows sludge-green (flashing) while it is about to blow
          prop(api, "grate", x - 14, y - 5, 28, 10);
          if (hot) prop(api, "grateHot", x - 14, y - 5, 28, 10, 1, 0, g.t % 6 < 3 ? 1 : 0.55);
        } else { // bubbling sludge puddle the boss calls up
          prop(api, "puddle", x - 15, y - 5, 30, 10, 1, 0, warn && g.t % 6 < 3 ? 1 : 0.72);
        }
        if (warn) {
          for (let i = 0; i < 4; i++) { const u = ((g.t * 2 + i * 9) % 24) / 24; api.rect(x - 7 + i * 4, y - 2 - u * 14, 2, 2, "#b8ffb0"); }
          if (Math.floor(g.t / 6) % 2) api.ptext("!", x, y - 26, 2, "#ffe060");
        }
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const g of st.list) {
        if (g.t < IDLE + WARN) continue;
        const x = g.x - cx; if (x < -30 || x > api.W + 30) continue;
        const k = (g.t - IDLE - WARN) / BLAST, h = 74 * Math.min(1, k * 5) * (k > 0.75 ? (1 - k) / 0.25 : 1), w = 10 + Math.sin(api.t * 0.7) * 1.5;
        // painted sludge column (3-frame loop): the sprite's spray cap sits at the eruption height h, its splash ring on the grate
        const sh = Math.max(8, h * 1.16), sw = 36 * (w / 10) * Math.min(1, 0.55 + h / 60);
        prop(api, "gey" + (((api.t >> 2) + (g.x | 0)) % 3), x - sw / 2, g.y + 4 - sh, sw, sh, (g.x & 1) ? -1 : 1);
        for (let i = 0; i < 10; i++) { const u = ((api.t * 4 + i * 13) % 40) / 40; api.rect(x + Math.sin(i * 2.3) * (w + u * 14), g.y - h - 2 + u * u * h * 0.6 - (1 - u) * 6, 2, 2, i % 2 ? "#eaffea" : "#8aff9a"); }
      }
    },
  };

  // ---- Arena hazard: the boss's green-water waves (telegraphed lane, then a crest rolling across the floor) ----
  const waves = {
    init: () => { const st = { list: [], tele: [] }; G.arena = st; return st; },
    update(st, api, p) {
      st.tele = st.tele.filter((t) => ++t.t < t.life);
      for (const w of st.list) {
        w.x += w.vx; w.t++;
        if (w.t % 5 === 0) splash(api, w.x, w.y1, false);
        if (!w.hit.has(p) && p.deadT === 0 && p.inv === 0 && p.z < 16 && Math.abs(p.x - w.x) < 11 && p.y >= w.y0 - 3 && p.y <= w.y1 + 3) { w.hit.add(p); api.hurtPlayer(2, false, Math.sign(w.vx)); splash(api, p.x, p.y, true); }
        for (const e of api.enemies) if (okFoe(e) && !w.hit.has(e) && Math.abs(e.x - w.x) < 11 && e.y >= w.y0 - 3 && e.y <= w.y1 + 3) { w.hit.add(e); api.hitEnemy(e, 2, true, Math.sign(w.vx)); }
      }
      st.list = st.list.filter((w) => w.x > api.camX - 40 && w.x < api.camX + api.W + 40);
    },
    drawBack(st, api, cx) { // lane warning: pulsing band + chevrons along the rows the wave will sweep
      const c = api.ctx;
      for (const t of st.tele) {
        const a = 0.12 + 0.12 * (Math.sin(t.t * 0.6) * 0.5 + 0.5);
        c.fillStyle = `rgba(120,255,140,${a.toFixed(3)})`; c.fillRect(0, t.y0 - 2, api.W, t.y1 - t.y0 + 4);
        api.rect(0, t.y0 - 2, api.W, 1, "rgba(200,255,200,0.5)"); api.rect(0, t.y1 + 1, api.W, 1, "rgba(200,255,200,0.5)");
        if (Math.floor(t.t / 4) % 2) continue;
        const yy = Math.round((t.y0 + t.y1) / 2);
        for (let x = (t.t * 2 * t.dir % 32 + 32) % 32 - 16; x < api.W; x += 32) {
          for (let i = 0; i < 4; i++) { api.rect(x + (t.dir > 0 ? i : 3 - i), yy - 4 + i, 2, 1, "#d8ffc8"); api.rect(x + (t.dir > 0 ? i : 3 - i), yy + 3 - i, 2, 1, "#d8ffc8"); }
        }
      }
    },
    drawFront(st, api, cx) { // a rolling crest: one curling slice per depth row, trailing a foamy sheet of water
      const c = api.ctx;
      for (const w of st.list) {
        const x = w.x - cx, d = Math.sign(w.vx);
        c.fillStyle = "rgba(80,220,110,0.28)"; c.fillRect(Math.min(x, x - d * 46), w.y0 - 2, 46, w.y1 - w.y0 + 4);
        // painted curling crest, one per depth row back to front, so the wave fills its whole lane band
        for (let i = 0; i < 3; i++) {
          const y = w.y0 + (w.y1 - w.y0) * (i + 0.5) / 3 + 3, fr = (((api.t >> 3) + i) & 1) ? "wave1" : "wave0", F = PR[fr];
          const hh = (fr === "wave1" ? 38 : 32) + Math.sin(api.t * 0.45 + i * 1.7) * 2, ww = hh * F[2] / F[3], xo = x + d * (i === 1 ? 3 : 0);
          prop(api, fr, d > 0 ? xo + 10 - ww : xo - 10, y + 3 - hh, ww, hh, d);
        }
        for (let i = 0; i < 10; i++) { const u = ((api.t * 2 + i * 9) % 30) / 30; api.rect(x + d * (6 + u * 10), w.y0 - 20 + u * 14 + (i % 4) * 6, 2, 2, i % 2 ? "#ffffff" : "#b8ffc0"); }
      }
    },
  };

  // ---- Boss: GULCH GATOR (ramrod behaviour base, painted gator sheet, custom moves on top: surf entrance, tidal wave, sludge vents) ----
  const PIPE_X = 226, PIPE_Y = 112;
  const sendWave = (api, e, band, dir) => {
    const ft = api.floorTop, fb = api.floorBot, mid = Math.round((ft + fb) / 2);
    const y0 = band ? mid : ft, y1 = band ? fb : mid;
    G.arena && G.arena.list.push({ x: e.x + dir * 16, y0, y1, vx: dir * 3.1, t: 0, hit: new Set() });
  };
  const teleWave = (api, band, dir, life) => {
    const ft = api.floorTop, fb = api.floorBot, mid = Math.round((ft + fb) / 2);
    G.arena && G.arena.tele.push({ y0: band ? mid : ft, y1: band ? fb : mid, dir, t: 0, life });
  };
  // ---- GULCH GATOR: painted sprite sheet levels/level3_gator.png (photoreal live-action cutouts, like the turtles) ----
  // Frames face right, feet on the frame bottom, [x, y, w, h, anchorX] with anchorX = stance/hip centre so poses don't slide.
  // Drawn at GT_K: the 200 px idle frame is 100 world px tall (same size as the old brute body).
  const GT_IMG = "levels/level3_gator.png", GT_K = 0.5;
  const GTF = {idle: [0,  7,  137,  200,  64], walk1: [141,  0,  151,  207,  84], walk2: [296,  3,  159,  204,  90], wind: [459,  4,  180,  203,  97], punch: [643,  5,  231,  202,  92], tele: [878,  65,  213,  142,  131], charge: [1095,  38,  200,  169,  69], throw: [1299,  1,  162,  206,  92], wave: [1465,  2,  174,  205,  93], stomp: [1643,  13,  155,  194,  66], hurt: [1802,  15,  140,  192,  56], fall: [1946,  47,  155,  160,  84], down: [2105,  146,  200,  61,  100], summon: [2309,  17,  161,  190,  76], leap: [2474,  29,  129,  178,  76], surf: [2607,  3,  208,  204,  107], land: [2819,  67,  211,  140,  114], getup: [3034,  46,  179,  161,  117]};
  const GT_WALK = ["walk1", "idle", "walk2", "idle"];
  const FX_SHEETS = {};
  function fxSheet(kind) { // red-washed (telegraph) or white (hit flash) copy of the sheet; works without ctx.filter
    if (FX_SHEETS[kind]) return FX_SHEETS[kind];
    const im = A.img(GT_IMG); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop";
    c.fillStyle = kind === "red" ? "rgba(255,40,30,0.62)" : "rgba(255,255,255,0.92)"; c.fillRect(0, 0, cv.width, cv.height);
    return (FX_SHEETS[kind] = cv);
  }
  function gatorFrame(e) {
    const s = e.state, t = e.t, mt = e.mt | 0;
    if (s === "dying") return t < 18 ? "fall" : "down";
    if (s === "down") return t < 10 ? "fall" : "down";
    if (s === "getup") return t < 10 ? "down" : "getup";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "tele") return "tele";
    if (s === "charge") return "charge";
    if (s === "kwind") return "wind";
    if (s === "kick") return "punch";
    if (s === "slam") return t < 14 ? "tele" : t < 44 ? "leap" : "land";
    if (s === "summon") return "summon";
    if (s === "throw") {
      if (e.mv === "surf") return mt < 70 ? "surf" : mt < 86 ? "land" : "idle";
      if (e.mv === "wave") return mt < 46 ? "wave" : mt < 62 ? "land" : e.p2 && mt < 82 ? "wave" : e.p2 && mt < 100 ? "land" : "idle";
      if (e.mv === "vents") return mt < 14 ? "stomp" : "idle";
      const n = boss.throwN || 1; // plain sludge lob: glob raised, then a forward release on each throw (t = 14 + 12i)
      if (t < 14) return "throw";
      if (t >= 14 + n * 12) return "idle";
      return (t - 14) % 12 < 5 ? "punch" : "throw";
    }
    if (s === "fire") return "throw";
    if ((s === "walk" || s === "enter") && e.walkT > 0) return GT_WALK[Math.floor(e.walkT / 9) % 4];
    return "idle";
  }
  // ---- Boss entrance (entr v1): the gator surfaces out of the glowing channel, then belly-flops into the arena ----
  const GT_ENTR = {
    len: 175, zoom: 1.3, sub: "KING OF THE SEWER",
    setup(api, e, st) { st.wx = api.camX + api.W / 2 + 70; st.wy = api.floorTop + 3; Object.assign(e, { x: st.wx, y: st.wy, z: -96, facing: -1, state: "throw", mv: "surf", mt: 10, t: 20, entrClip: st.wy + 1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: t < 70 ? st.wy - 40 : e.y - e.z - 46 }),
    step(api, e, st, t) {
      if (t < 24) { if (t % 4 === 0) splash(api, st.wx + api.rnd(-16, 16), st.wy, false); if (t % 8 === 0) api.shake(1, 6, false); return; }
      if (t === 24) { api.SFX.boom(); splash(api, st.wx, st.wy, true); splash(api, st.wx - 14, st.wy + 2, true); api.shake(3, 14, true); }
      if (t < 70) { e.z = Math.min(0, -96 + (t - 24) * 2.6); e.entrClip = st.wy + 1; if (t % 5 === 0) splash(api, e.x + api.rnd(-14, 14), st.wy, t % 10 === 0); return; }
      if (t === 70) { e.z = 0; e.entrClip = undefined; api.SFX.jump(); st.y0 = e.y; }
      if (t >= 70 && t <= 104) { const k = (t - 70) / 34; e.x = api.lerp(st.wx, api.camX + api.W / 2, k); e.y = api.lerp(st.y0, (api.floorTop + api.floorBot) / 2, k); e.z = Math.sin(k * Math.PI) * 52; e.state = "slam"; e.t = 30; if (t % 3 === 0) splash(api, e.x + api.rnd(-10, 10), e.y - e.z * 0.3, false); }
      if (t === 104) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); splash(api, e.x - 18, e.y, true); splash(api, e.x + 18, e.y, true); api.entr.debris(e.x, e.y, 2, 6, { colors: ["#3ae06a", "#2a8a3a", "#5a4a3a"] }); }
      if (t > 104 && t < 124) { e.state = "slam"; e.t = 50; }
      if (t >= 124) { e.state = "summon"; e.t = 2; }
    },
    finish(api, e) { e.mv = null; e.mt = 0; },
  };
  const boss = {
    name: "GULCH GATOR", base: "ramrod", // ramrod behaviours (charge / kick / throw / slam / summon); art is the painted gator sheet
    height: 104, hp: 38, speed: 0.95, chargeSpeed: 1.1, cool: 100, pitch: 72,
    moves: ["charge", "kick", "throw", "slam", "summon"], proj: "sludge", throwN: 3,
    minions: ["dasher", "dasher"], summonCd: 720,
    lines: { intro: "SURF'S UP, SHELLBACKS! THIS IS MY SWAMP!", hit: ["HEY! WATCH THE SCALES!", "THAT ALL YOU GOT, SHELL-SNACK?", "GRRR... I'LL CHOMP YA!"], summon: "RATS! FRESH MEAT!", ko: "GLUB... I'M... GOIN' DOWN THE DRAIN..." },
    draw(api, e, sx, sy) { // painted gator sheet, level15 spr() anchor pattern (hip centre on sx)
      const fr = gatorFrame(e), F = GTF[fr] || GTF.idle;
      const red = (e.state === "tele" && e.t % 6 < 3) || (e.state === "slam" && e.t < 14 && e.t % 6 < 3) || (e.state === "throw" && !e.mv && e.t < 14 && e.t % 6 < 3) ||
        (e.mv === "wave" && e.mt < 46 && e.mt % 8 < 4) || (e.mv === "vents" && e.mt < 14 && e.mt % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3);
      const white = e.flash > 0 && e.flash % 2 === 1;
      const im = white ? fxSheet("white") || api.img(GT_IMG) : red ? fxSheet("red") || api.img(GT_IMG) : api.img(GT_IMG);
      const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
      if (!im || (im.complete === false) || im.naturalWidth === 0) { api.rect(sx - 14, sy - 100, 28, 100, "#33481a"); return; }
      api.drawFrame(im, F, sx + jx + (F[2] / 2 - F[4]) * GT_K * e.facing, sy, GT_K, e.facing);
    },
    entrance: GT_ENTR,
    spawn(api, e) { // surf out of the outflow pipe instead of walking in
      e.state = "throw"; e.mv = "surf"; e.mt = 0; e.x = api.camX + PIPE_X; e.y = api.floorTop; e.z = 44; e.facing = -1;
      api.SFX.rumble(); api.shake(3, 40, true);
    },
    update(api, e, p) {
      if (e.state !== "throw") e.mv = null;
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "throw" && e.mv) {
        e.mt++; e.t = 20; // keep the engine's throw red-flash off; our own timer drives the move
        const t = e.mt, ft = api.floorTop, mid = Math.round((ft + api.floorBot) / 2);
        if (e.mv === "surf") {
          e.inv = 3; const k = Math.min(1, t / 70);
          e.x = api.camX + PIPE_X - k * 20; e.y = api.lerp(ft, mid - 2, k); e.z = 44 * (1 - k) + Math.sin(k * Math.PI) * 18;
          if (t % 6 === 0) splash(api, e.x + api.rnd(-14, 14), Math.min(e.y + 2, WATER - 1), t % 12 === 0);
          if (t === 70) { e.z = 0; api.SFX.boom(); api.shake(4, 18, true); splash(api, e.x, e.y, true); splash(api, e.x - 20, e.y + 4, true); splash(api, e.x + 20, e.y - 2, true); api.STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 18 }); }
          if (t === 128) api.enemySay(e, boss.lines.intro, 120, boss.pitch, true);
          if (t >= 150) { e.state = "walk"; e.mv = null; e.t = 0; e.cool = 70; }
          return true;
        }
        if (e.mv === "wave") { // raise the water: 46-frame lane telegraph, then a crest (two in phase 2)
          if (t === 1) {
            e.facing = p.x >= e.x ? 1 : -1; e.band = p.y >= mid ? 1 : 0; e.p2 = e.hp < e.maxHp * 0.5;
            teleWave(api, e.band, e.facing, 46); api.SFX.rumble(); if (Math.random() < 0.5) api.enemySay(e, "HERE COMES THE TIDE!", 60, boss.pitch);
            if (e.p2) teleWave(api, 1 - e.band, e.facing, 82);
          }
          if (t % 8 === 0 && t < 46) splash(api, e.x + e.facing * 10, e.y, false);
          if (t === 46) { sendWave(api, e, e.band, e.facing); api.SFX.boom(); api.shake(3, 12, true); splash(api, e.x + e.facing * 14, e.y, true); }
          if (e.p2 && t === 82) { sendWave(api, e, 1 - e.band, e.facing); api.SFX.boom(); splash(api, e.x + e.facing * 14, e.y, true); }
          if (t >= (e.p2 ? 100 : 66)) { e.state = "walk"; e.mv = null; e.t = 0; }
          return true;
        }
        if (e.mv === "vents") { // stomp: sludge vents bubble up under and around the player, then erupt
          if (t === 1) { api.enemySay(e, "FEEL THE BUBBLES!", 60, boss.pitch); }
          if (t === 14 && G.geo) {
            api.SFX.land(); api.shake(3, 10, true); api.dust(e.x, e.y);
            const n = e.hp < e.maxHp * 0.5 ? 4 : 3, cl = (y) => Math.max(api.floorTop + 2, Math.min(api.floorBot - 2, y));
            for (let i = 0; i < n; i++) {
              const x = Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x + (i ? (i % 2 ? -1 : 1) * (30 + (i > 2 ? 30 : 0)) : 0)));
              G.geo.list.push(vent(x, cl(p.y + (i ? api.rnd(-14, 14) : 0)), IDLE - i * 6, true));
            }
          }
          if (t >= 44) { e.state = "walk"; e.mv = null; e.t = 0; }
          return true;
        }
        return false;
      }
      if (e.state === "walk" && e.cool <= 1 && free && Math.random() < 0.55) {
        e.state = "throw"; e.mv = Math.random() < 0.6 ? "wave" : "vents"; e.mt = 0; e.t = 20;
        e.cool = boss.cool + (Math.random() * 20 | 0); return true;
      }
      return false;
    },
    onDefeat(api, e) { splash(api, e.x, e.y, true); if (G.arena) { G.arena.list.length = 0; G.arena.tele.length = 0; } if (G.geo) G.geo.list = G.geo.list.filter((g) => !g.temp); },
  };

  SS.registerLevel({
    number: 3,
    name: "SEWER SHOWDOWN",
    card: { title: "SEWER SHOWDOWN", tagline: "HOLD YOUR NOSE. HOLD YOUR GROUND.", color: "#3ae06a" },
    music, bossMusic,
    // painted regular enemies (sewer family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_sewer.png", ENEMY_F = { light: {"idle":[4,0,97,165,41],"walk":[105,0,101,165,53],"walk2":[210,2,109,163,55],"attack":[323,44,152,121,75],"jump":[479,26,104,139,49],"hurt":[587,22,97,143,61],"down":[688,114,192,51,96],"dash":[884,94,186,71,103]}, weapon: {"idle":[4,169,103,165,49],"walk":[111,169,89,165,45],"walk2":[204,172,84,162,38],"attack":[292,179,135,155,58],"jump":[431,191,135,143,57],"hurt":[570,192,83,142,42],"down":[657,292,186,42,93],"throw":[847,249,150,85,101],"grab":[1001,246,157,88,88]}, big: {"idle":[4,338,104,165,46],"walk":[112,338,90,165,48],"walk2":[206,342,96,161,51],"attack":[306,344,144,159,52],"hurt":[454,359,84,144,42],"shoot":[542,348,209,155,50],"down":[755,459,189,44,94]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 75, blue: 150, sword: 200, star: 45, dasher: 15, heavy: 95, gunner: 110 },
    hazards: [wading, pipes],
    sections: [{
      bg: "levels/level3_sewer.jpg", floor: [154, 218], length: 2240,
      locks: [300, 900, 1560],
      waves: [["dasher", "purple", "dasher", "blue"], ["purple", "star", "heavy", "dasher", "blue"], ["sword", "dasher", "gunner", "heavy", "dasher", "purple"]],
      grade: "rgba(10,40,20,0.10)", weather: "drips",
      pipes: [{ x: 235, y: 108 }, { x: 742, y: 124 }], pipeTile: TILE,
      grates: [[470, 196], [760, 208], [1120, 190], [1330, 206], [1700, 194], [1960, 207]],
      hazards: [geysers],
    }, {
      bg: "levels/level3_sewer_boss.jpg", floor: [154, 218], length: 384,
      locks: [0], waves: [["dasher", "dasher", "purple"]],
      grade: "rgba(10,40,20,0.08)", weather: "drips",
      pipes: [{ x: PIPE_X, y: PIPE_Y }], pipeTile: 0,
      grates: [],
      hazards: [geysers, waves],
      onUpdate(api) { if (api.STATE.phase === "boss") api.STATE.goT = 0; },
    }],
    restructure: { // phase 2: tunnels (zone 1) -> flood chase (twist) -> pump station (zone 2) -> existing boss chamber
      split: 0, images: ["levels/level3_twist.png", "levels/level3_pumpstation.jpg"],
      tsec: { length: 1500, hazards: [] },
      twist: { kind: "chase", goal: "reach", title: "THE SLUICE GATE BURST!", sub: "OUTRUN THE FLOOD - GET TO THE LADDER", img: "levels/level3_twist.png", fr: {"wave": [0, 0, 768, 191], "gateShut": [771, 0, 220, 175], "gush": [0, 194, 260, 64], "frame": [263, 194, 220, 162], "raft": [486, 194, 100, 50], "drum": [589, 194, 40, 62], "ladder": [632, 194, 50, 160]},
        speed: 1.25, start: "frame", end: "ladder", crest: "wave", color: "#2f7a3a",
        floaters: [{ spr: "raft", x: 420, y: 200 }, { spr: "drum", x: 760, y: 176 }, { spr: "raft", x: 1100, y: 190 }],
        drip: ["dasher", "purple"], gap: 210, cap: 2, from: "right" },
      z2bg: "levels/level3_pumpstation.jpg", z2waves: [["sword", "dasher", "gunner", "purple"], ["heavy", "dasher", "star", "sword", "purple"]],
    },
    boss,
    images: [GT_IMG, PR_IMG],
    outro: { // a shaft of daylight from a manhole up top: next stop, the highway
      update(api, st, t) {
        const p = api.player;
        if (t === 20) api.playerBark(true, "PHEW! FRESH AIR UP THAT LADDER...");
        if (t === 110) api.playerBark(true, "THAT'S THE HIGHWAY! GRAB A BOARD!");
        if (t > 40 && p && t < 150) { p.x += Math.sign(api.camX + 300 - p.x) * Math.min(1.2, Math.abs(api.camX + 300 - p.x)); p.walkT = Math.abs(api.camX + 300 - p.x) > 1 ? p.walkT + 1 : 0; p.facing = 1; }
        return t > 210;
      },
      draw(api, st, t, cx) {
        const c = api.ctx, a = Math.min(1, t / 40) * 0.35, x = 300;
        const g = c.createLinearGradient(0, 0, 0, api.floorBot);
        g.addColorStop(0, `rgba(255,240,180,${a})`); g.addColorStop(1, "rgba(255,240,180,0)");
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 10, 0); c.lineTo(x + 10, 0); c.lineTo(x + 30, api.floorBot); c.lineTo(x - 30, api.floorBot); c.closePath(); c.fill();
        if (!prop(api, "ladder", x - 9, 0, 18, 150)) for (let y = 0; y < 150; y += 10) { api.rect(x - 8, y, 2, 10, "#5a5048"); api.rect(x + 6, y, 2, 10, "#5a5048"); api.rect(x - 8, y + 4, 16, 2, "#7a6e60"); }
        if (t > 120 && Math.floor(t / 15) % 2) api.ptext("NEXT: THE HIGHWAY", api.W / 2, 30, 2, "#ffe060");
      },
    },
    onUnload() { for (const k in FX_SHEETS) delete FX_SHEETS[k]; G.pw = G.arena = G.geo = null; G = { pw: null, arena: null, geo: null }; boss.spawn = boss.update = boss.onDefeat = null; wading.init = pipes.init = geysers.init = waves.init = null; },
  });
})();
