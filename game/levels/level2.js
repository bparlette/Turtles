// Level 2: STREET RUMBLE. Built only on the public plugin API (window.SS); see ss_level_api.md.
// City street at night: open manholes (fall in = hurt; knock enemies in for a KO) and fire hydrants that
// sputter, then blast a jet of water along the sidewalk. Boss: BRICKJAW, the block's self-appointed landlord.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---- Music: an original funky street groove (D minor, 132 BPM) + a re-keyed boss track ----
  const CH = ["Dm", "Dm", "F", "G", "Dm", "Dm", "Am", "C", "Dm", "Dm", "F", "G", "Dm", "Dm", "Am", "Am"];
  const B1 = "D5:2 .:1 D5:1 F5:2 A5:2 .:2 G5:1 F5:1 D5:4";
  const music = A.track({ bpm: 132, loop: true, chords: CH,
    lead: [B1, "C5:2 D5:2 .:2 F5:2 E5:2 D5:2 C5:2 A4:2", "F5:2 .:1 F5:1 A5:2 C6:2 .:2 A5:2 G5:2 F5:2", "G5:3 A5:1 G5:2 D5:2 B4:4 .:4",
      B1, "A5:2 G5:2 F5:2 D5:2 F5:2 G5:2 A5:4", "C6:2 A5:2 E5:2 A5:2 C6:3 B5:1 A5:4", "G5:2 E5:2 C5:2 E5:2 G5:4 .:4",
      B1, "D6:2 C6:2 A5:2 F5:2 G5:2 A5:2 D5:4", "F5:2 .:1 F5:1 A5:2 C6:2 .:2 D6:2 C6:2 A5:2", "B5:3 A5:1 G5:2 B5:2 D6:4 .:4",
      B1, "A5:2 G5:2 F5:2 D5:2 F5:2 G5:2 A5:4", "E5:2 A5:2 C6:2 E6:2 D6:2 C6:2 A5:4", "E6:4 .:2 C6:2 A5:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 12, 0, 7, 0, 12, 10, 12]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 3]),
    drums: A.rep("k..hs.hkk.h.s.hh", 15).concat(["k.s.s.s.ssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, 2, 176);

  // ---- Painted stage props: levels/level2_props.png (photoreal cutouts, sheet px = 2x world px) ----
  const PR_IMG = "levels/level2_props.png";
  const PRF = { hydrant: [0, 26, 26, 52], hole: [30, 52, 60, 26], cover: [94, 51, 48, 27], jet: [146, 0, 240, 78] };
  function prImg(api) { const im = api.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; }
  function prDraw(api, im, F, x, y, w, h, flip) { // top-left x,y in screen px; flip mirrors horizontally
    const c = api.ctx; c.save(); c.imageSmoothingEnabled = true;
    if (flip) { c.translate(x + w, y); c.scale(-1, 1); c.drawImage(im, F[0], F[1], F[2], F[3], 0, 0, w, h); }
    else c.drawImage(im, F[0], F[1], F[2], F[3], x, y, w, h);
    c.restore();
  }

  // ---- Hazard: open manholes ----
  const manholes = {
    init: () => ({ holes: [{ x: 640, y: 198 }, { x: 1150, y: 182 }, { x: 1720, y: 205 }], steam: 0 }),
    update(st, api, p) {
      st.steam++;
      for (const h of st.holes) {
        if (Math.abs(h.x - api.camX - api.W / 2) > api.W) continue;
        if (Math.abs(p.x - h.x) < 9 && Math.abs(p.y - h.y) < 4) api.dropPlayer(h.x, h.y, 2);
        for (const e of api.enemies) // enemies only fall in when knocked into the hole
          if (!e.boss && (e.state === "down" || e.state === "hurt") && e.z < 2 && Math.abs(e.x - h.x) < 10 && Math.abs(e.y - h.y) < 5) {
            api.koEnemy(e); e.t = 20; api.fx("smoke", h.x, h.y - 6, 18); api.SFX.land();
          }
      }
    },
    drawBack(st, api, cx) {
      for (const h of st.holes) {
        const x = Math.round(h.x - cx), y = h.y; if (x < -30 || x > api.W + 30) continue;
        const c = api.ctx, im = prImg(api);
        if (im) { prDraw(api, im, PRF.cover, x + 8, y - 4, 24, 13.5); prDraw(api, im, PRF.hole, x - 15, y - 6.5, 30, 13); } // painted cover shoved aside + open hole
        else {
        c.fillStyle = "#3a3a40"; c.beginPath(); c.ellipse(x, y, 13, 5, 0, 0, 6.29); c.fill();      // rim
        c.fillStyle = "#050507"; c.beginPath(); c.ellipse(x, y, 11, 4, 0, 0, 6.29); c.fill();      // the hole
        c.fillStyle = "#4a4a52"; c.beginPath(); c.ellipse(x + 20, y + 3, 11, 4, 0, 0, 6.29); c.fill(); // cover, shoved aside
        api.rect(x + 13, y + 2, 14, 1, "#2a2a30"); api.rect(x + 13, y + 4, 14, 1, "#2a2a30");
        }
        c.globalAlpha = 0.25; // lazy steam
        for (let i = 0; i < 3; i++) { const ph = ((st.steam * 0.6 + i * 20) % 60) / 60; c.fillStyle = "#c8c8d8"; c.beginPath(); c.arc(x + Math.sin(ph * 6 + i) * 3, y - 4 - ph * 26, 3 + ph * 5, 0, 6.29); c.fill(); }
        c.globalAlpha = 1;
      }
    },
  };

  // ---- Hazard: fire hydrants (sputter as a warning, then a jet along the sidewalk) ----
  const IDLE = 210, WARN = 48, SPRAY = 62, JET = 120;
  const hydrants = {
    init: () => ({ list: [{ x: 330, dir: 1, t: 0 }, { x: 1030, dir: -1, t: 90 }, { x: 1540, dir: 1, t: 40 }, { x: 2160, dir: -1, t: 150 }] }),
    update(st, api, p) {
      for (const h of st.list) {
        h.t = (h.t + 1) % (IDLE + WARN + SPRAY);
        const ph = h.t < IDLE ? "idle" : h.t < IDLE + WARN ? "warn" : "spray";
        if (ph === "warn" && h.t === IDLE && Math.abs(h.x - api.camX - api.W / 2) < api.W / 2 + 20) api.SFX.rumble();
        if (ph !== "spray") { h.hit = null; continue; }
        h.hit = h.hit || new Set();
        const x0 = Math.min(h.x, h.x + h.dir * JET), x1 = Math.max(h.x, h.x + h.dir * JET), y0 = api.floorTop - 2, y1 = api.floorTop + 20;
        if (!h.hit.has(p) && p.inv === 0 && p.z < 10 && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) { h.hit.add(p); api.hurtPlayer(1, false, h.dir); }
        for (const e of api.enemies) if (!e.boss && !h.hit.has(e) && e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1 && ["walk", "attack", "hurt"].includes(e.state)) { h.hit.add(e); api.hitEnemy(e, 1, true, h.dir); }
      }
    },
    drawBack(st, api, cx) {
      for (const h of st.list) {
        const warn = h.t >= IDLE && h.t < IDLE + WARN, jx = warn && h.t % 4 < 2 ? 1 : 0, x = Math.round(h.x - cx) + jx, y = api.floorTop - 2;
        if (x < -20 || x > api.W + 20) continue;
        const im = prImg(api);
        if (im) prDraw(api, im, PRF.hydrant, x - 6.5, y - 25, 13, 26, h.dir < 0); // painted hydrant (outlet faces the jet side)
        else {
        api.rect(x - 4, y - 14, 8, 14, "#c8241a"); api.rect(x - 4, y - 14, 2, 14, "#ff6a4a"); api.rect(x - 5, y - 16, 10, 3, "#a81a10");
        api.rect(x - 2, y - 19, 4, 3, "#c8241a"); api.rect(x - 7, y - 10, 3, 4, "#a81a10"); api.rect(x + 4, y - 10, 3, 4, "#a81a10"); api.rect(x - 5, y - 1, 10, 2, "#5a1008");
        }
        if (warn) { // sputter + warning mark
          for (let i = 0; i < 3; i++) api.rect(x + h.dir * (6 + ((h.t * 2 + i * 5) % 12)), y - 9 - ((h.t + i * 3) % 6), 1, 1, "#bfe4ff");
          if (Math.floor(h.t / 6) % 2) api.ptext("!", x, y - 28, 2, "#ffe060");
        }
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const h of st.list) {
        if (h.t < IDLE + WARN) continue;
        const k = (h.t - IDLE - WARN) / SPRAY, len = JET * Math.min(1, k * 5) * (k > 0.85 ? (1 - k) / 0.15 : 1), x = h.x - cx, y = api.floorTop - 8;
        if (x + JET < -10 && x - JET > api.W + 10) continue;
        const im = prImg(api);
        if (im && len > 1) { // painted water jet stretched to the current reach (same reach as the hit box)
          const wob = Math.sin(api.t * 0.5) * 1.5, hh = 24 + wob, x0 = x + h.dir * 3;
          c.save(); c.globalAlpha = 0.92; prDraw(api, im, PRF.jet, h.dir > 0 ? x0 : x0 - len, y - 9 - wob, len, hh, h.dir < 0); c.restore();
        } else if (!im) {
        c.save(); c.globalAlpha = 0.75;
        const g = c.createLinearGradient(x, 0, x + h.dir * len, 0); g.addColorStop(0, "rgba(220,240,255,0.95)"); g.addColorStop(1, "rgba(120,180,255,0.25)");
        c.fillStyle = g; c.beginPath(); c.moveTo(x + h.dir * 5, y - 3); c.lineTo(x + h.dir * len, y - 8 + Math.sin(api.t * 0.5) * 2); c.lineTo(x + h.dir * len, y + 12); c.lineTo(x + h.dir * 5, y + 2); c.closePath(); c.fill();
        c.globalAlpha = 1; c.restore();
        }
        for (let i = 0; i < 8; i++) { const u = ((api.t * 3 + i * 17) % 100) / 100; api.rect(x + h.dir * u * len, y - 6 + (i % 4) * 4 + Math.sin(u * 9 + i) * 2, 2, 1, "#ffffff"); }
      }
    },
  };

  // ---- BRICKJAW: painted sprite sheet levels/level2_brickjaw.png (photoreal live-action cutouts, like the turtles) ----
  // Frames face right, feet on the frame bottom, [x, y, w, h, anchorX] with anchorX = stance centre between the boots.
  // Drawn at BJ_K: the 180 px idle frame is 90 world px tall (same size as the old tinted ramrod at scale 1.05).
  const BJ_IMG = "levels/level2_brickjaw.png", BJ_K = 0.5;
  const BJF = { idle: [0,1,118,180,52], walk1: [122,0,108,181,49], walk2: [234,4,123,177,64], wind: [361,2,141,179,77], punch: [506,4,144,177,52], tele: [654,23,107,158,51], charge: [765,14,124,167,39], throwUp: [893,0,103,181,57], throwRel: [1000,15,133,166,63], summon: [1137,3,105,178,52], hurt: [1246,3,162,178,92], fall: [1412,20,154,161,77], down: [1570,121,206,60,103], getup: [1780,39,138,142,68] };
  const BJ_WALK = ["walk1", "idle", "walk2", "idle"];
  let BJ_RED = null;
  function redSheet() { // red-washed copy of the sheet for the telegraph / low-HP blink (works without ctx.filter)
    if (BJ_RED) return BJ_RED;
    const im = A.img(BJ_IMG); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(255,40,30,0.5)"; c.fillRect(0, 0, cv.width, cv.height);
    return (BJ_RED = cv);
  }
  function brickFrame(e) {
    const s = e.state, t = e.t;
    if (s === "dying") return t < 18 ? "fall" : "down";
    if (s === "down") return t < 10 ? "fall" : "down";
    if (s === "getup") return t < 6 ? "down" : "getup";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "tele") return "tele";
    if (s === "charge") return "charge";
    if (s === "kwind") return "wind";
    if (s === "kick") return "punch";
    if (s === "summon") return "summon";
    if (s === "fire") return t < 4 ? "wind" : "punch"; // fallback move: jabs the brick fist as the shots fly
    if (s === "throw") { // brick raised, then a forward release on each throw (t = 14 + 12i)
      const n = BOSS.throwN || 1;
      if (t < 14) return "throwUp";
      if (t >= 14 + n * 12) return "idle";
      return (t - 14) % 12 < 5 ? "throwRel" : "throwUp";
    }
    if ((s === "walk" || s === "enter") && e.walkT > 0) return BJ_WALK[Math.floor(e.walkT / 9) % 4];
    return "idle";
  }
  // ---- Boss entrance (entr v1): Brickjaw shoulder-charges out through the brick storefront wall ----
  const BJ_ENTR = {
    len: 170, zoom: 1.32, sub: "LANDLORD OF THE BLOCK",
    setup(api, e, st) { st.wx = api.camX + 300; st.wy = api.floorTop + 2; Object.assign(e, { x: st.wx, y: st.wy, z: 0, state: "tele", t: 4, entrHide: true, facing: -1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => (t < 40 ? { x: st.wx, y: 132 } : { x: e.x, y: e.y - e.z - 44 }),
    step(api, e, st, t) {
      const B = api.entr.BITS, mid = (api.floorTop + api.floorBot) / 2;
      if (t < 38) { if (t % 9 === 0) { api.shake(2, 8, true); api.SFX.rumble(); api.entr.debris(st.wx, st.wy, 30, 1, { spread: 0.6, up: 0.2, frames: [B[0]], back: true }); } return; }
      if (t === 38) { e.entrHide = false; api.entr.impact(st.wx, st.wy, 6, { stop: 5 }); api.entr.debris(st.wx, st.wy + 6, 28, 18, { spread: 2.4, up: 2, w: 18, h: 26, dir: -0.6, frames: [B[0], B[0], B[0], B[1]] }); api.SFX.finisher(); }
      if (t >= 38 && t <= 72) { const k = (t - 38) / 34; e.x = api.lerp(st.wx, api.camX + api.W / 2, k); e.y = api.lerp(st.wy, mid, k); e.z = Math.sin(k * Math.PI) * 30 + (1 - k) * 18; e.state = "charge"; e.t = 10; }
      if (t === 72) { e.z = 0; api.entr.impact(e.x, e.y, 7, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 6, { spread: 1.8, frames: [B[0]] }); }
      if (t > 72 && t < 92) { e.state = "tele"; e.t = 4; }
      if (t >= 92) { e.state = "summon"; e.t = 30; if (t === 96) api.SFX.charge(); }
    },
    drawBack(api, st, t, cx) { const x = st.wx - cx; if (t < 38) api.entr.cracks(x, 138, 34, t / 38); else BJ_ENTR.persist(api, st, cx, Math.min(1, (t - 38) / 4)); },
    persist(api, st, cx, k) { api.entr.hole(st.wx - cx, 140, 24, 30, k === undefined ? 1 : k, "#0a0608", "#4a2a22"); },
  };
  const BOSS = {
    name: "BRICKJAW", base: "ramrod", hp: 36, scale: 1.05, speed: 1.1, // ramrod behaviours; art is the painted Brickjaw sheet
    moves: ["charge", "kick", "throw", "summon"], proj: "brick", throwN: 2, minions: ["purple", "heavy"], summonCd: 700, cool: 105, pitch: 95,
    entrance: BJ_ENTR,
    lines: { intro: "THIS IS MY BLOCK, SHELL-FOR-BRAINS!", hit: ["HEY! WATCH THE JACKET!", "YOU'RE GONNA PAY FOR THAT!", "LUCKY SHOT, GREENIE!"], summon: "BOYS! GET 'EM!", ko: "MY... BEAUTIFUL... BLOCK..." },
    draw(api, e, sx, sy) { // level15 spr() anchor pattern: stance centre on sx
      const fr = brickFrame(e), F = BJF[fr] || BJF.idle;
      const red = (e.state === "tele" && e.t % 6 < 3) || (e.state === "throw" && e.t < 14 && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3);
      const base = api.img(BJ_IMG), im = red ? redSheet() || base : base;
      const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
      if (!im || im.complete === false || im.naturalWidth === 0) { api.rect(sx - 14, sy - 90, 28, 90, "#3a2448"); return; }
      api.drawFrame(im, F, sx + jx + (F[2] / 2 - F[4]) * BJ_K * e.facing, sy, BJ_K, e.facing);
    },
  };

  SS.registerLevel({
    number: 2,
    name: "STREET RUMBLE",
    card: { title: "STREET RUMBLE", tagline: "THE GANG'S ALL HERE. AND THEY'RE ALL MAD.", color: "#e83aa0" },
    music, bossMusic,
    // painted regular enemies (street family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback
    enemySkins: (() => { const IMG = "levels/enemies_street.png", ENEMY_F = { light: {"idle":[4,0,102,165,49],"walk":[110,0,90,165,44],"walk2":[204,2,83,163,38],"attack":[291,23,122,142,53],"jump":[417,22,137,143,60],"hurt":[558,23,79,142,39],"down":[641,124,183,41,91],"dash":[828,78,153,87,107],"grab":[985,78,154,87,90]}, weapon: {"idle":[4,173,60,165,32],"walk":[68,169,80,169,38],"walk2":[152,171,87,167,43],"attack":[243,182,145,156,50],"jump":[392,172,74,166,48],"hurt":[470,195,101,143,66],"down":[575,297,178,41,89],"throw":[757,185,115,153,56]}, big: {"idle":[4,348,91,163,40],"walk":[99,342,82,169,38],"walk2":[185,344,93,167,48],"attack":[282,348,146,163,54],"jump":[432,356,103,155,44],"hurt":[539,360,104,151,62],"down":[647,461,183,50,91],"shoot":[834,345,146,166,33]} }, T = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),
    hues: { purple: 300, blue: 190, star: 30, dasher: 120, heavy: 330, gunner: 260 },
    sections: [{
      bg: "levels/level2_street.jpg", floor: [168, 218], length: 2320,
      locks: [0, 460, 920, 1400],
      waves: [["purple", "purple", "blue"], ["star", "heavy", "purple", "blue"], ["dasher", "purple", "sword", "star", "dasher"], ["heavy", "dasher", "gunner", "blue", "purple"]],
      grade: "rgba(20,10,60,0.12)", weather: "rain",
      hazards: [manholes, hydrants],
      // v1.1: breakable / throwable props (some hide pizza) and a free slice by the curb
      props: [{ kind: "crate", x: 220, y: 206, drop: "slice" }, { kind: "barrel", x: 520, y: 190 }, { kind: "trash", x: 800, y: 176 }, { kind: "cone", x: 880, y: 212 },
        { kind: "barrel", x: 1290, y: 202 }, { kind: "crate", x: 1480, y: 210, drop: "pizza" }, { kind: "trash", x: 1880, y: 180, drop: "slice" }, { kind: "cone", x: 2010, y: 214 }],
      pickups: [{ kind: "slice", x: 1000, y: 214 }],
    }],
    restructure: { // phase 2: street (zone 1) -> searchlight stealth on the roofs (twist) -> rooftops (zone 2) -> helipad arena
      split: 0, images: ["levels/level2_twist.png", "levels/level2_rooftops.jpg", "levels/level2_rooftop_boss.jpg"],
      tsec: { bg: "levels/level2_rooftops.jpg", weather: "rain", hazards: [] },
      twist: { kind: "searchlight", title: "FOOT CHOPPER OVERHEAD!", sub: "HIDE BEHIND THE ROOF HATCHES - DON'T GET LIT UP", len: 2100, img: "levels/level2_twist.png", fr: {"heli": [0, 0, 400, 221], "lamp": [403, 0, 60, 78], "escape": [466, 0, 154, 240], "hatch": [623, 0, 100, 103]},
        heli: true, lights: [{ y: 44, spd: 0.011 }], covers: [{ spr: "hatch", x: 96, w: 40, d: 22, k: 0.42 }, { spr: "hatch", x: 286, w: 40, d: 22, k: 0.42 }],
        alarm: ["gunner", "purple"], volley: true, drip: ["purple"], gap: 330, cap: 2, color: "#ffe27a" },
      z2bg: "levels/level2_rooftops.jpg", z2: { hazards: [], weather: "rain" },
      arena: { bg: "levels/level2_rooftop_boss.jpg", floor: [168, 218], length: 384, locks: [], waves: [], weather: "rain", hazards: [], grade: "rgba(20,10,60,0.10)" },
    },
    boss: BOSS,
    images: [BJ_IMG, PR_IMG],
    outro: { // a short beat after the boss: the brother spots where the gang went next
      update: (api, st, t) => { if (t === 20) api.playerBark(true, "THEY WENT DOWN THE SEWER!"); return t > 130; },
      draw: () => {},
    },
    onUnload() { manholes.init = hydrants.init = null; BJ_RED = null; },
  });
})();
