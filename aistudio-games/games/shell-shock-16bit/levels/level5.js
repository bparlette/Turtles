// Level 5: DOCKSIDE DOUBLE-CROSS. Built only on the public plugin API (window.SS); see ss_level_api.md.
// Night-time harbour. Hazards: swinging crane hooks (hauled back as a warning), cargo crates dropping from
// above (growing shadow), roll-up warehouse doors that open to let enemies out, and a runaway forklift.
// Boss on the cargo-ship deck: GRIMWALE, a bosun with a harpoon gun and an anchor on a chain; adds climb
// out of the deck hatches. The outro points the brothers uptown, where it has started to snow (Level 6).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---------------- Music: an original rolling sea-shanty groove (A minor, 126 BPM) ----------------
  const CH = ["Am", "Am", "G", "G", "Am", "Am", "E", "E", "F", "F", "C", "C", "Dm", "E", "Am", "Am"];
  const music = A.track({ bpm: 126, loop: true, chords: CH,
    lead: ["A4:4 C5:2 E5:2 A5:4 E5:4", "C5:2 D5:2 E5:4 D5:2 C5:2 A4:4", "G4:4 B4:2 D5:2 G5:4 D5:4", "B4:2 C5:2 D5:4 C5:2 B4:2 G4:4",
      "A4:2 A4:2 C5:2 E5:2 A5:3 G5:1 E5:4", "C6:2 B5:2 A5:2 G5:2 E5:4 .:4", "E5:4 G#5:2 B5:2 E5:4 B4:4", "E5:2 F5:2 E5:2 D5:2 B4:4 G#4:4",
      "F5:4 A5:2 C6:2 A5:4 F5:4", "A5:2 G5:2 F5:4 E5:2 D5:2 C5:4", "C5:4 E5:2 G5:2 C6:4 G5:4", "E5:2 F5:2 G5:4 E5:2 D5:2 C5:4",
      "D5:4 F5:2 A5:2 D6:4 A5:4", "B5:4 .:2 G#5:2 E5:4 .:4", "A5:3 G5:1 E5:2 C5:2 E5:2 G5:2 A5:4", "A5:4 E5:2 C5:2 A4:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 7, 12, 7, 0, 7, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k..hs.h.k.hhs..h", 15).concat(["k.s.k.s.s.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -1, 168);

  // ---------------- small drawing helpers ----------------
  const R = (x) => Math.round(x);
  function warnMark(api, x, y, t) { if (Math.floor(t / 6) % 2) api.ptext("!", R(x), R(y), 2, "#ffe060"); }
  function crateArt(api, x, y, w, h) {
    api.rect(x, y, w, h, "#7a5530"); api.rect(x, y, w, 2, "#a8784a"); api.rect(x, y + h - 2, w, 2, "#4a3018");
    api.rect(x, y, 2, h, "#5a3a1e"); api.rect(x + w - 2, y, 2, h, "#5a3a1e");
    const c = api.ctx; c.strokeStyle = "#5a3a1e"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 2, y + h - 2); c.lineTo(x + w - 2, y + 2); c.stroke();
    api.rect(x + 3, y + 3, 4, 2, "#d8c8a0");
  }
  // Painted stage props (levels/level5_props.webp, keyed from chroma-green renders) and the dark interiors seen
  // behind an opening door / hatch (levels/level5_holds.jpg). Frames [x, y, w, h] in sheet px.
  const PR_IMG = "levels/level5_props.webp", HOLD_IMG = "levels/level5_holds.jpg";
  const PRF = { fork: [0, 0, 328, 202], hook: [332, 0, 60, 169], crate: [396, 0, 100, 99], klax: [500, 0, 48, 71], klaxOff: [552, 0, 48, 71], shutter: [0, 206, 420, 48] };
  const HOLDF = { dock: [0, 0, 300, 290], ship: [304, 0, 220, 200] };
  const ready = (im) => im && im.complete && im.naturalWidth;
  function prop(api, F, x, y, w, h) { const im = api.img(PR_IMG); if (!ready(im)) return false; api.ctx.drawImage(im, F[0], F[1], F[2], F[3], x, y, w, h); return true; }
  function crateSpr(api, x, y) { // crate: 24 world px wide, bottom-centre at (x, y); old code crate as load fallback
    if (!prop(api, PRF.crate, x - 12, y - 24, 24, 24 * PRF.crate[3] / PRF.crate[2])) crateArt(api, x - 12, y - 20, 24, 20);
  }
  const onScreenX = (api, x, pad) => x > api.camX - pad && x < api.camX + api.W + pad;
  const canHit = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);

  // ---------------- Hazard: roll-up doors / ship hatches that let enemies out ----------------
  // Each door is a world rect; when the engine is about to spawn the next queued enemy (STATE.spawnT counting
  // down), a visible door rattles and rolls up, and the enemy that appears is moved into the doorway.
  function makeDoors(list, kind) {
    return {
      init: () => ({ doors: list.map((d) => ({ x0: d[0], x1: d[1], y0: d[2], y1: d[3], open: 0, want: 0, hold: 0, alarm: 0 })), armed: null, force: 0, known: new WeakSet() }),
      update(st, api) {
        const S = api.STATE, vis = st.doors.filter((d) => d.x0 >= api.camX + 4 && d.x1 <= api.camX + api.W - 4);
        if (!st.armed && S.queue.length && S.enemies.length < 5 && S.spawnT > 25 && vis.length && Math.random() < 0.7) {
          const free = vis.filter((d) => d.open < 0.05 && !d.hold);
          if (free.length) { st.armed = free[Math.random() * free.length | 0]; st.armed.want = 1; st.armed.hold = 999; api.SFX.door(); }
        }
        for (const e of api.enemies) {
          if (st.known.has(e)) continue;
          st.known.add(e);
          if (e.boss || e.state !== "walk" || e.t > 2) continue;
          let d = st.armed && st.armed.open > 0.5 ? st.armed : null;
          if (!d && st.force > 0 && vis.length) { d = vis[Math.random() * vis.length | 0]; d.want = 1; d.open = Math.max(d.open, 0.3); }
          if (!d) continue;
          if (st.force > 0) st.force--;
          e.x = (d.x0 + d.x1) / 2 + api.rnd(-10, 10); e.y = api.floorTop + 1; e.facing = api.player.x < e.x ? -1 : 1;
          api.fx("smoke", e.x, e.y - 12, 22); d.hold = 70; if (d === st.armed) st.armed = null;
        }
        if (st.armed && !S.queue.length) { st.armed.hold = 40; st.armed = null; }
        for (const d of st.doors) {
          if (d.alarm > 0) d.alarm--;
          if (d.hold > 0 && d.hold < 999 && --d.hold === 0) d.want = 0;
          d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), d.want ? 0.035 : 0.025);
        }
      },
      drawBack(st, api, cx) {
        const c = api.ctx;
        for (const d of st.doors) {
          const x0 = R(d.x0 - cx), w = R(d.x1 - d.x0), y0 = d.y0, h = d.y1 - d.y0;
          if (x0 > api.W || x0 + w < 0) continue;
          const lit = d.alarm > 0 && Math.floor(d.alarm / 5) % 2;
          if (kind === "ship") prop(api, lit ? PRF.klax : PRF.klaxOff, R(x0 + w / 2 - 7), y0 - 21, 14, 20.7); // painted klaxon over the hatch
          if (lit) { // klaxon glow
            c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,60,30,0.22)"; c.fillRect(x0 - 4, y0 - 10, w + 8, h + 10); c.restore();
          }
          const rattle = d.want && d.open < 0.12 ? (api.t % 4 < 2 ? 1 : 0) : 0;
          if (d.open <= 0.01) continue;
          const oh = R(h * d.open), by = R(y0 + h - oh);
          const hold = api.img(HOLD_IMG), HF = HOLDF[kind === "ship" ? "ship" : "dock"];
          if (ready(hold)) { // painted interior, revealed from the floor up as the door rolls up
            const sh = HF[3] * d.open; c.drawImage(hold, HF[0], HF[1] + HF[3] - sh, HF[2], sh, x0 + 3, by, w - 6, oh);
            const sg = c.createLinearGradient(0, by, 0, by + 14); sg.addColorStop(0, "rgba(0,0,0,0.75)"); sg.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = sg; c.fillRect(x0 + 3, by, w - 6, Math.min(oh, 14)); // shadow under the rolled-up door
          } else { const g = c.createLinearGradient(0, by, 0, y0 + h); g.addColorStop(0, "#030306"); g.addColorStop(1, kind === "ship" ? "#1e1610" : "#24180e"); c.fillStyle = g; c.fillRect(x0 + 3, by, w - 6, oh); }
          c.save(); c.globalCompositeOperation = "lighter"; const gl = c.createLinearGradient(0, y0 + h * 0.3, 0, y0 + h); gl.addColorStop(0, "rgba(255,160,70,0)"); gl.addColorStop(1, "rgba(255,160,70,0.16)");
          c.fillStyle = gl; c.fillRect(x0 + 3, by, w - 6, oh); c.restore();
          const rh = (w - 4) * PRF.shutter[3] / PRF.shutter[2]; // painted bottom slats + rail of the roll-up door
          if (!prop(api, PRF.shutter, x0 + 2, by - rh + 1 + rattle, w - 4, rh)) { api.rect(x0 + 2, by - 4 + rattle, w - 4, 4, "#4a4e58"); api.rect(x0 + 2, by - 4 + rattle, w - 4, 1, "#7a808c"); }
        }
      },
    };
  }
  const T = 833; // the dock strip (1904 px wide, edges cross-faded) tiles every 1904 * 224/512 = 833 world px
  const DOCK_DOORS = []; for (let k = 0; k < 3; k++) for (const d of [[126, 231], [330, 433], [536, 637]]) if (d[1] + k * T < 1720) DOCK_DOORS.push([d[0] + k * T, d[1] + k * T, 58, 158]);
  const dockDoors = makeDoors(DOCK_DOORS, "dock");
  const hatches = makeDoors([[25, 92, 95, 158], [201, 269, 95, 158], [370, 438, 95, 158]], "ship");

  // ---------------- Hazard: swinging crane hooks ----------------
  // Idle, then hauled back on its cable (shakes, "!", striped swing path on the floor) for 54 frames, then released.
  const HAUL = 54, SWING = 190;
  const craneHooks = {
    init: () => ({ list: [{ px: 765, lane: 190, ph: "idle", t: 0, wait: 140 }, { px: 1440, lane: 180, ph: "idle", t: 0, wait: 60 }] }),
    update(st, api, p) {
      for (const h of st.list) {
        h.t++;
        const L = h.lane - 18 + 34, Amax = 0.62;
        if (h.ph === "idle") { h.th = Math.sin(h.t * 0.03) * 0.04; if (h.t > h.wait && api.STATE.locked && onScreenX(api, h.px, -40)) { h.ph = "haul"; h.t = 0; h.dir = p.x < h.px ? 1 : -1; api.SFX.rumble(); } }
        else if (h.ph === "haul") { h.th = h.dir * Amax * Math.min(1, h.t / (HAUL - 8)); if (h.t >= HAUL) { h.ph = "swing"; h.t = 0; h.hit = new Set(); api.SFX.swing(); } }
        else {
          const w = 2 * Math.PI / 92, dec = Math.exp(-h.t / 150);
          const th0 = h.th; h.th = h.dir * Amax * Math.cos(w * h.t) * dec;
          if (Math.sign(th0) !== Math.sign(h.th)) { h.hit = new Set(); if (dec > 0.35 && onScreenX(api, h.px, 0)) api.SFX.swing(); }
          const hx = h.px + Math.sin(h.th) * L, z = h.lane - (-34 + Math.cos(h.th) * L), fast = dec > 0.3;
          if (fast && z < 34) {
            const dir = Math.sign(h.th0v = h.th - th0) || 1;
            if (!h.hit.has(p) && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - hx) < 10 && Math.abs(p.y - h.lane) < 7 && p.z < 26) { h.hit.add(p); api.hurtPlayer(2, false, dir); api.shake(3, 10, true); }
            for (const e of api.enemies) if (canHit(e) && !h.hit.has(e) && Math.abs(e.x - hx) < 10 && Math.abs(e.y - h.lane) < 7) { h.hit.add(e); api.hitEnemy(e, 2, true, dir); }
          }
          if (h.t >= SWING) { h.ph = "idle"; h.t = 0; h.wait = 200 + (Math.random() * 120 | 0); }
        }
      }
    },
    drawBack(st, api, cx) { // floor: shadow + (while hauling) the swing path
      const c = api.ctx;
      for (const h of st.list) {
        const L = h.lane - 18 + 34, x = h.px - cx; if (x < -120 || x > api.W + 120) continue;
        if (h.ph === "haul") {
          const half = Math.sin(0.62) * L;
          for (let u = -half; u < half; u += 8) api.rect(R(x + u), h.lane - 1, 4, 3, Math.floor((u + api.t) / 8) % 2 ? "rgba(255,200,40,0.55)" : "rgba(20,20,20,0.5)");
        }
        const hx = x + Math.sin(h.th || 0) * L, z = h.lane - (-34 + Math.cos(h.th || 0) * L);
        c.fillStyle = "rgba(0,0,0," + (0.45 - Math.min(0.25, z / 200)).toFixed(2) + ")"; c.beginPath(); c.ellipse(hx, h.lane, 7 + z / 12, 2.5, 0, 0, 6.29); c.fill();
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const h of st.list) {
        const L = h.lane - 18 + 34, x = h.px - cx; if (x < -120 || x > api.W + 120) continue;
        const jit = h.ph === "haul" && h.t % 4 < 2 ? 1 : 0, th = h.th || 0;
        const hx = x + Math.sin(th) * L + jit, hy = -34 + Math.cos(th) * L;
        const im = api.img(PR_IMG), HK = PRF.hook, rot = -th * 0.6, kk = 0.3, top = -36; // painted hook block (18x51), top of block 36 px above (hx, hy)
        const ex = hx - Math.sin(rot) * top, ey = hy + Math.cos(rot) * top; // where the cable meets the block (rotated)
        c.strokeStyle = "#1a1a1e"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, -34); c.lineTo(ready(im) ? ex : hx, ready(im) ? ey : hy - 8); c.stroke();
        c.save(); c.translate(R(hx), R(hy)); c.rotate(rot);
        if (ready(im)) c.drawImage(im, HK[0], HK[1], HK[2], HK[3], -HK[2] * kk / 2, top, HK[2] * kk, HK[3] * kk);
        else { c.scale(1.6, 1.6); api.rect(-5, -12, 10, 6, "#c89a18"); c.strokeStyle = "#9aa0aa"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 2); c.arc(-4, 2, 4, 0, Math.PI * 0.95); c.stroke(); }
        c.restore();
        if (h.ph === "haul") warnMark(api, hx, hy - 30, h.t);
      }
    },
  };

  // ---------------- Hazard: crates dropping from above (shadow telegraph) ----------------
  const FALL0 = 60, FALL = 12, SIT = 70;
  function makeCrates(active, gap) {
    return {
      init: () => ({ list: [], next: 120 }),
      update(st, api, p) {
        if (active(api) && p.deadT === 0 && --st.next <= 0) {
          st.next = gap[0] + (Math.random() * gap[1] | 0);
          const x = Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x + api.rnd(-26, 26))), y = Math.max(api.floorTop + 4, Math.min(api.floorBot - 2, p.y + api.rnd(-8, 8)));
          st.list.push({ x, y, t: 0 });
        }
        st.list = st.list.filter((k) => {
          k.t++;
          if (k.t === FALL0) api.SFX.swing();
          if (k.t === FALL0 + FALL) {
            api.SFX.boom(); api.shake(3, 12, true); api.dust(k.x - 8, k.y); api.dust(k.x + 8, k.y); api.fx("smoke", k.x, k.y - 4, 18);
            if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - k.x) < 14 && Math.abs(p.y - k.y) < 8 && p.z < 20) api.hurtPlayer(2, false, p.x < k.x ? -1 : 1);
            for (const e of api.enemies) if (canHit(e) && Math.abs(e.x - k.x) < 14 && Math.abs(e.y - k.y) < 8) api.hitEnemy(e, 2, true, e.x < k.x ? -1 : 1);
          }
          if (k.t === FALL0 + FALL + SIT) { api.SFX.hit(); api.fx("smoke", k.x, k.y - 8, 20); for (let i = 0; i < 6; i++) api.STATE.fx.push(splinter(k.x, k.y, i)); return false; }
          return true;
        });
      },
      drawBack(st, api, cx) {
        const c = api.ctx;
        for (const k of st.list) if (k.t < FALL0 + FALL) { // growing, darkening shadow
          const u = Math.min(1, k.t / (FALL0 + FALL)), x = k.x - cx;
          c.fillStyle = "rgba(0,0,0," + (0.15 + u * 0.45).toFixed(2) + ")"; c.beginPath(); c.ellipse(x, k.y, 4 + u * 10, 1.5 + u * 3, 0, 0, 6.29); c.fill();
          if (k.t < FALL0 && Math.floor(k.t / 6) % 2) { c.strokeStyle = "rgba(255,80,40,0.7)"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, k.y, 15, 5, 0, 0, 6.29); c.stroke(); }
        }
      },
      drawFront(st, api, cx) {
        for (const k of st.list) {
          if (k.t < FALL0 - 4) continue;
          const z = k.t < FALL0 + FALL ? 200 * Math.pow(1 - (k.t - FALL0 + 4) / (FALL + 4), 1.6) : 0, x = R(k.x - cx);
          crateSpr(api, x, R(k.y - z));
        }
      },
    };
  }
  function splinter(x, y, i) {
    const vx = (i - 2.5) * 0.7, vz = 2 + (i % 3) * 0.6;
    return { kind: "x", x, y, t: 0, life: 32, draw(api, f, sx) { const z = vz * f.t - 0.12 * f.t * f.t; if (z < -2) return; api.rect(R(sx + vx * f.t), R(f.y - 6 - z), 4, 2, i % 2 ? "#a8784a" : "#6a4626"); } };
  }
  const dockCrates = makeCrates((api) => api.STATE.locked && api.STATE.wave >= 1 && api.STATE.phase === "waves", [200, 110]);
  const deckCrates = makeCrates((api) => { const b = api.enemies.find((e) => e.boss); return !!(b && b.hp < b.maxHp * 0.5 && b.state !== "dying" && b.state !== "enter"); }, [300, 120]);

  // ---------------- Hazard: forklift charge ----------------
  const FWARN = 66;
  const forklift = {
    init: () => ({ ph: "wait", t: 0, wait: 260 }),
    update(st, api, p) {
      const S = api.STATE; st.t++;
      if (st.ph === "wait") {
        if (S.locked && S.wave >= 2 && S.phase === "waves" && st.t > st.wait && p.deadT === 0) {
          st.ph = "warn"; st.t = 0; st.lane = Math.max(api.floorTop + 6, Math.min(api.floorBot - 4, p.y)); st.dir = p.x - api.camX > api.W / 2 ? -1 : 1; api.SFX.charge();
        }
      } else if (st.ph === "warn") {
        if (st.t % 16 === 1) api.SFX.chat(1400, 2, 0.12);
        if (st.t >= FWARN) { st.ph = "go"; st.t = 0; st.x = st.dir > 0 ? api.camX - 40 : api.camX + api.W + 40; st.hit = new Set(); api.SFX.rumble(); }
      } else {
        st.x += st.dir * 4.4;
        if (st.t % 5 === 0) api.dust(st.x - st.dir * 14, st.lane);
        if (!st.hit.has(p) && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - st.x) < 26 && Math.abs(p.y - st.lane) < 8 && p.z < 12) { st.hit.add(p); api.hurtPlayer(2, false, st.dir); api.shake(4, 12, true); }
        for (const e of api.enemies) if (canHit(e) && !st.hit.has(e) && Math.abs(e.x - st.x) < 26 && Math.abs(e.y - st.lane) < 8) { st.hit.add(e); api.hitEnemy(e, 2, true, st.dir); }
        if ((st.dir > 0 && st.x > api.camX + api.W + 50) || (st.dir < 0 && st.x < api.camX - 50)) { st.ph = "wait"; st.t = 0; st.wait = 330 + (Math.random() * 150 | 0); }
      }
    },
    drawBack(st, api) {
      if (st.ph !== "warn") return;
      const y = st.lane, on = Math.floor(st.t / 6) % 2; // striped lane + headlight glow from the edge it will come from
      for (let x = 0; x < api.W; x += 10) api.rect(x + (st.t % 10) * st.dir, y - 2, 5, 3, on ? "rgba(255,200,40,0.5)" : "rgba(255,200,40,0.25)");
      const c = api.ctx, ex = st.dir > 0 ? 0 : api.W;
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(ex, y - 10, 0, ex, y - 10, 60); g.addColorStop(0, "rgba(255,240,180," + (0.35 + 0.2 * on) + ")"); g.addColorStop(1, "rgba(255,240,180,0)");
      c.fillStyle = g; c.fillRect(ex - 60, y - 70, 120, 120); c.restore();
    },
    drawFront(st, api, cx) {
      if (st.ph === "warn") { warnMark(api, st.dir > 0 ? 10 : api.W - 10, st.lane - 34, st.t); api.ptext(st.dir > 0 ? ">>" : "<<", st.dir > 0 ? 22 : api.W - 22, st.lane - 20, 1, "#ffe060"); return; }
      if (st.ph !== "go") return;
      const x = R(st.x - cx), y = R(st.lane), d = st.dir, c = api.ctx;
      c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(x, y, 32, 5, 0, 0, 6.29); c.fill();
      const im = api.img(PR_IMG), FK = PRF.fork, kf = 0.27; // painted forklift (faces right), wheelbase centre (sheet x 118) on st.x
      if (ready(im)) {
        c.save(); c.translate(x, y + 1); c.scale(d, 1); c.drawImage(im, FK[0], FK[1], FK[2], FK[3], -118 * kf, -FK[3] * kf, FK[2] * kf, FK[3] * kf); c.restore();
        const lx = x + d * 14, ly = y - 46; // painted headlight (sheet 171, 31)
        c.save(); c.globalCompositeOperation = "lighter";
        const hg = c.createRadialGradient(lx, ly, 0, lx, ly, 6); hg.addColorStop(0, api.t % 6 < 3 ? "rgba(255,250,220,0.8)" : "rgba(255,220,120,0.6)"); hg.addColorStop(1, "rgba(255,220,120,0)"); c.fillStyle = hg; c.fillRect(lx - 6, ly - 6, 12, 12);
        const bg = c.createLinearGradient(lx, 0, x + d * 90, 0); bg.addColorStop(0, "rgba(255,240,170,0.28)"); bg.addColorStop(1, "rgba(255,240,170,0)"); c.fillStyle = bg; c.beginPath(); c.moveTo(lx, ly); c.lineTo(x + d * 90, ly - 12); c.lineTo(x + d * 90, y + 2); c.fill(); c.restore();
        return;
      }
      c.save(); c.translate(x, y); c.scale(d * 1.4, 1.4); // load fallback: old code forklift, facing right (x1.4), mirrored for d < 0
      api.rect(14, -34, 3, 34, "#3a3a40"); api.rect(18, -34, 2, 34, "#2a2a30"); // mast
      api.rect(17, -6, 14, 2, "#9aa0aa"); api.rect(17, -12, 14, 2, "#9aa0aa"); // forks
      api.rect(-18, -20, 32, 14, "#e8b018"); api.rect(-18, -20, 32, 2, "#ffe070"); api.rect(-22, -18, 5, 12, "#3a3a40"); // body + counterweight
      api.rect(-12, -38, 2, 18, "#2a2a30"); api.rect(8, -38, 2, 18, "#2a2a30"); api.rect(-12, -39, 22, 2, "#2a2a30"); // cage
      api.rect(-5, -32, 7, 8, "#1a1a22"); api.rect(-4, -36, 5, 4, "#c89a70"); // driver
      api.rect(12, -18, 3, 3, api.t % 6 < 3 ? "#fffbe0" : "#ffd860"); // headlight
      for (const wx of [-12, 8]) { c.fillStyle = "#141418"; c.beginPath(); c.arc(wx, -4, 5, 0, 6.29); c.fill(); api.rect(wx - 1, -5, 2, 2, "#666"); }
      c.restore();
      c.save(); c.globalCompositeOperation = "lighter"; const bg = c.createLinearGradient(x + d * 22, 0, x + d * 90, 0); bg.addColorStop(0, "rgba(255,240,170,0.28)"); bg.addColorStop(1, "rgba(255,240,170,0)"); c.fillStyle = bg; c.beginPath(); c.moveTo(x + d * 22, y - 24); c.lineTo(x + d * 90, y - 40); c.lineTo(x + d * 90, y + 2); c.fill(); c.restore();
    },
  };

  // ---------------- GRIMWALE painted sheet (levels/level5_grimwale.webp) ----------------
  // Frames [x, y, w, h, anchorX] (anchorX = hip centre), feet on the frame bottom; the harpoon gun is painted into
  // every body frame, the anchor + chain into the ones where it hangs at his side. Thrown/whirled anchor, chain links
  // and the flying harpoon are separate painted sprites from the same sheet. Drawn at GW_K: idle 200 px -> 84 world px.
  const GW_IMG = "levels/level5_grimwale.webp", GW_K = 0.42;
  const GWF = {
    idle: [0, 0, 94, 200, 45],
    walk1: [98, 2, 93, 198, 41],
    walk2: [195, 2, 97, 198, 44],
    hurt: [296, 5, 89, 195, 52],
    aim: [389, 15, 118, 185, 43],
    aimE: [511, 15, 118, 185, 43],
    whirl: [633, 18, 124, 182, 56],
    bellow: [761, 6, 86, 194, 50],
    kick: [851, 5, 106, 195, 36],
    crouch: [961, 73, 83, 127, 36],
    down: [1048, 142, 139, 58, 69],
    throw: [1191, 3, 105, 197, 43],
    charge: [1300, 18, 115, 182, 59],
    sweep: [1419, 13, 99, 187, 59],
    anchor: [0, 204, 42, 64, 21],
    harpoon: [46, 204, 70, 10, 35],
    link: [120, 204, 18, 10, 9],
    chainv: [142, 204, 9, 40, 4]
  };
  const GW_PT = { whirl: [43, 5], throw: [100, 33], sweep: [60, 76], aim: [95, 29], aimE: [95, 29] }; // fist / muzzle (frame px)
  function gwSpr(api, F, sx, sy, f, k) { // level15 spr() pattern: the hip anchor (not the bbox centre) sits on sx
    const im = api.img(GW_IMG); k = k || GW_K;
    if (!im || !im.complete || !im.naturalWidth) { api.rect(sx - 12, sy - F[3] * k, 24, F[3] * k, "#1c2230"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * k * f, sy, k, f);
  }
  function gwProp(api, F, x, y, k, rot, f, px, py) { // a prop sprite rotated about its frame point (px, py)
    const im = api.img(GW_IMG); if (!im || !im.complete || !im.naturalWidth) return;
    const c = api.ctx; c.save(); c.translate(x, y); c.rotate(rot || 0); if (f < 0) c.scale(-1, 1);
    c.drawImage(im, F[0], F[1], F[2], F[3], -px * k, -py * k, F[2] * k, F[3] * k); c.restore();
  }
  function gwFrame(e) { // body frame for the boss's current state (engine moves + this level's custom moves)
    const s = e.state, t = e.t;
    if (s === "dying" || s === "down") return "down";
    if (s === "getup") return "crouch";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "charge" || s === "tele") return "charge";
    if (s === "kick") return e.mv === "sweep" ? (t < 44 ? "whirl" : "sweep") : "kick";
    if (s === "slam") return t < 14 ? "crouch" : "kick";
    if (s === "fire") return gear && gear.harp ? "aimE" : "aim";
    if (s === "throw") return e.mv === "toss" && !(gear && gear.toss && gear.toss.ph !== "aim") ? "whirl" : "throw";
    if (s === "summon") return "bellow";
    if ((s === "walk" || s === "enter") && e.walkT > 0) return ["walk1", "idle", "walk2", "idle"][Math.floor(e.walkT / 10) % 4];
    return "idle";
  }
  function gwPt(e, cx) { // screen position of the fist / muzzle in the current frame (falls back to hand())
    const n = gwFrame(e), P = GW_PT[n], F = GWF[n];
    if (!P) { const h = hand(e); return { x: h.x - cx, y: h.y }; }
    return { x: e.x - cx + (P[0] - F[4]) * GW_K * e.facing, y: e.y - e.z - (F[3] - P[1]) * GW_K };
  }
  function gwChain(api, x0, y0, x1, y1) { // painted links along the line, alternating flat / edge-on
    const L = GWF.link, d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(d / 3.2)), a = Math.atan2(y1 - y0, x1 - x0);
    const im = api.img(GW_IMG); if (!im || !im.complete || !im.naturalWidth) return;
    const c = api.ctx;
    for (let i = 0; i <= n; i++) {
      const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      c.save(); c.translate(x, y); c.rotate(a); if (i % 2) c.scale(1, 0.4);
      c.drawImage(im, L[0], L[1], L[2], L[3], -2.6, -1.5, 5.2, 3); c.restore();
    }
  }
  function gwAnchor(api, x, y, s, rot) { gwProp(api, GWF.anchor, x, y, 0.36 * (s || 1), rot, 1, GWF.anchor[2] / 2, 5); } // (x, y) = the ring
  function gwBossDraw(api, e, sx, sy) {
    const s = e.state, t = e.t, f = e.facing, F = GWF[gwFrame(e)] || GWF.idle;
    const red = (e.warn && t % 6 < 3) || (s === "tele" && t % 6 < 3) || ((s === "slam" || s === "throw") && t < 14 && t % 6 < 3) || (e.hp < e.maxHp * 0.3 && s !== "dying" && e.life % 12 < 3);
    const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : s === "kwind" ? -f : 0;
    if (red) api.drawTinted("red", () => gwSpr(api, F, sx + jx, sy, f)); else gwSpr(api, F, sx + jx, sy, f);
  }

  // ---------------- Boss: GRIMWALE, harpoon gun + anchor on a chain ----------------
  // Custom moves run through boss.update and reuse hittable engine state names (fire/kick/throw/summon) so the
  // brothers can still hit him mid-move; e.mv tags which custom move is running. Projectiles live in `gear`.
  let gear = null; // per-fight state: harpoon, anchor, effects (reset by the deck hazard's init)
  const hand = (e) => ({ x: e.x + e.facing * 20, y: e.y - e.z - 42 });
  function bossUpdate(api, e, p) {
    if (!gear) return false;
    const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0), dx = p.x - e.x, ax = Math.abs(dx), hard = e.hp < e.maxHp * 0.5;
    if (e.mv && e.state !== e.mvS) { e.mv = null; gear.sweep = null; }
    if (!e.mv) {
      if (e.state !== "walk" || !free || e.cool > 1 || e.life < 50) return false;
      const sum = gear.sumAt.find((f) => !f.done && e.hp < e.maxHp * f.k);
      if (sum && api.enemies.length < 3) { sum.done = true; return start(e, "hatch", "summon", sum.m); }
      const o = ["stock", "stock"]; // weighted pick; "stock" = let the engine choose charge / kick / slam
      if (ax > 70 && Math.abs(p.y - e.y) < 30 && !gear.harp) o.push("harp", "harp");
      if (ax < 64) o.push("sweep", "sweep");
      if (ax > 50 && !gear.toss) o.push("toss", hard ? "toss" : "stock");
      const m = o[Math.random() * o.length | 0];
      if (m === "harp") return start(e, "harp", "fire");
      if (m === "sweep") return start(e, "sweep", "kick");
      if (m === "toss") return start(e, "toss", "throw");
      return false;
    }
    e.walkT = 0;
    if (e.mv === "harp") { // track the player's row, lock on (red sight line), fire
      if (e.t < 30) { e.facing = dx >= 0 ? 1 : -1; e.y += Math.sign(p.y - e.y) * Math.min(0.8, Math.abs(p.y - e.y)); }
      if (e.t === 1) api.SFX.charge();
      if (e.t === 48) fireHarpoon(api, e);
      if (hard && e.t === 84 && !gear.harp) fireHarpoon(api, e);
      if (e.t >= (hard ? 110 : 70)) done(e);
      return true;
    }
    if (e.mv === "sweep") { // whirl the anchor overhead (ring telegraph), then one low spin: jump it
      if (e.t === 1) { gear.sweep = { t: 0, hit: false }; api.SFX.rumble(); }
      const s = gear.sweep; if (!s) return done(e);
      s.t = e.t;
      if (e.t % 10 === 0 && e.t < 44) api.SFX.swing();
      if (e.t >= 44 && e.t <= 62) {
        const a = (e.t - 44) / 18 * Math.PI * 2, axx = e.x + Math.cos(a) * 60 * e.facing, ayy = e.y + Math.sin(a) * 14;
        if (e.t === 44) { api.SFX.finisher(); api.shake(2, 18, true); }
        if (!s.hit && p.deadT === 0 && p.inv === 0 && p.z < 9 && Math.abs(p.x - axx) < 16 && Math.abs(p.y - ayy) < 9) { s.hit = true; api.hurtPlayer(2, false, p.x < e.x ? -1 : 1); }
      }
      if (e.t >= 80) { gear.sweep = null; done(e); }
      return true;
    }
    if (e.mv === "toss") { // mark the spot, lob the anchor onto it, haul it back
      if (e.t === 1) { gear.toss = { tx: p.x, ty: p.y, t: 0, ph: "aim", e }; api.SFX.charge(); }
      if (e.t >= 64) done(e);
      return true;
    }
    if (e.mv === "hatch") { // klaxons over the hatches, then the crew climbs out of them
      if (e.t === 1) { for (const d of gear.hatchSt.doors) d.alarm = 50; api.enemySay(e, "ALL HANDS ON DECK!", 70, e.cfg.pitch, true); api.SFX.charge(); }
      if (e.t === 46) { api.STATE.queue = api.STATE.queue.concat(e.mvArg); api.STATE.spawnT = 2; gear.hatchSt.force += e.mvArg.length; }
      if (e.t >= 60) done(e);
      return true;
    }
    return done(e);
  }
  function start(e, mv, state, arg) { e.mv = mv; e.mvS = state; e.state = state; e.mvArg = arg; e.t = 0; return true; }
  function done(e) { e.mv = null; e.state = "walk"; e.t = 0; e.cool = (e.cfg.cool || 100) * (e.hp < e.maxHp * 0.5 ? 0.75 : 1) + (Math.random() * 20 | 0); return true; }
  function fireHarpoon(api, e) {
    const h = hand(e);
    gear.harp = { x: e.x + e.facing * 55, y: e.y, dir: e.facing, ph: "out", e, hx: h.x, hy: h.y, reel: 0, x0: e.x + e.facing * 55 };
    api.SFX.gun(); api.shake(2, 6, true);
  }
  function deckUpdate(st, api, p) {
    const e = api.enemies.find((q) => q.boss);
    // harpoon: flies along the row; a hit drags the brother back toward the bosun
    const h = gear.harp;
    if (h) {
      if (h.ph === "out") {
        h.x += h.dir * 6;
        if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - h.x) < 9 && Math.abs(p.y - h.y) < 7 && p.z < 16) {
          api.hurtPlayer(2, false, -h.dir); h.ph = "reel"; h.reel = 26; api.fx("spark", h.x, h.y - 18, 10);
          if (e) api.enemySay(e, "REEL 'EM IN!", 60, e.cfg.pitch);
        } else if (h.x < api.camX - 10 || h.x > api.camX + api.W + 10 || !e || e.state === "dying") h.ph = "back";
      } else if (h.ph === "reel") { // drag the downed brother toward the boss
        if (e && Math.abs(p.x - e.x) > 34) p.x += -h.dir * 3; h.x = p.x; h.y = p.y;
        if (--h.reel <= 0) h.ph = "back";
      } else {
        const tx = e ? e.x + h.dir * 14 : h.x; h.x += Math.sign(tx - h.x) * Math.min(8, Math.abs(tx - h.x));
        if (Math.abs(tx - h.x) < 2 || !e) gear.harp = null;
      }
      if (gear.harp && e) { const q = gwPt(e, 0); h.hx = q.x; h.hy = q.y; } // rope runs from the painted muzzle / fist (draw only)
    }
    // anchor toss: 50-frame target mark, 30-frame arc, landing shockwave, then hauled back
    const s = gear.toss;
    if (s) {
      s.t++;
      const b = s.e, hh = hand(b);
      if (s.ph === "aim" && s.t >= 22) { s.ph = "fly"; s.t = 0; s.x0 = hh.x; s.y0 = b.y; s.z0 = 38; api.SFX.swing(); }
      else if (s.ph === "fly") {
        const k = s.t / 30; s.x = api.lerp(s.x0, s.tx, k); s.y = api.lerp(s.y0, s.ty, k); s.z = s.z0 * (1 - k) + Math.sin(k * Math.PI) * 70;
        if (s.t >= 30) {
          s.ph = "land"; s.t = 0; s.z = 0; api.SFX.boom(); api.shake(4, 16, true); api.dust(s.tx - 10, s.ty); api.dust(s.tx + 10, s.ty);
          api.STATE.fx.push({ kind: "ring", x: s.tx, y: s.ty, t: 0, life: 18 });
          if (p.deadT === 0 && p.inv === 0 && p.z < 8 && Math.abs(p.x - s.tx) < 22 && Math.abs(p.y - s.ty) < 10) api.hurtPlayer(2, false, p.x < s.tx ? -1 : 1);
          for (const q of api.enemies) if (canHit(q) && Math.abs(q.x - s.tx) < 22 && Math.abs(q.y - s.ty) < 10) api.hitEnemy(q, 2, true, q.x < s.tx ? -1 : 1);
        }
      } else if (s.ph === "land" && s.t > 26) { s.ph = "back"; s.t = 0; }
      else if (s.ph === "back") { const k = Math.min(1, s.t / 18); s.x = api.lerp(s.tx, b.x + b.facing * 14, k); s.y = api.lerp(s.ty, b.y, k); s.z = k * 20; if (k >= 1) gear.toss = null; }
      if (b.state === "dying" && s.ph !== "back") { s.ph = "back"; s.t = 0; if (s.x === undefined) { s.x = s.tx; s.y = s.ty; s.z = 0; } }
    }
  }
  function deckDrawBack(st, api, cx) {
    const s = gear && gear.toss, c = api.ctx;
    if (s && (s.ph === "aim" || s.ph === "fly")) { // target mark on the deck
      const x = s.tx - cx, k = s.ph === "aim" ? s.t / 22 : 1, on = Math.floor(api.t / 4) % 2;
      c.strokeStyle = on ? "rgba(255,70,40,0.9)" : "rgba(255,200,60,0.8)"; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(x, s.ty, 24 - 6 * k, 8 - 2 * k, 0, 0, 6.29); c.stroke();
      c.beginPath(); c.moveTo(x - 6, s.ty); c.lineTo(x + 6, s.ty); c.moveTo(x, s.ty - 3); c.lineTo(x, s.ty + 3); c.stroke();
    }
    const e = api.enemies.find((q) => q.boss);
    if (e && e.mv === "sweep" && e.t < 44 && Math.floor(e.t / 5) % 2) { c.strokeStyle = "rgba(255,70,40,0.7)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(e.x - cx, e.y, 60, 14, 0, 0, 6.29); c.stroke(); }
    if (e && e.mv === "harp" && e.t >= 10 && e.t < 48) { // sight line along the row
      const x0 = e.x - cx + e.facing * 20, len = api.W;
      for (let u = 0; u < len; u += 6) api.rect(R(x0 + e.facing * u), R(e.y - 1), 3, 1, e.t > 30 && e.t % 4 < 2 ? "rgba(255,255,255,0.8)" : "rgba(255,60,40,0.75)");
    }
  }
  function deckDrawFront(st, api, cx) {
    const c = api.ctx, e = api.enemies.find((q) => q.boss);
    const h = gear && gear.harp;
    if (h) { // rope + painted harpoon (leaves the muzzle at shoulder height, settles to chest height of the brothers)
      const HF = GWF.harpoon, d = h.dir, mz = e ? GWF.aim[3] - GW_PT.aim[1] : 66;
      const k = h.ph === "out" ? Math.min(1, Math.abs(h.x - (h.x0 === undefined ? h.x : h.x0)) / 70) : 1;
      const x = R(h.x - cx), y = R(h.y - (h.ph === "reel" ? 12 : (mz * GW_K) * (1 - k) + 30 * k));
      c.strokeStyle = "#d8c8a0"; c.lineWidth = 1; c.beginPath(); c.moveTo(h.hx - cx, h.hy); c.quadraticCurveTo((h.hx - cx + x) / 2, Math.max(h.hy, y) + 6, x - d * 14, y); c.stroke();
      gwProp(api, HF, x, y, 0.42, 0, d, HF[2] - 4, HF[3] / 2); // tip on (x, y)
    }
    if (!e || e.state === "enter" && e.t < 2) return;
    const s = gear && gear.toss, q = gwPt(e, cx);
    if (e.mv === "harp" && e.t < 48 && e.t >= 30 && e.t % 4 < 2) { // the loaded harpoon tip glints before it fires
      const tx = q.x + e.facing * 9, ty = q.y; c.save(); c.globalCompositeOperation = "lighter"; api.rect(tx - 3, ty, 7, 1, "#ff8a60"); api.rect(tx, ty - 3, 1, 7, "#ff8a60"); c.restore();
    }
    if (s && s.x !== undefined) { const ax = s.x - cx, ay = s.y - s.z - 22; gwChain(api, q.x, q.y + 2, ax, ay); gwAnchor(api, ax, ay, 1, s.ph === "fly" ? s.t * 0.25 : 0); return; }
    if (s && s.ph === "aim") { const a = api.t * 0.4, ax = q.x + Math.cos(a) * 14, ay = q.y - 8 + Math.sin(a) * 4; gwChain(api, q.x, q.y, ax, ay); gwAnchor(api, ax, ay, 0.9, a); return; }
    if (e.mv === "sweep") {
      const ws = e.t < 44, a = ws ? e.t * 0.5 : (e.t - 44) / 18 * Math.PI * 2;
      const ax = ws ? q.x + Math.cos(a) * 18 : e.x - cx + Math.cos(a) * 60 * e.facing, ay = ws ? q.y - 10 + Math.sin(a) * 5 : e.y + Math.sin(a) * 14 - 22;
      gwChain(api, q.x, q.y, ax, ay + 2); gwAnchor(api, ax, ay, 0.95, a + Math.PI / 2);
      if (!ws && e.t <= 62) { c.save(); c.globalAlpha = 0.35; c.strokeStyle = "#d8e0ff"; c.lineWidth = 2; c.beginPath(); c.ellipse(e.x - cx, e.y - 12, 60, 14, 0, a - 1.2, a); c.stroke(); c.restore(); }
    }
    // otherwise the anchor hangs at his side, painted into the body frame
  }
  const deckGear = {
    init: () => { gear = { harp: null, toss: null, sweep: null, hatchSt: null, sumAt: [{ k: 0.7, m: ["purple", "star"] }, { k: 0.4, m: ["sword", "dasher"] }] }; return {}; },
    update(st, api, p) { if (!gear.hatchSt) { const z = (api.STATE.haz || []).find((q) => q.h === hatches); gear.hatchSt = z ? z.st : { doors: [], force: 0 }; } deckUpdate(st, api, p); },
    drawBack: (st, api, cx) => gear && deckDrawBack(st, api, cx),
    drawFront: (st, api, cx) => gear && deckDrawFront(st, api, cx),
  };

  // ---------------- Outro: the freighter heads uptown, first snowflakes ----------------
  const outro = {
    update(api, st, t) {
      if (t === 20) api.playerBark(true, "THE CARGO'S GOING UPTOWN!");
      if (t === 60) api.SFX.rumble();
      if (t === 130) api.playerBark(true, "BUNDLE UP, BROS. IT'S SNOWING UP THERE!");
      return t > 250;
    },
    draw(api, st, t) {
      const k = Math.min(1, Math.max(0, (t - 60) / 90));
      for (let i = 0; i < 40 * k; i++) { const y = (api.hash(i + 9) * api.H + t * (0.4 + api.hash(i) * 0.5)) % api.H, x = (api.hash(i) * api.W + Math.sin(t * 0.03 + i) * 6) % api.W; api.rect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, "rgba(240,246,255,0.9)"); }
      if (t > 40 && t < 120 && Math.floor(t / 8) % 2) api.ptext("HONK!", api.W - 60, 40, 2, "#ffe060"); // the ship's horn
    },
  };

  // ---- Boss entrance (entr v1): klaxons, then Grimwale bursts out through the middle cargo hatch, ripping the roller door off ----
  const GW_ENTR = {
    len: 175, zoom: 1.3, sub: "SCOURGE OF THE HARBOUR",
    setup(api, e, st) {
      const z = (api.STATE.haz || []).find((q) => q.h === hatches); st.d = z && z.st.doors[1];
      st.hx = st.d ? (st.d.x0 + st.d.x1) / 2 : api.camX + 235; st.hy = api.floorTop + 1;
      Object.assign(e, { x: st.hx, y: st.hy, z: 0, facing: -1, state: "charge", t: 5, entrHide: true });
      if (st.d) { st.d.alarm = 120; st.d.open = 0; st.d.want = 0; st.d.hold = 0; }
      api.SFX.door();
    },
    focus: (api, e, st, t) => (t < 44 ? { x: st.hx, y: 120 } : { x: e.x, y: e.y - 46 }),
    step(api, e, st, t) {
      const d = st.d, mid = (api.floorTop + api.floorBot) / 2;
      if (t < 42) { if (t % 10 === 0) { api.SFX.clink(); api.shake(2, 6, true); } return; }
      if (t === 42) {
        if (d) { d.open = 1; d.want = 1; d.hold = 999; }
        e.entrHide = false; api.entr.impact(st.hx, st.hy, 7, { stop: 6 }); api.SFX.finisher();
        const im = api.img(PR_IMG);
        if (ready(im)) api.entr.debris(st.hx, st.hy + 8, 40, 1, { img: im, frames: [PRF.shutter], k: 0.17, spread: 0.6, up: 2.5, w: 4, h: 4 });
        api.entr.debris(st.hx, st.hy + 6, 30, 10, { spread: 2.2, up: 1.6, w: 26, h: 30, frames: [api.entr.BITS[2], api.entr.BITS[3], api.entr.BITS[4]] });
      }
      if (t > 42 && t <= 86) { const k = (t - 42) / 44; e.x = api.lerp(st.hx, api.camX + api.W / 2, k); e.y = api.lerp(st.hy, mid, k); e.state = k < 0.55 ? "charge" : "walk"; e.t = 5; e.walkT = (e.walkT || 0) + 1;
        if (t % 6 === 0) { api.SFX.land(); api.dust(e.x, e.y); } }
      if (t === 86) api.entr.impact(e.x, e.y, 4, { sfx: "land", stop: 0, ring: false, puffs: 2 });
      if (t > 86) { e.state = "summon"; e.t = 2; if (t === 92) api.SFX.rumble(); }
    },
    finish(api, e, st) { if (st.d) { st.d.hold = 50; st.d.want = 1; st.d.open = Math.max(st.d.open, 1); } },
  };
  SS.registerLevel({
    number: 5,
    name: "DOCKSIDE DOUBLE-CROSS",
    card: { title: "DOCKSIDE DOUBLE-CROSS", tagline: "SOMEBODY'S SMUGGLING TROUBLE BY THE CRATE.", color: "#3ab8e0" },
    music, bossMusic,
    images: [GW_IMG, PR_IMG, HOLD_IMG],
    // painted regular enemies (dock family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_dock.webp", ENEMY_F = { light: {"idle":[4,4,87,164,39],"walk":[95,0,87,168,42],"walk2":[186,0,84,168,41],"attack":[274,6,140,162,65],"grab":[418,4,133,164,63],"jump":[555,38,126,130,45],"hurt":[685,22,98,146,61],"down":[787,132,176,36,88],"dash":[967,62,152,106,94]}, weapon: {"idle":[4,175,61,165,28],"walk":[69,172,85,168,36],"walk2":[158,172,94,168,51],"attack":[256,177,150,163,54],"jump":[410,180,92,160,45],"hurt":[506,179,92,161,56],"down":[602,304,180,36,90],"throw":[786,178,136,162,54]}, big: {"idle":[4,350,98,162,43],"walk":[106,344,84,168,45],"walk2":[194,344,85,168,43],"attack":[283,350,142,162,53],"jump":[429,360,117,152,57],"hurt":[550,359,96,153,51],"down":[650,458,188,54,94],"shoot":[842,357,144,155,42]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 200, blue: 160, sword: 20, star: 60, dasher: 270, heavy: 30, gunner: 180 },
    sections: [{
      bg: "levels/level5_docks.jpg", floor: [166, 218], length: 1720,
      locks: [0, 560, 1140],
      waves: [["purple", "purple", "blue", "star"], ["sword", "heavy", "purple", "star", "blue"], ["dasher", "heavy", "gunner", "purple", "sword"]],
      grade: "rgba(10,30,70,0.12)",
      hazards: [dockDoors, craneHooks, dockCrates, forklift],
      sky: "#0c1424", ground: "#3a3028",
    }, {
      bg: "levels/level5_docks_boss.jpg", floor: [168, 218], length: 420,
      locks: [0], waves: [["purple", "blue", "dasher"]],
      grade: "rgba(10,30,60,0.10)",
      hazards: [hatches, deckGear, deckCrates],
      sky: "#0c1424", ground: "#2a3236",
    }],
    restructure: { // phase 2: docks (zone 1) -> harbour patrol-boat chase (twist) -> cargo ship deck (zone 2) -> existing superstructure arena
      split: 0, images: ["levels/level5_twist.webp", "levels/level5_harbour.jpg", "levels/level5_shipdeck.jpg"],
      tsec: { bg: "levels/level5_harbour.jpg", auto: 3, floor: [170, 214], hazards: [] },
      twist: { kind: "ride", title: "HARBOUR CHASE!", sub: "FOOT JET-SKIS INCOMING - HOLD THE DECK", len: 2400, img: "levels/level5_twist.webp", fr: {"boat": [0, 0, 600, 211], "wake": [0, 214, 600, 42], "jetski": [603, 214, 140, 54], "bow": [0, 271, 120, 60], "buoy": [123, 271, 58, 110], "deck": [0, 384, 720, 167]},
        deck: "deck", deckK: 0.54, ski: "jetski", wake: "wake", bow: "bow", buoy: "buoy", drip: ["dasher", "purple", "dasher", "star"], gap: 170, cap: 3, color: "#7fdcff" },
      z2bg: "levels/level5_shipdeck.jpg", z2waves: [["dasher", "heavy", "gunner", "purple"], ["sword", "heavy", "dasher", "star", "blue"]], z2: { hazards: [craneHooks, dockCrates] },
    },
    boss: {
      name: "GRIMWALE", base: "ramrod", atlas: "ramrod", hp: 38, scale: 1.12, speed: 1.0, chargeSpeed: 1.1, cool: 100, pitch: 80,
      moves: ["charge", "kick", "slam"],
      update: bossUpdate,
      draw: gwBossDraw, // painted sheet (was the tinted Ramrod atlas)
      entrance: GW_ENTR,
      lines: { intro: "WELCOME ABOARD, SHELLFISH! NOW WALK THE PLANK!", hit: ["MIND THE CHAIN, BARNACLE-BACK!", "I'VE GUTTED BIGGER FISH!", "ARR... THAT STINGS!"], summon: "ALL HANDS ON DECK!", ko: "ABANDON... SHIP..." },
    },
    outro,
    onUnload() { gear = null; },
  });
})();
