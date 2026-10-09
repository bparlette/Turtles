// Level 10: PIRATE SHIP. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Act III (time travel): the temporal rift drops the brothers onto a 17th-century galleon in a boarding battle.
// Section 1: the main deck at dusk. The deck pitches on a cycle (telegraphed "BRACE!" banner, the whole view rolls and
// everyone slides downhill, barrels break loose and roll down a lane), a rival galleon fires broadsides that land in
// marked splash zones, and pirates swing in on ropes from the rigging.
// Section 2: the storm-lashed quarterdeck. Boss ARMAGGON, the cyber-shark mutant: bite lunge, fin-dive under the deck
// and burst up through the planks, harpoon cannon, phase-2 laser sweep and pirate boarders. Outro: the rift tears
// open again and shows a steam train crossing a desert: next stop, the Wild West.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level10_galleon.jpg", BG2 = "levels/level10_galleon_boss.jpg", SHARK = "levels/level10_armaggon.webp";
  // Painted stage props (levels/level10_props.webp, keyed from chroma-green comic-ink renders): barrel, cannonball, shell
  // scar, Armaggon's dorsal fin + harpoon, the outro locomotive; levels/level10_rift.jpg = the desert seen through the rift.
  // Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level10_props.webp", RIFT_IMG = "levels/level10_rift.jpg";
  const PF = { train: [0, 0, 260, 69], scar: [263, 0, 120, 55], fin: [386, 0, 110, 106], harp: [0, 109, 84, 14], barrel: [87, 109, 64, 65], ball: [154, 109, 24, 24] };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function spr(f, x, y, w, h, rot, flip) { // draw a sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null;          // per-section run state (reset on section entry, cleared on unload)
  let CACHE = {};        // offscreen canvases (exposed bg copies, tinted boss sheets); released in onUnload
  const fresh = (boss) => ({ boss, roll: { ang: 0, ph: "calm", t: 0, dir: 1, cd: boss ? 300 : 360 }, zones: [], scars: [], barrels: [], parts: [], ropes: [],
    canCd: boss ? 360 : 240, ropeCd: 90, flash: 0, intro: 0 });

  // ---- Music: an original arrangement of the public-domain shanty "Drunken Sailor" (D minor, 150 BPM) ----
  const CH = ["Dm", "Dm", "C", "C", "Dm", "Dm", "C", "Dm", "F", "C", "Dm", "Am", "F", "C", "E", "Dm"];
  const V1 = "A5:2 A5:1 A5:1 A5:2 A5:1 A5:1 A5:2 D5:2 F5:2 A5:2", V2 = "G5:2 G5:1 G5:1 G5:2 G5:1 G5:1 G5:2 C5:2 E5:2 G5:2";
  const music = A.track({ bpm: 150, loop: true, chords: CH,
    lead: [V1, V1, V2, V2, V1, V1, "A5:2 B5:2 C6:2 D6:2 C6:2 A5:2 G5:2 E5:2", "D5:4 .:2 D5:2 D5:4 .:4",
      "F5:2 A5:2 C6:4 A5:2 F5:2 C5:4", "E5:2 G5:2 C6:4 G5:2 E5:2 C5:4", "D5:2 F5:2 A5:4 D6:4 C6:2 A5:2", "C6:4 B5:2 A5:2 E5:4 .:4",
      "A5:2 C6:2 F6:4 E6:2 D6:2 C6:4", "G5:2 C6:2 E6:4 D6:2 C6:2 G5:4", "G#5:4 B5:4 E6:4 D6:4", "D6:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 7, 0, 12, 0, 7, 0]),
    arp: A.arpLine(CH, 12, [0, 2, 1, 2]),
    drums: A.rep("k..hs..hk.khs.h.", 15).concat(["k.s.s.sss.sssso."]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 178);

  // ---- helpers ----
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const blink = (t, n) => Math.floor(t / (n || 6)) % 2 === 1;
  function exposedBg(path) { // same look as the engine's BG_EXPOSE pass (falls back to the raw image without canvas filters)
    const im = A.img(path); if (!im || !im.naturalWidth) return im;
    if (CACHE[path]) return CACHE[path];
    try {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d"); g.filter = "brightness(1.3) contrast(1.05)"; g.drawImage(im, 0, 0); g.filter = "none";
      CACHE[path] = c; return c;
    } catch (_) { return im; }
  }
  function splash(x, y, n, col) { for (let i = 0; i < n; i++) G.parts.push({ x: x + A.rnd(-8, 8), y, z: A.rnd(0, 6), vx: A.rnd(-1.6, 1.6), vz: A.rnd(1.5, 4.2), t: 0, life: 40 + (Math.random() * 20 | 0), c: col || (i % 3 ? "#bfeaff" : "#ffffff") }); }
  function splinters(x, y, n) { splash(x, y, n, "#8a5a2a"); for (let i = 0; i < n / 2; i++) G.parts.push({ x, y, z: 2, vx: A.rnd(-2, 2), vz: A.rnd(2, 5), t: 0, life: 50, c: "#d8a060" }); }

  // ================= THE SHIP: rolling deck, cannon splash zones, loose barrels, rope boarders =================
  const ROLL_MAX = 0.062, R_WARN = 72, R_RAMP = 34, R_HOLD = 150;
  function updateRoll(api, p, calm) {
    const R = G.roll; R.t++;
    if (R.ph === "calm") { if (!calm && --R.cd <= 0) { R.ph = "warn"; R.t = 0; R.dir = -R.dir; api.SFX.rumble(); } }
    else if (R.ph === "warn") { if (R.t % 24 === 0) api.SFX.rumble(); if (R.t >= R_WARN) { R.ph = "tilt"; R.t = 0; api.shake(2, 10, true); queueBarrels(api); } }
    else if (R.ph === "tilt" && R.t >= R_RAMP * 2 + R_HOLD) { R.ph = "calm"; R.t = 0; R.cd = G.boss ? 460 + (Math.random() * 120 | 0) : 380 + (Math.random() * 120 | 0); }
    let target = 0;
    if (R.ph === "tilt") target = R.dir * ROLL_MAX * (R.t < R_RAMP ? R.t / R_RAMP : R.t < R_RAMP + R_HOLD ? 1 : 1 - (R.t - R_RAMP - R_HOLD) / R_RAMP);
    else if (R.ph === "warn") target = -R.dir * 0.012 * Math.min(1, R.t / 30); // the ship heels back before the big roll
    R.ang = target + 0.011 * Math.sin(api.t * 0.025);
    // downhill slide for everyone standing on the deck
    const v = Math.abs(target) > 0.02 ? 0.62 * target / ROLL_MAX : 0;
    if (!v || calm) return;
    const L = api.camX + 10, Rr = api.camX + api.W - 10;
    if (p.deadT === 0 && p.z === 0 && !p.grabbedBy && !(p.sinkT > 0)) { p.x = Math.max(L, Math.min(Rr, p.x + v)); if (api.t % 9 === 0) api.dust(p.x - Math.sign(v) * 5, p.y); }
    for (const e of api.enemies) {
      if (e.z > 0 || !["walk", "attack", "hurt", "down", "getup"].includes(e.state) || !e.entered) continue;
      const k = e.boss ? (e.state === "walk" ? 0.35 : 0) : 0.85; if (!k) continue;
      e.x = Math.max(L, Math.min(Rr, e.x + v * k));
    }
  }
  function queueBarrels(api) {
    const n = G.boss ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0), used = [];
    for (let i = 0; i < n; i++) {
      let y; do { y = api.rnd(api.floorTop + 6, api.floorBot - 4); } while (used.some((u) => Math.abs(u - y) < 16));
      used.push(y); G.barrels.push({ y, dir: G.roll.dir, x: 0, t: -i * 40, rot: 0, hit: new Set() });
    }
  }
  const BW = 50; // barrel lane warning (frames)
  function updateBarrels(api, p) {
    G.barrels = G.barrels.filter((b) => {
      b.t++;
      if (b.t < 0) return true;
      if (b.t === 1) { b.x = b.dir > 0 ? api.camX - 18 : api.camX + api.W + 18; api.SFX.rumble(); }
      if (b.t < BW) return true;
      b.x += b.dir * 3.3; b.rot += b.dir * 0.28;
      if (b.t % 14 === 0) api.dust(b.x, b.y);
      if (canHurt(p) && !b.hit.has(p) && p.downT === 0 && Math.abs(b.x - p.x) < 10 && Math.abs(b.y - p.y) < 7 && p.z < 11) { b.hit.add(p); api.hurtPlayer(1, false, b.dir); api.SFX.hit(); }
      for (const e of api.enemies) if (hittable(e) && !b.hit.has(e) && Math.abs(b.x - e.x) < 10 && Math.abs(b.y - e.y) < 7) { b.hit.add(e); api.hitEnemy(e, 2, true, b.dir); }
      return b.dir > 0 ? b.x < api.camX + api.W + 30 : b.x > api.camX - 30;
    });
  }
  // cannon volleys from the rival galleon: marked splash zones, then the ball lands
  const Z_WARN = 76, ZRX = 24, ZRY = 8;
  function volley(api, p, n) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      let x, y, k = 0;
      do {
        x = i === 0 ? p.x + api.rnd(-14, 14) : api.camX + api.rnd(40, api.W - 40);
        y = i === 0 ? p.y + api.rnd(-4, 4) : api.rnd(api.floorTop + 8, api.floorBot - 6);
      } while (++k < 20 && xs.some((q) => Math.abs(q[0] - x) < 54 && Math.abs(q[1] - y) < 20));
      x = Math.max(api.camX + 26, Math.min(api.camX + api.W - 26, x)); y = Math.max(api.floorTop + 6, Math.min(api.floorBot - 4, y));
      xs.push([x, y]); G.zones.push({ x, y, t: -i * 14, fx: api.camX + api.rnd(30, api.W - 30) });
    }
    api.SFX.gun();
  }
  function updateZones(api, p) {
    G.zones = G.zones.filter((z) => {
      z.t++;
      if (z.t === 1) api.SFX.charge();
      if (z.t < Z_WARN) return true;
      api.SFX.boom(); api.shake(3, 12, true); api.fx("boom", z.x, z.y - 6, 26); splash(z.x, z.y, 14); splinters(z.x, z.y, 8);
      G.scars.push({ x: z.x, y: z.y, t: 0 });
      const inZ = (x, y) => ((x - z.x) / ZRX) ** 2 + ((y - z.y) / ZRY) ** 2 < 1;
      if (canHurt(p) && p.z < 22 && inZ(p.x, p.y)) api.hurtPlayer(2, false, p.x < z.x ? -1 : 1);
      for (const e of api.enemies) if (hittable(e) && inZ(e.x, e.y)) api.hitEnemy(e, 2, true, e.x < z.x ? -1 : 1);
      return false;
    });
    G.scars = G.scars.filter((s) => ++s.t < 260);
  }
  // pirates swing in on ropes from the rigging and tumble onto the deck
  function board(api, type, side) {
    const e = api.spawnEnemy(type) || api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return null;
    const ax = side < 0 ? api.camX + api.rnd(10, 60) : api.camX + api.W - api.rnd(10, 60);
    Object.assign(e, { x: side < 0 ? api.camX - 6 : api.camX + api.W + 6, y: api.rnd(api.floorTop + 10, api.floorBot - 6), z: 58, vz: 0.6, vx: -side * 1.7,
      state: "down", t: 0, bounced: false, bowl: false, facing: -side, entered: true });
    G.ropes.push({ e, ax, ay: -10, t: 0 });
    if (Math.random() < 0.6) api.enemySay(e, ["AVAST!", "BOARD 'EM!", "YO HO HO!", "ARRR!"][Math.random() * 4 | 0], 50, 260);
    api.SFX.swing();
    return e;
  }
  function updateRopes(api, p) {
    const S = api.STATE;
    if (!G.boss && S.locked && S.queue.length && api.enemies.length < 5 && --G.ropeCd <= 0) { board(api, S.queue.shift(), Math.random() < 0.5 ? -1 : 1); G.ropeCd = 150 + (Math.random() * 80 | 0); }
    G.ropes = G.ropes.filter((r) => ++r.t < 60 && api.enemies.includes(r.e) && (r.e.z > 1 || r.t < 8));
  }
  function updateParts() { G.parts = G.parts.filter((q) => { q.t++; q.x += q.vx; q.z += q.vz; q.vz -= 0.25; if (q.z < 0) { q.z = 0; q.vx *= 0.5; q.vz = 0; } return q.t < q.life; }); }

  const ship = (bossSec) => ({
    init(api) { G = fresh(bossSec); return {}; },
    update(st, api, p) {
      if (!G) return;
      const S = api.STATE, b = api.enemies.find((e) => e.boss), fight = bossSec ? b && b.go && b.state !== "dying" : true;
      updateRoll(api, p, !fight || S.outro);
      updateBarrels(api, p); updateZones(api, p); updateRopes(api, p); updateParts();
      if (fight && !S.outro && --G.canCd <= 0) {
        if (bossSec) { G.canCd = b && b.p2 ? 330 : 470; if (!(b && ["dive", "rise", "rage"].includes(b.state))) volley(api, p, b && b.p2 ? 3 : 2); }
        else { G.canCd = 280 + (Math.random() * 90 | 0); if (S.locked || api.enemies.length) volley(api, p, S.wave >= 3 ? 3 : 2); else G.canCd = 60; }
      }
      if (bossSec && api.t % 200 === 0 && Math.random() < 0.6) G.flash = 8; // lightning
      if (G.flash > 0) G.flash--;
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const s of G.scars) { // scorched, splintered planks where a ball landed
        const x = s.x - cx, a = s.t < 200 ? 1 : (260 - s.t) / 60;
        if (ready(api.img(PR_IMG))) { c.globalAlpha = a; spr(PF.scar, x, s.y, 36, 13, 0, (s.x | 0) % 2); c.globalAlpha = 1; continue; } // painted splintered hole
        c.globalAlpha = 0.55 * a; c.fillStyle = "#1a0e06"; c.beginPath(); c.ellipse(x, s.y, 16, 5, 0, 0, 6.29); c.fill();
        c.globalAlpha = 0.8 * a; for (let i = -12; i <= 12; i += 5) api.rect(x + i, s.y - 1 + (i % 3), 3, 1, "#e0a060"); c.globalAlpha = 1;
      }
      for (const z of G.zones) { // splash-zone telegraph: dashed red ring, filling disc, the ball's shadow closing in
        if (z.t < 0) continue;
        const x = z.x - cx, k = z.t / Z_WARN;
        c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.fillStyle = "#ff3a2a"; c.beginPath(); c.ellipse(x, z.y, ZRX * k, ZRY * k, 0, 0, 6.29); c.fill();
        c.globalAlpha = 1; c.strokeStyle = blink(z.t, 5) ? "#ffe060" : "#ff3a2a"; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.lineDashOffset = -z.t * 0.5;
        c.beginPath(); c.ellipse(x, z.y, ZRX, ZRY, 0, 0, 6.29); c.stroke(); c.setLineDash([]);
        c.globalAlpha = 0.5; c.fillStyle = "#000"; const r = 3 + 6 * k; c.beginPath(); c.ellipse(x, z.y, r, r * 0.35, 0, 0, 6.29); c.fill(); c.restore();
      }
      for (const b of G.barrels) { // lane warning at the uphill edge
        if (b.t < 0 || b.t >= BW) continue;
        const ex = b.dir > 0 ? 10 : api.W - 10;
        c.save(); c.globalAlpha = 0.4; c.strokeStyle = "#ffb21a"; c.setLineDash([3, 4]); c.lineDashOffset = -b.dir * b.t; c.beginPath(); c.moveTo(0, b.y); c.lineTo(api.W, b.y); c.stroke(); c.restore();
        if (blink(b.t, 5)) { api.ptext("!", ex, b.y - 22, 2, "#ffe060"); api.ptext(b.dir > 0 ? ">>" : "<<", ex + b.dir * 14, b.y - 8, 1, "#ffb21a"); }
      }
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const b of G.barrels) { // rolling barrel
        if (b.t < BW) continue;
        const x = b.x - cx, y = b.y - 8; if (x < -20 || x > api.W + 20) continue;
        api.contactShadow(x, b.y, 0, 9);
        if (spr(PF.barrel, x, y, 18.5, 18.5 * PF.barrel[3] / PF.barrel[2], b.rot)) continue; // painted barrel, rolling end-on
        c.save(); c.translate(x, y); c.rotate(b.rot);
        c.fillStyle = "#4a4a54"; c.beginPath(); c.arc(0, 0, 9, 0, 6.29); c.fill(); // iron hoop rim
        c.fillStyle = "#9a6430"; c.beginPath(); c.arc(0, 0, 7.4, 0, 6.29); c.fill(); // lid
        c.strokeStyle = "#5a3414"; c.lineWidth = 0.8; c.beginPath(); for (const o of [-4.5, -1.5, 1.5, 4.5]) { const w = Math.sqrt(54 - o * o); c.moveTo(-w, o); c.lineTo(w, o); } c.stroke();
        c.fillStyle = "#d8a060"; c.fillRect(-5, -6.5, 3, 1); c.restore();
      }
      for (const z of G.zones) { // incoming ball (last 18 frames), muzzle flash on the horizon (first frames)
        if (z.t < 0) continue;
        if (z.t < 10) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 1 - z.t / 10; glow(c, z.fx - cx, 96, 14, "rgba(255,200,90,1)"); c.restore(); }
        if (z.t > Z_WARN - 18) { const k = (z.t - (Z_WARN - 18)) / 18, h = (1 - k) * 150; if (!spr(PF.ball, z.x - cx, z.y - h - 3, 7.5, 7.5)) { api.rect(z.x - cx - 3, z.y - h - 6, 6, 6, "#14141a"); api.rect(z.x - cx - 2, z.y - h - 5, 2, 2, "#5a5a6a"); } }
        if (z.t < Z_WARN - 10 && blink(z.t, 6)) api.ptext("!", z.x - cx, z.y - 24, 2, "#ffe060");
      }
      for (const r of G.ropes) { // boarding rope from the rigging
        const e = r.e, ex = e.x - cx, ey = e.y - e.z - 40;
        c.strokeStyle = "#c8a46a"; c.lineWidth = 1; c.beginPath(); c.moveTo(r.ax - cx, r.ay); c.quadraticCurveTo((r.ax - cx + ex) / 2, (r.ay + ey) / 2 + 8, ex, ey); c.stroke();
      }
      for (const q of G.parts) { const x = q.x - cx, y = q.y - q.z; api.rect(x, y, q.c === "#bfeaff" || q.c === "#ffffff" ? 2 : 2, q.z > 0 ? 2 : 1, q.c); }
      const R = G.roll;
      if (R.ph === "warn" || (R.ph === "tilt" && R.t < 30)) { // BRACE banner pointing downhill
        const dn = R.dir > 0 ? ">>>" : "<<<", y = 40;
        c.globalAlpha = 0.6; api.rect(0, y - 9, api.W, 18, "#1a0c04"); c.globalAlpha = 1;
        if (blink(R.t, 8) || R.ph === "tilt") api.ptext(R.dir > 0 ? "BRACE! DECK TILTING " + dn : dn + " BRACE! DECK TILTING", api.W / 2, y - 3, 1, "#ffe060");
      }
      if (G.flash > 0) { c.globalAlpha = G.flash / 12; api.rect(-20, -20, api.W + 40, api.H + 40, "#e8e8ff"); c.globalAlpha = 1; }
    },
  });

  // the pitching deck: redraw the background rolled about the deck centre and leave the roll on for the actors
  // (the engine's drawStage restores the context before the HUD, so the HUD never tilts)
  function rollView(path) {
    return function (api, cx) {
      if (!G) return;
      const c = api.ctx, a = G.roll.ang; if (Math.abs(a) < 0.0005) return;
      const im = exposedBg(path); if (!im) return;
      const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, tw = Math.round(iw * api.H / ih), PX = api.W / 2, PY = 190;
      c.translate(PX, PY); c.rotate(a); c.translate(-PX, -PY);
      c.save(); c.imageSmoothingEnabled = true;
      for (let i = Math.floor((cx - 60) / tw); i * tw - cx < api.W + 60; i++) {
        const x = Math.round(i * tw - cx);
        c.drawImage(im, x, 0, tw, api.H);
        const sh = Math.round(40 * ih / api.H); // mirror the sky up past the top edge and the planks down past the bottom
        c.save(); c.scale(1, -1); c.drawImage(im, 0, 0, iw, sh, x, 0, tw, 40); c.restore();
        c.save(); c.translate(0, api.H * 2); c.scale(1, -1); c.drawImage(im, 0, ih - sh, iw, sh, x, api.H - 40, tw, 40); c.restore();
      }
      c.restore();
    };
  }

  // ================= BOSS: ARMAGGON =================
  // sprite sheet generated for this level (level10_armaggon.webp): frames bottom-aligned, faces right; tx = torso anchor
  // fall / lie (KO, head-left) / getup are painted knockdown frames appended to the sheet
  const F = { idle: [0, 25, 219, 249, 126], idle2: [223, 32, 233, 242, 125], bite: [460, 24, 296, 250, 166], fire: [760, 31, 301, 243, 148], hurt: [1065, 0, 239, 274, 111], walk: [1308, 24, 227, 250, 126], fall: [1543, 101, 319, 173, 147], lie: [1866, 158, 346, 116, 172], getup: [2216, 101, 287, 173, 161] };
  const K = 0.37, GRATE = { x: 192, y: 158 };
  function sheet(kind) { // "red" (telegraph flash) / "hot" (phase-2 glow) tinted copies, built once
    const im = A.img(SHARK); if (!im || !im.naturalWidth) return im;
    if (!kind) return im;
    const key = "shark_" + kind; if (CACHE[key]) return CACHE[key];
    try {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop";
      g.fillStyle = kind === "red" ? "rgba(255,40,30,0.4)" : "rgba(255,90,40,0.22)"; g.fillRect(0, 0, c.width, c.height);
      CACHE[key] = c; return c;
    } catch (_) { return im; }
  }
  function drawShark(api, fr, sx, sy, facing, kind, rot) {
    const im = sheet(kind), f = F[fr], c = api.ctx;
    if (!im) { api.rect(sx - 14, sy - 88, 28, 88, "#5a7a96"); return; }
    c.save(); c.translate(Math.round(sx), Math.round(sy)); if (rot) c.rotate(rot); if (facing < 0) c.scale(-1, 1);
    c.imageSmoothingEnabled = true; c.drawImage(im, f[0], f[1], f[2], f[3], -f[4] * K, -f[3] * K, f[2] * K, f[3] * K); c.restore();
  }
  function drawFin(api, x, y, t, big) { // dorsal fin slicing up through the planks
    const c = api.ctx, h = big ? 20 : 15, w = big ? 14 : 11, wob = Math.sin(t * 0.4);
    const fw = big ? 34 : 27, fh = fw * PF.fin[3] / PF.fin[2]; // painted riveted fin in a ring of broken planks (bottom on the deck)
    if (spr(PF.fin, x + wob * 0.6, y + 3 - fh / 2, fw, fh)) return;
    c.fillStyle = "rgba(10,6,2,0.55)"; c.beginPath(); c.ellipse(x, y, w + 6, 3.5, 0, 0, 6.29); c.fill();
    c.fillStyle = "#5c7c9a"; c.strokeStyle = "#0c1018"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w / 4, y - h * 0.6, x + w / 2 + wob, y - h); c.lineTo(x + w / 2, y); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#a8c0d4"; c.beginPath(); c.moveTo(x - w / 4, y - 1); c.lineTo(x + w / 2 + wob - 1, y - h + 2); c.lineTo(x + 1, y - 1); c.closePath(); c.fill();
    api.rect(x - w / 2 - 3, y - 2, 3, 1, "#d8a060"); api.rect(x + w / 2 + 1, y - 3, 2, 1, "#d8a060");
  }
  const P2 = { speed: 1.35, chargeSpeed: 1.4, cool: 66 };
  function pick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), dy = p.y - e.y;
    e.t = 0; e.cool = e.cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 30 && Math.random() < 0.7) { e.state = "kwind"; return; }
    const o = ["tele", "fire", "dive"];
    if (Math.abs(dy) < 10) o.push("tele");
    if (e.p2) o.push("throw", "throw", "dive");
    if (e.p2 && !(e.sumCd > 0) && api.enemies.length < 3) o.push("summon");
    let m = o[Math.random() * o.length | 0];
    if (m === e.last && Math.random() < 0.65) m = o[Math.random() * o.length | 0];
    if (m === "dive" && e.last === "dive") m = "fire";
    e.last = m; e.state = m;
  }
  // ---- Boss entrance (entr v1): a fin circles the deck, stops dead over the grate, then Armaggon bursts up through the planks ----
  const AR_ENTR = {
    len: 170, zoom: 1.3, sub: "TERROR OF THE SEVEN SEAS",
    setup(api, e, st) { Object.assign(e, { x: GRATE.x + 90, y: 186, z: 0, facing: -1, state: "rise", t: 0 }); },
    focus: (api, e, st, t) => ({ x: e.x, y: t < 84 ? e.y - 20 : e.y - e.z - 50 }),
    step(api, e, st, t) {
      updateParts();
      if (t < 56) { const a = t * 0.11; e.x = GRATE.x + Math.cos(a) * 90; e.y = 186 + Math.sin(a) * 22; e.state = "rise"; e.t = 10; e.facing = -Math.sin(a) >= 0 ? 1 : -1; if (t % 8 === 0) splinters(e.x, e.y, 2); if (t % 18 === 0) api.SFX.swing(); return; }
      if (t === 56) { e.x = GRATE.x; e.y = GRATE.y + 18; api.SFX.charge(); }
      if (t < 84) { e.state = "rise"; e.t = 130; if (t % 6 === 0) api.shake(1, 6, true); return; }
      if (t === 84) { api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.SFX.finisher(); splinters(e.x, e.y, 16); splash(e.x, e.y, 12);
        const im = A.img(PR_IMG); if (ready(im)) api.entr.debris(e.x, e.y, 6, 6, { img: im, frames: [PF.scar], k: 0.18, spread: 2.2, up: 2.5, w: 14 });
        api.entr.debris(e.x, e.y, 4, 10, { spread: 2.4, up: 2.5, colors: ["#8a5a2a", "#d8a060", "#5a3a1a", "#bfeaff"] }); }
      if (t >= 84 && t <= 116) { const k = (t - 84) / 32; e.state = "slam"; e.t = 5; e.z = Math.sin(k * Math.PI) * 50; e.y = api.lerp(GRATE.y + 18, (api.floorTop + api.floorBot) / 2, k); }
      if (t === 116) { e.z = 0; api.entr.impact(e.x, e.y, 6, { stop: 4, sfx: "land" }); splash(e.x, e.y, 8); }
      if (t > 116) { e.state = t < 132 ? "slam" : "rise"; e.t = t < 132 ? 5 : 170; }
    },
    drawBack(api, st, t, cx) { if (t >= 84) AR_ENTR.persist(api, st, cx); },
    persist(api, st, cx) { spr(PF.scar, GRATE.x - cx, GRATE.y + 18, 46, 17); },
    finish(api, e) { e.go = true; },
  };
  const bossCfg = {
    name: "ARMAGGON", base: "ramrod", atlas: "ramrod", scale: 1.25, height: 96, hp: 46, speed: 1.05, chargeSpeed: 1.2, cool: 96, pitch: 70,
    moves: ["charge", "kick", "fire"], shot: "ray",
    lines: {
      intro: "FRESH SHELLFISH! I'LL CRACK YOU OPEN!",
      hit: ["GRRRAAH!", "YOU'LL PAY FOR THAT, TURTLE!", "I SMELL FEAR... AND SHELL!", "THAT TICKLES!"],
      summon: "CREW! FEED 'EM TO THE FISHES!",
      ko: "MY TEETH... MY BEAUTIFUL TEETH...!",
    },
    spawn(api, e) { Object.assign(e, { state: "rise", t: 0, x: GRATE.x, y: GRATE.y + 20, z: 0, facing: -1, inv: 999, sumCd: 400 }); },
    entrance: AR_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0), s = e.state;
      if (s === "rise") { // a fin circles the deck, then he bursts up through the grate
        e.inv = 2;
        if (e.t < 120) { const a = e.t * 0.06; e.x = GRATE.x + Math.cos(a) * 90; e.y = 186 + Math.sin(a) * 22; if (e.t % 12 === 0) splinters(e.x, e.y, 2); return true; }
        if (e.t === 120) { e.x = GRATE.x; e.y = GRATE.y + 18; api.SFX.charge(); }
        if (e.t < 160) { if (e.t % 6 === 0) api.shake(1, 6, true); return true; }
        if (e.t === 160) { api.SFX.boom(); api.shake(4, 16, true); splinters(e.x, e.y, 16); splash(e.x, e.y, 12); api.fx("ring", e.x, e.y, 20); }
        e.z = Math.max(0, Math.sin(Math.min(1, (e.t - 160) / 30) * Math.PI) * 40);
        if (e.t === 196) api.enemySay(e, bossCfg.lines.intro, 110, 70, true);
        if (e.t >= 300) { e.inv = 0; e.z = 0; e.state = "walk"; e.t = 0; e.cool = 40; e.go = true; }
        return true;
      }
      if (s === "rage") { // phase 2: roars, the rival galleon opens up, pirates swing in
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t === 1) { api.enemySay(e, "NOW YOU'VE MADE ME HUNGRY!", 110, 64, true); api.SFX.rumble(); }
        if (e.t % 10 === 0) api.shake(2, 8, true);
        if (e.t === 50) { G.canCd = 999; volley(api, p, 4); }
        if (e.t === 80) { board(api, "sword", -1); board(api, "purple", 1); }
        if (e.t >= 150) { e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2); e.state = "walk"; e.t = 0; e.cool = 50; e.sumCd = 760; G.canCd = 300; api.playerBark(true, "FEEDING FRENZY! KEEP MOVING!"); }
        return true;
      }
      if (s === "walk" && !e.p2 && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; return true; }
      if (s === "walk" && free && e.go && e.cool <= 1) { pick(api, e, p); return true; }
      if (s === "tele") { // bite lunge wind-up: rears back, jaws flash red
        if (e.t === 1) { e.facing = p.x >= e.x ? 1 : -1; api.SFX.charge(); }
        e.x -= e.facing * 0.25; e.y += Math.sign(p.y - e.y) * Math.min(0.6, Math.abs(p.y - e.y));
        if (e.t >= 36) { e.state = "charge"; e.t = 0; e.lx = e.x; }
        return true;
      }
      if (s === "charge") { // the lunge: a fast bite along the row
        e.x += e.facing * 4.6 * e.cfg.chargeSpeed;
        if (e.t % 4 === 0) api.dust(e.x - e.facing * 10, e.y);
        if (free && canHurt(p) && p.z < 18 && Math.abs(p.x - e.x - e.facing * 14) < 18 && Math.abs(p.y - e.y) < 10) { api.hurtPlayer(2, false, e.facing); api.SFX.hit(); api.shake(3, 10, true); e.t = 99; }
        const L = api.camX + 14, R = api.camX + api.W - 14;
        if (e.t >= 34 || e.x <= L || e.x >= R) { e.state = "stagger"; e.t = 0; e.vx = 0; api.SFX.land(); }
        return true;
      }
      if (s === "fire") { // harpoon cannon: red laser sight, then 1 harpoon (3 in phase 2)
        if (e.t === 1) e.facing = p.x >= e.x ? 1 : -1;
        if (e.t < 40) e.y += Math.sign(p.y - e.y) * Math.min(0.4, Math.abs(p.y - e.y));
        if (e.t === 40) {
          const n = e.p2 ? 3 : 1;
          for (let i = 0; i < n; i++) api.shot({ x: e.x + e.facing * 56, y: e.y, vx: e.facing * 4.4, vy: (i - (n - 1) / 2) * 0.55, kind: "harpoon", update: harpoonUpd, draw: harpoonDraw });
          api.SFX.gun(); api.shake(1, 6, true);
        }
        if (e.t >= 64) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (s === "throw") { // phase 2: cyber-eye laser beam along his row that sweeps toward you
        if (e.t === 1) { e.facing = p.x >= e.x ? 1 : -1; e.by = e.y; e.bhit = false; api.SFX.charge(); }
        if (e.t >= 48 && e.t < 100) {
          e.by += Math.sign(p.y - e.by) * Math.min(0.32, Math.abs(p.y - e.by));
          if (e.t % 6 === 0) api.SFX.zap();
          const ahead = (p.x - e.x) * e.facing > 10;
          if (!e.bhit && canHurt(p) && ahead && Math.abs(p.y - e.by) < 5 && p.z < 30) { e.bhit = true; api.hurtPlayer(2, false, e.facing); }
          for (const o of api.enemies) if (hittable(o) && (o.x - e.x) * e.facing > 10 && Math.abs(o.y - e.by) < 5) api.hitEnemy(o, 1, true, e.facing);
        }
        if (e.t >= 112) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (s === "summon") {
        if (e.t === 14) { api.enemySay(e, bossCfg.lines.summon, 80, 70); board(api, "blue", -1); board(api, "heavy", 1); e.sumCd = 820; }
        if (e.t >= 50) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (s === "dive") { // fin-dive: plunges through the planks, a fin hunts you, it locks on, he bursts up
        e.inv = 2;
        const hunt = e.p2 ? 110 : 140;
        if (e.t === 1) { api.SFX.jump(); e.d0 = e.y; }
        if (e.t <= 22) { e.z = Math.sin((e.t / 22) * Math.PI) * 34; return true; }
        if (e.t === 23) { e.z = 0; api.SFX.boom(); api.shake(3, 10, true); splinters(e.x, e.y, 14); splash(e.x, e.y, 10); }
        if (e.t < 23 + hunt) { // the fin follows with a lag; touching it stings
          const sp = e.p2 ? 1.75 : 1.45, dx = p.x - e.x, dy = p.y - e.y;
          e.x += Math.sign(dx) * Math.min(sp, Math.abs(dx)); e.y += Math.sign(dy) * Math.min(sp * 0.55, Math.abs(dy)); e.facing = dx >= 0 ? 1 : -1;
          if (e.t % 5 === 0) splinters(e.x - e.facing * 6, e.y, 1);
          if (canHurt(p) && p.z < 6 && Math.abs(p.x - e.x) < 8 && Math.abs(p.y - e.y) < 5) api.hurtPlayer(1, false, e.facing);
          return true;
        }
        if (e.t === 23 + hunt) { e.bx = e.x; e.by = e.y; api.SFX.charge(); }
        if (e.t < 23 + hunt + 46) { e.x = e.bx; e.y = e.by; if (e.t % 8 === 0) { api.shake(1, 6, true); splinters(e.x + api.rnd(-14, 14), e.y, 1); } return true; }
        e.state = "slam"; e.t = 0; e.inv = 0; return true;
      }
      if (s === "slam") { // the burst through the deck
        if (e.t === 1) {
          api.SFX.boom(); api.shake(5, 18, true); splinters(e.x, e.y, 22); splash(e.x, e.y, 14); api.fx("ring", e.x, e.y, 22);
          if (canHurt(p) && p.z < 16 && Math.abs(p.x - e.x) < 30 && Math.abs(p.y - e.y) < 13) api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
          for (const o of api.enemies) if (hittable(o) && Math.abs(o.x - e.x) < 30 && Math.abs(o.y - e.y) < 13) api.hitEnemy(o, 2, true, o.x >= e.x ? 1 : -1);
        }
        e.z = Math.max(0, Math.sin(Math.min(1, e.t / 30) * Math.PI) * 44);
        if (e.t >= 30) { e.z = 0; e.state = "stagger"; e.t = 0; e.vx = 0; } // a punish window after landing
        return true;
      }
      return false; // walk / kwind / kick / hurt etc: the engine's ramrod handling
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t, c = api.ctx;
      if (s === "rise" && t < 160) { if (t < 120) drawFin(api, sx, e.y, api.t, false); else { drawFin(api, sx, e.y, api.t, true); if (blink(t, 6)) api.ptext("!", sx, e.y - 34, 2, "#ffe060"); } return; }
      if (s === "dive" && t > 22) {
        const hunt = e.p2 ? 110 : 140, lock = t >= 23 + hunt;
        if (lock) { // cracking planks + target ring where he will burst up
          const k = (t - 23 - hunt) / 46;
          c.save(); c.strokeStyle = blink(t, 4) ? "#ff3a2a" : "#ffe060"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(sx, e.y, 30 - 6 * k, 11 - 2 * k, 0, 0, 6.29); c.stroke(); c.restore();
          c.globalAlpha = 0.45 + 0.4 * k;
          const cracked = spr(PF.scar, sx + (t % 4 < 2 ? 0.5 : -0.5), e.y, 26 + 18 * k, 9.5 + 6.5 * k); c.globalAlpha = 1; // planks splitting open (painted)
          if (!cracked) { c.globalAlpha = 0.35 + 0.3 * k; c.fillStyle = "#1a0e06"; c.beginPath(); c.ellipse(sx, e.y, 22, 7, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
          for (let i = 0; i < 6; i++) { const an = i * 1.05 + 0.3; api.rect(sx + Math.cos(an) * 10 * (0.5 + k), e.y + Math.sin(an) * 4 * (0.5 + k), 3, 1, "#e0a060"); } }
          if (blink(t, 6)) api.ptext("!", sx, e.y - 30, 2, "#ffe060");
        } else drawFin(api, sx, e.y, api.t, e.p2);
        return;
      }
      if (s === "dive") { drawShark(api, "walk", sx, sy, e.facing, null, e.facing * 0.9 * (t / 22)); return; }
      const red = (s === "tele" && blink(t, 3)) || (s === "fire" && t < 40 && blink(t, 4)) || (s === "throw" && t < 48 && blink(t, 4)) || (s === "kwind" && blink(t, 2));
      const kind = red ? "red" : e.p2 && s !== "dying" && (e.life || 0) % 40 < 20 ? "hot" : null;
      if (e.p2 || s === "rage") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.3 + 0.15 * Math.sin(api.t * 0.2); glow(c, sx, sy - 44, 48, "rgba(255,60,40,0.7)"); c.restore(); }
      if (s === "down" || s === "dying") { const fl = t < 10; drawShark(api, fl ? "fall" : "lie", sx, sy - (fl ? Math.sin((t / 10) * Math.PI) * 6 : 0), e.facing, null, 0); return; } // knocked off his feet, then flat out
      let fr = "idle";
      if (s === "walk") fr = e.walkT > 0 && Math.floor(e.walkT / 12) % 2 ? "idle2" : "idle";
      else if (s === "charge" || s === "kick" || s === "kwind" || s === "slam") fr = "bite";
      else if (s === "tele") fr = "hurt"; // rears back before the bite (idle2 is the harpoon aim pose, which telegraphed the wrong attack)
      else if (s === "fire" || s === "throw") fr = "fire";
      else if (s === "hurt" || s === "stagger" || s === "rage" || s === "summon") fr = "hurt";
      else if (s === "getup") fr = t < 12 ? "getup" : "idle";
      const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : s === "tele" ? -e.facing * (t % 4 < 2 ? 1 : 0) : 0;
      const bob = s === "walk" && e.walkT > 0 ? -Math.abs(Math.sin(e.walkT * 0.26)) * 2 : 0;
      if (s === "slam" && t < 6) { c.save(); c.beginPath(); c.rect(sx - 60, sy - 140, 120, 140 + e.z); c.clip(); }
      drawShark(api, fr, sx + jx, sy + bob, e.facing, kind, s === "charge" ? e.facing * 0.12 : 0);
      if (s === "slam" && t < 6) c.restore();
      const mx = sx + e.facing * 56, my = sy - 52; // harpoon muzzle (fire frame)
      if (s === "fire" && t < 40) { // laser sight
        c.save(); c.globalAlpha = 0.5 + 0.4 * (t / 40); c.strokeStyle = "#ff2a2a"; c.lineWidth = t > 30 ? 1.5 : 0.8; if (t <= 30) c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + e.facing * 9, sy - 30); c.lineTo(e.facing > 0 ? api.W + 40 : -40, sy - 30); c.stroke(); c.restore();
        if (blink(t, 6)) api.ptext("!", sx, sy - 104, 2, "#ffe060");
      }
      if (s === "throw") { // eye laser
        const ey = sy - 77, ex = sx + e.facing * 20, end = e.facing > 0 ? api.W + 40 : -40, by = (e.by || e.y) - e.z - 30;
        c.save();
        if (t < 48) { c.globalAlpha = 0.6; c.strokeStyle = blink(t, 3) ? "#ff2a2a" : "#ffb0a0"; c.lineWidth = 0.8; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(ex, ey); c.lineTo(end, by); c.stroke(); if (blink(t, 6)) api.ptext("!", sx, sy - 104, 2, "#ffe060"); }
        else if (t < 100) {
          c.globalCompositeOperation = "lighter"; c.lineCap = "round";
          c.strokeStyle = "rgba(255,30,20,0.45)"; c.lineWidth = 7; c.beginPath(); c.moveTo(ex, ey); c.lineTo(end, by); c.stroke();
          c.strokeStyle = api.t % 4 < 2 ? "#fff0e8" : "#ff8a6a"; c.lineWidth = 2; c.stroke();
          glow(c, ex, ey, 10, "rgba(255,80,60,0.9)");
          c.globalAlpha = 0.5; c.fillStyle = "rgba(255,40,20,0.6)"; c.beginPath(); c.ellipse((ex + end) / 2, (e.by || e.y), Math.abs(end - ex) / 2, 3, 0, 0, 6.29); c.fill(); // floor scorch line
        }
        c.restore();
      }
    },
    onDefeat(api) { if (G) { G.zones = []; G.barrels = []; } },
  };
  function harpoonUpd(api, s) {
    const p = api.player; s.x += s.vx; s.y += s.vy || 0; s.t = (s.t || 0) + 1;
    if (s.y < api.floorTop - 4 || s.y > api.floorBot + 4) s.vy = -s.vy;
    if (canHurt(p) && Math.abs(s.x - p.x) < 9 && Math.abs(s.y - p.y) < 6 && p.z < 16) { api.hurtPlayer(2, false, Math.sign(s.vx)); api.fx("spark", s.x, s.y - 14, 8); s.dead = true; }
    if (s.x < api.camX - 30 || s.x > api.camX + api.W + 30) s.dead = true;
    return true;
  }
  function harpoonDraw(api, s, sx, sy) {
    const d = Math.sign(s.vx), y = sy - Math.max(30, 52 - (s.t || 0) * 2.5), c = api.ctx;
    if (ready(api.img(PR_IMG))) { // painted harpoon (ring + rope stub at the back), tether trailing back to the gun
      c.strokeStyle = "#c8a46a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - d * 16, y); c.quadraticCurveTo(sx - d * 38, y + 6, sx - d * 64, y + 2); c.stroke();
      spr(PF.harp, sx - d * 7, y, 20, 20 * PF.harp[3] / PF.harp[2], 0, d < 0); return;
    }
    c.strokeStyle = "#c8a46a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - d * 4, y); c.quadraticCurveTo(sx - d * 30, y + 6, sx - d * 60, y + 2); c.stroke(); // tether
    api.rect(Math.min(sx, sx - d * 16), y - 1, 16, 2, "#d8dce8"); api.rect(Math.min(sx, sx - d * 16), y - 1, 16, 1, "#ffffff");
    c.fillStyle = "#eef2ff"; c.beginPath(); c.moveTo(sx + d * 6, y); c.lineTo(sx - d * 1, y - 4); c.lineTo(sx - d * 1, y + 4); c.closePath(); c.fill();
    api.rect(sx - d * 18 - 1, y - 1, 2, 2, "#ff3a2a");
  }

  // ================= OUTRO: the rift tears open again: a steam train in the desert =================
  const RIFT = { x: 200, y: 60 };
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro (see NOTES.md)
      if (!G) G = fresh(true);
      G.roll.ang *= 0.95; updateParts();
      if (t === 1) { G.zones = []; G.barrels = []; st.r = 0; st.smoke = []; }
      if (t === 24) api.playerBark(true, "CHUM'S UP, SHARK-FACE!");
      if (t === 90) { api.SFX.zap(); api.SFX.rumble(); api.shake(3, 30, true); }
      if (t >= 90) st.r = Math.min(1, st.r + 0.02);
      if (t === 170) api.playerBark(true, "THE RIFT! IS THAT... A TRAIN?!");
      if (t === 240 || t === 262) { api.SFX.chat(880); api.SFX.chat(1175); }
      if (t > 150 && t % 14 === 0) st.smoke.push({ k: 0 });
      st.smoke = st.smoke.filter((m) => (m.k += 0.012) < 1);
      if (t > 290 && t < 360) { // walk under the rift
        const dx = RIFT.x - p.x; if (Math.abs(dx) > 2) { p.x += Math.sign(dx) * 1.8; p.walkT++; p.facing = Math.sign(dx); } else p.walkT = 0;
      }
      if (t === 360) { api.SFX.jump(); st.jump = 0; }
      if (st.jump !== undefined && t < 470) { st.jump++; p.z = Math.min(200, st.jump * st.jump * 0.05 + st.jump * 1.2); p.walkT = 0; if (st.jump === 50) { api.SFX.zap(); api.fx("spark", p.x, p.y - p.z, 14); } }
      if (t >= 470) { p.z = 0; return true; }
      return false;
    },
    draw(api, st, t, cx) {
      if (!st.r) return;
      const c = api.ctx, r = st.r, x = RIFT.x - cx, y = RIFT.y, rw = 72 * r, rh = 34 * r;
      c.save();
      c.beginPath(); c.ellipse(x, y, rw, rh, 0, 0, 6.29); c.clip();
      const rim = api.img(RIFT_IMG), tx = x - 90 + ((t * 0.6) % 220);
      if (ready(rim) && ready(api.img(PR_IMG))) { // painted desert + locomotive through the rift
        const dw = 158, dh = dw * 158 / 320, rail = y + 14;
        c.drawImage(rim, x - dw / 2, rail - 0.93 * dh, dw, dh);
        const tw = 92, th = tw * PF.train[3] / PF.train[2]; spr(PF.train, tx - 8, rail + 1 - th / 2, tw, th, 0, true); // mirrored: steams to the right
        c.fillStyle = "rgba(240,230,220,0.8)"; for (const m of st.smoke) { c.globalAlpha = 1 - m.k; c.beginPath(); c.arc(tx + 30 - m.k * 30, rail - 22 - m.k * 26, 2 + m.k * 7, 0, 6.29); c.fill(); }
        c.globalAlpha = 1;
      } else {
      const g = c.createLinearGradient(0, y - rh, 0, y + rh); g.addColorStop(0, "#ff9a3a"); g.addColorStop(0.55, "#ffd27a"); g.addColorStop(0.56, "#c8763a"); g.addColorStop(1, "#7a3a1a");
      c.fillStyle = g; c.fillRect(x - rw, y - rh, rw * 2, rh * 2);
      c.fillStyle = "#ffe8a0"; c.beginPath(); c.arc(x + 30, y - 6, 9, 0, 6.29); c.fill(); // desert sun
      c.fillStyle = "#6a3220"; for (const [mx, mw, mh] of [[-58, 30, 16], [-16, 18, 10], [34, 34, 19]]) { c.beginPath(); c.moveTo(x + mx - 5, y + 3); c.lineTo(x + mx, y + 3 - mh); c.lineTo(x + mx + mw, y + 3 - mh); c.lineTo(x + mx + mw + 5, y + 3); c.fill(); } // mesas
      c.fillStyle = "#2a4a1a"; c.fillRect(x - 30, y - 4, 3, 16); c.fillRect(x - 34, y - 1, 3, 2); c.fillRect(x - 35, y - 5, 2, 5); c.fillRect(x - 27, y + 1, 3, 2); c.fillRect(x - 25, y - 3, 2, 5); // saguaro
      c.fillStyle = "#2a1408"; c.fillRect(x - rw, y + 14, rw * 2, 2); // rails
      // steam locomotive silhouette chugging across
      c.fillStyle = "#1a0e08"; c.fillRect(tx, y + 2, 26, 10); c.fillRect(tx + 18, y - 4, 9, 16); c.fillRect(tx + 3, y - 4, 4, 7); c.fillRect(tx - 20, y + 4, 18, 8); c.fillRect(tx - 40, y + 4, 18, 8);
      c.beginPath(); c.moveTo(tx + 26, y + 12); c.lineTo(tx + 32, y + 14); c.lineTo(tx + 26, y + 6); c.fill();
      for (const k of [2, 10, 20, -12, -32]) { c.beginPath(); c.arc(tx + k, y + 13, 2.2, 0, 6.29); c.fill(); }
      c.fillStyle = "rgba(240,230,220,0.8)"; for (const m of st.smoke) { c.globalAlpha = 1 - m.k; c.beginPath(); c.arc(tx + 5 - m.k * 30, y - 6 - m.k * 26, 2 + m.k * 7, 0, 6.29); c.fill(); }
      }
      c.restore();
      c.save(); c.globalCompositeOperation = "lighter"; // swirling rift rim
      for (let i = 0; i < 3; i++) { c.strokeStyle = ["rgba(255,80,230,0.8)", "rgba(80,220,255,0.7)", "rgba(255,255,255,0.6)"][i]; c.lineWidth = 3 - i; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rw + i * 3 + Math.sin(api.t * 0.2 + i) * 2), Math.max(0.1, rh + i * 2), Math.sin(api.t * 0.05 + i) * 0.1, 0, 6.29); c.stroke(); }
      c.globalAlpha = 0.4 * r; glow(c, x, y, rw + 30, "rgba(200,80,255,0.6)"); c.restore();
      if (t >= 240 && t < 300) api.ptext("TOOT TOOOOT!", x + 46, y - rh - 6, 1, "#ffe8a0");
      if (t > 380) {
        const a = Math.min(1, (t - 380) / 20); c.globalAlpha = 0.55 * a; api.rect(0, 150, api.W, 34, "#05030a"); c.globalAlpha = a;
        api.ptext("NEXT STOP: THE WILD WEST!", api.W / 2, 160, 2, t % 20 < 10 ? "#ffe060" : "#ffb21a"); c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 10,
    name: "PIRATE SHIP",
    card: { title: "PIRATE SHIP", tagline: "THE RIFT DROPS YOU INTO 1687. REPEL BOARDERS!", color: "#ffb21a" },
    music, bossMusic,
    // painted regular enemies (pirate family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_pirate.webp", ENEMY_F = { light: {"idle":[4,1,96,167,42],"walk":[104,0,82,168,38],"walk2":[190,0,88,168,44],"attack":[282,12,168,156,66],"jump":[454,23,145,145,68],"hurt":[603,12,88,156,57],"down":[695,120,187,48,93],"dash":[886,74,152,94,35]}, weapon: {"idle":[4,172,72,169,34],"walk":[80,173,89,168,36],"walk2":[173,173,91,168,37],"attack":[268,183,146,158,48],"jump":[418,189,98,152,38],"hurt":[520,184,85,157,42],"down":[609,298,171,43,85],"throw":[784,186,118,155,44]}, big: {"idle":[4,355,102,161,48],"walk":[110,348,103,168,47],"walk2":[217,348,99,168,47],"attack":[320,354,146,162,57],"jump":[470,359,96,157,43],"hurt":[570,362,94,154,48],"down":[668,465,180,51,90],"shoot":[852,345,183,171,42]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 345, blue: 175, sword: 30, star: 300, gunner: 20, heavy: 0, dasher: 205 },
    images: [SHARK, PR_IMG, RIFT_IMG],
    sections: [
      { bg: BG1, floor: [166, 218], length: 2600, locks: [0, 640, 1300, 1980],
        waves: [["purple", "purple", "star"], ["sword", "blue", "purple", "gunner"], ["heavy", "sword", "dasher", "star"], ["heavy", "gunner", "sword", "blue", "purple"]],
        hazards: [ship(false)], drawBack: rollView(BG1),
        onUpdate(api, p) { if (!G) G = fresh(false); if (++G.intro === 50) api.playerBark(true, "WHOA! A PIRATE SHIP?! WHAT YEAR IS IT?"); },
        sky: "#3a2a4a", ground: "#5a3a22" },
      { bg: BG2, floor: [160, 216], length: 384, locks: [], waves: [], weather: "rain", hazards: [ship(true)], drawBack: rollView(BG2),
        sky: "#1a1030", ground: "#4a3020" },
    ],
    restructure: { // phase 2: main deck (zone 1) -> TIMBER! mast collapse (twist) -> gun deck (zone 2) -> existing quarterdeck
      split: 0, images: ["levels/level10_collapse.webp", "levels/level10_gundeck.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "collapse", title: "BROADSIDE! THE MAST IS GOING!", sub: "THE DECK IS SPLITTING - KEEP OFF THE HOLES", len: 2100, img: "levels/level10_collapse.webp", fr: {"mast": [0, 0, 560, 346], "hole": [0, 349, 280, 83], "plank1": [283, 349, 40, 56], "plank2": [326, 349, 30, 37], "plank3": [359, 349, 34, 38], "ladder": [396, 349, 44, 190], "keg": [443, 349, 110, 93]},
        mast: true, mastMsg: "TIMBER!", fallSpr: ["plank1", "plank2", "plank3"], fallK: 0.5, drip: ["purple", "sword", "star"], gap: 170, cap: 3, color: "#ffb04a", clearMsg: "THE DECK GIVES WAY!" },
      z2bg: "levels/level10_gundeck.jpg", z2: { drawBack: rollView("levels/level10_gundeck.jpg") },
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(false); },
    onUnload() { G = null; for (const k in CACHE) { const c = CACHE[k]; if (c && c.width) c.width = c.height = 0; } CACHE = {}; },
  });
})();
