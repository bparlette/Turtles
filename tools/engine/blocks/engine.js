  // ---------- ENGINE v2 (engine upgrades): fixed 60 Hz step, seeded RNG, input record/replay, hit-stop + camera shake, lights ----------
  // Simulation runs in fixed 1/60 s steps from an accumulator (at most ENG_MAX_STEPS catch-up steps per display frame), so game
  // speed is the same on 30/60/120 Hz and slow phones. Rendering is separate: one draw per display frame that ran >= 1 step
  // (no interpolation: level draw hooks keep their own frame counters, so drawing more often than the sim would speed them up).
  // Every Math.random() made inside a step comes from RNG (one mulberry32 stream); audio and drawing keep the native one (NRAND).
  const ENG_STEP = 1000 / 60, ENG_MAX_STEPS = 5;
  const ENGQ = location.search, ENG_DEBUG = /[?&]debug\b/.test(ENGQ);
  const RNG = { s: 1, seed(n) { RNG.s = (n >>> 0) || 1; },
    next() { let t = (RNG.s = (RNG.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
  RNG.seed((Date.now() ^ (NRAND() * 4294967296)) >>> 0);
  const ENG = { acc: 0, last: 0, steps: 0, inStep: false, turbo: ENG_DEBUG ? Math.max(1, Math.min(16, +((ENGQ.match(/[?&]turbo=(\d+)/) || [])[1] || 1))) : 1,
    st: { n: 0, upd: 0, drw: 0, lit: 0, frames: 0, stepsRun: 0, dropped: 0, a: [] }, shakeOn: true, lightMode: "on", stopMs: 0 };
  // ---- settings without a settings screen: localStorage (+ ?shake=on|off, ?light=on|low|off) ----
  { const q = (k) => (ENGQ.match(new RegExp("[?&]" + k + "=(\\w+)")) || [])[1];
    const sh = q("shake"); if (sh) LS.set("ssla_shake", sh !== "off" && sh !== "0");
    const li = q("light"); if (li && ["on", "low", "off"].includes(li)) LS.set("ssla_light", li);
    ENG.shakeOn = LS.get("ssla_shake", true) !== false; ENG.lightMode = LS.get("ssla_light", "auto"); }
  const engSet = { shake(on) { ENG.shakeOn = !!on; LS.set("ssla_shake", !!on); }, light(m) { ENG.lightMode = m; LS.set("ssla_light", m); LIGHT.mode = null; } };

  // ---- Input snapshot (everything the simulation reads), for the recorder / replayer ----
  const inSnap = () => [[...keys].sort().join("|"), [...pressed].sort().join("|"), JOY.dx, JOY.dy, JOY.mag, JOY.kx, JOY.ky, GP.dx, GP.dy, GP.mag,
    (BTN_A.down ? 1 : 0) | (BTN_A.hit ? 2 : 0) | (BTN_B.down ? 4 : 0) | (BTN_B.hit ? 8 : 0) | (BTN_P.down ? 16 : 0) | (BTN_P.hit ? 32 : 0), tapPoint ? [tapPoint.x, tapPoint.y] : 0];
  function inApply(s) {
    keys.clear(); if (s[0]) for (const k of s[0].split("|")) keys.add(k);
    pressed.clear(); if (s[1]) for (const k of s[1].split("|")) pressed.add(k);
    JOY.dx = s[2]; JOY.dy = s[3]; JOY.mag = s[4]; JOY.kx = s[5]; JOY.ky = s[6]; GP.dx = s[7]; GP.dy = s[8]; GP.mag = s[9];
    const b = s[10]; BTN_A.down = !!(b & 1); BTN_A.hit = !!(b & 2); BTN_B.down = !!(b & 4); BTN_B.hit = !!(b & 8); BTN_P.down = !!(b & 16); BTN_P.hit = !!(b & 32);
    tapPoint = s[11] ? { x: s[11][0], y: s[11][1] } : null;
  }
  // ---- State hash: FNV-1a over the gameplay state (exact number strings) ----
  function stateHash() { const str = stateStr(); let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0"); }
  function stateStr() {
    const T = STATE, p = T.player, parts = [T.t, T.scene, T.level, T.sec, T.section, T.phase, T.wave, T.camX, T.score, T.kills, T.deaths, T.stop, T.scroll, T.locked, RNG.s];
    if (p) parts.push(p.bro && p.bro.name, p.x, p.y, p.z, p.vz, p.hp, p.facing, p.atk, p.attackT, p.inv, p.downT, p.deadT, p.combo);
    for (const e of T.enemies || []) parts.push(e.type, e.x, e.y, e.z, e.hp, e.state, e.t, e.facing, e.cool);
    for (const s of T.stars || []) parts.push(s.x, s.y, s.z);
    for (const r of T.props || []) parts.push(r.kind, r.x, r.y, r.state, r.hp);
    for (const it of T.items || []) parts.push(it.kind, it.x, it.y);
    return parts.join(",");
  }
  const REC = { mode: null, armed: /[?&]record\b/.test(ENGQ), d: null, cur: null, run: 0, i: 0, n: 0, res: null, msgT: 0, fast: /[?&]fast\b/.test(ENGQ) };
  function recBegin(bro, lvl, keep) { // called from startStage: the sync point of every recording
    REC.d = { v: 2, game: "shellshock-live", seed: RNG.s, level: lvl, bro, diff: DIFF, keep: keep ? keep.score : 0, t0: STATE.t, runs: [], checks: [], steps: 0, ua: navigator.userAgent };
    REC.mode = "rec"; REC.cur = null; REC.run = 0; REC.n = 0; REC.msgT = 90;
  }
  function recEnd(why) {
    if (REC.mode !== "rec" || !REC.d) return null;
    if (REC.cur) REC.d.runs.push([REC.run, REC.cur]);
    REC.d.steps = REC.n; REC.d.hash = stateHash(); REC.d.end = why; REC.mode = null;
    const json = JSON.stringify(REC.d); window.__SSREC_LAST = REC.d;
    try { localStorage.setItem("ssla_replay_last", json); } catch (_) {}
    console.log("[replay] recorded " + REC.n + " steps, level " + REC.d.level + ", hash " + REC.d.hash + " (" + why + ")");
    if (/[?&]record=dl\b/.test(ENGQ)) { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = "ss_replay_L" + REC.d.level + ".json"; a.click(); } catch (_) {} }
    return REC.d;
  }
  function playBegin(d) { // reset the world the same way the recording started, then feed the recorded inputs step by step
    REC.d = d; REC.mode = "wait"; REC.diff = null; REC.firstBad = 0; REC.i = 0; REC.run = 0; REC.n = 0; REC.res = null;
    DIFF = d.diff | 0; for (const k of [...pressed]) pressed.delete(k);
    MENU = null; GAL = null; beginLevel(d.bro, d.level, d.keep ? { score: d.keep } : null);
  }
  function engStageStart(bro, lvl, keep) { // startStage hook: deterministic resets, then (re)seed
    for (const q of POOL) q.on = false; poolCur = 0; VFX.section = null; VFX.prev.length = 0; VFX.shT = 0; VFX.shOx = VFX.shOy = 0; VFX.trem = 0;
    IBUF.a = IBUF.b = IBUF.p = 0; ENG.stopMs = 0; for (const k in COMBO_COUNT) COMBO_COUNT[k] = 0;
    REC.skip = ENG.inStep; // the rest of a step that called startStage is not part of the recording
    if (REC.mode === "wait" && REC.d) { RNG.seed(REC.d.seed); STATE.t = REC.d.t0; REC.mode = "play"; return; }
    if (REC.armed && REC.mode !== "play") { RNG.seed(NRAND() * 4294967296); recBegin(bro, lvl, keep); }
  }
  function recPre() { // before each step
    if (REC.mode === "play") {
      const d = REC.d;
      if (REC.i >= d.runs.length) return;
      inApply(d.runs[REC.i][1]); if (++REC.run >= d.runs[REC.i][0]) { REC.i++; REC.run = 0; }
    } else if (REC.mode === "rec") {
      const s = inSnap(), k = JSON.stringify(s);
      if (REC.cur && JSON.stringify(REC.cur) === k) REC.run++; else { if (REC.cur) REC.d.runs.push([REC.run, REC.cur]); REC.cur = s; REC.run = 1; }
    }
  }
  function recPost() { // after each step
    if (REC.skip) { REC.skip = false; return; }
    if (ENG_DEBUG && REC.d && REC.n < 400) { // debug: per-step state strings to pinpoint the first divergent step
      if (REC.mode === "rec") (REC.d.trace = REC.d.trace || []).push(stateStr());
      else if (REC.mode === "play" && REC.d.trace && !REC.diff && REC.d.trace[REC.n] !== undefined && REC.d.trace[REC.n] !== stateStr()) REC.diff = { step: REC.n + 1, rec: REC.d.trace[REC.n], play: stateStr() };
    }
    if (REC.mode === "rec") {
      REC.n++; if (REC.n % 120 === 0) REC.d.checks.push([REC.n, stateHash()]);
      if ((STATE.results && STATE.results.t > 2) || (STATE.scene !== "stage" && STATE.scene !== "card") || REC.n > 216000) recEnd(STATE.results ? "results" : "scene " + STATE.scene);
    } else if (REC.mode === "play") {
      const d = REC.d; REC.n++;
      const ck = d.checks.find((c) => c[0] === REC.n); if (ck && !REC.firstBad) { const h = stateHash(); if (h !== ck[1]) REC.firstBad = REC.n; }
      if (REC.n >= d.steps) {
        const h = stateHash(); REC.res = { ok: h === d.hash, hash: h, expect: d.hash, steps: REC.n, level: d.level, firstBadCheck: REC.firstBad || 0, diff: REC.diff || null };
        REC.mode = "done"; REC.msgT = 100000; console.log("[replay] " + (REC.res.ok ? "MATCH" : "MISMATCH") + " " + JSON.stringify(REC.res));
      }
    }
  }
  function recDraw() { // tiny overlay (on top of everything, never part of the sim)
    if (REC.mode === "rec" && STATE.t % 40 < 26) { rect(W - 40, 26, 34, 11, "#000"); ctx.fillStyle = "#e8302a"; ctx.beginPath(); ctx.arc(W - 34, 31.5, 3, 0, 6.3); ctx.fill(); ptext("REC", W - 18, 29, 1, "#fff"); }
    if (REC.mode === "play" || REC.mode === "wait") ptext("REPLAY " + REC.n + "/" + (REC.d ? REC.d.steps : 0), W / 2, 214, 1, "#7fdcff");
    if (REC.mode === "done" && REC.res) { rect(W / 2 - 110, 196, 220, 22, "#000"); ptext("REPLAY " + (REC.res.ok ? "HASH MATCH " : "HASH MISMATCH ") + REC.res.hash, W / 2, 203, 1, REC.res.ok ? "#7fd85a" : "#ff4a3a"); }
  }
  { const m = ENGQ.match(/[?&]replay=([^&]+)/); // ?replay=<file.json> (fetched) or ?replay=last (the last recording on this device)
    if (m) setTimeout(function go() {
      if (STATE.scene !== "title" || STATE.booting) return setTimeout(go, 100);
      const src = decodeURIComponent(m[1]);
      const p = src === "last" ? Promise.resolve(JSON.parse(localStorage.getItem("ssla_replay_last") || "null")) : fetch(src, { cache: "no-store" }).then((r) => r.json());
      p.then((d) => { if (d && d.runs) playBegin(d); else console.warn("[replay] no recording at " + src); }).catch((e) => console.warn("[replay] load failed", e));
    }, 100); }

  // ---- Hit-stop (40-80 ms scaled by strength; light jabs keep their 2-frame stop) ----
  function hitStop(s) { // s in 0..1; heavy hits, specials, boss hits and KOs
    const ms = 40 + 40 * Math.max(0, Math.min(1, s)), f = Math.ceil(ms / ENG_STEP - 0.05); // 40 ms -> 3 steps (50 ms), 80 ms -> 5 steps (83 ms)
    if (STATE.stop < f) STATE.stop = f;
  }
  // ---- Camera shake: decaying, eased amplitude, smoothed direction; also driven by the legacy STATE.shake rises ----
  function shakeStep() {
    if (STATE.shake > (VFX.lastSh || 0)) shake(Math.min(4, STATE.shake / 4), Math.min(24, 6 + STATE.shake), true); // legacy STATE.shake values now move the camera
    VFX.lastSh = STATE.shake;
    if (VFX.shT > 0) {
      const u = VFX.shT / VFX.shN, a = VFX.decay ? VFX.shA * u * u * (3 - 2 * u) : VFX.shA; VFX.shT--;
      VFX.trem = (VFX.trem || 0) + 2.1 + NRAND() * 1.4;
      VFX.shOx = Math.round(Math.cos(VFX.trem) * a * 2) / 2; VFX.shOy = Math.round(Math.sin(VFX.trem * 1.37) * a * 0.75 * 2) / 2;
      if (a < 0.5) VFX.shOx = VFX.shOy = 0;
    } else VFX.shOx = VFX.shOy = 0;
  }

  // ---- Dynamic light: additive glow blobs drawn into a low-res offscreen buffer, composited with 'lighter' ----
  // Sources: fire (drawFlame), explosions/sparks (fx), specials, muzzle flashes, projectiles (PROJ_DEFS.light), section/level neon
  // (section.lights or LEVEL_LIGHTS) and anything a level adds with api.light(). Modes: on (W/4 buffer, 48 lights), low (W/8, 16),
  // off. "auto" starts on and drops to low, then off, when the measured draw time stays over budget (iPhone low-power fallback).
  const LIGHT = { list: [], n: 0, mode: null, buf: null, g: null, spr: {}, autoT: 0, autoSum: 0, autoN: 0, gain: 0.62 };
  function lightMode() {
    if (LIGHT.mode) return LIGHT.mode;
    const m = ENG.lightMode; LIGHT.mode = m === "low" || m === "off" || m === "on" ? m : (navigator.hardwareConcurrency || 4) <= 2 ? "low" : "on";
    LIGHT.buf = null; return LIGHT.mode;
  }
  function light(x, y, r, c, a) { // screen-space light for this draw; r in world px, a 0..1
    if (LIGHT.n >= 64 || !(r > 0) || !(a > 0.02) || x < -r || x > W + r || y < -r || y > H + r) return;
    const L = LIGHT.list[LIGHT.n] || (LIGHT.list[LIGHT.n] = {}); L.x = x; L.y = y; L.r = r; L.c = c; L.a = a; LIGHT.n++;
  }
  function lightSprite(c) { // soft radial blob in colour c, cached
    let s = LIGHT.spr[c]; if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = 32; const g = s.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, c); gr.addColorStop(0.35, c); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, 32, 32); g.globalCompositeOperation = "destination-in";
    const g2 = g.createRadialGradient(16, 16, 0, 16, 16, 16); g2.addColorStop(0, "rgba(0,0,0,1)"); g2.addColorStop(0.5, "rgba(0,0,0,0.45)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = g2; g.fillRect(0, 0, 32, 32); return (LIGHT.spr[c] = s);
  }
  const LEVEL_LIGHTS = { // static neon / furnace glows for painted backgrounds, world x (tiled with the bg) and screen y
    7: [{ bgx: 0.6, y: 120, r: 70, c: "#ff7a1a", a: 0.30, fl: 0.25 }],
  };
  function gatherLights(cx) {
    const p = STATE.player, t = STATE.t;
    for (const f of STATE.fx) { if (f.t < 0) continue; const k = f.t / f.life, x = f.x - cx;
      if (f.kind === "boom") light(x, f.y, 70 * Math.min(1, k * 3 + 0.4), "#ff9a2a", 0.95 * (1 - k));
      else if (f.kind === "spark") light(x, f.y, f.big ? 30 : 18, f.cyan ? "#7fdcff" : "#fff2c0", (f.big ? 0.7 : 0.45) * (1 - k));
      else if (f.kind === "wspark") light(x, f.y, 20, f.c || "#fff", 0.5 * (1 - k));
      else if (f.kind === "ring") light(x, f.y, 50, "#fff0a0", 0.5 * (1 - Math.max(0, k)));
      else if (f.kind === "clink") light(x, f.y, 16, "#bfe4ff", 0.5 * (1 - k)); }
    if (p && p.atk === "power" && p.spec) light(p.x - cx, p.y - p.z - 16, 56, p.bro.mask, 0.7);
    for (const s of STATE.stars) { const d = projDef(s), L = d && d.light; if (L) light(s.x - cx, s.y - (s.z || 0) - (s.arc ? 6 : 12), L.r, L.c, L.a); }
    for (const e of STATE.enemies) { // muzzle flashes
      const d = ENEMY_DEFS[e.type], mz = d && d.muzzle;
      if (mz && e.state === "attack" && e.t >= mz.t0 && e.t <= mz.t1) light(e.x - cx + e.facing * mz.dx, e.y - e.z - mz.dy, mz.r, mz.c, mz.a * (1 - (e.t - mz.t0) / (mz.t1 - mz.t0 + 1)));
      if (e.state === "fire" && e.t % 5 < 3 && e.t <= 30) light(e.x - cx + e.facing * 18, e.y - e.z - 30 * ((e.cfg && e.cfg.scale) || 1), 36, "#ffb050", 0.6);
    }
    if (STATE.section === "L") {
      const S = curSec(), L = (S && S.lights) || (S && S === curLV().sections[0] ? LEVEL_LIGHTS[STATE.level] : null);
      if (L) for (const q of L) { const fl = q.fl ? 1 - q.fl * (0.5 + 0.5 * Math.sin(t * 0.21 + q.r)) * (Math.sin(t * 0.07 + q.r * 3) > 0.6 ? 1 : 0.4) : 1;
        if (q.bgx !== undefined) { const bg = lvImg(S.bg); if (!bg) continue; const tw = Math.round(bg.naturalWidth * H / bg.naturalHeight), off = cx + (STATE.scroll || 0);
          for (let i = Math.floor((off - q.r) / tw); i * tw - off < W + q.r; i++) light(i * tw + q.bgx * tw - off, q.y, q.r, q.c, q.a * fl); }
        else light(q.x - cx, q.y, q.r, q.c, q.a * fl); }
    }
  }
  function drawLights(cx) {
    const mode = lightMode(); if (mode === "off") { LIGHT.n = 0; return; }
    const t0 = performance.now();
    try { gatherLights(cx); } catch (_) {}
    if (!LIGHT.n) return;
    const div = mode === "low" ? 8 : 4, LW = Math.ceil(W / div), LH = Math.ceil(H / div), max = mode === "low" ? 16 : 48;
    if (!LIGHT.buf || LIGHT.buf.width !== LW) { LIGHT.buf = document.createElement("canvas"); LIGHT.buf.width = LW; LIGHT.buf.height = LH; LIGHT.g = LIGHT.buf.getContext("2d"); }
    const g = LIGHT.g; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, LW, LH); g.globalCompositeOperation = "lighter";
    const n = Math.min(LIGHT.n, max);
    for (let i = 0; i < n; i++) { const L = LIGHT.list[i], r = L.r / div; g.globalAlpha = Math.min(1, L.a); g.drawImage(lightSprite(L.c), L.x / div - r, L.y / div - r, r * 2, r * 2); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = LIGHT.gain; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(LIGHT.buf, 0, 0, LW, LH, 0, 0, LW * div, LH * div); ctx.restore();
    LIGHT.n = 0; ENG.st.litAcc = (ENG.st.litAcc || 0) + performance.now() - t0;
  }
  function lightAuto(drawMs) { // low-power fallback: sustained slow draws step the lights down (session only)
    if (ENG.lightMode !== "auto" || (LIGHT.mode !== "on" && LIGHT.mode !== "low")) return;
    LIGHT.autoSum += drawMs; if (++LIGHT.autoN < 180) return;
    const avg = LIGHT.autoSum / LIGHT.autoN; LIGHT.autoSum = 0; LIGHT.autoN = 0;
    if (avg > 14) { LIGHT.mode = LIGHT.mode === "on" ? "low" : "off"; LIGHT.buf = null; console.log("[light] auto -> " + LIGHT.mode + " (draw " + avg.toFixed(1) + " ms)"); }
  }

  // ---- One simulation step ----
  function simStep() {
    ENG.inStep = true; const rnd0 = Math.random; Math.random = RNG.next;
    try {
      STATE.t++;
      if (REC.mode !== "play") pollGamepad();
      recPre();
      SCENES[STATE.scene].update();
      if (STATE.scene === "stage" && STATE.player) { // formerly in drawStage: render-side particles + camera, now stepped at 60 Hz
        vfxObserve(STATE.player); vfxStep(); shakeStep();
        if (STATE.zoom > 0) STATE.zoomT = STATE.zoom--; else STATE.zoomT = 0;
        if (STATE.tagT > 0) STATE.tagT--;
      }
    } catch (err) { frameErr("update", err); }
    finally { Math.random = rnd0; ENG.inStep = false; }
    try { capArrays(); } catch (_) {}
    try { recPost(); } catch (err) { frameErr("replay", err); }
    pressed.clear(); BTN_A.hit = BTN_B.hit = BTN_P.hit = false;
    ENG.st.stepsRun++;
  }
  function engFrame() {
    const now = performance.now();
    let dt = ENG.last ? now - ENG.last : ENG_STEP; ENG.last = now;
    if (dt > 250 || dt < 0) dt = ENG_STEP; // tab was hidden / long stall: resume, don't fast-forward
    if (Math.abs(dt - ENG_STEP) < 1.5) dt = ENG_STEP; // vsync jitter snap (keeps 60 Hz displays at exactly one step per frame)
    else if (Math.abs(dt - 2 * ENG_STEP) < 1.5) dt = 2 * ENG_STEP;
    ENG.acc += dt * (REC.fast && REC.mode === "play" ? 8 : ENG.turbo);
    const cap = ENG_MAX_STEPS * (REC.fast && REC.mode === "play" ? 8 : ENG.turbo);
    let n = 0; const t0 = performance.now();
    while (ENG.acc >= ENG_STEP - 0.001 && n < cap) { simStep(); ENG.acc -= ENG_STEP; n++; }
    if (ENG.acc >= ENG_STEP) { ENG.st.dropped += Math.floor(ENG.acc / ENG_STEP); ENG.acc = 0; } // too slow even with catch-up: drop the backlog (slows down, never spirals)
    const t1 = performance.now();
    if (n) render();
    const t2 = performance.now();
    const S = ENG.st; S.frames++; if (n) { S.n++; S.upd += t1 - t0; S.drw += t2 - t1; S.a.push(t2 - t0); if (S.a.length > 600) S.a.shift(); lightAuto(t2 - t1); }
  }
  window.__SSENG = { // debug / test API
    get RNG() { return RNG; }, hash: stateHash, seed: (n) => RNG.seed(n), get rec() { return REC; },
    record() { REC.armed = true; }, stop: () => recEnd("api"), replay: (d) => playBegin(typeof d === "string" ? JSON.parse(d) : d),
    get result() { return REC.res; }, get last() { return window.__SSREC_LAST || JSON.parse(localStorage.getItem("ssla_replay_last") || "null"); },
    settings: engSet, get shakeOn() { return ENG.shakeOn; }, get lightMode() { return lightMode(); },
    stats() { const S = ENG.st, a = S.a.slice().sort((x, y) => x - y); const r = { frames: S.frames, drawn: S.n, steps: S.stepsRun, dropped: S.dropped, updMs: +(S.upd / Math.max(1, S.n)).toFixed(2), drawMs: +(S.drw / Math.max(1, S.n)).toFixed(2),
      lightMs: +((S.litAcc || 0) / Math.max(1, S.n)).toFixed(3), p95: +(a[Math.floor(a.length * 0.95)] || 0).toFixed(2), light: LIGHT.mode };
      S.n = 0; S.upd = 0; S.drw = 0; S.litAcc = 0; S.a = []; return r; },
  };
