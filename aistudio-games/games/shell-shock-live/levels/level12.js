// Level 12: FUTURE NYC 2105. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Act III (time travel), stop 4. The rift from Razorback's reactor spat the brothers out on a neon skyway in 2105.
// Section 1: the skyway. Hovercar traffic lanes (lane flashes + chevrons, then a car screams through), anti-gravity
// pulse pads that fire on the music's beat (jump on the beat!), and security drones whose searchlight locks on.
// Section 2: the rooftop data hub. Boss VIRAL, a rogue digital entity: glitch teleport, adaptive pixel swarms,
// a full-row data beam, and (below 55% HP) she splits into decoy copies. Outro: the rift snaps back toward its
// alien source, Dimension X, which is where Level 13 picks up.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level12_skyway.jpg", BG2 = "levels/level12_datahub.jpg", VSHEET = "levels/level12_viral.webp";
  const VF = { idle: [0, 0, 90, 175], walk: [93, 0, 101, 149], attack: [197, 0, 169, 162], hurt: [369, 0, 107, 150], down: [479, 0, 171, 49] }; // faces right
  const VK = 66 / 175; // Viral stands ~66 world px tall (the brothers are ~62)
  // Painted stage props (levels/level12_props.webp, keyed from chroma-green photoreal renders): hovercars (3 paints),
  // security drone, anti-grav pad, swarm micro-drone; levels/level12_xsky.jpg = the Dimension X sky seen through the rift.
  // Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level12_props.webp", XSKY = "levels/level12_xsky.jpg";
  const PF = { carP: [0, 0, 180, 49], carC: [183, 0, 180, 49], carY: [366, 0, 180, 48], drone: [0, 52, 120, 33], pad: [123, 52, 144, 38], cube: [270, 52, 24, 24] };
  const CARPF = { "#ff3a8a": "carP", "#3ae0ff": "carC", "#ffd23a": "carY", "#9a6aff": "carP" };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function spr(f, x, y, w, h, rot, flip) { // draw a sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null; // per-run module state, cleared on unload
  const fresh = () => ({ cubes: [], clones: [], bolts: [], bits: [], adapt: 0, rift: 0, riftFlash: 0, swing: -1 });

  // ---- Music: original synthwave chase (A minor, 140 BPM) + boss re-key ----
  const BPM = 140, BEAT = 3600 / BPM; // frames per beat (~25.7)
  const CH = ["Am", "Am", "F", "G", "Am", "Am", "Dm", "E", "Am", "Am", "F", "G", "F", "G", "E", "E"];
  const L1 = "A5:2 .:1 A5:1 C6:2 E6:2 D6:2 C6:2 A5:4";
  const music = A.track({ bpm: BPM, loop: true, chords: CH,
    lead: [L1, "E5:2 A5:2 C6:2 E6:2 D6:4 .:4", "F5:2 A5:2 C6:4 F6:2 E6:2 C6:4", "D6:3 .:1 B5:2 G5:2 D6:4 .:4",
      L1, "C6:2 B5:2 A5:2 E5:2 A5:4 .:4", "D6:2 F6:2 A6:4 F6:2 D6:2 A5:4", "G#5:4 B5:4 E6:4 .:4",
      L1, "E6:2 D6:2 C6:2 A5:2 E6:4 A6:4", "A6:2 F6:2 C6:2 A5:2 F5:4 C6:4", "B5:2 D6:2 G6:4 F6:2 D6:2 B5:4",
      "C6:2 F6:2 A6:4 G6:2 F6:2 C6:4", "D6:2 G6:2 B6:4 A6:2 G6:2 D6:4", "E6:4 G#6:4 B6:4 E6:4", "E6:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 12, 0, 12, 0, 12, 7, 12]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 3]),
    drums: A.rep("k.h.s.hkk.h.s.ho", 15).concat(["k.s.s.s.sksksss."]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 182);

  // ---- helpers ----
  const onScr = (api, x, pad) => x - api.camX > -pad && x - api.camX < api.W + pad;
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  // Is the player's current swing touching world point (x, y, z)? Used for things that aren't engine enemies.
  function playerStrikes(p, x, y, z) {
    if (!p || !(p.attackT > 0) || !p.atk || p.deadT > 0) return false;
    const reach = (p.bro && p.bro.reach) || 24, dx = (x - p.x) * p.facing;
    if (p.atk === "power") return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14;
    return dx > -6 && dx < reach + 10 && Math.abs(y - p.y) < 11 && Math.abs(z - p.z) < 34;
  }
  function burst(x, y, n, cols) { if (!G) return; for (let i = 0; i < n; i++) G.bits.push({ x, y, vx: A.rnd(-1.6, 1.6), vy: A.rnd(-2.2, 0.4), t: 0, life: 24 + (Math.random() * 20 | 0), c: cols[i % cols.length] }); }

  // ================= SECTION 1 HAZARDS =================
  // Hovercar traffic: one of three lanes flashes red with chevrons pointing the way the car comes from (60 f),
  // then a hovercar screams across the screen. Step out of the lane (or time a jump over it).
  const LANES = [[171, 184], [187, 200], [203, 216]], T_IDLE = 150, T_WARN = 62, CAR_V = 8.5;
  const CARCOL = [["#ff3a8a", "#7a0a3a"], ["#3ae0ff", "#0a4a6a"], ["#ffd23a", "#6a4a0a"], ["#9a6aff", "#2a1a6a"]];
  const traffic = {
    init: () => ({ t: 40, lane: 0, dir: 1, cars: [], n: 0 }),
    update(st, api, p) {
      st.t++;
      if (st.t === T_IDLE) { // pick a lane: prefer the player's
        const pl = LANES.findIndex(([a, b]) => p.y >= a - 1 && p.y <= b + 1);
        st.lane = Math.random() < 0.6 && pl >= 0 ? pl : Math.random() * 3 | 0; st.dir = Math.random() < 0.5 ? 1 : -1; api.SFX.charge();
      }
      if (st.t === T_IDLE + T_WARN) {
        const [a, b] = LANES[st.lane], x = st.dir > 0 ? api.camX - 70 : api.camX + api.W + 70;
        st.cars.push({ x, y: (a + b) / 2, dir: st.dir, col: CARCOL[st.n++ % 4], hit: new Set() }); api.SFX.rumble(); api.shake(1, 10, true);
        st.t = api.STATE.wave >= 2 ? 40 : 0; // later waves: traffic gets denser
      }
      st.cars = st.cars.filter((c) => {
        c.x += c.dir * CAR_V;
        const [a, b] = LANES[LANES.findIndex((l) => c.y > l[0] && c.y < l[1])] || [c.y - 6, c.y + 6];
        if (canHurt(p) && !c.hit.has(p) && p.y >= a - 1 && p.y <= b + 1 && Math.abs(p.x - c.x) < 22 && p.z < 18) { c.hit.add(p); api.hurtPlayer(2, false, c.dir); api.fx("spark", p.x, p.y - 14, 10); api.SFX.boom(); }
        for (const e of api.enemies) if (hittable(e) && !c.hit.has(e) && e.y >= a - 1 && e.y <= b + 1 && Math.abs(e.x - c.x) < 22) { c.hit.add(e); api.hitEnemy(e, 3, true, c.dir); }
        if (Math.random() < 0.5) api.STATE.fx.push({ kind: "x", x: c.x - c.dir * 22, y: c.y, t: 0, life: 10, draw: trail });
        return c.dir > 0 ? c.x < api.camX + api.W + 120 : c.x > api.camX - 120;
      });
    },
    drawBack(st, api, cx) {
      if (st.t < T_IDLE || st.t >= T_IDLE + T_WARN) return;
      const [a, b] = LANES[st.lane], k = st.t - T_IDLE, on = Math.floor(k / 5) % 2 === 0, c = api.ctx;
      c.save(); c.globalAlpha = on ? 0.32 : 0.16; api.rect(0, a - 2, api.W, b - a + 4, "#ff2a4a"); c.restore();
      api.rect(0, a - 2, api.W, 1, on ? "#ff6a7a" : "#8a1a2a"); api.rect(0, b + 2, api.W, 1, on ? "#ff6a7a" : "#8a1a2a");
      for (let i = 0; i < 9; i++) { // big chevrons sliding the way the car will travel
        const x = Math.round(((i * 48 + k * 3 * st.dir) % 432 + 432) % 432 - 24), y = Math.round((a + b) / 2);
        for (let j = 0; j < 5; j++) { api.rect(x + st.dir * j * 2, y - 5 + j, 3, 1, "#ffe0e4"); api.rect(x + st.dir * j * 2, y + 5 - j, 3, 1, "#ffe0e4"); }
      }
      const ex = st.dir > 0 ? 14 : api.W - 14; // warning beacon on the side the car comes from
      api.rect(ex - 9, a - 22, 18, 14, on ? "#ff2a3a" : "#5a0a14"); api.ptext("!", ex, a - 20, 2, on ? "#ffe060" : "#ff8a8a");
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = on ? 0.8 : 0.3; glow(c, ex, (a + b) / 2, 30, "rgba(255,40,60,0.9)"); c.restore();
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const car of st.cars) {
        const x = car.x - cx, y = car.y, z = 7 + Math.sin(api.t * 0.4) * 1, d = car.dir;
        if (x < -80 || x > api.W + 80) continue;
        c.save(); c.globalAlpha = 0.45; c.fillStyle = "#000"; c.beginPath(); c.ellipse(x, y + 1, 26, 4, 0, 0, 6.29); c.fill(); c.restore();
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6; glow(c, x, y - 2, 22, car.col[0]); c.restore();
        const by = y - z;
        const cf = PF[CARPF[car.col[0]] || "carP"];
        if (spr(cf, x + d, by - 5, 62, 62 * cf[3] / cf[2], 0, d < 0)) continue; // painted hovercar (faces its travel direction)
        c.fillStyle = car.col[1]; c.beginPath(); c.moveTo(x - d * 26, by - 4); c.lineTo(x + d * 24, by - 2); c.lineTo(x + d * 28, by + 2); c.lineTo(x - d * 24, by + 3); c.closePath(); c.fill();
        c.fillStyle = car.col[0]; c.beginPath(); c.moveTo(x - d * 24, by - 4); c.lineTo(x - d * 8, by - 13); c.lineTo(x + d * 10, by - 12); c.lineTo(x + d * 24, by - 2); c.closePath(); c.fill();
        c.fillStyle = "#1a2a3a"; c.beginPath(); c.moveTo(x - d * 6, by - 11); c.lineTo(x + d * 9, by - 10); c.lineTo(x + d * 16, by - 4); c.lineTo(x - d * 4, by - 4); c.closePath(); c.fill();
        api.rect(x + d * 2, by - 9, 6, 1, "#9ad8ff");
        api.rect(x + (d > 0 ? 22 : -26), by - 1, 4, 2, "#ffffe0"); api.rect(x - (d > 0 ? 28 : -24), by - 2, 4, 2, "#ff3a3a");
        api.rect(x - 20, by + 3, 40, 1, api.t % 4 < 2 ? "#7ff8ff" : "#ff7af0"); // anti-grav strip
      }
    },
  };
  function trail(api, f, sx) { const a = 1 - f.t / f.life; api.ctx.globalAlpha = a * 0.7; api.rect(sx - 8, f.y - 8, 16, 1, "#ffffff"); api.rect(sx - 12, f.y - 4, 24, 1, "#7ff8ff"); api.ctx.globalAlpha = 1; }

  // Anti-gravity pulse pads: beat lights count up with the music tempo; the last 2 beats glow white with a "!",
  // then the pad fires an upward pulse that flings anyone standing on it (jump on the beat to ride it out).
  const P_CYC = Math.round(BEAT * 8), P_WARN = Math.round(BEAT * 6), PRX = 21, PRY = 7;
  const pads = {
    init: () => ({ list: [[420, 192, 0], [760, 178, 4], [980, 206, 0], [1320, 190, 4], [1560, 180, 0], [1700, 206, 4], [2000, 192, 0], [2240, 182, 4]].map(([x, y, o]) => ({ x, y, o: Math.round(o * BEAT), col: 0 })) }),
    update(st, api, p) {
      for (const q of st.list) {
        const t = (api.t + q.o) % P_CYC;
        if (q.col > 0) q.col--;
        if (t === P_WARN && onScr(api, q.x, 10)) api.SFX.charge();
        if (t !== 0) continue;
        q.col = 20;
        if (!onScr(api, q.x, 30)) continue;
        api.SFX.zap();
        if (canHurt(p) && p.z < 3 && Math.abs(p.x - q.x) < PRX && Math.abs(p.y - q.y) < PRY) { api.hurtPlayer(1, false, p.x < q.x ? -1 : 1); p.vz = 4.2; }
        for (const e of api.enemies) if (hittable(e) && e.z < 3 && Math.abs(e.x - q.x) < PRX && Math.abs(e.y - q.y) < PRY) { api.hitEnemy(e, 1, true, e.x < q.x ? -1 : 1); e.vz = 5.2; }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const q of st.list) {
        const x = Math.round(q.x - cx), y = q.y; if (x < -30 || x > api.W + 30) continue;
        const t = (api.t + q.o) % P_CYC, beat = Math.floor(t / BEAT), warn = t >= P_WARN;
        if (spr(PF.pad, x, y + 1, (PRX + 3) * 2, (PRY + 2.5) * 2)) { // painted pad; warn = white-hot core flash
          if (warn) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.floor(t / 4) % 2 ? 0.55 : 0.25; c.fillStyle = "#bff4ff"; c.beginPath(); c.ellipse(x, y, PRX - 3, PRY - 2, 0, 0, 6.29); c.fill(); c.restore(); }
        } else {
        c.fillStyle = "#14121e"; c.beginPath(); c.ellipse(x, y, PRX + 2, PRY + 1, 0, 0, 6.29); c.fill();
        c.fillStyle = warn ? (Math.floor(t / 4) % 2 ? "#d8f8ff" : "#5ae0ff") : "#1e3a4e"; c.beginPath(); c.ellipse(x, y, PRX, PRY, 0, 0, 6.29); c.fill();
        c.fillStyle = "#0c1622"; c.beginPath(); c.ellipse(x, y, PRX - 4, PRY - 2, 0, 0, 6.29); c.fill();
        }
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = warn ? 0.85 : 0.3 + 0.1 * Math.sin(api.t * 0.2); glow(c, x, y, warn ? 26 : 16, "rgba(90,220,255,0.9)"); c.restore();
        for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283, lit = i < beat; api.rect(x + Math.cos(an) * (PRX - 2) - 1, y + Math.sin(an) * (PRY - 1), 2, 1, lit ? (warn ? "#ffffff" : "#7ff8ff") : "#24384a"); }
        if (warn && (t >> 2) % 3) api.ptext("!", x, y - 24, 2, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const q of st.list) {
        if (q.col <= 0) continue;
        const x = q.x - cx; if (x < -30 || x > api.W + 30) continue;
        const k = q.col / 20, h = 90 * (1 - k * 0.3);
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = k;
        const g = c.createLinearGradient(0, q.y, 0, q.y - h); g.addColorStop(0, "rgba(160,250,255,0.9)"); g.addColorStop(1, "rgba(90,120,255,0)");
        c.fillStyle = g; c.fillRect(x - PRX + 3, q.y - h, (PRX - 3) * 2, h);
        for (let i = 0; i < 3; i++) { c.strokeStyle = "rgba(220,255,255,0.8)"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, q.y - (1 - k) * 60 - i * 14, PRX - i * 3, PRY - i, 0, 0, 6.29); c.stroke(); }
        c.restore();
      }
    },
  };

  // Security drones: hover in from a side, sweep a searchlight across the deck. If the light finds you it turns
  // red, a reticle locks (follows 20 f, then holds still 32 f) and a zap bolt strikes that spot. Two shots, then it leaves.
  const drones = {
    init: () => ({ d: null, cd: 260 }),
    update(st, api, p) {
      if (!st.d) {
        if (api.STATE.phase === "boss" || --st.cd > 0) return;
        const side = Math.random() < 0.5 ? -1 : 1;
        st.d = { x: side < 0 ? api.camX - 30 : api.camX + api.W + 30, y: 193, ph: "in", t: 0, side, shots: 0, lx: 0 };
        return;
      }
      const d = st.d; d.t++;
      const home = api.camX + api.W / 2 + Math.sin(d.t * 0.012) * 120;
      if (d.ph === "in") { d.x += (home - d.x) * 0.04; if (d.t > 60) { d.ph = "scan"; d.t = 0; } }
      if (d.ph === "scan") {
        d.x += (home - d.x) * 0.03; d.lx = d.x + Math.sin(d.t * 0.045) * 46; d.ly = 192 + Math.sin(d.t * 0.031) * 18;
        if (canHurt(p) && Math.abs(p.x - d.lx) < 18 && Math.abs(p.y - d.ly) < 9 && d.t > 30) { d.ph = "lock"; d.t = 0; d.rx = p.x; d.ry = p.y; api.SFX.charge(); }
        if (d.t > 600) { d.ph = "out"; d.t = 0; }
      } else if (d.ph === "lock") {
        if (d.t < 20) { d.rx += (p.x - d.rx) * 0.25; d.ry += (p.y - d.ry) * 0.25; }
        d.lx = d.rx; d.ly = d.ry;
        if (d.t === 52) {
          api.SFX.zap(); api.fx("spark", d.rx, d.ry - 4, 10); api.shake(2, 6, true);
          if (canHurt(p) && Math.abs(p.x - d.rx) < 13 && Math.abs(p.y - d.ry) < 7 && p.z < 20) api.hurtPlayer(1, false, p.x < d.rx ? -1 : 1);
          for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - d.rx) < 13 && Math.abs(e.y - d.ry) < 7) api.hitEnemy(e, 2, true, e.x < d.rx ? -1 : 1);
        }
        if (d.t >= 64) { d.shots++; d.ph = d.shots >= 2 ? "out" : "scan"; d.t = 0; }
      } else if (d.ph === "out") { d.x += d.side * 2.4; if (Math.abs(d.x - api.camX - api.W / 2) > api.W) { st.d = null; st.cd = 330; } }
    },
    drawFront(st, api, cx) {
      const d = st.d; if (!d) return;
      const c = api.ctx, x = d.x - cx, y = 64 + Math.sin(d.t * 0.1) * 3, lock = d.ph === "lock";
      if (d.ph === "scan" || lock) { // light cone
        const lx = d.lx - cx, ly = d.ly, col = lock ? "rgba(255,50,60," : "rgba(160,240,255,";
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = lock ? 0.35 : 0.22;
        c.fillStyle = col + "0.6)"; c.beginPath(); c.moveTo(x - 3, y + 6); c.lineTo(lx - 18, ly); c.lineTo(lx + 18, ly); c.lineTo(x + 3, y + 6); c.closePath(); c.fill();
        c.globalAlpha = lock ? 0.6 : 0.4; c.beginPath(); c.ellipse(lx, ly, 18, 8, 0, 0, 6.29); c.fill(); c.restore();
        if (lock) {
          const r = d.t < 20 ? 14 : 9, colr = d.t % 6 < 3 ? "#ff3a3a" : "#ffe060";
          c.strokeStyle = colr; c.lineWidth = 1; c.beginPath(); c.ellipse(lx, ly, r, r * 0.45, 0, 0, 6.29); c.stroke();
          api.rect(lx - r - 3, ly, 5, 1, colr); api.rect(lx + r - 2, ly, 5, 1, colr); api.rect(lx, ly - 7, 1, 4, colr);
          if (d.t >= 52 && d.t < 60) { c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = "#e8faff"; c.lineWidth = 2; c.beginPath(); let px = x, py = y + 6; c.moveTo(px, py); for (let i = 1; i <= 6; i++) { px = x + (lx - x) * i / 6 + (i < 6 ? api.rnd(-5, 5) : 0); py = y + 6 + (ly - y - 6) * i / 6; c.lineTo(px, py); } c.stroke(); glow(c, lx, ly, 20, "rgba(160,230,255,0.9)"); c.restore(); }
        }
      }
      // drone body
      if (spr(PF.drone, x, y - 1, 42, 42 * PF.drone[3] / PF.drone[2])) {
        c.save(); c.globalCompositeOperation = "lighter"; glow(c, x, y + 5, lock ? 7 : 5, lock ? (d.t % 4 < 2 ? "rgba(255,60,60,1)" : "rgba(255,170,170,0.9)") : "rgba(140,250,255,0.9)"); c.restore();
        if (lock && d.t < 52 && (d.t >> 2) % 3) api.ptext("!", x + 24, y - 8, 2, "#ffe060");
        return;
      }
      api.rect(x - 11, y - 3, 22, 7, "#2a2e3a"); api.rect(x - 11, y - 3, 22, 1, "#6a7488"); api.rect(x - 16, y - 5, 6, 2, "#4a5262"); api.rect(x + 10, y - 5, 6, 2, "#4a5262");
      api.rect(x - 18 + (api.t % 3), y - 7, 9, 1, "#9aa4b8"); api.rect(x + 9 + (api.t % 3), y - 7, 9, 1, "#9aa4b8");
      api.rect(x - 3, y + 3, 6, 3, lock ? (d.t % 4 < 2 ? "#ff3a3a" : "#ffb0b0") : "#7ff8ff");
      if (lock && d.t < 52 && (d.t >> 2) % 3) api.ptext("!", x + 24, y - 8, 2, "#ffe060");
    },
  };

  // ================= THE DATA HUB (boss arena) =================
  const MONO = { x: 192, y: 150 }, RIFT = { x: 192, y: 16 };
  const boss = () => A.enemies.find((e) => e.boss);
  const hub = {
    init: () => { G = fresh(); return {}; },
    update(st, api, p) {
      if (!G) return;
      const b = boss(), alive = b && b.state !== "dying";
      G.rift = Math.max(0, G.rift - 0.01);
      // pixel-swarm drones: orbit, then dive at the player's (predicted) position
      G.cubes = G.cubes.filter((q) => {
        q.t++;
        if (q.ph === "orbit") {
          const o = b || q; const an = q.a + q.t * 0.12, r = 18 + q.t * 0.1;
          q.x = o.x + Math.cos(an) * r; q.y = o.y + Math.sin(an) * 6; q.z = 40 + Math.sin(an * 2) * 8;
          if (q.t >= q.go) { q.ph = "dive"; q.t = 0; const lead = 8 + G.adapt * 9; q.tx = p.x + (p.x - (q.px || p.x)) * lead + api.rnd(-6, 6); q.ty = Math.max(api.floorTop, Math.min(api.floorBot, p.y + api.rnd(-4, 4))); q.x0 = q.x; q.y0 = q.y; q.z0 = q.z; api.SFX.swing(); }
          q.px = p.x;
        } else if (q.ph === "dive") {
          const k = Math.min(1, q.t / q.dv); q.x = api.lerp(q.x0, q.tx, k); q.y = api.lerp(q.y0, q.ty, k); q.z = api.lerp(q.z0, 4, k);
          if (k >= 1) { q.ph = "hunt"; q.t = 0; }
        } else { // hunt: slow homing, then fizzle
          q.x += Math.sign(p.x - q.x) * Math.min(0.6 + G.adapt * 0.15, Math.abs(p.x - q.x)); q.y += Math.sign(p.y - q.y) * Math.min(0.4, Math.abs(p.y - q.y)); q.z = 6 + Math.sin(q.t * 0.3) * 3;
          if (q.t > 110) { burst(q.x, q.y - q.z, 3, ["#7aff5a", "#1a3a1a"]); return false; }
        }
        if (q.ph !== "orbit" && canHurt(p) && Math.abs(p.x - q.x) < 7 && Math.abs(p.y - q.y) < 6 && Math.abs(p.z + 14 - q.z) < 18) { api.hurtPlayer(1); burst(q.x, q.y - q.z, 5, ["#7aff5a", "#ffffff"]); return false; }
        if (playerStrikes(p, q.x, q.y, Math.max(0, q.z - 14))) { api.SFX.clink(); burst(q.x, q.y - q.z, 6, ["#7aff5a", "#d8ffd0", "#1a3a1a"]); return false; }
        return alive || q.ph !== "orbit";
      });
      // decoy copies: shuffle into place, then pelt the player with data bolts; one hit pops a decoy
      G.clones = G.clones.filter((cl) => {
        cl.t++;
        if (cl.t < 40) { cl.x = api.lerp(cl.x0, cl.tx, cl.t / 40); cl.y = api.lerp(cl.y0, cl.ty, cl.t / 40); }
        else {
          cl.facing = p.x < cl.x ? -1 : 1;
          if (cl.t % 150 === 60) cl.cast = 34; // telegraph: palm glows, "!" flicker
          if (cl.cast > 0 && --cl.cast === 0) { const dx = p.x - cl.x, dy = p.y - cl.y, n = Math.hypot(dx, dy) || 1; G.bolts.push({ x: cl.x + cl.facing * 14, y: cl.y, z: 34, vx: dx / n * 2.4, vy: dy / n * 2.4 * 0.5, t: 0 }); api.SFX.gun(); }
          const dx = p.x - cl.x; if (Math.abs(dx) > 70) cl.x += Math.sign(dx) * 0.4; if (Math.abs(p.y - cl.y) > 3) cl.y += Math.sign(p.y - cl.y) * 0.3;
        }
        if (cl.t > 30 && playerStrikes(p, cl.x, cl.y, 10)) { popClone(api, cl, true); return false; }
        if (!alive || cl.t > 720) { popClone(api, cl, false); return false; }
        return true;
      });
      G.bolts = G.bolts.filter((s) => {
        s.t++; s.x += s.vx; s.y += s.vy; s.z = Math.max(16, s.z - 0.3);
        if (canHurt(p) && Math.abs(p.x - s.x) < 7 && Math.abs(p.y - s.y) < 6 && p.z < 22) { api.hurtPlayer(1, false, s.vx > 0 ? 1 : -1); burst(s.x, s.y - s.z, 5, ["#7aff5a", "#ffffff"]); return false; }
        return s.t < 200 && s.x > api.camX - 20 && s.x < api.camX + api.W + 20 && s.y > api.floorTop - 10 && s.y < api.floorBot + 10;
      });
      G.bits = G.bits.filter((g) => { g.t++; g.x += g.vx; g.y += g.vy; g.vy += G.suck ? -0.12 : 0.08; if (G.suck) g.vx += (RIFT.x - g.x) * 0.002; return g.t < g.life; });
      if (alive && Math.random() < 0.12) G.bits.push({ x: MONO.x + api.rnd(-26, 26), y: MONO.y - api.rnd(10, 110), vx: api.rnd(-0.2, 0.2), vy: -api.rnd(0.2, 0.8), t: 0, life: 50, c: Math.random() < 0.5 ? "#7aff5a" : "#ff5af0" });
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx, t = api.t, p = api.player;
      c.save(); c.globalCompositeOperation = "lighter"; // monolith hum + rift
      c.globalAlpha = 0.25 + 0.1 * Math.sin(t * 0.07); glow(c, MONO.x - cx, MONO.y - 60, 60, "rgba(120,255,110,0.6)");
      c.globalAlpha = Math.min(1, 0.35 + G.rift * 0.65 + 0.1 * Math.sin(t * 0.13)); glow(c, RIFT.x - cx, RIFT.y, 40 + G.rift * 120, "rgba(200,90,255,0.9)");
      c.restore();
      for (const cl of G.clones) if (cl.y <= p.y) drawViral(api, cl, cl.x - cx, cl.y, true);
      drawBolts(api, cx, false);
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const p = api.player;
      for (const cl of G.clones) if (cl.y > p.y) drawViral(api, cl, cl.x - cx, cl.y, true);
      drawBolts(api, cx, true);
      for (const q of G.cubes) { // swarm cubes
        const x = Math.round(q.x - cx), y = Math.round(q.y - q.z), s = q.ph === "orbit" ? 4 : 5;
        api.shadow(x, q.y, q.z, 4);
        api.ctx.save(); api.ctx.globalCompositeOperation = "lighter"; api.ctx.globalAlpha = 0.6; glow(api.ctx, x, y, 8, "rgba(120,255,90,0.9)"); api.ctx.restore();
        if (spr(PF.cube, x, y, s + 3, s + 3, (q.t + q.a * 10) * 0.08)) { // painted micro-drone + bright core so it reads at speed
          api.ctx.save(); api.ctx.globalCompositeOperation = "lighter"; api.ctx.globalAlpha = api.t % 6 < 3 ? 0.9 : 0.6; glow(api.ctx, x, y, 5, "rgba(170,255,140,1)"); api.ctx.restore();
        } else {
        api.rect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2, "#0a1a0a");
        api.rect(x - s / 2, y - s / 2, s, s, api.t % 6 < 3 ? "#7aff5a" : "#c8ffb8"); api.rect(x - s / 2, y - s / 2, s, 1, "#ffffff"); }
        if (q.ph === "orbit" && q.t > q.go - 24) { const tx = p.x - cx; api.ctx.save(); api.ctx.globalAlpha = 0.35; api.ctx.strokeStyle = "#7aff5a"; api.ctx.setLineDash([2, 3]); api.ctx.beginPath(); api.ctx.moveTo(x, y); api.ctx.lineTo(tx, p.y); api.ctx.stroke(); api.ctx.restore(); }
      }
      for (const g of G.bits) api.rect(g.x - cx, g.y, 2, 2, g.c);
    },
  };
  function drawBolts(api, cx, front) {
    const p = api.player;
    for (const s of G.bolts) {
      if ((s.y > p.y) !== front) continue;
      const x = s.x - cx, y = s.y - s.z; api.shadow(x, s.y, s.z, 3);
      api.ctx.save(); api.ctx.globalCompositeOperation = "lighter"; glow(api.ctx, x, y, 7, "rgba(120,255,90,0.9)"); api.ctx.restore();
      api.rect(x - 2, y - 1, 4, 3, "#e8ffe0");
    }
  }
  function popClone(api, cl, hit) {
    burst(cl.x, cl.y - 30, hit ? 22 : 12, ["#7aff5a", "#ff5af0", "#1a1a1a", "#d8ffd0"]);
    if (hit) { api.SFX.clink(); api.fx("pop", cl.x, cl.y - 50, 30); api.STATE.stop = Math.max(api.STATE.stop, 2); }
    api.STATE.fx.push({ kind: "x", x: cl.x, y: cl.y - 70, t: 0, life: 40, draw: (a, f, sx) => a.ptext(hit ? "DECOY!" : "", sx, f.y - f.t * 0.3, 1, "#7aff5a") });
  }

  // ---- Viral: sprite + glitch rendering ----
  function viralFrame(e) {
    const s = e.state;
    if (s === "down" || s === "dying") return "down";
    if (s === "hurt" || s === "stagger" || s === "warp" || s === "rage") return s === "rage" && e.t > 40 ? "attack" : "hurt";
    if (["fire", "kick", "throw", "summon"].includes(s) || (s === "kwind" && e.t > 4)) return "attack";
    if (s === "charge" || s === "tele" || (e.walkT > 0 && Math.floor(e.walkT / 12) % 2)) return "walk";
    return "idle";
  }
  function drawViral(api, e, sx, sy, decoy) {
    const sheet = api.img(VSHEET), c = api.ctx, t = api.t + (decoy ? (e.seed || 0) : 0);
    const fr = decoy ? (e.cast > 0 ? "attack" : e.t < 40 ? "walk" : "idle") : viralFrame(e);
    const z = e.z || 0, bob = fr === "idle" ? Math.sin(t * 0.08) * 1.5 : 0, y = sy - z + bob - (fr === "down" ? 0 : 2);
    const warpK = e.state === "warp" ? e.wk || 0 : 0; // 0 = solid, 1 = fully dissolved
    if (warpK < 0.6) api.contactShadow(sx, sy, z, 12);
    if (warpK >= 0.98) return;
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 0.15); glow(c, sx, y - 34, 34, "rgba(90,255,110,0.55)"); c.restore();
    if (!sheet) { api.rect(sx - 8, y - 60, 16, 60, "#1a2a1a"); api.rect(sx - 8, y - 60, 16, 2, "#7aff5a"); return; }
    const F = VF[fr], k = VK * (decoy ? 1 : (e.cfg && e.cfg.scale) || 1), w = F[2] * k, h = F[3] * k, f = e.facing || -1;
    const glitchy = warpK > 0 || e.state === "rage" || (decoy && t % 36 < 7) || (!decoy && t % 140 < 3) || e.state === "tele";
    c.save(); if (warpK > 0) c.globalAlpha = 1 - warpK; else if (decoy) c.globalAlpha = 0.86;
    if (!glitchy) api.drawFrame(sheet, F, sx, y, k, f);
    else { // horizontal slice displacement + RGB split
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y0 = y - h + (h * i) / n, off = (api.hash(Math.floor(t / 3) * 13 + i) - 0.5) * (6 + warpK * 30);
        c.save(); c.beginPath(); c.rect(sx - w - 30, y0, w * 2 + 60, h / n + 0.5); c.clip(); api.drawFrame(sheet, F, sx + off, y, k, f); c.restore();
      }
      c.globalCompositeOperation = "lighter"; c.globalAlpha = (1 - warpK) * 0.35; api.drawFrame(sheet, F, sx + 2, y, k, f);
    }
    c.restore();
    if (e.state === "tele" && t % 6 < 3) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; glow(c, sx, y - 30, 30, "rgba(255,60,80,0.9)"); c.restore(); }
    if (decoy && e.cast > 0) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, sx + f * 18, y - 40, 10, "rgba(140,255,100,1)"); c.restore(); if (Math.floor(e.cast / 5) % 2) api.ptext("!", sx, y - h - 8, 2, "#ffe060"); }
  }

  // ---- VIRAL: boss AI on top of the engine's ramrod base ----
  const P2CFG = { speed: 1.35, chargeSpeed: 1.35, cool: 66 };
  const LINES = {
    intro: "WELCOME TO 2105, TURTLES. THIS CITY RUNS ON ME.",
    hit: ["CORRUPTED DATA!", "YOU CAN'T PUNCH CODE!", "SYSTEM... RECALIBRATING.", "ANNOYING LITTLE GLITCHES."],
    summon: "WHICH ONE OF ME IS REAL?",
    ko: "ERROR... ERROR... THE RIFT... IS PULLING ME...",
  };
  function pick(api, e, p) {
    const dx = p.x - e.x, dy = p.y - e.y, ax = Math.abs(dx);
    e.t = 0; e.cool = e.cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 30 && Math.random() < 0.6) { e.state = "kwind"; return; }
    const opts = ["warp", "warp", "fire", "fire", "throw"];
    if (Math.abs(dy) < 6) opts.push("tele");
    if (e.p2 && !(e.sumCd > 0) && G.clones.length === 0) opts.push("summon", "summon");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.7) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m; e.state = m;
  }
  // ---- Boss entrance (entr v1): the rift flares, Viral compiles out of the data monolith pixel by pixel, glitches and steps into the arena ----
  const VR_ENTR = {
    len: 165, zoom: 1.3, sub: "THE GHOST IN THE MACHINE",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: MONO.x, y: 178, z: 0, facing: -1, state: "boot", t: 0 }); G.rift = 0.9; api.SFX.zap(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - 40 }),
    step(api, e, st, t) {
      if (!G) return;
      G.bits = G.bits.filter((g) => { g.t++; g.x += g.vx; g.y += g.vy; g.vy += 0.08; return g.t < g.life; });
      G.rift = Math.max(0.3, G.rift - 0.004);
      const mid = (api.floorTop + api.floorBot) / 2;
      if (t <= 78) { e.state = "boot"; e.t = Math.round(t * 90 / 78); if (t % 2 === 0) G.bits.push({ x: e.x + api.rnd(-22, 22), y: e.y - api.rnd(0, 76), vx: 0, vy: 0.6, t: 0, life: 20, c: t % 4 ? "#7aff5a" : "#ff5af0" });
        if (t % 16 === 0) api.SFX.zap(); return; }
      if (t === 79) { api.entr.impact(e.x, e.y, 5, { sfx: "charge", stop: 4, ring: true, puffs: 0 }); burst(e.x, e.y - 40, 18, ["#7aff5a", "#ff5af0", "#ffffff"]); G.rift = 1.2; }
      if (t > 79 && t < 96) { e.state = "walk"; e.walkT = 0; e.entrAlpha = (t % 4 < 2) ? 0.35 : 1; e.x = MONO.x + ((t % 6) - 3); }
      if (t >= 96 && t < 130) { e.entrAlpha = undefined; e.x = MONO.x; e.state = "walk"; e.walkT = (e.walkT || 0) + 1; e.y = api.lerp(178, mid, (t - 96) / 34); }
      if (t >= 130) { e.state = "kick"; e.t = 4; e.walkT = 0; if (t === 130) { api.SFX.swing(); burst(e.x - 12, e.y - 30, 6, ["#7aff5a"]); } }
    },
  };
  const bossCfg = {
    name: "VIRAL", base: "ramrod", atlas: "ninja", scale: 1, height: 74, hp: 46, speed: 1.15, chargeSpeed: 1.25, cool: 88, pitch: 160,
    moves: ["charge", "kick", "fire"], shot: "ray", lines: LINES,
    spawn(api, e) { Object.assign(e, { state: "boot", t: 0, x: MONO.x, y: 178, z: 0, facing: -1, inv: 999, sumCd: 400 }); },
    entrance: VR_ENTR,
    update(api, e, p) {
      if (!G) G = fresh();
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "boot") { // assembles out of the monolith pixel by pixel
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1; e.wk = Math.max(0, 1 - e.t / 90);
        if (e.t < 90 && e.t % 3 === 0) G.bits.push({ x: e.x + api.rnd(-20, 20), y: e.y - api.rnd(0, 70), vx: 0, vy: 0.6, t: 0, life: 20, c: "#7aff5a" });
        if (e.t === 1) { api.SFX.zap(); G.rift = 0.6; }
        if (e.t === 96) api.enemySay(e, LINES.intro, 120, 160, true);
        if (e.t >= 200) { e.inv = 0; e.state = "walk"; e.t = 0; e.cool = 40; e.wk = 0; }
        return true;
      }
      if (e.state === "rage") { // 55% HP: overload, splits into copies
        e.inv = 2;
        if (e.t === 1) { api.enemySay(e, "YOU CAN'T DELETE WHAT'S EVERYWHERE!", 110, 150, true); api.SFX.rumble(); G.rift = 1; }
        if (e.t % 8 === 0) { api.shake(2, 6, true); burst(e.x + api.rnd(-10, 10), e.y - api.rnd(10, 60), 3, ["#7aff5a", "#ff5af0"]); }
        if (e.t === 80) split(api, e, p, 2);
        if (e.t >= 120) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2CFG); e.state = "walk"; e.t = 0; e.cool = 30; e.sumCd = 900; api.playerBark(true, "SHE SPLIT! THE FAKES GLITCH MORE!"); }
        return true;
      }
      if (e.state === "walk" && !e.p2 && e.hp <= e.maxHp * 0.55) { e.state = "rage"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { pick(api, e, p); return true; }
      if (e.state === "warp") { // glitch teleport: dissolve, ghost marker at the destination, re-form behind you and strike
        e.inv = 2;
        if (e.t === 1) { e.side = p.facing || 1; e.tx = p.x - e.side * 26; e.ty = p.y; api.SFX.zap(); }
        if (e.t <= 20) e.wk = e.t / 20;
        else if (e.t < 62) { e.wk = 1; e.tx = api.lerp(e.tx, p.x - e.side * 26, 0.05); e.ty = api.lerp(e.ty, p.y, 0.08); e.tx = Math.max(api.camX + 16, Math.min(api.camX + api.W - 16, e.tx)); }
        else if (e.t === 62) { e.x = e.tx; e.y = e.ty; e.facing = p.x >= e.x ? 1 : -1; api.SFX.zap(); burst(e.x, e.y - 30, 10, ["#7aff5a", "#ff5af0"]); }
        else { e.wk = Math.max(0, 1 - (e.t - 62) / 10); if (e.t >= 72) { e.wk = 0; e.inv = 0; e.state = "kwind"; e.t = 0; } }
        return true;
      }
      if (e.state === "fire") { // data beam: charge a targeting line along her row, then a full-width beam
        if (e.t === 1) { e.facing = p.x >= e.x ? 1 : -1; api.SFX.charge(); }
        if (e.t < 46 && e.t < 24) e.y += Math.sign(p.y - e.y) * Math.min(0.6, Math.abs(p.y - e.y)); // aims during the first half of the charge only
        if (e.t === 46) { api.SFX.zap(); api.shake(3, 16, true); }
        if (e.t >= 46 && e.t < 76) {
          const x0 = e.x + e.facing * 16;
          if (canHurt(p) && Math.abs(p.y - e.y) < 7 && (p.x - x0) * e.facing > -4 && p.z < 26) api.hurtPlayer(2, false, e.facing);
          for (const m of api.enemies) if (hittable(m) && Math.abs(m.y - e.y) < 7 && (m.x - x0) * e.facing > 0) api.hitEnemy(m, 2, true, e.facing);
        }
        if (e.t >= 90) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "throw") { // pixel swarm; each use it adapts (leads its dives further, more drones, faster homing)
        if (e.t === 8) {
          const n = 5 + Math.min(3, G.adapt);
          for (let i = 0; i < n; i++) G.cubes.push({ ph: "orbit", t: 0, a: i / n * 6.283, go: 50 + i * 9, dv: Math.max(14, 24 - G.adapt * 3), x: e.x, y: e.y, z: 40 });
          api.SFX.shuriken();
          if (G.adapt > 0) api.STATE.fx.push({ kind: "x", x: e.x, y: e.y - 80, t: 0, life: 60, draw: (a, f, sx) => a.ptext("SWARM ADAPTING...", sx, f.y - f.t * 0.2, 1, "#7aff5a") });
          G.adapt++;
        }
        if (e.t >= 40) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "summon") { // split into decoys
        if (e.t === 10) { api.enemySay(e, LINES.summon, 80, 160); split(api, e, p, 2); e.sumCd = 1000; }
        if (e.t >= 50) { e.state = "walk"; e.t = 0; }
        return true;
      }
      return false; // walk / tele+charge / kwind+kick: the engine's moves
    },
    draw(api, e, sx, sy) {
      if (e.state === "boot") { e.wk = Math.max(0, 1 - e.t / 90); const s = e.state; e.state = "warp"; drawViral(api, e, sx, sy, false); e.state = s; return; }
      if (e.state === "warp" && e.t > 20 && e.t <= 62) { // ghost marker where she will re-form
        const gx = e.tx - api.camX, gy = e.ty, c = api.ctx;
        c.save(); c.globalAlpha = 0.25 + 0.25 * ((e.t >> 2) % 2); c.strokeStyle = "#7aff5a"; c.setLineDash([2, 2]); c.beginPath(); c.ellipse(gx, gy, 12, 4, 0, 0, 6.29); c.stroke(); c.restore();
        const sh = api.img(VSHEET); if (sh) { c.save(); c.globalAlpha = 0.3 + 0.2 * ((e.t >> 2) % 2); api.drawFrame(sh, VF.idle, gx + ((e.t >> 1) % 3 - 1), gy - 2, VK, api.player.x >= e.tx ? 1 : -1); c.restore(); }
        for (let i = 0; i < 6; i++) api.rect(gx + api.rnd(-10, 10), gy - api.rnd(4, 60), 2, 2, i % 2 ? "#7aff5a" : "#ff5af0");
        if ((e.t >> 3) % 2) api.ptext("!", gx, gy - 72, 2, "#ffe060");
      }
      if (e.state === "dying") { // dissolving into the floor, pixels drift up toward the rift
        const k = Math.min(1, e.t / 80); api.ctx.save(); api.ctx.globalAlpha = 1 - k * 0.8; drawViral(api, Object.assign({}, e, { state: "down" }), sx, sy, false); api.ctx.restore();
        if (e.t % 2 === 0 && G) G.bits.push({ x: e.x + api.rnd(-22, 22), y: e.y - api.rnd(0, 12), vx: 0, vy: -1, t: 0, life: 50, c: e.t % 4 ? "#7aff5a" : "#ff5af0" });
        return;
      }
      if (e.state === "fire") drawBeam(api, e, sx, sy);
      drawViral(api, e, sx, sy, false);
    },
    onDefeat(api) { if (G) { G.cubes = []; G.bolts = []; G.rift = 1; for (const cl of G.clones) popClone(api, cl, false); G.clones = []; } },
  };
  function split(api, e, p, n) {
    const spots = [api.camX + 70, api.camX + 192, api.camX + 314].sort(() => Math.random() - 0.5);
    const rows = [api.floorTop + 8, (api.floorTop + api.floorBot) / 2, api.floorBot - 6].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) G.clones.push({ x0: e.x, y0: e.y, x: e.x, y: e.y, tx: spots[i], ty: rows[i], t: 0, facing: -1, cast: 0, seed: (i + 1) * 31, state: "idle" });
    e.x = spots[n]; e.y = rows[n]; // the real one jumps to the last spot too (shell game)
    burst(e.x, e.y - 30, 16, ["#7aff5a", "#ff5af0", "#d8ffd0"]); api.SFX.zap(); api.shake(2, 10, true);
  }
  function drawBeam(api, e, sx, sy) {
    const c = api.ctx, t = e.t, f = e.facing, y = sy - 30, x0 = sx + f * 18, x1 = f > 0 ? api.W + 10 : -10;
    if (t < 46) { // targeting: thin flickering line along her row + floor stripe
      c.save(); c.globalAlpha = 0.3 + 0.25 * (t % 6 < 3); api.rect(Math.min(x0, x1), sy - 7, Math.abs(x1 - x0), 14, "#ff2a4a"); c.globalAlpha = 0.9; api.rect(Math.min(x0, x1), sy - 7, Math.abs(x1 - x0), 1, "#ff8a9a"); api.rect(Math.min(x0, x1), sy + 7, Math.abs(x1 - x0), 1, "#ff8a9a"); c.restore();
      if (t % 4 < 3) { c.save(); c.strokeStyle = t % 8 < 4 ? "#7aff5a" : "#ff6a7a"; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.restore(); }
      c.save(); c.globalCompositeOperation = "lighter"; glow(c, x0, y, 6 + t * 0.3, "rgba(140,255,100,1)"); c.restore();
      if ((t >> 2) % 3) api.ptext("!", sx, sy - 84, 3, "#ffe060");
    } else if (t < 76) {
      const w = 7 + Math.sin(t * 0.9) * 2;
      c.save(); c.globalCompositeOperation = "lighter";
      c.fillStyle = "rgba(90,255,90,0.35)"; c.fillRect(Math.min(x0, x1), y - w * 1.6, Math.abs(x1 - x0), w * 3.2);
      c.fillStyle = "rgba(200,255,190,0.8)"; c.fillRect(Math.min(x0, x1), y - w / 2, Math.abs(x1 - x0), w);
      for (let i = 0; i < 18; i++) { const u = api.hash(t * 7 + i); api.rect(x0 + f * u * Math.abs(x1 - x0), y + (api.hash(i * 3 + t) - 0.5) * w * 3, 3, 2, i % 3 ? "#7aff5a" : "#ffffff"); }
      glow(c, x0, y, 18, "rgba(200,255,180,1)"); c.restore();
    }
  }

  // ================= OUTRO: the rift snaps back toward Dimension X =================
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine doesn't tick effects during an outro
      if (!G) G = fresh();
      if (t === 1) { G.suck = true; G.cubes = []; G.bolts = []; st.flash = 0; }
      if (G.bits) G.bits = G.bits.filter((g) => { g.t++; g.vx += (RIFT.x - g.x) * 0.003; g.vy -= 0.08; g.x += g.vx; g.y += g.vy; return g.t < g.life && g.y > 0; });
      if (t < 300 && t % 2 === 0) G.bits.push({ x: api.rnd(40, api.W - 40), y: api.rnd(60, 200), vx: 0, vy: -0.4, t: 0, life: 70, c: Math.random() < 0.5 ? "#7aff5a" : "#c86aff" });
      G.rift = t < 200 ? Math.min(2.2, 1 + t / 90) : Math.max(0, 2.2 - (t - 200) / 14);
      const tx = 150, ty = 196; // brother walks under the rift and looks up
      if (Math.abs(tx - p.x) > 2 || Math.abs(ty - p.y) > 2) { p.x += Math.sign(tx - p.x) * Math.min(1.6, Math.abs(tx - p.x)); p.y += Math.sign(ty - p.y) * Math.min(1, Math.abs(ty - p.y)); p.walkT++; p.facing = tx > p.x ? 1 : -1; } else { p.walkT = 0; p.facing = 1; }
      if (t === 30) api.playerBark(true, "SHE'S GONE... BUT LOOK AT THE RIFT!");
      if (t % 30 === 0 && t < 200) { api.SFX.rumble(); api.shake(2, 14, true); }
      if (t === 130) api.playerBark(true, "IT'S SNAPPING BACK TO WHERE IT CAME FROM...");
      if (t === 200) { api.SFX.boom(); api.SFX.zap(); api.shake(6, 30, true); st.flash = 24; }
      if (st.flash > 0) st.flash--;
      if (t === 250) api.playerBark(true, "DIMENSION X! AFTER IT, BROS!");
      return t > 400;
    },
    draw(api, st, t, cx) {
      const c = api.ctx;
      if (t > 60 && t < 220) { // a glimpse of the alien source through the rift
        const a = Math.min(1, (t - 60) / 50) * (t > 190 ? (220 - t) / 30 : 1), x = RIFT.x - cx, y = RIFT.y + 20, rx = 46 + Math.sin(t * 0.1) * 2, ry = 20;
        c.save(); c.globalAlpha = a * 0.9; c.beginPath();
        for (let i = 0; i <= 24; i++) { const an = i / 24 * 6.283, j = 1 + (api.hash(i + (t >> 2) * 31) - 0.5) * 0.18; c.lineTo(x + Math.cos(an) * rx * j, y + Math.sin(an) * ry * j); }
        c.clip();
        const sky = A.img(XSKY);
        if (ready(sky)) { // painted alien sky: sun + floating rock islands, slow parallax drift
          const sw = rx * 2 + 14, sh = sw * 123 / 288; c.drawImage(sky, x - sw / 2 + Math.sin(t * 0.02) * 6, y - sh / 2 + 4, sw, sh);
        } else {
        const g = c.createRadialGradient(x, y + 4, 0, x, y, rx); g.addColorStop(0, "#ffc8f0"); g.addColorStop(0.35, "#b03aff"); g.addColorStop(0.75, "#3a0a6a"); g.addColorStop(1, "#12041e"); c.fillStyle = g; c.fillRect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8);
        c.fillStyle = "#ff9a3a"; c.beginPath(); c.arc(x + 18, y - 6, 7, 0, 6.29); c.fill(); c.fillStyle = "#ffd28a"; c.beginPath(); c.arc(x + 16, y - 8, 3, 0, 6.29); c.fill(); // alien sun
        for (let i = 0; i < 4; i++) { // floating rock islands drifting in the alien sky
          const px = x - 34 + i * 22 + Math.sin(t * 0.03 + i) * 3, py = y + 4 + (i % 2) * 6 + Math.sin(t * 0.05 + i * 2) * 2, w = 8 + api.hash(i * 7) * 6;
          c.fillStyle = "#1e0a2e"; c.beginPath(); c.moveTo(px - w, py); c.lineTo(px + w, py); c.lineTo(px + w * 0.4, py + 6); c.lineTo(px, py + 10); c.lineTo(px - w * 0.5, py + 5); c.closePath(); c.fill();
          api.rect(px - w, py - 1, w * 2, 1, "#ff6af0");
        }
        }
        c.restore();
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = a * 0.8; glow(c, x, y, rx + 20, "rgba(190,80,255,0.5)");
        c.strokeStyle = t % 6 < 3 ? "#ff8af0" : "#9a5aff"; c.lineWidth = 1.5; c.beginPath();
        for (let i = 0; i <= 24; i++) { const an = i / 24 * 6.283, j = 1 + (api.hash(i + (t >> 2) * 31) - 0.5) * 0.18; c.lineTo(x + Math.cos(an) * rx * j, y + Math.sin(an) * ry * j); }
        c.stroke(); c.restore();
      }
      if (st.flash > 0) { c.globalAlpha = st.flash / 24; api.rect(0, 0, api.W, api.H, "#ffffff"); c.globalAlpha = 1; }
      if (t > 230) { // caption (not THE END: Level 13 continues the story)
        const a = Math.min(1, (t - 230) / 30); c.globalAlpha = 0.5 * a; api.rect(0, 30, api.W, 40, "#05030a"); c.globalAlpha = a;
        api.ptext("THE RIFT SNAPS BACK TO ITS ALIEN SOURCE...", api.W / 2, 40, 1, "#ffffff");
        api.ptext("NEXT STOP: DIMENSION X", api.W / 2, 54, 2, t % 20 < 10 ? "#ff8af0" : "#c86aff"); c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 12,
    name: "FUTURE NYC 2105",
    card: { title: "FUTURE NYC 2105", tagline: "THE RIFT DROPPED US IN THE FAST LANE.", color: "#3ae0ff" },
    music, bossMusic,
    // painted regular enemies (trooper family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_trooper.webp", ENEMY_F = { light: {"idle":[4,2,87,167,38],"walk":[95,2,88,167,38],"walk2":[187,0,90,169,46],"attack":[281,5,114,164,45],"jump":[399,4,84,165,46],"hurt":[487,16,90,153,46],"down":[581,133,170,36,85],"dash":[755,68,152,101,84]}, weapon: {"idle":[4,173,81,171,34],"walk":[89,175,89,169,39],"walk2":[182,177,86,167,42],"attack":[272,180,154,164,51],"jump":[430,182,98,162,52],"hurt":[532,191,108,153,52],"down":[644,307,183,37,91],"throw":[831,182,151,162,77]}, big: {"idle":[4,348,103,171,46],"walk":[111,350,108,169,54],"walk2":[223,352,113,167,58],"attack":[340,349,143,170,51],"jump":[487,360,110,159,48],"hurt":[601,362,103,157,47],"down":[708,471,189,48,94],"shoot":[901,354,141,165,41]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 160, blue: 190, sword: 300, star: 280, gunner: 170, heavy: 290, dasher: 100 },
    images: [VSHEET, PR_IMG, XSKY],
    sections: [
      { bg: BG1, floor: [170, 216], length: 2500, locks: [0, 560, 1180, 1820],
        waves: [["purple", "blue", "purple"], ["gunner", "dasher", "blue", "star"], ["heavy", "sword", "gunner", "dasher"], ["heavy", "gunner", "blue", "dasher", "star"]],
        grade: "rgba(30,10,70,0.10)", weather: "speed", hazards: [traffic, pads, drones],
        sky: "#140c2a", ground: "#22283a" },
      { bg: BG2, floor: [172, 216], length: 384, locks: [], waves: [], hazards: [hub], sky: "#1a0c2a", ground: "#1e2a34" },
    ],
    restructure: { // phase 2: skyway (zone 1) -> defend the hacker bot (twist) -> maglev station (zone 2) -> existing data hub
      split: 0, images: ["levels/level12_ally.webp", "levels/level12_station.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "defend", goal: "kind", title: "HACK THE GATE!", sub: "KEEP THEM OFF THE BOT WHILE IT WORKS", img: "levels/level12_ally.webp", fr: {"bot": [0, 0, 51, 80], "botHack": [54, 0, 86, 80], "botHurt": [143, 0, 47, 80], "botCheer": [193, 0, 77, 96], "gateLock": [273, 0, 65, 180], "gateOpen": [341, 0, 64, 180]},
        gateSpr: "gateLock", gateOpen: "gateOpen", hack: "botHack", hurt: "botHurt", cheer: "botCheer", botX: 250, work: 2400, botHp: 10,
        drip: ["gunner", "dasher", "purple", "dasher"], gap: 140, cap: 4, color: "#5ae0ff" },
      z2bg: "levels/level12_station.jpg", z2: { hazards: [pads, drones] },
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; traffic.init = pads.init = drones.init = hub.init = null; },
  });
})();
