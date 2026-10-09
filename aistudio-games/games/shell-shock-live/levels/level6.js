// Level 6: FROSTBITE BOULEVARD. Built only on the public plugin API (window.SS); see ss_level_api.md.
// A snowed-in city street at night: icy patches you slide on, snowballs & ice chunks lobbed from behind the
// snowbank (target ring telegraph), a runaway snowplow that charges down a lane (flashing lane warning) and
// icicles that drop from the rooftops (shaking icicle + growing shadow). Boss on the frozen plaza rink, where
// everyone slides: COLD FRONT, a freeze-gas-gun villain on skates.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- Music: an original wintry minor groove (E minor, 126 BPM) + a re-keyed boss track ----
  const CH = ["Em", "Em", "C", "D", "Em", "Em", "Am", "B", "C", "D", "G", "Em", "Am", "C", "B", "B"];
  const R1 = "E5:2 G5:2 B5:3 A5:1 G5:2 F#5:2 E5:4";
  const music = A.track({ bpm: 126, loop: true, chords: CH,
    lead: [R1, "B4:2 E5:2 G5:2 E5:2 F#5:4 .:4", "G5:2 E5:2 C5:2 E5:2 G5:3 A5:1 G5:4", "F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4",
      R1, "G5:2 B5:2 E6:4 D6:2 B5:2 G5:4", "A5:2 C6:2 E6:2 C6:2 A5:4 .:4", "B5:3 A5:1 F#5:2 D#5:2 B4:4 .:4",
      "C6:2 .:1 C6:1 B5:2 G5:2 E5:4 G5:4", "D6:2 C6:2 A5:2 F#5:2 D5:4 F#5:4", "B5:2 D6:2 G6:4 F#6:2 D6:2 B5:4", "E6:4 .:2 B5:2 G5:2 E5:2 .:4",
      "A5:2 E5:2 C5:2 E5:2 A5:4 C6:4", "G5:2 E5:2 C5:2 G5:2 E6:4 C6:4", "D#6:2 B5:2 F#5:2 B5:2 D#6:4 .:4", "F#6:4 D#6:2 B5:2 F#5:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 3]),
    drums: A.rep("k..hs.h.k.hhs..h", 15).concat(["k.s.s.s.ssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -1, 170);

  // ---- Sliding: on ice, actual motion lags behind what the actor "wants" (momentum + glide) ----
  // Called from hazard update (runs after player input, before enemies move). rec keeps last pos + velocity.
  function slide(o, rec, onIce, kx, ky, locked) {
    if (rec.x === undefined || Math.abs(o.x - rec.x) > 40) { rec.x = o.x; rec.y = o.y; rec.vx = 0; rec.vy = 0; return; }
    const mx = o.x - rec.x, my = o.y - rec.y;
    if (onIce) {
      rec.vx += (mx - rec.vx) * kx; rec.vy += (my - rec.vy) * ky;
      o.x += rec.vx - mx; o.y += rec.vy - my;
      const L = locked ? A.camX + 12 : 12, R = locked ? A.camX + A.W - 12 : (A.section ? A.section.length : 9999) - 12;
      if (o.x < L || o.x > R) { o.x = clamp(o.x, L, R); rec.vx *= -0.3; }
      if (o.y < A.floorTop || o.y > A.floorBot) { o.y = clamp(o.y, A.floorTop, A.floorBot); rec.vy *= -0.3; }
    } else { rec.vx = mx; rec.vy = my; }
    rec.x = o.x; rec.y = o.y;
  }
  const freeP = (p) => p.deadT === 0 && !p.grabbedBy && !(p.sinkT > 0) && p.downT === 0;
  let FROZEN = 0; // frames the player stays encased in ice (boss freeze gas)

  // ---- Painted stage props: levels/level6_props.webp (photoreal cutouts, sheet px = 2x world px) ----
  const PR_IMG = "levels/level6_props.webp";
  const PRF = { icicle: [0, 28, 48, 72], snowball: [52, 79, 20, 21], chunk: [76, 72, 30, 28], iceblock: [110, 0, 81, 100], icepatch: [195, 16, 240, 84], plow: [439, 0, 348, 100] };
  function prImg() { const im = A.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; }
  function prDraw(c, im, F, x, y, w, h, flip) { // top-left x,y in screen px; flip mirrors horizontally
    c.save(); c.imageSmoothingEnabled = true;
    if (flip) { c.translate(x + w, y); c.scale(-1, 1); c.drawImage(im, F[0], F[1], F[2], F[3], 0, 0, w, h); }
    else c.drawImage(im, F[0], F[1], F[2], F[3], x, y, w, h);
    c.restore();
  }

  function iceSparkle(c, x, y, rx, ry, t, seed) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.04 + A.hash(seed + i)) % 1; if (ph > 0.25) continue;
      const sx = x + (A.hash(seed + i * 7) - 0.5) * rx * 1.4, sy = y + (A.hash(seed + i * 13) - 0.5) * ry * 1.2, a = 1 - ph * 4;
      c.globalAlpha = a; A.rect(sx - 2, sy, 5, 1, "#ffffff"); A.rect(sx, sy - 2, 1, 5, "#ffffff"); c.globalAlpha = 1;
    }
  }

  // ---- Hazard: icy patches (player and foot soldiers slide; knocked-down foes skate further) ----
  const ice = {
    init: () => ({ list: [{ x: 250, y: 196, rx: 44, ry: 9 }, { x: 560, y: 175, rx: 52, ry: 8 }, { x: 800, y: 206, rx: 46, ry: 8 }, { x: 1110, y: 186, rx: 58, ry: 10 },
      { x: 1380, y: 170, rx: 44, ry: 7 }, { x: 1650, y: 200, rx: 60, ry: 10 }, { x: 1930, y: 180, rx: 48, ry: 9 }, { x: 2180, y: 204, rx: 50, ry: 8 }], pr: {}, er: new WeakMap() }),
    on(st, x, y) { for (const s of st.list) { const dx = (x - s.x) / s.rx, dy = (y - s.y) / s.ry; if (dx * dx + dy * dy < 1) return true; } return false; },
    update(st, api, p) {
      const lk = api.STATE.locked;
      if (freeP(p)) { const was = st.pr.vx; slide(p, st.pr, p.z === 0 && ice.on(st, p.x, p.y), 0.07, 0.09, lk); if (was !== undefined && Math.abs(st.pr.vx) > 1.6 && api.t % 7 === 0 && ice.on(st, p.x, p.y)) api.fx("spark", p.x - Math.sign(st.pr.vx) * 6, p.y - 2, 5); }
      else { st.pr.x = undefined; }
      for (const e of api.enemies) {
        if (e.boss) continue;
        let r = st.er.get(e); if (!r) { r = {}; st.er.set(e, r); }
        const knocked = e.state === "hurt" || e.state === "down";
        if (e.state === "walk" || knocked || e.state === "attack") slide(e, r, e.z < 1 && ice.on(st, e.x, e.y), knocked ? 0.035 : 0.12, knocked ? 0.05 : 0.15, lk);
        else r.x = undefined;
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (let i = 0; i < st.list.length; i++) {
        const s = st.list[i], x = Math.round(s.x - cx); if (x < -s.rx - 10 || x > api.W + s.rx + 10) continue;
        const im = prImg();
        if (im) { c.save(); c.globalAlpha = 0.9; prDraw(c, im, PRF.icepatch, x - s.rx - 4, s.y - s.ry - 2, s.rx * 2 + 8, s.ry * 2 + 6); c.restore(); iceSparkle(c, x, s.y, s.rx, s.ry, api.t, i * 31); continue; } // painted ice sheet
        c.fillStyle = "rgba(120,150,190,0.35)"; c.beginPath(); c.ellipse(x, s.y + 1, s.rx + 2, s.ry + 1.5, 0, 0, 6.29); c.fill();
        const g = c.createLinearGradient(x - s.rx, s.y - s.ry, x + s.rx, s.y + s.ry);
        g.addColorStop(0, "rgba(225,245,255,0.75)"); g.addColorStop(0.5, "rgba(150,200,240,0.6)"); g.addColorStop(1, "rgba(205,235,255,0.75)");
        c.fillStyle = g; c.beginPath(); c.ellipse(x, s.y, s.rx, s.ry, 0, 0, 6.29); c.fill();
        api.rect(x - s.rx * 0.5, s.y - s.ry * 0.35, s.rx * 0.55, 1, "rgba(255,255,255,0.85)");
        api.rect(x - s.rx * 0.1, s.y + s.ry * 0.2, s.rx * 0.45, 1, "rgba(255,255,255,0.6)");
        iceSparkle(c, x, s.y, s.rx, s.ry, api.t, i * 31);
      }
    },
  };

  // ---- Hazard: snowballs & ice chunks lobbed from behind the snowbank (target ring shows where it lands) ----
  const snowballs = {
    init: () => ({ cd: 150, list: [] }),
    update(st, api, p) {
      const S = api.STATE;
      if (S.locked && S.phase === "waves" && p.deadT === 0 && --st.cd <= 0) {
        st.cd = 170 + (Math.random() * 90 | 0);
        const big = Math.random() < 0.33, tx = clamp(p.x + api.rnd(-14, 14), api.camX + 16, api.camX + api.W - 16), ty = clamp(p.y + api.rnd(-4, 4), api.floorTop, api.floorBot);
        const x0 = clamp(tx + api.rnd(-120, 120), api.camX + 10, api.camX + api.W - 10);
        st.list.push({ x0, y0: api.floorTop - 10, tx, ty, t: 0, T: big ? 62 : 54, big });
        api.fx("smoke", x0, api.floorTop - 16, 14); api.SFX.swing();
      }
      st.list = st.list.filter((b) => {
        b.t++;
        if (b.t < b.T) return true;
        api.fx(b.big ? "clink" : "smoke", b.tx, b.ty - 4, 16); api.dust(b.tx, b.ty); b.big ? api.SFX.clink() : api.SFX.land();
        const dir = b.tx >= b.x0 ? 1 : -1;
        if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - b.tx) < 11 && Math.abs(p.y - b.ty) < 7 && p.z < 16) api.hurtPlayer(b.big ? 2 : 1, false, b.big ? dir : 0);
        for (const e of api.enemies) if (!e.boss && ["walk", "attack", "hurt"].includes(e.state) && Math.abs(e.x - b.tx) < 11 && Math.abs(e.y - b.ty) < 7) api.hitEnemy(e, 1, true, dir);
        return false;
      });
    },
    drawBack(st, api, cx) { // target rings on the floor
      const c = api.ctx;
      for (const b of st.list) {
        const k = b.t / b.T, x = b.tx - cx, r = (b.big ? 11 : 8) * (1.4 - 0.4 * k);
        c.strokeStyle = b.big ? "rgba(255,120,80,0.85)" : "rgba(255,240,140,0.8)"; c.lineWidth = 1;
        if (b.t % 8 < 6) { c.beginPath(); c.ellipse(x, b.ty, r, r * 0.38, 0, 0, 6.29); c.stroke(); }
        c.fillStyle = "rgba(10,20,40," + (0.15 + 0.3 * k).toFixed(2) + ")"; c.beginPath(); c.ellipse(x, b.ty, 2 + 5 * k, 1 + 2 * k, 0, 0, 6.29); c.fill();
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const b of st.list) {
        const k = b.t / b.T, x = api.lerp(b.x0, b.tx, k) - cx, y = api.lerp(b.y0, b.ty, k), z = 12 * (1 - k) + 70 * Math.sin(Math.PI * k), sy = y - z - 4;
        const im = prImg();
        if (im) { // painted snowball / ice chunk (chunk tumbles)
          c.save(); c.translate(Math.round(x), Math.round(sy)); c.rotate(b.big ? b.t * 0.3 : b.t * 0.15);
          if (b.big) prDraw(c, im, PRF.chunk, -7.5, -7, 15, 14); else prDraw(c, im, PRF.snowball, -5, -5, 10, 10.5);
          c.restore(); continue;
        }
        if (b.big) { c.save(); c.translate(Math.round(x), Math.round(sy)); c.rotate(b.t * 0.3); c.scale(1.5, 1.5); c.fillStyle = "#9cc8ee"; c.beginPath(); c.moveTo(-5, -2); c.lineTo(-1, -6); c.lineTo(5, -3); c.lineTo(4, 4); c.lineTo(-3, 5); c.closePath(); c.fill(); api.rect(-2, -4, 3, 2, "#eaf6ff"); c.restore(); }
        else { c.fillStyle = "#f4f8ff"; c.beginPath(); c.arc(x, sy, 4.5, 0, 6.29); c.fill(); api.rect(x - 2, sy - 3, 3, 2, "#ffffff"); api.rect(x, sy + 2, 3, 1, "#b8cce8"); }
      }
    },
  };

  // ---- Hazard: icicles drop from the rooftops (shaking icicle at the top + growing shadow, then a crash) ----
  const ICE_WARN = 56, ICE_FALL = 14;
  const icicles = {
    init: () => ({ cd: 260, list: [], shards: [] }),
    update(st, api, p) {
      const S = api.STATE;
      if (S.locked && S.phase === "waves" && S.wave >= 1 && p.deadT === 0 && --st.cd <= 0) {
        st.cd = 230 + (Math.random() * 120 | 0);
        const n = S.wave >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) st.list.push({ x: clamp(p.x + (i ? api.rnd(-70, 70) : api.rnd(-8, 8)), api.camX + 14, api.camX + api.W - 14), y: clamp(p.y + api.rnd(-3, 3), api.floorTop + 2, api.floorBot - 2), t: -i * 20 });
      }
      st.list = st.list.filter((ic) => {
        ic.t++;
        if (ic.t === 1) api.SFX.clink();
        if (ic.t < ICE_WARN + ICE_FALL) return true;
        api.SFX.clink(); api.shake(2, 8, true); api.fx("clink", ic.x, ic.y - 4, 14); api.dust(ic.x, ic.y);
        for (let i = 0; i < 9; i++) st.shards.push({ x: ic.x, y: ic.y, z: 2, vx: api.rnd(-1.6, 1.6), vy: api.rnd(-0.4, 0.4), vz: api.rnd(1, 2.6), t: 0 });
        if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - ic.x) < 11 && Math.abs(p.y - ic.y) < 7 && p.z < 22) api.hurtPlayer(2, false, p.x >= ic.x ? 1 : -1);
        for (const e of api.enemies) if (!e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state) && Math.abs(e.x - ic.x) < 11 && Math.abs(e.y - ic.y) < 7) api.hitEnemy(e, 2, true, e.x >= ic.x ? 1 : -1);
        return false;
      });
      st.shards = st.shards.filter((s) => { s.t++; s.x += s.vx; s.y += s.vy; s.z += s.vz; s.vz -= 0.2; if (s.z < 0) { s.z = 0; s.vz *= -0.3; s.vx *= 0.6; } return s.t < 40; });
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const ic of st.list) {
        if (ic.t < 0) continue;
        const k = Math.min(1, ic.t / (ICE_WARN + ICE_FALL)), x = ic.x - cx;
        c.fillStyle = "rgba(5,15,40," + (0.35 + 0.45 * k).toFixed(2) + ")"; c.beginPath(); c.ellipse(x, ic.y, 4 + 8 * k, 1.5 + 2.5 * k, 0, 0, 6.29); c.fill();
        if (ic.t < ICE_WARN + ICE_FALL && ic.t % 10 < 6) { c.strokeStyle = "rgba(30,110,220,0.9)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, ic.y, 12, 4.5, 0, 0, 6.29); c.stroke(); }
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const ic of st.list) {
        if (ic.t < 0) continue;
        const x = ic.x - cx;
        let top;
        if (ic.t < ICE_WARN) { // hanging from the top edge, shaking harder as it loosens
          const j = ic.t > ICE_WARN * 0.5 ? (ic.t % 4 < 2 ? 1 : -1) : 0; top = -2; drawIcicle(c, x + j, top);
          if (!prImg()) { api.rect(x - 12, 0, 24, 4, "#e8f0fa"); api.rect(x - 12, 4, 24, 1, "#5a6e8a"); }
          if (Math.floor(ic.t / 6) % 2) api.ptext("!", x + 12, 12, 2, "#9fe0ff");
        } else { const k = (ic.t - ICE_WARN) / ICE_FALL; top = api.lerp(-2, ic.y - 30, k * k); drawIcicle(c, x, top); }
      }
      for (const s of st.shards) { c.globalAlpha = 1 - s.t / 40; api.rect(s.x - cx, s.y - s.z - 2, 2, 2, s.t % 2 ? "#eaf6ff" : "#9cc8ee"); }
      c.globalAlpha = 1;
    },
  };
  function drawIcicle(c, x, top) { // a cluster of 3 icicles, tip pointing down (dark outline so it reads on snow)
    const im = prImg(); if (im) { prDraw(c, im, PRF.icicle, x - 12, top - 3, 24, 36); return; } // painted icicles with their roof-snow clump
    c.fillStyle = "#2a4a78";
    for (const [dx, w, h] of [[-5, 4, 20], [0, 5, 31], [5, 4, 16]]) { c.beginPath(); c.moveTo(x + dx - w, top); c.lineTo(x + dx + w, top); c.lineTo(x + dx, top + h); c.closePath(); c.fill(); }
    c.fillStyle = "#bfe2fb";
    for (const [dx, w, h] of [[-5, 3, 18], [0, 4, 28], [5, 3, 14]]) { c.beginPath(); c.moveTo(x + dx - w, top); c.lineTo(x + dx + w, top); c.lineTo(x + dx, top + h); c.closePath(); c.fill(); }
    A.rect(x - 1, top + 2, 1, 14, "#ffffff"); A.rect(x - 6, top + 2, 1, 7, "#ffffff");
  }

  // ---- Hazard: runaway snowplow charges down a lane (flashing lane + arrows + horn first) ----
  const PLOW_WARN = 84, PLOW_SPEED = 6.2;
  const snowplow = {
    init: () => ({ cd: 240, ph: "idle", t: 0, y: 190, dir: 1, x: 0, hit: null, snow: [] }),
    update(st, api, p) {
      const S = api.STATE;
      if (st.ph === "idle") {
        if (S.locked && S.phase === "waves" && S.wave >= 2 && p.deadT === 0 && --st.cd <= 0) {
          st.ph = "warn"; st.t = 0; st.y = clamp(Math.round(p.y), api.floorTop + 9, api.floorBot - 9); st.dir = Math.random() < 0.5 ? 1 : -1; api.SFX.rumble();
        }
      } else if (st.ph === "warn") {
        if (++st.t === 42) api.SFX.rumble();
        if (st.t >= PLOW_WARN) { st.ph = "go"; st.t = 0; st.x = st.dir > 0 ? api.camX - 60 : api.camX + api.W + 60; st.hit = new Set(); api.SFX.charge(); }
      } else {
        st.t++; st.x += st.dir * PLOW_SPEED;
        if (st.t % 3 === 0) api.shake(1.5, 4, true);
        if (st.t % 2 === 0) st.snow.push({ x: st.x + st.dir * 60, y: st.y + api.rnd(-6, 6), z: 4, vx: st.dir * api.rnd(1, 3), vy: api.rnd(-1, 1), vz: api.rnd(1.5, 3.2), t: 0 });
        const x0 = Math.min(st.x - st.dir * 52, st.x + st.dir * 64), x1 = Math.max(st.x - st.dir * 52, st.x + st.dir * 64);
        if (!st.hit.has(p) && p.deadT === 0 && p.inv === 0 && p.z < 14 && Math.abs(p.y - st.y) < 11 && p.x > x0 && p.x < x1) { st.hit.add(p); api.hurtPlayer(2, false, st.dir); api.shake(4, 12, true); }
        for (const e of api.enemies) if (!e.boss && !st.hit.has(e) && e.z < 14 && Math.abs(e.y - st.y) < 11 && e.x > x0 && e.x < x1 && e.state !== "dying" && e.state !== "fly") { st.hit.add(e); api.hitEnemy(e, 3, true, st.dir); }
        if ((st.dir > 0 && st.x > api.camX + api.W + 80) || (st.dir < 0 && st.x < api.camX - 80)) { st.ph = "idle"; st.cd = 540 + (Math.random() * 200 | 0); }
      }
      st.snow = st.snow.filter((s) => { s.t++; s.x += s.vx; s.y += s.vy; s.z += s.vz; s.vz -= 0.18; return s.z > 0 && s.t < 50; });
    },
    drawBack(st, api, cx) {
      if (st.ph !== "warn") return;
      const c = api.ctx, on = st.t % 12 < 7;
      c.fillStyle = on ? "rgba(255,170,30,0.28)" : "rgba(255,170,30,0.1)"; c.fillRect(0, st.y - 10, api.W, 20);
      api.rect(0, st.y - 10, api.W, 1, on ? "rgba(255,200,60,0.9)" : "rgba(255,200,60,0.4)"); api.rect(0, st.y + 10, api.W, 1, on ? "rgba(255,200,60,0.9)" : "rgba(255,200,60,0.4)");
      for (let i = 0; i < 6; i++) { // chevrons sweeping the way it will come
        const u = ((st.t * 3 + i * 64) % 384), x = st.dir > 0 ? u : api.W - u;
        c.fillStyle = "rgba(255,220,90,0.6)"; c.beginPath(); c.moveTo(x, st.y - 5); c.lineTo(x + st.dir * 6, st.y); c.lineTo(x, st.y + 5); c.lineTo(x - st.dir * 3, st.y + 5); c.lineTo(x + st.dir * 3, st.y); c.lineTo(x - st.dir * 3, st.y - 5); c.closePath(); c.fill();
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      if (st.ph === "warn") {
        const ex = st.dir > 0 ? 14 : api.W - 14;
        if (Math.floor(st.t / 6) % 2) { api.ptext("!", ex, st.y - 30, 3, "#ffb020"); api.ptext("PLOW!", ex + (st.dir > 0 ? 22 : -22), st.y - 22, 1, "#ffe060"); }
        if (st.t > PLOW_WARN - 34) { // headlights creeping in at the edge
          c.save(); c.globalCompositeOperation = "lighter"; const g = c.createRadialGradient(ex - st.dir * 10, st.y - 8, 0, ex - st.dir * 10, st.y - 8, 40);
          g.addColorStop(0, "rgba(255,240,180,0.55)"); g.addColorStop(1, "rgba(255,200,80,0)"); c.fillStyle = g; c.fillRect(ex - 50, st.y - 48, 100, 80); c.restore();
        }
      } else if (st.ph === "go") drawPlow(c, st.x - cx, st.y, st.dir, st.t);
      for (const s of st.snow) { c.globalAlpha = Math.max(0, 1 - s.t / 50); A.rect(s.x - cx, s.y - s.z - 4, 2, 2, "#f2f6ff"); }
      c.globalAlpha = 1;
    },
  };
  function drawPlow(c, sx, y, dir, t) { // a municipal plow truck, drawn facing +x then mirrored by dir
    const im = prImg();
    if (im) { // painted plow truck: 174x50 world, blade front at sx + dir*64 (the front of the hit box), wheels on y+2
      c.fillStyle = "rgba(0,0,10,0.35)"; c.beginPath(); c.ellipse(sx + dir * 2, y + 1, 70, 6, 0, 0, 6.29); c.fill();
      const w = 174, h = 50, left = dir > 0 ? sx + 64 - 137 : sx - 64 + 137 - w;
      prDraw(c, im, PRF.plow, Math.round(left), Math.round(y + 2 - h), w, h, dir < 0);
      c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,140,20,0.35)"; // flashing amber light bar
      c.beginPath(); c.arc(sx + dir * ((t >> 2) % 2 ? -4 : 10), y + 2 - h + 2, 9, 0, 6.29); c.fill(); c.restore();
      return;
    }
    c.save(); c.translate(Math.round(sx), Math.round(y)); c.scale(dir * 1.45, 1.45);
    c.fillStyle = "rgba(0,0,10,0.35)"; c.beginPath(); c.ellipse(-2, 1, 40, 5, 0, 0, 6.29); c.fill();
    A.rect(-36, -24, 40, 18, "#e8a614"); A.rect(-36, -24, 40, 2, "#ffd24a"); A.rect(-36, -8, 58, 3, "#3a3a40");      // dump body + chassis
    A.rect(-34, -20, 36, 1, "#b07a08"); A.rect(-34, -15, 36, 1, "#b07a08");
    A.rect(-34, -12, 36, 3, "#1c1c22"); for (let i = -34; i < 2; i += 6) A.rect(i, -12, 3, 3, "#ffd24a");          // hazard stripe
    A.rect(4, -34, 18, 26, "#e8a614"); A.rect(4, -34, 18, 2, "#ffd24a"); A.rect(9, -31, 11, 10, "#86b8dc"); A.rect(10, -30, 4, 3, "#e8f8ff"); // cab
    A.rect(5, -38, 14, 3, "#2a2a30"); A.rect(6, -41, 5, 3, (t >> 2) % 2 ? "#ff8a10" : "#6a3000"); A.rect(13, -41, 5, 3, (t >> 2) % 2 ? "#6a3000" : "#ff8a10"); // light bar
    c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,140,20,0.3)"; c.beginPath(); c.arc((t >> 2) % 2 ? 8 : 15, -40, 8, 0, 6.29); c.fill(); c.restore();
    A.rect(20, -18, 3, 4, "#fff6c0");
    for (const wx of [-26, -12, 12]) { c.fillStyle = "#121216"; c.beginPath(); c.arc(wx, -4, 5.5, 0, 6.29); c.fill(); A.rect(wx - 2, -6, 4, 4, "#6a6a74"); }
    A.rect(22, -14, 6, 3, "#3a3a40");                                                                                // blade arm
    c.fillStyle = "#c8381c"; c.beginPath(); c.moveTo(27, -24); c.quadraticCurveTo(36, -14, 33, 0); c.lineTo(28, 0); c.quadraticCurveTo(31, -12, 25, -22); c.closePath(); c.fill(); // curved blade
    A.rect(28, -1, 6, 2, "#d8dde4");
    c.fillStyle = "#f2f6ff"; c.beginPath(); c.ellipse(38, -5, 7, 6, 0, 0, 6.29); c.fill(); c.beginPath(); c.ellipse(43, -2, 5, 4, 0, 0, 6.29); c.fill(); // snow wave
    c.fillStyle = "#d4e2f2"; c.beginPath(); c.ellipse(37, -1, 6, 2.5, 0, 0, 6.29); c.fill();
    c.restore();
  }

  // ---- Boss arena: the whole rink is ice; frozen-in-place visuals ----
  const rink = {
    init: () => ({ pr: {}, er: new WeakMap() }),
    update(st, api, p) {
      if (FROZEN > 0) { FROZEN--; p.hurtT = Math.max(p.hurtT, 1); if (FROZEN === 0) { api.SFX.clink(); api.fx("clink", p.x, p.y - 20, 14); } }
      if (freeP(p)) slide(p, st.pr, p.z === 0, 0.065, 0.085, true); else st.pr.x = undefined;
      for (const e of api.enemies) {
        if (e.boss) continue;
        let r = st.er.get(e); if (!r) { r = {}; st.er.set(e, r); }
        const knocked = e.state === "hurt" || e.state === "down";
        if (e.state === "walk" || knocked || e.state === "attack") slide(e, r, e.z < 1, knocked ? 0.035 : 0.12, knocked ? 0.05 : 0.15, true); else r.x = undefined;
      }
    },
  };

  // ---- Boss: COLD FRONT, freeze-gas gun + skates ----
  // Painted sheet (levels/level6_coldfront.webp): cryo tank, hose, freeze gun and skates are part of every frame.
  // Frame = [x, y, w, h, anchorX (hip centre), nozzleX, nozzleY]; drawn at CF_K (172 px idle -> 86 world px).
  const CF_IMG = "levels/level6_coldfront.webp", CF_K = 0.5;
  const CFF = { idle: [0, 8, 117, 172, 49, 116, 89], walk1: [121, 10, 120, 170, 64, 119, 94], walk2: [245, 13, 113, 167, 61, 112, 85], aim: [362, 16, 136, 164, 45, 135, 41], throw: [502, 17, 136, 163, 61, 135, 49], kwind: [642, 5, 111, 175, 55, 110, 64], kick: [757, 7, 164, 173, 62, 162, 65], leap: [925, 9, 137, 171, 51, 118, 27], shout: [1066, 8, 123, 172, 46, 109, 26], spin: [1193, 8, 165, 172, 87, 164, 57], crouch: [1362, 0, 125, 180, 70, 124, 93], hurt: [1491, 5, 115, 175, 68, 106, 83], down: [1610, 126, 183, 54, 91, 182, 20], shard: [1797, 158, 66, 22, 33, 65, 10], snowball: [1867, 158, 22, 22, 11, 21, 9], puff: [1893, 124, 56, 56, 28, 50, 28] };
  function spr(api, F, sx, sy, k, facing) { // frame drawn with its hip anchor (not bbox centre) on sx
    const im = api.img(CF_IMG);
    if (!im) { api.rect(sx - 10, sy - F[3] * k, 20, F[3] * k, "#2a3a52"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * k * facing, sy, k, facing);
  }
  const nozzle = (F, sx, sy, f) => [sx + (F[5] - F[4]) * CF_K * f, sy - (F[3] - F[6]) * CF_K]; // frame px -> screen
  function sprC(api, F, cx, cy, k, rot, alpha) { // centred sprite (projectiles / frost puffs)
    const im = api.img(CF_IMG); if (!im) return false;
    const c = api.ctx; c.save(); if (alpha !== undefined) c.globalAlpha *= alpha; c.translate(Math.round(cx), Math.round(cy)); if (rot) c.rotate(rot);
    c.drawImage(im, F[0], F[1], F[2], F[3], -F[2] * k / 2, -F[3] * k / 2, F[2] * k, F[3] * k); c.restore(); return true;
  }
  function drawSnowball(api, s, sx, sy) { if (!sprC(api, CFF.snowball, sx, sy, 0.42, 0)) { api.ctx.fillStyle = "#f4f8ff"; api.ctx.beginPath(); api.ctx.arc(sx, sy, 4, 0, 6.3); api.ctx.fill(); } }
  function paintShots(api) { for (const s of api.STATE.stars) if (s.kind === "snowball" && !s.draw) s.draw = drawSnowball; } // engine-thrown boss snowballs
  function bossFree(p) { return !(p.deadT > 0 || p.grabbedBy || p.downT > 0); }
  function bossUpdate(api, e, p) {
    paintShots(api);
    const free = bossFree(p);
    if (!e.half && e.hp <= e.maxHp / 2) { e.half = true; api.enemySay(e, "YOU WANT A COLD WAR? YOU GOT ONE!", 100, 120, true); }
    if (e.state === "walk") {
      if (e.half && e.cool > 2 && api.t % 3 === 0) e.cool--; // angrier: attacks come sooner
      if (free && e.cool <= 1 && Math.random() < 0.5) {
        e.t = 0; e.cool = 100 + (Math.random() * 25 | 0); e.facing = p.x >= e.x ? 1 : -1;
        e.state = Math.abs(p.y - e.y) < 14 && Math.random() < 0.6 ? "spray" : "spin";
        if (e.state === "spray") api.SFX.zap(); else api.SFX.charge();
        return true;
      }
      return false;
    }
    if (e.state === "spray") { // 44f telegraph (nozzle frosts over), then a 54f freezing cone along his row
      if (e.t < 44) { if (Math.abs(p.y - e.y) > 1) e.y += Math.sign(p.y - e.y) * 0.4; return true; }
      const u = e.t - 44, len = Math.min(150, u * 9), x0 = e.x + e.facing * 22;
      e.spray = len;
      if (u % 6 === 0) api.SFX.chat(900 + Math.random() * 300, 2, 0.04);
      if (free && p.inv === 0 && FROZEN === 0 && p.z < 16) {
        const d = (p.x - x0) * e.facing;
        if (d > 0 && d < len && Math.abs(p.y - e.y) < 5 + d * 0.09) {
          api.hurtPlayer(1); FROZEN = 66; p.hurtT = 66; p.inv = 100; api.SFX.clink(); api.fx("clink", p.x, p.y - 20, 14); api.playerBark(true, "B-B-BRRR!");
        }
      }
      for (const m of api.enemies) if (!m.boss && m.state === "walk" && (m.x - x0) * e.facing > 0 && (m.x - x0) * e.facing < len && Math.abs(m.y - e.y) < 8) api.hitEnemy(m, 1, false, e.facing);
      if (u >= 54) { e.spray = 0; e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "spin") { // 40f pirouette telegraph, then a ring of 10 ice shards (twice when angry)
      e.facing = (e.t >> 2) % 2 ? 1 : -1;
      if (e.t % 8 === 0 && e.t < 40) api.fx("spark", e.x + api.rnd(-12, 12), e.y - api.rnd(10, 50), 8);
      const bursts = e.half ? [40, 64] : [40];
      for (let b = 0; b < bursts.length; b++) if (e.t === bursts[b]) {
        api.SFX.shuriken();
        for (let i = 0; i < 10; i++) {
          const a = (i + b * 0.5) / 10 * Math.PI * 2;
          api.shot({ x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 4, vx: Math.cos(a) * 2.3, vy: Math.sin(a) * 0.9, kind: "shard", draw: drawShard });
        }
      }
      if (e.t >= bursts[bursts.length - 1] + 22) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "charge" && e.t % 3 === 0) api.fx("spark", e.x - e.facing * 12, e.y - 2, 6); // skate sparks
    return false;
  }
  function drawShard(api, s, sx, sy) { // painted ice shard, pointing along its flight
    if (sprC(api, CFF.shard, sx, sy + 6, 0.42, Math.atan2(s.vy, s.vx))) return;
    api.rect(sx - 4, sy + 4, 8, 3, "#7fd4ff");
  }
  function cfFrame(e) {
    const s = e.state;
    if (s === "down" || s === "dying") return "down";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "slam") return e.t < 14 ? "crouch" : "leap";
    if (s === "tele" || s === "charge" || s === "getup") return "crouch";
    if (s === "kwind") return "kwind";
    if (s === "kick") return "kick";
    if (s === "throw") return "throw";
    if (s === "summon") return "shout";
    if (s === "spray" || s === "fire") return "aim";
    if (s === "spin") return "spin";
    return e.walkT > 0 ? ["walk1", "idle", "walk2", "idle"][(e.walkT >> 3) % 4] : "idle";
  }
  function bossDraw(api, e, sx, sy) {
    const s = e.state, fr = cfFrame(e), F = CFF[fr];
    const jx = s === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : 0, lean = s === "charge" ? 0.18 * e.facing : 0;
    const c = api.ctx;
    c.save(); if (lean) { c.translate(sx, sy); c.rotate(lean); c.translate(-sx, -sy); }
    spr(api, F, sx + jx, sy, CF_K, e.facing);
    c.restore();
    const warn = (s === "tele" || s === "spray" && e.t < 44 || s === "spin" && e.t < 40 || (s === "slam" || s === "throw") && e.t < 14) && e.t % 6 < 3;
    if (warn) { // frosty telegraph glow at the painted nozzle
      const [mx, my] = nozzle(F, sx + jx, sy, e.facing);
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(mx, my, 0, mx, my, 14); g.addColorStop(0, "rgba(200,240,255,0.95)"); g.addColorStop(1, "rgba(80,160,255,0)");
      c.fillStyle = g; c.fillRect(mx - 14, my - 14, 28, 28); c.restore();
      if (s === "spray") sprC(api, CFF.puff, mx + e.facing * 3, my, 0.18 + 0.12 * (e.t / 44), api.t * 0.05, 0.7);
    }
  }
  function drawSpray(api, e, cx) { // freeze-gas cone from the painted nozzle; reach matches the hit test (x0 = e.x + f*22)
    if (!(e.spray > 0)) return;
    const c = api.ctx, f = e.facing, len = e.spray, F = CFF.aim, [x0, y0] = nozzle(F, e.x - cx, e.y - e.z, f), x1 = e.x - cx + f * (22 + len), span = Math.abs(x1 - x0);
    c.fillStyle = "rgba(40,120,220,0.25)"; c.beginPath(); c.ellipse((x0 + x1) / 2, e.y, span / 2, 4 + len * 0.06, 0, 0, 6.29); c.fill(); // frost lane on the ice
    c.save();
    const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "rgba(150,230,255,0.55)"); g.addColorStop(0.6, "rgba(80,180,255,0.35)"); g.addColorStop(1, "rgba(40,120,255,0.08)");
    c.fillStyle = g; c.beginPath(); c.moveTo(x0, y0 - 3); c.lineTo(x1, y0 - 8 - len * 0.12); c.lineTo(x1, e.y + 2); c.lineTo(x0, y0 + 3); c.closePath(); c.fill();
    c.restore();
    for (let i = 0; i < 14; i++) { // painted cryo vapour rolling out of the nozzle
      const u = ((api.t * 4 + i * 29) % 100) / 100; if (u * 150 > len + 10) continue;
      const px = x0 + (x1 - x0) * u, py = api.lerp(y0, e.y - 8, u) + Math.sin(i * 3 + api.t * 0.3) * (2 + u * 10);
      if (!sprC(api, CFF.puff, px, py, 0.16 + u * 0.42, i * 1.7 + api.t * 0.06, 0.9 - u * 0.45)) { c.fillStyle = "#c8f0ff"; c.beginPath(); c.arc(px, py, 1.5 + u * 3.5, 0, 6.29); c.fill(); }
    }
  }
  function drawFrozen(api, cx) {
    const p = api.player; if (!p || FROZEN <= 0) return;
    const c = api.ctx, x = p.x - cx, y = p.y - p.z, j = FROZEN < 16 && FROZEN % 4 < 2 ? 1 : 0;
    const im = prImg();
    if (im) { c.save(); c.globalAlpha = 0.62; prDraw(c, im, PRF.iceblock, x - 17 + j, y - 50, 34, 52); c.restore(); return; } // painted ice block over the player
    c.fillStyle = "rgba(170,225,255,0.45)"; c.fillRect(x - 13 + j, y - 46, 26, 47);
    api.rect(x - 13 + j, y - 46, 26, 1, "#ffffff"); api.rect(x - 13 + j, y - 46, 1, 47, "rgba(255,255,255,0.8)"); api.rect(x + 12 + j, y - 46, 1, 47, "rgba(120,180,230,0.8)");
    api.rect(x - 9 + j, y - 40, 3, 14, "rgba(255,255,255,0.7)"); api.rect(x + 4 + j, y - 30, 2, 8, "rgba(255,255,255,0.5)");
  }

  // ---- Boss entrance (entr v1): the frozen fountain cracks, shatters, and Cold Front leaps out of the ice ----
  const CF_ENTR = {
    len: 170, zoom: 1.3, sub: "100% CHANCE OF PAIN",
    setup(api, e, st) { st.fx = api.camX + 192; st.fy = api.floorTop - 6; Object.assign(e, { x: st.fx, y: st.fy, z: 22, facing: -1, state: "tele", t: 4, entrHide: true }); api.SFX.rumble(); },
    focus: (api, e, st, t) => (t < 48 ? { x: st.fx, y: 112 } : { x: e.x, y: e.y - e.z - 46 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, im = prImg(), ice = im ? { img: im, frames: [PRF.chunk, PRF.chunk, PRF.icicle, PRF.snowball], k: 0.5 } : {};
      if (t < 46) { if (t % 8 === 0) { api.shake(2, 6, true); api.SFX.clink(); } if (t % 12 === 0) api.fx("smoke", st.fx + api.rnd(-24, 24), api.rnd(70, 140), 20); return; }
      if (t === 46) { e.entrHide = false; api.entr.impact(st.fx, st.fy, 7, { stop: 6, ring: false }); api.SFX.finisher();
        api.entr.debris(st.fx, st.fy, 50, 18, Object.assign({ spread: 2.6, up: 1.5, w: 26, h: 40, colors: ["#e8f6ff", "#a8d8f8", "#7ab8e8", "#ffffff"] }, ice)); }
      if (t >= 46 && t <= 84) { const k = (t - 46) / 38; e.x = st.fx; e.y = api.lerp(st.fy, mid, k); e.z = 22 * (1 - k) + Math.sin(k * Math.PI) * 46; e.state = "slam"; e.t = 30; }
      if (t === 84) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 8, Object.assign({ spread: 2, colors: ["#e8f6ff", "#a8d8f8"] }, ice)); }
      if (t > 84 && t < 104) { e.state = "tele"; e.t = 4; }
      if (t >= 104) { e.state = "summon"; e.t = 2; if (t % 6 === 0) api.fx("smoke", e.x + e.facing * 14, e.y - 70, 18); }
    },
    drawBack(api, st, t, cx) { const x = st.fx - cx; if (t < 46) api.entr.cracks(x, 108, 40, t / 46, "rgba(240,250,255,0.95)"); else CF_ENTR.persist(api, st, cx, Math.min(1, (t - 46) / 4)); },
    persist(api, st, cx, k) { api.entr.hole(st.fx - cx, 118, 14, 19, k === undefined ? 1 : k, "rgba(16,34,62,0.62)", "rgba(220,244,255,0.55)"); },
  };
  SS.registerLevel({
    number: 6,
    name: "FROSTBITE BOULEVARD",
    card: { title: "FROSTBITE BOULEVARD", tagline: "BUNDLE UP. THE GANG BROUGHT A COLD FRONT.", color: "#7fd0ff" },
    music, bossMusic,
    images: [CF_IMG, PR_IMG],
    // painted regular enemies (snow family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_snow.webp", ENEMY_F = { light: {"idle":[4,0,74,168,32],"walk":[82,0,84,168,46],"walk2":[170,0,88,168,51],"attack":[262,7,149,161,67],"jump":[415,29,136,139,55],"hurt":[555,15,96,153,52],"down":[655,130,177,38,88],"dash":[836,63,180,105,96]}, weapon: {"idle":[4,172,72,170,27],"walk":[80,175,86,167,39],"walk2":[170,173,87,169,42],"attack":[261,177,89,165,51],"jump":[354,180,79,162,30],"hurt":[437,185,87,157,54],"down":[528,296,183,46,91],"throw":[715,181,124,161,47]}, big: {"idle":[4,346,99,169,41],"walk":[107,347,94,168,49],"walk2":[205,347,93,168,43],"attack":[302,347,136,168,49],"jump":[442,354,84,161,32],"hurt":[530,361,99,154,48],"down":[633,460,180,55,90],"shoot":[817,354,146,161,41]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 200, blue: 170, sword: 240, star: 185, dasher: 215, heavy: 190, gunner: 175 },
    sections: [{
      bg: "levels/level6_snow.jpg", floor: [160, 216], length: 2320,
      locks: [0, 520, 1060, 1620],
      waves: [["purple", "purple", "blue"], ["star", "purple", "dasher", "blue"], ["heavy", "sword", "star", "dasher"], ["heavy", "gunner", "dasher", "purple", "blue"]],
      grade: "rgba(40,70,130,0.10)", weather: "snow",
      hazards: [ice, snowballs, icicles, snowplow],
      sky: "#1a2238", ground: "#c8d2de",
    }, {
      bg: "levels/level6_snow_boss.jpg", floor: [164, 212], length: 384, locks: [], waves: [],
      grade: "rgba(30,60,120,0.08)", weather: "snow",
      hazards: [rink],
      drawFront(api, cx) { for (const e of api.enemies) if (e.boss) drawSpray(api, e, cx); drawFrozen(api, cx); },
      sky: "#141c34", ground: "#b8d4ea",
    }],
    restructure: { // phase 2: brownstones (zone 1) -> thin-ice pond (twist) -> snowy park (zone 2) -> existing rink arena
      split: 0, images: ["levels/level6_twist.webp", "levels/level6_park.jpg"],
      tsec: { bg: "levels/level6_park.jpg", length: 1100, hazards: [], weather: "snow" },
      twist: { kind: "ice", goal: "reach", title: "THIN ICE!", sub: "DON'T STAND STILL - THE POND CRACKS", img: "levels/level6_twist.webp", fr: {"ice0": [0, 0, 180, 73], "ice1": [183, 0, 180, 75], "ice2": [366, 0, 180, 78], "ice3": [549, 0, 180, 84], "slide": [0, 87, 185, 200], "drift": [188, 87, 120, 73], "sawhorse": [311, 87, 60, 64]},
        slide: "slide", post: "sawhorse", drip: ["purple", "star"], gap: 220, cap: 2, color: "#bfe8ff" },
      z2bg: "levels/level6_park.jpg", z2waves: [["heavy", "sword", "star", "dasher"], ["heavy", "gunner", "dasher", "purple", "blue"]], z2: { hazards: [snowballs, icicles, ice] },
    },
    boss: {
      name: "COLD FRONT", base: "ramrod", scale: 1.35, height: 92,
      hp: 38, speed: 1.25, chargeSpeed: 1.45, cool: 100, pitch: 120,
      moves: ["charge", "kick", "throw", "slam", "summon"], proj: "snowball", throwN: 3,
      minions: ["dasher", "star"], summonCd: 900,
      update: bossUpdate, draw: bossDraw, entrance: CF_ENTR,
      lines: { intro: "FORECAST: 100% CHANCE OF SHELL-SICLES!", hit: ["HEY! THAT'S MY GOOD PARKA!", "YOU'RE SKATING ON THIN ICE!", "BRR-UTAL!", "CHILL OUT, GREENIE!"], summon: "BOYS! PUT 'EM ON ICE!", ko: "I'M... MELTING... OUTTA HERE..." },
      onDefeat() { FROZEN = 0; },
    },
    outro: { // the brother spots the plow's tracks heading out to the junkyard
      update(api, st, t) {
        if (t === 20) api.playerBark(true, "THAT PLOW CAME FROM THE JUNKYARD!");
        if (t === 120) api.playerBark(true, "LET'S GO SCRAP SOME BAD GUYS!");
        return t > 220;
      },
      draw(api, st, t) {
        const c = api.ctx, a = Math.min(1, t / 40) * 0.8;
        c.globalAlpha = a; api.ptext("NEXT STOP: THE JUNKYARD", api.W / 2, 30, 1, "#ffd27a"); c.globalAlpha = 1;
      },
    },
    onUnload() { FROZEN = 0; ice.init = snowballs.init = icicles.init = snowplow.init = rink.init = null; },
  });
})();
