  // ---------- MID-LEVEL TWISTS (twist v1) ----------
  // A section with `twist: { kind, ... }` (normally seg "twist") is run by the engine twist kit instead of the wave/lock logic:
  // the kit owns the camera, its own spawns, its goal and the exit. When the goal is met (and the stragglers are down) a
  // CLEAR banner shows and the section fades into the next one. `gate: false` = overlay only (the section's own waves run).
  // Common fields: kind, title, sub, img (sheet, sheet px = 2x world px), fr { name: [x, y, w, h] }, len (frames), goal
  // "time" | "reach" | "kills" | "boss", drip [types], gap, cap, from ("drop" | "right" | ...), need (kills goal).
  // Kinds: collapse, searchlight, chase, run, turret, ride, ice, elevator, miniboss, defend, freefall (see TWK below).
  function twSpr(d, name, x, y, k, flip, alpha) { // bottom-centre at screen x, y; k = world px per sheet px (default 0.5)
    const im = d && d.img ? lvImg(d.img) : null, F = d && d.fr && d.fr[name]; if (!im || !F) return false;
    k = k || 0.5; const w = F[2] * k, h = F[3] * k;
    ctx.save(); ctx.imageSmoothingEnabled = true; if (alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (flip) { ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(im, F[0], F[1], F[2], F[3], -w / 2, Math.round(y - h), w, h); }
    else ctx.drawImage(im, F[0], F[1], F[2], F[3], Math.round(x - w / 2), Math.round(y - h), w, h);
    ctx.restore(); return true;
  }
  const twFoes = () => STATE.enemies.filter((e) => !e.boss && e.state !== "dying");
  const twMid = () => (FLOOR_TOP + FLOOR_BOT) / 2;
  function twCanHurt(p) { return p && p.deadT === 0 && p.inv === 0 && !p.grabbedBy; }
  function twDrop(T, x, y, spr, o) { // something falls out of the sky onto (x, y): shadow telegraph, then impact
    o = o || {}; T.fall.push({ x, y, spr, t: 0, len: o.len || 56, r: o.r || 14, dmg: o.dmg === undefined ? 2 : o.dmg, k: o.k || 0.4, stay: o.stay || 0, code: o.code || null });
  }
  function twFallStep(T, p) {
    T.fall = T.fall.filter((f) => {
      f.t++;
      if (f.t === f.len) {
        SFX.land(); shake(2, 10, true); dust(f.x, f.y); fx("smoke", f.x, f.y - 6, 18);
        if (f.dmg && twCanHurt(p) && p.z < 20 && Math.abs(p.x - f.x) < f.r && Math.abs(p.y - f.y) < 9) hurtPlayer(f.dmg, false, p.x < f.x ? -1 : 1);
        if (f.dmg) for (const e of STATE.enemies) if (!e.boss && canHitState(e) && Math.abs(e.x - f.x) < f.r && Math.abs(e.y - f.y) < 9) hitEnemy(e, 2, true, e.x < f.x ? -1 : 1);
      }
      return f.t < f.len + (f.stay || 30);
    });
  }
  function twFallDraw(T, cx, layer) {
    for (const f of T.fall) {
      const sx = f.x - cx, k = Math.min(1, f.t / f.len);
      if (layer === "back") { // shadow telegraph on the floor
        if (f.t < f.len) { ctx.globalAlpha = 0.25 + 0.4 * k; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sx, f.y, f.r * (0.4 + 0.6 * k), f.r * 0.32 * (0.4 + 0.6 * k), 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
          if (f.t % 8 < 4) { ctx.strokeStyle = "#ff4a3a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, f.y, f.r, f.r * 0.32, 0, 0, 6.29); ctx.stroke(); } }
        else if (f.stay) twSpr(T.d, f.spr, sx, f.y + 3, f.k, false, Math.min(1, (f.len + f.stay - f.t) / 20));
      } else if (f.t < f.len) {
        const z = (1 - k * k) * 210;
        if (!twSpr(T.d, f.spr, sx, f.y - z + 3, f.k)) { rect(sx - 6, f.y - z - 10, 12, 10, f.code || "#6a5a4a"); rect(sx - 6, f.y - z - 10, 12, 2, "#9a8a7a"); }
      }
    }
  }
  function twDrip(T, d) {
    if (T.goal || !d.drip || !d.drip.length) return;
    if (twFoes().length >= (d.cap || 3)) return;
    if (--T.spawnT > 0) return;
    T.spawnT = d.gap || 150;
    const type = d.drip[T.di++ % d.drip.length], from = d.from || (T.di % 2 ? "right" : "left");
    const o = { type, from }; if (from === "drop") { o.x = STATE.camX + 50 + Math.random() * (W - 100); o.height = 120; }
    spawnEnemy(o);
  }
  function twBanner(T, msg, col, n) { T.msg = msg; T.msgC = col || "#ffe060"; T.msgT = n || 120; }
  // kinds: init(T, d, S), update(T, d, S, p), draw(T, d, cx, layer), hud(T, d) -> status text
  const TWK = {
    collapse: {
      init(T, d) { T.slots = []; const n = 6; for (let i = 0; i < n; i++) T.slots.push({ x: 40 + i * 54, y: i % 2 ? FLOOR_TOP + 12 : FLOOR_BOT - 14, st: 0, t: 0 }); T.next = 160; T.fallCd = 120; },
      update(T, d, S, p) {
        if (d.mast && T.t === 50) { twBanner(T, d.mastMsg || "TIMBER!", "#ff8a4a", 90); twDrop(T, W / 2, FLOOR_TOP + 6, "mast", { r: 120, len: 80, dmg: 2, k: 0.36, stay: 99999 }); SFX.rumble(); }
        if (--T.next <= 0 && T.slots.some((s) => !s.st)) { const s = T.slots.find((q) => !q.st); s.st = 1; s.t = 0; T.next = d.holeEvery || 230; SFX.rumble(); shake(1, 10, true); }
        for (const s of T.slots) {
          if (s.st) s.t++;
          if (s.st === 1 && s.t > 70) { s.st = 2; SFX.boom(); fx("smoke", s.x, s.y - 4, 20); for (let i = 0; i < 4; i++) fx("spark", s.x + rnd(-14, 14), s.y - rnd(0, 6), 10); }
          if (s.st !== 2) continue;
          if (twCanHurt(p) && p.z === 0 && Math.abs(p.x - s.x) < 20 && Math.abs(p.y - s.y) < 7) { hurtPlayer(2, false, 1); p.x = Math.min(STATE.camX + W - 20, s.x + 36); p.vz = 3; p.z = 1; }
          for (const e of STATE.enemies) if (!e.boss && (e.state === "down" || e.state === "hurt") && e.z < 2 && Math.abs(e.x - s.x) < 18 && Math.abs(e.y - s.y) < 7) { API.koEnemy(e); e.t = 20; fx("smoke", s.x, s.y - 6, 18); }
        }
        if (--T.fallCd <= 0) { T.fallCd = 80 + (Math.random() * 60 | 0); const spr = d.fallSpr[Math.random() * d.fallSpr.length | 0]; twDrop(T, Math.max(STATE.camX + 20, Math.min(STATE.camX + W - 20, p.x + rnd(-50, 50))), clampY(p.y + rnd(-10, 10)), spr, { r: 14, k: d.fallK || 0.4 }); }
      },
      draw(T, d, cx, layer) {
        if (layer !== "back") return;
        for (const s of T.slots) {
          if (!s.st) continue; const sx = s.x - cx;
          if (s.st === 1) { if (!twSpr(d, d.crack || "hole", sx, s.y + 7, 0.2, false, d.crack ? 0.9 : (s.t % 10 < 5 ? 0.35 : 0.15))) { ctx.strokeStyle = "#ff8a3a"; ctx.beginPath(); ctx.moveTo(sx - 16, s.y); ctx.lineTo(sx, s.y - 2); ctx.lineTo(sx + 16, s.y + 1); ctx.stroke(); }
            if (s.t % 10 < 5) light(sx, s.y, 20, "#ff7a2a", 0.4); }
          else if (!twSpr(d, "hole", sx, s.y + 7, 0.2)) { ctx.fillStyle = "#050305"; ctx.beginPath(); ctx.ellipse(sx, s.y, 22, 7, 0, 0, 6.29); ctx.fill(); }
        }
      },
    },
    searchlight: {
      init(T, d) { T.lights = (d.lights || [{}]).map((l, i) => ({ ph: i * 2.1, spd: l.spd || 0.012 + i * 0.004, y: l.y || 52, red: 0 })); T.cd = 0; },
      update(T, d, S, p) {
        T.hidden = (d.covers || []).some((c) => Math.abs(p.x - (STATE.camX + c.x)) < (c.w || 30) / 2 && p.y < FLOOR_TOP + (c.d || 20));
        T.seen = false;
        for (const L of T.lights) {
          L.x = STATE.camX + W / 2 + Math.sin(T.t * L.spd + L.ph) * (W / 2 - 36); if (L.red > 0) L.red--;
          if (p.deadT === 0 && !T.hidden && Math.abs(p.x - L.x) < 30 && Math.abs(p.y - twMid()) < 22) { T.seen = true; if (T.cd <= 0) {
            T.cd = 260; T.spotted++; L.red = 200; SFX.charge(); SFX.zap(); shake(1, 12, true); twBanner(T, "SPOTTED!", "#ff4a3a", 80);
            for (let i = 0; i < (d.alarmN || 2); i++) spawnEnemy({ type: (d.alarm || ["gunner"])[i % (d.alarm || ["gunner"]).length], from: "drop", x: STATE.camX + 60 + Math.random() * (W - 120), height: 130 });
            if (d.volley) for (let i = 0; i < 3; i++) API.shot({ x: L.x + (i - 1) * 16, y: clampY(p.y + (i - 1) * 6), vx: 0, z: 90, vz: -3, arc: true, dmg: 1 }); } }
        }
        if (T.cd > 0) T.cd--;
      },
      draw(T, d, cx, layer) {
        if (layer === "back") {
          for (const c of d.covers || []) twSpr(d, c.spr, c.x, FLOOR_TOP + (c.d || 20) - 6, c.k || 0.4);
          for (const L of T.lights) {
            const sx = L.x - cx, fy = twMid(), red = L.red > 0;
            ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = red ? 0.32 : 0.22;
            ctx.fillStyle = red ? "#ff3a2a" : "#fff2b0"; ctx.beginPath(); ctx.moveTo(sx - 3, L.y); ctx.lineTo(sx + 3, L.y); ctx.lineTo(sx + 32, fy); ctx.lineTo(sx - 32, fy); ctx.fill();
            ctx.globalAlpha = red ? 0.45 : 0.32; ctx.beginPath(); ctx.ellipse(sx, fy, 32, 22, 0, 0, 6.29); ctx.fill(); ctx.restore();
          }
        } else {
          for (const L of T.lights) {
            const sx = L.x - cx;
            if (d.heli) { const bob = Math.sin(T.t * 0.06) * 2; twSpr(d, "heli", sx + 4, L.y + 26 + bob, 0.34); }
            else { if (!twSpr(d, L.red > 0 && d.fr.lampRed ? "lampRed" : "lamp", sx, L.y + 6, 0.36)) rect(sx - 6, L.y - 8, 12, 10, "#3a3a4a"); rect(0, 18, W, 2, "#2a2a34"); }
          }
          if (T.cd > 160 && d.fr && d.fr.klaxon && T.t % 16 < 8) twSpr(d, "klaxon", W - 30, 40, 0.5);
        }
      },
      hud(T) { return (T.hidden ? "HIDDEN" : T.seen ? "SEEN!" : "STAY IN THE SHADOWS") + "  SPOTTED " + T.spotted; },
      done(T) { if (!T.spotted) { STATE.score += 5000; twBanner(T, "GHOST! +5000", "#7fd8ff", 110); } },
    },
    chase: { // a flood crest (or anything) chases you right along a scrolling strip; reach the end
      init(T, d) { T.cx = -40; T.cam = "follow"; },
      update(T, d, S, p) {
        T.cx += T.t < 90 ? 0.3 : d.speed || 1.25;
        T.cx = Math.max(T.cx, STATE.camX - 80); // never too far off screen
        T.camMin = Math.max(0, T.cx - 30);
        if (p.x < STATE.camX + 12) p.x = STATE.camX + 12;
        if (twCanHurt(p) && p.x < T.cx + 18) { hurtPlayer(1, false, 1); p.x = T.cx + 56; p.z = 2; p.vz = 3; fx("smoke", p.x, p.y - 8, 14); }
        if (p.x < T.cx + 18) p.x = T.cx + 30;
        for (const e of STATE.enemies) if (!e.boss && canHitState(e) && e.x < T.cx + 14) { hitEnemy(e, 2, true, 1); e.x = T.cx + 30; }
        if (p.x > LEVEL_W - 50) T.goal = 1;
      },
      draw(T, d, cx, layer) {
        if (layer === "back") {
          if (d.start) twSpr(d, d.start, 30 - cx, FLOOR_TOP + 4, 0.4);
          if (d.end) twSpr(d, d.end, LEVEL_W - 30 - cx, FLOOR_TOP + 6, 0.5);
          for (const r of d.floaters || []) { const x = r.x - cx + Math.sin(T.t * 0.03 + r.x) * 6; if (x > -40 && x < W + 40) twSpr(d, r.spr, x, r.y + Math.sin(T.t * 0.08 + r.x) * 1.5, 0.4); }
          return;
        }
        const sx = T.cx - cx; if (sx < -10) return;
        ctx.save(); ctx.globalAlpha = 0.85; rect(0, FLOOR_TOP - 4, Math.max(0, sx - 40), H, d.color || "#2f7a3a"); ctx.restore();
        if (!twSpr(d, d.crest || "wave", sx - 60, FLOOR_BOT + 10, 0.22)) { rect(sx - 20, FLOOR_TOP - 20, 20, H, d.color || "#3faa4a"); }
        for (let i = 0; i < 6; i++) fx && rect(sx - 4 + Math.sin(T.t * 0.3 + i) * 3, FLOOR_TOP - 10 + i * 12, 3, 3, "#c8ffb0");
      },
      hud(T, d) { return d.hudText || "GET TO HIGHER GROUND!"; },
    },
    run: { // eruptions down a scrolling street under a countdown; reach the end (time out = shockwave + knock back, no fail)
      init(T, d) { T.cam = "follow"; T.er = []; T.cd = 60; T.clock = d.clock || 2700; },
      update(T, d, S, p) {
        if (--T.clock <= 0) { T.clock = d.reclock || 1200; SFX.boom(); shake(6, 30, true); twBanner(T, d.surgeMsg || "SURGE!", "#ff4af0", 90);
          if (p.deadT === 0) { p.inv = 0; hurtPlayer(2, true, -1); p.x = Math.max(40, p.x - 300); } }
        if (--T.cd <= 0) { T.cd = 55 + (Math.random() * 40 | 0); const x = Math.min(LEVEL_W - 30, p.x + rnd(-10, 150)), y = clampY(p.y + rnd(-14, 14)); T.er.push({ x, y, t: 0 }); }
        T.er = T.er.filter((r) => {
          r.t++;
          if (r.t === 50) { SFX.boom(); shake(2, 10, true); fx("smoke", r.x, r.y - 10, 22); for (let i = 0; i < 3; i++) fx("spark", r.x + rnd(-12, 12), r.y - rnd(0, 20), 10);
            if (twCanHurt(p) && Math.abs(p.x - r.x) < 20 && Math.abs(p.y - r.y) < 9 && p.z < 16) hurtPlayer(2, false, p.x < r.x ? -1 : 1);
            for (const e of STATE.enemies) if (!e.boss && canHitState(e) && Math.abs(e.x - r.x) < 20 && Math.abs(e.y - r.y) < 9) hitEnemy(e, 2, true, e.x < r.x ? -1 : 1); }
          if (r.t > 80 && r.t < 300 && p.z === 0 && Math.abs(p.x - r.x) < 18 && Math.abs(p.y - r.y) < 7) p.x -= 0.7; // crater: slow going
          return r.t < 320;
        });
        if (p.x > LEVEL_W - 50) T.goal = 1;
      },
      draw(T, d, cx, layer) {
        for (const r of T.er) {
          const sx = r.x - cx; if (sx < -60 || sx > W + 60) continue;
          if (layer === "back") { if (r.t < 50) { twSpr(d, "mound", sx, r.y + 5, 0.22, false, 0.6 + 0.4 * (r.t % 8 < 4)); light(sx, r.y, 18, "#c050ff", 0.5); } else twSpr(d, "crater", sx, r.y + 6, 0.22, false, Math.min(1, (320 - r.t) / 30)); }
          else if (r.t >= 40 && r.t < 80) { const k = r.t < 50 ? (r.t - 40) / 10 : 1 - (r.t - 50) / 30; twSpr(d, k > 0.6 ? "drillFull" : "drillHalf", sx, r.y + 4, 0.2 * Math.max(0.3, k)); }
        }
        if (layer === "back" && d.end) twSpr(d, d.end, LEVEL_W - 30 - cx, FLOOR_TOP + 6, 0.5);
      },
      hud(T, d) { return (d.hudText || "ESCAPE!") + "  " + Math.ceil(T.clock / 60) + "s"; },
    },
    turret: { // man a gun on the left; shoot the incoming targets out of their lanes
      init(T, d) { T.tg = []; T.sh = []; T.cool = 0; T.cd = 90; T.score = 0; },
      update(T, d, S, p) {
        const gx = STATE.camX + (d.gunX || 56);
        if (p.deadT === 0 && !p.grabbedBy) { p.x += (gx - p.x) * 0.3; p.facing = 1; }
        if (T.cool > 0) T.cool--;
        if ((anyPressed("j") || BTN_A.hit) && T.cool <= 0 && p.deadT === 0) { T.cool = 14; T.sh.push({ x: p.x + 26, y: p.y, z: d.air ? 30 : 12, t: 0 }); SFX.zap(); T.flash = 6; }
        if (T.flash > 0) T.flash--;
        if (--T.cd <= 0 && T.score + T.tg.length < (d.need || 8) + 3) { T.cd = d.every || 80; T.tg.push({ x: STATE.camX + W + 20, y: FLOOR_TOP + 6 + Math.random() * (FLOOR_BOT - FLOOR_TOP - 12), z: d.arc ? 120 : d.air ? 30 : 0, vx: -(d.tspeed || 1.3) - Math.random() * 0.5, t: 0 }); }
        T.sh = T.sh.filter((s) => { s.x += 6; s.t++;
          for (const g of T.tg) if (!g.dead && Math.abs(s.x - g.x) < 16 && Math.abs(s.y - g.y) < 10) { g.dead = 1; T.score++; STATE.score += 300; SFX.boom(); fx("boom", g.x, g.y - g.z - 6, 26); return false; }
          return s.x < STATE.camX + W + 20; });
        T.tg = T.tg.filter((g) => {
          if (g.dead) return false; g.x += g.vx; g.t++;
          if (d.arc) g.z = Math.max(0, 120 * (g.x - gx - 30) / (W - 30));
          if (g.x < gx + 30) { // got through
            if (d.landSpawn) { fx("boom", g.x + 20, g.y - 6, 26); SFX.boom(); shake(2, 10, true); spawnEnemy({ type: d.landSpawn, x: g.x + 30, y: g.y }); }
            else if (twCanHurt(p)) { hurtPlayer(1, false, -1); fx("boom", p.x, p.y - 20, 20); SFX.boom(); }
            return false;
          }
          return true;
        });
        if (T.score >= (d.need || 8)) T.goal = 1;
      },
      draw(T, d, cx, layer) {
        const p = STATE.player, px = p.x - cx;
        if (layer === "back") {
          if (d.base) twSpr(d, d.base, px - 8, p.y + (d.baseDy || 12), d.baseK || 0.42);
          for (const g of T.tg) { const sx = g.x - cx; ctx.globalAlpha = 0.3; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sx, g.y, 10, 3, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
          return;
        }
        if (d.gun) twSpr(d, T.flash > 0 && d.gunFire ? d.gunFire : d.gun, px + 10, p.y + 4, d.gunK || 0.3);
        if (T.flash > 0 && d.spray) twSpr(d, d.spray, px + 40, p.y - 6, 0.3);
        for (const s of T.sh) { const sx = s.x - cx; if (!twSpr(d, d.shell || "", sx, s.y - s.z + 4, 0.4)) { rect(sx - 4, s.y - s.z - 2, 8, 3, d.shotC || "#bfefff"); rect(sx - 8, s.y - s.z - 1, 4, 1, "#ffffff"); } }
        for (const g of T.tg) { const sx = g.x - cx, y = g.y - g.z;
          if (!twSpr(d, d.target || "", sx, y + 4, d.targetK || 0.3)) { rect(sx - 8, y - 14, 16, 8, "#4a4c5a"); rect(sx - 10, y - 16, 20, 1, "#c8ccd6"); rect(sx - 2, y - 10, 4, 3, T.t % 10 < 5 ? "#ff3a2a" : "#7a1a10"); light(sx, y - 10, 10, "#ff3a2a", 0.4); } }
      },
      hud(T, d) { return (d.hudText || "TARGETS") + " " + T.score + "/" + (d.need || 8) + "  -  ATTACK TO FIRE"; },
    },
    ride: { // a vehicle on an auto-scrolling backdrop; boarders arrive by side vehicles
      init(T, d) { T.pass = 0; T.car = null; T.ski = []; T.cd = 120; T.hits = 0; },
      update(T, d, S, p) {
        if (d.car) { // armoured car alongside: hit its shield 3x, twice
          if (!T.car && T.pass < 2 && T.t > 60) { T.car = { x: W + 140, hits: 0, t: 0 }; twBanner(T, d.carMsg || "HERE THEY COME!", "#ffb04a", 80);
            T.tg = API.registerTarget({ x: STATE.camX + W + 140, y: FLOOR_TOP + 2, w: 46, h: 30, d: 8, onHit: () => { if (!T.car || T.car.out) return false; T.car.hits++; SFX.clink(); fx("spark", T.car.x, FLOOR_TOP - 12, 10); if (T.car.hits >= 3) { T.car.out = 1; SFX.boom(); shake(4, 20, true); STATE.score += 2000; } return false; } }); }
          const c = T.car;
          if (c) { c.t++; if (!c.out) { c.x += (W - 110 - c.x) * 0.03; if (c.t % 200 === 100 && twFoes().length < 4) for (let i = 0; i < 2; i++) spawnEnemy({ type: d.drip[(T.di++) % d.drip.length], from: "drop", x: STATE.camX + c.x - 20 + i * 30, height: 60 }); }
            else { c.x += 4; if (c.x > W + 200) { T.car = null; T.pass++; if (T.tg) T.tg.remove(); } }
            if (T.tg && !T.tg.dead) T.tg.x = STATE.camX + c.x; }
          if (T.pass >= 2) T.goal = 1;
        } else {
          if (--T.cd <= 0 && twFoes().length < (d.cap || 3) && !T.goal) { T.cd = d.gap || 170; T.ski.push({ x: W + 60, y: FLOOR_BOT + 6, t: 0, drop: 0 }); }
          T.ski = T.ski.filter((s) => { s.x -= 3.2; s.t++; if (!s.drop && s.x < W * 0.7) { s.drop = 1; spawnEnemy({ type: d.drip[(T.di++) % d.drip.length], from: "drop", x: STATE.camX + s.x, y: FLOOR_BOT - 4, height: 50 }); SFX.jump(); } return s.x > -80; });
        }
      },
      draw(T, d, cx, layer) {
        if (layer === "back") {
          if (d.deck) twSpr(d, d.deck, W / 2, H + 6, d.deckK || 0.56);
          if (d.cartA) { const f = Math.floor(T.t / 18) % 2 ? d.cartA : d.cartB || d.cartA; if (d.track) for (let i = -1; i < 3; i++) twSpr(d, d.track, ((i * 230 - (STATE.scroll || 0) * 1) % 230 + 230) % 230 - 115 + i * 0, H + 4, 0.5); twSpr(d, f, W / 2 - 10, H + 2, 0.56); }
          if (T.car) twSpr(d, d.car, T.car.x, FLOOR_TOP + 10, 0.36, false, T.car.out ? 0.8 : 1);
          if (d.buoy) { const bx = (W + 80) - ((T.t * 2.4) % (W + 200)); twSpr(d, d.buoy, bx, FLOOR_TOP - 8, 0.3); }
          return;
        }
        for (const s of T.ski) { if (d.wake) twSpr(d, d.wake, s.x + 70, s.y + 4, 0.18, false, 0.8); twSpr(d, d.ski, s.x, s.y + 4, 0.4, true); }
        if (d.bow && T.t % 40 < 20) twSpr(d, d.bow, W - 20, FLOOR_BOT + 6, 0.4, false, 0.7);
      },
      hud(T, d) { return d.car ? (d.hudText || "KNOCK THEIR CAR OFF THE RAILS") + " " + Math.min(2, T.pass) + "/2" + (T.car && !T.car.out ? "  HITS " + T.car.hits + "/3" : "") : d.hudText || "HOLD THE DECK!"; },
    },
    ice: { // thin ice plates crack under anyone who lingers; push on to the far side
      init(T, d) { T.cam = "follow"; T.pl = []; for (let x = 120; x < LEVEL_W - 80; x += 64) for (let j = 0; j < 2; j++) T.pl.push({ x: x + (j ? 32 : 0), y: j ? FLOOR_BOT - 12 : FLOOR_TOP + 14, st: 0, on: 0, t: 0 }); T.cd = 150; },
      update(T, d, S, p) {
        for (const q of T.pl) {
          const onP = p.deadT === 0 && p.z === 0 && Math.abs(p.x - q.x) < 22 && Math.abs(p.y - q.y) < 9;
          if (q.st < 3) { if (onP) { if (++q.on > 40) { q.on = 0; q.st++; SFX.clink(); fx("spark", q.x, q.y - 2, 8); if (q.st === 3) { q.t = 0; SFX.boom(); } } } else q.on = Math.max(0, q.on - 1); }
          else { q.t++;
            if (onP && twCanHurt(p)) { hurtPlayer(2, false, 1); API.freezePlayer(36); p.x = q.x + 34; fx("smoke", q.x, q.y - 4, 16); }
            for (const e of STATE.enemies) if (!e.boss && (e.state === "down" || e.state === "hurt") && e.z < 2 && Math.abs(e.x - q.x) < 18 && Math.abs(e.y - q.y) < 7) { API.koEnemy(e); e.t = 20; fx("smoke", q.x, q.y - 6, 18); }
            if (q.t > 420) { q.st = 1; q.on = 0; } }
        }
        if (--T.cd <= 0 && d.slide) { T.cd = 140 + (Math.random() * 80 | 0); twDrop(T, Math.min(LEVEL_W - 20, p.x + rnd(-30, 80)), clampY(FLOOR_TOP + 6 + Math.random() * 10), d.slide, { r: 18, k: 0.22 }); }
        if (p.x > LEVEL_W - 50) T.goal = 1;
      },
      draw(T, d, cx, layer) {
        if (layer !== "back") return;
        for (const q of T.pl) { const sx = q.x - cx; if (sx < -50 || sx > W + 50) continue; twSpr(d, "ice" + q.st, sx, q.y + 8, 0.26, false, 0.95); }
        if (d.post) { twSpr(d, d.post, 60 - cx, FLOOR_TOP + 4, 0.4); twSpr(d, d.post, LEVEL_W - 40 - cx, FLOOR_TOP + 4, 0.4); }
      },
      hud(T, d) { return d.hudText || "THIN ICE! KEEP MOVING"; },
    },
    elevator: { // a lift plunges down a shaft: enemies drop in from above, junk falls past; the brakes bite halfway
      init(T, d) { T.y = 0; T.v = 3.4; T.cd = 110; },
      update(T, d, S, p) {
        const half = Math.floor((d.len || 2400) / 2);
        if (T.t === half) { twBanner(T, d.brakeMsg || "BRAKES!", "#ffb04a", 80); SFX.clink(); SFX.boom(); shake(5, 30, true); API.stunPlayer(22); for (const e of twFoes()) if (canHitState(e)) { e.state = "hurt"; e.t = 0; } T.v = 0.6; }
        if (T.t > half + 60) T.v = Math.min(3.4, T.v + 0.04);
        if (T.goal && !T.landed) { T.landed = 1; SFX.boom(); shake(7, 36, true); T.v = 0; for (let i = 0; i < 8; i++) fx("smoke", rnd(0, W), FLOOR_BOT - rnd(0, 20), 26); }
        T.y += T.v;
        if (--T.cd <= 0 && d.junk && !T.goal) { T.cd = 90 + (Math.random() * 70 | 0); twDrop(T, STATE.camX + Math.max(24, Math.min(W - 24, p.x - STATE.camX + rnd(-50, 50))), clampY(p.y + rnd(-8, 8)), d.junk[Math.random() * d.junk.length | 0], { r: 15, k: 0.3 }); }
      },
      draw(T, d, cx, layer) {
        if (layer === "back") {
          const im = d.shaft ? lvImg(d.shaft) : null;
          if (im) { const th = Math.round(im.naturalHeight * W / im.naturalWidth), off = ((T.y % th) + th) % th; ctx.save(); ctx.imageSmoothingEnabled = true; for (let y = -off; y < H; y += th) ctx.drawImage(im, 0, Math.round(y), W, th); ctx.restore(); }
          if (T.v > 1) { ctx.globalAlpha = 0.25; for (let i = 0; i < 12; i++) { const x = hash(i) * W, y = (hash(i + 5) * H - T.y * 3) % H; rect(x, (y + H) % H, 1, 18, "#fff"); } ctx.globalAlpha = 1; }
          if (d.lift) twSpr(d, d.lift, W / 2, H + 4, W / (d.fr[d.lift][2] || 600));
          if (T.t > (d.len || 2400) / 2 - 2 && T.t < (d.len || 2400) / 2 + 60 && d.brake) { twSpr(d, d.brake, 18, FLOOR_TOP - 10, 0.4); twSpr(d, d.brake, W - 18, FLOOR_TOP - 10, 0.4, true); if (T.t % 4 < 2) { fx("spark", STATE.camX + 14, FLOOR_TOP - 20, 8); fx("spark", STATE.camX + W - 14, FLOOR_TOP - 20, 8); } }
        }
      },
      hud(T, d) { return d.hudText || "GOING DOWN!"; },
    },
    miniboss: {
      init(T, d) {},
      update(T, d, S, p) {
        if (T.t === 40 && !T.boss) { T.boss = spawnBoss(Object.assign({}, d.boss, { onDefeat: (api, e) => { T.goal = 1; STATE.ramrodOn = false; if (d.boss.onDefeat) d.boss.onDefeat(api, e); } })); T.boss.mid = true; }
        const b = T.boss;
        if (b && !T.sum && b.hp > 0 && b.hp <= b.maxHp / 2) { T.sum = 1; for (const t of d.summon || []) spawnEnemy({ type: t, from: "drop", height: 110 }); if (b.cfg.lines && b.cfg.lines.summon) enemySay(b, b.cfg.lines.summon, 100, b.cfg.pitch || 90, true); }
      },
      draw() {},
      hud(T, d) { return ""; },
    },
    defend: { // keep the ally alive while it works; enemies go for it
      init(T, d) { T.prog = 0; T.bot = { x: STATE.camX + (d.botX || 250), y: FLOOR_TOP + 14, hp: d.botHp || 10, hurt: 0, down: 0 }; },
      update(T, d, S, p) {
        const B = T.bot;
        if (B.down > 0) { if (--B.down === 0) { B.hp = d.botHp || 10; twBanner(T, "REBOOTED!", "#7fd8ff", 60); } }
        else if (B.hurt > 0) B.hurt--;
        else if (!T.goal) T.prog += 1 / (d.work || 2400);
        for (const e of twFoes()) {
          if (e.state !== "walk" || e.boss) continue;
          if ((e.tgBot === undefined ? (e.tgBot = Math.random() < 0.6) : e.tgBot) && B.down === 0) {
            const dx = B.x - e.x, dy = B.y - e.y;
            if (Math.abs(dx) > 16) e.x += Math.sign(dx) * 0.7; if (Math.abs(dy) > 3) e.y += Math.sign(dy) * 0.4;
            e.facing = dx >= 0 ? 1 : -1;
            if (Math.abs(dx) < 20 && Math.abs(dy) < 8 && (e.botCd = (e.botCd || 0) - 1) <= 0) { e.botCd = 45; B.hp--; B.hurt = 40; SFX.clink(); fx("spark", B.x, B.y - 20, 10);
              if (B.hp <= 0) { B.down = 360; T.prog = Math.max(0, T.prog - 0.25); SFX.boom(); twBanner(T, "BOT DOWN! -25%", "#ff4a3a", 90); } }
          }
        }
        if (T.prog >= 1 && !T.goal) { T.goal = 1; SFX.confirm(); twBanner(T, d.okMsg || "GATE OPEN!", "#7fd85a", 100); }
      },
      draw(T, d, cx, layer) {
        if (layer !== "back") return;
        const B = T.bot, sx = B.x - cx;
        if (d.gateSpr) twSpr(d, T.goal && d.gateOpen ? d.gateOpen : d.gateSpr, sx + 44, FLOOR_TOP + 4, 0.42);
        const f = T.goal ? d.cheer : B.down || B.hurt ? d.hurt : d.hack;
        ctx.save(); if (B.down) ctx.globalAlpha = 0.5;
        twSpr(d, f, sx, B.y + 2 + Math.sin(T.t * 0.08) * 2 - 8, 0.42); ctx.restore();
        if (!B.down && !B.hurt && !T.goal) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(90,230,255,0.8)"; ctx.beginPath(); ctx.moveTo(sx + 8, B.y - 26); ctx.lineTo(sx + 38, B.y - 40 + Math.sin(T.t * 0.5) * 4); ctx.stroke(); ctx.restore(); light(sx + 30, B.y - 34, 18, "#5ae0ff", 0.5); }
        const hw = 30; rect(sx - hw / 2, B.y - 58, hw, 4, "#401010"); rect(sx - hw / 2, B.y - 58, Math.round(hw * Math.max(0, B.hp) / (d.botHp || 10)), 4, B.down ? "#666" : "#5ae0ff");
      },
      hud(T, d) { return (d.hudText || "HACK") + " " + Math.min(100, Math.floor(T.prog * 100)) + "%" + (T.bot.down ? "  REBOOTING..." : ""); },
    },
    freefall: { // overlay (gate: false): the cable snaps mid-climb, the car plunges, the brakes catch, back up to the top
      init(T, d) { T.ev = 0; T.evT = 0; },
      update(T, d, S, p) {
        if (!T.ev && T.t >= (d.at || 900)) { T.ev = 1; T.evT = 0; twBanner(T, d.snapMsg || "THE CABLE SNAPPED!", "#ff4a3a", 110); SFX.boom(); SFX.clink(); shake(6, 30, true); }
        if (T.ev === 1) { T.evT++;
          if (T.evT === 60 || T.evT === 200) { twDrop(T, STATE.camX + (T.evT === 60 ? W * 0.3 : W * 0.7), clampY(p.y), d.weight, { r: 22, k: 0.3, len: 70 }); }
          if (T.evT === 300) { SFX.clink(); SFX.boom(); shake(5, 26, true); API.stunPlayer(18); twBanner(T, d.brakeMsg || "BRAKES HOLD!", "#ffb04a", 80); }
          if (T.evT > 420) { T.ev = 2; SFX.confirm(); twBanner(T, d.dingMsg || "DING! BACK ON TRACK", "#7fd85a", 80); }
        }
      },
      draw(T, d, cx, layer) {
        if (T.ev !== 1) return;
        if (layer === "back") { ctx.globalAlpha = 0.35; for (let i = 0; i < 14; i++) { const x = hash(i) * W, y = H - ((hash(i + 3) * H + T.evT * 9) % H); rect(x, y, 1, 22, "#ffffff"); } ctx.globalAlpha = 1;
          if (T.evT < 80) twSpr(d, d.cable, 30, -40 + T.evT * 6, 0.4);
          if (T.evT > 300 && T.evT < 360) { twSpr(d, d.brake, 24, FLOOR_TOP, 0.24); twSpr(d, d.brake, W - 24, FLOOR_TOP, 0.24, true); }
          return; }
        if (T.evT % 20 < 10) { ctx.globalAlpha = 0.18; rect(0, 0, W, H, "#ff1a1a"); ctx.globalAlpha = 1; twSpr(d, d.elight, W / 2, 26, 0.5); }
      },
      hud() { return ""; },
    },
  };
  const TW_HAZ = { drawBack(st, api, cx) { twDraw("back", cx); }, drawFront(st, api, cx) { twDraw("front", cx); } };
  function twState(S) {
    let T = STATE.tw;
    if (!T || T.sec !== STATE.sec || T.lv !== STATE.level || T.S !== S) {
      const d = S.twist;
      T = STATE.tw = { d, S, sec: STATE.sec, lv: STATE.level, t: 0, left: d.len || 2400, goal: 0, done: 0, outT: 0, spawnT: d.first || 100, di: 0, spotted: 0, fall: [], msg: null, msgT: 0, cam: "fixed", camMin: 0 };
      const K = TWK[d.kind]; if (K && K.init) safe(() => K.init(T, d, S));
      if (d.title) twBanner(T, d.title, d.color || "#ffe060", 150);
      for (const e of STATE.enemies) if (!e.boss) e.hp = Math.min(e.hp, e.hp); // (no carry-over handling needed: sections start empty)
    }
    return T;
  }
  function twGate(p, S) { // true while the twist owns this section (skips the engine's wave / lock / exit logic)
    const T = twState(S), d = T.d, K = TWK[d.kind] || {};
    T.t++; if (T.msgT > 0) T.msgT--;
    if (d.gate === false) { if (K.update) safe(() => K.update(T, d, S, p)); twFallStep(T, p); return false; }
    if (S.auto) STATE.scroll += S.auto;
    if (T.cam === "follow") { STATE.locked = false; STATE.camX = Math.max(T.camMin || 0, Math.min(LEVEL_W - W, p.x - W / 2, STATE.camX + 3)); STATE.camX = Math.max(STATE.camX, T.camMin || 0); }
    else { STATE.locked = true; STATE.camX = Math.max(0, Math.min(LEVEL_W - W, d.camX || 0)); }
    if (!T.done) {
      if (K.update) safe(() => K.update(T, d, S, p));
      twDrip(T, d);
      const goal = d.goal || "time";
      if (goal === "time") { if (--T.left <= 0) T.goal = 1; }
      if (T.goal) {
        T.goalT = (T.goalT || 0) + 1;
        if (T.goalT === 360) for (const e of twFoes()) { e.hp = 0; e.state = "dying"; e.t = 0; }
        if (!twFoes().length && !STATE.enemies.some((e) => e.boss && e.state !== "dying" && !e.gone)) { T.done = 1; SFX.pickup(); STATE.score += 1000; if (K.done) safe(() => K.done(T, d)); if (!T.msgT || T.msgC !== "#7fd8ff") twBanner(T, d.clearMsg || "TWIST CLEAR!", "#7fd85a", 80); }
      }
    } else if (++T.outT >= 80 && p.deadT === 0 && !STATE.fadeOut) STATE.fadeOut = 1;
    twFallStep(T, p);
    if (T.d.kind === "chase" || T.cam === "follow") STATE.goT = 0;
    return true;
  }
  function twDraw(layer, cx) {
    const T = STATE.tw, S = curSec(); if (!T || !S || T.S !== S) return;
    const K = TWK[T.d.kind]; if (K && K.draw) safe(() => K.draw(T, T.d, cx, layer));
    twFallDraw(T, cx, layer);
  }
  function twHUD() {
    const T = STATE.tw, S = STATE.section === "L" ? curSec() : null; if (!T || !S || T.S !== S) return;
    const d = T.d, K = TWK[d.kind] || {};
    let line = K.hud ? safe(() => K.hud(T, d), "") : "";
    if (d.gate !== false && (d.goal || "time") === "time" && !T.goal) line = (line ? line + "  " : "") + Math.ceil(T.left / 60) + "s";
    if (line && !T.done && d.gate !== false) { ctx.globalAlpha = 0.6; rect(W / 2 - 110, 51, 220, 11, "#05040a"); ctx.globalAlpha = 1; ptext(line, W / 2, 56, 1, d.color || "#ffe060"); }
    if (T.msgT > 0 && T.msg) {
      const k = Math.min(1, T.msgT / 15, (T.t < 20 ? T.t / 10 : 1));
      ctx.globalAlpha = 0.65 * k; rect(0, 74, W, d.sub && T.t < 160 ? 34 : 24, "#05040a"); ctx.globalAlpha = k;
      ptext(T.msg, W / 2, 86, 2, T.msgC || "#ffe060");
      if (d.sub && T.t < 160 && T.msg === d.title) ptext(d.sub, W / 2, 101, 1, "#ffffff");
      ctx.globalAlpha = 1;
    }
  }
  // ---- Level 1 (built in) restructure: hallway (zone 1) -> collapse twist -> lobby (zone 2) -> apartment (section B arena) ----
  const L1X = { number: 1, name: "HALLWAY FIRE", cont: true, music: "stage", bossMusic: "boss", hazards: [], hues: {}, card: {},
    images: ["l1_twist.png", "l1_lobby.jpg", "hallway.jpg"],
    sections: [
      { seg: "twist", bg: "hallway.jpg", bgMirror: true, floor: [150, 215], length: W, locks: [], waves: [], weather: "embers", hazards: [],
        twist: { kind: "collapse", title: "THE FLOOR IS GIVING WAY!", sub: "WATCH THE CRACKS - DODGE THE FALLING BEAMS", len: 2100, img: "l1_twist.png",
          fr: { hole: [0, 0, 240, 127], crack: [243, 0, 240, 102], beam: [486, 0, 220, 45], debris: [0, 130, 140, 90], door: [143, 130, 123, 220] },
          crack: "crack", fallSpr: ["beam", "debris"], fallK: 0.3, drip: ["dasher", "star", "purple"], gap: 170, cap: 3, color: "#ff8a3a", clearMsg: "THE FLOOR DROPS AWAY!" } },
      { seg: "zone2", bg: "l1_lobby.jpg", floor: [150, 215], length: 1300, locks: [0, 620], waves: [["sword", "dasher", "blue", "purple"], ["heavy", "gunner", "star", "dasher", "purple"]], weather: "embers", hazards: [],
        drawBack(api, cx) { const x = 1300 - 36 - cx; if (x > -60 && x < W + 60) twSpr(L1X.sections[0].twist, "door", x, 152, 0.42); } },
    ] };
  L1X.sections = L1X.sections.map((s) => normSection(s, L1X));
  function startL1X() { // arcade only: called when the hallway's door fade ends
    preloadImages(L1X); STATE.section = "L"; STATE.l1x = true; enterSection(0, false);
  }

