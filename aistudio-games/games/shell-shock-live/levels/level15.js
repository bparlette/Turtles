// Level 15 (TRUE FINALE): SHREDDER'S TOWER. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Section 1: Foot HQ express elevator. One locked screen, floors whoosh past the glass, Foot Elite drop in through the
//            ceiling hatches, a red security scan sweeps the car (jump it).
// Section 2: rain-swept penthouse. Sword duel with SHREDDER (Oroku Saki): gauntlet-blade combo, dash slash, shuriken fan,
//            teleport dive-kick, Foot Elite call-in. On KO he staggers onto the roof hatch, it gives way and he plunges
//            into the TCRI mutagen reservoir below.
// Section 3: TCRI ooze labs. Mutagen vats crack and burst (telegraphed puddles). SUPER SHREDDER tears through the wall:
//            energy blasts, ground-shattering stomp (jump the shock ring), wall-collapse debris, phase 2 at 50%.
// Outro: the facility collapses, escape, then the grand finale on the rooftop at dawn: four brothers + Amber, THE END.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level15_elevator.jpg", BG2 = "levels/level15_penthouse.jpg", BG3 = "levels/level15_lab.jpg";
  const SH_IMG = "levels/level15_shredder.webp", SU_IMG = "levels/level15_super.webp", EL_IMG = "levels/level15_elite.webp";
  const IK = 224 / 512; // background image px -> world px
  let G = null; // all mutable module state; reset on onStart / section entry, dropped in onUnload
  let RED = {}; // red-tinted sprite sheet copies (canvas), built lazily
  const fresh = () => ({ travel: 0, speed: 4, scan: null, drops: [], dropCd: 40, ding: 0, flash: 0, boltT: 200, ko: null, hatch: 0,
    vats: [], rings: [], deb: [], hole: null, chunks: [], debCd: 300, sp: false });

  // ---- Music: an original A-minor climb (148 BPM) + the boss track re-keyed for the finale ----
  const CH = ["Am", "Am", "F", "G", "Am", "Am", "Dm", "E", "F", "G", "Am", "Am", "Dm", "F", "E", "E"];
  const music = A.track({ bpm: 148, loop: true, chords: CH,
    lead: ["A5:2 E5:2 A5:2 C6:2 B5:4 A5:4", "G5:2 E5:2 C5:4 E5:4 .:4", "F5:2 A5:2 C6:4 A5:2 F5:2 A5:4", "G5:2 B5:2 D6:4 B5:4 .:4",
      "A5:2 C6:2 E6:4 D6:2 C6:2 B5:4", "C6:2 B5:2 A5:4 E5:4 .:4", "D6:2 F6:2 A6:4 F6:2 D6:2 A5:4", "G#5:4 B5:4 E6:4 .:4",
      "F5:2 A5:2 C6:2 F6:2 E6:4 C6:4", "D6:2 B5:2 G5:2 B5:2 D6:4 .:4", "E6:3 .:1 E6:2 C6:2 A5:4 C6:4", "B5:2 A5:2 E5:4 A5:4 .:4",
      "D6:2 C6:2 A5:4 F5:4 A5:4", "C6:2 F6:2 A6:4 G6:2 F6:2 C6:4", "B5:4 G#5:4 E5:4 B5:4", "E6:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k.hsk.hsk.hsk.ho", 15).concat(["k.s.s.sssksssso."]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 192);

  // ---- helpers ----
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const boss = () => A.enemies.find((e) => e.boss);
  const blink = (t, n) => Math.floor(t / (n || 6)) % 2 === 1;
  function redSheet(src) { // a red-washed copy of a sprite sheet for telegraph flashes (works without ctx.filter)
    if (RED[src]) return RED[src];
    const im = A.img(src); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgba(255,40,30,0.62)"; c.fillRect(0, 0, cv.width, cv.height);
    return (RED[src] = cv);
  }
  // draw a sheet frame [x, y, w, h, anchorX] with its body anchor (not the bbox centre) on sx; optional rotation for KO poses
  function spr(api, src, F, sx, sy, k, facing, red, rot) {
    const im = red ? redSheet(src) || api.img(src) : api.img(src);
    if (!im) { api.rect(sx - 10, sy - F[3] * k, 20, F[3] * k, red ? "#7a1a14" : "#2a2434"); return; }
    const ox = (F[2] / 2 - F[4]) * k * facing;
    if (rot) { const c = api.ctx; c.save(); c.translate(sx, sy - 6); c.rotate(-facing * Math.PI / 2); api.drawFrame(im, F, 0, 0, k, facing); c.restore(); return; }
    api.drawFrame(im, F, sx + ox, sy, k, facing);
  }
  function dropIn(api, type, x, y, z) { // spawn an enemy that falls in at (x, y) from height z and rolls to its feet
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return null;
    Object.assign(e, { x, y, z: z || 60, vz: 0.5, vx: 0, state: "down", t: 0, bounced: false, bowl: false, facing: api.player.x < x ? -1 : 1, entered: true });
    return e;
  }
  function smokeIn(api, type, x, y) { // ninja appears in a puff of smoke
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return null;
    Object.assign(e, { x, y, facing: api.player.x < x ? -1 : 1, entered: true });
    api.fx("smoke", x, y - 14, 26); api.fx("smoke", x + 6, y - 24, 22); api.SFX.shuriken();
    return e;
  }

  // ---- FOOT ELITE: Shredder's guard has its own painted sheet (level15_elite.webp). It is wired through the engine's
  // enemySkins hook (see the level def below): the engine picks the frame per state and draws it in every path
  // (walk, thrown, fly-at-camera, hit flash). Frames are [x, y, w, h, anchorX] at the engine's default skin scale.
  const ELF = { idle: [5,  9,  108,  160,  53], walk: [117,  0,  101,  169,  58], walk2: [222,  1,  103,  168,  47], attack: [329,  6,  156,  163,  47], jump: [489,  40,  120,  129,  44], hurt: [613,  20,  97,  149,  37], down: [714,  130,  145,  39,  72], throw: [863,  7,  181,  162,  87], grab: [1048,  13,  158,  156,  72], dash: [1210,  55,  175,  114,  112] };
  const ELITE_SKIN = { img: EL_IMG, frames: ELF };
  const FOOT_HEAVY = { img: "levels/enemies_foot.webp", frames: {"idle":[4,1,112,167,45],"walk":[120,0,97,168,47],"walk2":[221,0,92,168,49],"attack":[317,4,146,164,56],"jump":[467,11,107,157,48],"hurt":[578,13,91,155,47],"down":[673,120,191,48,95],"shoot":[868,6,141,162,46]} }; // painted Foot heavy trooper (heavy + gunner)

  // ================= SECTION 1: THE ELEVATOR =================
  const WIN = [0, 42, 384, 133]; // glass area (world)
  const PILLARS = [[140, 36], [700, 38]]; // pillar strips in the jpg (x, w) redrawn over the passing floors
  const elevator = {
    init: () => { G = fresh(); G.travel = 0; G.speed = 4; G.scan = { t: -180, dir: 1, hit: new Set() }; G.drops = []; G.dropCd = 30; G.ding = 0; return {}; },
    update(st, api, p) {
      const S = api.STATE, exit = S.phase === "exit";
      G.speed = exit ? Math.max(0, G.speed - 0.05) : Math.min(4, G.speed + 0.05);
      G.travel += G.speed;
      if (exit && G.speed === 0 && !G.ding) { G.ding = 1; api.SFX.confirm(); api.shake(2, 10, true); api.playerBark(true, "TOP FLOOR. SHREDDER'S WAITING!"); }
      if (G.ding) G.ding++;
      if (!exit && api.t % 220 === 0) api.shake(1, 12, true); // the car judders on the way up
      // ceiling-hatch drop-ins replace the engine's edge spawns in here
      if (!exit) S.spawnT = 99;
      if (--G.dropCd <= 0 && S.locked && S.queue.length > G.drops.length && api.enemies.length + G.drops.length < 5) {
        const x = api.rnd(40, api.W - 40), y = api.rnd(api.floorTop + 4, api.floorBot - 4);
        G.drops.push({ x, y, t: 0 }); G.dropCd = 38; api.SFX.door();
      }
      G.drops = G.drops.filter((d) => { // the queue entry is only taken at landing, so the wave never looks cleared early
        if (++d.t === 40) { if (S.queue.length) { dropIn(api, S.queue.shift(), d.x, d.y, 70); api.SFX.clink(); } return false; }
        return true;
      });
      // security scan: a red beam sweeps the floor front-to-back (or back-to-front); jump over it
      const sc = G.scan;
      if (!exit || sc.t > 0) {
        sc.t++;
        if (sc.t === 1) api.SFX.charge();
        if (sc.t > 48) {
          const k = (sc.t - 48) / 54, by = sc.dir > 0 ? api.lerp(api.floorTop - 3, api.floorBot + 3, k) : api.lerp(api.floorBot + 3, api.floorTop - 3, k);
          sc.y = by;
          if (canHurt(p) && !sc.hit.has(p) && p.z < 7 && Math.abs(p.y - by) < 2.6) { sc.hit.add(p); api.hurtPlayer(1, false, p.facing > 0 ? -1 : 1); api.fx("spark", p.x, p.y - 8, 8); }
          for (const e of api.enemies) if (hittable(e) && !sc.hit.has(e) && e.z < 7 && Math.abs(e.y - by) < 2.6) { sc.hit.add(e); api.hitEnemy(e, 2, true, e.facing > 0 ? -1 : 1); }
          if (k >= 1) { sc.t = -(240 + (Math.random() * 120 | 0)); sc.dir = -sc.dir; sc.hit = new Set(); sc.y = null; }
        }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, im = api.img(BG1), [wx, wy, ww, wh] = WIN;
      c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
      // speed streaks + passing floors (they slide DOWN past the glass while the car climbs)
      const sp = G.speed;
      if (sp > 0.3) { c.globalAlpha = Math.min(0.45, sp * 0.1); for (let i = 0; i < 18; i++) { const x = (A.hash(i) * ww) | 0, y = ((A.hash(i + 30) * 400 + G.travel * (2.2 + A.hash(i + 7))) % 400) - 120; api.rect(x, y, 1, 26 + (i % 3) * 12, "#b8c8ff"); } c.globalAlpha = 1; }
      const GAP = 150, off = G.travel % GAP;
      for (let j = -1; j < 2; j++) {
        const y = wy - 40 + off + j * GAP; if (y > wy + wh || y < wy - 60) continue;
        api.rect(0, y, ww, 34, "#11131b"); api.rect(0, y, ww, 2, "#3a3e52"); api.rect(0, y + 32, ww, 2, "#05060a");
        for (let x = 6; x < ww; x += 22) { const lit = A.hash(x + j * 7 + Math.floor(G.travel / GAP) * 13) > 0.35; api.rect(x, y + 10, 14, 12, lit ? "#e8b860" : "#1c2030"); if (lit) api.rect(x, y + 10, 14, 2, "#fff0c0"); }
        api.rect(ww / 2 - 4, y + 4, 8, 3, api.t % 30 < 15 ? "#ff3a2a" : "#5a1410"); // emergency light
      }
      c.restore();
      if (im) { // pillars back on top of the floors
        c.save(); c.imageSmoothingEnabled = true; try { c.filter = "brightness(1.3) contrast(1.05)"; } catch (_) {}
        for (const [x, w] of PILLARS) c.drawImage(im, x, 92, w, 318, x * IK, 92 * IK, w * IK, 318 * IK);
        c.filter = "none"; c.restore();
      }
      // floor indicator above the doors + readout
      const floor = G.ding ? 100 : Math.min(99, 61 + Math.floor(G.travel / 520));
      const cell = G.ding ? 11 : floor % 9;
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.85; glow(c, 130.8 + cell * 10.15, 25, 9, "rgba(255,170,60,0.95)"); c.restore();
      const label = G.ding ? "PENTHOUSE" : "FLOOR " + floor + (sp > 0.3 ? " ^" : "");
      api.rect(api.W / 2 - 34, 33, 68, 10, "rgba(10,8,14,0.75)"); api.ptext(label, api.W / 2, 35, 1, G.ding && blink(G.ding, 8) ? "#ffffff" : "#ffcf6a");
      if (G.ding > 0 && G.ding < 150) api.ptext("DING!", api.W / 2, 50, 2, "#ffe060");
      // ceiling-hatch telegraphs: falling dust + a growing shadow where the ninja will land
      for (const d of G.drops) {
        const k = d.t / 40;
        c.globalAlpha = 0.25 + k * 0.4; c.fillStyle = "#000"; c.beginPath(); c.ellipse(d.x, d.y, 4 + k * 9, 1.5 + k * 3, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
        api.rect(d.x - 10, 0, 20, 3, blink(d.t, 4) ? "#ff3a2a" : "#3a1a1a");
        for (let i = 0; i < 3; i++) api.rect(d.x + api.rnd(-8, 8), ((d.t * 4 + i * 30) % 120), 1, 2, "#c8c0b0");
        if (blink(d.t)) api.ptext("!", d.x, d.y - 30, 2, "#ffe060");
      }
      // scan emitter strip along the back of the car
      const sc = G.scan;
      if (sc.t > 0) {
        const warn = sc.t <= 48;
        api.rect(0, api.floorTop - 4, api.W, 2, warn ? (blink(sc.t, 4) ? "#ff3a2a" : "#4a1010") : "#ff6a5a");
        if (warn && blink(sc.t)) { api.ptext("SECURITY SCAN! JUMP!", api.W / 2, 60, 1, "#ff8a7a"); }
      }
    },
    drawFront(st, api, cx) {
      const sc = G.scan, c = api.ctx;
      if (!sc || sc.y == null) return;
      c.save(); c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.35; api.rect(0, sc.y - 7, api.W, 7, "#ff2a3a");
      c.globalAlpha = 1; api.rect(0, sc.y - 1, api.W, 2, api.t % 4 < 2 ? "#fff0f0" : "#ff6a7a");
      c.restore();
    },
  };

  // ================= SECTION 2: THE PENTHOUSE DUEL =================
  const HATCH = { x: 192, y: 186, rx: 79, ry: 21 };
  const SHF = { idle: [0, 0, 102, 190, 42], walk: [106, 2, 114, 188, 56], attack: [224, 20, 128, 170, 50], jump: [356, 19, 128, 171, 72], hurt: [488, 29, 108, 161, 63],
    fall: [604, 28, 267, 162, 155], down: [875, 131, 205, 59, 102], ko: [1084, 50, 106, 140, 52], taunt: [1194, 0, 129, 190, 40] }; // fall / down (face-down) / ko (kneel) / taunt: painted, no rotation
  const SH_K = 86 / 190;
  const penthouse = {
    init: () => { if (!G) G = fresh(); G.ko = null; G.hatch = 0; G.flash = 0; G.boltT = 90; G.sp = false; return {}; },
    update(st, api, p) {
      const S = api.STATE;
      if (!G.sp) { G.sp = true; api.spawnBoss(SHRED); }
      if (--G.boltT <= 0) { G.boltT = 280 + (Math.random() * 260 | 0); G.flash = 10; G.thunder = 18; }
      if (G.flash > 0) G.flash--;
      if (G.thunder > 0 && --G.thunder === 0) api.SFX.rumble();
      const K = G.ko; if (!K) return;
      K.t++;
      const e = K.e;
      if (e && !e.gone) {
        e.t = 1; e.sayT = Math.max(e.sayT || 0, K.t < 60 ? 2 : 0); // hold the engine's dying timer while we stage the fall
        if (K.t < 54) { e.x = api.lerp(K.x0, HATCH.x, K.t / 54); e.y = api.lerp(K.y0, HATCH.y - 2, K.t / 54); e.facing = K.x0 < HATCH.x ? -1 : 1; }
        if (K.t === 54) { G.hatch = 1; api.SFX.boom(); api.SFX.clink(); api.shake(5, 24, true); api.fx("boom", HATCH.x, HATCH.y - 6, 30); for (let i = 0; i < 8; i++) api.fx("spark", HATCH.x + api.rnd(-50, 50), HATCH.y + api.rnd(-10, 10), 12); }
        if (K.t >= 100) { e.gone = true; api.SFX.boom(); G.splash = 40; }
      }
      if (G.hatch) G.hatch++;
      if (G.splash > 0) G.splash--;
      if (K.t === 120) api.playerBark(true, "HE FELL INTO THE MUTAGEN RESERVOIR!");
      if (K.t === 215) api.playerBark(true, "AFTER HIM! DOWN TO THE LABS!");
      if (K.t >= 290 && p.deadT === 0 && !S.fadeOut) { S.fadeOut = 1; api.SFX.jump(); }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      if (G.hatch) { // the hatch grate gives way: a hole full of glowing mutagen
        const k = Math.min(1, G.hatch / 10);
        c.fillStyle = "#04140a"; c.beginPath(); c.ellipse(HATCH.x, HATCH.y, HATCH.rx * 0.62 * k, HATCH.ry * 0.62 * k, 0, 0, 6.29); c.fill();
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6 + 0.2 * Math.sin(api.t * 0.2); glow(c, HATCH.x, HATCH.y, 40, "rgba(90,255,110,0.9)");
        if (G.splash > 0) { c.globalAlpha = G.splash / 40; api.rect(HATCH.x - 16, HATCH.y - 120, 32, 120, "rgba(140,255,140,0.6)"); glow(c, HATCH.x, HATCH.y - 30, 70, "rgba(160,255,160,1)"); }
        c.restore();
      }
      if (G.flash > 0) { c.globalAlpha = G.flash / 14; api.rect(0, 0, api.W, api.H, "#e8e8ff"); c.globalAlpha = 1; }
    },
  };

  function shuri(api, s, sx, sy) { // spinning four-point shuriken
    const c = api.ctx; c.save(); c.translate(Math.round(sx), Math.round(sy)); c.rotate(api.t * 0.5);
    c.fillStyle = "#d8dce8"; c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 1.4 : 5; c.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } c.closePath(); c.fill();
    c.fillStyle = "#3a2a48"; c.fillRect(-1, -1, 2, 2); c.restore();
  }
  const SH_P2 = { speed: 1.4, cool: 56 };
  function shPick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), dy = p.y - e.y;
    e.t = 0; e.cool = e.cfg.cool + (Math.random() * 20 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 36 && Math.abs(dy) < 12 && Math.random() < 0.7) { e.state = "kwind"; return; }
    const o = ["throw", "tk"]; if (Math.abs(dy) < 12) o.push("tele", "tele");
    if (e.p2 && !(e.sumCd > 0) && api.enemies.length < 3) o.push("summon");
    let m = o[Math.random() * o.length | 0]; if (m === e.last && Math.random() < 0.6) m = o[Math.random() * o.length | 0];
    e.last = m; e.state = m;
  }
  // ---- Boss entrance (entr v1): lightning shows Shredder crouched on the pagoda eave; he dives off it and lands on the mutagen hatch seal ----
  const SH_ENTR = {
    len: 190, zoom: 1.3, sub: "MASTER OF THE FOOT CLAN",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: api.camX + 306, y: api.floorTop + 6, z: 72, facing: -1, state: "pose", t: 0, walkT: 0 }); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 40 }),
    step(api, e, st, t) {
      if (!G) return;
      if (G.flash > 0) G.flash--;
      const hx = api.camX + HATCH.x, hy = HATCH.y;
      if (t === 6 || t === 22) { G.flash = t === 6 ? 12 : 7; api.SFX.boom(); api.shake(t === 6 ? 3 : 1, 12, true); }
      if (t < 48) { e.state = "pose"; e.t = t < 30 ? 0 : 160; e.facing = -1; return; }
      if (t === 48) { api.SFX.jump(); api.SFX.swing(); st.x0 = e.x; st.y0 = e.y; st.z0 = e.z; api.entr.puff(e.x, e.y - e.z, 2); }
      if (t > 48 && t <= 82) { const k = (t - 48) / 34; e.state = "tk"; e.t = 10; e.x = api.lerp(st.x0, hx, k); e.y = api.lerp(st.y0, hy, k); e.z = api.lerp(st.z0, 0, k * k) + Math.sin(k * Math.PI) * 26; e.facing = -1;
        if (t % 3 === 0) api.fx("smoke", e.x + 6, e.y - e.z - 30, 10); }
      if (t === 82) { e.z = 0; st.seal = 1; api.entr.impact(e.x, e.y, 7, { stop: 5, puffs: 6, sfx: "land" }); api.SFX.clink(); for (let i = 0; i < 8; i++) api.fx("spark", hx + api.rnd(-50, 50), hy + api.rnd(-8, 8), 12); }
      if (st.seal) st.seal = Math.max(0, st.seal - 0.02);
      if (t > 82 && t < 106) { e.state = "charge"; e.t = 8; e.trail = null; }
      if (t >= 106) { e.state = "pose"; e.t = 160; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 106) { api.SFX.swing(); api.fx("spark", e.x + e.facing * 22, e.y - 50, 12); } }
    },
    drawBack(api, st, t, cx) { if (!st.seal) return; const c = api.ctx; c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = st.seal * 0.7; glow(c, HATCH.x + (api.camX - cx), HATCH.y, 70, "rgba(90,255,110,0.9)"); c.restore(); },
    finish(api, e) { e.trail = null; if (G) { G.flash = 0; G.sp = true; } },
  };
  const SHRED = {
    name: "SHREDDER", base: "ramrod", atlas: "ninja", hp: 46, speed: 1.15, chargeSpeed: 1, cool: 84, pitch: 92, height: 88,
    moves: ["kick", "charge"],
    lines: { intro: "I AM OROKU SAKI... THE SHREDDER!", hit: ["INSOLENT FREAKS!", "YOU WILL KNEEL!", "IS THAT ALL?", "THE FOOT NEVER FALLS!"],
      summon: "FOOT ELITE! DESTROY THEM!", ko: "NO...! THIS CANNOT BE...!" },
    spawn(api, e) { Object.assign(e, { state: "pose", t: 0, x: 300, y: api.floorTop + 6, z: 0, facing: -1, inv: 2, sumCd: 400 }); },
    entrance: SH_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "pose") { // on the penthouse steps, lightning, then he steps down
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t === 10) { G.flash = 12; api.SFX.boom(); }
        if (e.t === 30) api.enemySay(e, SHRED.lines.intro, 110, 92, true);
        if (e.t === 150) api.enemySay(e, "TONIGHT I FINISH WHAT I STARTED, TURTLES!", 100, 92, true);
        if (e.t >= 250) { e.state = "walk"; e.t = 0; e.cool = 40; e.inv = 0; }
        return true;
      }
      if (e.state === "rage") { // phase 2: calls the Foot Elite and speeds up
        e.inv = 2;
        if (e.t === 1) { api.enemySay(e, "ENOUGH! FOOT ELITE, TO ME!", 100, 86, true); G.flash = 12; api.SFX.boom(); }
        if (e.t === 40) { smokeIn(api, "sword", 40, api.rnd(170, 205)); smokeIn(api, "sword", api.W - 40, api.rnd(170, 205)); }
        if (e.t >= 90) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, SH_P2); e.state = "walk"; e.t = 0; e.cool = 30; e.inv = 0; e.sumCd = 700; api.playerBark(true, "HE'S GETTING FASTER! STAY SHARP!"); }
        return true;
      }
      if (e.state === "walk" && !e.p2 && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { shPick(api, e, p); return true; }
      if (e.state === "kwind") { if (e.t === 2) api.SFX.clink(); if (e.t >= 16) { e.state = "kick"; e.t = 0; api.SFX.swing(); } return true; }
      if (e.state === "kick") { // two-hit gauntlet-blade combo, the second knocks down
        const dx = p.x - e.x, near = Math.sign(dx || e.facing) === e.facing && Math.abs(dx) < 40 && Math.abs(p.y - e.y) < 10 && p.z < 16;
        if (e.t === 12) api.SFX.swing();
        if (free && p.inv === 0 && near && ((e.t > 0 && e.t <= 5) || (e.t > 12 && e.t <= 17))) api.hurtPlayer(e.t > 12 ? 2 : 1, false, e.t > 12 ? e.facing : 0);
        if (e.t >= 30) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "tele") { if (e.t === 1) api.SFX.charge(); e.facing = p.x >= e.x ? 1 : -1; if (e.t >= 36) { e.state = "charge"; e.t = 0; e.trail = []; api.SFX.swing(); } return true; }
      if (e.state === "charge") { // dash slash along the row
        e.x += e.facing * 5.4; (e.trail = e.trail || []).push([e.x, e.y]); if (e.trail.length > 6) e.trail.shift();
        if (free && p.inv === 0 && p.z < 14 && Math.abs(p.x - e.x) < 20 && Math.abs(p.y - e.y) < 10) { api.hurtPlayer(2, false, e.facing); api.fx("spark", p.x, p.y - 18, 10); }
        if (e.x <= api.camX + 16 || e.x >= api.camX + api.W - 16 || e.t > 44) { e.state = "walk"; e.t = 0; e.trail = null; api.SFX.land(); api.dust(e.x, e.y); }
        return true;
      }
      if (e.state === "throw") { // shuriken fan
        const n = e.p2 ? 5 : 3;
        if (e.t === 20) { e.facing = p.x >= e.x ? 1 : -1; for (let i = 0; i < n; i++) api.shot({ x: e.x + e.facing * 16, y: e.y, vx: e.facing * 2.9, vy: (i - (n - 1) / 2) * 0.55, kind: "star", draw: shuri }); api.SFX.shuriken(); }
        if (e.t >= 42) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "tk") { // teleport kick: vanish in smoke, a target tracks you, then a dive kick from above
        e.inv = 2;
        if (e.t === 1) { api.fx("smoke", e.x, e.y - 20, 26); api.fx("smoke", e.x + 6, e.y - 34, 22); api.SFX.shuriken(); e.tx = p.x; e.ty = p.y; }
        if (e.t < 52) { e.tx = api.lerp(e.tx, p.x, 0.1); e.ty = api.lerp(e.ty, p.y, 0.1); e.x = e.tx; e.y = e.ty; e.z = 140; if (e.t === 40) api.SFX.charge(); return true; }
        if (e.t < 64) { e.z = Math.max(0, 140 * (1 - (e.t - 52) / 12)); return true; }
        e.z = 0; api.SFX.boom(); api.shake(3, 10, true); api.fx("ring", e.x, e.y, 18); api.dust(e.x - 8, e.y); api.dust(e.x + 8, e.y);
        if (canHurt(p) && p.z < 6 && Math.abs(p.x - e.x) < 26 && Math.abs(p.y - e.y) < 12) api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
        e.state = "stagger"; e.t = 0; e.vx = 0; e.inv = 0;
        return true;
      }
      if (e.state === "summon") {
        if (e.t === 14) { api.enemySay(e, SHRED.lines.summon, 80, 92); smokeIn(api, e.hp % 2 ? "blue" : "sword", 36, api.rnd(170, 205)); smokeIn(api, "star", api.W - 36, api.rnd(170, 205)); e.sumCd = 800; }
        if (e.t >= 40) { e.state = "walk"; e.t = 0; }
        return true;
      }
      return false;
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, c = api.ctx, f = e.facing;
      if (s === "tk" && t < 64) { // reticle while he is out of sight
        const gx = e.x - api.camX, r = 15 - Math.min(9, t / 6);
        c.strokeStyle = t % 6 < 3 ? "#ff3a3a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(gx, e.y, r, r * 0.35, 0, 0, 6.29); c.stroke();
        api.rect(gx - r - 3, e.y, 6, 1, "#ff3a3a"); api.rect(gx + r - 3, e.y, 6, 1, "#ff3a3a");
        if (t < 52) return;
      }
      if (G && G.ko && G.ko.t > 54) { // plunging into the reservoir: clip at the hole
        const k = (G.ko.t - 54) / 46;
        c.save(); c.beginPath(); c.rect(0, 0, api.W, HATCH.y + 2); c.clip();
        c.globalAlpha = Math.max(0, 1 - k * 0.6); spr(api, SH_IMG, SHF.fall, sx, sy + k * k * 110, SH_K * (1 - k * 0.3), f, false); c.restore();
        return;
      }
      if (e.p2 || s === "rage") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.25 + 0.15 * Math.sin(api.t * 0.2); glow(c, sx, sy - 44, 40, "rgba(170,60,255,0.8)"); c.restore(); }
      if (s === "charge" && e.trail) { c.save(); e.trail.forEach(([x, y], i) => { c.globalAlpha = 0.1 + i * 0.05; spr(api, SH_IMG, SHF.attack, x - api.camX, y, SH_K, f, true); }); c.restore(); }
      const knock = s === "down" || (s === "dying" && !(G && G.ko)); // knocked flat: blown off his feet, then face-down on the floor
      const fr = knock ? (t < 12 || e.z > 0 ? "fall" : "down") : s === "getup" ? (t < 10 ? "down" : "hurt") : s === "dying" ? (G.ko.t >= 36 ? "ko" : "hurt")
        : ["kick", "charge", "throw"].includes(s) ? "attack" : s === "tele" ? (t > 20 ? "attack" : "idle") : s === "tk" ? "jump" : s === "pose" && t >= 150 && t < 240 ? "taunt" : ["hurt", "stagger"].includes(s) ? "hurt" : s === "walk" && e.walkT > 0 && Math.floor(e.walkT / 10) % 2 ? "walk" : "idle";
      const red = (s === "tele" && t % 6 < 3) || (s === "kwind" && t % 4 < 2) || (s === "tk" && t >= 52);
      const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : 0;
      spr(api, SH_IMG, SHF[fr], sx + jx, sy, SH_K, f, red);
      if ((s === "kwind" || s === "tele") && t % 8 < 4) { const gx = sx + f * 22, gy = sy - 50; api.rect(gx - 4, gy, 9, 1, "#ffffff"); api.rect(gx, gy - 4, 1, 9, "#ffffff"); } // blade glint
      if (s === "kick" && ((t > 0 && t <= 6) || (t > 12 && t <= 18))) { // slash arcs
        c.save(); c.strokeStyle = "rgba(230,240,255,0.9)"; c.lineWidth = 2; c.beginPath(); const up = t > 12;
        c.arc(sx + f * 10, sy - 34, 26, f > 0 ? (up ? -1.3 : 0.9) : Math.PI - (up ? -1.3 : 0.9), f > 0 ? (up ? 0.2 : -0.6) : Math.PI - (up ? 0.2 : -0.6), f > 0 ? !up : up); c.stroke(); c.restore();
      }
    },
    onDefeat(api, e) { api.STATE.ramrodOn = false; G.ko = { t: 0, e, x0: e.x, y0: e.y }; for (const m of api.enemies) if (!m.boss) api.koEnemy(m); api.STATE.stars.length = 0; },
  };

  // ================= SECTION 3: TCRI OOZE LABS =================
  const TILE = 1880 * IK, VAT_X = [235 * IK, 841 * IK, 1227 * IK]; // vat centres inside one tile (world px)
  const V_IDLE = 240, V_WARN = 56, V_GUSH = 18, V_POOL = 170, V_CYC = V_IDLE + V_WARN + V_GUSH + V_POOL;
  const vats = {
    init: () => { const list = []; for (let n = 0; n < 3; n++) for (const x of VAT_X) { const vx = x + n * TILE; if (vx > 150 && vx < 1980) list.push({ x: vx, t: (list.length * 97) % V_CYC, hit: new Map() }); } return { list }; },
    update(st, api, p) {
      for (const v of st.list) {
        const on = v.x - api.camX > -60 && v.x - api.camX < api.W + 60;
        if (!on && v.t < V_IDLE) continue; // dormant vats off screen
        v.t = (v.t + 1) % V_CYC;
        if (v.t === V_IDLE) api.SFX.rumble();
        if (v.t === V_IDLE + V_WARN) { api.SFX.boom(); api.SFX.clink(); api.shake(2, 8, true); for (let i = 0; i < 6; i++) api.fx("spark", v.x + api.rnd(-14, 14), api.rnd(70, 140), 10); }
        if (v.t >= V_IDLE + V_WARN + 6 && v.t < V_IDLE + V_WARN + V_GUSH + V_POOL) {
          const py = api.floorTop + 9, test = (x, y, z) => z < 3 && ((x - v.x) / 34) ** 2 + ((y - py) / 10) ** 2 < 1;
          for (const [o, cd] of v.hit) if (cd > 1) v.hit.set(o, cd - 1); else v.hit.delete(o);
          if (canHurt(p) && !v.hit.has(p) && test(p.x, p.y, p.z)) { v.hit.set(p, 50); api.hurtPlayer(1, false, 0); api.fx("spark", p.x, p.y - 6, 8); }
          for (const e of api.enemies) if (hittable(e) && !v.hit.has(e) && test(e.x, e.y, e.z)) { v.hit.set(e, 60); api.hitEnemy(e, 1, true, e.x < v.x ? -1 : 1); }
        } else v.hit.clear();
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const v of st.list) {
        const x = v.x - cx; if (x < -60 || x > api.W + 60) continue;
        const t = v.t, warn = t >= V_IDLE && t < V_IDLE + V_WARN, burst = t >= V_IDLE + V_WARN, py = api.floorTop + 9;
        const pk = burst ? Math.min(1, (t - V_IDLE - V_WARN) / 10) * (t > V_CYC - 30 ? (V_CYC - t) / 30 : 1) : 0;
        if (warn) { // cracks spread over the glass, the ooze boils, and the landing zone is outlined
          const k = (t - V_IDLE) / V_WARN, jx = t % 4 < 2 ? 1 : 0;
          c.strokeStyle = "rgba(230,255,230,0.9)"; c.lineWidth = 1; c.beginPath();
          for (let i = 0; i < 5; i++) { let px = x + jx + (A.hash(i + v.x) - 0.5) * 30, py2 = 80 + A.hash(i * 3 + v.x) * 50; c.moveTo(px, py2); for (let j = 0; j < 4 * k; j++) { px += (A.hash(i * 9 + j) - 0.5) * 14; py2 += (A.hash(i * 5 + j + 2) - 0.5) * 14; c.lineTo(px, py2); } }
          c.stroke();
          c.save(); c.setLineDash([3, 3]); c.strokeStyle = blink(t, 4) ? "#9aff7a" : "#3a8a2a"; c.beginPath(); c.ellipse(x, py, 34, 10, 0, 0, 6.29); c.stroke(); c.restore();
          if (blink(t)) api.ptext("!", x, 58, 2, "#ffe060");
        }
        if (burst && t < V_IDLE + V_WARN + V_GUSH + 10) { // gush of ooze out of the broken vat
          const k = (t - V_IDLE - V_WARN) / (V_GUSH + 10);
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 1 - k; glow(c, x, 110, 46, "rgba(120,255,120,0.9)"); c.restore();
          c.fillStyle = "rgba(90,230,70,0.85)"; c.beginPath(); c.moveTo(x - 12, 100); c.quadraticCurveTo(x, py - 30 * (1 - k), x - 30 * k - 10, py); c.lineTo(x + 30 * k + 10, py); c.quadraticCurveTo(x, py - 30 * (1 - k), x + 12, 100); c.fill();
        }
        if (pk > 0) { // the toxic puddle (hurts while it glows)
          c.fillStyle = `rgba(70,210,50,${0.75 * pk})`; c.beginPath(); c.ellipse(x, py, 34 * pk, 10 * pk, 0, 0, 6.29); c.fill();
          c.fillStyle = `rgba(190,255,150,${0.6 * pk})`; c.beginPath(); c.ellipse(x - 6, py - 2, 18 * pk, 4 * pk, 0, 0, 6.29); c.fill();
          for (let i = 0; i < 3; i++) { const b = (api.t + i * 17 + (v.x | 0)) % 40; if (b < 20) api.rect(x + (A.hash(i + (api.t / 40 | 0)) - 0.5) * 50, py - b * 0.3, 2, 2, "#d8ffb0"); }
        }
      }
    },
  };

  // Super Shredder arena layer: the wall breach, shock rings and ceiling debris
  const SUF = { idle: [0, 1, 105, 260, 49], walk: [109, 0, 104, 261, 47], blast: [217, 32, 101, 229, 32], raise: [322, 42, 96, 219, 45], hurt: [422, 78, 102, 183, 50], down: [528, 212, 169, 49, 92], fall: [705, 89, 158, 172, 88], ko: [867, 189, 153, 72, 74] }; // fall / ko (kneel) painted
  const SU_K = 128 / 260, SU_FIX = { blast: 1.12, raise: 1.16, hurt: 1.3, fall: 1.12, ko: 1.15 }, RING_K = 0.3;
  function addDebris(api, n, near) {
    for (let i = 0; i < n; i++) {
      const p = api.player, x = i === 0 && near ? p.x + api.rnd(-10, 10) : api.camX + api.rnd(30, api.W - 30), y = i === 0 && near ? p.y : api.rnd(api.floorTop + 4, api.floorBot - 4);
      G.deb.push({ x, y, t: -i * 8, s: 5 + (Math.random() * 4 | 0) });
    }
  }
  const labArena = {
    init: () => { if (!G) G = fresh(); G.rings = []; G.deb = []; G.hole = null; G.chunks = []; G.debCd = 300; return {}; },
    update(st, api, p) {
      const b = boss(), fight = b && b.fightOn && b.state !== "dying" && !api.STATE.outro;
      if (fight && b.p2 && --G.debCd <= 0) { G.debCd = 300 + (Math.random() * 120 | 0); addDebris(api, 3, true); api.SFX.rumble(); }
      G.rings = G.rings.filter((R) => {
        R.r += 2.6; if (R.r < 4) return true;
        const test = (x, y, z) => Math.abs(Math.hypot(x - R.x, (y - R.y) / RING_K) - R.r) < 6 && z < 5;
        if (canHurt(p) && !R.hit.has(p) && test(p.x, p.y, p.z)) { R.hit.add(p); api.hurtPlayer(2, false, p.x < R.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !R.hit.has(e) && test(e.x, e.y, e.z)) { R.hit.add(e); api.hitEnemy(e, 2, true, e.x < R.x ? -1 : 1); }
        return R.r < 300;
      });
      G.deb = G.deb.filter((d) => {
        d.t++;
        if (d.t === 62) {
          api.SFX.land(); api.shake(2, 8, true); api.dust(d.x, d.y); api.fx("smoke", d.x, d.y - 6, 18);
          if (canHurt(p) && p.z < 20 && Math.abs(p.x - d.x) < 13 && Math.abs(p.y - d.y) < 8) api.hurtPlayer(2, false, p.x < d.x ? -1 : 1);
          for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - d.x) < 13 && Math.abs(e.y - d.y) < 8) api.hitEnemy(e, 2, true, e.x < d.x ? -1 : 1);
        }
        return d.t < 100;
      });
      G.chunks = G.chunks.filter((k) => { k.t++; k.x += k.vx; k.y += k.vy; k.vy += 0.15; return k.t < 60; });
    },
    drawBack(st, api, cx) {
      const c = api.ctx, H = G.hole;
      if (H) { // the wall Super Shredder smashed through
        const x = H.x - cx, y = api.floorTop - 4;
        if (H.t < 70) { // cracks spreading
          const k = H.t / 70; c.strokeStyle = "rgba(20,10,10,0.9)"; c.lineWidth = 1.5; c.beginPath();
          for (let i = 0; i < 7; i++) { let px = x, py = y - 46; c.moveTo(px, py); for (let j = 0; j < 6 * k; j++) { px += Math.cos(i * 0.9) * 7 + (A.hash(i * 7 + j) - 0.5) * 6; py += Math.sin(i * 0.9) * 7 + (A.hash(i * 3 + j) - 0.5) * 6; c.lineTo(px, py); } }
          c.stroke(); if (blink(H.t)) api.ptext("!", x, y - 104, 3, "#ffe060");
        } else { // jagged breach: lit rim, dark gut lit green from the reservoir side
          const pts = (r0, rv, sq, seed) => { c.beginPath(); for (let i = 0; i < 22; i++) { const an = i / 22 * 6.283, r = r0 + A.hash(i + seed) * rv; c.lineTo(x + Math.cos(an) * r, Math.min(y + 2, y - 44 + Math.sin(an) * r * sq)); } c.closePath(); };
          c.strokeStyle = "rgba(10,14,14,0.85)"; c.lineWidth = 1; c.beginPath();
          for (let i = 0; i < 9; i++) { let px = x + Math.cos(i * 0.7) * 34, py = y - 44 + Math.sin(i * 0.7) * 44; c.moveTo(px, py); for (let j = 0; j < 3; j++) { px += Math.cos(i * 0.7) * 8 + (A.hash(i * 7 + j) - 0.5) * 6; py += Math.sin(i * 0.7) * 8 + (A.hash(i * 3 + j) - 0.5) * 6; c.lineTo(px, py); } }
          c.stroke();
          c.fillStyle = "#6a7472"; pts(31, 9, 1.3, 3); c.fill();
          c.fillStyle = "#3a4442"; pts(28, 8, 1.28, 7); c.fill();
          const g = c.createRadialGradient(x - 4, y - 36, 2, x, y - 44, 40); g.addColorStop(0, "#1e5a2a"); g.addColorStop(0.5, "#0a2412"); g.addColorStop(1, "#020604");
          c.fillStyle = g; pts(24, 7, 1.26, 11); c.fill();
          api.rect(x - 22, y - 70, 3, 26, "#4a5654"); api.rect(x + 16, y - 80, 3, 30, "#4a5654"); api.rect(x - 6, y - 84, 2, 18, "#8a5a2a"); // torn pipes and rebar
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35 + 0.1 * Math.sin(api.t * 0.1); glow(c, x, y - 30, 30, "rgba(90,255,110,0.7)"); c.restore();
          for (let i = 0; i < 6; i++) api.rect(x - 34 + i * 12 + (A.hash(i) * 6 | 0), y - 2, 8 + (i % 2) * 3, 5, "#3a4040"); // rubble at the foot of the breach
        }
      }
      for (const k of G.chunks) api.rect(k.x - cx, k.y, k.s, k.s, k.t % 8 < 4 ? "#5a6060" : "#3a4040");
      for (const R of G.rings) { // ground shock rings
        if (R.r < 4) continue; const a = Math.max(0, 1 - R.r / 300);
        c.save(); c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(170,90,255,${0.55 * a + 0.2})`; c.lineWidth = 5; c.beginPath(); c.ellipse(R.x - cx, R.y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.strokeStyle = `rgba(230,255,220,${0.8 * a + 0.2})`; c.lineWidth = 1.5; c.stroke(); c.restore();
      }
      for (const d of G.deb) if (d.t > 0 && d.t < 62) { // shadows of falling ceiling chunks
        const k = d.t / 62; c.globalAlpha = 0.25 + 0.5 * k; c.fillStyle = "#000"; c.beginPath(); c.ellipse(d.x - cx, d.y, 4 + k * 8, 1.5 + k * 3, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
        if (blink(d.t)) api.ptext("!", d.x - cx, d.y - 22, 1, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      for (const d of G.deb) {
        if (d.t > 30 && d.t < 62) { const k = (d.t - 30) / 32, y = api.lerp(-10, d.y - 4, k * k); api.rect(d.x - cx - d.s, y - d.s, d.s * 2, d.s * 2, "#4a5050"); api.rect(d.x - cx - d.s, y - d.s, d.s * 2, 2, "#7a8282"); }
        else if (d.t >= 62) { api.rect(d.x - cx - d.s, d.y - d.s, d.s * 2, d.s, "#3a4040"); }
      }
    },
  };

  function orbDraw(api, s, sx, sy) {
    const c = api.ctx; c.save(); c.globalCompositeOperation = "lighter";
    glow(c, sx, sy - 6, 14, "rgba(170,80,255,0.9)"); glow(c, sx, sy - 6, 7, "rgba(200,255,190,1)"); c.restore();
    c.strokeStyle = "#e8d0ff"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 3; i++) { const an = api.t * 0.4 + i * 2.1; c.moveTo(sx, sy - 6); c.lineTo(sx + Math.cos(an) * 11, sy - 6 + Math.sin(an) * 8); } c.stroke();
  }
  function orbUpdate(api, s) {
    const p = api.player; s.x += s.vx; s.y += s.vy || 0; s.life = (s.life || 0) + 1;
    if (s.y < api.floorTop - 4 || s.y > api.floorBot + 4) s.vy = -(s.vy || 0);
    if (canHurt(p) && Math.abs(s.x - p.x) < 12 && Math.abs(s.y - p.y) < 8 && p.z < 18) { api.hurtPlayer(2, false, s.vx > 0 ? 1 : -1); api.fx("spark", s.x, s.y - 10, 10); s.dead = true; }
    if (s.x < api.camX - 30 || s.x > api.camX + api.W + 30 || s.life > 300) s.dead = true;
    return true;
  }
  const SU_P2 = { speed: 1.15, chargeSpeed: 1.45, cool: 64 };
  function suPick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), dy = p.y - e.y;
    e.t = 0; e.cool = e.cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 40 && Math.abs(dy) < 10 && Math.random() < 0.6) { e.state = "kwind"; return; }
    const o = ["fire", "fire", "slam"]; if (Math.abs(dy) < 8) o.push("tele"); if (e.p2) o.push("slam");
    let m = o[Math.random() * o.length | 0]; if (m === e.last && Math.random() < 0.6) m = o[Math.random() * o.length | 0];
    e.last = m; e.state = m;
  }
  // ---- Boss entrance (entr v1): the lab wall bulges and bursts, Super Shredder roars in the breach, then leaps to the centre and shatters the floor ----
  const SU_ENTR = {
    len: 200, zoom: 1.24, sub: "MUTATED BY THE OOZE",
    setup(api, e, st) { if (!G) G = fresh(); if (!G.hole) G.hole = { x: e.x, t: 0 }; Object.assign(e, { state: "breach", t: 0, z: 0, facing: -1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x - (t < 70 ? 20 : 0), y: e.y - e.z - 60 }),
    step(api, e, st, t) {
      if (!G) return;
      G.chunks = G.chunks.filter((k) => { k.t++; k.x += k.vx; k.y += k.vy; k.vy += 0.15; return k.t < 60; });
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t <= 60) { e.state = "breach"; e.t = Math.round(t * 69 / 60); G.hole.t = e.t; if (t % 12 === 0) { api.SFX.rumble(); api.shake(2, 10, true); api.entr.debris(e.x + api.rnd(-30, 30), e.y - 4, 110, 2, { spread: 0.6, up: -1, scale: 0.6 }); } return; }
      if (t === 61) { G.hole.t = 70; e.state = "kwind"; e.t = 1; api.entr.impact(e.x, e.y - 40, 8, { stop: 6, puffs: 6 }); api.SFX.finisher(); api.fx("boom", e.x, e.y - 50, 40);
        for (let i = 0; i < 22; i++) G.chunks.push({ x: e.x + api.rnd(-20, 20), y: e.y - api.rnd(20, 80), vx: api.rnd(-3, 1.2), vy: api.rnd(-3, 0), t: 0, s: 2 + (Math.random() * 4 | 0) });
        api.entr.debris(e.x - 10, e.y, 40, 16, { spread: 2.6, dir: -1, up: 1.5, h: 40 }); }
      if (t > 61 && t < 104) { e.state = "kwind"; e.t = 1; if (t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-18, 18), e.y - api.rnd(30, 120), 10); } if (t === 70) api.SFX.charge(); }
      if (t === 104) { api.SFX.jump(); st.x0 = e.x; st.y0 = e.y; }
      if (t > 104 && t <= 138) { const k = (t - 104) / 34; e.state = "hop"; e.t = 5; e.x = api.lerp(st.x0, cxm, k); e.y = api.lerp(st.y0, mid, k); e.z = Math.sin(k * Math.PI) * 50; }
      if (t === 138) { e.z = 0; api.entr.impact(e.x, e.y, 9, { stop: 7, puffs: 8 }); api.fx("ring", e.x, e.y, 24); api.entr.debris(e.x, e.y, 2, 14, { spread: 3.2, up: 2.2 }); api.SFX.rumble(); }
      if (t > 138) { e.state = "walk"; e.walkT = 0; e.facing = api.player.x >= e.x ? 1 : -1; }
    },
    finish(api, e) { e.fightOn = true; if (G && G.hole) G.hole.t = Math.max(G.hole.t, 70); },
  };
  const SUPER = {
    name: "SUPER SHREDDER", base: "ramrod", atlas: "ramrod", hp: 70, speed: 0.9, chargeSpeed: 1.2, cool: 92, pitch: 64, height: 132,
    moves: ["kick", "charge"],
    lines: { intro: "THE OOZE HAS MADE ME... INVINCIBLE!", hit: ["PATHETIC!", "I FEEL NOTHING!", "INSECTS!", "RAAAARGH!"],
      ko: "IMPOSSIBLE... THE POWER... IT'S TEARING ME APART...!" },
    spawn(api, e) {
      if (!G) G = fresh(); const hx = api.camX + 292; // entr v1: guard for Boss Rush (no section init)
      G.hole = { x: hx, t: 0 };
      Object.assign(e, { state: "breach", t: 0, x: hx, y: api.floorTop + 1, z: 0, facing: -1, inv: 2 });
    },
    entrance: SU_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "breach") { // the wall shakes, cracks, then bursts open
        e.inv = 2; e.facing = -1; G.hole.t = e.t;
        if (e.t % 14 === 0 && e.t < 70) { api.SFX.rumble(); api.shake(2, 10, true); }
        if (e.t === 70) {
          api.SFX.boom(); api.SFX.finisher(); api.shake(6, 30, true); api.fx("boom", e.x, e.y - 50, 40);
          for (let i = 0; i < 22; i++) G.chunks.push({ x: e.x + api.rnd(-20, 20), y: e.y - api.rnd(20, 80), vx: api.rnd(-3, 1.2), vy: api.rnd(-3, 0), t: 0, s: 2 + (Math.random() * 4 | 0) });
        }
        if (e.t === 84) api.enemySay(e, SUPER.lines.intro, 120, 64, true);
        if (e.t === 200) api.enemySay(e, "NOW I CRUSH YOU ALL, TURTLES!!", 90, 60, true);
        if (e.t >= 290) { e.state = "hop"; e.t = 0; e.h0 = [e.x, e.y]; e.h1 = [api.camX + 230, (api.floorTop + api.floorBot) / 2]; api.SFX.jump(); }
        return true;
      }
      if (e.state === "hop") {
        const k = Math.min(1, e.t / 34); e.inv = 2;
        e.x = api.lerp(e.h0[0], e.h1[0], k); e.y = api.lerp(e.h0[1], e.h1[1], k); e.z = Math.sin(k * Math.PI) * 50;
        if (k >= 1) { e.z = 0; stomp(api, e, p, 1); e.state = "walk"; e.t = 0; e.cool = 60; e.inv = 0; e.fightOn = true; }
        return true;
      }
      if (e.state === "rage") {
        e.inv = 2;
        if (e.t === 1) { api.enemySay(e, "THE POWER... IS OVERWHELMING!!", 110, 58, true); api.SFX.boom(); }
        if (e.t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-18, 18), e.y - api.rnd(30, 120), 10); }
        if (e.t === 50) { addDebris(api, 5, true); smokeIn(api, "sword", api.camX + 30, api.rnd(184, 212)); smokeIn(api, "heavy", api.camX + api.W - 30, api.rnd(184, 212)); }
        if (e.t >= 120) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, SU_P2); e.state = "walk"; e.t = 0; e.cool = 30; e.inv = 0; G.debCd = 240; api.playerBark(true, "HE'S EVEN STRONGER NOW! HIT HIM HARD!"); }
        return true;
      }
      if (e.state === "walk" && !e.p2 && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { suPick(api, e, p); return true; }
      if (e.state === "fire") { // energy blasts: charge glow at the palm (telegraph), then orbs
        if (e.t === 1) api.SFX.charge();
        if (e.t < 30) e.facing = p.x >= e.x ? 1 : -1;
        const shots = e.p2 ? [30] : [30, 48];
        if (shots.includes(e.t)) {
          const n = e.p2 ? 3 : 1;
          for (let i = 0; i < n; i++) api.shot({ x: e.x + e.facing * 30, y: e.y, vx: e.facing * 2.6, vy: (i - (n - 1) / 2) * 0.45, kind: "orb", draw: orbDraw, update: orbUpdate });
          api.SFX.zap(); api.shake(1, 6, true);
        }
        if (e.t >= 70) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "slam") { // ground-shattering stomp: fists up (telegraph), then rings + falling debris
        if (e.t === 1) api.SFX.charge();
        if (e.t === 46) { stomp(api, e, p, e.p2 ? 2 : 1); addDebris(api, e.p2 ? 4 : 2, false); }
        if (e.t >= 74) { e.state = "walk"; e.t = 0; }
        return true;
      }
      return false; // kwind / kick / tele / charge: the engine's Ramrod moves, drawn by our draw()
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, c = api.ctx, f = e.facing;
      if (s === "breach" && t < 70) return; // still behind the wall
      if (e.p2 || s === "rage") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.3 + 0.2 * Math.sin(api.t * 0.2); glow(c, sx, sy - 64, 62, "rgba(140,255,120,0.75)"); c.restore(); }
      const fr = s === "down" ? (t < 12 || e.z > 0 ? "fall" : "down") : s === "dying" ? (t < 14 ? "fall" : "ko") : s === "getup" && t < 10 ? "down" : ["hurt", "stagger", "getup"].includes(s) ? "hurt" : s === "fire" || s === "kick" ? "blast" : (s === "slam" && t < 46) || s === "rage" || s === "kwind" || s === "hop" ? "raise" : (s === "walk" || s === "charge" || s === "tele") && Math.floor((e.walkT || 0) / 12) % 2 ? "walk" : "idle";
      const red = (s === "tele" && t % 6 < 3) || (s === "slam" && t < 46 && t % 6 < 3) || (s === "fire" && t < 30 && t % 8 < 2) || (s === "kwind" && t % 4 < 2);
      const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : s === "rage" ? (t % 4 < 2 ? 1 : -1) : 0;
      if (s === "slam" && t < 46) { c.save(); c.globalAlpha = 0.25 + 0.4 * (t / 46); c.fillStyle = "#ff3a2a"; c.beginPath(); c.ellipse(sx, e.y, 20 + t * 0.6, (20 + t * 0.6) * RING_K, 0, 0, 6.29); c.fill(); c.restore(); if (blink(t)) api.ptext("!", sx, sy - 150, 3, "#ffe060"); }
      spr(api, SU_IMG, SUF[fr], sx + jx, sy, SU_K * (SU_FIX[fr] || 1), f, red);
      if (s === "fire") { // palm energy
        const hx = sx + f * 30, hy = sy - 76, k = Math.min(1, t / 30);
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5 + 0.5 * k; glow(c, hx, hy, 6 + 12 * k, "rgba(190,110,255,1)"); glow(c, hx, hy, 4 + 4 * k, "rgba(220,255,200,1)"); c.restore();
      }
      if (s === "rage" || (e.p2 && api.t % 30 < 2)) { c.save(); c.strokeStyle = "#c8ffb0"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 2; i++) { let x = sx + api.rnd(-20, 20), y = sy - 120; c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += api.rnd(-7, 7); y += 18; c.lineTo(x, y); } } c.stroke(); c.restore(); }
    },
    onDefeat(api) { G.rings = []; G.deb = []; api.STATE.stars.length = 0; G.collapse = true; },
  };
  function stomp(api, e, p, n) {
    api.SFX.boom(); api.shake(5, 18, true); api.STATE.shake = Math.max(api.STATE.shake, 10); api.fx("ring", e.x, e.y, 20); api.dust(e.x - 14, e.y); api.dust(e.x + 14, e.y);
    if (canHurt(p) && p.z < 4 && Math.abs(p.x - e.x) < 30 && Math.abs(p.y - e.y) < 12) api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
    for (let i = 0; i < n; i++) G.rings.push({ x: e.x, y: e.y, r: -i * 60, hit: new Set() });
  }

  // ================= OUTRO: collapse, escape, the grand finale =================
  const BROS = ["lenny", "rafe", "miko", "donny"], TK = 42 * 1.6 * 0.92 / 150;
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro
      if (t === 1) { Object.assign(st, { rocks: [], fw: [], conf: [] }); G = G || fresh(); G.rings = []; G.deb = []; }
      if (t < 200) { // PART 1: the labs come down around him; run!
        if (t === 8) api.playerBark(true, "THE WHOLE LAB IS COMING DOWN!");
        if (t === 90) api.playerBark(true, "GO GO GO!");
        if (t % 16 === 0) { api.SFX.rumble(); api.shake(3, 14, true); }
        if (t % 5 === 0) st.rocks.push({ x: api.rnd(0, api.W), y: -8, vy: api.rnd(2, 3.5), s: 2 + (Math.random() * 5 | 0) });
        st.rocks = st.rocks.filter((r) => { r.y += r.vy; r.vy += 0.1; return r.y < api.H; });
        if (t > 50) { p.facing = 1; p.x += 2.4; p.walkT++; p.y = api.lerp(p.y, (api.floorTop + api.floorBot) / 2, 0.05); }
        if (t === 150) { api.SFX.boom(); api.SFX.finisher(); api.shake(6, 40, true); }
        return false;
      }
      // PART 2: dawn on the rooftop; the brothers and Amber celebrate
      const k = t - 200;
      if (!st.cast) {
        const me = (p.bro && p.bro.name || "lenny").toLowerCase();
        st.cast = BROS.map((n, i) => ({ n, x: n === me ? 150 : i < 2 ? -30 - i * 30 : api.W + 30 + (i - 2) * 30, y: 182 + (i % 2) * 12, tx: [70, 128, 256, 314][i], z: 0, me: n === me }));
        st.amber = { x: 192, y: 176, z: 0, a: 0 };
      }
      if (k === 40) api.playerBark(true, "WE DID IT! SHREDDER'S FINISHED!");
      if (k === 70) api.SFX.confirm();
      for (const b of st.cast) { const d = b.tx - b.x; if (Math.abs(d) > 2) { b.x += Math.sign(d) * 2.2; b.walk = (b.walk || 0) + 1; } else { b.walk = 0; b.cheer = (b.cheer || 0) + 1; } b.z = b.cheer && k > 120 ? Math.abs(Math.sin(b.cheer * 0.14 + b.tx)) * 14 : 0; }
      st.amber.a = Math.min(1, k / 40); if (k > 120) st.amber.z = Math.abs(Math.sin(k * 0.12)) * 9;
      if (k === 110) st.amberSay = 130;
      if (st.amberSay > 0) st.amberSay--;
      if (k === 150) st.endT = 0;
      if (st.endT !== undefined) {
        st.endT++;
        if (st.endT % 30 === 1) { st.fw.push({ x: api.rnd(40, api.W - 40), y: api.rnd(22, 90), t: 0, c: ["#ffe060", "#ff6af0", "#7fdcff", "#7fd85a", "#ff8c1a"][st.fw.length % 5] }); if (st.endT < 420) api.SFX.boom(); }
        if (st.conf.length < 110 && st.endT % 2 === 0) st.conf.push({ x: api.rnd(0, api.W), y: -4, vx: api.rnd(-0.4, 0.4), vy: api.rnd(0.6, 1.3), c: ["#ffe060", "#ff6af0", "#7fdcff", "#7fd85a", "#ff8c1a", "#ffffff"][Math.random() * 6 | 0] });
        for (const f of st.conf) { f.x += f.vx + Math.sin((f.y + f.x) * 0.05) * 0.3; f.y += f.vy; if (f.y > api.H) f.y = -4; }
        st.fw = st.fw.filter((f) => ++f.t < 60);
      }
      if (k > 760) return true;
      return false;
    },
    draw(api, st, t, cx) {
      const c = api.ctx;
      if (t < 200) { // alarms, falling rubble, then a white-out
        if (Math.floor(t / 10) % 2) { c.globalAlpha = 0.18; api.rect(-10, -10, api.W + 20, api.H + 20, "#ff2a1a"); c.globalAlpha = 1; }
        for (const r of st.rocks || []) api.rect(r.x, r.y, r.s, r.s, "#4a5050");
        if (t > 20 && t < 120 && blink(t, 12)) api.ptext("WARNING: FACILITY COLLAPSE", api.W / 2, 50, 1, "#ff8a7a");
        if (t > 150) { c.globalAlpha = Math.min(1, (t - 150) / 40); api.rect(-10, -10, api.W + 20, api.H + 20, "#ffffff"); c.globalAlpha = 1; }
        return;
      }
      if (!st.cast) return;
      const k = t - 200, im = api.img(BG2);
      if (im) { c.save(); c.imageSmoothingEnabled = true; c.drawImage(im, -4, -4, api.W + 8, api.H + 8); c.restore(); } else api.rect(-10, -10, api.W + 20, api.H + 20, "#2a2040");
      c.save(); c.globalAlpha = 0.42; const g = c.createLinearGradient(0, 0, 0, api.H); g.addColorStop(0, "#ffb060"); g.addColorStop(0.5, "#ff7a8a"); g.addColorStop(1, "#6a3a5a"); c.fillStyle = g; c.fillRect(-10, -10, api.W + 20, api.H + 20);
      c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.55; glow(c, api.W / 2, 96, 150, "rgba(255,190,90,0.7)"); c.restore(); // the storm breaks: sunrise
      const am = api.atlasImg("amber"), a = st.amber;
      const actors = st.cast.concat([{ amber: true, x: a.x, y: a.y, z: a.z }]).sort((p, q) => p.y - q.y);
      for (const b of actors) {
        api.contactShadow(b.x, b.y, b.z, 10);
        if (b.amber) { c.globalAlpha = a.a; if (am) api.drawFrame(am, api.ATLAS.amber.free, b.x, b.y - b.z, 54 / 150 * 1.05, 1); c.globalAlpha = 1; continue; }
        const im2 = api.atlasImg(b.n), F = api.ATLAS[b.n]; if (!F) continue;
        const fr = b.z > 2 ? F.jump : b.walk && Math.floor(b.walk / 8) % 2 ? F.walk : F.idle;
        if (im2) api.drawFrame(im2, fr, b.x, b.y - b.z, TK, b.x < 192 ? 1 : -1); else api.rect(b.x - 6, b.y - b.z - 30, 12, 30, "#3fae3a");
      }
      if (st.amberSay > 0) api.bubble(a.x, a.y - 66, "MY HEROES! THE CITY IS SAFE!", "#e8302a", 7);
      if (k < 30) { c.globalAlpha = 1 - k / 30; api.rect(-10, -10, api.W + 20, api.H + 20, "#ffffff"); c.globalAlpha = 1; }
      if (st.endT === undefined) return;
      const e = st.endT;
      for (const f of st.fw) {
        const q = f.t / 60, r = 6 + q * 34; c.globalAlpha = q < 0.7 ? 1 : (1 - q) / 0.3;
        for (let i = 0; i < 14; i++) { const an = i * 0.449; api.rect(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r + q * q * 12, 2, 2, i % 3 ? f.c : "#ffffff"); }
        c.globalAlpha = 1;
      }
      for (const f of st.conf) api.rect(f.x, f.y, (f.x | 0) % 3 ? 2 : 1, (f.y | 0) % 4 < 2 ? 1 : 2, f.c);
      const al = Math.min(1, e / 25);
      c.globalAlpha = 0.5 * al; api.rect(0, 26, api.W, 80, "#05030a"); c.globalAlpha = al;
      api.ptext("THE END", api.W / 2, 52, e < 12 ? 10 - Math.floor(e / 3) : 6, e % 20 < 10 ? "#ffe060" : "#ffb21a");
      if (e > 40) api.ptext("SHREDDER IS GONE. THE CITY SLEEPS EASY.", api.W / 2, 86, 1, "#ffffff");
      if (e > 90) api.ptext("THANKS FOR PLAYING SHELL SHOCK LIVE!", api.W / 2, 98, 1, "#ff9af0");
      c.globalAlpha = 1;
    },
  };

  SS.registerLevel({
    number: 15,
    name: "SHREDDER'S TOWER",
    final: true,
    card: { title: "SHREDDER'S TOWER", tagline: "THE TRUE FINALE. END THIS, BROTHERS.", color: "#b03aff" },
    music, bossMusic,
    enemySkins: { purple: ELITE_SKIN, blue: ELITE_SKIN, sword: ELITE_SKIN, star: ELITE_SKIN, dasher: ELITE_SKIN, heavy: FOOT_HEAVY, gunner: FOOT_HEAVY }, // Foot Elite + Foot heavy sheets
    hues: { sword: 340, purple: 300, blue: 320, star: 350, dasher: 10, heavy: 300, gunner: 220 },
    images: [SH_IMG, SU_IMG, EL_IMG, "levels/level15_freefall.webp", "levels/level15_dojo.jpg"],
    sections: [ // phase 2: labs (zone 1) -> express elevator, cable snap (twist) -> sky dojo (zone 2) -> penthouse (Shredder) -> lab arena (Super Shredder)
      { seg: "zone1", bg: BG3, floor: [178, 220], length: 1300, locks: [0, 620],
        waves: [["purple", "sword", "gunner", "purple"], ["heavy", "sword", "star", "dasher"]],
        weather: "drips", hazards: [vats], sky: "#0a1a14", ground: "#26302c" },
      { seg: "twist", bg: BG1, floor: [186, 221], length: 384, locks: [0, 0, 0],
        waves: [["purple", "sword", "purple"], ["blue", "star", "sword", "dasher"], ["heavy", "sword", "blue", "star"]],
        hazards: [elevator], sky: "#0c1020", ground: "#2a2c34",
        twist: { kind: "freefall", gate: false, at: 700, img: "levels/level15_freefall.webp", fr: {"cable": [0, 0, 50, 300], "brake": [53, 0, 190, 173], "hatch": [246, 0, 200, 66], "weight": [0, 303, 160, 158], "elight": [163, 303, 40, 40]}, cable: "cable", brake: "brake", weight: "weight", elight: "elight",
          snapMsg: "THE CABLE SNAPPED!", brakeMsg: "BRAKES HOLD!", dingMsg: "WINCHED BACK UP - KEEP CLIMBING!" } },
      { seg: "zone2", bg: "levels/level15_dojo.jpg", floor: [178, 220], length: 1300, locks: [0, 620],
        waves: [["blue", "star", "sword", "dasher"], ["sword", "sword", "heavy", "dasher", "star"]],
        weather: "rain", hazards: [], sky: "#0c0a18", ground: "#2a2030" },
      { seg: "arena", bg: BG2, floor: [158, 218], length: 384, locks: [], waves: [], weather: "rain", hazards: [penthouse], sky: "#1a1030", ground: "#3a3448" },
      { seg: "arena2", bg: BG3, floor: [178, 220], length: 384, locks: [], waves: [],
        weather: "drips", hazards: [vats, labArena], sky: "#0a1a14", ground: "#26302c" },
    ],
    boss: SUPER,
    outro,
    onStart() { if (!G) G = fresh(); },
    onUnload() { G = null; RED = {}; },
  });
})();
