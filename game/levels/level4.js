// Level 4: SUNSET SHRED. Built only on the public plugin API (window.SS); see ss_level_api.md.
// The brothers skate an elevated highway at sunset (auto-scroll). Oncoming cars and trucks barrel down the
// lanes (flashing lane warning first), potholes trip you, oil slicks send you sliding, biker gang members ride
// in on motorbikes and hover-drones lock on and swoop. Boss: JETWASH, a jetpack courier who keeps pace with
// the scroll: strafing dive, carpet-bomb run, lane missiles and calling in his armoured big rig.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG = "levels/level4_highway.jpg";
  const LANES = [170, 189, 208];
  // module state, reset on every section entry and released in onUnload
  let M = { traffic: null, marks: [], slide: null };

  // ---- Music: a driving sunset synth-rock groove (A minor, 140 BPM) + a re-keyed boss track ----
  const CH = ["Am", "F", "C", "G", "Am", "F", "C", "E", "Dm", "F", "C", "G", "Am", "F", "E", "E"];
  const L1 = "A5:2 C6:2 E6:2 A5:2 G5:2 E5:2 C5:4", L6 = "F5:2 A5:2 C6:2 F6:2 E6:2 C6:2 A5:4";
  const music = A.track({ bpm: 140, loop: true, chords: CH,
    lead: [L1, "F5:2 A5:2 C6:4 A5:2 G5:2 F5:4", "E5:2 G5:2 C6:3 B5:1 C6:2 E6:2 D6:4", "B5:2 G5:2 D5:2 G5:2 B5:4 .:4",
      L1, L6, "G5:2 E5:2 C5:2 E5:2 G5:2 C6:2 E6:4", "G#5:4 B5:4 E6:4 .:4",
      "D6:2 A5:2 F5:2 A5:2 D6:3 C6:1 A5:4", "C6:2 A5:2 F5:2 C6:2 A5:4 .:4", "E6:2 C6:2 G5:2 C6:2 E6:2 G6:2 E6:4", "D6:2 B5:2 G5:2 B5:2 D6:4 .:4",
      L1, L6, "E6:2 D6:2 B5:2 G#5:2 B5:2 D6:2 E6:4", "E6:4 .:2 B5:2 G#5:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 10]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k.h.s.hkk.h.s.h.", 15).concat(["k.s.s.s.ssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -3, 172);

  // ---- helpers ----
  const scrollDelta = (st, api) => { const s = api.scroll, d = s - (st.ls === undefined ? s : st.ls); st.ls = s; return d > 0 && d < 10 ? d : 0; };
  const speed = (api) => (api.section && api.section.auto) || 2.4;
  const canHit = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const standing = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const nearLane = (y) => LANES.reduce((b, l) => (Math.abs(l - y) < Math.abs(b - y) ? l : b), LANES[0]);
  function swingHits(p, x, y, z) { // does the brother's current swing reach a level-drawn target?
    if (!p || !p.atk || !(p.attackT > 0) || p.deadT > 0) return false;
    const dx = (x - p.x) * p.facing;
    return dx > -6 && dx < p.bro.reach + 12 && Math.abs(y - p.y) < 12 && Math.abs(z - p.z) < 28;
  }
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, 6.29); c.fill(); }
  // ---- Painted stage props: levels/level4_props.png (photoreal cutouts, stored at 3x world px, drawn at PK) ----
  // [x, y, w, h] sheet px; drawn bottom-centre via api.drawFrame. Vehicles face left (the way traffic drives).
  const PROPS_IMG = "levels/level4_props.png", PK = 1 / 3;
  const PF = {car_blue: [0, 0, 150, 45], car_yellow: [153, 0, 150, 44], car_silver: [306, 0, 150, 46], car_green: [459, 0, 150, 45], car_magenta: [612, 0, 150, 46], truck_white: [765, 0, 234, 125], truck_red: [0, 128, 234, 125], truck_blue: [237, 128, 234, 125], rig: [474, 128, 324, 122], bike: [801, 128, 96, 57], drone: [900, 128, 90, 24], missile: [0, 256, 66, 12], bomb: [69, 256, 14, 45], cone: [86, 256, 24, 33], sign: [113, 256, 264, 121], signpost: [380, 256, 264, 24], oil: [647, 256, 120, 39], pothole: [770, 256, 81, 30]};
  const DRONE_EYE = [-13.0, -6.0];
  const CAR_ART = { "#2f7ad8": "car_blue", "#e0b020": "car_yellow", "#d8d8e0": "car_silver", "#3aa860": "car_green", "#c83a8a": "car_magenta" };
  const TRUCK_ART = { "#e8e4dc": "truck_white", "#c8402a": "truck_red", "#4a6ab8": "truck_blue" };
  function propImg(api) { const im = api.img(PROPS_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; }
  // draw prop frame n with its bottom-centre at (x, y) world/screen px; f = facing (-1 mirrors); k = extra scale
  function prop(api, n, x, y, f, k) { const im = propImg(api); if (!im) return false; api.drawFrame(im, PF[n], x, y, PK * (k || 1), f || 1); return true; }

  // ---- Hazard: oncoming traffic (cars, box trucks, and the boss's armoured rig) ----
  const VEH = {
    car: { len: 40, h: 20, spd: 3.2, dmg: 2, warn: 62, cols: ["#2f7ad8", "#e0b020", "#d8d8e0", "#3aa860", "#c83a8a"] },
    truck: { len: 66, h: 34, spd: 2.6, dmg: 2, warn: 70, cols: ["#e8e4dc", "#c8402a", "#4a6ab8"] },
    rig: { len: 92, h: 40, spd: 3.6, dmg: 3, warn: 84, cols: ["#262630"] },
  };
  function addVehicle(st, lane, kind) {
    const v = VEH[kind];
    st.list.push({ kind, lane, x: A.W + 24, t: 0, warn: v.warn, col: v.cols[(Math.random() * v.cols.length) | 0], hit: new Set() });
    A.SFX.rumble();
  }
  function drawVehicle(api, v, cx) {
    const D = VEH[v.kind], x = Math.round(v.x - cx), y = v.lane, c = api.ctx, R = api.rect;
    if (x > api.W + 10 || x + D.len < -10) return;
    c.save(); c.globalAlpha = 0.35; ell(c, x + D.len / 2, y + 1, D.len / 2 + 3, 4, "#000"); c.restore();
    const art = v.kind === "car" ? CAR_ART[v.col] || "car_blue" : v.kind === "truck" ? TRUCK_ART[v.col] || "truck_white" : "rig";
    if (prop(api, art, x + D.len / 2 + (v.kind === "rig" ? 4 : 0), y + 1, 1, v.kind === "car" ? 1.12 : 1)) { // painted vehicle (nose left), same footprint as the hitbox
      if (v.kind === "rig" && (api.t >> 2) % 2) { c.save(); c.globalAlpha = 0.55; ell(c, x + 35, y - 46, 3, 2, "#5a5a64"); c.restore(); } // stack smoke puff
    } else if (v.kind === "car") {
      R(x, y - 14, D.len, 10, v.col); R(x, y - 14, D.len, 2, "rgba(255,255,255,0.35)");
      R(x + 9, y - 21, 20, 7, v.col); R(x + 11, y - 20, 7, 5, "#9ac4e8"); R(x + 20, y - 20, 7, 5, "#7aa4c8");
      R(x, y - 8, D.len, 2, "rgba(0,0,0,0.3)"); R(x - 1, y - 12, 2, 3, "#fff6b0"); R(x + D.len - 1, y - 12, 2, 3, "#e8302a");
      R(x + 5, y - 5, 8, 6, "#141418"); R(x + 27, y - 5, 8, 6, "#141418"); R(x + 7, y - 3, 4, 2, "#777"); R(x + 29, y - 3, 4, 2, "#777");
    } else if (v.kind === "truck") {
      R(x, y - 24, 18, 20, v.col); R(x + 2, y - 22, 9, 8, "#9ac4e8"); R(x - 1, y - 9, 2, 4, "#fff6b0"); R(x, y - 5, 18, 2, "#555");
      R(x + 20, y - 34, D.len - 20, 28, "#d8d4cc"); R(x + 20, y - 34, D.len - 20, 2, "#fff"); R(x + 24, y - 26, D.len - 28, 8, v.col);
      R(x + 20, y - 7, D.len - 20, 2, "#555");
      for (const wx of [4, 26, 52]) { R(x + wx, y - 6, 10, 7, "#141418"); R(x + wx + 3, y - 4, 4, 2, "#888"); }
    } else { // JETWASH's armoured big rig: spiked ram plate, red stripes, smoke stack
      R(x - 4, y - 18, 6, 14, "#8a8a98"); for (let i = 0; i < 4; i++) R(x - 8, y - 17 + i * 4, 4, 2, "#c8c8d8");
      R(x, y - 32, 24, 28, "#2a2a34"); R(x + 3, y - 29, 12, 9, "#ffb040"); R(x + 3, y - 29, 12, 2, "#fff0b0");
      R(x + 18, y - 44, 3, 14, "#555"); if ((api.t >> 2) % 2) R(x + 17, y - 48, 5, 4, "rgba(80,80,90,0.7)");
      R(x + 26, y - 40, D.len - 26, 34, v.col); R(x + 26, y - 40, D.len - 26, 2, "#4a4a58");
      R(x + 26, y - 30, D.len - 26, 3, "#e8302a"); R(x + 26, y - 22, D.len - 26, 3, "#e8302a");
      for (let i = 0; i < 6; i++) R(x + 30 + i * 10, y - 38, 2, 2, "#8a8a98");
      for (const wx of [3, 30, 44, 70, 80]) { R(x + wx, y - 7, 10, 8, "#101014"); R(x + wx + 3, y - 4, 4, 2, "#888"); }
      R(x - 2, y - 12, 3, 4, "#fff6b0");
    }
    // headlight cone pointing left
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.28;
    const g = c.createLinearGradient(x, 0, x - 46, 0); g.addColorStop(0, "rgba(255,240,170,1)"); g.addColorStop(1, "rgba(255,240,170,0)");
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x - 46, y - 18); c.lineTo(x - 46, y + 2); c.lineTo(x, y - 7); c.closePath(); c.fill(); c.restore();
  }
  const traffic = {
    init(api, S) { const st = { list: [], gap: S.trafficGap || 300, next: (S.trafficGap || 300) * 0.7, ls: api.scroll }; M.traffic = st; return st; },
    update(st, api, p) {
      scrollDelta(st, api);
      if (api.STATE.phase === "waves" && --st.next <= 0) {
        st.next = st.gap + ((Math.random() * 90) | 0);
        const lane = Math.random() < 0.6 ? nearLane(p.y) : LANES[(Math.random() * 3) | 0];
        if (!st.list.some((v) => v.lane === lane && v.t < v.warn + 60)) addVehicle(st, lane, Math.random() < 0.3 ? "truck" : "car");
      }
      for (const v of st.list) {
        const D = VEH[v.kind]; v.t++;
        if (v.t === v.warn) { api.SFX.charge(); if (v.kind === "rig") api.shake(3, 20, true); }
        if (v.t < v.warn) continue;
        v.x -= speed(api) + D.spd;
        const inX = (x) => x > v.x - 4 && x < v.x + D.len + 2;
        const clears = v.kind === "car" && p.z > 16;
        if (canHit(p) && !v.hit.has(p) && p.downT === 0 && Math.abs(p.y - v.lane) < 8 && inX(p.x) && !clears) {
          v.hit.add(p); api.hurtPlayer(D.dmg, false, -1); api.STATE.shake = Math.max(api.STATE.shake, 8); api.SFX.boom();
        }
        for (const e of api.enemies) if (standing(e) && !v.hit.has(e) && Math.abs(e.y - v.lane) < 8 && inX(e.x) && e.z < 12) { v.hit.add(e); api.hitEnemy(e, 3, true, -1); }
      }
      st.list = st.list.filter((v) => v.x + VEH[v.kind].len > -40);
    },
    drawBack(st, api, cx) {
      const p = api.player;
      for (const v of st.list) {
        if (v.t < v.warn) { // flashing lane warning: red band with yellow edge lines, arrows and headlight glare at the right edge
          const on = Math.floor(v.t / 6) % 2 === 0, big = v.kind !== "car", c = api.ctx, y0 = v.lane - 8;
          c.save(); c.globalAlpha = on ? 0.42 : 0.18; api.rect(0, y0, api.W, 14, big ? "#ff1a1a" : "#ff3a1a");
          c.globalAlpha = on ? 0.9 : 0.4; api.rect(0, y0, api.W, 1, "#ffe060"); api.rect(0, y0 + 13, api.W, 1, "#ffe060");
          c.globalAlpha = 1; c.fillStyle = on ? "#ffe060" : "#ff4a2a";
          for (let i = 0; i < 3; i++) { const ax = api.W - 10 - i * 14 - ((v.t * 2) % 14); c.beginPath(); c.moveTo(ax - 6, v.lane - 1); c.lineTo(ax + 2, v.lane - 6); c.lineTo(ax + 2, v.lane + 4); c.closePath(); c.fill(); }
          c.globalCompositeOperation = "lighter"; const k = v.t / v.warn, gr = c.createRadialGradient(api.W, v.lane - 8, 0, api.W, v.lane - 8, 10 + 26 * k);
          gr.addColorStop(0, "rgba(255,245,190," + (0.5 + 0.4 * k).toFixed(2) + ")"); gr.addColorStop(1, "rgba(255,200,120,0)"); c.fillStyle = gr; c.fillRect(api.W - 40, v.lane - 44, 40, 72);
          c.restore();
          if (on) api.ptext("!", api.W - 60, v.lane - 22, 3, big ? "#ff3a2a" : "#ffe060", "center");
        } else if (!p || v.lane < p.y + 2) drawVehicle(api, v, cx);
      }
    },
    drawFront(st, api, cx) {
      const p = api.player;
      for (const v of st.list) if (v.t >= v.warn && p && v.lane >= p.y + 2) drawVehicle(api, v, cx);
    },
  };

  // ---- Hazard: potholes and oil slicks painted on the road, scrolling with it ----
  const road = {
    init: (api, S) => ({ list: [], next: 90, gap: S.debrisGap || 170, ls: api.scroll }),
    update(st, api, p) {
      const d = scrollDelta(st, api);
      if (api.STATE.phase !== "done" && --st.next <= 0) {
        st.next = st.gap + ((Math.random() * 80) | 0) * (api.STATE.phase === "boss" ? 2 : 1);
        const oil = Math.random() < 0.42;
        st.list.push({ oil, x: api.W + 30, y: api.floorTop + 6 + Math.random() * (api.floorBot - api.floorTop - 10), r: oil ? 17 : 10, ry: oil ? 5 : 4, hit: new Set(), seed: Math.random() * 9 });
      }
      for (const o of st.list) {
        o.x -= d;
        const on = (a) => a.z < 1 && Math.abs(a.x - o.x) < o.r && Math.abs(a.y - o.y) < o.ry + 2;
        if (p.deadT === 0 && !o.hit.has(p) && on(p) && p.downT === 0 && !(p.sinkT > 0)) {
          if (o.oil) { o.hit.add(p); M.slide = { t: 46, vy: p.y < (api.floorTop + api.floorBot) / 2 ? 1 : -1 }; api.SFX.clink(); api.fx("spark", p.x, p.y - 2, 8); }
          else if (p.inv === 0) { o.hit.add(p); api.hurtPlayer(1, false, -1); api.dust(p.x, p.y); api.fx("dust", o.x, o.y, 14); }
        }
        for (const e of api.enemies) if (standing(e) && !o.hit.has(e) && on(e)) { o.hit.add(e); api.hitEnemy(e, 1, true, -1); }
      }
      st.list = st.list.filter((o) => o.x > -40);
      if (M.slide && M.slide.t > 0) { // oil slide: drift across the lanes, can't stop
        M.slide.t--; p.y = Math.max(api.floorTop, Math.min(api.floorBot, p.y + M.slide.vy * 1.3)); p.x = Math.max(14, p.x - 0.7);
        if (M.slide.t % 6 === 0) api.fx("smoke", p.x - 6, p.y - 2, 10);
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const o of st.list) {
        const x = o.x - cx; if (x < -30 || x > api.W + 30) continue;
        if (propImg(api)) { // painted oil slick / pothole + cone (same footprint as before)
          if (o.oil) { prop(api, "oil", x, o.y + 6.5, o.seed > 4.5 ? -1 : 1); c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.18; ell(c, x - 4 + Math.sin(api.t * 0.05 + o.seed) * 2, o.y - 1, 6, 1.5, "#8a4ad8"); c.restore(); }
          else { prop(api, "pothole", x, o.y + 5, o.seed > 4.5 ? -1 : 1); prop(api, "cone", Math.round(x + o.r + 10), Math.round(o.y + 1), 1); }
          continue;
        }
        if (o.oil) {
          c.save(); c.globalAlpha = 0.85; ell(c, x, o.y, o.r, o.ry, "#0c0a10"); ell(c, x + 6, o.y + 1, o.r * 0.55, o.ry * 0.7, "#121018");
          c.globalAlpha = 0.5; ell(c, x - 4 + Math.sin(api.t * 0.05 + o.seed) * 2, o.y - 1, 6, 1.5, "#8a4ad8"); ell(c, x + 5, o.y + 1, 5, 1.2, "#3ac8b8"); c.restore();
        } else {
          ell(c, x, o.y, o.r + 2, o.ry + 1.5, "#4a4248"); ell(c, x, o.y, o.r, o.ry, "#121014"); ell(c, x + 2, o.y + 1, o.r - 4, o.ry - 2, "#050406");
          api.rect(x - o.r - 3, o.y - 2, 3, 2, "#5a5258"); api.rect(x + o.r + 1, o.y + 1, 3, 2, "#5a5258");
          // little warning cone just ahead of each pothole
          const kx = Math.round(x + o.r + 10), ky = Math.round(o.y - 1);
          api.rect(kx - 3, ky - 1, 7, 2, "#202020"); api.rect(kx - 2, ky - 7, 5, 6, "#ff7a1a"); api.rect(kx - 1, ky - 10, 3, 3, "#ff7a1a"); api.rect(kx - 2, ky - 5, 5, 1, "#fff");
        }
      }
    },
  };

  // ---- Hazard: hover-drones that lock on (ground reticle) and swoop ----
  const drones = {
    init: (api, S) => ({ on: !!S.drones, list: [], next: 240 }),
    update(st, api, p) {
      if (st.on && api.STATE.phase === "waves" && --st.next <= 0) {
        st.next = 260 + ((Math.random() * 140) | 0);
        if (st.list.length < 2) st.list.push({ x: api.W + 24, y: api.floorTop + 10, z: 52, ph: "in", t: 0, hx: 200 + Math.random() * 130, rx: p.x, ry: p.y, hit: false });
      }
      for (const d of st.list) {
        d.t++;
        if (d.ph === "in") { d.x += (d.hx - d.x) * 0.06; if (d.t > 40) { d.ph = "aim"; d.t = 0; d.rx = p.x; d.ry = p.y; api.SFX.zap(); } }
        else if (d.ph === "aim") { // 44 frames tracking, then 18 frames locked
          d.x += Math.sin(d.t * 0.1) * 0.4;
          if (d.t < 44) { d.rx += (p.x - d.rx) * 0.08; d.ry += (p.y - d.ry) * 0.08; }
          if (d.t === 44) api.SFX.charge();
          if (d.t >= 62) { d.ph = "dive"; d.t = 0; d.sx = d.x; d.sy = d.y; d.sz = d.z; }
        } else if (d.ph === "dive") {
          const k = Math.min(1, d.t / 20); d.x = A.lerp(d.sx, d.rx, k); d.y = A.lerp(d.sy, d.ry, k); d.z = A.lerp(d.sz, 5, k * k);
          if (d.t === 20) { api.fx("dust", d.x, d.y, 14); api.dust(d.x, d.y); }
          if (d.t > 20) { d.ph = "out"; d.t = 0; }
        } else if (d.ph === "out") { d.x -= 4.2; d.z = Math.min(34, d.z + 0.6); }
        if ((d.ph === "dive" && d.t > 12) || (d.ph === "out" && d.t < 14)) {
          if (!d.hit && canHit(p) && Math.abs(p.x - d.x) < 12 && Math.abs(p.y - d.y) < 8 && Math.abs(p.z - d.z) < 14) { d.hit = true; api.hurtPlayer(1, false, d.x < p.x ? 1 : -1); }
          for (const e of api.enemies) if (standing(e) && Math.abs(e.x - d.x) < 10 && Math.abs(e.y - d.y) < 7) api.hitEnemy(e, 1, true, -1);
        }
        if (d.ph !== "in" && swingHits(p, d.x, d.y, d.z)) { // smack it out of the sky
          d.dead = true; api.fx("boom", d.x, d.y - d.z - 6, 24); api.fx("smoke", d.x, d.y - d.z, 18); api.SFX.hit(); api.STATE.stop = Math.max(api.STATE.stop, 3);
          api.STATE.score = (api.STATE.score || 0) + 150;
        }
      }
      st.list = st.list.filter((d) => !d.dead && d.x > -40);
    },
    drawBack(st, api, cx) {
      for (const d of st.list) if (d.ph === "aim" || (d.ph === "dive" && d.t < 18)) {
        const x = Math.round(d.rx - cx), y = Math.round(d.ry), lock = d.ph === "dive" || d.t >= 44, on = lock ? (api.t >> 1) % 2 : (api.t >> 3) % 2;
        const col = lock ? (on ? "#ff2a1a" : "#ffe060") : "rgba(255,80,60,0.75)", r = lock ? 9 : 12 - (d.t % 20) / 6;
        api.ctx.save(); api.ctx.strokeStyle = col; api.ctx.lineWidth = 1; api.ctx.beginPath(); api.ctx.ellipse(x, y, r, r * 0.4, 0, 0, 6.29); api.ctx.stroke(); api.ctx.restore();
        api.rect(x - r - 3, y, 4, 1, col); api.rect(x + r, y, 4, 1, col); api.rect(x, y - 5, 1, 3, col); api.rect(x, y + 3, 1, 3, col);
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const d of st.list) {
        const x = Math.round(d.x - cx), y = Math.round(d.y - d.z - 6);
        api.shadow(x, d.y, d.z, 7);
        if (propImg(api)) { // painted drone: bottom-centre so its body centres on (x, y); eye blink kept as the lock-on tell
          prop(api, "drone", x, y + 4, d.x > (api.player ? api.player.x : 0) ? 1 : -1);
          const ex = Math.round(x + DRONE_EYE[0] * PK * (d.x > (api.player ? api.player.x : 0) ? 1 : -1)), ey = Math.round(y + 4 + DRONE_EYE[1] * PK);
          const on = d.ph === "aim" || d.ph === "dive";
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = on ? ((api.t >> 2) % 2 ? 0.95 : 0.35) : 0.3; ell(c, ex, ey, 2.2, 2.2, on ? "#ff2a1a" : "#ffb040"); c.restore();
          const sp = api.t % 4 < 2; c.save(); c.globalAlpha = 0.35; api.rect(x - 15, y - 3, sp ? 9 : 5, 1, "#dce6ff"); api.rect(x + (sp ? 6 : 10), y - 3, sp ? 9 : 5, 1, "#dce6ff"); c.restore();
          continue;
        }
        ell(c, x, y, 9, 4, "#3a3c48"); ell(c, x, y - 1, 7, 2.5, "#5a5e6e");
        const blink = (api.t >> 2) % 2 ? "#ff2a1a" : "#ff8a6a";
        api.rect(x - 2, y + 1, 4, 3, "#202028"); api.rect(x - 1, y + 2, 2, 1, d.ph === "aim" || d.ph === "dive" ? blink : "#ffb040");
        api.rect(x - 12, y - 3, 6, 1, "#8a8e98"); api.rect(x + 6, y - 3, 6, 1, "#8a8e98");
        const sp = api.t % 4 < 2; api.rect(x - 15, y - 5, sp ? 12 : 6, 1, "rgba(220,230,255,0.7)"); api.rect(x + (sp ? 3 : 6), y - 5, sp ? 12 : 6, 1, "rgba(220,230,255,0.7)");
      }
    },
  };

  // ---- Riders: boards for the gang, motorbikes for the bikers (dashers) ----
  const riders = {
    init: () => ({}),
    update(st, api) { for (const e of api.enemies) if (!e.boss) e.board = e.type !== "dasher"; },
    drawFront(st, api, cx) {
      for (const e of api.enemies) {
        if (e.boss || e.type !== "dasher" || !["walk", "attack", "hurt"].includes(e.state)) continue;
        const x = Math.round(e.x - cx), y = Math.round(e.y - e.z), f = e.facing || 1, R = api.rect;
        const X = (dx, w) => (f > 0 ? x + dx : x - dx - w); // mirror helper
        if (prop(api, "bike", x, y + 1, f)) { // painted motorbike (front wheel faces the rider's facing)
          if (e.state === "walk" && api.t % 6 < 3) R(X(-20, 3), y - 5, 3, 2, "rgba(200,200,210,0.6)"); // exhaust puff
          continue;
        }
        R(X(-13, 8), y - 6, 8, 7, "#141418"); R(X(8, 8), y - 6, 8, 7, "#141418"); R(X(-11, 4), y - 4, 4, 3, "#888"); R(X(10, 4), y - 4, 4, 3, "#888");
        R(X(-9, 20), y - 11, 20, 5, "#c8302a"); R(X(-9, 20), y - 11, 20, 1, "#ff7a6a"); R(X(-12, 7), y - 14, 7, 3, "#202024");
        R(X(9, 3), y - 18, 3, 8, "#9a9aa8"); R(X(11, 3), y - 18, 3, 2, "#202024"); R(X(13, 2), y - 12, 2, 3, "#fff6b0");
        R(X(-14, 5), y - 8, 5, 2, "#8a8e98");
        if (e.state === "walk" && api.t % 6 < 3) R(X(-18, 3), y - 7, 3, 2, "rgba(200,200,210,0.6)"); // exhaust puff
      }
    },
  };

  // ---- Boss helper: bomb markers, keeps the road moving at full speed, gravity for a downed flyer ----
  const bossAux = {
    init: () => { M.marks = []; M.slide = null; return {}; },
    update(st, api, p) {
      if (api.STATE.phase === "boss" && api.section && api.section.auto) api.STATE.scroll += api.section.auto * 0.5; // pace the full scroll
      const b = api.enemies.find((e) => e.boss);
      if (b) {
        if (["down", "dying", "getup"].includes(b.state)) b.z = Math.max(0, b.z - 2.5);
        else if (["hurt", "stagger"].includes(b.state)) b.z += (12 - b.z) * 0.1;
      }
      for (const m of M.marks) {
        m.t++;
        if (m.t === m.life) {
          api.fx("boom", m.x, m.y - 8, 26); api.fx("smoke", m.x, m.y - 4, 22); api.dust(m.x - 8, m.y); api.dust(m.x + 8, m.y); api.SFX.boom(); api.shake(3, 12, true);
          api.STATE.fx.push({ kind: "ring", x: m.x, y: m.y, t: 0, life: 16 });
          if (canHit(p) && Math.abs(p.x - m.x) < 22 && Math.abs(p.y - m.y) < 11 && p.z < 18) api.hurtPlayer(2, false, p.x >= m.x ? 1 : -1);
          for (const e of api.enemies) if (standing(e) && Math.abs(e.x - m.x) < 22 && Math.abs(e.y - m.y) < 11) api.hitEnemy(e, 2, true, e.x >= m.x ? 1 : -1);
        }
      }
      M.marks = M.marks.filter((m) => m.t <= m.life);
    },
    drawBack(st, api, cx) {
      for (const m of M.marks) {
        const x = Math.round(m.x - cx), y = Math.round(m.y), k = m.t / m.life, on = Math.floor(m.t / (k > 0.6 ? 3 : 6)) % 2;
        api.ctx.save(); api.ctx.globalAlpha = 0.25 + 0.35 * k; api.ctx.fillStyle = "#ff3a1a"; api.ctx.beginPath(); api.ctx.ellipse(x, y, 22 * (0.4 + 0.6 * k), 9 * (0.4 + 0.6 * k), 0, 0, 6.29); api.ctx.fill(); api.ctx.restore();
        api.ctx.save(); api.ctx.strokeStyle = on ? "#ffe060" : "#ff3a1a"; api.ctx.beginPath(); api.ctx.ellipse(x, y, 22, 9, 0, 0, 6.29); api.ctx.stroke(); api.ctx.restore();
      }
    },
    drawFront(st, api, cx) {
      for (const m of M.marks) if (m.t > m.life - 22) { // the falling bomb
        const x = Math.round(m.x - cx), z = (m.life - m.t) * 5, y = Math.round(m.y - z - 6);
        if (prop(api, "bomb", x, y + 5, 1)) continue; // painted bomb, nose down
        api.rect(x - 3, y - 5, 6, 9, "#2a2a30"); api.rect(x - 3, y - 5, 2, 9, "#5a5a66"); api.rect(x - 4, y - 8, 8, 3, "#e8302a");
      }
    },
  };

  // ---- Boss: JETWASH, jetpack courier for the gang ----
  // Painted sheet levels/level4_jetwash.png (jetpack + jet flames painted in). Frames face right:
  // [x, y, w, h, anchorX, footY, glowX, glowY] in sheet px; anchorX = hip centre, footY = boot-sole line (flames hang below it),
  // glow = top of the main jet flame (additive heat glow, -1 = no flame). Drawn at JW_K: the 190 px idle is ~74 world px.
  const JW_IMG = "levels/level4_jetwash.png", JW_K = 0.39;
  const JWF = {idle: [0, 0, 75, 190, 41, 189, 3, 86], hover: [79, 10, 81, 180, 43, 180, 3, 82], glide: [164, 13, 93, 177, 56, 176, 15, 70], kwind: [261, 9, 83, 181, 37, 181, -1, -1], kick: [348, 22, 144, 168, 66, 166, -1, -1], dive: [496, 111, 158, 79, 100, 79, 50, 23], bomb: [658, 11, 92, 179, 46, 178, 7, 74], fire: [754, 13, 126, 177, 40, 176, 11, 81], radio: [884, 12, 100, 178, 38, 178, 10, 82], hurt: [988, 9, 112, 181, 66, 180, -1, -1], fall: [1104, 34, 158, 156, 79, 155, -1, -1], down: [1266, 105, 173, 85, 80, 85, -1, -1]};
  const JW_RED = {};
  function jwRed(api) { // red-washed copy of the sheet for telegraph flashes (works without ctx.filter)
    if (JW_RED.cv) return JW_RED.cv;
    const im = api.img(JW_IMG); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgba(255,40,30,0.62)"; c.fillRect(0, 0, cv.width, cv.height);
    return (JW_RED.cv = cv);
  }
  function jwSpr(api, F, sx, sy, f, red) { // level15 spr() pattern: hip anchor on sx, boot soles on sy
    const im = red ? jwRed(api) || api.img(JW_IMG) : api.img(JW_IMG);
    if (!im || (im.complete === false) || im.naturalWidth === 0) { api.rect(sx - 10, sy - 72, 20, 72, red ? "#7a1a14" : "#c8501a"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * JW_K * f, sy + (F[3] - F[5]) * JW_K, JW_K, f);
  }
  function bossFree(p) { return p.deadT === 0 && !p.grabbedBy && p.downT === 0; }
  function rocket(api, e, lane, delay) {
    const dir = e.x > api.W / 2 ? -1 : 1;
    api.shot({ x: e.x + dir * 14, y: lane, z: 14, vx: 0, kind: "rocket", dir, wait: delay, t: 0,
      update(api2, s) {
        s.t++;
        if (s.t < s.wait) return true; // armed and blinking on the launcher, lane warning shows
        if (s.t === s.wait) api2.SFX.gun();
        s.x += s.dir * 4.6; s.vx = s.dir * 4.6;
        if (s.t % 3 === 0) api2.fx("smoke", s.x - s.dir * 8, s.y - 12, 10);
        const p = api2.player;
        if (canHit(p) && Math.abs(s.x - p.x) < 9 && Math.abs(s.y - p.y) < 7 && p.z < 16) { api2.hurtPlayer(2, false, s.dir); api2.fx("boom", s.x, s.y - 12, 20); api2.SFX.boom(); s.dead = true; }
        if (s.x < -30 || s.x > api2.W + 30) s.dead = true;
        return true;
      },
      draw(api2, s, sx, sy) {
        const x = Math.round(sx), y = Math.round(sy), d = s.dir;
        if (s.t < s.wait) { // lane warning line
          const on = (s.t >> 2) % 2; api2.ctx.save(); api2.ctx.globalAlpha = on ? 0.5 : 0.2;
          const x0 = d > 0 ? x : 0, w = d > 0 ? api2.W - x : x; api2.rect(x0, s.y - 1, w, 2, "#ff3a1a"); api2.ctx.restore();
        }
        if (prop(api2, "missile", x, y + 2, d)) { // painted missile (nose = travel dir), code exhaust flame
          if (s.t >= s.wait) { api2.rect(d > 0 ? x - 16 : x + 11, y - 1, 5, 2, "#ffb21a"); api2.rect(d > 0 ? x - 14 : x + 11, y - 1, 3, 2, "#fff3a0"); }
          return;
        }
        api2.rect(x - 6, y - 2, 12, 4, "#d8d8e0"); api2.rect(d > 0 ? x + 6 : x - 9, y - 2, 3, 4, "#e8302a");
        api2.rect(d > 0 ? x - 7 : x + 5, y - 4, 2, 8, "#8a8e98");
        if (s.t >= s.wait) { api2.rect(d > 0 ? x - 12 : x + 7, y - 1, 5, 2, "#ffb21a"); api2.rect(d > 0 ? x - 10 : x + 7, y - 1, 3, 2, "#fff3a0"); }
      } });
  }
  function pickMove(api, e, p) {
    const ph2 = e.hp < e.maxHp * 0.5;
    e.t = 0; e.cool = (ph2 ? 72 : 100) + ((Math.random() * 30) | 0);
    if (Math.abs(p.x - e.x) < 34 && Math.abs(p.y - e.y) < 10 && e.lastMove !== "kwind" && Math.random() < 0.45) { e.state = e.lastMove = "kwind"; return; }
    const opts = ["tele", "throw", "fire"];
    if (!(e.rigCd > 0)) opts.push("summon", "summon");
    let m = opts[(Math.random() * opts.length) | 0];
    if (m === e.lastMove) m = opts[(opts.indexOf(m) + 1) % opts.length];
    e.lastMove = m; e.state = m;
  }
  function bossUpdate(api, e, p) {
    const ph2 = e.hp < e.maxHp * 0.5, W = api.W;
    if (e.rigCd > 0) e.rigCd--;
    e.walkT++;
    if (ph2 && !e.ph2) { e.ph2 = true; api.enemySay(e, "AFTERBURNERS: MAX!", 80, 130, true); api.SFX.charge(); }
    if (e.state === "walk") { // hover alongside the brother, pacing the scroll
      if (e.cool > 0) e.cool--;
      const side = e.x >= p.x ? 1 : -1, tx = Math.max(30, Math.min(W - 30, p.x + side * 62));
      e.x += Math.sign(tx - e.x) * Math.min(1.1, Math.abs(tx - e.x));
      e.y += Math.sign(p.y - e.y) * Math.min(0.8, Math.abs(p.y - e.y));
      e.z += (12 + Math.sin(e.life * 0.08) * 3 - e.z) * 0.1;
      e.facing = p.x >= e.x ? 1 : -1;
      if (e.cool <= 0 && bossFree(p)) pickMove(api, e, p);
      return true;
    }
    if (e.state === "kwind") { e.z += (6 - e.z) * 0.3; if (e.t >= 14) { e.state = "kick"; e.t = 0; api.SFX.swing(); } return true; }
    if (e.state === "kick") { // rocket-boot kick
      if (e.t < 10) e.x += e.facing * 2.2;
      if (e.t <= 10 && canHit(p) && bossFree(p) && Math.sign(p.x - e.x || e.facing) === e.facing && Math.abs(p.x - e.x) < 34 && Math.abs(p.y - e.y) < 10 && p.z < 16) api.hurtPlayer(2, false, e.facing);
      if (e.t >= 26) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "tele") { // STRAFE RUN telegraph: climb, go to an edge, line up with the player's row
      if (e.t === 1) { e.dir = e.x > W / 2 ? -1 : 1; api.SFX.rumble(); }
      const ex = e.dir < 0 ? W - 26 : 26;
      e.x += (ex - e.x) * 0.12; e.z += (26 - e.z) * 0.12; e.facing = e.dir;
      if (e.t < 34) e.y += Math.sign(p.y - e.y) * Math.min(1.4, Math.abs(p.y - e.y));
      if (e.t >= 50) { e.state = "charge"; e.t = 0; api.SFX.charge(); }
      return true;
    }
    if (e.state === "charge") { // the dive: low and fast along the locked row
      e.x += e.dir * (ph2 ? 6.2 : 5.4); e.z += (5 - e.z) * 0.3; e.facing = e.dir;
      if (e.t % 3 === 0) api.fx("smoke", e.x - e.dir * 12, e.y - e.z - 10, 12);
      if (canHit(p) && Math.abs(p.x - e.x) < 16 && Math.abs(p.y - e.y) < 9 && p.z < 18) { api.hurtPlayer(2, false, e.dir); api.STATE.shake = Math.max(api.STATE.shake, 8); }
      for (const o of api.enemies) if (standing(o) && Math.abs(o.x - e.x) < 14 && Math.abs(o.y - e.y) < 9) api.hitEnemy(o, 2, true, e.dir);
      if ((e.dir > 0 && e.x >= W - 16) || (e.dir < 0 && e.x <= 16) || e.t > 120) { e.state = "walk"; e.t = 0; api.SFX.land(); }
      return true;
    }
    if (e.state === "throw") { // CARPET BOMB: climb out of reach, drop marked bombs on the brother
      const n = ph2 ? 4 : 3;
      e.z += ((e.t < 40 + n * 20 ? 72 : 12) - e.z) * 0.08;
      e.x += (W / 2 - e.x) * 0.03; e.facing = p.x >= e.x ? 1 : -1;
      for (let i = 0; i < n; i++) if (e.t === 30 + i * 20) {
        const ox = i ? A.rnd(-34, 34) : 0, oy = i ? A.rnd(-12, 12) : 0;
        M.marks.push({ x: Math.max(20, Math.min(W - 20, p.x + ox)), y: Math.max(api.floorTop, Math.min(api.floorBot, p.y + oy)), t: 0, life: 52 });
        api.SFX.zap();
      }
      if (e.t >= 70 + n * 20 + 40) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "fire") { // LANE MISSILES: back off to an edge, arm rockets down the lanes
      const n = ph2 ? 4 : 3, ex = p.x < W / 2 ? W - 40 : 40;
      if (e.t < 30) { e.x += (ex - e.x) * 0.1; e.z += (18 - e.z) * 0.1; }
      e.facing = p.x >= e.x ? 1 : -1;
      if (e.t === 30) {
        const lanes = [nearLane(p.y)].concat(LANES.filter((l) => l !== nearLane(p.y)).sort(() => Math.random() - 0.5));
        for (let i = 0; i < n; i++) rocket(api, e, i === 0 ? p.y : lanes[i % 3], 40 + i * 16);
      }
      if (e.t >= 30 + 40 + n * 16 + 10) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "summon") { // CALL THE RIG: his armoured big rig rams down the brother's lane
      e.z += (16 - e.z) * 0.1;
      if (e.t === 1) { const L = e.cfg.lines; api.enemySay(e, L.summon, 70, 130, true); }
      if (e.t === 16 && M.traffic) addVehicle(M.traffic, nearLane(p.y), "rig");
      if (e.t === 60 && ph2 && M.traffic) addVehicle(M.traffic, LANES[(LANES.indexOf(nearLane(p.y)) + 1 + ((Math.random() * 2) | 0)) % 3], "rig");
      if (e.t === 20 && ph2 && api.enemies.length < 3) api.spawnEnemy("dasher");
      if (e.t >= 70) { e.state = "walk"; e.t = 0; e.rigCd = 600; }
      return true;
    }
    return false;
  }
  function bossFrame(e) {
    const s = e.state, t = e.t;
    if (s === "down" || s === "dying") return e.z > 3 ? "fall" : "down";
    if (s === "getup") return "kwind";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "kwind") return "kwind";
    if (s === "kick") return t < 20 ? "kick" : "kwind";
    if (s === "charge") return "dive";
    if (s === "tele") return t > 40 ? "dive" : "glide";
    if (s === "throw") return t >= 24 && (t - 24) % 20 < 14 ? "bomb" : "hover";
    if (s === "fire") return t >= 26 ? "fire" : "glide";
    if (s === "summon") return "radio";
    if (s === "enter") return "glide";
    return (e.walkT >> 4) % 2 ? "hover" : "idle";
  }
  function bossDraw(api, e, sx, sy) {
    const c = api.ctx, f = e.facing || -1, fr = bossFrame(e), F = JWF[fr];
    const red = (e.state === "tele" && e.t % 6 < 3) || (e.state === "kwind" && e.t % 4 < 2) || (e.state === "throw" && e.t < 20 && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3);
    const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : 0, lift = fr === "dive" ? 16 : 0;
    const x = sx + jx, y = sy - lift;
    if (F[6] >= 0) { // heat glow + flicker at the painted jet flame (stronger on boost)
      const boost = e.state === "charge" || e.state === "throw" ? 1.5 : e.state === "tele" ? (e.t % 4 < 2 ? 0.5 : 1.4) : 1;
      const gx = x + (F[6] - F[4]) * JW_K * f, gy = y - (F[5] - F[7]) * JW_K + (fr === "dive" ? 0 : 10);
      const r = (13 + Math.sin(api.t * 0.9) * 2.5) * boost;
      c.save(); c.globalCompositeOperation = "lighter"; const g = c.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, "rgba(255,170,60,0.5)"); g.addColorStop(1, "rgba(255,90,0,0)"); c.fillStyle = g; c.fillRect(gx - r, gy - r, r * 2, r * 2); c.restore();
    }
    jwSpr(api, F, x, y, f, red);
    if (e.state === "fire" && e.t >= 30 && e.t < 40) api.ptext("!", sx, sy - 94, 2, "#ffe060", "center");
  }

  // ---- Outro: the exit sign to the docks rolls past ----
  const outro = {
    update(api, st, t) {
      api.STATE.scroll = (api.STATE.scroll || 0) + 2.4; // keep riding
      if (t === 1) st.x = api.W + 40;
      st.x -= 1.6;
      if (t === 24) api.playerBark(true, "HIS CARGO'S BOUND FOR THE DOCKS!");
      if (t === 110) api.playerBark(true, "TAKE THE EXIT! NEXT STOP: THE DOCKS!");
      return t > 200;
    },
    draw(api, st, t) {
      if (st.x === undefined) return;
      const x = Math.round(st.x), R = api.rect;
      if (propImg(api)) { // painted sign board on painted posts (post slice tiled down to the deck), code lettering
        const ph = PF.signpost[3] * PK; for (let yy = 156; yy > 62; yy -= ph - 0.5) prop(api, "signpost", x + 44, yy, 1);
        prop(api, "sign", x + 44, 70, 1);
        api.ptext("EXIT 5", x + 44, 38, 1, "#fff", "center"); api.ptext("DOCKS", x + 44, 48, 2, "#fff", "center"); api.ptext("->", x + 78, 58, 1, "#ffe060", "center");
        return;
      }
      R(x + 6, 40, 3, 116, "#5a5e68"); R(x + 79, 40, 3, 116, "#5a5e68");
      R(x, 30, 88, 38, "#f4f4f4"); R(x + 2, 32, 84, 34, "#1a7a3a");
      api.ptext("EXIT 5", x + 44, 36, 1, "#fff", "center");
      api.ptext("DOCKS", x + 44, 46, 2, "#fff", "center");
      api.ptext("->", x + 78, 56, 1, "#ffe060", "center");
    },
  };

  // ---- Boss entrance (entr v1): Jetwash dives out of the sunset sky, skids his rocket boots along the asphalt, then lifts into a hover ----
  const JW_ENTR = {
    len: 165, zoom: 1.28, sub: "KING OF THE FAST LANE",
    setup(api, e, st) { Object.assign(e, { x: api.camX + api.W + 50, y: api.floorTop + 14, z: 130, facing: -1, state: "charge", t: 5, dir: -1 }); st.y1 = (api.floorTop + api.floorBot) / 2; api.SFX.charge(); },
    focus: (api, e) => ({ x: e.x, y: e.y - e.z - 40 }),
    step(api, e, st, t) {
      const cxm = api.camX + api.W / 2;
      if (t <= 46) { const k = t / 46, q = k * k; e.x = api.lerp(api.camX + api.W + 50, cxm + 70, k); e.y = api.lerp(api.floorTop + 14, st.y1, k); e.z = 130 * (1 - q) + 4 * q; e.state = "charge"; e.t = 5;
        if (t % 2 === 0) api.fx("smoke", e.x + 12, e.y - e.z - 12, 14); if (t % 15 === 0) api.SFX.zap(); }
      if (t === 46) { api.entr.impact(e.x, e.y, 5, { sfx: "clink", stop: 3, ring: false, puffs: 2 }); api.SFX.boom(); }
      if (t > 46 && t <= 78) { const v = 3.2 * (1 - (t - 46) / 32); e.x -= v; e.z = 3; e.state = "charge"; e.t = 5;
        if (t % 2 === 0) { api.fx("spark", e.x + 8, e.y - 2, 8); api.dust(e.x + 10, e.y); } }
      if (t > 78 && t <= 100) { e.z += (14 - e.z) * 0.15; e.state = "enter"; e.t = 0; e.x += (cxm - e.x) * 0.1; }
      if (t > 100) { e.state = "walk"; e.walkT = (e.walkT || 0) + 1; e.z = 14 + Math.sin(t * 0.15) * 2; e.facing = -1; }
    },
    finish(api, e) { e.z = 14; },
  };
  SS.registerLevel({
    number: 4,
    name: "SUNSET SHRED",
    card: { title: "SUNSET SHRED", tagline: "SKATE FAST. DODGE TRAFFIC. DON'T LOOK DOWN.", color: "#ff8a2a" },
    music, bossMusic,
    auto: true, // the engine reads LV.auto (not section.auto) when deciding to put spawned enemies on boards
    // painted regular enemies (biker family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_biker.png", ENEMY_F = { light: {"idle":[4,4,83,165,36],"walk":[91,2,87,167,41],"walk2":[182,0,79,169,45],"attack":[265,6,118,163,46],"jump":[387,8,120,161,32],"hurt":[511,13,88,156,55],"down":[603,128,181,41,90],"dash":[788,82,175,87,100]}, weapon: {"idle":[4,173,65,169,27],"walk":[73,173,80,169,42],"walk2":[157,175,82,167,40],"attack":[243,177,172,165,46],"grab":[419,177,104,165,44],"jump":[527,182,72,160,31],"hurt":[603,187,90,155,52],"down":[697,302,190,40,95],"throw":[891,178,145,164,66]}, big: {"idle":[4,346,88,168,38],"walk":[96,346,104,168,48],"walk2":[204,346,103,168,46],"attack":[311,348,136,166,53],"jump":[451,355,100,159,31],"hurt":[555,355,107,159,58],"down":[666,463,193,51,96],"shoot":[863,347,136,167,39]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 20, blue: 330, star: 45, dasher: 0, heavy: 280, gunner: 200, sword: 300 },
    sections: [{
      bg: BG, floor: [160, 216], length: 2300, auto: 2.4,
      locks: [120, 1250],
      waves: [["purple", "blue", "dasher"], ["blue", "star", "dasher", "purple"]],
      grade: "rgba(60,20,10,0.08)", weather: "speed", trafficGap: 320, debrisGap: 180,
      hazards: [road, traffic, riders], sky: "#e8784a", ground: "#3a3438",
    }, {
      bg: BG, floor: [160, 216], length: 2500, auto: 2.8,
      locks: [120, 1350],
      waves: [["dasher", "heavy", "blue", "star"], ["gunner", "dasher", "purple", "blue", "dasher"]],
      grade: "rgba(80,20,40,0.14)", weather: "speed", trafficGap: 270, debrisGap: 160, drones: true,
      hazards: [road, traffic, drones, riders], sky: "#c8505a", ground: "#3a3438",
    }],
    hazards: [bossAux],
    restructure: { // phase 2: highway (zone 1) -> water-cannon truck (twist) -> tunnel (zone 2) -> tunnel-exit arena
      split: 0, z2sec: 1, images: ["levels/level4_twist.png", "levels/level4_tunnel.jpg", "levels/level4_tunnel_boss.jpg"],
      tsec: { auto: 2.4, hazards: [road], weather: "speed" },
      twist: { kind: "turret", title: "MAN THE WATER CANNON!", sub: "UP / DOWN TO AIM - ATTACK TO FIRE", img: "levels/level4_twist.png", fr: {"truckGun": [0, 0, 340, 132], "truck": [343, 0, 340, 116], "turret": [0, 135, 140, 47], "spray": [143, 135, 200, 70]},
        goal: "kills", need: 10, every: 70, air: true, tspeed: 1.6, base: "truck", baseK: 0.42, baseDy: 14, gun: "turret", gunK: 0.36, spray: "spray", hudText: "DRONES", color: "#7fdcff" },
      z2bg: "levels/level4_tunnel.jpg", z2: { grade: "rgba(40,30,10,0.18)" },
      arena: { bg: "levels/level4_tunnel_boss.jpg", floor: [160, 216], length: 260, auto: 2.0, locks: [], waves: [], weather: "speed", hazards: [road], trafficGap: 9999, debrisGap: 9999, sky: "#c8505a", ground: "#3a3438" },
    },
    boss: {
      name: "JETWASH", base: "ramrod", scale: 1.25, height: 100, hp: 38, pitch: 130,
      moves: ["charge", "throw", "fire", "summon"], cool: 100,
      lines: { intro: "THIS LANE'S A TOLL ROAD, SHELLS. AND I'M THE TOLL!", hit: ["HEY! THAT'S A RENTAL JETPACK!", "YOU SCRATCHED MY VISOR!", "LUCKY BREAK, ROAD-KIDS!"],
        summon: "BREAKER BREAKER! SEND THE RIG!", ko: "RUNNING... ON... FUMES..." },
      spawn(api, e) { e.z = 14; e.rigCd = 200; },
      entrance: JW_ENTR,
      update: bossUpdate,
      draw: bossDraw,
    },
    outro,
    images: [JW_IMG, PROPS_IMG],
    onStart() { M.marks = []; M.slide = null; },
    onUnload() {
      M = { traffic: null, marks: [], slide: null };
      traffic.init = road.init = drones.init = riders.init = bossAux.init = null;
    },
  });
})();
