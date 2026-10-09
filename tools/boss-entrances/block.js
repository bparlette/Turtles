  // ---- BOSS ENTRANCES (entr v1): scripted 2-4 s in-world arrivals, Half-Life style ----
  // A boss cfg may carry `entrance: def` (or a function (api, e) => def). While it runs, the rest of the stage is paused,
  // input is locked (the brother steps clear of the landing spot), the camera zooms toward the action, letterbox bars and the
  // name banner overlay the scene, and a tap / any attack button skips it. When it ends (or is skipped) every actor is put in
  // the CENTRE of the arena in "walk" with normal AI, and the intro line is said if the entrance did not say it.
  // def = { len (frames, 60-260), zoom (1.2), focus(api, e, st, t) -> {x, y} world, banner (frame), sub, color, name,
  //         setup(api, e, st), step(api, e, st, t), drawBack(api, st, t, cx), drawFront(api, st, t, cx),
  //         finish(api, e, st, skipped), actors: [extra actors to centre], endY, cool, sayAt, say:false }
  // Helpers: api.entr.debris(x, y, z, n, opts), api.entr.impact(x, y, amp, opts), api.entr.puff(x, y, n), api.entr.active
  const ENTR_SKIP_AFTER = 24, ENTR_TOP = 30, ENTR_BOT = 10;
  const ENTR_BITS = [[779, 104, 44, 32], [735, 105, 40, 31], [204, 34, 52, 51], [256, 85, 52, 51], [204, 85, 52, 51]]; // painted brick, rock, crate splinters (shared_sprites)
  function entrStart(e, def) {
    if (STATE.entr) return null;
    if (typeof def === "function") def = safe(() => def(API, e), null);
    if (!def) return null;
    const p = STATE.player, cxm = STATE.camX + W / 2;
    const en = { e, def, t: 0, st: {}, len: Math.max(60, Math.min(260, def.len || 180)), parts: [], said: false, skipped: false, hs: 0,
      cam: { x: e ? e.x : cxm, y: e ? e.y - 40 : H / 2 } };
    STATE.entr = en; STATE.bossT = 0; tapPoint = null;
    if (p) {
      if (p.hold) safe(() => releaseHold(p, false)); if (p.carry) safe(() => dropProp(p)); if (p.grabbedBy) safe(() => releaseGrab(false));
      Object.assign(p, { attackT: 0, atk: null, buf: 0, spec: null, comboT: 0, stunT: 0, frozen: false });
      const side = p.x < cxm ? -1 : 1, px = Math.abs(p.x - cxm) < 80 ? cxm + side * 100 : p.x;
      en.px = Math.max(STATE.camX + 26, Math.min(STATE.camX + W - 26, px));
    }
    for (const a of [e].concat(def.actors || [])) if (a) { a.inv = 999; a.entr = true; a.sayT = 0; }
    if (def.setup) safe(() => def.setup(API, e, en.st, en));
    return en;
  }
  function entrUpdate(p) {
    const en = STATE.entr, d = en.def, e = en.e;
    p.attackT = 0; p.atk = null; p.buf = 0; for (const k in IBUF) IBUF[k] = 0;
    if (p.z > 0 || p.vz > 0) { p.z += p.vz; p.vz -= 0.25; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
    if (p.downT > 0) p.downT--; if (p.hurtT > 0) p.hurtT--;
    const dx = en.px - p.x;
    if (p.downT === 0 && Math.abs(dx) > 1.5) { p.x += Math.sign(dx) * 1.7; p.walkT++; } else p.walkT = 0;
    const fxw = e ? e.x : en.cam.x; p.facing = fxw >= p.x ? 1 : -1;
    const skip = en.t > ENTR_SKIP_AFTER && (tapPoint || anyPressed("enter", " ", "j", "k", "l", "escape") || BTN_A.hit || BTN_B.hit || BTN_P.hit);
    if (skip) { tapPoint = null; en.skipped = true; entrFinish(p); return; }
    entrParts(en);
    if (en.hs > 0) { en.hs--; return; }
    en.t++;
    const S = curSec(); if (S && S.auto) STATE.scroll += S.auto * (S.bossScroll !== undefined ? +S.bossScroll : 0.5); // the road keeps rolling
    if (d.step) safe(() => d.step(API, e, en.st, en.t, en));
    const f = d.focus ? safe(() => d.focus(API, e, en.st, en.t), null) : e ? { x: e.x, y: e.y - e.z - 40 } : null;
    if (f) { en.cam.x += (f.x - en.cam.x) * 0.16; en.cam.y += (f.y - en.cam.y) * 0.16; }
    if (e && d.say !== false && !en.said && en.t === (d.sayAt || en.len - 34)) entrSay(en);
    if (en.t >= en.len) entrFinish(p);
  }
  function entrSay(en) {
    const e = en.e, L = (e && e.cfg && e.cfg.lines) || en.def.lines || {}; en.said = true;
    if (e && L.intro) enemySay(e, L.intro, 110, (e.cfg && e.cfg.pitch) || 110, true);
  }
  function entrFinish(p) {
    const en = STATE.entr; if (!en) return;
    const d = en.def, e = en.e; STATE.entr = null; STATE.bossT = 0;
    const cxm = STATE.camX + W / 2, my = Math.round((FLOOR_TOP + FLOOR_BOT) / 2);
    const list = [e].concat(d.actors || []).filter(Boolean);
    list.forEach((a, i) => {
      const off = list.length > 1 ? (i - (list.length - 1) / 2) * 36 : 0;
      Object.assign(a, { x: cxm + off, y: a.entrY !== undefined ? a.entrY : d.endY !== undefined ? d.endY : my, z: 0, vz: 0, vx: 0, state: "walk", t: 0, walkT: 0,
        inv: 0, flash: 0, cool: d.cool || 70, entr: false, warn: false, pose: null, _ownState: null, entrHide: false, entrClip: undefined, entrAlpha: undefined });
      a.facing = p && p.x >= a.x ? 1 : -1;
    });
    if (d.finish) safe(() => d.finish(API, e, en.st, en.skipped, en)); // runs after the centring, so it can set flags / hover height
    if (p && Math.abs(p.x - cxm) < 60) p.x = en.px;
    if (p) { p.walkT = 0; p.z = Math.max(0, p.z); }
    if (e && d.say !== false && !en.said) entrSay(en);
    if (d.persist) STATE.entrScar = { d, st: en.st, sec: STATE.sec, lvl: STATE.level, sect: STATE.section }; // what the entrance broke stays broken
    for (const q of en.parts) q.t = q.life; // debris settles away with the cut
  }
  // painted debris chunks + dust (screen shake / hit-stop via the engine helpers)
  function entrDebris(x, y, z, n, o) {
    const en = STATE.entr; if (!en) return; o = o || {};
    const img = o.img || artOk(SH_IM), frs = o.frames || ENTR_BITS, k = o.k || SH_K;
    for (let i = 0; i < (n || 8); i++) {
      if (en.parts.length > 70) break;
      const sp = o.spread || 2.4, dir = o.dir || 0;
      en.parts.push({ x: x + rnd(-(o.w || 10), o.w || 10), y: y + rnd(-4, 4), z: z + rnd(0, o.h || 10), vx: rnd(-sp, sp) + dir * rnd(0.5, sp), vy: rnd(-0.4, 0.4),
        vz: rnd(o.up || 1.5, (o.up || 1.5) + 3), r: rnd(0, 6.3), vr: rnd(-0.3, 0.3), img, fr: frs[(Math.random() * frs.length) | 0],
        k: k * rnd(0.55, 1.05) * (o.scale || 1), t: 0, life: 70 + (Math.random() * 40 | 0), back: !!o.back });
    }
    const col = o.colors || ["#5a4a3a", "#8a7a6a", "#3a3430", "#a89a88"];
    for (let i = 0; i < (n || 8); i++) { const q = emit(CHUNK, x + rnd(-12, 12), y - z - rnd(0, 10), rnd(-2.6, 2.6), -rnd(1.2, 3.4), 30 + (Math.random() * 16 | 0), Math.random() < 0.5 ? 2 : 1, col[i % col.length]); if (q) q.fy = y; }
  }
  function entrPuff(x, y, n) { for (let i = 0; i < (n || 4); i++) fx("smoke", x + rnd(-18, 18), y - rnd(0, 14), 22 + (Math.random() * 12 | 0)); dust(x - 10, y); dust(x + 10, y); }
  function entrImpact(x, y, amp, o) {
    o = o || {}; amp = amp || 5;
    if (typeof API.hitStop === "function") safe(() => API.hitStop(o.stop || 5)); else if (STATE.entr) STATE.entr.hs = Math.max(STATE.entr.hs, o.stop === undefined ? 4 : o.stop);
    shake(amp, o.frames || 22, true); STATE.shake = Math.max(STATE.shake, amp * 2);
    if (o.sfx !== false) { const s = SFX[o.sfx || "boom"]; if (s) s(); }
    if (x !== undefined) { if (o.ring !== false) STATE.fx.push({ kind: "ring", x, y, t: 0, life: 20 }); entrPuff(x, y, o.puffs || 4); }
    buzz(60);
  }
  function entrHole(x, y, rw, rh, k, inner, rim) { // a jagged breach (wall / floor / door) drawn over the background
    if (!(k > 0)) return; const n = 16;
    for (const [sc, col] of [[1.18, rim || "#2a1e18"], [1, inner || "#07060a"]]) {
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, j = 0.78 + 0.4 * hash(i * 7 + 3); ctx.lineTo(x + Math.cos(a) * rw * k * j * sc, y + Math.sin(a) * rh * k * j * sc); }
      ctx.closePath(); ctx.fill();
    }
  }
  function entrCracks(x, y, r, k, col) { // spreading cracks before something breaks through
    if (!(k > 0)) return; ctx.save(); ctx.strokeStyle = col || "rgba(20,14,10,0.9)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 7; i++) { let px = x, py = y; ctx.moveTo(px, py); const a = i / 7 * 6.28 + hash(i) * 0.6;
      for (let j = 0; j < 5 * k; j++) { px += Math.cos(a + (hash(i * 9 + j) - 0.5) * 1.2) * r / 5; py += Math.sin(a + (hash(i * 5 + j) - 0.5) * 1.2) * r / 5 * 0.8; ctx.lineTo(px, py); } }
    ctx.stroke(); ctx.restore();
  }
  function entrParts(en) {
    en.parts = en.parts.filter((q) => {
      q.t++; q.x += q.vx; q.y += q.vy; q.z += q.vz; q.vz -= 0.22; q.r += q.vr;
      if (q.z <= 0) { q.z = 0; q.vz = Math.abs(q.vz) > 1.2 ? -q.vz * 0.35 : 0; q.vx *= 0.7; q.vr *= 0.5; }
      return q.t < q.life;
    });
  }
  function entrDraw(layer, cx) {
    const en = STATE.entr; if (!en) return; const d = en.def;
    const hook = layer === "back" ? d.drawBack : d.drawFront;
    if (hook) safe(() => hook(API, en.st, en.t, cx, en));
    for (const q of en.parts) {
      if (q.back !== (layer === "back") || !q.img) continue;
      const sx = q.x - cx, sy = q.y - q.z, a = Math.min(1, (q.life - q.t) / 16);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy); ctx.rotate(q.r); drawFrame(q.img, q.fr, 0, q.fr[3] * q.k / 2, q.k, 1); ctx.restore();
    }
  }
  function entrScarDraw(cx) {
    const s = STATE.entrScar; if (!s) return;
    if (s.sec !== STATE.sec || s.lvl !== STATE.level || s.sect !== STATE.section || STATE.scene !== "stage") { STATE.entrScar = null; return; }
    safe(() => s.d.persist(API, s.st, cx));
  }
  function entrCam() { // zoom toward the entrance: ease in, hold, ease back out for the hand-off
    const en = STATE.entr; if (!en) return;
    const zin = Math.min(1, en.t / 22), zout = Math.min(1, (en.len - en.t) / 26), k = Math.min(zin, zout), s = k * k * (3 - 2 * k);
    const z = 1 + ((en.def.zoom || 1.3) - 1) * s; if (z <= 1.001) return;
    const sx = Math.max(W * 0.22, Math.min(W * 0.78, en.cam.x - STATE.camX)), sy = Math.max(H * 0.2, Math.min(H * 0.78, en.cam.y));
    ctx.translate(sx, sy); ctx.scale(z, z); ctx.translate(-sx, -sy);
  }
  function entrHUD() { // letterbox bars, the name banner over the action, skip hint
    const en = STATE.entr; if (!en) return; const d = en.def, t = en.t;
    const b = Math.max(0, Math.min(1, t / 10, (en.len - t) / 10)), BT = d.barTop !== undefined ? d.barTop : ENTR_TOP;
    rect(0, 0, W, Math.round(BT * b), "#000"); rect(0, H - Math.round(ENTR_BOT * b), W, Math.round(ENTR_BOT * b), "#000");
    const at = d.banner !== undefined ? d.banner : Math.round(en.len * 0.26), bend = d.bannerEnd || Math.round(en.len * 0.76);
    if (t >= at && t < bend) {
      const bt = t - at, sl = easeOut(Math.min(1, bt / 12)), out = Math.min(1, (bend - t) / 10);
      const LV = curLV(), col = d.color || (LV && LV.card && LV.card.color) || "#ff4a3a";
      const name = d.name || (en.e && en.e.name) || "BOSS", y = (d.bannerY || ENTR_TOP + 18);
      ctx.globalAlpha = 0.62 * out; rect(0, y - 14, W, 30, "#05040a"); ctx.globalAlpha = out;
      rect(Math.round(W * (1 - sl)), y - 14, W, 1, col); rect(Math.round(-W * (1 - sl)), y + 15, W, 1, col);
      if (Math.floor(t / 8) % 2) ptext("WARNING", Math.round(W / 2 + (1 - sl) * W), y - 8, 1, "#ff4a3a");
      ptext(name, Math.round(W / 2 - (1 - sl) * W), y + 4, name.length > 13 ? 2 : 3, "#ffffff");
      if (d.sub) ptext(d.sub, Math.round(W / 2 + (1 - sl) * W), y + 22, 1, col);
      ctx.globalAlpha = 1;
    }
    if (t > ENTR_SKIP_AFTER && Math.floor(t / 20) % 3) ptext(STATE.showTouch ? "TAP TO SKIP" : "ATTACK TO SKIP", W - 6, H - 5, 1, "#9aa0b0", "right");
  }
  function entrDebugWarp() { // debug only: jump to the current level's boss (used by the entrance harness)
    const LV = curLV(), p = STATE.player; if (!p) return "none";
    if (!LV) { if (STATE.section === "A") { STATE.locked = true; STATE.wave = LOCKS.length - 1; STATE.queue = []; STATE.enemies = []; return "zaps"; } return "B"; }
    const last = LV.sections.length - 1; if (STATE.sec < last) { STATE.fadeOut = 1; return "fade"; }
    const S = LV.sections[last]; STATE.enemies = STATE.enemies.filter((e) => e.boss); STATE.queue = [];
    if (S.auto) { STATE.scroll = S.length + 1; STATE.wave = S.waves.length; return "auto"; }
    STATE.wave = (S.locks || []).length; STATE.locked = false; p.x = Math.max(60, LEVEL_W - 120); return "walk";
  }
  // ---- Level 1 entrances (level 1 lives in index.html) ----
  const L1_ENTR = {
    zaps(z) { // the Zap-Rollers come screaming down the hall, skid sideways in a shower of sparks and spin to face you
      return { len: 170, zoom: 1.22, name: "ZAP-ROLLERS", sub: "TWIN SECURITY TANKS", actors: z.slice(1),
        setup(api, e, st) { z.forEach((a, i) => { a.entrY = a.y; a.x = STATE.camX + W + 60 + i * 50; a.state = "walk"; a.walkT = 1; }); SFX.rumble(); },
        focus: (api, e) => ({ x: (z[0].x + z[z.length - 1].x) / 2, y: (z[0].y + z[z.length - 1].y) / 2 - 30 }),
        step(api, e, st, t) {
          z.forEach((a, i) => {
            const stopAt = STATE.camX + W / 2 + 40 + i * 30, tt = t - i * 10;
            if (tt < 0) return;
            if (!a.stopped) { a.x -= tt < 40 ? 5.2 : Math.max(0.4, 5.2 - (tt - 40) * 0.18); a.walkT++; a.facing = -1;
              if (tt % 3 === 0) emit(STREAK, a.x + 10, a.y - 4, rnd(1.5, 3.5), -rnd(0.3, 1.4), 10, 2, "#ffd27a");
              if (tt % 5 === 0) fx("spark", a.x + 12, a.y - 3, 8);
              if (a.x <= stopAt) { a.stopped = t; entrImpact(a.x, a.y, 4, { sfx: "clink", stop: 2, puffs: 2 }); fx("spark", a.x - 8, a.y - 6, 12); } }
            else { a.walkT = 0; a.facing = (t - a.stopped) < 14 ? ((t - a.stopped) % 6 < 3 ? 1 : -1) : -1; if (t - a.stopped === 20) { SFX.zap(); fx("spark", a.x, a.y - 30, 12); } }
          });
          if (t === 1 || t === 60) SFX.charge();
        },
        finish() { z.forEach((a) => { a.stopped = 0; }); },
      };
    },
    ramrod(e) { // the drill pod bores up through the floor, Ramrod kicks the hatch and stomps out
      return { len: 180, zoom: 1.25, name: "RAMROD", sub: "DRILL-POD DEMOLITION",
        step(api, e2, st, t) {
          if (STATE.intro > 0) updateIntro(STATE.player);
          if (t === 2 || t === INTRO_RISE) entrImpact(STATE.pod.x, STATE.pod.y, t === 2 ? 3 : 6, { stop: t === 2 ? 0 : 5, sfx: t === 2 ? "rumble" : "boom" });
          if (t === INTRO_RISE) entrDebris(STATE.pod.x, STATE.pod.y, 6, 12, { spread: 2.6, up: 2 });
          if (t === INTRO_OUT + 30) entrImpact(e.x, e.y, 3, { sfx: "land", stop: 0, ring: false, puffs: 2 });
        },
        focus: () => ({ x: STATE.pod ? STATE.pod.x - 30 : STATE.camX + W / 2, y: 140 }),
        finish() { STATE.intro = 0; if (STATE.pod) STATE.pod.t = Math.max(STATE.pod.t, INTRO_LEN); },
        say: false, // the pod intro has its own line
      };
    },
    scorcher(e) { // drops through the ceiling vent in a column of fire, lands in a crouch and flares up
      return { len: 150, zoom: 1.2, name: "SCORCHER", sub: "MINI-BOSS",
        setup(api, e2) { e.x = STATE.camX + W / 2 + 20; e.y = Math.round((FLOOR_TOP + FLOOR_BOT) / 2); e.z = 150; e.state = "charge"; e.t = 20; },
        step(api, e2, st, t) {
          if (t < 26) { if (t % 3 === 0) emit(EMBER, e.x + rnd(-10, 10), 34 + rnd(0, 8), rnd(-0.4, 0.4), rnd(0.4, 1.2), 30, 2, EMBER_COL[t % 4]); if (t === 1) SFX.rumble(); return; }
          if (t === 26) { SFX.charge(); entrDebris(e.x, e.y, 150, 8, { spread: 1.6, up: -1 }); }
          if (e.z > 0) { e.z = Math.max(0, e.z - (t - 25) * 0.9); e.state = "charge"; e.t = 30; if (t % 2 === 0) emit(EMBER, e.x + rnd(-8, 8), e.y - e.z - rnd(0, 40), rnd(-0.6, 0.6), -rnd(0, 1), 24, 2, EMBER_COL[t % 4]); if (e.z === 0) { st.land = t; entrImpact(e.x, e.y, 6); entrDebris(e.x, e.y, 2, 8, { colors: EMBER_COL }); } }
          else if (t - st.land < 20) { e.state = "tele"; e.t = 4; } else { e.state = "kwind"; e.t = 1; if (t % 3 === 0) emit(EMBER, e.x + rnd(-14, 14), e.y - rnd(10, 60), rnd(-0.5, 0.5), -rnd(0.6, 1.6), 30, 2, EMBER_COL[t % 4]); }
        },
      };
    },
  };
