// Level 9: SHADOWS OF EDO. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Act III opener: the reactor blast in Level 8 tore a temporal rift and dropped the brothers into Edo-period Japan.
// Section 1: a village street at dusk. Smoke-bomb ambushes (bombs lob in, burst, ninjas step out of the smoke),
// bamboo spike traps that spring from the road, and archer volleys that rain onto red target marks.
// Section 2: a castle courtyard under the moon. Boss KARAI: twin blades, kunai fans, a dash slash, smoke
// vanish-and-reappear behind you, a clone feint (only the real one casts a shadow) and smoke-bomb ninja ambushes.
// Outro: the rift tears open again and hurls the brothers onto the 17th-century seas (leads to Level 10).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level9_edo.jpg", BG2 = "levels/level9_castle.jpg", SHEET = "levels/level9_karai.png";
  // Karai sprite sheet (faces right, feet at the bottom of each rect)
  const KF = { idle: [1, 1, 128, 179], walk: [132, 1, 94, 188], slash: [229, 1, 165, 175], throw: [397, 1, 144, 192], hurt: [544, 1, 135, 122], down: [682, 1, 194, 38], kunai: [879, 1, 30, 9] };
  // Painted stage props (levels/level9_props.png, keyed from chroma-green comic-ink renders) + the outro's night sea
  // (levels/level9_sea.jpg). Frames [x, y, w, h] in sheet px. Old code art stays as the load fallback.
  const PR_IMG = "levels/level9_props.png", SEA_IMG = "levels/level9_sea.jpg";
  const PF = { ship: [0, 0, 300, 68], stakes: [303, 0, 130, 58], small: [0, 71, 104, 94], dirt: [107, 71, 150, 36], smoke: [260, 71, 96, 67], arrow: [359, 71, 90, 9], bomb: [452, 71, 36, 35] };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function prop(api, f, x, y, w, h) { const im = api.img(PR_IMG); if (!ready(im)) return false; api.ctx.drawImage(im, f[0], f[1], f[2], f[3], x, y, w, h); return true; }
  function propRot(api, f, x, y, w, h, rot, ax, ay) { // rotated about (x, y); (ax, ay) = pivot inside the sprite in 0..1
    const im = api.img(PR_IMG); if (!ready(im)) return false; const c = api.ctx;
    c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(im, f[0], f[1], f[2], f[3], -w * ax, -h * ay, w, h); c.restore(); return true;
  }
  let G = null; // all per-run state; reset on onStart / section entry, cleared on unload
  let redSheet = null, redSrc = null; // cached red-flash copy of the sheet
  const fresh = () => ({ bombs: [], clouds: [], arrows: [], petals: [], clones: [], ambCd: 120, vol: null, volCd: 260, told: {}, introT: 0 });

  // ---- Music: an original koto-flavoured march (A minor / "in" scale feel, 128 BPM) + a re-keyed boss track ----
  const CH = ["Am", "Am", "F", "E", "Am", "Dm", "F", "E", "Am", "Am", "F", "G", "F", "Dm", "E", "E"];
  const K1 = "A5:2 B5:2 C6:4 E6:2 C6:2 B5:4";
  const music = A.track({ bpm: 128, loop: true, chords: CH,
    lead: [K1, "A5:2 .:2 F5:4 E5:4 .:4", "F5:2 A5:2 C6:4 B5:2 A5:2 F5:4", "E5:4 G#5:4 B5:4 .:4",
      K1, "D6:2 C6:2 A5:4 F5:2 D5:2 F5:4", "C6:3 .:1 A5:2 F5:2 A5:4 C6:4", "B5:4 .:2 G#5:2 E5:8",
      "E6:2 F6:2 E6:4 C6:2 B5:2 A5:4", "A5:2 C6:2 E6:4 A6:4 .:4", "F6:2 E6:2 C6:2 A5:2 F5:4 A5:4", "G5:2 B5:2 D6:4 B5:2 G5:2 D5:4",
      "F5:2 A5:2 C6:4 F6:2 E6:2 C6:4", "D6:2 A5:2 F5:4 D5:4 .:4", "E5:2 F5:2 G#5:2 B5:2 E6:4 .:4", "E6:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k...s..hk.k.s..h", 15).concat(["k.s.k.s.s.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 182);

  // ---- helpers ----
  const onScr = (api, x, pad) => x - api.camX > -pad && x - api.camX < api.W + pad;
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const blink = (t) => Math.floor(t / 6) % 2;
  function puff(api, x, y, n, big) { // a lingering smoke cloud (drawn over actors)
    if (!G) return; for (let i = 0; i < n; i++) G.clouds.push({ x: x + api.rnd(-12, 12) * (big ? 1.4 : 1), y: y + api.rnd(-4, 4), z: api.rnd(2, 26), r: api.rnd(6, 11) * (big ? 1.3 : 1), t: 0, life: 60 + (Math.random() * 40 | 0), vx: api.rnd(-0.3, 0.3) });
  }
  function spawnAt(api, type, x, y) { // API v1 has no spawn-at-position: spawn, then move the new enemy
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return null;
    e.x = x; e.y = Math.max(api.floorTop, Math.min(api.floorBot, y)); e.entered = true; e.facing = api.player && api.player.x < x ? -1 : 1; e.cool = 40;
    return e;
  }
  function vortex(c, x, y, r, t, a) { // the violet temporal rift
    if (r <= 0) return;
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = a;
    glow(c, x, y, r * 1.8, "rgba(150,60,255,0.55)");
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = i % 2 ? "rgba(220,170,255,0.8)" : "rgba(120,80,255,0.8)"; c.beginPath();
      for (let k = 0; k <= 30; k++) { const an = t * 0.08 + i * 1.57 + k * 0.21, rr = r * (1 - k / 34); c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.55); }
      c.stroke();
    }
    c.globalAlpha = a * 0.9; glow(c, x, y, r * 0.45, "rgba(255,240,255,1)");
    c.restore();
  }

  // ================= SHARED: smoke bombs, clouds, petals =================
  // A bomb is lobbed in from a rooftop: a growing shadow + "!" marks the spot for 46 frames, then it bursts
  // (1 damage up close) into a smoke cloud, and an enemy steps out of the smoke if the bomb carries one.
  const B_FALL = 46;
  function lobBomb(api, x, y, type) { if (G) { G.bombs.push({ x, y, t: 0, type }); api.SFX.swing(); } }
  const smoke = {
    init: () => { if (G) { G.bombs = []; G.clouds = []; G.arrows = []; G.vol = null; } return {}; },
    update(st, api, p) {
      if (!G) return;
      G.bombs = G.bombs.filter((b) => {
        b.t++;
        if (b.t === B_FALL - 12) api.SFX.charge();
        if (b.t < B_FALL) return true;
        api.SFX.boom(); api.shake(2, 8, true); puff(api, b.x, b.y, 9, true); api.fx("smoke", b.x, b.y - 10, 24);
        if (canHurt(p) && Math.abs(p.x - b.x) < 16 && Math.abs(p.y - b.y) < 9 && p.z < 12) api.hurtPlayer(1, false, p.x < b.x ? -1 : 1);
        for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - b.x) < 16 && Math.abs(e.y - b.y) < 9) api.hitEnemy(e, 1, true, e.x < b.x ? -1 : 1);
        if (b.type && api.enemies.length < 6) spawnAt(api, b.type, b.x, b.y);
        return false;
      });
      G.clouds = G.clouds.filter((c) => { c.t++; c.x += c.vx; c.z += 0.08; return c.t < c.life; });
      if (G.petals.length < 26 && api.t % 7 === 0) G.petals.push({ x: api.rnd(-20, api.W + 60), y: -6, vx: api.rnd(-0.7, -0.2), vy: api.rnd(0.25, 0.6), ph: api.rnd(0, 6) });
      G.petals = G.petals.filter((q) => { q.x += q.vx + Math.sin(api.t * 0.05 + q.ph) * 0.3; q.y += q.vy; return q.y < api.H + 4 && q.x > -30; });
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const b of G.bombs) { // target shadow + "!" on the floor
        const x = b.x - cx, k = b.t / B_FALL;
        c.fillStyle = `rgba(0,0,0,${0.25 + k * 0.35})`; c.beginPath(); c.ellipse(x, b.y, 4 + k * 10, (4 + k * 10) * 0.35, 0, 0, 6.29); c.fill();
        c.strokeStyle = blink(b.t) ? "#ff4a3a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, b.y, 16, 5.6, 0, 0, 6.29); c.stroke();
      }
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const b of G.bombs) { // the bomb itself, falling on an arc with a sputtering fuse
        const k = b.t / B_FALL, x = b.x - cx + (1 - k) * 60, y = b.y - (1 - k) * 120 - Math.sin(k * Math.PI) * 30;
        const bw = 10, bh = bw * PF.bomb[3] / PF.bomb[2], painted = propRot(api, PF.bomb, x, y - 3, bw, bh, k * 5, 0.42, 0.58); // painted bomb, tumbling
        if (!painted) { c.fillStyle = "#14121a"; c.beginPath(); c.arc(x, y - 3, 3.5, 0, 6.29); c.fill(); api.rect(x - 1, y - 8, 2, 2, "#5a4a3a"); }
        const fx = painted ? x + Math.cos(k * 5 - 0.9) * 5.6 : x, fy = painted ? y - 3 + Math.sin(k * 5 - 0.9) * 5.6 : y - 9; // fuse tip
        if (api.t % 4 < 2) { api.rect(fx - 1 + api.rnd(-2, 2), fy - 1 + api.rnd(-2, 1), 2, 2, "#ffd040"); api.rect(fx + api.rnd(-3, 3), fy - 2, 1, 1, "#ffffff"); }
        if (blink(b.t)) api.ptext("!", b.x - cx, b.y - 26, 2, "#ffe060");
      }
      for (const q of G.clouds) { // smoke
        const a = Math.min(1, q.t / 6) * (1 - q.t / q.life), x = q.x - cx, y = q.y - q.z;
        if (x < -30 || x > api.W + 30) continue;
        const r = q.r + q.t * 0.12, im = api.img(PR_IMG);
        if (ready(im)) { // painted smoke puff, mirrored by drift direction
          const w = r * 2.2, h = w * PF.smoke[3] / PF.smoke[2]; c.globalAlpha = a * 0.8;
          c.save(); c.translate(x, y); if (q.vx < 0) c.scale(-1, 1); c.drawImage(im, PF.smoke[0], PF.smoke[1], PF.smoke[2], PF.smoke[3], -w / 2, -h / 2, w, h); c.restore();
          continue;
        }
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, "rgba(236,232,244,0.85)"); g.addColorStop(0.6, "rgba(176,170,192,0.55)"); g.addColorStop(1, "rgba(120,114,136,0)");
        c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
      for (const q of G.petals) { api.rect(q.x, q.y, 2, 1, "#ffc8dc"); api.rect(q.x + 1, q.y + 1, 1, 1, "#ff9ac0"); }
    },
  };

  // ================= SECTION 1 HAZARDS =================
  // Smoke-bomb ambush: during a locked wave, the next queued enemy arrives by smoke bomb instead of walking in.
  const ambush = {
    init: () => ({}),
    update(st, api, p) {
      if (!G) return;
      const S = api.STATE;
      if (G.ambCd > 0) { G.ambCd--; return; }
      if (!S.locked || !S.queue.length || api.enemies.length + G.bombs.length >= 5) return;
      let x = api.camX + api.rnd(60, api.W - 60); if (Math.abs(x - p.x) < 50) x = p.x + (x < p.x ? -60 : 60);
      x = Math.max(api.camX + 30, Math.min(api.camX + api.W - 30, x));
      lobBomb(api, x, api.rnd(api.floorTop + 6, api.floorBot - 4), S.queue.shift());
      G.ambCd = 150 + (Math.random() * 90 | 0);
      if (!G.told.smoke) { G.told.smoke = 1; api.playerBark(true, "SMOKE BOMBS! HEADS UP!"); }
    },
  };

  // Bamboo spike traps: the dirt shivers and leaf tips poke out (warning), then sharpened stakes spring up.
  const S_IDLE = 190, S_WARN = 50, S_UP = 60, S_CYC = S_IDLE + S_WARN + S_UP, SW = 18, SH = 6;
  const spikes = {
    init: () => ({ list: [[420, 196, 0], [760, 182, 120], [980, 205, 60], [1420, 190, 200], [1640, 178, 30], [2120, 200, 140], [2300, 184, 80]].map(([x, y, t]) => ({ x, y, t })) }),
    update(st, api, p) {
      for (const s of st.list) {
        s.t = (s.t + 1) % S_CYC;
        if (s.t === S_IDLE + S_WARN && onScr(api, s.x, 0)) api.SFX.clink();
        if (s.t < S_IDLE + S_WARN) { s.hit = null; continue; }
        s.hit = s.hit || new Set();
        if (canHurt(p) && !s.hit.has(p) && p.z < 10 && Math.abs(p.x - s.x) < SW && Math.abs(p.y - s.y) < SH) { s.hit.add(p); api.hurtPlayer(1, false, p.x < s.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !s.hit.has(e) && e.z < 10 && Math.abs(e.x - s.x) < SW && Math.abs(e.y - s.y) < SH) { s.hit.add(e); api.hitEnemy(e, 2, true, e.x < s.x ? -1 : 1); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const s of st.list) {
        const x = Math.round(s.x - cx), y = s.y; if (x < -30 || x > api.W + 30) continue;
        const warn = s.t >= S_IDLE && s.t < S_IDLE + S_WARN, up = s.t >= S_IDLE + S_WARN;
        const jit = warn && s.t % 4 < 2 ? 1 : 0, dw = (SW + 4) * 2, dh = dw * PF.dirt[3] / PF.dirt[2];
        const paint = prop(api, PF.dirt, x - dw / 2 + jit, y - dh / 2, dw, dh); // painted disturbed earth (shivers during the warning)
        if (paint && warn) { stakeRise(api, PF.stakes, x, y, 46, 21, 3 + (s.t % 8 < 4 ? 1 : 0)); if (s.t % 5 < 2) api.rect(x + api.rnd(-SW, SW), y - api.rnd(0, 4), 2, 1, "#8a6a40"); if (blink(s.t)) api.ptext("!", x, y - 24, 2, "#ffe060"); } // stake tips peek out
        if (!paint) { c.fillStyle = "rgba(60,40,20,0.45)"; c.beginPath(); c.ellipse(x, y, SW + 2, SH, 0, 0, 6.29); c.fill(); for (let i = -SW + 3; i < SW; i += 6) { api.rect(x + i, y - 1 + (i % 4 ? 1 : -1), 3, 1, "#3a2a18"); } }
        if (!paint && warn) {
          const j = s.t % 4 < 2 ? 1 : 0;
          for (let i = -SW + 4; i < SW; i += 7) { api.rect(x + i + j, y - 3, 2, 3, "#6a9a3a"); api.rect(x + i + j, y - 4, 1, 1, "#b8e070"); }
          if (s.t % 5 < 2) api.rect(x + api.rnd(-SW, SW), y - api.rnd(0, 4), 2, 1, "#8a6a40");
          if (blink(s.t)) api.ptext("!", x, y - 24, 2, "#ffe060");
        }
        if (up) { // stakes: back row (behind actors)
          const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 22;
          if (paint) { stakeRise(api, PF.stakes, x, y, 46, 21, h * 21 / 22); continue; }
          for (let i = -SW + 2; i < SW; i += 6) { const hh = h * (0.75 + ((i + 40) % 3) * 0.12); c.fillStyle = "#5a8a2a"; c.beginPath(); c.moveTo(x + i - 2, y - 2); c.lineTo(x + i + 2, y - 2); c.lineTo(x + i + 0.5, y - 2 - hh); c.closePath(); c.fill(); api.rect(x + i - 1, y - 2 - hh * 0.45, 3, 1, "#3a5a1a"); }
        }
      }
    },
    drawFront(st, api, cx) { // front row of stakes (over actors) so it reads as a patch, not a wall
      const c = api.ctx;
      for (const s of st.list) {
        if (s.t < S_IDLE + S_WARN) continue;
        const x = Math.round(s.x - cx), y = s.y + 4; if (x < -30 || x > api.W + 30) continue;
        const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 16;
        if (ready(api.img(PR_IMG))) { stakeRise(api, PF.small, x + 3, y, 19, 17, h * 17 / 16); continue; } // painted front cluster
        for (let i = -SW + 5; i < SW; i += 7) { c.fillStyle = "#7aaa3a"; c.beginPath(); c.moveTo(x + i - 2, y); c.lineTo(x + i + 2, y); c.lineTo(x + i + 0.5, y - h); c.closePath(); c.fill(); api.rect(x + i, y - h, 1, 2, "#e8f0c0"); }
      }
    },
  };

  // a painted stake row rising out of the ground: bottom-centre (x, y), full size w x hMax (w < 0 = mirrored), h = how far it is up
  function stakeRise(api, f, x, y, w, hMax, h) {
    const im = api.img(PR_IMG); if (!ready(im) || h <= 0.3) return; const c = api.ctx, aw = Math.abs(w);
    c.save(); c.beginPath(); c.rect(x - aw, y - hMax - 4, aw * 2, hMax + 5); c.clip(); // ground line at y + 1
    c.translate(x, y + 1 + (hMax - h)); if (w < 0) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -aw / 2, -hMax, aw, hMax); c.restore();
  }

  // Archer volley: unseen archers on the rooftops. Red target rings appear for 56 frames, then arrows rain in.
  const V_WARN = 56, V_FALL = 10;
  const volley = {
    init: () => ({}),
    update(st, api, p) {
      if (!G) return;
      if (!G.vol) {
        if (--G.volCd > 0 || p.deadT > 0) return;
        const marks = [{ x: p.x + api.rnd(-16, 16), y: p.y }];
        for (let i = 0; i < 3; i++) marks.push({ x: api.camX + api.rnd(30, api.W - 30), y: api.rnd(api.floorTop + 4, api.floorBot - 2) });
        for (const m of marks) m.x = Math.max(api.camX + 14, Math.min(api.camX + api.W - 14, m.x));
        G.vol = { t: 0, marks }; G.volCd = 380 + (Math.random() * 120 | 0); api.SFX.charge();
        if (!G.told.arrows) { G.told.arrows = 1; api.playerBark(true, "ARCHERS! WATCH THE RED MARKS!"); }
        return;
      }
      const v = G.vol; v.t++;
      if (v.t === V_WARN) api.SFX.shuriken();
      if (v.t < V_WARN + V_FALL) return;
      for (const m of v.marks) {
        if (canHurt(p) && Math.abs(p.x - m.x) < 11 && Math.abs(p.y - m.y) < 7 && p.z < 12) api.hurtPlayer(1, false, p.x < m.x ? -1 : 1);
        for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - m.x) < 11 && Math.abs(e.y - m.y) < 7) api.hitEnemy(e, 2, true, e.x < m.x ? -1 : 1);
        for (let i = 0; i < 3; i++) G.arrows.push({ x: m.x + api.rnd(-8, 8), y: m.y + api.rnd(-3, 3), t: 0 });
        api.dust(m.x, m.y);
      }
      api.SFX.clink(); G.vol = null;
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      G.arrows = G.arrows.filter((a) => { // arrows stuck in the ground for a while
        a.t++; const x = a.x - cx; c.globalAlpha = a.t > 80 ? (110 - a.t) / 30 : 1;
        const im = api.img(PR_IMG), lean = ((a.x * 7 | 0) % 5 - 2) * 0.06;
        if (ready(im)) { c.save(); c.beginPath(); c.rect(x - 8, a.y - 20, 16, 20.5); c.clip(); propRot(api, PF.arrow, x, a.y + 3, 17, 1.9, Math.PI / 2 + lean, 1, 0.5); c.restore(); } // painted arrow, head buried
        else { api.rect(x, a.y - 9, 1, 9, "#6a4a2a"); api.rect(x - 1, a.y - 11, 3, 2, "#e8e0d0"); }
        c.globalAlpha = 1; return a.t < 110;
      });
      const v = G.vol; if (!v) return;
      for (const m of v.marks) {
        const x = m.x - cx, k = Math.min(1, v.t / V_WARN), r = 16 - k * 6;
        c.globalAlpha = 0.25 + k * 0.3; c.fillStyle = "#ff2a2a"; c.beginPath(); c.ellipse(x, m.y, r, r * 0.35, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = blink(v.t) ? "#ffe060" : "#ff3a3a"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, m.y, 12, 4.2, 0, 0, 6.29); c.stroke();
        api.rect(x - 1, m.y - 1, 2, 2, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      const v = G && G.vol; if (!v) return;
      if (v.t < V_WARN && blink(v.t)) api.ptext("!", v.marks[0].x - cx, v.marks[0].y - 34, 2, "#ffe060");
      if (v.t >= V_WARN) for (const m of v.marks) { // falling arrows
        const k = (v.t - V_WARN) / V_FALL, x = m.x - api.camX + (1 - k) * 30, y = m.y - (1 - k) * 140;
        for (let i = -1; i <= 1; i++) {
          if (propRot(api, PF.arrow, x + i * 6, y - 3 + i * 3, 20, 2.1, Math.atan2(18, -6), 1, 0.5)) continue; // painted arrow, head first
          const c = api.ctx; c.strokeStyle = "#e8dcc8"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + i * 6, y - 4 + i * 3); c.lineTo(x + i * 6 + 6, y - 22 + i * 3); c.stroke(); api.rect(x + i * 6 - 1, y - 4 + i * 3, 2, 2, "#c8c8d0");
        }
      }
    },
  };

  // Section-1 flavour: the rift closing overhead as the brothers arrive, plus a first bark.
  const arrival = {
    init: () => ({ t: 0 }),
    update(st, api) { st.t++; if (st.t === 50) api.playerBark(true, "WHERE... WHEN ARE WE?!"); if (st.t === 160) api.playerBark(true, "NINJAS. WHY IS IT ALWAYS NINJAS?"); },
    drawBack(st, api) { if (st.t < 150) vortex(api.ctx, 236, 34, 28 * (1 - st.t / 150), api.t, 1); },
  };

  // ================= THE BOSS: KARAI =================
  const GATE_X = 192, ROOF_Y = 168, ROOF_Z = 92, KK = 0.36;
  const boss = () => A.enemies.find((e) => e.boss);
  const P2 = { speed: 1.75, cool: 58 };
  function hop(e, tx, ty, tz, n, next) { Object.assign(e, { state: "hop", t: 0, h0: [e.x, e.y, e.z], h1: [tx, ty, tz], hn: n, hnext: next }); A.SFX.jump(); }
  function strike(api, e, p, reach, dmg, knock) { // a blade hitbox in front of her
    const dx = p.x - e.x;
    if (canHurt(p) && Math.sign(dx || e.facing) === e.facing && Math.abs(dx) < reach && Math.abs(p.y - e.y) < 9 && p.z < 16) { api.hurtPlayer(dmg, false, knock ? e.facing : 0); api.fx("spark", p.x, p.y - 18, 8); return true; }
    return false;
  }
  function roofSay(api, e, s, n) { api.enemySay(e, s, n, 150, true); e.sayT = 0; e.roofSay = s; e.roofT = n; }
  function hide(e) { if (e.hidY === undefined) { e.hidY = e.y; e.y = 900; } e.inv = 2; } // off the floor: no shadow, no hits
  function unhide(e, x, y) { e.x = x; e.y = y; e.hidY = undefined; }
  function pick(api, e, p) {
    const dx = p.x - e.x, dy = p.y - e.y, ax = Math.abs(dx), cfg = e.cfg;
    e.t = 0; e.cool = cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 34 && Math.random() < 0.7) { e.state = "kwind"; return; }
    const opts = ["throw", "throw", "vanish"];
    if (Math.abs(dy) < 8 && ax > 50) opts.push("tele", "tele");
    if (!(e.sumCd > 0) && api.enemies.length < (e.p2 ? 3 : 2)) opts.push("summon");
    if (e.p2 || e.hp <= e.maxHp * 0.7) opts.push("clone");
    if (e.p2) opts.push("clone", "vanish");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.7) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m; e.state = m;
  }
  // ---- Boss entrance (entr v1): Karai poses on the gate roof against the moon, then dives off it and lands blade-first in a burst of smoke ----
  const KR_ENTR = {
    len: 160, zoom: 1.22, sub: "MISTRESS OF THE FOOT", barTop: 6, bannerY: 196, // she poses high on the roof: thin top bar, banner low
    setup(api, e, st) { Object.assign(e, { x: GATE_X, y: ROOF_Y, z: ROOF_Z, facing: -1, state: "perch", t: 0 }); api.SFX.shuriken(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 34 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (G) G.clouds = G.clouds.filter((c) => { c.t++; c.x += c.vx; c.z += 0.08; return c.t < c.life; }); // the smoke keeps drifting while the stage is paused
      if (t < 50) { e.state = t > 30 ? "throw" : "perch"; e.t = 30; e.x = GATE_X; e.y = ROOF_Y; e.z = ROOF_Z; if (t === 30) { api.SFX.swing(); api.fx("spark", e.x + 12, e.y - e.z - 40, 10); } return; }
      if (t === 50) { api.SFX.jump(); puff(api, GATE_X, ROOF_Y - ROOF_Z + 4, 4); }
      if (t >= 50 && t <= 86) { const k = (t - 50) / 36; e.x = api.lerp(GATE_X, cxm, k) + Math.sin(k * Math.PI) * 26; e.y = api.lerp(ROOF_Y, mid, k); e.z = api.lerp(ROOF_Z, 0, k * k) + Math.sin(k * Math.PI) * 28; e.state = "hop"; e.t = 5;
        if (t % 4 === 0) api.fx("smoke", e.x, e.y - e.z - 20, 10); }
      if (t === 86) { e.z = 0; api.entr.impact(e.x, e.y, 6, { stop: 5, sfx: "land" }); puff(api, e.x, e.y, 8, true); api.SFX.clink(); }
      if (t > 86 && t < 104) { e.state = "charge"; e.t = 4; }
      if (t >= 104) { e.state = "perch"; e.t = 0; e.walkT = 0; }
    },
    finish(api, e) { e.go = true; },
  };
  const bossCfg = {
    name: "KARAI", base: "ramrod", atlas: "ninja", height: 74, hp: 44, speed: 1.35, chargeSpeed: 1.6, cool: 78, pitch: 150,
    moves: ["kick", "throw", "summon"],
    lines: {
      intro: "SO THE RIFT DELIVERS TURTLES TO MY DOOR.",
      hit: ["SLOPPY.", "YOU'LL HAVE TO BE FASTER!", "A LUCKY CUT.", "NOT BAD... FOR A TURTLE."],
      summon: "SHADOWS! STRIKE!",
      ko: "THIS... ISN'T OVER, TURTLES...",
    },
    spawn(api, e) { Object.assign(e, { state: "perch", t: 0, x: GATE_X, y: ROOF_Y, z: ROOF_Z, facing: -1, inv: 999, sumCd: 520 }); },
    entrance: KR_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "perch") { // poised on the gate roof against the moon, then drops into the courtyard
        e.x = GATE_X; e.y = ROOF_Y; e.z = ROOF_Z; e.facing = p.x < e.x ? -1 : 1; e.inv = 2;
        if (e.t === 30) roofSay(api, e, bossCfg.lines.intro, 115);
        if (e.t === 150) roofSay(api, e, "I AM KARAI. AND THIS IS WHERE YOU FALL.", 100);
        if (e.t >= 250) { e.inv = 0; e.go = true; hop(e, GATE_X + 70, 196, 0, 30, "walk"); }
        return true;
      }
      if (e.state === "hop") {
        const k = Math.min(1, e.t / e.hn), [x0, y0, z0] = e.h0, [x1, y1, z1] = e.h1;
        e.x = api.lerp(x0, x1, k); e.y = api.lerp(y0, y1, k); e.z = api.lerp(z0, z1, k) + Math.sin(k * Math.PI) * 36; e.inv = 2;
        if (Math.abs(x1 - x0) > 2) e.facing = x1 > x0 ? 1 : -1;
        if (k >= 1) { e.z = z1; if (z1 === 0) { api.SFX.land(); api.dust(e.x - 6, e.y); api.dust(e.x + 6, e.y); puff(api, e.x, e.y, 4); } e.state = e.hnext; e.t = 0; e.cool = 40; }
        return true;
      }
      if (e.state === "rage") { // phase 2: vanishes, reappears on the roof, calls her clan, drops back in
        e.inv = 2;
        if (e.t === 1) { puff(api, e.x, e.y, 10, true); api.SFX.boom(); hide(e); }
        if (e.t === 30) { unhide(e, GATE_X, ROOF_Y); e.z = ROOF_Z; puff(api, GATE_X, ROOF_Y - ROOF_Z + 4, 6); roofSay(api, e, "ENOUGH GAMES. NOW FACE ALL OF ME!", 120); }
        if (e.t > 30) { e.x = GATE_X; e.y = ROOF_Y; e.z = ROOF_Z; e.facing = p.x < e.x ? -1 : 1; }
        if (e.t === 80) { lobBomb(api, api.camX + 70, 186, "blue"); lobBomb(api, api.camX + 314, 200, "sword"); }
        if (e.t >= 170) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2); e.sumCd = 700; api.playerBark(true, "SHE'S EVEN FASTER NOW! WATCH HER SHADOW!"); hop(e, p.x < GATE_X ? GATE_X + 60 : GATE_X - 60, 196, 0, 30, "walk"); }
        return true;
      }
      if (e.hidY !== undefined && !["vanish", "clone", "boss"].includes(e.state)) unhide(e, e.x, e.hidY); // safety: never leave her parked off the floor
      if (e.state === "walk" && !e.p2 && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { pick(api, e, p); return true; }
      if (e.state === "kwind") { // twin-blade combo: red flash wind-up, two quick slashes
        e.facing = p.x >= e.x ? 1 : -1;
        if (e.t >= (e.p2 ? 12 : 16)) { e.state = "kick"; e.t = 0; e.hit1 = false; api.SFX.swing(); }
        return true;
      }
      if (e.state === "kick") {
        if (e.t <= 5) { e.x += e.facing * 1.6; if (!e.hit1 && strike(api, e, p, 34, 1, false)) e.hit1 = true; }
        if (e.t === 12) { api.SFX.swing(); e.hit1 = false; }
        if (e.t >= 12 && e.t <= 17) { e.x += e.facing * 1.6; if (!e.hit1 && strike(api, e, p, 36, 1, true)) e.hit1 = true; }
        if (e.t >= 30) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "throw") { // kunai fan: 3 blades (5 in phase 2)
        if (e.t === 22) {
          e.facing = p.x >= e.x ? 1 : -1; const n = e.p2 ? 5 : 3;
          for (let i = 0; i < n; i++) api.shot({ x: e.x + e.facing * 16, y: e.y, vx: e.facing * (e.p2 ? 3.4 : 3), vy: (i - (n - 1) / 2) * 0.45, kind: "kunai", draw: drawKunai });
          api.SFX.shuriken();
        }
        if (e.t >= 44) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "tele") { // dash slash: 34-frame red flash, then she streaks across the row
        e.facing = p.x >= e.x ? 1 : -1;
        if (e.t >= 34) { e.state = "charge"; e.t = 0; e.hit1 = false; api.SFX.charge(); }
        return true;
      }
      if (e.state === "charge") {
        e.x += e.facing * 5.2; if (e.t % 3 === 0) { api.dust(e.x - e.facing * 8, e.y); G && G.clones.push({ x: e.x, y: e.y, f: e.facing, t: 0, trail: 1 }); }
        if (!e.hit1 && canHurt(p) && p.z < 12 && Math.abs(p.x - e.x) < 16 && Math.abs(p.y - e.y) < 9) { e.hit1 = true; api.hurtPlayer(2, false, e.facing); api.fx("spark", p.x, p.y - 18, 10); }
        if (e.x <= api.camX + 16 || e.x >= api.camX + api.W - 16 || e.t > 70) { e.state = "walk"; e.t = 0; e.cool = Math.max(e.cool, 30); api.SFX.land(); }
        return true;
      }
      if (e.state === "summon") { // smoke bombs: two of her clan step out of the smoke
        if (e.t === 18) {
          api.enemySay(e, bossCfg.lines.summon, 70, 150);
          const t2 = e.p2 ? ["blue", "dasher"] : ["purple", "star"];
          lobBomb(api, api.camX + 60, api.rnd(184, 206), t2[0]); lobBomb(api, api.camX + api.W - 60, api.rnd(184, 206), t2[1]);
          e.sumCd = e.p2 ? 760 : 900;
        }
        if (e.t >= 40) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "vanish") { // poof, gone; smoke + "!" gathers behind you; she reappears and slashes
        if (e.t === 1) { puff(api, e.x, e.y, 9, true); api.SFX.boom(); hide(e); }
        hide(e);
        if (e.t === 26) { const s = p.facing || 1; e.ax = Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x - s * 26)); e.ay = p.y; e.af = e.ax < p.x ? 1 : -1; e.mark = 1; }
        if (e.t > 26 && e.t < 70 && e.t % 8 === 0) puff(api, e.ax, e.ay, 1);
        if (e.t >= 70) { unhide(e, e.ax, e.ay); e.facing = e.af; e.mark = 0; puff(api, e.x, e.y, 5); e.state = "appear"; e.t = 0; e.inv = 0; }
        return true;
      }
      if (e.state === "appear") { // brief red-flash pose (hittable as "kwind") then the slash
        e.state = "kwind"; e.t = e.p2 ? 2 : 0; return true;
      }
      if (e.state === "clone") { // clone feint: three Karais close in from around you; only the real one has a shadow
        if (e.t === 1) {
          puff(api, e.x, e.y, 9, true); api.SFX.boom(); hide(e);
          const n = e.p2 ? 3 : 2, real = Math.random() * (n + 1) | 0, spots = [];
          for (let i = 0; i <= n; i++) { const side = i % 2 ? 1 : -1, x = Math.max(api.camX + 24, Math.min(api.camX + api.W - 24, p.x + side * (70 + (i >> 1) * 40))); spots.push({ x, y: Math.max(api.floorTop + 2, Math.min(api.floorBot - 2, p.y + (i >> 1 ? (i % 2 ? 10 : -10) : 0))) }); }
          e.spots = spots; e.real = real;
          G.clones = G.clones.filter((c) => c.trail);
          spots.forEach((s, i) => { if (i !== real) G.clones.push({ x: s.x, y: s.y, f: s.x < p.x ? 1 : -1, t: 0, fake: 1 }); });
          if (!G.told.clone) { G.told.clone = 1; api.playerBark(true, "CLONES?! ONLY ONE HAS A SHADOW!"); }
        }
        if (e.t === 8) { const s = e.spots[e.real]; unhide(e, s.x, s.y); e.facing = s.x < p.x ? 1 : -1; e.inv = 0; for (const s2 of e.spots) puff(api, s2.x, s2.y, 3); e.state = "boss"; }
        if (e.t < 8) { hide(e); return true; }
        return true;
      }
      if (e.state === "boss") { // clone stance (hittable state name): hit the real one and the fakes vanish
        e.facing = p.x >= e.x ? 1 : -1;
        if (e.t >= 56) { // everyone dashes in together; the fakes burst into smoke when they reach you or get hit
          for (const c of G.clones) if (c.fake && !c.dash) { c.dash = 1; c.f = p.x >= c.x ? 1 : -1; }
          e.state = "tele"; e.t = 34; return true;
        }
        return true;
      }
      return false; // hurt / stagger / down / getup / dying are the engine's
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, c = api.ctx;
      if (e.roofT > 0) { e.roofT--; if (e.z > 40) sideBubble(api, sx + 20, sy - 54, e.roofSay); }
      if (e.hidY !== undefined) { // hidden: draw only the reappear marker
        if (s === "vanish" && e.mark) { const x = e.ax - api.camX; if (blink(t)) api.ptext("!", x, e.ay - 44, 2, "#ffe060"); c.strokeStyle = t % 6 < 3 ? "#ff3a3a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, e.ay, 13, 4.5, 0, 0, 6.29); c.stroke(); }
        return;
      }
      if (s === "dying" && t > 48) { if (!e.poofed) { e.poofed = 1; puff(api, e.x, e.y, 12, true); api.SFX.boom(); } return; } // KO: vanishes in smoke
      const red = (s === "kwind" && t % 6 < 3) || (s === "boss" && t > 30 && t % 6 < 3) || (s === "tele" && t < 34 && t % 6 < 3) || (s === "throw" && t < 22 && t % 6 < 3);
      const fr = ["down", "dying"].includes(s) ? "down" : ["hurt", "stagger", "getup"].includes(s) ? "hurt" : ["kick", "charge"].includes(s) ? "slash" : ["throw", "summon", "hop"].includes(s) ? "throw" : (s === "walk" || s === "enter") && e.walkT > 0 && Math.floor(e.walkT / 9) % 2 ? "walk" : "idle";
      if (s === "boss") { c.globalAlpha = 0.8; api.contactShadow(sx, e.y, 0, 16); c.globalAlpha = 1; } // the tell: only she casts a shadow
      if (e.p2 || s === "rage") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.28 + 0.12 * Math.sin(api.t * 0.2); glow(c, sx, sy - 30, 34, "rgba(255,40,60,0.8)"); c.restore(); }
      drawKarai(api, fr, sx + (s === "stagger" ? (t % 4 < 2 ? 1 : -1) : 0), sy, ["hurt", "down"].includes(fr) ? -e.facing : e.facing, red, 1);
      if (s === "kick" && (t <= 6 || (t >= 12 && t <= 18))) { // blade arcs
        c.save(); c.strokeStyle = "rgba(255,240,255,0.9)"; c.lineWidth = 1.5; c.beginPath(); c.arc(sx + e.facing * 10, sy - 30, 22, e.facing > 0 ? -1.2 : Math.PI - 0.4 + 0.0, e.facing > 0 ? 0.4 : Math.PI + 1.2); c.stroke(); c.restore();
      }
    },
    onDefeat() { if (G) { G.clones = []; G.bombs = []; } },
  };
  function sideBubble(api, x, y, str) { // two-line speech box beside her (the engine's bubble would sit under the HUD)
    const c = api.ctx, words = str.split(" "), lines = [""];
    for (const w of words) { const l = lines[lines.length - 1]; if ((l + " " + w).trim().length > 22) lines.push(w); else lines[lines.length - 1] = (l + " " + w).trim(); }
    c.font = "bold 7px monospace";
    const w = Math.ceil(Math.max(...lines.map((l) => c.measureText(l).width))) + 10, h = lines.length * 9 + 6, bx = Math.round(x + 6), by = Math.round(y - h / 2);
    c.fillStyle = "#fff"; c.fillRect(bx, by, w, h); c.beginPath(); c.moveTo(bx, by + h / 2 - 3); c.lineTo(bx - 6, by + h / 2 + 2); c.lineTo(bx, by + h / 2 + 3); c.fill();
    c.strokeStyle = "#000"; c.lineWidth = 1; c.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    lines.forEach((l, i) => api.text(l, bx + w / 2, by + 7.5 + i * 9, 7, "#3a1458", "center"));
  }
  function drawKarai(api, fr, x, y, facing, red, alpha) {
    const im = api.img(SHEET), c = api.ctx;
    if (!im) { api.rect(x - 8, y - 62, 16, 62, red ? "#c82a2a" : "#1a1418"); api.rect(x - 8, y - 40, 16, 4, "#c82a2a"); return; }
    let sheet = im;
    if (red) {
      if (redSrc !== im) { redSrc = im; redSheet = document.createElement("canvas"); redSheet.width = im.naturalWidth; redSheet.height = im.naturalHeight; const g = redSheet.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(255,40,30,0.45)"; g.fillRect(0, 0, redSheet.width, redSheet.height); }
      sheet = redSheet;
    }
    if (alpha < 1) c.globalAlpha = alpha;
    api.drawFrame(sheet, KF[fr], x, y, KK, facing);
    c.globalAlpha = 1;
  }
  function drawKunai(api, s, sx, sy) {
    const im = api.img(SHEET);
    if (im) api.drawFrame(im, KF.kunai, sx, sy + 2, 0.42, s.vx > 0 ? 1 : -1); else api.rect(sx - 5, sy - 1, 10, 2, "#d8dce8");
  }
  // Courtyard hazard object: clone/afterimage logic + rendering, and the rift glow over the gate.
  const courtyard = {
    init: () => { if (G) { G.clones = []; } return {}; },
    update(st, api, p) {
      if (!G) return;
      G.clones = G.clones.filter((c) => {
        c.t++;
        if (c.trail) return c.t < 12;
        if (c.dash) {
          c.x += c.f * 5.2;
          const near = Math.abs(p.x - c.x) < 14 && Math.abs(p.y - c.y) < 9, hitBy = p.attackT > 0 && Math.abs(p.x - c.x) < 34 && Math.abs(p.y - c.y) < 10 && Math.sign(c.x - p.x) === p.facing;
          if (near || hitBy || c.x < api.camX + 10 || c.x > api.camX + api.W - 10 || c.t > 140) { puff(api, c.x, c.y, 5); api.SFX.clink(); return false; }
        } else if (p.attackT > 0 && Math.abs(p.x - c.x) < 30 && Math.abs(p.y - c.y) < 10) { puff(api, c.x, c.y, 5); api.SFX.clink(); return false; }
        return c.t < 160;
      });
      const b = boss(); if (!b || b.state === "dying") G.clones = [];
      else if (!["boss", "tele", "charge", "clone"].includes(b.state)) G.clones = G.clones.filter((c) => { if (c.fake && !c.dash) { puff(api, c.x, c.y, 5); return false; } return true; });
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const b = boss();
      vortex(api.ctx, 236, 22, 10 + (b && b.p2 ? 6 : 0) + Math.sin(api.t * 0.05) * 2, api.t, 0.55); // the rift is still there, over the moon
      for (const c of G.clones) {
        if (c.trail) { drawKarai(api, "slash", c.x - cx, c.y, c.f, false, 0.35 * (1 - c.t / 12)); continue; }
        const red = !c.dash && b && b.state === "boss" && b.t > 30 && b.t % 6 < 3; // flash in sync with the real one
        drawKarai(api, c.dash ? "slash" : "idle", c.x - cx, c.y, c.f, red, 1); // identical to the real one, but no shadow
      }
    },
  };

  // ================= OUTRO: the rift reopens and throws the brothers onto 17th-century seas =================
  const RIFT = { x: 236, y: 40 };
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro
      if (G) { G.clones = []; G.clouds = G.clouds.filter((q) => ++q.t < q.life); G.bombs = []; }
      if (t === 1) Object.assign(st, { r: 0, x0: p.x, y0: p.y });
      if (t === 20) api.playerBark(true, "SHE VANISHED... TYPICAL NINJA.");
      if (t >= 70) st.r = Math.min(60, st.r + 0.6);
      if (t === 70) { api.SFX.rumble(); api.shake(3, 40, true); }
      if (t === 120) api.playerBark(true, "THE RIFT! IT'S PULLING US IN!");
      if (t > 150 && t < 260) { const k = (t - 150) / 110; p.x = api.lerp(st.x0, RIFT.x, k * k); p.z = k * k * 150; p.facing = Math.floor(t / 6) % 2 ? 1 : -1; p.walkT = 0; }
      if (t === 200) api.playerBark(true, "HERE WE GO AGAAAIN!");
      if (t === 255) { api.SFX.boom(); api.shake(5, 20, true); }
      if (t === 300) api.SFX.rumble();
      if (t > 440) { p.z = 0; p.x = st.x0; p.y = st.y0; p.facing = 1; return true; }
      return false;
    },
    draw(api, st, t, cx) {
      const c = api.ctx;
      if (st.r > 0) {
        vortex(c, RIFT.x, RIFT.y, st.r, api.t * 2, 1);
        if (t % 3 === 0) for (let i = 0; i < 6; i++) { const y = api.rnd(10, api.H - 20), x = api.rnd(0, api.W); c.globalAlpha = 0.5; api.rect(x, y, api.rnd(8, 20), 1, "#e0d0ff"); c.globalAlpha = 1; }
      }
      if (t > 240 && t < 280) { c.globalAlpha = Math.min(1, (t - 240) / 15) * (t > 265 ? (280 - t) / 15 : 1); api.rect(0, 0, api.W, api.H, "#ffffff"); c.globalAlpha = 1; }
      if (t >= 265) { // night sea, a galleon on the horizon
        const a = Math.min(1, (t - 265) / 20);
        c.globalAlpha = a;
        const sea = api.img(SEA_IMG), pim = api.img(PR_IMG);
        if (ready(sea) && ready(pim)) { // painted night sea + galleon on the horizon
          c.drawImage(sea, 0, 0, api.W, api.H);
          const sx = 120 + (t - 265) * 0.15, sw = 104, sh = sw * PF.ship[3] / PF.ship[2];
          c.drawImage(pim, PF.ship[0], PF.ship[1], PF.ship[2], PF.ship[3], Math.round(sx - sw / 2), 115 - sh, sw, sh);
          c.globalAlpha = a * 0.22; for (let r = 0; r < 5; r++) for (let i = 0; i < 10; i++) { const x = ((i * 46 + api.t * (0.4 + r * 0.15) + r * 17) % (api.W + 40)) - 20, y = 120 + r * 20 + Math.sin(api.t * 0.05 + i) * 2; api.rect(x, y, 12 + r * 3, 1, "#d8ecff"); } // moving glints
          c.globalAlpha = a * 0.45; api.rect(0, 42, api.W, 15, "#05030a"); // caption band (the painted moon sits behind the caption)
          c.globalAlpha = a;
        } else {
        const g = c.createLinearGradient(0, 0, 0, api.H); g.addColorStop(0, "#0a1430"); g.addColorStop(0.55, "#1a2c5a"); g.addColorStop(0.56, "#0c2244"); g.addColorStop(1, "#04101e"); c.fillStyle = g; c.fillRect(0, 0, api.W, api.H);
        c.fillStyle = "#f4f0d8"; c.beginPath(); c.arc(300, 40, 12, 0, 6.29); c.fill();
        for (let i = 0; i < 40; i++) api.rect((api.hash(i) * api.W) | 0, (api.hash(i + 99) * 100) | 0, 1, 1, "#c8d0ff");
        const sx = 120 + (t - 265) * 0.15, hy = 124; // ship silhouette
        api.rect(sx - 26, hy - 6, 52, 6, "#05070e"); api.rect(sx - 22, hy - 9, 44, 3, "#05070e"); api.rect(sx - 1, hy - 46, 2, 40, "#05070e"); api.rect(sx - 15, hy - 36, 2, 30, "#05070e"); api.rect(sx + 13, hy - 34, 2, 28, "#05070e");
        c.fillStyle = "#0a0e1a"; for (const [mx, w, h] of [[0, 14, 30], [-14, 10, 22], [14, 10, 22]]) { c.fillRect(sx + mx - w / 2, hy - 42, w, h); }
        for (let r = 0; r < 6; r++) for (let i = 0; i < 14; i++) { const x = ((i * 34 + api.t * (0.4 + r * 0.15) + r * 17) % (api.W + 40)) - 20, y = 132 + r * 16 + Math.sin(api.t * 0.05 + i) * 2; api.rect(x, y, 14 + r * 2, 1, r % 2 ? "#3a6aa8" : "#5a8ac8"); }
        }
        if (t > 300) api.ptext("SOMEWHERE ON THE HIGH SEAS... 1600-SOMETHING", api.W / 2, 50, 1, "#ffe8b0");
        if (t > 340) { // the brothers hit the water
          const k = t - 340; api.ptext("SPLASH!", 200, 150 - Math.min(20, k * 0.8), 2, "#e8f4ff");
          c.strokeStyle = "rgba(220,240,255,0.7)"; c.lineWidth = 1; c.beginPath(); c.ellipse(200, 168, 6 + k * 0.8, 2 + k * 0.25, 0, 0, 6.29); c.stroke();
          for (let i = 0; i < 10; i++) { const u = Math.min(1, k / 40), an = -0.3 - i * 0.26; api.rect(200 + Math.cos(an) * u * 30, 166 + Math.sin(an) * u * 24 + u * u * 26, 2, 2, "#e8f4ff"); }
        }
        if (t > 380) api.ptext("WE TRADED NINJAS FOR PIRATES!", api.W / 2, 200, 1, "#7fd85a");
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 9,
    name: "SHADOWS OF EDO",
    card: { title: "SHADOWS OF EDO", tagline: "THE RIFT THREW US BACK 400 YEARS. AND THE NINJAS WERE WAITING.", color: "#ff3a4a" },
    music, bossMusic,
    // painted regular enemies (edo family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_edo.png", ENEMY_F = { light: {"idle":[4,15,111,154,53],"walk":[119,0,92,169,45],"walk2":[215,2,90,167,48],"attack":[309,13,147,156,54],"jump":[460,41,142,128,58],"hurt":[606,16,96,153,59],"down":[706,121,185,48,92],"dash":[895,49,145,120,79]}, weapon: {"idle":[4,174,125,168,36],"walk":[133,173,94,169,44],"walk2":[231,175,86,167,42],"attack":[321,181,166,161,52],"jump":[491,189,99,153,49],"hurt":[594,187,99,155,58],"down":[697,303,185,39,92],"throw":[886,182,135,160,52]}, big: {"idle":[4,349,139,165,46],"walk":[147,346,99,168,46],"walk2":[250,346,98,168,53],"attack":[352,354,149,160,59],"jump":[505,364,99,150,44],"hurt":[608,368,95,146,58],"down":[707,473,182,41,91],"shoot":[893,359,208,155,61]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 330, blue: 210, sword: 345, star: 270, dasher: 0, heavy: 20 },
    images: [SHEET, PR_IMG, SEA_IMG],
    sections: [
      { bg: BG1, floor: [172, 216], length: 2560, locks: [0, 620, 1260, 1920],
        waves: [["purple", "purple", "star"], ["blue", "sword", "purple", "dasher"], ["star", "sword", "blue", "dasher", "purple"], ["sword", "sword", "blue", "star", "dasher"]],
        grade: "rgba(40,10,40,0.10)", hazards: [arrival, smoke, ambush, spikes, volley],
        onUpdate() { if (!G) G = fresh(); },
        sky: "#3a1a2a", ground: "#6a5030" },
      { bg: BG2, floor: [170, 216], length: 384, locks: [], waves: [], grade: null, hazards: [smoke, courtyard],
        onUpdate() { if (!G) G = fresh(); },
        sky: "#0a1030", ground: "#4a3a30" },
    ],
    restructure: { // phase 2: village (zone 1) -> the ronin at the gate (mini-boss twist) -> bamboo road (zone 2) -> existing courtyard
      split: 0, images: ["levels/level9_ronin.png", "levels/level9_bamboo.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "miniboss", goal: "boss", title: "THE RONIN AT THE GATE", sub: "BREAK HIS GUARD WITH JUMP ATTACKS AND THROWS", summon: ["star", "star"], color: "#ff9ae8",
        boss: { name: "ONI RONIN", base: "ramrod", hp: 24, speed: 1.1, chargeSpeed: 1.7, cool: 76, pitch: 70, height: 88, moves: ["kick", "charge"],
          lines: { intro: "NONE SHALL PASS THIS GATE.", hit: ["WEAK!", "YOUR STANCE IS SLOPPY."], summon: "SHADOWS, TO ME!", ko: "THE GATE... IS YOURS..." },
          draw: A.stripDraw ? A.stripDraw({ img: "levels/level9_ronin.png", k: 0.5, fr: {"idle": [4, 0, 85, 176, 40], "walk1": [93, 37, 66, 139, 32], "walk2": [163, 37, 66, 139, 30], "guard": [233, 6, 61, 170, 30], "wind": [298, 17, 97, 159, 38], "slash": [399, 56, 137, 120, 30], "lunge": [540, 82, 171, 94, 60], "hurt": [715, 66, 67, 110, 32], "down": [786, 122, 123, 54, 61]},
            map: { kwind: "wind", kick: "slash", tele: "guard", charge: "lunge", hurt: "hurt", stagger: "hurt", down: "down", dying: "down", fire: "wind" } }) : undefined } },
      z2bg: "levels/level9_bamboo.jpg", z2: { hazards: [arrival, smoke, spikes, volley] },
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; redSheet = redSrc = null; smoke.init = ambush.init = spikes.init = volley.init = arrival.init = courtyard.init = null; },
  });
})();
