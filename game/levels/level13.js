// Level 13: DIMENSION X. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Act IV opener. The brothers come out of the time rift into Dimension X: an alien low-gravity world
// (floatier jumps, done in a hook), toxic acid pools that erupt, toxic chasms across the back lanes,
// crystal meteors, rock soldiers marching out of stone bunkers and alien troopers.
// Boss: GENERAL TRAAG & LIEUTENANT GRANITOR. Traag fights first while Granitor works the artillery cannon
// (target-marker barrages); at half health they tag-team swap: Granitor jumps in (ground-pound chains,
// rock throws) and Traag takes the cannon. Outro: a portal home, and the Technodrome phases into Earth.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level13_dimx.jpg", BG2 = "levels/level13_dimx_boss.jpg", EARTH = "levels/level13_earth.jpg";
  const TRS = "levels/level13_traag.png", GRS = "levels/level13_granitor.png";
  // Painted stage props (levels/level13_props.png, keyed from chroma-green photoreal renders): acid pool, blast crater,
  // portal, crystal meteor, hazard post, artillery shell; levels/level13_chasm.jpg = rock-walled toxic chasm texture
  // (clipped into the crack shape). Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level13_props.png", CHASM_IMG = "levels/level13_chasm.jpg";
  const PF = { pool: [0, 0, 160, 46], crater: [163, 0, 96, 33], portal: [262, 0, 120, 239], crys: [385, 0, 40, 56], post: [428, 0, 30, 146], shell: [461, 0, 36, 8] };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function pspr(f, x, y, w, h, rot, flip) { // draw a props-sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null;   // module state for the current section (reset on every section entry), cleared on unload
  let RED = {};   // cached red-flash silhouettes of the boss sheets
  const fresh = () => ({ marks: [], craters: [], rings: [], rocks: [], hint: 0, told: {}, partner: { who: "granitor", st: "idle", t: 0, fireT: 0 }, pSay: null, barCd: 420, door: null });

  // ---- Music: an original eerie D-minor pulse (126 BPM) + the engine boss track re-keyed ----
  const CH = ["Dm", "Dm", "F", "C", "Dm", "Dm", "Am", "E", "Dm", "F", "G", "Am", "Dm", "C", "E", "E"];
  const music = A.track({ bpm: 126, loop: true, chords: CH,
    lead: ["D5:2 .:2 A5:2 F5:2 E5:4 D5:4", "D5:2 F5:2 A5:2 D6:2 C6:4 A5:4", "F5:3 .:1 A5:2 C6:2 F6:4 E6:4", "E6:2 C6:2 G5:2 E5:2 G5:8",
      "D5:2 .:2 A5:2 F5:2 E5:4 D5:4", "A5:2 D6:2 F6:4 E6:2 D6:2 A5:4", "C6:2 A5:2 E5:4 A5:4 .:4", "G#5:4 B5:4 E6:4 .:4",
      "D6:3 .:1 A5:2 F5:2 D5:4 F5:4", "F5:2 A5:2 C6:4 A5:2 F5:2 C5:4", "G5:2 B5:2 D6:4 B5:2 G5:2 D5:4", "A5:2 C6:2 E6:4 .:8",
      "F6:2 E6:2 D6:2 A5:2 F5:4 D5:4", "E5:2 G5:2 C6:4 G5:2 E5:2 C5:4", "B4:2 E5:2 G#5:4 B5:4 E6:4", "E6:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k..hs.h.k.khs.h.", 15).concat(["k.s.k.s.ssssss.o"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -1, 176);

  // ---- helpers ----
  const onScr = (api, x, pad) => x - api.camX > -pad && x - api.camX < api.W + pad;
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const blink = (t, n) => Math.floor(t / (n || 6)) % 2 === 1;
  function spawnAt(api, type, x, y) { // API v1 has no spawn-at-position: spawn, then move the new enemy
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1];
    if (e && e.type === type && !e.boss) { e.x = x; e.y = y; e.facing = api.player && api.player.x < x ? -1 : 1; return e; }
    return null;
  }

  // ================= LEVEL-WIDE: LOW GRAVITY =================
  // The engine pulls airborne actors down by 0.25/frame. Dimension X gives some of it back (net 0.15),
  // so jumps float ~1.6x longer and higher. Bosses run their own arcs and are skipped.
  const LOWG = 0.1;
  const gravity = {
    init: () => ({ t: 0 }),
    update(st, api, p) {
      st.t++;
      if (p && p.z > 0 && p.deadT === 0 && !(p.sinkT > 0)) p.vz += LOWG;
      for (const e of api.enemies) if (!e.boss && e.z > 0 && e.state !== "dying") e.vz = (e.vz || 0) + LOWG;
      if (st.t === 50 && api.STATE.sec === 0) api.playerBark(true, "WHOA... I FEEL LIGHTER!");
    },
    drawFront(st, api) {
      if (api.STATE.sec !== 0 || st.t > 260 || st.t < 20) return;
      if (blink(st.t, 10) || st.t > 200) api.ptext("LOW GRAVITY: JUMPS FLOAT FARTHER!", api.W / 2, 40, 1, "#9affe0");
    },
  };

  // ================= SECTION 1 HAZARDS =================
  // Acid pools: always visible and bubbling; step in and you sink (pit). Every few seconds a pool
  // churns (fast bubbles + "!") for 50 frames, then erupts a column of acid that hits everyone near it.
  const P_IDLE = 250, P_WARN = 52, P_ERUPT = 40, P_CYC = P_IDLE + P_WARN + P_ERUPT;
  const POOLS = [[430, 181, 22, 6, 0], [830, 168, 18, 5, 120], [1190, 186, 24, 6, 60], [1560, 175, 20, 5, 200], [2130, 183, 22, 6, 30], [2400, 168, 19, 5, 160]];
  const inPool = (q, x, y, pad) => ((x - q.x) / (q.rx + pad)) ** 2 + ((y - q.y) / (q.ry + pad * 0.4)) ** 2 < 1;
  const acid = {
    init: () => ({ list: POOLS.map(([x, y, rx, ry, t]) => ({ x, y, rx, ry, t })) }),
    update(st, api, p) {
      if (!G) G = fresh();
      for (const q of st.list) {
        q.t = (q.t + 1) % P_CYC;
        if (q.t === P_IDLE && onScr(api, q.x, 0)) api.SFX.rumble();
        if (q.t === P_IDLE + P_WARN && onScr(api, q.x, 0)) { api.SFX.boom(); api.shake(1, 6, true); }
        if (p && p.z <= 0 && inPool(q, p.x, p.y, -3)) {
          if (api.dropPlayer(p.x, p.y, 1)) { api.fx("smoke", p.x, p.y - 6, 18); if (!G.told.pool) { G.told.pool = 1; api.playerBark(true, "YEOW! THAT ACID BURNS!"); } }
        }
        const erupt = q.t >= P_IDLE + P_WARN;
        if (!erupt) { q.hit = null; } else {
          q.hit = q.hit || new Set();
          if (canHurt(p) && !q.hit.has(p) && inPool(q, p.x, p.y, 9) && p.z < 52) { q.hit.add(p); api.hurtPlayer(1, false, p.x < q.x ? -1 : 1); }
        }
        for (const e of api.enemies) {
          if (!hittable(e) || e.z > 2) continue;
          if (erupt && q.hit && !q.hit.has(e) && inPool(q, e.x, e.y, 9)) { q.hit.add(e); api.hitEnemy(e, 2, true, e.x < q.x ? -1 : 1); }
          else if (inPool(q, e.x, e.y, -3) && !(e.acidCd > api.t)) { e.acidCd = api.t + 70; api.hitEnemy(e, 1, true, e.x < q.x ? -1 : 1); api.fx("smoke", e.x, e.y - 6, 14); }
        }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, t = api.t;
      for (const q of st.list) {
        const x = q.x - cx, y = q.y; if (x < -40 || x > api.W + 40) continue;
        const warn = q.t >= P_IDLE && q.t < P_IDLE + P_WARN, erupt = q.t >= P_IDLE + P_WARN;
        if (pspr(PF.pool, x, y + 0.5, (q.rx + 4) * 2, (q.ry + 3) * 2)) { // painted acid pool; churn = flashing hot surface
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = warn ? (t % 6 < 3 ? 0.6 : 0.3) : 0.22; c.fillStyle = "#6aff3a"; c.beginPath(); c.ellipse(x, y - 0.5, q.rx - 3, q.ry - 1.6, 0, 0, 6.29); c.fill(); c.restore();
        } else {
        c.fillStyle = "#3a2c4a"; c.beginPath(); c.ellipse(x, y + 1, q.rx + 3, q.ry + 2, 0, 0, 6.29); c.fill();       // rock rim
        c.fillStyle = "#1a5a10"; c.beginPath(); c.ellipse(x, y, q.rx, q.ry, 0, 0, 6.29); c.fill();
        c.fillStyle = warn && t % 6 < 3 ? "#d8ff5a" : "#7aff2a"; c.beginPath(); c.ellipse(x, y - 0.5, q.rx - 3, q.ry - 1.6, 0, 0, 6.29); c.fill();
        }
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = warn || erupt ? 0.75 : 0.4; glow(c, x, y, q.rx + 12, "rgba(120,255,60,0.8)"); c.restore();
        const nb = warn ? 6 : 2; // bubbles
        for (let i = 0; i < nb; i++) { const k = ((t * (warn ? 0.09 : 0.03) + i * 0.37) % 1); const bx = x + Math.sin(i * 2.3 + q.x) * (q.rx - 6), by = y + Math.cos(i * 1.7) * (q.ry - 2); c.fillStyle = "rgba(220,255,160,0.9)"; c.beginPath(); c.arc(bx, by - k * 3, 0.8 + k * 1.6, 0, 6.29); c.fill(); }
        if (warn && blink(q.t)) api.ptext("!", x, y - 22, 2, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const q of st.list) {
        if (q.t < P_IDLE + P_WARN) continue;
        const x = q.x - cx; if (x < -40 || x > api.W + 40) continue;
        const k = (q.t - P_IDLE - P_WARN) / P_ERUPT, h = 64 * Math.min(1, k * 5) * (k > 0.75 ? (1 - k) / 0.25 : 1);
        c.save(); c.globalCompositeOperation = "lighter";
        const g = c.createLinearGradient(0, q.y, 0, q.y - h); g.addColorStop(0, "rgba(160,255,80,0.9)"); g.addColorStop(1, "rgba(80,255,120,0)");
        c.fillStyle = g; c.beginPath(); c.moveTo(x - q.rx * 0.6, q.y); c.lineTo(x - q.rx * 0.9, q.y - h); c.lineTo(x + q.rx * 0.9, q.y - h); c.lineTo(x + q.rx * 0.6, q.y); c.closePath(); c.fill();
        c.restore();
        for (let i = 0; i < 8; i++) { const u = ((api.t * 2 + i * 11) % 50) / 50; api.rect(x + Math.sin(i * 3.1 + api.t * 0.2) * (4 + u * q.rx), q.y - u * h, 2, 2, i % 2 ? "#d8ff7a" : "#5aff3a"); }
      }
    },
  };

  // Toxic chasms: a crack across the BACK lanes, glowing green at the bottom with rising fumes. Hazard posts
  // flash "!" as you approach. Walk in and you fall (pit, 2 dmg, you climb out onto the front lane); jump it or go
  // around the front. Walking enemies skirt it; enemies knocked into it fall in (instant KO).
  const CHASMS = [{ x0: 950, x1: 1050 }, { x0: 1700, x1: 1815 }];
  const chasmDepth = (api) => api.floorTop + 22;
  const inChasm = (api, C, x, y) => x > C.x0 + 4 && x < C.x1 - 4 && y < chasmDepth(api) - 1;
  const chasm = {
    init: () => ({ list: CHASMS.map((C) => Object.assign({ fall: false }, C)) }),
    update(st, api, p) {
      if (!G) G = fresh();
      const yb = chasmDepth(api);
      for (const C of st.list) {
        if (p && !G.told["ch" + C.x0] && p.x > C.x0 - 110 && p.x < C.x0) { G.told["ch" + C.x0] = 1; if (!G.told.chasm) { G.told.chasm = 1; api.playerBark(true, "TOXIC CHASM! JUMP IT OR GO AROUND!"); } }
        if (p && p.z <= 0 && !(p.sinkT > 0) && p.deadT === 0 && inChasm(api, C, p.x, p.y)) {
          if (api.dropPlayer(p.x, p.y, 2)) { C.fall = true; api.fx("smoke", p.x, p.y - 4, 22); }
          else if (!(p.downT > 0)) p.y = yb + 1; // can't fall right now (i-frames): step back onto solid rock
        }
        if (C.fall && p.sinkT === 1) { p.y = yb + 6; C.fall = false; } // climb out on the front lane
        if (C.fall && !(p.sinkT > 0)) C.fall = false;
        for (const e of api.enemies) {
          if (e.boss || e.state === "dying" || e.state === "fly") continue;
          if (!inChasm(api, C, e.x, e.y)) continue;
          if (e.state === "down" && e.z <= 0.5) { api.koEnemy(e); api.fx("smoke", e.x, e.y - 4, 20); api.SFX.defeat && api.SFX.defeat(); if (!G.told.ko) { G.told.ko = 1; api.enemySay(e, "AIEEEE!", 50, 160); } }
          else if (e.state === "walk" || e.state === "attack" || e.state === "hurt") e.y = yb + 1;
        }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, top = api.floorTop - 13, yb = chasmDepth(api), p = api.player;
      for (const C of st.list) {
        const x0 = C.x0 - cx, x1 = C.x1 - cx; if (x1 < -30 || x0 > api.W + 30) continue;
        // meandering crack: jagged slanted sides, dark depths with a sickly glow far below, lit rock lips
        const L = [], R = [], n = 7;
        for (let i = 0; i <= n; i++) { const u = i / n, y = top + u * (yb - top) + (i === 0 ? 0 : 0); L.push([x0 + 22 * (1 - u) + ((i * 7 + C.x0) % 5) - 2, y]); R.push([x1 - 18 * (1 - u) + ((i * 5 + C.x1) % 6) - 3, y]); }
        c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); for (let i = n; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); for (let x = R[0][0] - 6; x > L[0][0] + 3; x -= 7) c.lineTo(x, top + ((x * 13 | 0) % 4)); c.closePath();
        const g = c.createLinearGradient(0, top, 0, yb); g.addColorStop(0, "#6a5a86"); g.addColorStop(0.18, "#3a2c50"); g.addColorStop(0.55, "#120a1c"); g.addColorStop(1, "#0a1806");
        c.fillStyle = g; c.fill();
        const cim = A.img(CHASM_IMG);
        if (ready(cim)) { c.save(); c.clip(); c.drawImage(cim, x0 - 4, top - 2, x1 - x0 + 8, yb - top + 6); c.restore(); } // painted rock walls + toxic glow
        c.save(); c.clip(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.28 + 0.1 * Math.sin(api.t * 0.07);
        glow(c, (x0 + x1) / 2, yb + 10, (x1 - x0) * 0.45, "rgba(90,255,60,0.9)"); c.restore();
        c.lineWidth = 1.5; c.strokeStyle = "#b8a8d8"; // lit rims on the sides
        c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
        c.beginPath(); R.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
        c.lineWidth = 3; c.strokeStyle = "#cbbbe8"; c.beginPath(); c.moveTo(L[n][0] - 2, yb); for (let x = L[n][0]; x < R[n][0]; x += 6) c.lineTo(x + 3, yb + ((x | 0) % 3 === 0 ? 1 : 0)); c.lineTo(R[n][0] + 2, yb); c.stroke(); // front lip
        c.lineWidth = 1; c.strokeStyle = "rgba(160,255,90,0.55)"; c.beginPath(); c.moveTo(L[n][0], yb - 2); c.lineTo(R[n][0], yb - 2); c.stroke();
        // fumes
        c.globalAlpha = 0.35;
        for (let i = 0; i < 6; i++) { const u = ((api.t * 0.6 + i * 17) % 60) / 60, fx = x0 + 10 + ((i * 37) % Math.max(10, x1 - x0 - 20)); c.fillStyle = "#8aff5a"; c.beginPath(); c.arc(fx + Math.sin(u * 6 + i) * 4, yb - 4 - u * 40, 2 + u * 5, 0, 6.29); c.fill(); }
        c.globalAlpha = 1;
        // hazard posts at both edges
        const near = p && p.x > C.x0 - 90 && p.x < C.x1 + 40;
        for (const px of [x0 - 6, x1 + 4]) {
          if (pspr(PF.post, px, top - 12, 6.5, 30)) { if (near && blink(api.t)) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, px, top - 26, 8, "rgba(255,190,60,1)"); c.restore(); } continue; }
          api.rect(px - 1, top - 20, 2, 22, "#2a2234");
          api.rect(px - 4, top - 26, 8, 7, near && blink(api.t) ? "#ffe060" : "#c8a020"); api.rect(px - 1, top - 25, 2, 3, "#1a1a1a"); api.rect(px - 1, top - 21, 2, 1, "#1a1a1a");
        }
        if (near && blink(api.t, 8)) api.ptext("!", (x0 + x1) / 2, top - 30, 2, "#ffe060");
      }
    },
  };

  // Crystal meteors: a shadow grows under (near) you for 56 frames, then a crystal falls (slowly, it's low-G) and shatters.
  const M_TEL = 56, M_FALL = 22;
  const meteors = {
    init: () => ({ list: [], cd: 240, shards: [] }),
    update(st, api, p) {
      if (!p) return;
      if (--st.cd <= 0) {
        st.cd = 190 + (Math.random() * 110 | 0);
        if (p.deadT === 0 && api.camX > 120) st.list.push({ x: Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x + api.rnd(-30, 30))), y: Math.max(api.floorTop + 2, Math.min(api.floorBot - 2, p.y + api.rnd(-8, 8))), t: 0 });
      }
      st.list = st.list.filter((m) => {
        m.t++;
        if (m.t === M_TEL - M_FALL) api.SFX.charge();
        if (m.t < M_TEL) return true;
        api.SFX.boom(); api.shake(2, 8, true); api.fx("boom", m.x, m.y - 6, 22); api.dust(m.x - 6, m.y); api.dust(m.x + 6, m.y);
        for (let i = 0; i < 10; i++) st.shards.push({ x: m.x, y: m.y, z: 2, vx: api.rnd(-1.6, 1.6), vy: api.rnd(-0.5, 0.5), vz: api.rnd(1, 2.6), t: 0 });
        const d = (x, y) => Math.hypot(x - m.x, (y - m.y) * 2.2);
        if (canHurt(p) && d(p.x, p.y) < 20 && p.z < 24) api.hurtPlayer(1, false, p.x < m.x ? -1 : 1);
        for (const e of api.enemies) if (hittable(e) && d(e.x, e.y) < 20) api.hitEnemy(e, 2, true, e.x < m.x ? -1 : 1);
        return false;
      });
      st.shards = st.shards.filter((s) => { s.t++; s.x += s.vx; s.y += s.vy; s.z += s.vz; s.vz -= 0.12; if (s.z < 0) { s.z = 0; s.vz = 0; s.vx *= 0.5; } return s.t < 50; });
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const m of st.list) { // growing shadow + ring
        const k = m.t / M_TEL, x = m.x - cx;
        c.fillStyle = `rgba(0,0,0,${0.15 + 0.4 * k})`; c.beginPath(); c.ellipse(x, m.y, 4 + 14 * k, (4 + 14 * k) * 0.4, 0, 0, 6.29); c.fill();
        c.strokeStyle = m.t % 8 < 4 ? "#ff5af0" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, m.y, 18, 7, 0, 0, 6.29); c.stroke();
        if (m.t < M_TEL - M_FALL && blink(m.t)) api.ptext("!", x, m.y - 20, 2, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const m of st.list) {
        if (m.t < M_TEL - M_FALL) continue;
        const k = (m.t - (M_TEL - M_FALL)) / M_FALL, x = m.x - cx, y = m.y - (1 - k) * 210;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5;
        c.strokeStyle = "#ff8af6"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 6, y - 30); c.lineTo(x, y); c.stroke(); c.restore();
        if (pspr(PF.crys, x, y - 2, 11, 15.4, -0.2)) continue; // painted crystal
        c.fillStyle = "#e05ad8"; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 5, y - 2); c.lineTo(x + 2, y + 4); c.lineTo(x - 4, y + 3); c.lineTo(x - 5, y - 3); c.closePath(); c.fill();
        api.rect(x - 1, y - 6, 2, 4, "#ffd2fa");
      }
      for (const s of st.shards) api.rect(s.x - cx, s.y - s.z, 2, 1, s.t % 6 < 3 ? "#ff9af6" : "#c03ab8");
    },
  };

  // Stone bunkers (painted into the strip every tile): during a wave a doorway glows, then a rock soldier marches out.
  const TILE = 1809 * 224 / 512, DOOR_DX = 118, DOOR_TOP = 76, DOOR_BOT = 140;
  const ROCK = ["heavy", "gunner"];
  const bunkers = {
    init: () => { const list = []; for (let x = DOOR_DX; x < 2700; x += TILE) list.push({ x, t: -1, cd: 90 }); return { list }; },
    update(st, api, p) {
      const S = api.STATE;
      for (const d of st.list) {
        if (d.cd > 0) d.cd--;
        if (d.t < 0) {
          const inView = d.x - api.camX > 30 && d.x - api.camX < api.W - 30;
          if (inView && S.locked && d.cd === 0 && api.enemies.length < 5 && S.queue.some((q) => ROCK.includes(q))) { d.t = 0; api.SFX.door(); }
          continue;
        }
        d.t++;
        if (d.t === 44) {
          const i = S.queue.findIndex((q) => ROCK.includes(q));
          if (i >= 0 && api.enemies.length < 5) { const type = S.queue.splice(i, 1)[0]; const e = spawnAt(api, type, d.x + api.rnd(-4, 4), api.floorTop + 1); if (e) api.fx("smoke", e.x, e.y - 14, 22); }
        }
        if (d.t >= 80) { d.t = -1; d.cd = 300; }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const d of st.list) {
        if (d.t < 0) continue;
        const x = d.x - cx; if (x < -30 || x > api.W + 30) continue;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = d.t < 44 ? 0.4 + 0.4 * (d.t % 8 < 4 ? 1 : 0.4) : Math.max(0, 1 - (d.t - 44) / 36);
        glow(c, x, (DOOR_TOP + DOOR_BOT) / 2 + 8, 26, "rgba(255,140,40,0.9)"); c.restore();
        if (d.t < 44 && blink(d.t)) api.ptext("!", x, DOOR_TOP - 6, 2, "#ffe060");
      }
    },
  };

  // ================= BOSS ARENA =================
  const PART = { x: 352, y: 84 };             // where the partner stands on the cannon emplacement (screen/world)
  const CANNON = { x: 318, y: 60 };           // tip of the big painted artillery cannon
  const ADOOR = { x: 49, y: 152 };            // arena bunker doorway (rock-soldier reinforcements)
  const boss = () => A.enemies.find((e) => e.boss);
  // Artillery barrage: each shell gets a red target marker on the floor for 64 frames, then drops and explodes.
  const MK_TEL = 64, MK_DROP = 18;
  function barrage(api, n, mode) {
    if (!G) return;
    const p = api.player, dir = p.x < api.W / 2 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      let x, y;
      if (mode === "creep") { x = (dir > 0 ? 40 : api.W - 40) + dir * i * 42 + api.rnd(-4, 4); y = p.y + api.rnd(-6, 6); }
      else { x = p.x + (i ? api.rnd(-40, 40) : 0); y = p.y + (i ? api.rnd(-14, 14) : 0); }
      G.marks.push({ x: Math.max(20, Math.min(api.W - 20, x)), y: Math.max(api.floorTop + 3, Math.min(api.floorBot - 3, y)), t: -i * (mode === "creep" ? 12 : 20), hit: new Set() });
    }
  }
  function pound(api, x, y) { // ground-pound landing: direct hit + an expanding shockwave ring you must jump
    const p = api.player;
    api.SFX.boom(); api.shake(4, 14, true); api.STATE.shake = Math.max(api.STATE.shake, 10); api.dust(x - 12, y); api.dust(x + 12, y);
    for (let i = 0; i < 6; i++) G.rocks.push({ x: x + api.rnd(-14, 14), y: y + api.rnd(-4, 4), z: 2, vx: api.rnd(-1.4, 1.4), vz: api.rnd(1.5, 3.2), t: 0 });
    if (canHurt(p) && p.z < 4 && Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 12) api.hurtPlayer(2, false, p.x >= x ? 1 : -1);
    G.rings.push({ x, y, r: 10, hit: new Set() });
  }
  const arena = {
    init: () => { G = fresh(); return {}; },
    update(st, api, p) {
      if (!G) return;
      const b = boss(), fight = b && b.started && b.state !== "dying" && !api.STATE.outro, P = G.partner;
      P.t++; if (P.fireT > 0) P.fireT--;
      if (G.pSay && --G.pSay.t <= 0) G.pSay = null;
      // the partner on the cannon shells you on his own between the boss's attacks
      if (fight && b.state !== "tag" && P.st === "idle" && --G.barCd <= 0) {
        G.barCd = b.p2 ? 300 + (Math.random() * 80 | 0) : 470 + (Math.random() * 80 | 0);
        if (b.p2) barrage(api, Math.random() < 0.5 ? 5 : 3, Math.random() < 0.5 ? "creep" : "track"); else barrage(api, 2, "track");
      }
      G.marks = G.marks.filter((m) => {
        m.t++;
        if (m.t === 1) { P.fireT = 12; api.SFX.gun(); api.fx("smoke", CANNON.x - 6, CANNON.y, 20); }
        if (m.t === MK_TEL - MK_DROP) api.SFX.charge();
        if (m.t < MK_TEL) return true;
        api.SFX.boom(); api.shake(3, 10, true); api.fx("boom", m.x, m.y - 8, 26); api.dust(m.x - 8, m.y); api.dust(m.x + 8, m.y);
        G.craters.push({ x: m.x, y: m.y, t: 0 });
        const d = (x, y) => Math.hypot(x - m.x, (y - m.y) * 2.4);
        if (canHurt(p) && d(p.x, p.y) < 24 && p.z < 22) api.hurtPlayer(2, false, p.x < m.x ? -1 : 1);
        for (const e of api.enemies) if (hittable(e) && d(e.x, e.y) < 24) api.hitEnemy(e, 2, true, e.x < m.x ? -1 : 1);
        return false;
      });
      G.rings = G.rings.filter((R) => {
        R.r += 2.4;
        const test = (x, y, z) => Math.abs(Math.hypot(x - R.x, (y - R.y) / 0.32) - R.r) < 6 && z < 5;
        if (canHurt(p) && !R.hit.has(p) && test(p.x, p.y, p.z)) { R.hit.add(p); api.hurtPlayer(2, false, p.x < R.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !R.hit.has(e) && test(e.x, e.y, e.z)) { R.hit.add(e); api.hitEnemy(e, 1, true, e.x < R.x ? -1 : 1); }
        return R.r < 170;
      });
      G.craters = G.craters.filter((c) => ++c.t < 150);
      G.rocks = G.rocks.filter((r) => { r.t++; r.x += r.vx; r.z += r.vz; r.vz -= 0.13; if (r.z < 0) { r.z = 0; r.vz = 0; r.vx = 0; } return r.t < 60; });
      if (G.door) { // reinforcements out of the arena bunker
        G.door.t++;
        if (G.door.t === 40 || G.door.t === 64) { const ty = G.door.types.shift(); if (ty) { const e = spawnAt(api, ty, ADOOR.x + 4, api.floorTop + 2 + (G.door.t === 64 ? 10 : 0)); if (e) api.fx("smoke", e.x, e.y - 14, 22); } }
        if (G.door.t > 90) G.door = null;
      }
      if (P.st === "fall") { P.fz = (P.fz || 0) + 1; }
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const k of G.craters) { c.globalAlpha = Math.min(1, (150 - k.t) / 60) * (ready(A.img(PR_IMG)) ? 0.9 : 0.55); if (!pspr(PF.crater, k.x, k.y, 32, 11)) { c.fillStyle = "#120a16"; c.beginPath(); c.ellipse(k.x, k.y, 14, 5, 0, 0, 6.29); c.fill(); } c.globalAlpha = 1; }
      if (G.door) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6 * (G.door.t % 8 < 4 ? 1 : 0.6); glow(c, ADOOR.x, 125, 24, "rgba(255,140,40,0.9)"); c.restore(); if (G.door.t < 40 && blink(G.door.t)) api.ptext("!", ADOOR.x, 96, 2, "#ffe060"); }
      drawPartner(api);
      for (const m of G.marks) { // target markers
        if (m.t <= 0) continue;
        const k = Math.min(1, m.t / MK_TEL), r = 22 - 8 * k, col = m.t % 8 < 4 ? "#ff3a2a" : "#ffe060";
        c.fillStyle = `rgba(255,40,30,${0.12 + 0.25 * k})`; c.beginPath(); c.ellipse(m.x, m.y, r, r * 0.38, 0, 0, 6.29); c.fill();
        c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.ellipse(m.x, m.y, r, r * 0.38, 0, 0, 6.29); c.stroke();
        c.beginPath(); c.ellipse(m.x, m.y, r * 0.45, r * 0.17, 0, 0, 6.29); c.stroke();
        api.rect(m.x - r - 4, m.y, 7, 1, col); api.rect(m.x + r - 3, m.y, 7, 1, col); api.rect(m.x, m.y - r * 0.38 - 4, 1, 5, col); api.rect(m.x, m.y + r * 0.38, 1, 4, col);
        if (m.t < MK_TEL - MK_DROP && blink(m.t)) api.ptext("!", m.x, m.y - 16, 2, "#ffe060");
      }
      for (const R of G.rings) { // ground-pound shockwaves
        const a = Math.max(0, 1 - R.r / 170);
        c.save(); c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(255,170,60,${0.5 * a + 0.2})`; c.lineWidth = 5; c.beginPath(); c.ellipse(R.x, R.y, R.r, R.r * 0.32, 0, 0, 6.29); c.stroke();
        c.strokeStyle = `rgba(255,240,200,${0.8 * a + 0.2})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(R.x, R.y, R.r, R.r * 0.32, 0, 0, 6.29); c.stroke();
        c.restore();
      }
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const c = api.ctx, P = G.partner;
      for (const m of G.marks) { // shells dropping out of the sky onto the markers
        if (m.t < MK_TEL - MK_DROP) continue;
        const k = (m.t - (MK_TEL - MK_DROP)) / MK_DROP, y = m.y - (1 - k) * 220;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.strokeStyle = "#ffb04a"; c.lineWidth = 3; c.beginPath(); c.moveTo(m.x, y - 26); c.lineTo(m.x, y); c.stroke(); c.restore();
        if (!pspr(PF.shell, m.x, y - 3, 13, 3.6, Math.PI / 2)) { api.rect(m.x - 2, y - 7, 4, 8, "#4a4a52"); api.rect(m.x - 2, y - 7, 1, 8, "#8a8a96"); api.rect(m.x - 1, y + 1, 2, 2, "#ff8a2a"); }
      }
      for (const r of G.rocks) api.rect(r.x, r.y - r.z, 2, 2, "#8a7a6a");
      if (P.fireT > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = P.fireT / 12; glow(c, CANNON.x, CANNON.y, 18, "rgba(255,200,90,1)"); c.restore(); }
      if (G.pSay && P.st !== "hop") api.bubble(PART.x - 18, PART.y - 50, G.pSay.s, "#e8302a", 7);
      if (G.hint > 0) { G.hint--; if (blink(G.hint, 8)) api.ptext("DODGE THE TARGET MARKERS! JUMP THE SHOCKWAVES!", api.W / 2, 112, 1, "#ffd27a"); }
    },
  };

  // ================= THE BOSSES: GENERAL TRAAG & LT. GRANITOR =================
  const FR = {
    traag: { src: TRS, k: 0.40, idle: [0, 0, 177, 228, 84], walk: [179, 1, 174, 227, 82], fire: [355, 1, 266, 227, 92], hurt: [623, 59, 212, 169, 90], down: [837, 128, 330, 100, 165] },
    granitor: { src: GRS, k: 0.335, idle: [0, 76, 154, 256, 78], walk: [156, 73, 171, 259, 82], leap: [329, 0, 180, 332, 90], hurt: [511, 81, 154, 251, 77], down: [667, 243, 240, 89, 121] },
  };
  function redSheet(api, src) {
    if (RED[src]) return RED[src];
    const im = api.img(src); if (!im || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const g = cv.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(255,40,24,0.5)"; g.fillRect(0, 0, cv.width, cv.height);
    return (RED[src] = cv);
  }
  // draw one frame: feet at (x, y), anchored on the body (not the frame centre), facing ±1
  function spr(api, who, fr, x, y, facing, o) {
    const F = FR[who], f = F[fr], im = api.img(F.src), c = api.ctx; o = o || {};
    const k = F.k * (o.s || 1), sy = o.sy || 1;
    if (!im || !im.naturalWidth) { api.rect(x - 14, y - 80 * (o.s || 1), 28, 80 * (o.s || 1), who === "traag" ? "#6a5a4a" : "#b08a8a"); return; }
    const sheet = o.red ? redSheet(api, F.src) || im : im;
    c.save(); c.translate(Math.round(x * 3) / 3, Math.round(y * 3) / 3); if (o.rot) c.rotate(o.rot); c.scale(facing < 0 ? -1 : 1, 1);
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    c.imageSmoothingEnabled = true;
    c.drawImage(sheet, f[0], f[1], f[2], f[3], -f[4] * k, -f[3] * k * sy, f[2] * k, f[3] * k * sy);
    c.restore();
  }
  function drawPartner(api) {
    const P = G.partner, b = boss(); if (P.st === "gone" || P.st === "hop") return;
    if (b && b.state === "tag" && b.t >= 40) return; // the tag-team leap draws both of them
    const c = api.ctx;
    if (P.st === "fall") { // cannon blown: he tumbles off the back of the emplacement
      const z = Math.min(90, (P.fz || 0) * (P.fz || 0) * 0.02);
      if (z < 88) spr(api, P.who, "down", PART.x + 6, PART.y + z, -1, { s: 0.8, alpha: 1 - z / 90 });
      return;
    }
    api.contactShadow(PART.x, PART.y, 0, 9);
    const fire = P.fireT > 0, bob = Math.sin(P.t * 0.06) * 0.012;
    if (P.who === "traag") spr(api, "traag", fire ? "fire" : "idle", PART.x + (fire ? 2 : 0), PART.y, -1, { s: 0.8, sy: 1 + bob });
    else spr(api, "granitor", "idle", PART.x + (fire ? 2 : 0), PART.y, -1, { s: 0.8, sy: 1 + bob });
    if (fire) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.4; glow(c, PART.x - 20, PART.y - 30, 16, "rgba(255,180,80,0.9)"); c.restore(); }
  }
  function partnerSay(s, t) { if (G) G.pSay = { s, t: t || 110 }; }

  const LINES_T = { intro: "TURTLES! IN DIMENSION X? YOU'RE A LONG WAY FROM HOME!",
    hit: ["THAT... TICKLED!", "YOU DARE STRIKE A GENERAL?!", "ROCK SOLDIERS NEVER FALL!", "GRRR! INSOLENT SHELLS!"],
    summon: "ROCK SOLDIERS! FALL IN!", ko: "IMPOSSIBLE... FALL BACK!" };
  const LINES_G = { intro: "", hit: ["I AM GRANITE!", "IS THAT YOUR BEST?", "THE GENERAL WILL NOT BE DISAPPOINTED!", "CRUNCH!"],
    summon: "SOLDIERS, TO ME!", ko: "THE GENERAL... I HAVE... CRUMBLED..." };
  const P2 = { speed: 1.35, chargeSpeed: 1.4, cool: 66, pitch: 74, proj: "rock", throwN: 3, height: 94, lines: LINES_G };

  function hopTo(e, tx, ty, n, next) { Object.assign(e, { state: "slam", mv: "hop", t: 0, h0: [e.x, e.y], h1: [tx, ty], hn: n, hnext: next }); A.SFX.jump(); }
  function pick(api, e, p) {
    const dx = p.x - e.x, dy = p.y - e.y, ax = Math.abs(dx);
    e.t = 0; e.cool = e.cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1; e.mv = null;
    if (ax < 30 && Math.random() < 0.7) { e.state = "kwind"; return; }
    let opts;
    if (!e.p2) opts = ["blast", "blast", "pound", "call", "tele"];
    else opts = ["pound3", "pound3", "rocks", "rocks", "call", "tele", "tele"];
    if (!(e.sumCd > 0) && api.enemies.length < 3) opts.push("summon");
    if (Math.abs(dy) > 8) opts = opts.filter((m) => m !== "tele");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.65) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m;
    if (m === "tele") { e.state = "tele"; return; }                    // engine charge (red-flash telegraph, rush)
    if (m === "rocks") { e.state = "throw"; return; }                  // engine lobbed rocks (cfg.proj/throwN)
    if (m === "blast") { e.state = "fire"; e.mv = "blast"; return; }   // Traag's arm-cannon volley
    if (m === "call") { e.state = "summon"; e.mv = "call"; return; }   // calls the partner's artillery
    if (m === "summon") { e.state = "summon"; e.mv = "door"; return; }
    if (m === "pound" || m === "pound3") { e.state = "slam"; e.mv = "crouch"; e.pn = m === "pound3" ? 3 : 1; return; }
  }
  function cannonShell(api, s) { // Traag's arm-cannon shell: leaves the muzzle high and dips toward the floor
    const p = api.player;
    s.x += s.vx; s.t = (s.t || 0) + 1; s.z = Math.max(12, s.z - 2.2); s.y += s.vy;
    if (canHurt(p) && Math.abs(s.x - p.x) < 9 && Math.abs(s.y - p.y) < 7 && Math.abs(p.z + 12 - s.z) < 16) { api.hurtPlayer(1, false, s.vx > 0 ? 1 : -1); api.fx("boom", s.x, s.y - s.z, 14); s.dead = true; }
    if (s.x < -20 || s.x > api.W + 20 || s.t > 200) s.dead = true;
    return true;
  }
  function drawShell(api, s) {
    const x = s.x - api.camX, y = s.y - s.z, c = api.ctx;
    c.save(); c.globalCompositeOperation = "lighter"; glow(c, x, y, 8, "rgba(255,160,60,0.8)"); c.restore();
    if (pspr(PF.shell, x, y, 11, 3.2, 0, s.vx < 0)) return;
    api.rect(x - 3, y - 2, 6, 4, "#5a5a64"); api.rect(x + (s.vx > 0 ? 2 : -4), y - 1, 2, 2, "#ffd27a");
  }

  // ---- Boss entrance (entr v1): Granitor's artillery shells the arena centre, then Traag leaps off the emplacement through the smoke and lands like a falling boulder ----
  const TG_ENTR = {
    len: 180, zoom: 1.28, sub: "STONE WARLORD OF DIMENSION X",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: PART.x - 26, y: 176, z: 92, facing: -1, state: "walk", walkT: 0, t: 0, who: "traag" }); st.sh = null; api.SFX.rumble(); },
    focus: (api, e, st, t) => t < 44 ? { x: st.sh ? st.sh.x : api.camX + 260, y: st.sh ? st.sh.y - 20 : 110 } : { x: e.x, y: e.y - e.z - 40 },
    step(api, e, st, t) {
      if (!G) return;
      const P = G.partner, mid = Math.round((api.floorTop + api.floorBot) / 2), cxm = api.camX + api.W / 2;
      if (P.fireT > 0) P.fireT--; P.t++;
      if (t === 10) { P.fireT = 16; api.SFX.gun(); api.shake(2, 8, true); api.fx("boom", CANNON.x, CANNON.y, 14); st.sh = { x: CANNON.x, y: CANNON.y, k: 0 }; }
      if (st.sh && st.sh.k < 1) { st.sh.k = Math.min(1, (t - 10) / 24); st.sh.x = api.lerp(CANNON.x, cxm, st.sh.k); st.sh.y = api.lerp(CANNON.y, mid, st.sh.k) - Math.sin(st.sh.k * Math.PI) * 34; }
      if (t === 34) { st.sh = null; api.entr.impact(cxm, mid, 5, { stop: 3, puffs: 6 }); api.fx("boom", cxm, mid - 10, 30); G.craters.push({ x: cxm, y: mid, t: 0 }); api.entr.debris(cxm, mid, 4, 12, { spread: 2.8, up: 2 }); }
      if (t < 46) { e.state = "walk"; e.walkT = 0; e.facing = -1; return; }
      if (t === 46) { api.SFX.jump(); st.x0 = e.x; st.z0 = e.z; st.y0 = e.y; }
      if (t > 46 && t <= 86) { const k = (t - 46) / 40; e.state = "charge"; e.t = 10; e.x = api.lerp(st.x0, cxm, k); e.y = api.lerp(st.y0, mid, k); e.z = api.lerp(st.z0, 0, k * k) + Math.sin(k * Math.PI) * 30;
        if (t % 4 === 0) api.fx("smoke", e.x, e.y - e.z - 10, 12); }
      if (t === 86) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6, puffs: 8 }); api.entr.debris(e.x, e.y, 2, 16, { spread: 3.2, up: 2.5 }); api.SFX.rumble(); }
      if (t > 86 && t < 110) { e.state = "kwind"; e.t = 2; }
      if (t >= 110 && t < 140) { e.state = "fire"; e.mv = "blast"; e.t = t - 80; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 118) { api.SFX.gun(); api.shake(2, 8, true); api.fx("spark", e.x + e.facing * 34, e.y - 64, 14); e.recoil = 6; } if (e.recoil > 0) e.recoil--; }
      if (t >= 140) { e.state = "walk"; e.mv = null; e.walkT = 0; }
    },
    drawFront(api, st, t, cx) { const s = st.sh; if (!s) return; const c = api.ctx; c.save(); c.globalCompositeOperation = "lighter"; glow(c, s.x - cx, s.y, 9, "rgba(255,170,70,0.9)"); c.restore(); api.rect(s.x - cx - 2, s.y - 2, 4, 4, "#5a5a64"); },
    finish(api, e) { e.mv = null; e.recoil = 0; if (G) { G.partner.fireT = 0; G.barCd = Math.max(G.barCd, 300); } },
  };
  const bossCfg = {
    name: "GENERAL TRAAG", base: "ramrod", atlas: "ramrod", hp: 60, speed: 1.0, chargeSpeed: 1.1, cool: 96, pitch: 62, height: 100,
    moves: ["charge", "kick"], lines: LINES_T,
    spawn(api, e) { e.who = "traag"; e.cfg = Object.assign({}, bossCfg); e.sumCd = 600; },
    entrance: TG_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "walk" && !e.started) { e.started = api.t; G.barCd = 300; }
      if (e.started && !e.p2 && e.state !== "tag" && api.t - e.started === 120) partnerSay("THE ROCK SOLDIERS WILL CRUSH YOU!", 100);
      if (e.started && api.t - e.started === 230) G.hint = 170;
      if (e.state === "tag") return tagUpdate(api, e, p);
      if (e.state === "walk" && !e.p2 && e.hp <= e.maxHp * 0.5 && G.partner.st === "idle") { e.state = "tag"; e.t = 0; e.inv = 2; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { pick(api, e, p); return true; }
      if (e.state === "fire" && e.mv === "blast") { // aim (red flash), then a 3-shell volley along your row
        e.facing = p.x >= e.x ? 1 : -1;
        if (e.t === 2) api.SFX.charge();
        if (e.t === 30 || e.t === 44 || e.t === 58) {
          const mx = e.x + e.facing * 35, vy = Math.max(-0.5, Math.min(0.5, (p.y - e.y) / 60));
          api.shot({ x: mx, y: e.y, z: 64, vx: e.facing * 3.1, vy, kind: "shell", update: cannonShell, draw: drawShell });
          api.SFX.gun(); api.shake(1, 4, true); e.recoil = 6;
        }
        if (e.recoil > 0) e.recoil--;
        if (e.t >= 76) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.state === "summon" && e.mv === "call") { // call in the partner's artillery
        if (e.t === 8) api.enemySay(e, e.p2 ? "TRAAG! BOMBARD THEM!" : "GRANITOR! FIRE FOR EFFECT!", 80, e.cfg.pitch, true);
        if (e.t === 30) { barrage(api, e.p2 ? 4 : 3, e.p2 && Math.random() < 0.5 ? "creep" : "track"); G.barCd = Math.max(G.barCd, 200); }
        if (e.t >= 50) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.state === "summon" && e.mv === "door") {
        if (e.t === 8) api.enemySay(e, e.cfg.lines.summon, 80, e.cfg.pitch, true);
        if (e.t === 12) { G.door = { t: 0, types: e.p2 ? ["heavy", "gunner"] : ["gunner", "purple"] }; api.SFX.door(); e.sumCd = 900; }
        if (e.t >= 40) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.state === "slam") return poundUpdate(api, e, p);
      return false; // tele/charge/kick/throw/enter and the hurt reactions: the engine's moves
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, who = e.who || "traag", c = api.ctx;
      if (s === "tag" && t >= 40) return drawTag(api, e);
      if (s === "slam" && e.mv === "hop") { // shadow target while airborne
        const tx = e.h1[0] - api.camX, ty = e.h1[1];
        c.strokeStyle = t % 6 < 3 ? "#ff3a2a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(tx, ty, 18, 6, 0, 0, 6.29); c.stroke();
      }
      const red = (s === "tele" && t % 6 < 3) || (s === "slam" && e.mv === "crouch" && t % 6 < 3) || (s === "fire" && e.mv === "blast" && t < 28 && t % 6 < 3) || (s === "kwind" && t % 4 < 2) || (s === "throw" && t < 14 && t % 6 < 3);
      let fr = "idle", o = { red, sy: 1 + Math.sin((e.life || 0) * 0.07) * 0.012 }, x = sx;
      if (s === "down" || s === "dying") fr = "down";
      else if (s === "hurt" || s === "stagger" || s === "getup") fr = "hurt";
      else if (s === "slam") { if (e.mv === "crouch") { fr = "idle"; o.sy = 0.9; } else fr = who === "granitor" ? "leap" : "walk"; }
      else if (s === "throw") fr = who === "granitor" ? (t < 26 ? "leap" : "walk") : "fire";
      else if (s === "fire") fr = e.mv === "blast" && t >= 28 && (t - 30) % 14 < 8 ? "fire" : "idle";
      else if (s === "kwind" || s === "kick") { fr = "walk"; x += s === "kick" ? e.facing * Math.min(6, t) : -e.facing; }
      else if (s === "charge" || s === "tele") fr = "walk";
      else if ((s === "walk" || s === "enter") && e.walkT > 0) fr = Math.floor(e.walkT / 10) % 2 ? "walk" : "idle";
      if (fr === "fire" && who === "granitor") fr = "walk";
      if (s === "stagger") x += t % 4 < 2 ? 1 : -1;
      if (s === "fire" && e.recoil > 0) x -= e.facing * 2;
      if (e.p2 && who === "granitor" && s !== "dying") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.18 + 0.1 * Math.sin(api.t * 0.2); glow(c, sx, sy - 40, 40, "rgba(255,140,90,0.8)"); c.restore(); }
      spr(api, who, fr, x, sy, e.facing, o);
    },
    onDefeat(api, e) {
      if (!G) return;
      G.marks = []; G.rings = [];
      G.partner.st = "fall"; G.partner.fz = 0; partnerSay("NO! THE TECHNODROME IS PHASING OUT! RETREAT!", 150);
      api.fx("boom", CANNON.x, CANNON.y, 30); api.fx("boom", PART.x, PART.y - 30, 30); api.SFX.boom(); api.shake(4, 20, true);
    },
  };
  function poundUpdate(api, e, p) {
    if (e.mv === "crouch") { // red-flash crouch telegraph (wind-up), then the leap
      if (e.t === 1) api.SFX.charge();
      if (e.t >= (e.p2 ? 20 : 26)) hopTo(e, Math.max(30, Math.min(api.W - 30, p.x)), Math.max(api.floorTop + 2, Math.min(api.floorBot - 2, p.y)), e.p2 ? 30 : 36, "pound");
      return true;
    }
    if (e.mv === "hop") {
      const k = Math.min(1, e.t / e.hn), [x0, y0] = e.h0, [x1, y1] = e.h1;
      e.x = api.lerp(x0, x1, k); e.y = api.lerp(y0, y1, k); e.z = Math.sin(k * Math.PI) * 70;
      if (Math.abs(x1 - x0) > 2) e.facing = x1 > x0 ? 1 : -1;
      if (k >= 1) {
        e.z = 0; pound(api, e.x, e.y);
        if (--e.pn > 0) { e.mv = "crouch"; e.t = 8; }
        else { e.state = "stagger"; e.t = 18; e.vx = 0; e.mv = null; } // brief recovery: the opening to punish
      }
      return true;
    }
    if (e.state === "slam") { e.state = "walk"; e.t = 0; e.mv = null; }
    return true;
  }
  // TAG TEAM: Traag leaps up to the cannon while Granitor leaps down; the boss entity becomes Granitor.
  const TAG_T = 40, TAG_N = 46;
  function tagUpdate(api, e, p) {
    const P = G.partner; e.inv = 2;
    if (e.t === 1) { api.enemySay(e, "LIEUTENANT! TAG IN!", 70, e.cfg.pitch, true); G.marks = []; }
    if (e.t === 20) partnerSay("YES, GENERAL!", 50);
    if (e.t === TAG_T) {
      e.from = [e.x, e.y]; e.land = [Math.max(80, Math.min(api.W - 80, p.x + (p.x > api.W / 2 ? -70 : 70))), Math.round((api.floorTop + api.floorBot) / 2)];
      e.x = e.land[0]; e.y = e.land[1]; P.st = "swap"; api.SFX.jump();
    }
    if (e.t === TAG_T + TAG_N) {
      e.who = "granitor"; e.name = "LT. GRANITOR"; e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2); e.sumCd = 700; e.z = 0;
      P.who = "traag"; P.st = "idle"; pound(api, e.x, e.y); api.STATE.bossT = 70; G.barCd = 260;
    }
    if (e.t === TAG_T + TAG_N + 72) api.enemySay(e, "I'LL GRIND YOU TO GRAVEL!", 80, P2.pitch, true);
    if (e.t === TAG_T + TAG_N + 120) { partnerSay("I HAVE THE BIG GUN NOW, TURTLES!", 100); api.playerBark(true, "A TAG TEAM?! WATCH THE SKY!"); }
    if (e.t >= TAG_T + TAG_N + 124) { e.state = "walk"; e.t = 0; e.cool = 30; }
    return true;
  }
  function drawTag(api, e) {
    const k = Math.min(1, (e.t - TAG_T) / TAG_N), arc = Math.sin(k * Math.PI) * 34;
    if (k < 1) {
      const tx = api.lerp(e.from[0], PART.x, k), ty = api.lerp(e.from[1], PART.y, k) - arc; // Traag up to the cannon
      spr(api, "traag", "walk", tx, ty, 1, { s: api.lerp(1, 0.8, k) });
      const gx = api.lerp(PART.x, e.land[0], k), gy = api.lerp(PART.y, e.land[1], k) - arc;    // Granitor down into the arena
      spr(api, "granitor", "leap", gx, gy, -1, { s: api.lerp(0.8, 1, k) });
    } else spr(api, "granitor", "idle", e.x - api.camX, e.y - e.z, e.x < api.player.x ? 1 : -1, {});
  }

  // ================= OUTRO: the portal home, and the Technodrome follows =================
  const SPHERE = { x: 147, y: 28, w: 106, h: 70 }; // the fortress painted in the arena (world px)
  const ESPH = [449, 20, 305, 275];                // the fortress in level13_earth.jpg (image px of the 878x512 file)
  const PORTAL = { x: 300, y: 182 };
  const BRO_K = 42 * 1.6 * 0.92 / 150;
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro
      if (t === 1) { Object.assign(st, { phase: 0, bros: [], flash: 0 }); if (G) { G.marks = []; G.rings = []; } }
      if (G) { G.partner.t++; if (G.partner.st === "fall") G.partner.fz = (G.partner.fz || 0) + 1; if (G.pSay && --G.pSay.t <= 0) G.pSay = null; }
      if (st.phase === 0) { // the rift opens; walk to the portal
        if (t % 24 === 0) api.shake(2, 10, true);
        if (t === 40) api.playerBark(true, "THE TECHNODROME... IT'S PHASING OUT!");
        if (t === 70) api.SFX.zap();
        if (t > 120) {
          if (t === 130) api.playerBark(true, "THAT PORTAL LEADS HOME! GO!");
          const dx = PORTAL.x - p.x, dy = PORTAL.y - p.y;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { p.x += Math.sign(dx) * Math.min(1.8, Math.abs(dx)); p.y += Math.sign(dy) * Math.min(1, Math.abs(dy)); p.walkT++; p.facing = dx >= 0 ? 1 : -1; }
          else { p.walkT = 0; }
          if ((Math.abs(dx) <= 2 && Math.abs(dy) <= 2) || t > 330) { st.phase = 1; st.k = 0; p.vz = 3.6; p.z = 0.1; api.SFX.jump(); }
        }
        return false;
      }
      st.k++;
      if (st.phase === 1) { // into the portal: whiteout
        p.z += p.vz; p.vz -= 0.15; if (p.z < 0) p.z = 0;
        st.flash = Math.min(1, st.k / 26);
        if (st.k === 20) { api.SFX.confirm(); api.SFX.boom(); }
        if (st.k >= 34) { st.phase = 2; st.k = 0; p.z = 0;
          ["lenny", "rafe", "miko", "donny"].forEach((n, i) => st.bros.push({ n, x: 70 + i * 40, y: 196 + (i % 2) * 8, z: 170 + i * 30, vz: 0, land: 0 }));
        }
        return false;
      }
      // phase 2: Earth. The brothers drop out of the rift onto a rooftop while the Technodrome phases into the sky.
      st.flash = Math.max(0, 1 - st.k / 30);
      for (const b of st.bros) { if (b.z > 0) { b.vz -= 0.25; b.z = Math.max(0, b.z + b.vz); if (b.z === 0) { b.land = st.k; api.SFX.land(); api.dust(b.x, b.y); } } }
      if (st.k === 70) { api.SFX.rumble(); api.shake(3, 40, true); }
      if (st.k === 90) st.say = { s: "WE'RE HOME... BUT SO IS THE TECHNODROME!", t: 120 };
      if (st.k === 230) { st.say = { s: "TIME TO TAKE THE FIGHT TO SHREDDER!", t: 110 }; api.SFX.confirm(); }
      if (st.say && --st.say.t <= 0) st.say = null;
      return st.k > 420;
    },
    draw(api, st, t, cx) {
      const c = api.ctx;
      if (!st.phase || st.phase === 1) { // Dimension X: the fortress flickers out, a portal swirls open
        const ph = Math.min(1, t / 120);
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = (0.25 + 0.25 * Math.sin(t * 0.4)) * ph;
        glow(c, SPHERE.x + SPHERE.w / 2, SPHERE.y + SPHERE.h / 2, 70, "rgba(90,255,180,0.9)"); c.restore();
        const im = api.img(BG2);
        if (im && t % 6 < 3) { c.globalAlpha = 0.35 * ph; for (let i = 0; i < 6; i++) { const sh = SPHERE.h / 6, off = Math.sin(t * 0.5 + i) * 6 * ph; c.drawImage(im, (SPHERE.x + off) * 512 / 224, (SPHERE.y + i * sh) * 512 / 224, SPHERE.w * 512 / 224, sh * 512 / 224, SPHERE.x, SPHERE.y + i * sh, SPHERE.w, sh); } c.globalAlpha = 1; }
        if (t > 70) drawPortal(api, PORTAL.x - cx, PORTAL.y, Math.min(1, (t - 70) / 40), t);
        if (G && G.pSay) api.bubble(PART.x - 18, PART.y - 30, G.pSay.s, "#e8302a", 7);
        if (st.flash > 0) { c.globalAlpha = st.flash; api.rect(0, 0, api.W, api.H, "#f4fff8"); c.globalAlpha = 1; }
        return;
      }
      // Earth
      const im = api.img(EARTH), k = st.k;
      if (im) c.drawImage(im, 0, 0, api.W, api.H); else { api.rect(0, 0, api.W, api.H, "#0c1424"); api.rect(0, 176, api.W, 48, "#2a2a30"); }
      const ph = Math.max(0, 1 - k / 300); // the Technodrome glitches into solid reality
      if (im && ph > 0) {
        const sx = ESPH[0] * 224 / 512, sy = ESPH[1] * 224 / 512, sw = ESPH[2] * 224 / 512, sh = ESPH[3] * 224 / 512;
        c.save(); c.globalAlpha = 0.5 * ph;
        for (let i = 0; i < 10; i++) { const off = Math.sin(k * 0.6 + i * 1.7) * 9 * ph; c.drawImage(im, ESPH[0], ESPH[1] + i * ESPH[3] / 10, ESPH[2], ESPH[3] / 10, sx + off, sy + i * sh / 10, sw, sh / 10); }
        c.globalCompositeOperation = "lighter"; c.globalAlpha = ph * (0.3 + 0.3 * (k % 8 < 4 ? 1 : 0)); glow(c, sx + sw / 2, sy + sh / 2, 90, "rgba(90,255,170,0.9)");
        c.restore();
        if (k % 30 < 4) { c.strokeStyle = "#d8fff0"; c.lineWidth = 1; c.beginPath(); let x = sx + api.rnd(10, sw - 10), y = sy; c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += api.rnd(-10, 10); y += sh / 6; c.lineTo(x, y); } c.stroke(); }
      }
      for (const b of st.bros) {
        const bim = api.atlasImg(b.n), F = api.ATLAS[b.n]; if (!F) continue;
        const cheer = b.land && k - b.land > 40 && k > 250, z = b.z + (cheer ? Math.abs(Math.sin(k * 0.14 + b.x)) * 8 : 0);
        api.contactShadow(b.x, b.y, z, 10);
        const fr = z > 2 ? F.jump : F.idle;
        if (bim) api.drawFrame(bim, fr, b.x, b.y - z, BRO_K, 1); else api.rect(b.x - 6, b.y - z - 30, 12, 30, "#3fae3a");
      }
      const me = api.player && api.player.bro ? api.player.bro.name.toLowerCase() : "lenny", mb = st.bros.find((b) => b.n === me) || st.bros[0];
      if (st.say && mb) api.bubble(mb.x, mb.y - 66, st.say.s, "#3fae3a", 7);
      if (k > 130) {
        const a = Math.min(1, (k - 130) / 30);
        c.globalAlpha = 0.5 * a; api.rect(0, 116, api.W, 30, "#05030a"); c.globalAlpha = a;
        api.ptext("THE TECHNODROME HAS PHASED INTO THE CITY!", api.W / 2, 125, 1, "#9affd8");
        if (k > 190) api.ptext("THE FINAL SIEGE BEGINS...", api.W / 2, 137, 1, "#ffd27a");
        c.globalAlpha = 1;
      }
      if (st.flash > 0) { c.globalAlpha = st.flash; api.rect(0, 0, api.W, api.H, "#f4fff8"); c.globalAlpha = 1; }
    },
  };
  function drawPortal(api, x, y, s, t) {
    const c = api.ctx;
    c.save(); c.translate(x, y - 34 * s); c.scale(s, s);
    c.globalCompositeOperation = "lighter";
    glow(c, 0, 0, 38, "rgba(80,255,140,0.7)");
    const pim = A.img(PR_IMG);
    if (ready(pim)) { // painted vortex: two counter-rotating copies + bright core
      const f = PF.portal, w = 46, h = 72;
      c.globalCompositeOperation = "source-over";
      c.save(); c.scale(1, 1 + 0.03 * Math.sin(t * 0.2)); c.drawImage(pim, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore();
      c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45; c.save(); c.scale(1, h / w); c.rotate(t * 0.06); c.scale(1, w / h); c.drawImage(pim, f[0], f[1], f[2], f[3], -w / 2.4, -h / 2.4, w / 1.2, h / 1.2); c.restore(); c.globalAlpha = 1;
      c.fillStyle = "rgba(230,255,240,0.7)"; c.beginPath(); c.ellipse(0, 0, 4, 7, 0, 0, 6.29); c.fill();
      c.restore(); return;
    }
    for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? "rgba(160,90,255,0.9)" : "rgba(120,255,170,0.9)"; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 22 - i * 4, 32 - i * 6, 0, t * 0.1 * (i % 2 ? -1 : 1) + i, t * 0.1 * (i % 2 ? -1 : 1) + i + 4.4); c.stroke(); }
    c.fillStyle = "rgba(230,255,240,0.8)"; c.beginPath(); c.ellipse(0, 0, 5, 9, 0, 0, 6.29); c.fill();
    c.restore();
  }

  SS.registerLevel({
    number: 13,
    name: "DIMENSION X",
    card: { title: "DIMENSION X", tagline: "THE RIFT SPITS US OUT... ON AN ALIEN WORLD.", color: "#5affb0" },
    music, bossMusic,
    // painted regular enemies (trooper family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_trooper.png", ENEMY_F = { light: {"idle":[4,2,87,167,38],"walk":[95,2,88,167,38],"walk2":[187,0,90,169,46],"attack":[281,5,114,164,45],"jump":[399,4,84,165,46],"hurt":[487,16,90,153,46],"down":[581,133,170,36,85],"dash":[755,68,152,101,84]}, weapon: {"idle":[4,173,81,171,34],"walk":[89,175,89,169,39],"walk2":[182,177,86,167,42],"attack":[272,180,154,164,51],"jump":[430,182,98,162,52],"hurt":[532,191,108,153,52],"down":[644,307,183,37,91],"throw":[831,182,151,162,77]}, big: {"idle":[4,348,103,171,46],"walk":[111,350,108,169,54],"walk2":[223,352,113,167,58],"attack":[340,349,143,170,51],"jump":[487,360,110,159,48],"hurt":[601,362,103,157,47],"down":[708,471,189,48,94],"shoot":[901,354,141,165,41]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { gunner: 22, heavy: 32, purple: 95, blue: 165, sword: 130, dasher: 295, star: 60 },
    images: [TRS, GRS, EARTH, PR_IMG, CHASM_IMG],
    sections: [
      { bg: BG1, floor: [150, 194], length: 2600, locks: [0, 640, 1300, 1980],
        waves: [["purple", "gunner", "blue"], ["heavy", "dasher", "gunner", "purple"], ["sword", "gunner", "star", "heavy"], ["heavy", "gunner", "dasher", "blue", "gunner"]],
        grade: null, weather: null, hazards: [acid, chasm, meteors, bunkers],
        onUpdate() { if (!G) G = fresh(); },
        sky: "#3a2a6a", ground: "#5a4a7a" },
      { bg: BG2, floor: [152, 214], length: 384, locks: [], waves: [], hazards: [arena], sky: "#2a1a4a", ground: "#4a3a5a" },
    ],
    hazards: [gravity],
    restructure: { // phase 2: alien plain (zone 1) -> seize the cannon (twist) -> crystal canyon (zone 2) -> existing fortress approach
      split: 0, images: ["levels/level13_turret.png", "levels/level13_canyon.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "turret", goal: "kills", title: "SEIZE THE CANNON!", sub: "SHOOT THE DROP-PODS BEFORE THEY LAND", img: "levels/level13_turret.png", fr: {"cannon": [0, 0, 220, 181], "cannonFire": [223, 0, 250, 185], "pod": [0, 188, 110, 166], "rubble": [113, 188, 160, 84], "shell": [276, 188, 48, 31]},
        need: 8, every: 95, arc: true, tspeed: 1.2, landSpawn: "heavy", gun: "cannon", gunFire: "cannonFire", gunK: 0.26, shell: "shell", target: "pod", targetK: 0.22, hudText: "PODS", color: "#b8ff7a" },
      z2bg: "levels/level13_canyon.jpg",
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; RED = {}; },
  });
})();
