// Level 8 (FINAL): FORTRESS OF RAZORBACK. Built only on the public plugin API (window.SS); see ss_level_api.md.
// Section 1: the fortress corridor. Laser fences that cut across every lane, floor steam vents, blast doors that
// slide open and drop robot troopers into the fight, and electrified floor panels.
// Section 2: the throne room. Final boss RAZORBACK (the villain who snatched Amber in Level 1), drawn from the same
// razor atlas as the Level 1 cutscene. Two phases, reactor-core shockwave rings, henchmen crashing in through the
// side windows, razor-disc fans and a phase-2 sky dive. Outro: free Amber, the brothers regroup, then the core destabilises: TO BE CONTINUED.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level8_fortress.jpg", BG2 = "levels/level8_final_boss.jpg";
  let G = null; // all module state for the current run (reset on every section entry / onStart, cleared on unload)
  const fresh = () => ({ rings: [], ringCd: 300, ringTel: 0, ringN: 0, glass: [], cageT: 0, amberFree: false, coreDim: 0, told: false });

  // ---- Music: an original dark march (E minor, 138 BPM) + a re-keyed, faster boss track ----
  const CH = ["Em", "Em", "C", "D", "Em", "Em", "Am", "B", "Em", "Em", "C", "D", "Am", "C", "B", "B"];
  const M1 = "E5:3 .:1 E5:2 G5:2 B5:4 A5:2 G5:2";
  const music = A.track({ bpm: 138, loop: true, chords: CH,
    lead: [M1, "F#5:2 E5:2 D5:4 B4:4 .:4", "C5:2 E5:2 G5:4 E6:2 D6:2 C6:4", "D6:3 .:1 A5:2 F#5:2 D5:4 .:4",
      M1, "B5:2 C6:2 B5:2 G5:2 E5:4 .:4", "A5:2 C6:2 E6:4 D6:2 C6:2 A5:4", "B5:4 D#6:4 F#6:4 .:4",
      M1, "B5:2 G5:2 E5:2 G5:2 B5:4 E6:4", "E6:2 D6:2 C6:2 G5:2 E5:4 G5:4", "F#5:2 A5:2 D6:4 C6:2 B5:2 A5:4",
      "A5:3 .:1 C6:2 E6:2 A6:4 G6:2 E6:2", "G6:2 E6:2 C6:2 G5:2 E6:4 .:4", "F#6:4 D#6:4 B5:4 F#5:4", "B5:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 10]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k.h.s.hkk.hks.ho", 15).concat(["k.s.s.sss.sssso."]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -3, 186);

  // ---- helpers ----
  const onScr = (api, x, pad) => x - api.camX > -pad && x - api.camX < api.W + pad;
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };

  // ---- Painted stage props: levels/level8_props.webp (photoreal cutouts, sheet px = 2x world px) ----
  const PR_IMG = "levels/level8_props.webp";
  const PRF = { pylonOn: [0, 0, 48, 80], pylonOff: [52, 0, 48, 80], ventHot: [104, 51, 52, 29], ventOff: [160, 51, 52, 29], panel: [216, 48, 84, 32], cageBase: [304, 35, 76, 45], cageTop: [384, 46, 64, 34],
    glass: [[452, 66, 4, 14], [460, 66, 12, 14], [476, 66, 14, 14], [494, 66, 6, 14], [504, 66, 6, 14], [514, 66, 6, 14], [524, 66, 5, 14]] };
  function prImg() { const im = A.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; }
  function prDraw(c, im, F, x, y, w, h) { c.save(); c.imageSmoothingEnabled = true; c.drawImage(im, F[0], F[1], F[2], F[3], x, y, w, h); c.restore(); }
  function pylon(c, im, x, base, on, warn, t) { // painted emitter post, base on `base`; lenses lit when the fence is on / flashing in warning
    const lit = on || (warn && t % 6 < 3);
    prDraw(c, im, lit ? PRF.pylonOn : PRF.pylonOff, x - 10, base - 39, 20, 40);
    if (lit) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = on ? 0.7 : 0.45; for (const z of [6, 18, 30]) glow(c, x, base - z - 1, 6, "rgba(255,60,90,0.9)"); c.restore(); }
  }

  // ================= SECTION 1 HAZARDS =================
  // Laser fence: a slanted grid of three beams across the whole floor band. OFF -> WARN (dotted flicker) -> ON.
  const L_OFF = 150, L_WARN = 46, L_ON = 74, L_CYC = L_OFF + L_WARN + L_ON, SLANT = 0.3;
  const lasers = {
    init: () => ({ list: [{ x: 500, t: 0 }, { x: 1110, t: 90 }, { x: 1520, t: 30 }, { x: 2260, t: 140 }] }),
    update(st, api, p) {
      for (const L of st.list) {
        L.t = (L.t + 1) % L_CYC;
        if (L.t === L_OFF && onScr(api, L.x, 20)) api.SFX.charge();
        if (L.t < L_OFF + L_WARN) { L.hit = null; continue; }
        L.hit = L.hit || new Set();
        const fxAt = (y) => L.x + (y - api.floorTop) * SLANT;
        if (canHurt(p) && !L.hit.has(p) && p.z < 34 && Math.abs(p.x - fxAt(p.y)) < 5) { L.hit.add(p); api.hurtPlayer(1, false, p.x < fxAt(p.y) ? -1 : 1); api.fx("spark", p.x, p.y - 16, 8); }
        for (const e of api.enemies) if (hittable(e) && !L.hit.has(e) && Math.abs(e.x - fxAt(e.y)) < 5) { L.hit.add(e); api.hitEnemy(e, 2, true, e.x < fxAt(e.y) ? -1 : 1); }
      }
    },
    drawBack(st, api, cx) { // back pylon (behind actors)
      for (const L of st.list) {
        const x = Math.round(L.x - cx), y = api.floorTop - 2; if (x < -30 || x > api.W + 30) continue;
        const on = L.t >= L_OFF + L_WARN, warn = L.t >= L_OFF && !on, im = prImg();
        if (im) { pylon(api.ctx, im, x, y + 1, on, warn, L.t); continue; }
        api.rect(x - 3, y - 38, 6, 38, "#2a2634"); api.rect(x - 3, y - 38, 1, 38, "#5a5470"); api.rect(x - 4, y - 2, 8, 3, "#14121a");
        for (const z of [6, 18, 30]) api.rect(x - 2, y - z - 1, 4, 3, on ? "#ff3a5a" : warn && L.t % 6 < 3 ? "#ff9a3a" : "#5a1a24");
      }
    },
    drawFront(st, api, cx) { // beams + front pylon (over actors)
      const c = api.ctx, top = api.floorTop - 2, bot = api.floorBot + 6;
      for (const L of st.list) {
        const xb = L.x - cx, xf = xb + (bot - top) * SLANT; if (xf < -30 || xb > api.W + 30) continue;
        const on = L.t >= L_OFF + L_WARN, warn = L.t >= L_OFF && !on;
        if (!on) { c.save(); c.strokeStyle = "rgba(255,60,90,0.35)"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(xb, top); c.lineTo(xf, bot); c.stroke(); c.restore(); }
        if (on || warn) {
          c.save();
          if (on) {
            c.globalCompositeOperation = "lighter"; c.lineWidth = 6; c.strokeStyle = "rgba(255,30,70,0.28)"; c.beginPath(); for (const z of [6, 18, 30]) { c.moveTo(xb, top - z); c.lineTo(xf, bot - z); } c.stroke();
            c.lineWidth = 3; c.strokeStyle = "rgba(255,60,100,0.5)"; c.stroke();
            c.globalAlpha = 0.5; c.fillStyle = "rgba(255,40,90,0.6)"; c.beginPath(); c.moveTo(xb - 4, top); c.lineTo(xb + 4, top); c.lineTo(xf + 4, bot); c.lineTo(xf - 4, bot); c.closePath(); c.fill(); c.globalAlpha = 1; // floor glow
          }
          c.lineWidth = on ? 1.5 : 1; c.strokeStyle = on ? (api.t % 4 < 2 ? "#fff0f4" : "#ff7a96") : "rgba(255,120,60,0.85)";
          if (warn) c.setLineDash([2, 4]);
          if (on || L.t % 8 < 5) { c.beginPath(); for (const z of [6, 18, 30]) { c.moveTo(xb, top - z); c.lineTo(xf, bot - z); } c.stroke(); }
          c.restore();
          if (warn && Math.floor(L.t / 6) % 2) api.ptext("!", (xb + xf) / 2, top - 46, 2, "#ffe060");
        }
        const x = Math.round(xf), im = prImg();
        if (im) { pylon(c, im, x, bot + 2, on, warn, L.t); continue; }
        api.rect(x - 3, bot - 36, 6, 36, "#2a2634"); api.rect(x - 3, bot - 36, 1, 36, "#6a6480"); api.rect(x - 5, bot - 1, 10, 3, "#14121a");
        for (const z of [6, 18, 30]) api.rect(x - 2, bot - z - 1, 4, 3, on ? "#ff3a5a" : warn && L.t % 6 < 3 ? "#ff9a3a" : "#5a1a24");
      }
    },
  };

  // Steam vents: floor grates hiss and puff (warning), then blast a scalding column straight up.
  const V_IDLE = 200, V_WARN = 48, V_BLAST = 56, V_CYC = V_IDLE + V_WARN + V_BLAST;
  const vents = {
    init: (api) => ({ list: [[330, 176, 0], [690, 196, 120], [880, 184, 60], [1240, 178, 200], [1430, 199, 40], [1700, 186, 150], [2060, 177, 90], [2160, 198, 10]].map(([x, y, t]) => ({ x, y, t })) }),
    update(st, api, p) {
      for (const v of st.list) {
        v.t = (v.t + 1) % V_CYC;
        if (v.t === V_IDLE && onScr(api, v.x, 0)) api.SFX.rumble();
        if (v.t < V_IDLE + V_WARN) { v.hit = null; continue; }
        v.hit = v.hit || new Set();
        if (canHurt(p) && !v.hit.has(p) && Math.abs(p.x - v.x) < 11 && Math.abs(p.y - v.y) < 7 && p.z < 44) { v.hit.add(p); api.hurtPlayer(1, false, p.x < v.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !v.hit.has(e) && Math.abs(e.x - v.x) < 11 && Math.abs(e.y - v.y) < 7) { v.hit.add(e); api.hitEnemy(e, 1, true, e.x < v.x ? -1 : 1); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const v of st.list) {
        const warn = v.t >= V_IDLE && v.t < V_IDLE + V_WARN, x = Math.round(v.x - cx) + (warn && v.t % 4 < 2 ? 1 : 0), y = v.y; if (x < -20 || x > api.W + 20) continue;
        const im = prImg();
        if (im) prDraw(c, im, warn || v.t >= V_IDLE + V_WARN ? PRF.ventHot : PRF.ventOff, x - 13, y - 7, 26, 14.5); // painted grate, glowing when live
        else {
        c.fillStyle = "#4a4656"; c.beginPath(); c.ellipse(x, y, 11, 4, 0, 0, 6.29); c.fill();
        c.fillStyle = "#0c0a10"; c.beginPath(); c.ellipse(x, y, 9, 3, 0, 0, 6.29); c.fill();
        for (let i = -6; i <= 6; i += 3) api.rect(x + i, y - 2, 1, 4, "#5a5668");
        }
        if (warn || v.t >= V_IDLE + V_WARN) { c.globalAlpha = 0.5; glow(c, x, y, 12, "rgba(255,160,80,0.9)"); c.globalAlpha = 1; }
        if (warn) {
          c.globalAlpha = 0.5; c.fillStyle = "#e8e8f4";
          for (let i = 0; i < 3; i++) { const k = ((v.t * 1.5 + i * 9) % 26) / 26; c.beginPath(); c.arc(x + Math.sin(i * 2 + v.t * 0.2) * 4, y - 3 - k * 14, 2 + k * 3, 0, 6.29); c.fill(); }
          c.globalAlpha = 1;
          if (Math.floor(v.t / 6) % 2) api.ptext("!", x, y - 26, 2, "#ffe060");
        }
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const v of st.list) {
        if (v.t < V_IDLE + V_WARN) continue;
        const x = v.x - cx; if (x < -30 || x > api.W + 30) continue;
        const k = (v.t - V_IDLE - V_WARN) / V_BLAST, h = 70 * Math.min(1, k * 6) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        c.save();
        const g = c.createLinearGradient(0, v.y, 0, v.y - h); g.addColorStop(0, "rgba(255,255,255,0.85)"); g.addColorStop(1, "rgba(200,200,230,0)");
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, v.y); c.lineTo(x - 13, v.y - h); c.lineTo(x + 13, v.y - h); c.lineTo(x + 6, v.y); c.closePath(); c.fill();
        c.globalAlpha = 0.55; c.fillStyle = "#f4f4ff";
        for (let i = 0; i < 7; i++) { const u = ((api.t * 2.5 + i * 13) % 60) / 60; c.beginPath(); c.arc(x + Math.sin(i * 3 + api.t * 0.3) * (3 + u * 7), v.y - u * h, 3 + u * 6, 0, 6.29); c.fill(); }
        c.restore();
      }
    },
  };

  // Blast doors (painted into the art every 816 px): during a wave they flash red, slide open and a trooper steps out.
  const DOOR_TW = 816, DK = 816 / 1864, DSRC = [255, 180, 130, 202]; // door panel rect in the jpg (px)
  const D_WARN = 40, D_OPEN = 18, D_HOLD = 56, D_CLOSE = 18;
  const doors = {
    init: () => { const list = []; for (let x = 140; x < 2700; x += DOOR_TW) list.push({ x, t: -1, cd: 60 }, { x: x + 398.5, t: -1, cd: 160 }); return { list }; },
    update(st, api, p) {
      const S = api.STATE;
      for (const d of st.list) {
        if (d.cd > 0) d.cd--;
        if (d.t < 0) {
          const inView = d.x - api.camX > 40 && d.x - api.camX < api.W - 40;
          if (inView && S.locked && d.cd === 0 && S.queue.length && api.enemies.length < 5) { d.t = 0; api.SFX.door(); }
          continue;
        }
        d.t++;
        if (d.t === D_WARN) api.SFX.rumble();
        if (d.t === D_WARN + D_OPEN + 6 && S.queue.length && api.enemies.length < 5) {
          const type = S.queue.shift(); api.spawnEnemy(type);
          const e = api.enemies[api.enemies.length - 1];
          if (e && e.type === type) { e.x = d.x + api.rnd(-6, 6); e.y = api.floorTop + 1; e.facing = p.x < e.x ? -1 : 1; api.fx("smoke", e.x, e.y - 14, 22); }
        }
        if (d.t >= D_WARN + D_OPEN + D_HOLD + D_CLOSE) { d.t = -1; d.cd = 260; api.SFX.land(); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, im = api.img(BG1);
      for (const d of st.list) {
        if (d.t < 0) continue;
        const x0 = d.x - cx - DSRC[2] * DK / 2, w = DSRC[2] * DK, y0 = DSRC[1] * 0.4375, h = DSRC[3] * 0.4375;
        if (x0 + w < -10 || x0 > api.W + 10) continue;
        const t = d.t, o = t < D_WARN ? 0 : t < D_WARN + D_OPEN ? (t - D_WARN) / D_OPEN : t < D_WARN + D_OPEN + D_HOLD ? 1 : Math.max(0, 1 - (t - D_WARN - D_OPEN - D_HOLD) / D_CLOSE);
        if (o > 0) {
          c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
          const g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, "#08060c"); g.addColorStop(1, "#3a0a14");
          c.fillStyle = g; c.fillRect(x0, y0, w, h);
          glow(c, x0 + w / 2, y0 + h * 0.7, 30, "rgba(255,40,40,0.5)");
          if (im) {
            c.imageSmoothingEnabled = true; try { c.filter = "brightness(1.3) contrast(1.05)"; } catch (_) {}
            const hw = DSRC[2] / 2, sh = o * w / 2;
            c.drawImage(im, DSRC[0], DSRC[1], hw, DSRC[3], x0 - sh, y0, w / 2, h);
            c.drawImage(im, DSRC[0] + hw, DSRC[1], hw, DSRC[3], x0 + w / 2 + sh, y0, w / 2, h);
            c.filter = "none";
          } else { api.rect(x0 - o * w / 2, y0, w / 2, h, "#2a2834"); api.rect(x0 + w / 2 + o * w / 2, y0, w / 2, h, "#2a2834"); }
          c.restore();
        }
        if (t < D_WARN + D_OPEN + D_HOLD && Math.floor(t / 5) % 2) { // red beacon above the door
          api.rect(d.x - cx - 6, y0 - 7, 12, 4, "#ff3a2a"); c.globalAlpha = 0.6; glow(c, d.x - cx, y0 - 5, 16, "rgba(255,60,40,0.9)"); c.globalAlpha = 1;
        }
        if (t < D_WARN && Math.floor(t / 6) % 2) api.ptext("!", d.x - cx, y0 + 20, 2, "#ffe060");
      }
    },
  };

  // Electrified floor panels: border crackles (warning), then the plate goes live.
  const E_IDLE = 170, E_WARN = 50, E_LIVE = 80, E_CYC = E_IDLE + E_WARN + E_LIVE, EW = 20, EH = 7;
  const panels = {
    init: () => ({ list: [[760, 185, 0], [900, 200, 110], [1380, 190, 60], [1610, 178, 170], [1860, 196, 30], [2040, 188, 130], [2230, 180, 200]].map(([x, y, t]) => ({ x, y, t })) }),
    update(st, api, p) {
      for (const q of st.list) {
        q.t = (q.t + 1) % E_CYC;
        if (q.t === E_IDLE + E_WARN && onScr(api, q.x, 0)) api.SFX.zap();
        if (q.t < E_IDLE + E_WARN) { q.hit = null; continue; }
        q.hit = q.hit || new Set();
        if (canHurt(p) && !q.hit.has(p) && p.z < 3 && Math.abs(p.x - q.x) < EW && Math.abs(p.y - q.y) < EH) { q.hit.add(p); api.hurtPlayer(1, false, p.y < q.y ? -1 : 1); api.fx("spark", p.x, p.y - 10, 10); }
        for (const e of api.enemies) if (hittable(e) && !q.hit.has(e) && e.z < 3 && Math.abs(e.x - q.x) < EW && Math.abs(e.y - q.y) < EH) { q.hit.add(e); api.hitEnemy(e, 2, true, e.x < q.x ? -1 : 1); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const q of st.list) {
        const x = Math.round(q.x - cx), y = q.y; if (x < -40 || x > api.W + 40) continue;
        const warn = q.t >= E_IDLE && q.t < E_IDLE + E_WARN, live = q.t >= E_IDLE + E_WARN;
        const im = prImg();
        if (im) { // painted hazard plate (same 42x16 footprint); warning flashes the stripes, live floods it blue
          prDraw(c, im, PRF.panel, x - EW - 1, y - EH - 1, EW * 2 + 2, EH * 2 + 2);
          if (live || (warn && q.t % 6 < 3)) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = live ? 0.45 : 0.3; api.rect(x - EW, y - EH, EW * 2, EH * 2, live ? "#2a8ae0" : "#c8b020"); c.restore(); }
        } else {
        api.rect(x - EW - 1, y - EH - 1, EW * 2 + 2, EH * 2 + 2, "#0c0a12");
        for (let i = 0; i < EW * 2; i += 4) { const col = (i / 4) % 2 ? "#1a1a1a" : warn && q.t % 6 < 3 ? "#fff36a" : "#c8a020"; api.rect(x - EW + i, y - EH, 4, 1, col); api.rect(x - EW + i, y + EH - 1, 4, 1, col); }
        api.rect(x - EW + 1, y - EH + 2, EW * 2 - 2, EH * 2 - 4, live ? "#2a6aa0" : "#26242e");
        for (let i = -EW + 4; i < EW; i += 6) api.rect(x + i, y - EH + 2, 1, EH * 2 - 4, live ? "#7fdcff" : "#34323e");
        }
        if (live) {
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.7; glow(c, x, y, 26, "rgba(90,200,255,0.8)");
          c.strokeStyle = "#e8faff"; c.lineWidth = 1; c.beginPath();
          for (let k = 0; k < 3; k++) { let px = x - EW + 2, py = y + api.rnd(-4, 4); c.moveTo(px, py); while (px < x + EW - 2) { px += api.rnd(3, 7); py = y + api.rnd(-5, 5); c.lineTo(Math.min(px, x + EW - 2), py); } }
          c.stroke(); c.restore();
          if (q.t % 3 === 0) for (let k = 0; k < 2; k++) api.rect(x + api.rnd(-EW, EW), y + api.rnd(-EH, EH) - api.rnd(0, 10), 1, 1, "#ffffff");
        } else if (warn) {
          if (q.t % 5 < 2) { const sx = x + api.rnd(-EW, EW), sy = y + api.rnd(-EH, EH); api.rect(sx, sy, 2, 1, "#bfeaff"); api.rect(sx + 1, sy - 2, 1, 2, "#bfeaff"); }
          if (Math.floor(q.t / 6) % 2) api.ptext("!", x, y - 18, 2, "#ffe060");
        }
      }
    },
  };

  // ================= THRONE ROOM =================
  const THRONE_X = 192, DAIS_Y = 166, DAIS_Z = 14, CORE = { x: 192, y: 77 }, RING_Y = 170, RING_K = 0.3;
  const CAGE = { x: 322, y: 168 }, WINDOWS = [{ x: 36, y: 118, s: 1 }, { x: 350, y: 118, s: -1 }];
  const boss = () => A.enemies.find((e) => e.boss);
  function ringTelegraph(n) { if (!G || G.ringTel > 0) return; G.ringTel = 54; G.ringQ = n; A.SFX.charge(); }
  function dropIn(api, type, w) { // henchman smashes through a side window and lands in the arena
    api.spawnEnemy(type);
    const e = api.enemies[api.enemies.length - 1]; if (!e || e.type !== type) return;
    Object.assign(e, { x: w.x + w.s * 6, y: api.rnd(180, 200), z: 46, vz: 1.2, vx: w.s * 1.4, state: "down", t: 0, bounced: false, bowl: false, facing: w.s, entered: true });
    api.SFX.clink(); api.shake(2, 8, true);
    for (let i = 0; i < 16; i++) G.glass.push({ x: w.x + api.rnd(-14, 14), y: w.y + api.rnd(-20, 14), vx: w.s * api.rnd(0.4, 2.2), vy: api.rnd(-1.6, 0.4), t: 0, life: 40 + (Math.random() * 20 | 0) });
  }
  const throneRoom = {
    init: () => { G = fresh(); return {}; },
    update(st, api, p) {
      if (!G) return;
      const b = boss(), fight = b && b.p1go && b.state !== "dying" && !api.STATE.outro;
      G.cageT++;
      if (fight && b.state !== "rage" && --G.ringCd <= 0) { G.ringCd = b.p2 ? 250 + (Math.random() * 60 | 0) : 430; ringTelegraph(b.p2 && Math.random() < 0.6 ? 2 : 1); }
      if (G.ringTel > 0 && --G.ringTel === 0) {
        if (b && b.state !== "dying") for (let i = 0; i < G.ringQ; i++) G.rings.push({ r: -i * 70, hit: new Set() });
        api.SFX.boom(); api.shake(3, 10, true); G.ringN++;
      }
      G.rings = G.rings.filter((R) => {
        R.r += 2.3; if (R.r < 4) return true;
        const test = (x, y, z) => { const d = Math.hypot(x - THRONE_X, (y - RING_Y) / RING_K); return Math.abs(d - R.r) < 6 && z < 5; };
        if (canHurt(p) && !R.hit.has(p) && test(p.x, p.y, p.z)) { R.hit.add(p); api.hurtPlayer(2, false, p.x < THRONE_X ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !R.hit.has(e) && test(e.x, e.y, e.z)) { R.hit.add(e); api.hitEnemy(e, 2, true, e.x < THRONE_X ? -1 : 1); }
        return R.r < 330;
      });
      G.glass = G.glass.filter((g) => { g.t++; g.x += g.vx; g.y += g.vy; g.vy += 0.12; return g.t < g.life; });
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx, t = api.t, tel = G.ringTel > 0, dim = G.coreDim;
      // reactor core: steady pulse, white-hot while charging a ring; powers down in the outro
      c.save(); c.globalCompositeOperation = "lighter";
      const pulse = 0.35 + 0.15 * Math.sin(t * 0.08) + (tel ? 0.45 * (t % 6 < 3 ? 1 : 0.5) : 0);
      c.globalAlpha = Math.max(0, pulse * (1 - dim)); glow(c, CORE.x - cx, CORE.y, tel ? 58 : 40, tel ? "rgba(255,200,255,1)" : "rgba(255,60,220,0.9)");
      if (tel) { c.globalAlpha = 0.5; c.fillStyle = "rgba(255,90,230,0.5)"; c.beginPath(); c.ellipse(THRONE_X - cx, RING_Y, 26 + (54 - G.ringTel) * 0.5, (26 + (54 - G.ringTel) * 0.5) * RING_K, 0, 0, 6.29); c.fill(); }
      c.restore();
      if (dim > 0) { c.globalAlpha = dim * 0.35; api.rect(0, 0, api.W, api.H, "#05030a"); c.globalAlpha = 1; }
      if (tel && Math.floor(G.ringTel / 6) % 2) { api.ptext("!", CORE.x - cx, CORE.y - 34, 3, "#ffe060"); if (G.ringN < 2) api.ptext("JUMP THE RING!", api.W / 2, 44, 1, "#ff9af0"); }
      // shockwave rings on the floor
      for (const R of G.rings) {
        if (R.r < 4) continue;
        const a = Math.max(0, 1 - R.r / 330);
        c.save(); c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(255,70,220,${0.55 * a + 0.2})`; c.lineWidth = 5; c.beginPath(); c.ellipse(THRONE_X - cx, RING_Y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.strokeStyle = `rgba(255,235,255,${0.8 * a + 0.2})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(THRONE_X - cx, RING_Y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.restore();
      }
      // Amber's energy cage (tied, calling for help) or Amber free after the rescue
      const x = CAGE.x - cx, y = CAGE.y, am = api.atlasImg("amber"), AT = api.ATLAS.amber;
      if (!G.amberFree) {
        const pim = prImg();
        if (pim) { prDraw(c, pim, PRF.cageBase, x - 19, y - 14, 38, 22.5); prDraw(c, pim, PRF.cageTop, x - 16, y - 72, 32, 17); } // painted cage projector base + ceiling emitter
        else { c.fillStyle = "#2a2434"; c.beginPath(); c.ellipse(x, y + 1, 17, 5, 0, 0, 6.29); c.fill(); api.rect(x - 15, y - 64, 30, 5, "#2a2434"); api.rect(x - 15, y - 64, 30, 1, "#6a6080"); }
        const help = G.cageT % 240 < 80;
        if (am) { api.contactShadow(x, y, 0, 9); api.drawFrame(am, help ? AT.shout : AT.tied, x, y, 52 / 136, 1); } else api.rect(x - 6, y - 50, 12, 50, "#f2c21a");
        c.save(); c.globalCompositeOperation = "lighter";
        for (let i = -12; i <= 12; i += 6) { c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.3 + i); api.rect(x + i, y - 60, 1, 59, "#ff6af0"); }
        c.globalAlpha = 0.25; glow(c, x, y - 30, 26, "rgba(255,80,230,0.8)"); c.restore();
        if (help && G.cageT % 240 > 10 && !api.STATE.outro) api.bubble(x - 8, y - 70, G.cageT % 480 < 240 ? "HELP!" : "HURRY, GUYS!", "#e8302a", 7);
      } else if (am) { api.contactShadow(x, y, 0, 9); api.drawFrame(am, AT.free, x, y - (G.amberHop || 0), 54 / 150 * 1.05, 1); }
      // glass shards from the side windows
      const gim = prImg();
      for (let i = 0; i < G.glass.length; i++) { // painted glass shards tumbling (fallback: 2px chips)
        const g = G.glass[i];
        if (!gim) { api.rect(g.x - cx, g.y, 2, 1, g.t % 6 < 3 ? "#e8f4ff" : "#8ac8ff"); continue; }
        const F = PRF.glass[i % 7], k = 0.32 + (i % 3) * 0.08;
        c.save(); c.globalAlpha = Math.min(1, (g.life - g.t) / 12); c.translate(Math.round(g.x - cx), Math.round(g.y)); c.rotate(g.t * (0.2 + (i % 4) * 0.08) + i);
        c.drawImage(gim, F[0], F[1], F[2], F[3], -F[2] * k / 2, -F[3] * k / 2, F[2] * k, F[3] * k); c.restore();
      }
    },
  };

  // ================= THE FINAL BOSS: RAZORBACK =================
  const SCALE = 1.42; // kept for the boss cfg (engine-side sizing); the painted sheet below is drawn at RZ_SK
  // Painted sheet levels/level8_razorback.webp (same character as atlas_razor.webp, which stays untouched for Level 1).
  // Frames [x, y, w, h, anchorX]: anchorX = hip centre (cape excluded), drawn on the boss x like level15's spr().
  // Idle is 190 px tall -> 82 world px at RZ_SK, the same height the old scaled razor atlas had.
  const RZ_IMG = "levels/level8_razorback.webp", RZ_SK = 82 / 190;
  const RZF = {
    idle: [0,  1,  100,  190,  42],
    walk1: [104,  3,  87,  188,  40],
    walk2: [195,  7,  104,  184,  45],
    guard: [303,  11,  128,  180,  57],
    wind: [435,  17,  133,  174,  59],
    punch: [572,  15,  201,  176,  91],
    charge: [777,  19,  246,  172,  103],
    leap: [1027,  0,  158,  191,  98],
    slam: [1189,  34,  152,  157,  81],
    throw: [1345,  7,  204,  184,  82],
    fire: [1553,  15,  193,  176,  78],
    summon: [1750,  0,  242,  191,  125],
    hurt: [1996,  15,  144,  176,  81],
    down: [2144,  113,  224,  78,  112],
    ko: [2372,  115,  233,  76,  116],
    getup: [2609,  50,  149,  141,  85],
  };
  let RZ_RED = null; // red-washed copy of the sheet for telegraph flashes (built lazily, works without ctx.filter)
  function rzRed(api) {
    if (RZ_RED) return RZ_RED;
    const im = api.img(RZ_IMG); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgba(255,40,30,0.62)"; c.fillRect(0, 0, cv.width, cv.height);
    return (RZ_RED = cv);
  }
  function rzSpr(api, F, sx, sy, f, red) { // anchor (hip centre) on sx, not the bbox centre
    const base = api.img(RZ_IMG), im = red ? rzRed(api) || base : base;
    if (!im || (im === base && (!base.complete || !base.naturalWidth))) { api.rect(sx - 14, sy - F[3] * RZ_SK, 28, F[3] * RZ_SK, red ? "#7a1a14" : "#1c1820"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * RZ_SK * f, sy, RZ_SK, f);
  }
  function rzFrame(e) { // painted frame for each boss state
    const s = e.state, t = e.t;
    if (s === "throne") return (t >= 30 && t < 100) ? "guard" : (t >= 140 && t < 210) ? "summon" : "idle";
    if (s === "hop" || s === "dive") return "leap";
    if (s === "slam") return t < 14 ? "guard" : t < 44 ? "leap" : "slam";
    if (s === "tele") return "guard";
    if (s === "charge") return "charge";
    if (s === "kwind") return "wind";
    if (s === "kick") return "punch";
    if (s === "fire") return "fire";
    if (s === "throw") return t < 18 ? "wind" : "throw";
    if (s === "summon" || s === "rage") return "summon";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "down") return t < 6 && e.z > 2 ? "hurt" : "down";
    if (s === "getup") return "getup";
    if (s === "dying") return t < 10 ? "hurt" : "ko";
    if (s === "walk" && e.walkT > 0) { const ph = Math.floor(e.walkT / 9) % 4; return ph === 1 ? "walk1" : ph === 3 ? "walk2" : "idle"; }
    return "idle";
  }
  function hop(e, tx, ty, tz, n, next) { Object.assign(e, { state: "hop", t: 0, h0: [e.x, e.y, e.z], h1: [tx, ty, tz], hn: n, hnext: next }); A.SFX.jump(); }
  function land(api, e, p, r, dmg) {
    api.SFX.boom(); api.shake(4, 14, true); api.STATE.shake = Math.max(api.STATE.shake, 10); api.fx("ring", e.x, e.y, 18); api.dust(e.x - 10, e.y); api.dust(e.x + 10, e.y);
    if (canHurt(p) && p.z < 4 && Math.abs(p.x - e.x) < r && Math.abs(p.y - e.y) < 15) api.hurtPlayer(dmg, false, p.x >= e.x ? 1 : -1);
  }
  const P2CFG = { speed: 1.4, chargeSpeed: 1.45, cool: 64 };
  function pick(api, e, p) {
    const dx = p.x - e.x, dy = p.y - e.y, ax = Math.abs(dx), cfg = e.cfg;
    e.t = 0; e.cool = cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 30 && Math.random() < 0.75) { e.state = "kwind"; return; }
    const opts = ["slam", "throw", "throw"];
    if (Math.abs(dy) < 7) opts.push("tele", "tele");
    if (!(e.sumCd > 0) && api.enemies.length < (e.p2 ? 4 : 3)) opts.push("summon");
    if (e.p2) opts.push("dive", "dive", "fire");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.6) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m;
    if (m === "fire") e.diag = true;
    e.state = m;
  }
  // ---- Boss entrance (entr v1): Razorback rises from the throne as the core flares, vaults off the dais and craters the floor ----
  const RZ_ENTR = {
    len: 175, zoom: 1.3, sub: "LORD OF THE FORTRESS",
    setup(api, e, st) { Object.assign(e, { x: THRONE_X, y: DAIS_Y, z: DAIS_Z, facing: -1, state: "throne", t: 0 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: t < 60 ? 110 : e.y - e.z - 44 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t < 60) { e.state = "throne"; e.t = t < 26 ? 0 : 150; e.x = THRONE_X; e.y = DAIS_Y; e.z = DAIS_Z;
        if (t % 10 === 0) { api.shake(1, 6, false); api.fx("spark", CORE.x + api.rnd(-18, 18), CORE.y + api.rnd(-18, 18), 10); }
        if (t === 26) { api.SFX.charge(); api.shake(3, 16, true); } return; }
      if (t === 60) api.SFX.jump();
      if (t >= 60 && t <= 98) { const k = (t - 60) / 38; e.x = api.lerp(THRONE_X, cxm, k); e.y = api.lerp(DAIS_Y, mid, k); e.z = api.lerp(DAIS_Z, 0, k) + Math.sin(k * Math.PI) * 74; e.state = "hop"; e.t = 5;
        if (t % 3 === 0) api.fx("spark", e.x, e.y - e.z - 30, 8); }
      if (t === 98) { e.z = 0; api.entr.impact(e.x, e.y, 9, { stop: 7 }); api.entr.debris(e.x, e.y, 2, 12, { spread: 2.8, up: 2, w: 22, frames: [api.entr.BITS[1], api.entr.BITS[0]], colors: ["#ff5af0", "#8a3aff", "#3a3448", "#c8ccd8"] });
        for (let i = 0; i < 6; i++) api.fx("spark", e.x + api.rnd(-30, 30), e.y - api.rnd(0, 20), 12); }
      if (t > 98 && t < 120) { e.state = "slam"; e.t = 50; }
      if (t >= 120) { e.state = "summon"; e.t = 2; }
    },
    drawBack(api, st, t, cx) { if (t >= 98) RZ_ENTR.persist(api, st, cx, Math.min(1, (t - 98) / 3)); },
    persist(api, st, cx, k) { api.entr.hole(api.W / 2, (api.floorTop + api.floorBot) / 2 + 2, 30, 7, k === undefined ? 1 : k, "rgba(20,8,30,0.75)", "rgba(255,90,240,0.35)"); },
    finish(api, e) { e.p1go = true; },
  };
  const bossCfg = {
    name: "RAZORBACK", base: "ramrod", atlas: "razor", scale: SCALE, height: 92, hp: 58, speed: 1.1, chargeSpeed: 1.15, cool: 92, pitch: 82,
    moves: ["charge", "kick", "slam", "fire"], shot: "ray",
    lines: {
      intro: "SO THE SHELLS CRAWLED IN AT LAST.",
      hit: ["IMPOSSIBLE!", "YOU DARE STRIKE ME?!", "INSOLENT REPTILES!", "IS THAT ALL, SHELLS?"],
      summon: "GUARDS! THROUGH THE WINDOWS!",
      ko: "NO... MY CORE... MY EMPIRE...!",
    },
    spawn(api, e) { Object.assign(e, { state: "throne", t: 0, x: THRONE_X, y: DAIS_Y, z: DAIS_Z, facing: -1, inv: 999, sumCd: 500 }); },
    entrance: RZ_ENTR,
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "throne") { // seated on the dais: taunt, then leap down into the arena
        e.x = THRONE_X; e.y = DAIS_Y; e.z = DAIS_Z; e.facing = p.x < e.x ? -1 : 1; e.inv = 2;
        if (e.t === 30) api.enemySay(e, bossCfg.lines.intro, 100, 82, true);
        if (e.t === 140) api.enemySay(e, "AMBER STAYS WITH ME. FOREVER!", 90, 82, true);
        if (e.t >= 240) { e.inv = 0; hop(e, THRONE_X, 192, 0, 34, "walk"); e.p1go = true; }
        return true;
      }
      if (e.state === "hop") {
        const k = Math.min(1, e.t / e.hn), [x0, y0, z0] = e.h0, [x1, y1, z1] = e.h1;
        e.x = api.lerp(x0, x1, k); e.y = api.lerp(y0, y1, k); e.z = api.lerp(z0, z1, k) + Math.sin(k * Math.PI) * 50; e.inv = 2;
        if (Math.abs(x1 - x0) > 2) e.facing = x1 > x0 ? 1 : -1;
        if (k >= 1) { e.z = z1; if (z1 === 0) land(api, e, p, 46, 2); e.state = e.hnext; e.t = 0; e.cool = 50; }
        return true;
      }
      if (e.state === "rage") { // phase 2 transition, standing on the dais while the core overloads
        e.inv = 2;
        if (!e.rageHop) { e.rageHop = e.rageLock = true; api.enemySay(e, "ENOUGH! THE CORE OBEYS ME!", 110, 76, true); hop(e, THRONE_X, DAIS_Y, DAIS_Z, 30, "rage"); return true; }
        e.x = THRONE_X; e.y = DAIS_Y; e.z = DAIS_Z; e.facing = p.x < e.x ? -1 : 1;
        if (e.t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-14, 14), e.y - e.z - api.rnd(20, 70), 10); }
        if (e.t === 60) { dropIn(api, "dasher", WINDOWS[0]); dropIn(api, "gunner", WINDOWS[1]); }
        if (e.t === 70) { G.ringTel = 0; ringTelegraph(2); }
        if (e.t >= 170) {
          e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2CFG); e.rageLock = false; e.sumCd = 700;
          api.playerBark(true, "HE'S SUPERCHARGED! STAY SHARP!");
          hop(e, THRONE_X + (p.x < THRONE_X ? -50 : 50), 194, 0, 34, "walk");
        }
        return true;
      }
      if (e.state === "walk" && !e.p2 && !e.rageLock && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; return true; }
      if (e.state === "walk" && free && e.cool <= 1) { pick(api, e, p); return true; }
      if (e.state === "throw") { // razor-disc fan (3 discs, 5 in phase 2)
        const n = e.p2 ? 5 : 3;
        if (e.t === 20) {
          e.facing = p.x >= e.x ? 1 : -1;
          for (let i = 0; i < n; i++) { const vy = (i - (n - 1) / 2) * (e.p2 ? 0.5 : 0.6); api.shot({ x: e.x + e.facing * 22, y: e.y, vx: e.facing * (e.p2 ? 3.1 : 2.7), vy, kind: "disc", draw: drawDisc }); }
          api.SFX.shuriken();
        }
        if (e.t >= 44) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "summon") {
        if (e.t === 16) {
          api.enemySay(e, bossCfg.lines.summon, 80, 82);
          const types = e.p2 ? ["blue", "heavy"] : ["purple", "dasher"];
          dropIn(api, types[0], WINDOWS[0]); dropIn(api, types[1], WINDOWS[1]); e.sumCd = e.p2 ? 720 : 900;
        }
        if (e.t >= 46) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "dive") { // phase 2: vaults out of sight, a red target tracks you, then he crashes down
        e.inv = 2;
        if (e.t === 1) { e.d0 = [e.x, e.y]; api.SFX.jump(); }
        if (e.t <= 18) { e.z = (e.t / 18) * 230; return true; }
        if (e.t < 74) { e.tx = api.lerp(e.tx || p.x, p.x, 0.12); e.ty = api.lerp(e.ty || p.y, p.y, 0.12); e.x = e.tx; e.y = e.ty; e.z = 230; if (e.t === 60) api.SFX.charge(); return true; }
        if (e.t < 90) { e.z = Math.max(0, 230 * (1 - (e.t - 74) / 16)); return true; }
        e.z = 0; land(api, e, p, 44, 2); e.state = "stagger"; e.t = 0; e.vx = 0; e.inv = 0; e.tx = e.ty = 0; // open to a counter-attack
        return true;
      }
      return false; // charge / kick / slam / fire / hurt etc: the engine's Ramrod moves
    },
    draw(api, e, sx, sy) {
      const s = e.state, t = e.t;
      if (s === "dive" && e.t > 18 && e.t < 90) { // target reticle on the floor while he is airborne
        const c = api.ctx, gx = e.x - api.camX, gy = e.y, r = 16 - Math.min(10, (e.t - 18) / 6);
        c.strokeStyle = t % 6 < 3 ? "#ff3a3a" : "#ffe060"; c.lineWidth = 1; c.beginPath(); c.ellipse(gx, gy, r, r * 0.35, 0, 0, 6.29); c.stroke();
        api.rect(gx - 1, gy - 5, 2, 10, "#ff3a3a"); api.rect(gx - r - 3, gy, 6, 1, "#ff3a3a"); api.rect(gx + r - 3, gy, 6, 1, "#ff3a3a");
        if (e.z > 200) return;
      }
      const red = (s === "tele" && t % 6 < 3) || ((s === "slam" || s === "throw" || s === "kwind") && t < 14 && t % 6 < 3) || (s === "dive" && t < 10 && t % 4 < 2);
      const c = api.ctx;
      if (e.p2 || s === "rage") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35 + 0.2 * Math.sin(api.t * 0.2); glow(c, sx, sy - 40, 46, "rgba(255,50,200,0.8)"); c.restore(); }
      const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : s === "kwind" ? -e.facing : 0;
      rzSpr(api, RZF[rzFrame(e)], sx + jx, sy, e.facing, red);
      if (s === "rage" || (e.p2 && api.t % 24 < 2)) { c.save(); c.strokeStyle = "#ffb0f4"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 2; i++) { let x = sx + api.rnd(-16, 16), y = sy - 80; c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += api.rnd(-6, 6); y += 14; c.lineTo(x, y); } } c.stroke(); c.restore(); }
    },
    onDefeat(api) { if (G) { G.rings = []; G.ringTel = 0; } },
  };
  function drawDisc(api, s, sx, sy) { // spinning razor disc
    const c = api.ctx, a = api.t * 0.6;
    c.save(); c.translate(Math.round(sx), Math.round(sy));
    c.fillStyle = "#c8ccd8"; c.beginPath();
    for (let i = 0; i < 8; i++) { const an = a + i * Math.PI / 4, r = i % 2 ? 2.5 : 6; c.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.45); }
    c.closePath(); c.fill(); c.strokeStyle = "#ff5af0"; c.lineWidth = 0.6; c.stroke(); c.fillStyle = "#3a3448"; c.beginPath(); c.ellipse(0, 0, 1.6, 0.9, 0, 0, 6.29); c.fill();
    c.restore();
  }

  // ================= OUTRO: rescue Amber, the brothers regroup, cliffhanger =================
  const OTHERS = (me) => ["lenny", "rafe", "miko", "donny"].filter((n) => n !== me);
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro (see NOTES.md)
      if (t === 1) { Object.assign(st, { broke: 0, bros: [], fw: [], conf: [] }); G = G || fresh(); G.rings = []; }
      if (!st.broke) { // walk up to the cage
        const tx = CAGE.x - 26, ty = CAGE.y + 8, dx = tx - p.x, dy = ty - p.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { p.x += Math.sign(dx) * Math.min(1.7, Math.abs(dx)); p.y += Math.sign(dy) * Math.min(1, Math.abs(dy)); p.walkT++; p.facing = 1; }
        else p.walkT = 0;
        if (t === 20) api.playerBark(true, "AMBER! HANG ON!");
        if ((Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && t > 70) || t > 240) {
          st.broke = t; p.walkT = 0; p.facing = 1; G.amberFree = true; api.SFX.finisher(); api.SFX.boom(); api.shake(4, 20, true);
          api.fx("boom", CAGE.x, CAGE.y - 30, 36); for (let i = 0; i < 6; i++) api.fx("spark", CAGE.x + api.rnd(-14, 14), CAGE.y - api.rnd(10, 60), 12);
        }
        return false;
      }
      const k = t - st.broke;
      if (k === 30) st.amberSay = 120;
      if (k === 120) api.playerBark(true, "LET'S GO HOME, AMBER!");
      if (k > 140 && k < 200) G.coreDim = Math.min(1, (k - 140) / 60) * (k % 8 < 6 ? 1 : 0.6); // reactor powers down
      if (k === 150) { api.SFX.rumble(); api.shake(3, 30, true); }
      if (k === 170) OTHERS(p.bro.name.toLowerCase()).forEach((n, i) => st.bros.push({ n, x: -20 - i * 26, y: 186 + i * 9, tx: 70 + i * 34, z: 0 }));
      for (const b of st.bros) { if (b.x < b.tx) { b.x += 2.2; b.walk = (b.walk || 0) + 1; } else b.cheer = (b.cheer || 0) + 1; b.z = b.cheer ? Math.abs(Math.sin(b.cheer * 0.14 + b.tx)) * 14 : 0; }
      if (k > 230) { G.amberHop = Math.abs(Math.sin(k * 0.12)) * 8; p.z = Math.abs(Math.sin(k * 0.13 + 1)) * 10; }
      if (k === 240) { api.SFX.confirm(); st.endT = 0; }
      if (st.endT !== undefined) {
        st.endT++;
        if (st.endT % 34 === 1) { st.fw.push({ x: api.rnd(40, api.W - 40), y: api.rnd(24, 90), t: 0, c: ["#ffe060", "#ff6af0", "#7fdcff", "#7fd85a", "#ff8c1a"][st.fw.length % 5] }); if (st.endT < 300) api.SFX.boom(); }
        if (st.conf.length < 90 && st.endT % 2 === 0) st.conf.push({ x: api.rnd(0, api.W), y: -4, vx: api.rnd(-0.4, 0.4), vy: api.rnd(0.6, 1.3), c: ["#ffe060", "#ff6af0", "#7fdcff", "#7fd85a", "#ff8c1a", "#ffffff"][Math.random() * 6 | 0] });
        for (const f of st.conf) { f.x += f.vx + Math.sin((f.y + f.x) * 0.05) * 0.3; f.y += f.vy; if (f.y > api.H) f.y = -4; }
        st.fw = st.fw.filter((f) => ++f.t < 60);
      }
      if (st.amberSay > 0) st.amberSay--;
      if (k > 640) { p.z = 0; return true; }
      return false;
    },
    draw(api, st, t, cx) {
      if (!st.bros) return;
      const c = api.ctx;
      for (const b of st.bros) { // the other brothers rush in and celebrate
        const im = api.atlasImg(b.n), F = api.ATLAS[b.n]; if (!F) continue;
        const sx = b.x - cx, fr = b.z > 2 ? F.jump : b.walk && b.x < b.tx && Math.floor(b.walk / 8) % 2 ? F.walk : F.idle;
        api.contactShadow(sx, b.y, b.z, 10);
        if (im) api.drawFrame(im, fr, sx, b.y - b.z, 42 * 1.6 * 0.92 / 150, 1); else api.rect(sx - 6, b.y - b.z - 30, 12, 30, "#3fae3a");
      }
      if (st.amberSay > 0) api.bubble(CAGE.x - cx - 4, CAGE.y - 66, "MY HEROES! YOU CAME!", "#e8302a", 7);
      if (st.endT === undefined) return;
      const e = st.endT;
      for (const f of st.fw) { // fireworks
        const k = f.t / 60, r = 6 + k * 34;
        c.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        for (let i = 0; i < 14; i++) { const an = i * 0.449; api.rect(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r + k * k * 12, 2, 2, i % 3 ? f.c : "#ffffff"); }
        c.globalAlpha = 1;
      }
      for (const f of st.conf) api.rect(f.x, f.y, (f.x | 0) % 3 ? 2 : 1, (f.y | 0) % 4 < 2 ? 1 : 2, f.c);
      const a = Math.min(1, e / 25);
      c.globalAlpha = 0.45 * a; api.rect(0, 26, api.W, 74, "#05030a"); c.globalAlpha = a;
      const sc = e < 12 ? 6 - Math.floor(e / 4) : 3;
      api.ptext("TO BE CONTINUED", api.W / 2, 54, sc, e % 20 < 10 ? "#ffe060" : "#ffb21a");
      if (e > 40) api.ptext("AMBER IS SAFE... BUT THE CORE IS UNSTABLE!", api.W / 2, 80, 1, "#ffffff");
      if (e > 90) api.ptext("A RIFT TEARS OPEN... TO BE CONTINUED IN TIME...", api.W / 2, 93, 1, "#ff9af0");
      c.globalAlpha = 1;
    },
  };

  SS.registerLevel({
    number: 8,
    name: "FORTRESS OF RAZORBACK",
    card: { title: "FORTRESS OF RAZORBACK", tagline: "THE FINAL SHOWDOWN. BRING AMBER HOME.", color: "#c43aff" },
    music, bossMusic,
    // painted regular enemies (guard family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_guard.webp", ENEMY_F = { light: {"idle":[4,1,93,167,40],"walk":[101,0,89,168,40],"walk2":[194,0,92,168,45],"attack":[290,8,144,160,61],"jump":[438,39,144,129,55],"hurt":[586,19,91,149,57],"down":[681,130,181,38,90],"dash":[866,59,134,109,85]}, weapon: {"idle":[4,172,64,171,30],"walk":[72,175,76,168,29],"walk2":[152,175,75,168,36],"attack":[231,179,150,164,73],"jump":[385,181,100,162,42],"hurt":[489,191,102,152,50],"down":[595,303,184,40,92],"throw":[783,185,129,158,57]}, big: {"idle":[4,347,96,168,44],"walk":[104,347,103,168,51],"walk2":[211,347,102,168,53],"attack":[317,347,138,168,46],"grab":[459,347,138,168,54],"jump":[601,349,96,166,42],"hurt":[701,355,122,160,57],"down":[827,466,189,49,94],"shoot":[1020,349,130,166,38]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { gunner: 190, heavy: 215, purple: 280, blue: 200, sword: 300, dasher: 320, star: 260 },
    images: [RZ_IMG, PR_IMG],
    sections: [
      { bg: BG1, floor: [172, 205], length: 2600, locks: [0, 620, 1300, 1950],
        waves: [["purple", "gunner", "purple"], ["sword", "gunner", "dasher", "purple"], ["heavy", "gunner", "blue", "star"], ["heavy", "gunner", "dasher", "sword", "gunner"]],
        grade: null, weather: "embers", hazards: [lasers, vents, doors, panels],
        onUpdate() { if (!G) G = fresh(); },
        sky: "#140c1e", ground: "#2a2632" },
      { bg: BG2, floor: [166, 214], length: 384, locks: [], waves: [], hazards: [throneRoom], sky: "#1a0c24", ground: "#3a2c44" },
    ],
    restructure: { // phase 2: fortress corridor (zone 1) -> lockdown searchlights (twist) -> reactor hangar (zone 2) -> existing throne room
      split: 0, images: ["levels/level8_sentry.webp", "levels/level8_reactor.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "searchlight", title: "LOCKDOWN SWEEP!", sub: "STAY OUT OF THE LIGHTS - HIDE BEHIND COVER", len: 2100, img: "levels/level8_sentry.webp", fr: {"lamp": [0, 0, 84, 116], "lampRed": [87, 0, 84, 118], "klaxon": [174, 0, 40, 55], "cover": [217, 0, 140, 79], "alcove": [360, 0, 120, 141]},
        lights: [{ y: 30, spd: 0.012 }, { y: 30, spd: 0.017 }], covers: [{ spr: "cover", x: 92, w: 52, d: 16, k: 0.36 }, { spr: "cover", x: 300, w: 52, d: 16, k: 0.36 }],
        alarm: ["purple", "gunner"], drip: ["purple"], gap: 320, cap: 2, color: "#ff7af0" },
      z2bg: "levels/level8_reactor.jpg", z2: { hazards: [vents, doors, panels] },
    },
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; lasers.init = vents.init = doors.init = panels.init = throneRoom.init = null; },
  });
})();
