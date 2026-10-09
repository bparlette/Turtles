// Level 14: TECHNODROME PORTAL. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Section 1: a Manhattan street under the war machine. Fortress modules rip loose from the Technodrome and fall
// (shadow telegraph), then lie in the street as temporary cover / platforms before phasing back out. Laser turret
// drones hover in at the screen edge, lock onto a lane and fire a beam along it (modules block it).
// Section 2: the plaza under the half-materialised Technodrome. Boss: KRANG in his android body. Armoured body;
// the brain window in his belly glows when he is open (after a stomp, while a fist is out, after the eye laser,
// while he summons). Stomp shockwave, fist rocket, eye laser sweep, mouser swarms, phase 2 module salvo.
// Outro: Krang's brain flees into the Technodrome, Shredder appears in the hatch and retreats to his tower.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level14_portal.jpg", BG2 = "levels/level14_technodrome.jpg";
  let G = null; // all module state for the current section (reset on section entry / onStart, cleared on unload)
  const fresh = () => ({ mods: [], modCd: 200, turrets: [], turCd: 260, mousers: [], rings: [], laser: null, scorch: [], bolts: [], boltCd: 120,
    lastHp: -1, told: false, toldGlow: 0, wreck: null, salvo: 0 });

  // ---- Music: original D-minor invasion march (148 BPM) + a re-keyed, faster boss track ----
  const CH = ["Dm", "Dm", "F", "C", "Dm", "Dm", "Am", "E", "Dm", "F", "C", "G", "Dm", "Am", "E", "E"];
  const music = A.track({ bpm: 148, loop: true, chords: CH,
    lead: ["D5:3 .:1 D5:2 F5:2 A5:4 G5:2 F5:2", "E5:2 D5:2 C5:4 A4:4 .:4", "F5:2 A5:2 C6:4 A5:2 G5:2 F5:4", "E5:3 .:1 G5:2 E5:2 C5:4 .:4",
      "D5:3 .:1 D5:2 F5:2 A5:4 D6:4", "C6:2 A5:2 F5:2 A5:2 D5:4 .:4", "E5:2 A5:2 C6:4 B5:2 A5:2 E5:4", "G#5:4 B5:4 E6:4 .:4",
      "A5:3 .:1 A5:2 D6:2 F6:4 E6:2 D6:2", "C6:2 A5:2 F5:4 A5:2 C6:2 F6:4", "E6:2 D6:2 C6:2 G5:2 E5:4 G5:4", "D6:2 B5:2 G5:4 B5:2 D6:2 G6:4",
      "F6:3 .:1 E6:2 D6:2 A5:4 D6:4", "C6:2 E6:2 A6:4 G6:2 E6:2 C6:4", "B5:4 G#5:4 E5:4 B4:4", "E5:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 10]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k.hhs.hkk.hks.hh", 15).concat(["k.s.s.sss.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, 2, 180);

  // ---- helpers ----
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const boss = () => A.enemies.find((e) => e.boss);
  const blink = (t, n) => Math.floor(t / (n || 6)) % 2 === 1;
  function zig(c, x0, y0, x1, y1, n, amp) { c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i < n; i++) { const k = i / n; c.lineTo(x0 + (x1 - x0) * k + A.rnd(-amp, amp), y0 + (y1 - y0) * k + A.rnd(-amp, amp)); } c.lineTo(x1, y1); c.stroke(); }

  // ================= FALLING FORTRESS MODULES (both sections) =================
  // fall: shadow grows on the floor for FALL frames (the last 18 the module is visible dropping out of the portal),
  // crash (2 dmg + knockdown, wrecks enemies), then REST as a solid block: cover vs shots/lasers and a platform you can
  // jump onto (standing on it is safe from floor shockwaves), flickers for the last 60 frames and phases out.
  const MW = 15, MD = 7, MH = 15, FALL = 66, REST = 430;
  function modAt(x, y, pad) { return G.mods.find((m) => m.st !== "fall" && Math.abs(m.x - x) < MW + (pad || 0) && Math.abs(m.y - y) < MD + (pad || 0)); }
  function dropModule(api, x, y, fall) {
    x = Math.max(api.camX + 24, Math.min(api.camX + api.W - 24, x)); y = Math.max(api.floorTop + MD, Math.min(api.floorBot - 2, y));
    if (G.mods.some((m) => Math.abs(m.x - x) < MW * 2 + 6 && Math.abs(m.y - y) < MD * 2 + 4)) return false;
    G.mods.push({ x, y, st: "fall", t: 0, fall: fall || FALL, seed: Math.random() * 99 | 0, flip: Math.random() < 0.5 ? -1 : 1 });
    if (G.mods.length === 1 || Math.random() < 0.5) api.SFX.charge();
    return true;
  }
  function crushModule(api, m) { m.st = "dead"; api.SFX.boom(); api.fx("boom", m.x, m.y - 10, 26); api.fx("smoke", m.x, m.y - 8, 24); api.dust(m.x, m.y); }
  function updateModules(api, p) {
    for (const m of G.mods) {
      m.t++;
      if (m.st === "fall") {
        if (m.t === m.fall) { // crash
          m.st = "rest"; m.t = 0; api.SFX.boom(); api.shake(3, 10, true); api.STATE.shake = Math.max(api.STATE.shake, 6);
          api.dust(m.x - 10, m.y); api.dust(m.x + 10, m.y); api.fx("smoke", m.x, m.y - 6, 22);
          if (canHurt(p) && Math.abs(p.x - m.x) < MW + 5 && Math.abs(p.y - m.y) < MD + 5 && p.z < MH + 24) api.hurtPlayer(2, false, p.x < m.x ? -1 : 1);
          for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - m.x) < MW + 5 && Math.abs(e.y - m.y) < MD + 5) api.hitEnemy(e, 3, true, e.x < m.x ? -1 : 1);
          for (const q of G.mousers) if (Math.abs(q.x - m.x) < MW + 4 && Math.abs(q.y - m.y) < MD + 4) killMouser(api, q);
        }
        continue;
      }
      if (m.st !== "rest") continue;
      if (m.t >= REST) { m.st = "dead"; api.fx("smoke", m.x, m.y - 10, 20); api.SFX.zap(); continue; }
      // the player: platform from above, solid from the side
      if (p.deadT === 0 && !(p.sinkT > 0)) {
        const dx = p.x - m.x, dy = p.y - m.y;
        if (Math.abs(dx) < MW + 2 && Math.abs(dy) < MD + 1 && p.z >= MH - 5 && p.vz <= 0) { p.z = MH; p.vz = 0; m.perch = 1; }
        else if (Math.abs(dx) < MW + 5 && Math.abs(dy) < MD + 2 && p.z < MH - 5) {
          const px = MW + 5 - Math.abs(dx), py = (MD + 2 - Math.abs(dy)) * 1.6;
          if (px < py) p.x += (dx < 0 ? -1 : 1) * px; else p.y += (dy < 0 ? -1 : 1) * (MD + 2 - Math.abs(dy));
          p.y = Math.max(api.floorTop, Math.min(api.floorBot, p.y));
          if (api.STATE.locked) p.x = Math.max(api.camX + 12, Math.min(api.camX + api.W - 12, p.x));
        }
      }
      for (const e of api.enemies) {
        if (e.boss) { if (e.state !== "dying" && e.z < MH && Math.abs(e.x - m.x) < MW + 12 && Math.abs(e.y - m.y) < MD + 4) { crushModule(api, m); break; } continue; }
        if (!["walk", "attack", "hurt"].includes(e.state) || e.z > MH - 4) continue;
        const dx = e.x - m.x, dy = e.y - m.y;
        if (Math.abs(dx) < MW + 5 && Math.abs(dy) < MD + 2) { if (MW + 5 - Math.abs(dx) < (MD + 2 - Math.abs(dy)) * 1.6) e.x = m.x + (dx < 0 ? -1 : 1) * (MW + 5); else e.y = Math.max(api.floorTop, Math.min(api.floorBot, m.y + (dy < 0 ? -1 : 1) * (MD + 2))); }
      }
      // cover: enemy shots that reach a module are stopped
      api.STATE.stars = api.STATE.stars.filter((s) => {
        if (s.update) return true;
        if (Math.abs(s.x - m.x) < MW && Math.abs(s.y - m.y) < MD + 2 && (!s.arc || s.z < MH)) { api.fx(s.arc ? "smoke" : "clink", s.x, s.y - (s.arc ? s.z : 12), 12); if (!s.arc) api.SFX.clink(); return false; }
        return true;
      });
    }
    G.mods = G.mods.filter((m) => m.st !== "dead");
  }
  function drawModuleBody(api, c, m, x, by, alpha) { // x = screen centre, by = screen y of the front-bottom edge
    const top = by - 2 * MD - MH, s = m.seed;
    c.save(); c.globalAlpha = alpha;
    // top face
    c.fillStyle = "#5c5a66"; c.fillRect(x - MW, top, MW * 2, MD * 2);
    c.fillStyle = "#77758a"; c.fillRect(x - MW, top, MW * 2, 2);
    c.strokeStyle = "#2a2832"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - MW + 9 + (s % 5), top); c.lineTo(x - MW + 13 + (s % 5), top + MD * 2); c.moveTo(x + 4 + (s % 4), top); c.lineTo(x + 1 + (s % 4), top + MD * 2); c.stroke();
    // front face
    const g = c.createLinearGradient(0, by - MH, 0, by); g.addColorStop(0, "#4a4854"); g.addColorStop(1, "#24222c");
    c.fillStyle = g; c.fillRect(x - MW, by - MH, MW * 2, MH);
    c.strokeStyle = "#141218"; c.lineWidth = 1; c.strokeRect(x - MW + 0.5, top + 0.5, MW * 2 - 1, by - top - 1);
    // armour plate seams glowing violet (Technodrome hull)
    c.strokeStyle = api.t % 40 < 20 ? "#c46aff" : "#a24ae8"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - MW + 2, by - MH + 4); c.lineTo(x - 4 * m.flip, by - MH + 4); c.lineTo(x - 1 * m.flip, by - 2); c.moveTo(x + MW - 2, by - MH + 7); c.lineTo(x + 6 * m.flip, by - MH + 7); c.stroke();
    for (const [rx, ry] of [[-MW + 3, -MH + 2], [MW - 4, -MH + 2], [-MW + 3, -3], [MW - 4, -3]]) { c.fillStyle = "#8a8898"; c.fillRect(x + rx, by + ry, 1.2, 1.2); }
    // torn edge + dangling cable
    c.fillStyle = "#14121a"; const ex = x + m.flip * MW;
    c.beginPath(); c.moveTo(ex, top + 2); c.lineTo(ex - m.flip * 4, top + 7); c.lineTo(ex, top + 11); c.lineTo(ex - m.flip * 3, by - 6); c.lineTo(ex, by - 2); c.closePath(); c.fill();
    c.strokeStyle = "#2a1838"; c.lineWidth = 1; c.beginPath(); c.moveTo(ex - m.flip * 2, top + 9); c.quadraticCurveTo(ex + m.flip * 5, top + 14, ex + m.flip * 3, by - 3); c.stroke();
    if ((api.t + s) % 50 < 4) { c.fillStyle = "#fff6c0"; c.fillRect(ex + m.flip * 3, by - 4, 1.5, 1.5); c.fillStyle = "#ffcf5a"; c.fillRect(ex + m.flip * 5, by - 6, 1, 1); }
    c.restore();
  }
  function drawModulesBack(api, cx) {
    const c = api.ctx;
    for (const m of G.mods) {
      const x = m.x - cx; if (x < -40 || x > api.W + 40) continue;
      if (m.st === "fall") {
        const k = m.t / m.fall, r = 4 + k * (MW + 2);
        c.save(); c.globalAlpha = 0.25 + 0.5 * k; c.fillStyle = "#08040e"; c.beginPath(); c.ellipse(x, m.y, r, r * 0.42, 0, 0, 6.29); c.fill();
        c.globalAlpha = 0.5; c.strokeStyle = k > 0.7 && blink(m.t, 3) ? "#ffe060" : "#ff3a6a"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, m.y, MW + 3, (MW + 3) * 0.42, 0, 0, 6.29); c.stroke(); c.restore();
        if (blink(m.t)) api.ptext("!", x, m.y - 22, 2, "#ffe060");
        continue;
      }
      const fade = m.t > REST - 60 ? (blink(m.t, 3) ? 0.35 : 0.85) : 1;
      api.contactShadow(x, m.y + MD - 1, 0, MW + 2);
      drawModuleBody(api, c, m, x, m.y + MD, fade);
      if (m.t > REST - 60) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35; c.fillStyle = "#b45aff"; for (let i = 0; i < 6; i++) c.fillRect(x - MW, m.y + MD - 2 * MD - MH + i * 5 + (api.t % 5), MW * 2, 1); c.restore(); }
      if (m.t < 8) { c.save(); c.globalAlpha = 1 - m.t / 8; api.rect(x - MW - 4, m.y + MD - 2 * MD - MH - 2, MW * 2 + 8, 2 * MD + MH + 4, "#ffffff"); c.restore(); }
    }
  }
  function drawModulesFront(api, cx) {
    const c = api.ctx, p = api.player;
    for (const m of G.mods) {
      const x = m.x - cx; if (x < -40 || x > api.W + 40) continue;
      if (m.st === "fall") { // the module drops out of the sky during the last 18 frames
        const left = m.fall - m.t; if (left > 18) continue;
        const z = left * left * 0.62;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.fillStyle = "#b45aff"; c.fillRect(x - 5, m.y - z - 60, 10, 50); c.restore();
        drawModuleBody(api, c, m, x, m.y + MD - z, 1);
        continue;
      }
      // redraw over actors standing behind the block (depth fix: everything drawBack draws is under every actor)
      const behind = (a) => a && a.y < m.y - MD + 1 && Math.abs(a.x - m.x) < MW + 14 && (a.z || 0) < MH;
      if (behind(p) || api.enemies.some(behind) || G.mousers.some(behind)) drawModuleBody(api, c, m, x, m.y + MD, m.t > REST - 60 ? (blink(m.t, 3) ? 0.35 : 0.85) : 1);
    }
  }

  // ================= LASER TURRET DRONES (section 1) =================
  // fly in at a screen edge -> AIM (tracks your lane, dotted red line, "!") -> LOCK -> FIRE a beam along that lane
  // (jump it or step out of the lane; modules block it; it also burns enemies) -> second shot -> fly away.
  const T_IN = 34, T_AIM = 52, T_LOCK = 14, T_FIRE = 26, T_GAP = 60, TZ = 14;
  function turretEnd(api, tu) { // beam end x (stops at the first module on that lane)
    let end = tu.side < 0 ? api.camX + api.W + 20 : api.camX - 20;
    for (const m of G.mods) if (m.st === "rest" && Math.abs(m.y - tu.ty) < MD + 3) {
      const face = tu.side < 0 ? m.x - MW : m.x + MW;
      if (tu.side < 0 ? face > tu.x && face < end : face < tu.x && face > end) end = face;
    }
    return end;
  }
  function updateTurrets(api, p, allow) {
    const S = api.STATE;
    if (allow && S.locked && S.wave >= 1 && !G.turrets.length && --G.turCd <= 0) {
      const side = Math.random() < 0.5 ? -1 : 1; // -1 = left edge (fires right)
      G.turrets.push({ side, x: 0, y: p.y, ty: p.y, t: 0, shots: 0, ph: "in" });
      G.turCd = 380 + (Math.random() * 120 | 0); api.SFX.zap();
    }
    for (const tu of G.turrets) {
      tu.t++;
      const home = tu.side < 0 ? api.camX + 14 : api.camX + api.W - 14, off = tu.side < 0 ? api.camX - 30 : api.camX + api.W + 30;
      if (tu.ph === "in") { tu.x = api.lerp(off, home, Math.min(1, tu.t / T_IN)); tu.y = api.lerp(tu.y, p.y, 0.05); if (tu.t >= T_IN) { tu.ph = "aim"; tu.t = 0; api.SFX.charge(); } }
      else if (tu.ph === "aim") { tu.x = home; tu.y = api.lerp(tu.y, Math.max(api.floorTop, Math.min(api.floorBot, p.y)), 0.07); tu.ty = tu.y; if (tu.t >= T_AIM) { tu.ph = "lock"; tu.t = 0; } }
      else if (tu.ph === "lock") { tu.x = home; if (tu.t >= T_LOCK) { tu.ph = "fire"; tu.t = 0; tu.hit = new Set(); api.SFX.gun(); api.shake(1, 6, true); } }
      else if (tu.ph === "fire") {
        tu.x = home; const end = turretEnd(api, tu), lo = Math.min(tu.x, end), hi = Math.max(tu.x, end);
        if (canHurt(p) && !tu.hit.has(p) && p.x > lo && p.x < hi && Math.abs(p.y - tu.ty) < 6 && p.z < 12) { tu.hit.add(p); api.hurtPlayer(2, false, -tu.side); }
        for (const e of api.enemies) if (hittable(e) && !tu.hit.has(e) && e.x > lo && e.x < hi && Math.abs(e.y - tu.ty) < 6) { tu.hit.add(e); api.hitEnemy(e, 2, true, -tu.side); }
        if (tu.t % 4 === 0) api.fx("spark", end, tu.ty - 12, 6);
        if (tu.t >= T_FIRE) { tu.shots++; tu.t = 0; tu.ph = tu.shots >= 2 ? "out" : "gap"; }
      } else if (tu.ph === "gap") { tu.x = home; tu.y = api.lerp(tu.y, p.y, 0.05); if (tu.t >= T_GAP) { tu.ph = "aim"; tu.t = 0; api.SFX.charge(); } }
      else if (tu.ph === "out") { tu.x = api.lerp(home, off, Math.min(1, tu.t / 30)); if (tu.t >= 30) tu.dead = true; }
    }
    G.turrets = G.turrets.filter((tu) => !tu.dead);
  }
  function drawTurrets(api, cx) {
    const c = api.ctx;
    for (const tu of G.turrets) {
      const x = tu.x - cx, row = tu.ph === "lock" || tu.ph === "fire" ? tu.ty : tu.y, y = row - TZ + 4 + Math.sin(api.t * 0.15) * 0.8, f = -tu.side;
      // lane line: dotted while aiming, solid when locked, beam when firing
      if (tu.ph === "aim" || tu.ph === "lock") {
        c.save(); c.strokeStyle = tu.ph === "lock" ? "rgba(255,70,90,0.9)" : "rgba(255,70,90,0.55)"; c.lineWidth = 1; if (tu.ph === "aim") c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(x, row - 12); c.lineTo(tu.side < 0 ? api.W + 10 : -10, row - 12); c.stroke(); c.restore();
        c.save(); c.globalAlpha = 0.25; api.rect(0, row - 2, api.W, 3, "#ff3a5a"); c.restore();
        if (blink(tu.t)) api.ptext("!", x + f * 2, y - 16, 2, "#ffe060");
      }
      if (tu.ph === "fire") {
        const ex = turretEnd(api, tu) - cx, w = 4 + Math.sin(api.t * 0.9) * 1.2;
        c.save(); c.globalCompositeOperation = "lighter";
        c.fillStyle = "rgba(255,40,90,0.35)"; c.fillRect(Math.min(x, ex), row - 12 - w, Math.abs(ex - x), w * 2);
        c.fillStyle = "rgba(255,120,150,0.8)"; c.fillRect(Math.min(x, ex), row - 13.5, Math.abs(ex - x), 3);
        c.fillStyle = "#fff4f6"; c.fillRect(Math.min(x, ex), row - 12.5, Math.abs(ex - x), 1);
        c.globalAlpha = 0.45; c.fillStyle = "rgba(255,60,100,0.8)"; c.fillRect(Math.min(x, ex), row - 1, Math.abs(ex - x), 2); // floor glow
        glow(c, ex, row - 12, 10, "rgba(255,200,220,0.9)"); c.restore();
      }
      // the drone: armoured dome, violet seams, cannon, thruster
      api.shadow(x, row, TZ, 8);
      c.save(); c.translate(x, y);
      c.fillStyle = "#2c2a34"; c.beginPath(); c.ellipse(0, 0, 9, 7, 0, 0, 6.29); c.fill();
      c.fillStyle = "#56546a"; c.beginPath(); c.ellipse(-1, -2, 7, 4.5, 0, 0, 6.29); c.fill();
      c.strokeStyle = "#b45aff"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-8, 1); c.lineTo(8, 1); c.moveTo(0, -7); c.lineTo(0, 1); c.stroke();
      c.fillStyle = "#1a1820"; c.fillRect(f > 0 ? 5 : -15, -2, 10, 3.5); c.fillStyle = "#6a6878"; c.fillRect(f > 0 ? 5 : -15, -2, 10, 1);
      const hot = tu.ph === "lock" || tu.ph === "fire" || (tu.ph === "aim" && blink(tu.t, 4));
      c.fillStyle = hot ? "#ff4a6a" : "#7a2a3a"; c.beginPath(); c.arc(f * 4, -1, 1.8, 0, 6.29); c.fill();
      c.globalCompositeOperation = "lighter"; c.fillStyle = api.t % 4 < 2 ? "rgba(140,180,255,0.9)" : "rgba(200,120,255,0.8)"; c.beginPath(); c.moveTo(-3, 6); c.lineTo(3, 6); c.lineTo(0, 11 + (api.t % 3)); c.closePath(); c.fill();
      c.restore();
    }
  }

  // ================= SECTION 1 =================
  const street = {
    init: () => { G = fresh(); return {}; },
    update(st, api, p) {
      if (!G) return;
      const S = api.STATE;
      if (S.phase !== "exit" && S.playT > 120 && --G.modCd <= 0) {
        G.modCd = (S.locked ? 230 : 330) + (Math.random() * 90 | 0);
        const near = Math.random() < 0.6;
        if (G.mods.length < 3) dropModule(api, near ? p.x + api.rnd(-30, 30) : api.camX + api.rnd(40, api.W - 40), near ? p.y + api.rnd(-8, 8) : api.rnd(api.floorTop + 8, api.floorBot - 4));
      }
      updateModules(api, p);
      updateTurrets(api, p, true);
      if (--G.boltCd <= 0) { G.boltCd = 140 + (Math.random() * 200 | 0); G.bolts.push({ x: api.rnd(30, api.W - 30), t: 0 }); if (Math.random() < 0.5) api.SFX.zap(); }
      G.bolts = G.bolts.filter((b) => ++b.t < 14);
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const b of G.bolts) { // portal lightning in the sky
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 1 - b.t / 14;
        c.strokeStyle = "#e8c8ff"; c.lineWidth = 1.2; zig(c, b.x, 0, b.x + A.rnd(-30, 30), 40 + (b.x % 30), 7, 5);
        if (b.t < 3) { c.globalAlpha = 0.12; c.fillStyle = "#c08aff"; c.fillRect(0, 0, api.W, api.H); }
        c.restore();
      }
      drawModulesBack(api, cx);
    },
    drawFront(st, api, cx) { if (!G) return; drawModulesFront(api, cx); drawTurrets(api, cx); },
  };

  // ================= MOUSERS (summoned by Krang) =================
  function spawnMouser(api, x, y) { G.mousers.push({ x, y: Math.max(api.floorTop, Math.min(api.floorBot, y)), z: 0.1, vz: 2.2, t: 0, bite: 0, facing: -1, chomp: 0 }); api.dust(x, y); }
  function killMouser(api, q) { if (q.dead) return; q.dead = true; api.fx("spark", q.x, q.y - 6, 8); api.fx("smoke", q.x, q.y - 4, 14); api.SFX.clink(); api.STATE.score += 100; api.fx("pop", q.x, q.y - 14, 30); }
  function updateMousers(api, p) {
    for (const q of G.mousers) {
      if (q.dead) continue;
      q.t++; if (q.bite > 0) q.bite--; if (q.chomp > 0) q.chomp--;
      if (q.z > 0 || q.vz > 0) { q.z += q.vz; q.vz -= 0.25; if (q.z <= 0) { q.z = 0; q.vz = 0; } }
      const dx = p.x - q.x, dy = p.y - q.y;
      if (q.z === 0 && p.deadT === 0) {
        const sp = 1.25 + (q.t % 60 < 10 ? 0.6 : 0);
        if (Math.abs(dx) > 7) q.x += Math.sign(dx) * sp; if (Math.abs(dy) > 1) q.y += Math.sign(dy) * Math.min(0.8, Math.abs(dy));
        q.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 11 && Math.abs(dy) < 5 && p.z < 6 && q.bite === 0) { q.bite = 62; q.chomp = 12; api.SFX.munch ? api.SFX.munch() : api.SFX.hit(); if (canHurt(p)) api.hurtPlayer(1, false); }
      }
      if (G.mods.some((m) => m.st === "rest" && Math.abs(q.x - m.x) < MW + 3 && Math.abs(q.y - m.y) < MD + 2)) { q.x -= q.facing * 1.25; }
      // any swing from the brother scraps it
      if (p.attackT > 0 && p.atk) {
        const ddx = (q.x - p.x) * p.facing;
        if (ddx > -6 && ddx < (p.bro.reach || 20) + 10 && Math.abs(q.y - p.y) < 10 && p.z < 20) killMouser(api, q);
      }
      if (q.t > 760) { q.dead = true; api.fx("smoke", q.x, q.y - 4, 16); }
    }
    G.mousers = G.mousers.filter((q) => !q.dead);
  }
  function drawMouser(api, q, cx) {
    const c = api.ctx, x = q.x - cx, y = q.y - q.z, f = q.facing, step = Math.floor(q.t / 4) % 2, jaw = q.chomp > 0 ? Math.abs(Math.sin(q.chomp * 0.8)) * 0.7 : 0.1 + (q.t % 20 < 10 ? 0.15 : 0);
    api.shadow(x, q.y, q.z, 9);
    c.save(); c.translate(x, y); c.scale(f * 1.45, 1.45);
    c.strokeStyle = "#3a3c46"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-2, -5); c.lineTo(-3 + (step ? 2 : -1), 0); c.moveTo(1, -5); c.lineTo(1 + (step ? -1 : 2), 0); c.stroke();
    c.fillStyle = "#2a2c34"; c.fillRect(-5 + (step ? 2 : -1), -1, 3, 1); c.fillRect(0 + (step ? -1 : 2), -1, 3, 1);
    c.fillStyle = "#8c94a8"; c.beginPath(); c.ellipse(-1, -7, 4.5, 3.2, -0.2, 0, 6.29); c.fill(); // body
    c.strokeStyle = "#5a6070"; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -7); c.lineTo(-9, -9); c.stroke(); // tail
    c.save(); c.translate(3, -9); // head with chomping jaws
    c.save(); c.rotate(-jaw); c.fillStyle = "#a8b0c4"; c.beginPath(); c.moveTo(-2, 0); c.lineTo(7, -1); c.lineTo(7, 1.5); c.lineTo(-2, 2); c.closePath(); c.fill();
    c.fillStyle = "#ffffff"; for (let i = 1; i < 7; i += 2) c.fillRect(i, 1.4, 1, 1); c.restore();
    c.save(); c.rotate(jaw * 0.8); c.fillStyle = "#7a8296"; c.beginPath(); c.moveTo(-2, 2); c.lineTo(6, 2.5); c.lineTo(6, 4); c.lineTo(-2, 4); c.closePath(); c.fill(); c.fillStyle = "#ffffff"; for (let i = 1; i < 6; i += 2) c.fillRect(i, 1.8, 1, 1); c.restore();
    c.fillStyle = "#ff3a3a"; c.fillRect(1, -1, 1.6, 1.6); c.restore();
    c.restore();
  }

  // ================= BOSS ARENA CONTROLLER =================
  const RING_K = 0.3, HATCH = { x: 192, y: 127 };
  const vulnerable = (b) => b && (b.vuln > 0 || b.fistOut || b.state === "stagger");
  const arena = {
    init: () => { G = fresh(); G.modCd = 420; return {}; },
    update(st, api, p) {
      if (!G) return;
      const b = boss(), fight = b && b.go && b.state !== "dying" && !api.STATE.outro;
      if (b) {
        if (b.vuln > 0) b.vuln--;
        // armour: while the brain window is dark the android shrugs off half of every hit
        if (G.lastHp < 0) G.lastHp = b.hp;
        if (b.hp < G.lastHp && b.state !== "dying" && b.hp > 0) {
          const d = G.lastHp - b.hp;
          if (!vulnerable(b)) {
            b.hp = Math.min(b.maxHp, b.hp + d * 0.5); api.fx("clink", b.x + b.facing * 2, b.y - 50, 12);
            if (!G.told) { G.told = true; api.playerBark(true, "TOO TOUGH! HIT HIM WHEN THE BRAIN GLOWS!"); }
          } else api.fx("spark", b.x + b.facing * 2, b.y - 50, 10);
        }
        G.lastHp = b.hp;
      }
      if (!b && G.wreckAt && !G.wreck) G.wreck = G.wreckAt;
      if (fight && --G.modCd <= 0) { G.modCd = (b.p2 ? 250 : 400) + (Math.random() * 80 | 0); if (G.mods.length < 3) dropModule(api, p.x + api.rnd(-26, 26), p.y + api.rnd(-6, 6)); }
      if (G.salvo > 0 && --G.salvo % 22 === 0) dropModule(api, p.x + api.rnd(-60, 60), api.rnd(api.floorTop + 8, api.floorBot - 4), 70);
      updateModules(api, p);
      updateMousers(api, p);
      // stomp shockwave rings (jump them, or stand on a module)
      G.rings = G.rings.filter((R) => {
        if (R.delay > 0) { R.delay--; return true; }
        R.r += 3;
        const test = (x, y, z) => { const d = Math.hypot(x - R.x, (y - R.y) / RING_K); return Math.abs(d - R.r) < 6 && z < 4; };
        if (canHurt(p) && !R.hit.has(p) && test(p.x, p.y, p.z)) { R.hit.add(p); api.hurtPlayer(2, false, p.x < R.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !R.hit.has(e) && test(e.x, e.y, e.z)) { R.hit.add(e); api.hitEnemy(e, 2, true, e.x < R.x ? -1 : 1); }
        for (const q of G.mousers) if (test(q.x, q.y, q.z)) killMouser(api, q);
        return R.r < 320;
      });
      // eye laser sweep
      const L = G.laser;
      if (L && (!b || b.state !== "fire")) G.laser = null;
      else if (L && L.on) {
        const nx = L.x + L.dir * 4.6, blk = G.mods.find((m) => m.st === "rest" && Math.abs(m.y - L.y) < MD + 3 && (L.dir > 0 ? m.x - MW >= L.x - 1 && m.x - MW <= nx : m.x + MW <= L.x + 1 && m.x + MW >= nx));
        if (blk) { L.x = blk.x - L.dir * MW; L.stop = true; } else if (!L.stop) L.x = nx;
        if (api.t % 2 === 0) G.scorch.push({ x: L.x, y: L.y, t: 0 });
        if (canHurt(p) && Math.abs(p.x - L.x) < 9 && Math.abs(p.y - L.y) < 7 && p.z < 12) api.hurtPlayer(2, false, L.dir);
        for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - L.x) < 9 && Math.abs(e.y - L.y) < 7) api.hitEnemy(e, 2, true, L.dir);
        for (const q of G.mousers) if (Math.abs(q.x - L.x) < 8 && Math.abs(q.y - L.y) < 6) killMouser(api, q);
        if (api.t % 5 === 0) api.fx("spark", L.x, L.y - 2, 6);
      }
      G.scorch = G.scorch.filter((s) => ++s.t < 70);
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx, b = boss();
      // Technodrome seams pulse; brighter while Krang is in phase 2
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.18 + 0.1 * Math.sin(api.t * 0.07) + (b && b.p2 ? 0.12 : 0) + (G.flash || 0);
      glow(c, 192 - cx, 70, 90, "rgba(190,80,255,0.7)"); c.restore();
      if (G.flash > 0) G.flash = Math.max(0, G.flash - 0.02);
      if (G.hatchShut > 0) { // the hatch door slides down in the outro
        const h = Math.min(1, G.hatchShut) * 29; api.rect(169 - cx, 98, 48, h, "#1a1820"); api.rect(169 - cx, 98 + h - 2, 48, 2, "#5a5868");
        c.save(); c.globalAlpha = 0.6; api.rect(169 - cx, 98 + h - 1, 48, 1, "#b45aff"); c.restore();
      }
      if (G.wreck) drawWreck(api, G.wreck, cx);
      for (const s of G.scorch) { c.save(); c.globalAlpha = (1 - s.t / 70) * 0.8; c.fillStyle = s.t < 10 ? "#ffb0c0" : "#2a1418"; c.beginPath(); c.ellipse(s.x - cx, s.y, 4, 1.6, 0, 0, 6.29); c.fill(); c.restore(); }
      // stomp warning + rings
      if (b && b.state === "slam" && b.t < 40) {
        const k = b.t / 40; c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.strokeStyle = blink(b.t, 3) ? "#ffe060" : "#ff3a5a"; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(b.x - cx, b.y, 20 + k * 30, (20 + k * 30) * RING_K, 0, 0, 6.29); c.stroke(); c.restore();
        if (blink(b.t)) api.ptext("JUMP!", b.x - cx, b.y + 10, 1, "#ffe060");
      }
      for (const R of G.rings) {
        if (R.delay > 0) continue;
        const a = Math.max(0, 1 - R.r / 320);
        c.save(); c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(255,170,60,${0.5 * a + 0.2})`; c.lineWidth = 5; c.beginPath(); c.ellipse(R.x - cx, R.y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.strokeStyle = `rgba(255,250,220,${0.8 * a + 0.2})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(R.x - cx, R.y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.restore();
      }
      drawModulesBack(api, cx);
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const c = api.ctx, b = boss();
      for (const q of G.mousers) drawMouser(api, q, cx);
      drawModulesFront(api, cx);
      // eye laser: targeting line while charging, then the beam from his eye to the burning floor point
      const L = G.laser;
      if (b && L) {
        const ex = b.x - cx + b.facing * KR_EYE_DX, ey = b.y - b.z - KR_EYE_DY; // eye in the painted idle frame
        if (!L.on) {
          c.save(); c.strokeStyle = blink(api.t, 3) ? "rgba(255,60,80,0.9)" : "rgba(255,200,80,0.7)"; c.setLineDash([2, 3]); c.lineWidth = 1;
          c.beginPath(); c.moveTo(ex, ey); c.lineTo(L.tx - cx, L.y); c.stroke(); c.restore();
          c.save(); c.globalAlpha = 0.2; api.rect(0, L.y - 2, api.W, 4, "#ff3a5a"); c.restore();
        } else {
          c.save(); c.globalCompositeOperation = "lighter";
          c.strokeStyle = "rgba(255,40,80,0.45)"; c.lineWidth = 6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(L.x - cx, L.y); c.stroke();
          c.strokeStyle = "rgba(255,150,170,0.9)"; c.lineWidth = 2.2; c.stroke();
          c.strokeStyle = "#ffffff"; c.lineWidth = 0.8; c.stroke();
          glow(c, L.x - cx, L.y, 14, "rgba(255,180,120,0.95)"); glow(c, ex, ey, 7, "rgba(255,90,110,1)");
          c.restore();
        }
      }
      if (b && vulnerable(b) && b.state !== "dying" && G.toldGlow < 2 && blink(api.t, 8)) api.ptext("HIT THE BRAIN!", b.x - cx, b.y + 10, 1, "#ffe060");
    },
  };

  // ================= KRANG (android body): painted sprite sheet levels/level14_krang.webp =================
  // Frames face right, feet on the frame bottom, [x, y, w, h, anchorX] with anchorX = hip centre (so poses don't slide).
  // Drawn at KR_K: the 192 px idle frame (antenna included) is ~96 world px, a head and a half over the turtles.
  // Gold belly window with the pink brain glows when he is open to damage (overlay glow at the window, per frame).
  const SKIN = "#dcaa78"; // fist fallback colour (sheet not loaded)
  const KR_IMG = "levels/level14_krang.webp", KR_K = 0.5;
  const KRF = {idle: [0, 1, 122, 192, 64], walk1: [126, 1, 109, 192, 60], walk2: [239, 2, 115, 191, 62], walk3: [358, 1, 105, 192, 60], wind: [467, 9, 104, 184, 58], punch: [575, 1, 165, 192, 72], rocket: [744, 1, 176, 192, 76], stompUp: [924, 1, 149, 192, 88], stompDn: [1077, 3, 120, 190, 54], summon: [1201, 0, 117, 193, 64], rage: [1322, 1, 157, 192, 92], hurt: [1483, 7, 140, 186, 71], fall: [1627, 10, 218, 183, 125], down: [1849, 134, 216, 59, 118], empty: [2069, 134, 216, 59, 118]};
  // brain-window centre in frame px (x from the frame's left edge, y from its top)
  const KRW = {idle: [68, 77], walk1: [64, 77], walk2: [64, 79], walk3: [62, 79], wind: [60, 92], punch: [74, 78], rocket: [80, 96], stompUp: [84, 79], stompDn: [58, 80], summon: [66, 88], rage: [92, 74], hurt: [72, 74], fall: [118, 65], down: [96, 23], empty: [96, 23]};
  const KR_PUNCH_EMPTY = [575, 1, 142, 192, 72]; // punch frame cropped at the wristband: the fist is out flying (anchor unchanged)
  const KR_WRIST = [142, 44]; // wrist stump of the cropped punch frame (frame px)
  const KR_EYE = [66, 21];    // Krang's eye in the idle frame (frame px): laser origin + eye glow
  const krPt = (F, px, py, sx, sy, f) => [sx + (px - F[4]) * KR_K * f, sy - (F[3] - py) * KR_K]; // frame px -> screen
  const KR_EYE_DX = (KR_EYE[0] - KRF.idle[4]) * KR_K, KR_EYE_DY = (KRF.idle[3] - KR_EYE[1]) * KR_K; // laser origin offset from the feet
  function krSpr(api, F, sx, sy, f) { // level15 spr() pattern: anchor (hip centre) on sx, not the bbox centre
    const im = api.img(KR_IMG);
    if (!im || !im.complete || !im.naturalWidth) { api.rect(sx - 12, sy - F[3] * KR_K, 24, F[3] * KR_K, "#b07f55"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * KR_K * f, sy, KR_K, f);
  }
  function drawBrain(c, x, y, w, h, t, hot) {
    c.fillStyle = hot ? "#ff9ab4" : "#e8829a"; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, 6.29); c.fill();
    c.strokeStyle = hot ? "#b0305a" : "#a2405a"; c.lineWidth = 0.7; c.beginPath();
    for (let i = -2; i <= 2; i++) { const ox = x + i * w * 0.35; c.moveTo(ox, y - h * 0.8); c.quadraticCurveTo(ox + 2 + Math.sin(t * 0.2 + i), y, ox - 1, y + h * 0.8); }
    c.moveTo(x - w * 0.8, y - 0.5); c.quadraticCurveTo(x, y - 2 + Math.sin(t * 0.15), x + w * 0.8, y + 0.5); c.stroke();
    c.fillStyle = "#fff"; c.fillRect(x + w * 0.35, y - 1.6, 1.6, 1.4); c.fillStyle = "#111"; c.fillRect(x + w * 0.5, y - 1.3, 0.8, 0.9); // Krang's tiny face
  }
  // P: { fr: frame name, vuln, redWin, eye (0..1), stump (fist out), empty }
  function drawKrang(api, sx, sy, f, P) {
    const c = api.ctx, t = api.t, name = P.fr || "idle", F = P.stump ? KR_PUNCH_EMPTY : KRF[name] || KRF.idle;
    krSpr(api, F, sx, sy, f);
    const W = KRW[P.stump ? "punch" : name] || KRW.idle, [wx, wy] = krPt(F, W[0], W[1], sx, sy, f);
    if (P.stump) { // the rocket fist is away: dark socket + jet glow at the wrist
      const [qx, qy] = krPt(F, KR_WRIST[0], KR_WRIST[1], sx, sy, f);
      c.fillStyle = "#26242c"; c.fillRect(qx - 1.5, qy - 3, 3, 6);
      c.save(); c.globalCompositeOperation = "lighter"; glow(c, qx + f * 2, qy, 5 + (t % 3), "rgba(255,170,60,0.9)"); c.restore();
    }
    if (P.empty && t % 20 < 10) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, wx, wy, 4, "rgba(255,60,90,1)"); c.restore(); }
    const v = P.vuln || 0;
    if (v > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 0.4); glow(c, wx, wy, 16, "rgba(255,230,120,0.95)"); c.restore(); }
    if (P.redWin) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6; glow(c, wx, wy, 13, "rgba(255,60,90,0.95)"); c.restore(); }
    if (P.eye > 0 && name === "idle") { const [ex, ey] = krPt(F, KR_EYE[0], KR_EYE[1], sx, sy, f); c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.min(1, P.eye); glow(c, ex, ey, 5 + P.eye * 4, "rgba(255,60,80,1)"); c.restore(); }
  }
  const WALK = ["walk1", "idle", "walk3", "idle"];
  function krangPose(api, e) {
    const s = e.state, t = e.t, P = { vuln: vulnerable(e) ? 1 : 0, fr: "idle" };
    if (s === "walk" || s === "enter") { if (e.walkT > 0) P.fr = WALK[Math.floor(e.walkT / 9) % 4]; }
    else if (s === "kwind") P.fr = "wind";
    else if (s === "kick") P.fr = t < 2 ? "wind" : "punch";
    else if (s === "slam") { if (t < 40) { P.fr = "stompUp"; P.redWin = blink(t, 3) && t < 14; } else P.fr = "stompDn"; }
    else if (s === "throw") { P.fr = !e.fistOut && t >= 24 && t < 34 ? "rocket" : "punch"; P.stump = !!e.fistOut; P.redWin = t < 30 && blink(t, 3); } // jet ignites, then the fist flies
    else if (s === "fire") P.eye = t < 36 ? t / 36 : 1;
    else if (s === "summon") P.fr = "summon";
    else if (s === "rage") { P.fr = "rage"; P.redWin = blink(t, 4); }
    else if (s === "hurt" || s === "stagger") P.fr = "hurt";
    else if (s === "down") P.fr = t < 10 ? "fall" : "down";
    else if (s === "getup") P.fr = t < 8 ? "down" : "hurt";
    else if (s === "dying") P.fr = t < 18 ? "fall" : "down";
    return P;
  }
  function drawWreck(api, w, cx) { // the empty android lying in the plaza after the KO
    api.contactShadow(w.x - cx, w.y, 0, 26);
    drawKrang(api, w.x - cx, w.y, w.f, { fr: "empty", empty: true, vuln: 0 });
    if (api.t % 30 < 3) api.fx("spark", w.x - w.f * 30 + api.rnd(-8, 8), w.y - 6, 8);
    if (api.t % 24 === 0) api.fx("smoke", w.x - w.f * 20 + api.rnd(-14, 14), w.y - 10, 22);
  }
  // ---- Krang's custom moves ----
  const P2CFG = { speed: 1.05, cool: 58 };
  function pick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), cfg = e.cfg;
    e.t = 0; e.cool = cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 32 && Math.random() < 0.7) { e.state = "kwind"; return; }
    const opts = ["slam", "throw", "fire"];
    if (ax < 70) opts.push("slam");
    if (ax > 60) opts.push("throw", "fire");
    if (!(e.sumCd > 0) && G.mousers.length < 3) opts.push("summon");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.65) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m; e.state = m;
    if (m === "throw") { e.fistOut = false; e.fist2 = false; e.fist2Out = false; e.row = p.y; }
    if (m === "fire") { G.laser = { on: false, tx: p.x, y: p.y, x: e.x, dir: e.facing, n: 0 }; api.SFX.charge(); }
  }
  function launchFist(api, e, p, second) {
    const f = e.facing, y = second ? Math.max(api.floorTop, Math.min(api.floorBot, p.y)) : e.row;
    const s = { x: e.x + f * 26, y, z: 30, vx: f * 4.4, kind: "fist", owner: e, back: false, hit: new Set(), t: 0, second, f,
      update: fistUpdate, draw: fistDraw };
    api.shot(s); api.SFX.gun(); api.SFX.rumble(); api.fx("smoke", e.x + f * 22, y - 30, 14);
    if (second) e.fist2Out = true; else e.fistOut = true;
  }
  function fistUpdate(api, s) {
    const p = api.player, e = s.owner; s.t++;
    if (!e || e.state === "dying" || e.gone) { s.dead = true; api.fx("smoke", s.x, s.y - 30, 14); if (e) { e.fistOut = false; e.fist2Out = false; } return true; }
    if (!s.back) {
      s.x += s.vx;
      const blk = G && G.mods.find((m) => m.st === "rest" && Math.abs(m.y - s.y) < MD + 4 && Math.abs(m.x - s.x) < MW + 4);
      if (blk) { crushModule(api, blk); s.back = true; }
      if (s.x < api.camX + 6 || s.x > api.camX + api.W - 6 || s.t > 90) { s.back = true; s.hit = new Set(); api.SFX.land(); api.fx("spark", s.x, s.y - 30, 8); }
    } else { // home in on the arm socket
      const hx = e.x + e.facing * 24, hy = e.y, dx = hx - s.x, dy = hy - s.y, d = Math.hypot(dx, dy);
      if (d < 7 || s.t > 220) { s.dead = true; if (s.second) e.fist2Out = false; else e.fistOut = false; api.SFX.clink(); return true; }
      s.x += dx / d * 4.2; s.y += dy / d * Math.min(4.2, d) * 0.6; s.vx = dx > 0 ? 4 : -4;
    }
    if (canHurt(p) && !s.hit.has(p) && Math.abs(p.x - s.x) < 11 && Math.abs(p.y - s.y) < 6 && p.z < 22) { s.hit.add(p); api.hurtPlayer(2, false, s.vx > 0 ? 1 : -1); }
    for (const en of api.enemies) if (hittable(en) && !s.hit.has(en) && Math.abs(en.x - s.x) < 11 && Math.abs(en.y - s.y) < 6) { s.hit.add(en); api.hitEnemy(en, 2, true, s.vx > 0 ? 1 : -1); }
    if (G) for (const q of G.mousers) if (Math.abs(q.x - s.x) < 9 && Math.abs(q.y - s.y) < 5) killMouser(api, q);
    return true;
  }
  // The flying rocket fist: painted fist + wristband cut from the punch frame of level14_krang.webp (faces right), jet flame behind it
  const KR_FIST = [714, 35, 26, 22, 0];
  function fistDraw(api, s, sx, sy) {
    const c = api.ctx, f = s.vx >= 0 ? 1 : -1, y = s.y - s.z;
    c.save(); c.translate(sx, y); c.scale(f, 1);
    c.globalCompositeOperation = "lighter"; // jet flame out of the wrist
    for (let i = 0; i < 3; i++) { c.fillStyle = ["rgba(255,90,30,0.7)", "rgba(255,180,60,0.8)", "rgba(255,250,200,0.9)"][i]; c.beginPath(); c.moveTo(-5, -3 + i); c.lineTo(-17 + i * 4 - (api.t % 3) * 2, 0); c.lineTo(-5, 3 - i); c.closePath(); c.fill(); }
    c.restore();
    const im = api.img(KR_IMG);
    if (!im || !im.complete || !im.naturalWidth) { c.fillStyle = SKIN; c.beginPath(); c.arc(sx, y, 5.5, 0, 6.29); c.fill(); return; }
    api.drawFrame(im, KR_FIST, sx + f * 1, y + KR_FIST[3] * KR_K / 2, KR_K, f);
  }

  // ---- Boss entrance (entr v1): the Technodrome's hatch irises open, Krang's android body stomps down the ramp out of the violet glow ----
  const KG_ENTR = {
    len: 200, zoom: 1.26, sub: "WARLORD OF DIMENSION X",
    setup(api, e, st) { Object.assign(e, { x: api.camX + OUT_DOOR.x, y: OUT_DOOR.y, z: OUT_DOOR.z, facing: 1, state: "walk", walkT: 0, t: 0, vuln: 0, entrAlpha: 0 }); st.door = 0; api.SFX.door(); api.SFX.rumble(); },
    focus: (api, e, st, t) => t < 50 ? { x: api.camX + OUT_DOOR.x, y: OUT_DOOR.y - OUT_DOOR.z - 20 } : { x: e.x, y: e.y - e.z - 46 },
    step(api, e, st, t) {
      const mid = Math.round((api.floorTop + api.floorBot) / 2);
      st.door = Math.min(1, t / 40);
      if (t < 40) { if (t % 10 === 0) { api.shake(1, 6, true); api.SFX.zap(); } if (t % 6 === 0) api.fx("smoke", api.camX + OUT_DOOR.x + api.rnd(-14, 14), OUT_DOOR.y - OUT_DOOR.z + 6, 16); e.entrAlpha = 0; return; }
      if (t < 64) { e.entrAlpha = (t - 40) / 24; e.walkT = 0; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 46) api.SFX.charge(); return; }
      e.entrAlpha = undefined;
      if (t < 150) { const k = (t - 64) / 86; e.y = api.lerp(OUT_DOOR.y, mid, k); e.z = api.lerp(OUT_DOOR.z, 0, k); e.walkT = (e.walkT || 0) + 1; e.state = "walk";
        if ((t - 64) % 18 === 0) { api.SFX.land(); api.shake(2 + k * 2, 10, true); api.dust(e.x - 10, e.y); api.dust(e.x + 10, e.y); } return; }
      if (t === 150) { e.z = 0; e.walkT = 0; api.entr.impact(e.x, e.y, 6, { stop: 5, puffs: 6 }); api.entr.debris(e.x, e.y, 2, 10, { spread: 2.6 }); api.fx("ring", e.x, e.y, 20); }
      if (t > 150 && t < 186) { e.state = "summon"; e.t = t - 150; if (t % 8 === 0) api.fx("spark", e.x + api.rnd(-16, 16), e.y - api.rnd(30, 90), 10); }
      if (t >= 186) { e.state = "walk"; e.walkT = 0; }
    },
    drawBack(api, st, t, cx) { // the hatch opening: dark slit widening, violet light spilling out and down the ramp
      if (!st.door) return; const c = api.ctx, x = OUT_DOOR.x + (api.camX - cx), y = OUT_DOOR.y - OUT_DOOR.z, k = st.door, fade = Math.min(1, (200 - t) / 30);
      c.save(); c.globalAlpha = fade; c.fillStyle = "#08020e"; c.fillRect(x - 15 * k, y - 34, 30 * k, 36);
      c.globalCompositeOperation = "lighter"; c.globalAlpha = fade * (0.55 + 0.25 * Math.sin(t * 0.3)); glow(c, x, y - 14, 20 + 30 * k, "rgba(190,90,255,0.9)");
      { const gr = c.createLinearGradient(0, y, 0, OUT_DOOR.y + 30); gr.addColorStop(0, "rgba(200,140,255,0.5)"); gr.addColorStop(1, "rgba(200,140,255,0)"); c.fillStyle = gr; } c.globalAlpha = fade * 0.32 * k; c.beginPath(); c.moveTo(x - 15 * k, y + 2); c.lineTo(x + 15 * k, y + 2); c.lineTo(x + 34 * k, OUT_DOOR.y + 30); c.lineTo(x - 34 * k, OUT_DOOR.y + 30); c.closePath(); c.fill();
      c.restore();
    },
    finish(api, e) { e.go = true; e.vuln = 0; e.entrAlpha = undefined; },
  };
  const bossCfg = {
    name: "KRANG", base: "ramrod", atlas: "ramrod", height: 96, hp: 34, speed: 0.75, chargeSpeed: 1, cool: 84, pitch: 190,
    moves: ["kick", "slam", "throw", "fire", "summon"],
    lines: {
      intro: "BEHOLD! THE TECHNODROME HAS ARRIVED!",
      hit: ["OW! WATCH THE MERCHANDISE!", "MY BEAUTIFUL BODY!", "YOU INSOLENT REPTILES!", "OOH, THAT SMARTS!"],
      summon: "MOUSERS! CHEW THEM UP!",
      ko: "NO! NOT MY BODY! SHREDDERRR!",
    },
    spawn(api, e) { Object.assign(e, { state: "phase", t: 0, x: 250, y: 186, z: 0, facing: -1, inv: 999, sumCd: 520, vuln: 0 }); api.SFX.zap(); },
    entrance: KG_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "phase") { // teleported in by a beam from the Technodrome
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t % 12 === 0 && e.t < 80) { api.SFX.zap(); api.shake(1, 6, true); }
        if (e.t === 70) { api.SFX.boom(); api.shake(3, 14, true); api.dust(e.x - 14, e.y); api.dust(e.x + 14, e.y); }
        if (e.t === 130) api.enemySay(e, bossCfg.lines.intro, 100, 190, true);
        if (e.t === 225) api.enemySay(e, "NOW, TURTLES... TASTE MY NEW BODY!", 90, 190, true);
        if (e.t >= 300) { e.inv = 0; e.state = "walk"; e.t = 0; e.cool = 40; e.go = true; }
        return true;
      }
      if (e.state === "rage") { // phase 2: the Technodrome rains modules, Krang powers up
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t === 1) { api.enemySay(e, "TECHNODROME! FULL POWER! CRUSH THEM!", 110, 200, true); api.SFX.charge(); }
        if (e.t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-16, 16), e.y - api.rnd(20, 80), 10); }
        if (e.t === 40) { G.salvo = 22 * 4 + 1; G.flash = 0.5; api.SFX.boom(); }
        if (e.t >= 170) {
          e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2CFG); e.rageLock = false; e.sumCd = 360;
          api.playerBark(true, "HE'S OVERLOADING! WATCH THE SKY!"); e.state = "walk"; e.t = 0; e.cool = 30;
        }
        return true;
      }
      if (e.state === "walk" && !e.p2 && !e.rageLock && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; e.rageLock = true; return true; }
      if (e.state === "walk" && free && e.cool <= 1 && !e.fistOut && !e.fist2Out) { pick(api, e, p); return true; }
      if (e.state === "slam") { // STOMP: leg up (40 f), crash + shockwave ring(s), then stuck (brain exposed)
        if (e.t === 1) api.SFX.charge();
        if (e.t === 40) {
          api.SFX.boom(); api.shake(5, 16, true); api.STATE.shake = Math.max(api.STATE.shake, 10); api.dust(e.x - 12, e.y); api.dust(e.x + 12, e.y); api.fx("ring", e.x + e.facing * 8, e.y, 18);
          G.rings.push({ x: e.x + e.facing * 8, y: e.y, r: 12, hit: new Set() });
          if (e.p2) G.rings.push({ x: e.x + e.facing * 8, y: e.y, r: 12, hit: new Set(), delay: 26 });
          if (canHurt(p) && p.z < 4 && Math.abs(p.x - e.x - e.facing * 8) < 24 && Math.abs(p.y - e.y) < 12) api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
          e.vuln = 80; G.toldGlow++;
        }
        if (e.t > 40 && e.t % 9 === 0 && e.t < 100) api.fx("spark", e.x + e.facing * 10, e.y - 4, 8);
        if (e.t >= 104) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "throw") { // FIST ROCKET: aim (red line), launch, wait for the fist to come home
        if (e.t < 34) { e.facing = p.x >= e.x ? 1 : -1; e.row = api.lerp(e.row, p.y, 0.15); e.y += Math.sign(e.row - e.y) * Math.min(0.5, Math.abs(e.row - e.y)); }
        if (e.t === 34) { launchFist(api, e, p, false); G.toldGlow++; }
        if (e.p2 && e.t === 58) launchFist(api, e, p, true);
        if (e.t > 40 && !e.fistOut && !e.fist2Out) { e.state = "walk"; e.t = 0; e.vuln = 20; }
        if (e.t > 260) { e.fistOut = e.fist2Out = false; e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "fire") { // EYE LASER: charge + target line (36 f), then the beam sweeps out along your lane
        const L = G.laser; if (!L) { e.state = "walk"; e.t = 0; return true; }
        if (!L.on) {
          if (e.t < 30) { L.tx = api.lerp(L.tx, p.x, 0.12); L.y = api.lerp(L.y, p.y, 0.12); e.facing = L.tx >= e.x ? 1 : -1; }
          if (e.t >= 36) { L.on = true; L.x = e.x + e.facing * 14; L.dir = e.facing; L.stop = false; L.n++; api.SFX.zap(); api.SFX.gun(); }
        } else if (L.stop || L.x < api.camX - 10 || L.x > api.camX + api.W + 10) {
          if (e.p2 && L.n < 2) { Object.assign(L, { on: false, tx: p.x, y: p.y, n: L.n }); e.t = 10; api.SFX.charge(); }
          else { G.laser = null; e.state = "stagger"; e.t = 0; e.vx = 0; e.vuln = 70; G.toldGlow++; api.fx("smoke", e.x + e.facing * 6, e.y - 88, 22); } // overheated
        }
        return true;
      }
      if (e.state === "summon") {
        if (e.t === 14) {
          api.enemySay(e, bossCfg.lines.summon, 80, 190);
          const n = e.p2 ? 4 : 3;
          for (let i = 0; i < n; i++) spawnMouser(api, e.x + (i - (n - 1) / 2) * 18 + e.facing * 10, e.y + api.rnd(-10, 10));
          e.sumCd = e.p2 ? 620 : 820; e.vuln = 60; api.SFX.door();
        }
        if (e.t >= 50) { e.state = "walk"; e.t = 0; }
        return true;
      }
      return false; // kwind / kick (the engine's close-range blow), hurt etc.
    },
    draw(api, e, sx, sy) {
      const c = api.ctx;
      if (e.state === "phase") { // materialise inside a violet beam
        const t = e.t, k = Math.min(1, Math.max(0, (t - 20) / 50));
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = t < 90 ? 0.75 : Math.max(0, 0.75 - (t - 90) / 40);
        const bw = 20 + Math.sin(t * 0.5) * 3, g = c.createLinearGradient(sx - bw, 0, sx + bw, 0);
        g.addColorStop(0, "rgba(160,60,255,0)"); g.addColorStop(0.5, "rgba(230,190,255,0.95)"); g.addColorStop(1, "rgba(160,60,255,0)");
        c.fillStyle = g; c.fillRect(sx - bw, 0, bw * 2, sy + 2); c.restore();
        if (k <= 0) return;
        c.save(); c.globalAlpha = k < 1 ? (t % 4 < 2 ? k : k * 0.4) : 1;
        drawKrang(api, sx, sy, e.facing, { fr: "idle", vuln: 0 }); c.restore();
        if (k < 1) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.fillStyle = "#c88aff"; for (let i = 0; i < 9; i++) c.fillRect(sx - 24, sy - 92 + i * 10 + (t % 10), 48, 1); c.restore(); }
        return;
      }
      if (e.state === "rage" || e.p2) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = (e.state === "rage" ? 0.45 : 0.18) + 0.12 * Math.sin(api.t * 0.2); glow(c, sx, sy - 46, 56, "rgba(190,80,255,0.8)"); c.restore(); }
      api.contactShadow(sx, e.y, e.z, 22);
      const P = krangPose(api, e), jx = e.state === "kwind" ? -e.facing : e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : 0;
      drawKrang(api, sx + jx, sy, e.facing, P);
      if (e.state === "rage" && api.t % 6 < 3) { c.save(); c.strokeStyle = "#e8c8ff"; c.lineWidth = 1; zig(c, sx + api.rnd(-18, 18), sy - 96, sx + api.rnd(-18, 18), sy - 10, 6, 5); c.restore(); }
    },
    onDefeat(api, e) { if (G) { G.rings = []; G.laser = null; G.salvo = 0; for (const q of G.mousers) killMouser(api, q); G.wreckAt = { x: e.x, y: e.y, f: e.facing }; } },
  };

  // ================= OUTRO: Krang's brain flees, Shredder retreats to his tower =================
  function drawBrainWalker(api, x, y, z, t, f) {
    const c = api.ctx; api.shadow(x, y, z, 6);
    c.save(); c.translate(x, y - z); c.scale(f, 1);
    c.strokeStyle = "#d86a88"; c.lineWidth = 1.3; c.lineCap = "round"; // tentacle legs
    for (let i = 0; i < 4; i++) { const ph = t * 0.5 + i * 1.7; c.beginPath(); c.moveTo(-4 + i * 2.6, -5); c.quadraticCurveTo(-6 + i * 3 + Math.sin(ph) * 3, -2, -5 + i * 3.2 + Math.sin(ph + 1) * 2, 0); c.stroke(); }
    drawBrain(c, 0, -9, 6.5, 4.6, t, true);
    c.restore();
  }
  // Shredder cameo in the hatch doorway: the painted L15 Shredder sheet (idle, and a pointing taunt while he talks)
  const SH15_IMG = "levels/level15_shredder.webp", SH15F = { idle: [0, 0, 102, 190, 42], taunt: [1194, 0, 129, 190, 40] };
  function drawShredder(api, x, y, k, t, taunt) {
    const im = api.img(SH15_IMG), F = SH15F[taunt ? "taunt" : "idle"], sk = 150 * k * 1.05 / 190, f = -1;
    if (!im) { api.rect(x - 4, y - 150 * k, 8, 150 * k, "#8a8ea0"); return; }
    api.drawFrame(im, F, x + (F[2] / 2 - F[4]) * sk * f, y, sk, f);
  }
  const OUT_DOOR = { x: 192, y: 160, z: 33 };
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro (see NOTES.md)
      if (t === 1) {
        G = G || fresh(); G.rings = []; G.laser = null; G.mousers = []; G.salvo = 0;
        const w = G.wreckAt || { x: 230, y: 188, f: -1 }; G.wreck = w;
        Object.assign(st, { bx: w.x - w.f * 6, by: w.y, bz: 18, bvz: 2.4, ph: "pop", shred: 0, cap: -1 });
        api.SFX.door(); api.fx("smoke", w.x, w.y - 16, 24);
      }
      // brain hops out of the wreck, then scuttles to the hatch and up the ramp
      if (st.ph === "pop") { st.bz += st.bvz; st.bvz -= 0.2; st.bx -= G.wreck.f * 0.6; if (st.bz <= 0) { st.bz = 0; st.ph = "run"; api.SFX.land(); } }
      else if (st.ph === "run") {
        const dx = OUT_DOOR.x - st.bx, dy = OUT_DOOR.y - st.by;
        st.bx += Math.sign(dx) * Math.min(1.6, Math.abs(dx)); st.by += Math.sign(dy) * Math.min(0.8, Math.abs(dy)); st.bf = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) st.ph = "ramp";
      } else if (st.ph === "ramp") { st.bz += 0.5; if (st.bz >= OUT_DOOR.z) { st.ph = "in"; st.inT = t; api.SFX.door(); } }
      if (t === 30) st.say = { s: "I'LL BE BACK FOR YOU, TURTLES!", t: 110, who: "brain" };
      if (t === 70) api.playerBark(true, "THE BRAIN'S GETTING AWAY!");
      // the brother steps toward the hatch
      const tx = 150, ty = 180, dx = tx - p.x, dy = ty - p.y;
      if (t > 60 && t < 260 && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) { p.x += Math.sign(dx) * Math.min(1.2, Math.abs(dx)); p.y += Math.sign(dy) * Math.min(0.8, Math.abs(dy)); p.walkT++; p.facing = dx >= 0 ? 1 : -1; } else p.walkT = 0;
      if (st.ph === "in" && !st.shred && t - st.inT > 20) { st.shred = t; api.SFX.confirm(); api.fx("smoke", 192, 126, 26); api.fx("smoke", 186, 118, 24); }
      if (st.shred) {
        const k = t - st.shred;
        if (k === 16) st.say = { s: "YOU WANT ME, TURTLES? COME CLIMB MY TOWER!", t: 140, who: "shred" };
        if (k === 170) { api.SFX.boom(); api.fx("smoke", 192, 120, 30); api.fx("smoke", 198, 112, 28); api.fx("smoke", 186, 116, 26); st.gone = true; }
        if (k > 180 && k < 220) { G.hatchShut = (k - 180) / 40; if (k === 181) api.SFX.door(); }
        if (k === 220) { api.SFX.rumble(); api.shake(4, 40, true); G.flash = 0.6; }
        if (k === 250) api.playerBark(true, "SHREDDER'S TOWER... THIS ENDS TONIGHT!");
        if (k === 300) { st.cap = 0; api.SFX.confirm(); }
        if (k > 560) return true;
      }
      if (st.say && --st.say.t <= 0) st.say = null;
      if (st.cap >= 0) st.cap++;
      return t > 1500;
    },
    draw(api, st, t, cx) {
      if (st.bx === undefined) return;
      const c = api.ctx;
      if (st.shred && !st.gone) { const k = t - st.shred; c.save(); c.globalAlpha = Math.min(1, k / 12); drawShredder(api, 192 - cx, 127, 0.19, t, k >= 16 && k < 156); c.restore(); }
      if (st.ph !== "in") drawBrainWalker(api, st.bx - cx, st.by, st.bz, t, st.bf || -1);
      if (st.say) {
        if (st.say.who === "brain" && st.ph !== "in") api.bubble(st.bx - cx, st.by - st.bz - 22, st.say.s, "#c0305a", 7);
        if (st.say.who === "shred" && !st.gone) api.bubble(192 - cx, 92, st.say.s, "#5a1a8a", 7);
      }
      if (st.cap >= 0) { // caption: the next level, never THE END
        const a = Math.min(1, st.cap / 25);
        c.globalAlpha = 0.5 * a; api.rect(0, 30, api.W, 50, "#07040c"); c.globalAlpha = a;
        api.ptext("NEXT: THE FINAL ASCENT", api.W / 2, 44, 2, st.cap % 24 < 12 ? "#ffe060" : "#ffb21a");
        if (st.cap > 40) api.ptext("SHREDDER WAITS AT THE TOP OF HIS TOWER.", api.W / 2, 66, 1, "#ffffff");
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 14,
    name: "TECHNODROME PORTAL",
    card: { title: "TECHNODROME PORTAL", tagline: "THE WAR MACHINE IS PHASING INTO NEW YORK!", color: "#b04aff" },
    music, bossMusic,
    // painted regular enemies (trooper family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_trooper.webp", ENEMY_F = { light: {"idle":[4,2,87,167,38],"walk":[95,2,88,167,38],"walk2":[187,0,90,169,46],"attack":[281,5,114,164,45],"jump":[399,4,84,165,46],"hurt":[487,16,90,153,46],"down":[581,133,170,36,85],"dash":[755,68,152,101,84]}, weapon: {"idle":[4,173,81,171,34],"walk":[89,175,89,169,39],"walk2":[182,177,86,167,42],"attack":[272,180,154,164,51],"jump":[430,182,98,162,52],"hurt":[532,191,108,153,52],"down":[644,307,183,37,91],"throw":[831,182,151,162,77]}, big: {"idle":[4,348,103,171,46],"walk":[111,350,108,169,54],"walk2":[223,352,113,167,58],"attack":[340,349,143,170,51],"jump":[487,360,110,159,48],"hurt":[601,362,103,157,47],"down":[708,471,189,48,94],"shoot":[901,354,141,165,41]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 235, sword: 265, star: 320, blue: 185, heavy: 12, gunner: 192, dasher: 290 },
    images: [KR_IMG, SH15_IMG],
    sections: [
      { bg: BG1, floor: [170, 214], length: 2800, locks: [0, 680, 1380, 2080],
        waves: [["purple", "purple", "star"], ["purple", "heavy", "gunner", "sword"], ["heavy", "gunner", "blue", "star"], ["heavy", "heavy", "gunner", "dasher", "sword"]],
        weather: "embers", hazards: [street], sky: "#1a0c2c", ground: "#3a3444" },
      { bg: BG2, floor: [160, 216], length: 384, locks: [], waves: [], hazards: [arena], weather: "embers", sky: "#1a0c2c", ground: "#3a3048" },
    ],
    restructure: { // phase 2: portal street (zone 1) -> tendril alley timed escape (twist) -> under the El (zone 2) -> existing plaza
      split: 0, images: ["levels/level14_tendril.webp", "levels/level14_elstreet.jpg"],
      tsec: { length: 1400, hazards: [] },
      twist: { kind: "run", goal: "reach", title: "TENDRIL ALLEY!", sub: "MAKE THE EL OVERPASS BEFORE THE PORTAL SURGE", img: "levels/level14_tendril.webp", fr: {"mound": [0, 0, 170, 59], "crater": [173, 0, 190, 57], "chunk1": [366, 0, 64, 39], "drillHalf": [0, 62, 190, 94], "chunk2": [193, 62, 52, 26], "chunk3": [248, 62, 56, 40], "drillFull": [0, 159, 347, 300]},
        clock: 2700, reclock: 1200, surgeMsg: "PORTAL SURGE!", hudText: "PORTAL SURGE IN", drip: ["purple"], gap: 260, cap: 2, color: "#d08aff" },
      z2bg: "levels/level14_elstreet.jpg",
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; street.init = arena.init = null; },
  });
})();
