// Level 11: WILD WEST TRAIN (Act III, time travel). Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// 1880s freight train at sundown. Section 1: brawl along the boxcar roofs while the desert races past. Low tunnels
// (telltale ropes + banner warn you: press DOWN to hit the deck or get smacked flat), water-tower spouts that sweep the
// roof at shin height (jump them), coupling gaps between cars (jump or fall through), and outlaw boxcars that pull
// alongside on the next track, dump a gang of outlaws onto your roof, then uncouple and fall behind.
// Section 2: the flatcar behind the locomotive. Boss LEATHERHEAD bursts out of the coal tender: tail sweep, death-roll grab,
// chomp charge, swamp-strength crate / boulder throws; phase 2 adds tunnels in the arena (they smack him too if he's standing).
// Outro: the time rift tears open over the tracks and slingshots the train to New York City, 2105 (Level 12).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level11_train.jpg", BG2 = "levels/level11_boss.jpg", DES = "levels/level11_desert.jpg", GAT = "levels/level11_gator.webp";
  const ROOF_Y = 135;          // world y of the boxcar roof's back edge in level11_train.jpg (sky band is above it)
  const TS = 6;                // train speed relative to scenery (px / frame)
  const TILE = 1672 * 224 / 512, GAP0 = 776 * 224 / 512; // bg tile width and the coupling gap painted in each tile
  // Painted stage props (levels/level11_props.webp, keyed from chroma-green comic-ink renders): outlaw boxcar + sliding door,
  // water tower + spout, tunnel cliff / pillar / lintel, coupler, tumbleweed, crate, boulder, coal heap, cowboy hats.
  // Frames [x, y, w, h] in sheet px; CARDOOR = the doorway inside the car frame. Old code art stays as the load fallback.
  const PR_IMG = "levels/level11_props.webp";
  const PF = { car: [0, 0, 372, 169], cliff: [375, 0, 300, 261], tower: [0, 264, 96, 208], pillar: [99, 264, 40, 168], door: [142, 264, 70, 85], coal: [215, 264, 200, 78], pipe: [418, 264, 180, 21], beam: [0, 475, 120, 23], weed: [123, 475, 40, 40], crate: [166, 475, 60, 63], rock: [229, 475, 104, 92], coup: [336, 475, 44, 21], hat: [383, 475, 40, 17], hatK: [426, 475, 40, 17], hatT: [469, 475, 40, 17] };
  const CARDOOR = [145, 32, 89, 123];
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  const pimg = () => { const im = A.img(PR_IMG); return ready(im) ? im : null; };
  function box(f, x, y, w, h, flip) { const im = pimg(); if (!im) return false; const c = A.ctx; if (flip) { c.save(); c.translate(x + w / 2, 0); c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, y, w, h); c.restore(); } else c.drawImage(im, f[0], f[1], f[2], f[3], x, y, w, h); return true; }
  function spr(f, x, y, w, h, rot, flip) { const im = pimg(); if (!im) return false; const c = A.ctx; c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true; }
  function along(f, x0, y0, x1, y1, th) { // stretch a horizontal sprite along the segment (x0,y0)->(x1,y1)
    const im = pimg(); if (!im) return false; const c = A.ctx, L = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0)); c.drawImage(im, f[0], f[1], f[2], f[3], 0, -th / 2, L, th); c.restore(); return true;
  }
  let G = null;
  const fresh = () => ({ trav: 0, ev: null, evCd: 360, evN: 0, car: null, carCd: 0, carWave: -1, evN2: 0, puffs: [], weeds: [], ly: 0, lx: 0, red: null, splash: [] });
  const g = () => (G = G || fresh());

  // ---- Music: an original spaghetti-western gallop (A minor, 150 BPM) + a re-keyed boss track ----
  const CH = ["Am", "Am", "G", "Am", "F", "G", "E", "E", "Am", "Am", "Dm", "Am", "F", "E", "Am", "Am"];
  const L1 = "A4:2 .:1 E5:1 A5:4 G5:2 E5:2 .:4";
  const music = A.track({ bpm: 150, loop: true, chords: CH,
    lead: [L1, "D5:2 E5:2 C5:2 A4:2 .:8", "G4:2 .:1 D5:1 G5:4 F5:2 D5:2 .:4", "E5:4 C5:2 B4:2 A4:8",
      "F5:3 E5:1 F5:2 A5:2 C6:4 A5:4", "G5:3 F5:1 G5:2 B5:2 D6:4 B5:4", "G#5:2 B5:2 E6:4 D6:2 B5:2 G#5:4", "E5:8 .:8",
      L1, "C6:2 B5:2 A5:2 E5:2 .:8", "D5:2 F5:2 A5:4 D6:4 A5:4", "C6:3 B5:1 A5:4 E5:4 .:4",
      "F5:2 A5:2 C6:2 A5:2 F5:4 .:4", "E5:2 G#5:2 B5:2 D6:2 E6:4 .:4", "A5:4 E5:2 C5:2 A4:4 .:4", "A4:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 7, 12, 7, 0, 7, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k.hhs.hhk.hhs.hh", 15).concat(["k.s.s.sss.sssso."]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 182);

  // ---- helpers ----
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0) && !p.grabbedBy;
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const boss = () => A.enemies.find((e) => e.boss);
  const glow = (c, x, y, r, col) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const blink = (n) => Math.floor(A.t / n) % 2 === 0;
  function leapIn(api, type, x, z) { // an outlaw leaps onto the roof and lands rolling (engine fall + get-up physics)
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return null;
    const p = api.player;
    Object.assign(e, { x, y: api.floorTop + api.rnd(2, 10), z, vz: 1.6, vx: api.rnd(0.2, 0.9), state: "down", t: 0, bounced: false, bowl: false, facing: p.x < x ? -1 : 1, entered: true });
    return e;
  }

  // ================= SCENERY: racing desert, locomotive smoke, tumbleweeds =================
  const scenery = {
    init: () => { g(); return {}; },
    update(st, api) {
      const G = g(); G.trav += TS;
      if (Math.random() < 0.012) G.weeds.push({ x: api.W + 20, y: api.rnd(112, 130), r: api.rnd(4, 7), a: 0 });
      G.weeds = G.weeds.filter((w) => { w.x -= TS * 0.8; w.a += 0.3; return w.x > -20; });
    },
    drawBack(st, api) {
      const c = api.ctx, G = g(), im = api.img(DES);
      c.save(); c.beginPath(); c.rect(0, 0, api.W, ROOF_Y); c.clip();
      if (im) {
        const h = 150, w = im.width * h / im.height, off = (G.trav * 0.35) % w;
        c.imageSmoothingEnabled = true;
        for (let x = -off; x < api.W; x += w) c.drawImage(im, x, -10, w + 0.6, h);
      } else api.rect(0, 0, api.W, ROOF_Y, "#d8784a");
      for (const w of G.weeds) { // tumbleweeds bouncing past
        const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 6;
        if (spr(PF.weed, w.x, y, w.r * 2.3, w.r * 2.3, -w.a * 0.5)) continue;
        c.strokeStyle = "#8a6a3a"; c.lineWidth = 1; c.beginPath();
        for (let i = 0; i < 6; i++) { const a = w.a + i; c.moveTo(w.x + Math.cos(a) * w.r, y + Math.sin(a) * w.r); c.lineTo(w.x - Math.cos(a) * w.r, y - Math.sin(a) * w.r); }
        c.stroke(); c.beginPath(); c.arc(w.x, y, w.r, 0, 6.29); c.stroke();
      }
      c.restore();
      api.rect(0, ROOF_Y - 1, api.W, 1, "rgba(30,14,8,0.55)"); // re-ink the roof edge
    },
  };
  const arenaFx = { // boss flatcar: stack smoke and tumbleweeds behind the deck rail
    init: () => { g(); return {}; },
    update(st, api) {
      const G = g(); G.trav += TS;
      if (api.t % 9 === 0) G.puffs.push({ x: 313, y: 36, r: 6, a: 0.75, vx: -api.rnd(1.6, 2.6), vy: -api.rnd(0.2, 0.6) });
      G.puffs = G.puffs.filter((f) => { f.x += f.vx; f.y += f.vy; f.vy *= 0.97; f.r += 0.22; f.a -= 0.006; return f.a > 0; });
      if (Math.random() < 0.01) G.weeds.push({ x: api.W + 20, y: api.rnd(124, 136), r: api.rnd(4, 6), a: 0 });
      G.weeds = G.weeds.filter((w) => { w.x -= TS * 0.8; w.a += 0.3; return w.x > -20; });
    },
    drawBack(st, api) {
      const c = api.ctx, G = g();
      for (const w of G.weeds) { const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 5; if (spr(PF.weed, w.x, y, w.r * 2.3, w.r * 2.3, -w.a * 0.5)) continue; c.strokeStyle = "#7a5a32"; c.lineWidth = 1; c.beginPath(); c.arc(w.x, y, w.r, 0, 6.29); c.moveTo(w.x - w.r, y); c.lineTo(w.x + w.r, y); c.moveTo(w.x, y - w.r); c.lineTo(w.x, y + w.r); c.stroke(); }
      for (const f of G.puffs) { c.globalAlpha = Math.max(0, f.a) * 0.8; glow(c, f.x, f.y, f.r * 1.5, "rgba(84,76,90,0.9)"); }
      c.globalAlpha = 1;
    },
  };

  // ================= COUPLING GAPS between boxcars (static pits: jump them) =================
  const gaps = {
    init: (api, sec) => { const list = []; for (let x = GAP0; x < sec.length; x += TILE) list.push(x); return { list }; },
    update(st, api, p) {
      for (const x of st.list) {
        if (Math.abs(x - api.camX - api.W / 2) > api.W) continue;
        if (Math.abs(p.x - x) < 4 && p.z === 0 && !p.grabbedBy && p.downT === 0) api.dropPlayer(x, p.y, 1);
        for (const e of api.enemies) if (!e.boss && (e.state === "down" || e.state === "hurt") && e.z < 2 && Math.abs(e.x - x) < 6) { api.koEnemy(e); e.t = 20; api.fx("smoke", x, e.y - 6, 18); api.SFX.land(); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, G = g();
      for (const x0 of st.list) {
        const x = Math.round(x0 - cx); if (x < -20 || x > api.W + 20) continue;
        const top = ROOF_Y + 1, bot = api.floorBot + 6;
        c.fillStyle = "#120a06"; c.beginPath(); c.moveTo(x - 4, top); c.lineTo(x + 4, top); c.lineTo(x + 5, bot); c.lineTo(x - 5, bot); c.closePath(); c.fill();
        for (let i = 0; i < 6; i++) { const y = top + ((i * 9 + G.trav * 1.1) % (bot - top)); api.rect(x - 3, y, 7, 2, "#3a2a1c"); } // ties racing by below
        if (!spr(PF.coup, x, top + 21, 15, 15 * PF.coup[3] / PF.coup[2])) { api.rect(x - 5, top + 20, 11, 3, "#2a2a30"); api.rect(x - 1, top + 18, 3, 7, "#4a4a52"); } // coupler knuckle
        api.rect(x - 6, top, 2, bot - top, "rgba(255,190,120,0.35)"); api.rect(x + 5, top, 1, bot - top, "rgba(0,0,0,0.5)");
      }
    },
  };

  // ================= OUTLAW BOXCAR: pulls alongside, dumps the wave, uncouples =================
  const CAR_W = 112, CAR_IN = 70, CAR_DOOR = 22, CAR_GO = 150;
  const outlawCar = {
    init: () => ({}),
    update(st, api, p) {
      const G = g(), S = api.STATE;
      if (G.carCd > 0) G.carCd--;
      if (!G.car && S.locked && S.wave >= 1 && S.wave !== G.carWave && S.queue.length >= 2) { G.car = { t: 0, n: 0 }; G.carWave = S.wave; api.SFX.rumble(); }
      const car = G.car; if (!car) return;
      car.t++;
      if (car.t < CAR_IN + CAR_DOOR + 8) S.spawnT = Math.max(S.spawnT, 3); // hold the engine's edge spawns until the door opens
      if (car.t <= CAR_GO) { const k = Math.min(1, car.t / CAR_IN); car.x = -CAR_W - 20 + (150 + CAR_W) * (1 - (1 - k) * (1 - k)); }
      if (car.t === CAR_IN) api.SFX.door();
      const dt = car.t - CAR_IN - CAR_DOOR;
      if (dt >= 0 && dt < 60 && dt % 16 === 0 && car.n < 3 && S.queue.length && api.enemies.length < 5) {
        const e = leapIn(api, S.queue.shift(), api.camX + car.x + CAR_W / 2 + api.rnd(-8, 8), 34); car.n++;
        if (e) { api.SFX.jump(); if (car.n === 1) api.enemySay(e, ["YEEHAW!", "GET 'EM, BOYS!", "STICK 'EM UP!"][G.evN++ % 3], 60, 150); }
      }
      if (car.t === CAR_GO) { api.SFX.clink(); car.pop = 18; }
      if (car.t > CAR_GO) car.x -= (car.t - CAR_GO) * 0.12;
      if (car.pop > 0) car.pop--;
      if (car.t > CAR_GO + 20 && car.x < -CAR_W - 30) G.car = null;
    },
    drawBack(st, api) {
      const car = g().car; if (!car) return;
      const c = api.ctx, x = Math.round(car.x), y0 = 66, y1 = ROOF_Y - 1, open = Math.max(0, Math.min(1, (car.t - CAR_IN) / CAR_DOOR)) * (car.t > CAR_GO - 10 ? Math.max(0, 1 - (car.t - CAR_GO + 10) / 20) : 1);
      c.save(); c.beginPath(); c.rect(0, 0, api.W, ROOF_Y); c.clip();
      const pim = pimg();
      if (pim) { // painted boxcar: body, then the sliding door over the doorway
        const cw = CAR_W + 26, k = cw / PF.car[2], ch = PF.car[3] * k, cxl = x - 13, cy = y1 + 2 - ch;
        c.drawImage(pim, PF.car[0], PF.car[1], PF.car[2], PF.car[3], cxl, cy, cw, ch);
        const dx2 = cxl + CARDOOR[0] * k, dy2 = cy + CARDOOR[1] * k, dw2 = CARDOOR[2] * k, dh2 = CARDOOR[3] * k;
        if (open > 0.3) { c.globalAlpha = 0.6; glow(c, dx2 + dw2 * 0.7, dy2 + dh2 * 0.3, 22, "rgba(255,170,60,0.6)"); c.globalAlpha = 1; } // lantern inside
        c.drawImage(pim, PF.door[0], PF.door[1], PF.door[2], PF.door[3], dx2 + open * dw2, dy2, dw2, dh2);
        if (!spr(PF.coup, x + CAR_W + 9, y0 + 48, 16, 16 * PF.coup[3] / PF.coup[2])) api.rect(x + CAR_W, y0 + 46, 10, 4, "#2a2a30"); // coupler arm
        if (car.pop > 0) { api.rect(x + CAR_W + 10, y0 + 40 - (18 - car.pop), 3, 6, "#c8c8d0"); for (let i = 0; i < 3; i++) api.rect(x + CAR_W + 8 + api.rnd(-4, 8), y0 + 44 + api.rnd(-6, 6), 1, 1, "#ffe060"); }
      } else {
      api.rect(x, y0, CAR_W, y1 - y0, "#7a2e1c");
      for (let i = 4; i < CAR_W; i += 7) api.rect(x + i, y0 + 3, 1, y1 - y0 - 3, "#5a1e12");
      api.rect(x - 2, y0 - 4, CAR_W + 4, 5, "#3a1a10"); api.rect(x - 2, y0 - 4, CAR_W + 4, 1, "#9a5a3a");
      api.rect(x + 6, y0 + 4, 3, y1 - y0 - 4, "#2a1a14"); api.rect(x + CAR_W - 9, y0 + 4, 3, y1 - y0 - 4, "#2a1a14");
      const dx = x + CAR_W / 2 - 15;
      api.rect(dx, y0 + 6, 30, y1 - y0 - 6, "#160c08"); // doorway
      if (open > 0.3) { c.globalAlpha = 0.6; glow(c, dx + 15, y0 + 40, 22, "rgba(255,170,60,0.6)"); c.globalAlpha = 1; } // lantern inside
      api.rect(dx + open * 30, y0 + 6, 30, y1 - y0 - 6, "#8a3a24"); api.rect(dx + open * 30, y0 + 6, 30, 1, "#b0603a");
      for (let i = 0; i < 3; i++) api.rect(dx + open * 30 + 2, y0 + 16 + i * 18, 26, 1, "#4a1a10");
      api.rect(dx - 2, y0 + 4, 64, 2, "#2a2a30"); // door rail
      api.rect(x + CAR_W, y0 + 46, 10, 4, "#2a2a30"); // coupler arm
      if (car.pop > 0) { api.rect(x + CAR_W + 10, y0 + 40 - (18 - car.pop), 3, 6, "#c8c8d0"); for (let i = 0; i < 3; i++) api.rect(x + CAR_W + 8 + api.rnd(-4, 8), y0 + 44 + api.rnd(-6, 6), 1, 1, "#ffe060"); }
      }
      c.restore();
      if (car.t > CAR_GO && car.t < CAR_GO + 50 && blink(5)) api.ptext("UNCOUPLED!", Math.max(40, x + CAR_W / 2), 52, 1, "#ffe060");
      if (car.t > CAR_IN - 30 && car.t < CAR_IN + CAR_DOOR + 30 && blink(6)) api.ptext("OUTLAWS!", Math.max(40, x + CAR_W / 2), 52, 1, "#ff7a3a");
    },
  };

  // ================= TRACKSIDE EVENTS: low tunnels (duck) and water-tower spouts (jump) =================
  const SLANT = 0.22, TUN_LEN = 1150, DUCK_WIN = TS * 62;
  const laneX = (x0, y) => x0 + (y - A.floorTop) * SLANT;      // where a slanted obstacle crosses a given depth
  function startEvent(api, kind) { const G = g(); G.ev = { kind, t: 0, x: api.W + (kind === "tunnel" ? 660 : 700), hit: new Set(), told: false }; api.SFX.charge(); }
  function pressingDown(api, p) {
    const G = g(), dy = p.y - G.ly, dx = Math.abs(p.x - G.lx);
    return (dy > 0.25 && dx < 1.7) || (p.y >= api.floorBot - 0.01 && G.ly >= api.floorBot - 0.01 && p.walkT > 0 && dx < 0.3);
  }
  const events = {
    init: (api, sec) => ({ arena: !!sec.arena }),
    update(st, api, p) {
      const G = g(), S = api.STATE, b = boss();
      const allowed = !S.outro && (st.arena ? b && b.p2 && b.state !== "dying" : true);
      if (!G.ev && allowed && !G.car) { if (--G.evCd <= 0) startEvent(api, st.arena || G.evN2++ % 2 === 0 ? "tunnel" : "tower"); }
      const ev = G.ev;
      if (ev) {
        ev.t++; const px0 = ev.x; ev.x -= TS;
        const tunnel = ev.kind === "tunnel";
        // duck: press DOWN while the portal is close and you hit the deck until it has passed over you
        const pxs = p.x - api.camX, lx = laneX(ev.x, p.y);
        if (tunnel && !p.ducked && !ev.hit.has(p) && lx > pxs - 2 && lx - pxs < DUCK_WIN && p.deadT === 0 && !p.grabbedBy && !(p.sinkT > 0) && p.downT === 0 && p.z === 0 && pressingDown(api, p)) {
          const n = Math.ceil((lx - pxs) / TS) + 14;
          Object.assign(p, { downT: n, kvx: 0, hurtT: 0, attackT: 0, atk: null, ducked: true }); p.inv = Math.max(p.inv, n + 6);
          api.SFX.land(); api.dust(p.x, p.y);
          if (!ev.told) { ev.told = true; api.playerBark(true, "HIT THE DECK!"); }
        }
        if (p.ducked && p.downT === 0) p.ducked = false;
        const crossed = (x, y, z, hi) => { const a = laneX(px0, y), c = laneX(ev.x, y); return x - api.camX <= a && x - api.camX > c - 0.01 && (hi ? true : z < 13); };
        if (tunnel) {
          if (!ev.hit.has(p) && !p.ducked && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0) && p.downT === 0 && crossed(p.x, p.y, p.z, true)) {
            ev.hit.add(p);
            api.hurtPlayer(2, false, -1); api.shake(4, 12, true); api.SFX.boom(); api.fx("spark", p.x, p.y - 50, 10);
          }
          for (const e of api.enemies) {
            if (ev.hit.has(e) || !crossed(e.x, e.y, e.z, true)) continue;
            ev.hit.add(e);
            if (hittable(e)) { api.hitEnemy(e, 2, true, -1); api.fx("spark", e.x, e.y - 50, 8); }
            else if (e.boss && ["walk", "attack", "hurt", "stagger"].includes(e.state) && e.z < 4) { api.hitEnemy(e, 3, true, -1); api.fx("spark", e.x, e.y - 80, 12); api.SFX.boom(); api.enemySay(e, "MY HEAD! OOF!", 60, 90); }
          }
        } else {
          if (!ev.hit.has(p) && canHurt(p) && crossed(p.x, p.y, p.z, false)) { ev.hit.add(p); api.hurtPlayer(1, false, -1); for (let i = 0; i < 8; i++) G.splash.push({ x: p.x - api.camX, y: p.y - 6, vx: api.rnd(-1.6, 0.6), vz: api.rnd(1, 2.6), z: 4, t: 0 }); }
          for (const e of api.enemies) if (!ev.hit.has(e) && hittable(e) && crossed(e.x, e.y, e.z, false)) { ev.hit.add(e); api.hitEnemy(e, 2, true, -1); }
        }
        if (ev.x < -(tunnel ? TUN_LEN + 80 : 120)) { G.ev = null; G.evCd = st.arena ? 520 + (Math.random() * 160 | 0) : 560 + (Math.random() * 200 | 0); }
      }
      G.splash = G.splash.filter((s) => { s.t++; s.x += s.vx; s.z += s.vz; s.vz -= 0.18; return s.z > 0 && s.t < 50; });
      G.ly = p.y; G.lx = p.x;
    },
    drawBack(st, api) { // things in the sky band behind the train: tunnel mountain + water tower
      const ev = g().ev; if (!ev) return;
      const c = api.ctx, x = ev.x;
      if (ev.kind === "tunnel" && pimg()) { // painted mesa cliff, dark bore, painted exit cliff
        box(PF.cliff, x - 236, -18, 238, ROOF_Y + 19);
        api.rect(x, 0, TUN_LEN, ROOF_Y, "#1c120e");
        for (let i = 0; i < TUN_LEN; i += 40) api.rect(x + i + ((i / 40) % 2) * 20, 30 + ((i * 7) % 50), 18, 2, "#2c1e16");
        for (let i = 0; i < TUN_LEN; i += 180) { const lx = x + 90 + i; if (lx > -20 && lx < api.W + 20) { api.rect(lx - 2, 70, 4, 6, "#ffb040"); c.globalAlpha = 0.5; glow(c, lx, 73, 22, "rgba(255,170,60,0.8)"); c.globalAlpha = 1; } }
        box(PF.cliff, x + TUN_LEN - 2, -18, 190, ROOF_Y + 19, true);
      } else if (ev.kind === "tunnel") {
        // rugged mesa cliff rising ahead of the portal (jagged top, strata bands, lit left edge)
        const pts = [[x - 230, ROOF_Y]];
        for (let i = 0; i <= 10; i++) { const u = i / 10, px = x - 230 + u * 230; pts.push([px, ROOF_Y - Math.min(1, u * 1.6) * (ROOF_Y + 4) + (i % 10 ? A.hash(i + 11) * 14 : 0)]); }
        pts.push([x, 0], [x, ROOF_Y]);
        c.fillStyle = "#6a3420"; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill();
        c.save(); c.clip();
        for (let b = 0; b < 8; b++) api.rect(x - 240, 14 + b * 15 + (b % 3) * 2, 240, 3 + (b % 2) * 2, b % 2 ? "#8a4a2c" : "#4e2616");
        for (let i = 0; i < 14; i++) api.rect(x - 220 + A.hash(i + 40) * 210, A.hash(i + 70) * ROOF_Y, 1, 6 + A.hash(i) * 10, "#3a1a0e");
        const sh = c.createLinearGradient(x - 120, 0, x, 0); sh.addColorStop(0, "rgba(20,8,4,0)"); sh.addColorStop(1, "rgba(20,8,4,0.55)"); c.fillStyle = sh; c.fillRect(x - 120, 0, 120, ROOF_Y);
        c.restore();
        c.strokeStyle = "#c87a4a"; c.lineWidth = 1; c.beginPath(); pts.slice(1, 12).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
        api.rect(x, 0, TUN_LEN, ROOF_Y, "#1c120e");
        for (let i = 0; i < TUN_LEN; i += 40) api.rect(x + i + ((i / 40) % 2) * 20, 30 + ((i * 7) % 50), 18, 2, "#2c1e16");
        for (let i = 0; i < TUN_LEN; i += 180) { const lx = x + 90 + i; if (lx > -20 && lx < api.W + 20) { api.rect(lx - 2, 70, 4, 6, "#ffb040"); c.globalAlpha = 0.5; glow(c, lx, 73, 22, "rgba(255,170,60,0.8)"); c.globalAlpha = 1; } }
        c.fillStyle = "#6a3420"; c.fillRect(x + TUN_LEN, 0, 70, ROOF_Y); api.rect(x + TUN_LEN, 0, 8, ROOF_Y, "#8a7a6a"); // exit portal + cliff
      } else {
        const tx = x + 30; if (tx < -90 || tx > api.W + 90) return;
        if (box(PF.tower, tx - 33, ROOF_Y + 1 - 66 * PF.tower[3] / PF.tower[2], 66, 66 * PF.tower[3] / PF.tower[2])) return; // painted water tower
        for (const o of [-26, -8, 8, 26]) api.rect(tx + o - 1, 58, 3, ROOF_Y - 58, "#4a2a18");
        api.rect(tx - 28, 92, 56, 2, "#3a2010"); api.rect(tx - 28, 112, 56, 2, "#3a2010");
        api.rect(tx - 34, 22, 68, 38, "#8a5430"); for (let i = -30; i < 34; i += 6) api.rect(tx + i, 22, 1, 38, "#6a3a20");
        api.rect(tx - 35, 28, 70, 2, "#2a2a30"); api.rect(tx - 35, 50, 70, 2, "#2a2a30");
        c.fillStyle = "#5a3018"; c.beginPath(); c.moveTo(tx - 38, 23); c.lineTo(tx, 6); c.lineTo(tx + 38, 23); c.closePath(); c.fill();
      }
    },
    drawFront(st, api) {
      const G = g(), ev = G.ev, c = api.ctx, top = api.floorTop, bot = api.floorBot + 6;
      for (const s of G.splash) api.rect(s.x, s.y - s.z, 2, 2, "#bfe4ff");
      if (!ev) return;
      const x = ev.x, warn = x > api.W * 0.25 && blink(7);
      if (ev.kind === "tunnel") {
        const tl = x - 330; // telltale ropes hanging over the track: harmless, they brush your head as a last warning
        if (tl > -30 && tl < api.W + 30) { api.rect(tl - 8, 0, 3, top - 70, "#3a2416"); api.rect(tl - 8, 6, 30 + (bot - top) * SLANT, 3, "#3a2416"); for (let i = 0; i < 9; i++) { const rx = tl + i * 2.6 + i * 0.9, sw = Math.sin(api.t * 0.3 + i) * 2; api.rect(rx + sw, 9, 1, top - 60 + i * 4, "#c8b07a"); } }
        // inside the tunnel: darkness over everything, warm lantern pools
        const x0 = Math.max(0, x), x1 = Math.min(api.W, x + TUN_LEN);
        if (x1 > x0) { c.globalAlpha = 0.55; api.rect(x0, 0, x1 - x0, api.H, "#08040a"); c.globalAlpha = 1; api.rect(x0, 0, x1 - x0, top - 52, "#120a08"); }
        // the portal: stone arch face + low lintel beam spanning the depth at head height
        if (x > -40 && x < api.W + 40 && pimg()) { // painted stone pillar + bolted timber lintel along the slant
          box(PF.pillar, x - 13, -4, 20, top - 46);
          along(PF.beam, x - 2, top - 53, x - 2 + (bot - top) * SLANT, bot - 52, 13);
          api.rect(x - 14 + (bot - top) * SLANT, bot - 70, 24, 12, "#e8c040"); api.rect(x - 14 + (bot - top) * SLANT, bot - 70, 24, 1, "#fff0a0"); api.ptext("LOW", x - 2 + (bot - top) * SLANT, bot - 68, 1, "#1a1008");
        } else if (x > -40 && x < api.W + 40) {
          c.fillStyle = "#8a7a6a"; c.fillRect(x - 12, 0, 18, top - 50);
          for (let y = 4; y < top - 54; y += 10) api.rect(x - 12 + ((y / 10) % 2) * 9, y, 1, 10, "#5a5048"), api.rect(x - 12, y, 18, 1, "#5a5048");
          c.fillStyle = "#4a3a2c"; c.beginPath(); c.moveTo(x - 12, top - 58); c.lineTo(x + 8, top - 58); c.lineTo(x + 8 + (bot - top) * SLANT, bot - 58); c.lineTo(x - 12 + (bot - top) * SLANT, bot - 58); c.lineTo(x - 12 + (bot - top) * SLANT, bot - 46); c.lineTo(x - 12, top - 46); c.closePath(); c.fill();
          c.strokeStyle = "#8a6a4a"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 12, top - 58); c.lineTo(x - 12 + (bot - top) * SLANT, bot - 58); c.stroke();
          api.rect(x - 14 + (bot - top) * SLANT, bot - 70, 24, 12, "#e8c040"); api.ptext("LOW", x - 2 + (bot - top) * SLANT, bot - 68, 1, "#1a1008");
        }
        if (x > -20) {
          const dist = laneX(x, api.player.y) - (api.player.x - api.camX);
          if (dist < DUCK_WIN && dist > -4) { if (blink(5)) api.ptext("HIT THE DECK! PRESS DOWN", api.W / 2, 46, 1, "#ffe060"); }
          else if (warn) api.ptext("LOW TUNNEL AHEAD!", api.W / 2, 46, 1, "#ff9a3a");
          if (x > api.W && blink(6)) api.ptext("!", api.W - 14, top - 20, 3, "#ffe060");
        }
      } else {
        const tx = x + 30; // spout swung down across the roof at shin height, water pouring
        if (tx > -60 && tx < api.W + 60) {
          if (pimg()) { // painted spout pipe swung down across the roof (chain from the tank), flared mouth at the near end
            c.strokeStyle = "#2a2018"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx - 22, 60); c.lineTo(laneX(x, top) - 2, top - 14); c.stroke();
            along(PF.pipe, laneX(x, top - 4) - 1, top - 13, laneX(x, bot) + 1, bot - 9, 8);
          } else {
          c.strokeStyle = "#3a2a1c"; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 30, 44); c.lineTo(laneX(x, top) - 2, top - 14); c.stroke();
          c.lineWidth = 8; c.strokeStyle = "#2a1c12"; c.beginPath(); c.moveTo(laneX(x, top - 4), top - 12); c.lineTo(laneX(x, bot), bot - 10); c.stroke();
          c.lineWidth = 6; c.strokeStyle = "#6a4a34"; c.stroke();
          c.lineWidth = 1; c.strokeStyle = "#a07a58"; c.beginPath(); c.moveTo(laneX(x, top - 4) - 2, top - 14); c.lineTo(laneX(x, bot) - 2, bot - 12); c.stroke();
          for (let i = 0; i < 4; i++) { const yy = api.lerp(top, bot, (i + 0.5) / 4); api.rect(laneX(x, yy) - 4, yy - 13, 8, 2, "#2a2a30"); }
          }
          c.globalAlpha = 0.7;
          for (let i = 0; i < 10; i++) { const u = i / 9, yy = api.lerp(top, bot, u), xx = laneX(x, yy) - 3; c.fillStyle = i % 2 ? "rgba(200,235,255,0.8)" : "rgba(120,180,240,0.7)"; c.fillRect(xx - 3 + Math.sin(api.t * 0.6 + i) * 1.5, yy - 9, 4, 9); }
          c.globalAlpha = 1;
        }
        if (x > -20) {
          if (blink(6)) api.ptext("WATER SPOUT! JUMP!", api.W / 2, 46, 1, x < api.W ? "#ffe060" : "#7fd0ff");
          if (x > api.W && blink(6)) api.ptext("!", api.W - 14, top - 4, 3, "#7fd0ff");
        }
      }
    },
  };

  // ================= OUTLAW HATS (cosmetic: cowboy hats on the foot soldiers) =================
  const HEAD = { ninja: { idle: [150, -3], walk: [166, -10], attack: [157, 5], jump: [115, 34], hurt: [145, -37] }, gunner: { idle: [150, 2], walk: [166, 1], attack: [157, -6], jump: [115, 30], hurt: [146, 34] } };
  const HATC = { purple: "#4a2a18", blue: "#2a1e16", sword: "#1a1412", star: "#7a5a32", dasher: "#5a4630", gunner: "#3a2618", heavy: "#24180e" };
  const HATS = { purple: "hat", blue: "hatK", sword: "hatK", star: "hatT", dasher: "hatT", gunner: "hat", heavy: "hatK" }; // painted hat tone per type
  const hats = {
    init: () => ({}),
    drawFront(st, api, cx) {
      for (const e of api.enemies) {
        if (e.boss || !HATC[e.type] || ["down", "dying", "fly"].includes(e.state) || (e.state === "getup" && e.t < 10)) continue;
        const gun = e.type === "gunner" || e.type === "heavy", k = (39 * 1.6 * 0.92 / 150) * (e.type === "heavy" ? 1.18 : 1);
        const fr = e.state === "hurt" ? "hurt" : (e.state === "attack" || e.state === "grab") ? "attack" : e.z > 0 ? "jump" : e.state === "walk" && e.taunt > 0 ? (Math.floor(e.taunt / 10) % 2 ? "walk" : "idle") : e.walkT > 0 && !(Math.floor(e.walkT / 9) % 2) ? "walk" : "idle";
        const [h, hx] = HEAD[gun ? "gunner" : "ninja"][fr], f = e.facing < 0 ? -1 : 1;
        const x = Math.round(e.x - cx + hx * k * f), y = Math.round(e.y - e.z - h * k + 3), col = HATC[e.type];
        if (box(PF[HATS[e.type] || "hat"], x - 9, y - 6.5, 18, 18 * PF.hat[3] / PF.hat[2], f < 0)) continue; // painted cowboy hat
        api.rect(x - 8, y, 16, 2, col); api.rect(x - 9, y - 1, 2, 1, col); api.rect(x + 7, y - 1, 2, 1, col);
        api.rect(x - 4, y - 5, 8, 5, col); api.rect(x - 4, y - 2, 8, 1, "#c8a060"); api.rect(x - 1, y - 5, 2, 1, "rgba(0,0,0,0.35)");
      }
    },
  };

  // ================= THE BOSS: LEATHERHEAD =================
  // sheet frames [x, y, w, h, anchorX] (feet on the bottom edge, faces right): idle, walk, tail, chomp, crate, hurt, fall, lie (KO, head-left), getup
  const GF = { idle: [0, 16, 227, 243, 103], walk: [229, 13, 248, 246, 123], tail: [479, 47, 253, 212, 118], chomp: [734, 38, 216, 221, 108], crate: [952, 0, 210, 259, 113], hurt: [1164, 3, 185, 256, 90], fall: [1355, 74, 287, 185, 168], lie: [1646, 128, 345, 131, 166], getup: [1995, 75, 290, 184, 128] };
  const GK = 0.37, TENDER = { x: 136, y: 152, z: 54 };
  function redSheet(api) { // red-flash copy of the sheet, made with compositing only (no pixel reads, Safari-safe)
    const G = g(); if (G.red) return G.red;
    const im = api.img(GAT); if (!im || !im.width) return null;
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height;
    const x = cv.getContext("2d"); x.drawImage(im, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(255,40,20,0.55)"; x.fillRect(0, 0, cv.width, cv.height);
    return (G.red = cv);
  }
  function drawG(api, fr, sx, sy, facing, opt) {
    opt = opt || {};
    const c = api.ctx, im = opt.red ? redSheet(api) || api.img(GAT) : api.img(GAT), F = GF[fr];
    if (!im) { api.rect(sx - 16, sy - 88, 32, 88, opt.red ? "#a03020" : "#4a6a2a"); return; }
    c.save(); c.translate(Math.round(sx * 3) / 3, Math.round(sy * 3) / 3);
    if (opt.wsy) c.scale(1, opt.wsy);
    if (opt.rot) c.rotate(opt.rot);
    c.scale(facing < 0 ? -1 : 1, opt.sy || 1);
    c.imageSmoothingEnabled = true;
    c.drawImage(im, F[0], F[1], F[2], F[3], -F[4] * GK + (opt.dx || 0), -F[3] * GK + (opt.dy || 0), F[2] * GK, F[3] * GK);
    c.restore();
  }
  function hop(e, tx, ty, n, next) { Object.assign(e, { state: "hop", t: 0, h0: [e.x, e.y, e.z], h1: [tx, ty, 0], hn: n, hnext: next }); A.SFX.jump(); }
  function quake(api, e, p, r, dmg) {
    api.SFX.boom(); api.shake(4, 14, true); api.fx("ring", e.x, e.y, 18); api.dust(e.x - 12, e.y); api.dust(e.x + 12, e.y);
    if (canHurt(p) && p.z < 4 && Math.abs(p.x - e.x) < r && Math.abs(p.y - e.y) < 14) api.hurtPlayer(dmg, false, p.x >= e.x ? 1 : -1);
  }
  function pick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), ay = Math.abs(p.y - e.y), cfg = e.cfg;
    e.t = 0; e.cool = cfg.cool + (Math.random() * 30 | 0); e.facing = dx >= 0 ? 1 : -1; e.state = "attack"; e.hitP = false;
    const opts = [];
    if (ax < 70) opts.push("tail", "tail");
    if (e.wake && ax < 70) opts.push("tail", "tail", "tail");
    e.wake = false;
    if (ax < 110 && ay < 14) opts.push("roll", "roll");
    if (ay < 10 && ax > 50) opts.push("chomp", "chomp");
    opts.push("lift");
    if (ax > 120) opts.push("lift", "chomp");
    if (e.p2 && !(e.sumCd > 0) && api.enemies.length < 3) opts.push("summon");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.65) m = opts[Math.random() * opts.length | 0];
    e.mv = e.lastMove = m;
  }
  function throwThing(api, e, p, kind) { // lobbed crate / boulder aimed at where you stand; a red ring marks the landing spot
    const T = 52, z0 = 64, x0 = e.x + e.facing * 6, y0 = e.y;
    const tx = p.x + api.rnd(-6, 6), ty = Math.max(api.floorTop, Math.min(api.floorBot, p.y + api.rnd(-3, 3)));
    api.shot({ arc: true, x: x0, y: y0, z: z0, vx: (tx - x0) / T, vy: (ty - y0) / T, vz: (0.1 * T * T - z0) / T, kind: "rock", dmg: 2, tx, ty, box: kind === "crate", draw: drawThrown });
  }
  function drawThrown(api, s, sx, sy) {
    const c = api.ctx, tx = s.tx - api.camX, r = 14 - Math.min(10, s.z / 8);
    c.strokeStyle = blink(4) ? "#ff3a2a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(tx, s.ty, r, r * 0.35, 0, 0, 6.29); c.stroke();
    api.shadow(s.x - api.camX, s.y, s.z, 10);
    const x = s.x - api.camX, y = s.y - s.z - 10;
    const rot = api.t * 0.18 * (s.vx < 0 ? -1 : 1);
    if (s.box ? spr(PF.crate, x, y, 21, 21 * PF.crate[3] / PF.crate[2], rot) : spr(PF.rock, x, y, 23, 23 * PF.rock[3] / PF.rock[2], rot)) return; // painted crate / boulder
    c.save(); c.translate(x, y); c.rotate(rot);
    if (s.box) { api.rect(-10, -10, 20, 20, "#8a5a30"); api.rect(-10, -10, 20, 2, "#b07a44"); api.rect(-10, -1, 20, 2, "#5a3a1c"); api.rect(-1, -10, 2, 20, "#5a3a1c"); api.rect(-10, -10, 3, 3, "#8a8a92"); api.rect(7, 7, 3, 3, "#8a8a92"); }
    else { c.fillStyle = "#3a3436"; c.beginPath(); c.arc(0, 0, 10, 0, 6.29); c.fill(); c.fillStyle = "#5a5254"; c.beginPath(); c.arc(-3, -3, 5, 0, 6.29); c.fill(); api.rect(2, 2, 3, 2, "#2a2426"); }
    c.restore();
  }
  const P2 = { speed: 1.25, chargeSpeed: 1.3, cool: 62 };
  // ---- Boss entrance (entr v1): eyes glow in the coal tender, then Leatherhead explodes out of the train car in a hail of coal ----
  const LH_ENTR = {
    len: 170, zoom: 1.3, sub: "THE OUTLAW OF THE RAILS",
    setup(api, e, st) { Object.assign(e, { x: TENDER.x, y: TENDER.y, z: TENDER.z, facing: 1, state: "lurk", t: 30, coal: 0 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 36 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t < 44) { e.state = "lurk"; e.t = 30 + t; e.coal = 0; if (t % 11 === 0) { api.shake(1, 6, false); api.SFX.rumble(); } return; }
      if (t === 44) { e.coal = 1; api.entr.impact(e.x, e.y - e.z, 7, { stop: 6, ring: false });
        const im = pimg(); if (im) api.entr.debris(e.x, e.y, e.z + 4, 12, { img: im, frames: [PF.coal], k: 0.09, spread: 2.6, up: 2.2, w: 22, h: 10 });
        api.entr.debris(e.x, e.y, e.z, 10, { spread: 2.4, up: 2, colors: ["#16151b", "#24232a", "#3a3436", "#ff8c1a"] }); for (let i = 0; i < 6; i++) api.fx("smoke", e.x + api.rnd(-26, 26), e.y - e.z - api.rnd(0, 20), 24); }
      if (t > 44 && t < 62) { e.state = "lurk"; e.t = 100; }
      if (t === 62) api.SFX.jump();
      if (t >= 62 && t <= 98) { const k = (t - 62) / 36; e.x = api.lerp(TENDER.x, cxm, k); e.y = api.lerp(TENDER.y, mid, k); e.z = api.lerp(TENDER.z, 0, k) + Math.sin(k * Math.PI) * 44; e.state = "hop"; e.t = 5; e.facing = 1; }
      if (t === 98) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 6, { spread: 2, colors: ["#8a5a2a", "#5a3a1a", "#16151b"] }); }
      if (t > 98) { e.state = "attack"; e.mv = "chomp"; e.t = t < 128 ? 60 : 41; if (t === 104 || t === 116) api.SFX.clink(); }
    },
    finish(api, e) { e.mv = null; e.coal = 1; },
  };
  const bossCfg = {
    name: "LEATHERHEAD", base: "ramrod", atlas: "ramrod", scale: 1.0, height: 104, hp: 48, speed: 1.0, chargeSpeed: 1.1, cool: 78, pitch: 74,
    moves: ["kick"], hittable: ["attack"],
    lines: {
      intro: "WELL, LOOKY HERE! TURTLE SOUP, COMIN' UP!",
      hit: ["OOH, DAT STING!", "YOU GONNA PAY, SHELLBACK!", "AH'M JUST GETTIN' WARMED UP!", "QUIT TICKLIN' ME!"],
      summon: "BOYS! COME GET DESE TURTLES!",
      ko: "BEAT... BY A BUNCH O' BABY TURTLES...",
    },
    spawn(api, e) { Object.assign(e, { state: "lurk", t: 0, x: TENDER.x, y: TENDER.y, z: TENDER.z, facing: 1, inv: 999, sumCd: 400 }); },
    entrance: LH_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "lurk") { // eyes glowing in the coal heap, then he bursts out
        e.x = TENDER.x; e.y = TENDER.y; e.z = TENDER.z; e.inv = 2;
        if (e.t === 20) api.SFX.rumble();
        if (e.t === 70) { api.shake(3, 20, true); api.SFX.boom(); for (let i = 0; i < 8; i++) api.fx("smoke", e.x + api.rnd(-26, 26), e.y - e.z - api.rnd(0, 20), 24); e.coal = 1; }
        if (e.t === 74) api.enemySay(e, bossCfg.lines.intro, 100, 74, true);
        if (e.t === 180) api.enemySay(e, "DAT RIFT DUMPED ME IN 1880. NOW I RUN DIS TRAIN!", 110, 74, true);
        if (e.t >= 300) { e.inv = 0; hop(e, 172, 182, 34, "walk"); }
        return true;
      }
      if (e.state === "hop") {
        const k = Math.min(1, e.t / e.hn), [x0, y0, z0] = e.h0, [x1, y1] = e.h1;
        e.x = api.lerp(x0, x1, k); e.y = api.lerp(y0, y1, k); e.z = api.lerp(z0, 0, k) + Math.sin(k * Math.PI) * 40; e.inv = 2;
        if (Math.abs(x1 - x0) > 2) e.facing = x1 > x0 ? 1 : -1;
        if (k >= 1) { e.z = 0; quake(api, e, p, 50, 2); e.state = e.hnext; e.t = 0; e.cool = 50; e.inv = 0; }
        return true;
      }
      if (e.state === "roar") { // phase 2: SWAMP STRENGTH (invulnerable while he roars)
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t === 1) { api.enemySay(e, "NOW YOU SEE SWAMP STRENGTH!", 110, 66, true); api.SFX.rumble(); }
        if (e.t % 8 === 0) { api.shake(2, 8, true); api.dust(e.x + api.rnd(-20, 20), e.y); }
        if (e.t === 70) { leapIn(api, "purple", api.camX + 30, 60); leapIn(api, "star", api.camX + 60, 70); }
        if (e.t >= 130) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2); e.state = "walk"; e.t = 0; e.cool = 30; e.inv = 0; g().evCd = 200; api.playerBark(true, "HE'S EVEN STRONGER NOW! WATCH THE TUNNELS!"); }
        return true;
      }
      if (e.state === "walk" && e.seen && e.life - e.seen > 12 && Math.random() < 0.7) { e.cool = 1; e.wake = true; } // wake-up retaliation after a knockdown / stagger
      e.seen = e.life;
      if (e.state === "walk" && !e.p2 && !e.roared && e.hp <= e.maxHp * 0.5) { e.roared = true; e.state = "roar"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { pick(api, e, p); return true; }
      if (e.sumCd > 0) e.sumCd--;
      if (e.state === "grab") return deathRoll(api, e, p);
      if (e.state !== "attack" || !e.mv) return false; // walk / hurt / stagger / down / getup / dying: engine
      const t = e.t, dir = e.facing;
      if (e.mv === "tail") { // wind up (tail rises, red flash), then a low 360 sweep: JUMP it
        if (t === 1) api.SFX.charge();
        if (t === 44) { api.SFX.swing(); api.SFX.rumble(); }
        if (t >= 44 && t <= 54) {
          if (!e.hitP && canHurt(p) && p.z < 9 && Math.abs(p.x - e.x) < 66 && Math.abs(p.y - e.y) < 16) { e.hitP = true; api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1); }
          for (const o of api.enemies) if (hittable(o) && Math.abs(o.x - e.x) < 66 && Math.abs(o.y - e.y) < 16 && !(o.tailHit === e.life - t)) { o.tailHit = e.life - t; api.hitEnemy(o, 2, true, o.x >= e.x ? 1 : -1); }
          if (t % 3 === 0) api.dust(e.x + api.rnd(-50, 50), e.y + api.rnd(-6, 6));
        }
        if (t >= 84) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.mv === "roll") { // crouch + red flash, lunge along your row; on contact: DEATH ROLL (mash attack!)
        if (t === 1) api.SFX.charge();
        if (t > 36 && t <= 60) {
          e.x += dir * 4.4; e.x = Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, e.x));
          if (t % 4 === 0) api.dust(e.x - dir * 14, e.y);
          if (canHurt(p) && p.z < 16 && Math.abs(p.x - (e.x + dir * 18)) < 18 && Math.abs(p.y - e.y) < 10) {
            Object.assign(e, { state: "grab", t: 0, rollA: 0 }); Object.assign(p, { grabbedBy: e, mash: 0, drainT: 0, attackT: 0, atk: null, walkT: 0 });
            api.SFX.hit(); api.shake(3, 10, true); api.playerBark(true, "HE'S GOT ME! DEATH ROLL!"); return true;
          }
        }
        if (t >= 86) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.mv === "chomp") { // jaws open, red flash, then a chomping charge across the row
        if (t === 1) { api.SFX.charge(); api.enemySay(e, "CHOMP CHOMP!", 50, 80); }
        if (t > 40 && t <= 100) {
          e.x += dir * e.cfg.chargeSpeed * 4.2; e.walkT++;
          if (t % 6 === 0) { api.SFX.munch ? api.SFX.munch() : api.SFX.hit(); api.dust(e.x - dir * 16, e.y); }
          if (!e.hitP && canHurt(p) && p.z < 20 && Math.abs(p.x - (e.x + dir * 16)) < 20 && Math.abs(p.y - e.y) < 12) { e.hitP = true; api.hurtPlayer(2, false, dir); }
          for (const o of api.enemies) if (hittable(o) && Math.abs(o.x - (e.x + dir * 16)) < 20 && Math.abs(o.y - e.y) < 12) api.hitEnemy(o, 2, true, dir);
          const edge = dir > 0 ? e.x > api.camX + api.W - 26 : e.x < api.camX + 26;
          if (edge) { e.x = Math.max(api.camX + 26, Math.min(api.camX + api.W - 26, e.x)); api.SFX.boom(); api.shake(4, 12, true); api.fx("spark", e.x + dir * 20, e.y - 50, 12); e.state = "stagger"; e.t = 0; e.vx = 0; e.mv = null; return true; }
        }
        if (t > 100) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.mv === "lift") { // rips up a crate (or a coal boulder in phase 2) and hurls it; phase 2 throws two
        if (t === 1) { api.SFX.rumble(); e.boulder = e.p2 && Math.random() < 0.6; }
        if (t === 40) { e.facing = p.x >= e.x ? 1 : -1; throwThing(api, e, p, e.boulder ? "rock" : "crate"); api.SFX.swing(); }
        if (e.p2 && t === 58) api.SFX.rumble();
        if (e.p2 && t === 88) { e.facing = p.x >= e.x ? 1 : -1; throwThing(api, e, p, "rock"); api.SFX.swing(); }
        if (t >= (e.p2 ? 110 : 62)) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      if (e.mv === "summon") {
        if (t === 10) { api.enemySay(e, bossCfg.lines.summon, 80, 74); leapIn(api, "blue", api.camX + 24, 64); leapIn(api, "dasher", api.camX + api.W - 24, 64); e.sumCd = 900; }
        if (t >= 40) { e.state = "walk"; e.t = 0; e.mv = null; }
        return true;
      }
      e.state = "walk"; e.mv = null; return false;
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, f = e.facing;
      if (s === "lurk") { // glowing eyes in the coal, then coal chunks fly as he bursts out
        if (!e.coal) { if (t > 20 && blink(30) || t % 60 < 40) { api.rect(sx - 8, sy - 6, 3, 2, "#ffe040"); api.rect(sx + 2, sy - 6, 3, 2, "#ffe040"); } return; }
        drawG(api, "hurt", sx, sy + 18, 1); // emerging from the heap
        if (box(PF.coal, sx - 50, sy + 27 - 100 * PF.coal[3] / PF.coal[2], 100, 100 * PF.coal[3] / PF.coal[2])) return; // painted coal heap
        const c = api.ctx; c.fillStyle = "#141318"; c.beginPath(); c.ellipse(sx, sy + 16, 44, 12, 0, 0, 6.29); c.fill();
        for (let i = 0; i < 18; i++) { const a = api.hash(i + 3), b2 = api.hash(i + 31), x = sx - 38 + b2 * 76, y = sy + 4 + a * 12; c.fillStyle = i % 3 ? "#24232a" : "#16151b"; c.beginPath(); c.arc(x, y, 2 + a * 4, 0, 6.29); c.fill(); api.rect(x - 1, y - 2, 2, 1, "#55555f"); }
        return;
      }
      api.contactShadow(sx, e.y, e.z, 30);
      if (s === "grab") { // death roll: rolls over and over with you in his jaws
        const a = e.rollA || 0;
        const k = Math.cos(a), w = Math.abs(k) < 0.08 ? 0.08 * Math.sign(k || 1) : k;
        drawG(api, k < 0 ? "hurt" : "chomp", sx, sy - 22, f, { wsy: w, rot: f * Math.PI / 2, dy: 44 });
        return;
      }
      if (s === "down" || s === "dying") { const fl = t < 10; drawG(api, fl ? "fall" : "lie", sx, sy - (fl ? Math.sin((t / 10) * Math.PI) * 6 : 0), f); return; } // knocked off his feet, then flat out
      let fr = "idle", red = false, ff = f, jx = 0, sc = 1;
      if (s === "getup") fr = t < 12 ? "getup" : "idle";
      else if (s === "hurt" || s === "stagger") { fr = "hurt"; jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : 0; }
      else if (s === "hop") fr = "chomp";
      else if (s === "roar") { fr = "hurt"; jx = t % 4 < 2 ? 1 : -1; }
      else if (s === "attack") {
        const m = e.mv;
        if (m === "tail") { if (t < 44) { fr = "idle"; red = t % 6 < 3; jx = t % 4 < 2 ? 1 : -1; } else if (t <= 54) { fr = "tail"; ff = Math.floor((t - 44) / 3) % 2 ? f : -f; } else fr = "tail"; }
        else if (m === "roll") { fr = "chomp"; red = t <= 36 && t % 6 < 3; jx = t <= 36 ? -f : 0; }
        else if (m === "chomp") { fr = t > 40 && Math.floor(t / 5) % 2 ? "walk" : "chomp"; red = t <= 40 && t % 6 < 3; }
        else if (m === "lift") { fr = (t < 40 || (e.p2 && t >= 58 && t < 88)) ? "crate" : "idle"; red = t < 12 && t % 6 < 3; }
        else if (m === "summon") fr = "chomp";
      } else if (e.walkT > 0) fr = Math.floor(e.walkT / 10) % 2 ? "walk" : "idle";
      if (e.p2 && s !== "dying" && e.life % 50 < 4) red = true;
      drawG(api, fr, sx + jx, sy, ff, { red });
      if (s === "attack" && e.mv === "lift" && e.boulder && fr === "crate" && spr(PF.rock, sx + f * 2, sy - 86, 38, 38 * PF.rock[3] / PF.rock[2])) { /* painted boulder held overhead */ }
      else if (s === "attack" && e.mv === "lift" && e.boulder && fr === "crate") { const c = api.ctx; c.fillStyle = "#3a3436"; c.beginPath(); c.arc(sx + f * 4, sy - 84, 17, 0, 6.29); c.fill(); c.fillStyle = "#58504f"; c.beginPath(); c.arc(sx + f * 0 - 4, sy - 90, 8, 0, 6.29); c.fill(); }
      if (s === "attack" && e.mv === "tail" && t < 44) { // danger zone on the floor
        const c = api.ctx; c.strokeStyle = t % 6 < 3 ? "rgba(255,60,40,0.9)" : "rgba(255,220,80,0.7)"; c.setLineDash([3, 3]); c.lineWidth = 1; c.beginPath(); c.ellipse(sx, e.y, 66, 16, 0, 0, 6.29); c.stroke(); c.setLineDash([]);
        if (blink(6)) api.ptext("!", sx, sy - 106, 2, "#ffe060");
      }
      if (s === "attack" && e.mv === "tail" && t >= 44 && t <= 56) { const c = api.ctx; c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, e.y - 6, 60, 13, 0, (t - 44) * 0.6, (t - 44) * 0.6 + 2.6); c.stroke(); }
      if (s === "attack" && (e.mv === "roll" || e.mv === "chomp") && t < 40 && blink(6)) api.ptext("!", sx + f * 10, sy - 100, 2, "#ffe060");
    },
    onDefeat() { const G = g(); G.ev = null; },
  };
  function deathRoll(api, e, p) {
    const t = e.t;
    if (p.grabbedBy !== e) { e.state = "walk"; e.t = 0; e.mv = null; e.cool = 50; return true; } // escaped or released
    e.rollA = (e.rollA || 0) + 0.32; e.inv = 0;
    p.x = e.x + e.facing * 22; p.y = e.y + 1; p.z = 3 + Math.abs(Math.sin(e.rollA)) * 6; p.vz = 0; p.facing = -e.facing;
    if (t % 10 === 0) { api.dust(e.x + api.rnd(-16, 16), e.y); api.SFX.swing(); }
    if (t >= 130) { // tossed aside
      p.grabbedBy = null; p.z = 0.1; api.hurtPlayer(2, true, e.facing); api.SFX.boom(); api.shake(3, 10, true);
      e.state = "walk"; e.t = 0; e.mv = null; e.cool = 70;
    }
    return true;
  }

  // ================= OUTRO: the rift opens over the tracks and slingshots the train to 2105 =================
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine doesn't tick effects during an outro
      g().trav += TS * (1 + t / 120);
      if (t === 1) { g().ev = null; st.r = 0; }
      if (t === 30) api.playerBark(true, "WHAT'S THAT GLOW UP AHEAD?!");
      if (t === 60) { api.SFX.rumble(); api.shake(2, 40, true); }
      if (t > 60) st.r = Math.min(150, st.r + 1.1);
      if (t === 140) api.playerBark(true, "THE TIME RIFT! IT'S PULLING US IN!");
      if (t === 250) { api.playerBark(true, "HANG ON TO YOUR SHELLS!"); api.SFX.charge(); }
      if (t > 250) { p.x += 0.6 + (t - 250) * 0.03; p.facing = 1; p.walkT++; }
      if (t === 330) { api.SFX.boom(); api.SFX.zap(); api.shake(5, 30, true); }
      return t > 470;
    },
    draw(api, st, t) {
      const c = api.ctx, W = api.W, H = api.H, cx = W - 40, cy = 110, r = st.r || 0;
      if (r > 0) { // swirling vortex
        c.save(); c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.5; glow(c, cx, cy, r * 1.4, "rgba(150,90,255,0.9)");
        c.globalCompositeOperation = "source-over"; c.globalAlpha = 0.95; glow(c, cx, cy, r * 0.7, "rgba(16,0,40,1)"); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5;
        for (let i = 0; i < 7; i++) { const rr = r * (1 - i / 8), a = t * 0.08 * (i % 2 ? 1 : -1) + i; c.strokeStyle = i % 2 ? "rgba(120,230,255,0.8)" : "rgba(255,120,240,0.8)"; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, rr, rr * 0.9, a, 0.3, 4.8); c.stroke(); }
        c.restore();
      }
      if (t > 200) { c.globalAlpha = Math.min(0.6, (t - 200) / 200); for (let i = 0; i < 24; i++) { const y = (api.hash(i) * H) | 0, x = W - ((t * (10 + api.hash(i + 3) * 12) + api.hash(i + 9) * W) % (W + 60)); api.rect(x, y, 26 + (i % 4) * 10, 1, i % 2 ? "#bfefff" : "#ffd0ff"); } c.globalAlpha = 1; }
      if (t > 320) { c.globalAlpha = Math.min(1, (t - 320) / 30); api.rect(0, 0, W, H, "#f4f0ff"); c.globalAlpha = 1; }
      if (t > 360) {
        const a = Math.min(1, (t - 360) / 20); c.globalAlpha = a;
        api.ptext("SLINGSHOT THROUGH TIME...", W / 2, 84, 2, "#5a3aa0");
        api.ptext("NEXT STOP: NEW YORK CITY, 2105", W / 2, 112, 1, "#2a1a50");
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 11,
    name: "WILD WEST TRAIN",
    card: { title: "WILD WEST TRAIN", tagline: "1880. THE OUTLAWS RIDE THE RAILS.", color: "#ff8c1a" },
    music, bossMusic,
    // painted regular enemies (swamp family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_swamp.webp", ENEMY_F = { light: {"idle":[4,17,130,151,60],"walk":[138,0,105,168,44],"walk2":[247,0,111,168,50],"attack":[362,23,180,145,77],"jump":[546,2,149,166,70],"hurt":[699,2,94,166,49],"down":[797,118,191,50,95],"dash":[992,89,180,79,106]}, weapon: {"idle":[4,172,88,170,36],"walk":[96,173,101,169,46],"walk2":[201,175,103,167,48],"attack":[308,177,96,165,51],"jump":[408,184,92,158,43],"hurt":[504,180,112,162,49],"down":[620,290,184,52,92],"throw":[808,177,144,165,61]}, big: {"idle":[4,347,116,168,50],"walk":[124,346,115,169,54],"walk2":[243,348,120,167,57],"attack":[367,348,140,167,55],"jump":[511,350,111,165,48],"hurt":[626,350,109,165,53],"down":[739,458,190,57,95],"shoot":[933,347,118,168,44]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 10, blue: 200, sword: 330, star: 40, dasher: 90, gunner: 20, heavy: 0 },
    images: [DES, GAT, PR_IMG],
    sections: [
      { bg: BG1, floor: [147, 186], length: 2600, locks: [0, 640, 1300, 1980],
        waves: [["purple", "purple", "blue"], ["star", "purple", "heavy", "blue"], ["dasher", "sword", "purple", "star", "gunner"], ["heavy", "gunner", "dasher", "purple", "sword"]],
        weather: "speed", hazards: [scenery, gaps, outlawCar, events, hats],
        sky: "#d8784a", ground: "#5a2e1e" },
      { bg: BG2, floor: [152, 198], length: 384, locks: [], waves: [], arena: true, weather: "speed",
        hazards: [arenaFx, events, hats], sky: "#c05a3a", ground: "#4a3424" },
    ],
    restructure: { // phase 2: boxcar roofs (zone 1) -> handcar pursuit (twist) -> saloon car (zone 2) -> existing flatcar arena
      split: 0, images: ["levels/level11_handcar.webp", "levels/level11_saloon.jpg", "levels/level11_desert.jpg"],
      tsec: { bg: "levels/level11_desert.jpg", auto: 3, hazards: [] },
      twist: { kind: "ride", goal: "car", title: "HANDCAR PURSUIT!", sub: "HIT THE OUTLAW CAR'S SHIELD 3 TIMES - TWICE", img: "levels/level11_handcar.webp", fr: {"handcarA": [0, 0, 460, 133], "track": [0, 136, 460, 91], "handcarB": [0, 230, 460, 130], "outlawCar": [0, 363, 460, 172]},
        car: "outlawCar", cartA: "handcarA", cartB: "handcarB", track: "track", drip: ["purple", "star", "dasher"], color: "#ffb04a" },
      z2bg: "levels/level11_saloon.jpg", z2: { hazards: [hats], weather: null },
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); if (window.__SS) window.__L11 = { g, startEvent: (k) => startEvent(A, k) }; }, // debug-only handle
    onUnload() { try { delete window.__L11; } catch (_) { window.__L11 = undefined; } if (G && G.red) { G.red.width = G.red.height = 0; } G = null; scenery.init = arenaFx.init = gaps.init = outlawCar.init = events.init = hats.init = null; },
  });
})();
