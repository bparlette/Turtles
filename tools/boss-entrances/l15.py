from lp import apply
ENT1 = r'''  // ---- Boss entrance (entr v1): lightning shows Shredder crouched on the pagoda eave; he dives off it and lands on the mutagen hatch seal ----
  const SH_ENTR = {
    len: 190, zoom: 1.3, sub: "MASTER OF THE FOOT CLAN",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: api.camX + 306, y: api.floorTop + 6, z: 72, facing: -1, state: "pose", t: 0, walkT: 0 }); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 40 }),
    step(api, e, st, t) {
      if (!G) return;
      if (G.flash > 0) G.flash--;
      const hx = api.camX + HATCH.x, hy = HATCH.y;
      if (t === 6 || t === 22) { G.flash = t === 6 ? 12 : 7; api.SFX.boom(); api.shake(t === 6 ? 3 : 1, 12, true); }
      if (t < 48) { e.state = "pose"; e.t = t < 30 ? 0 : 160; e.facing = -1; return; }
      if (t === 48) { api.SFX.jump(); api.SFX.swing(); st.x0 = e.x; st.y0 = e.y; st.z0 = e.z; api.entr.puff(e.x, e.y - e.z, 2); }
      if (t > 48 && t <= 82) { const k = (t - 48) / 34; e.state = "tk"; e.t = 10; e.x = api.lerp(st.x0, hx, k); e.y = api.lerp(st.y0, hy, k); e.z = api.lerp(st.z0, 0, k * k) + Math.sin(k * Math.PI) * 26; e.facing = -1;
        if (t % 3 === 0) api.fx("smoke", e.x + 6, e.y - e.z - 30, 10); }
      if (t === 82) { e.z = 0; st.seal = 1; api.entr.impact(e.x, e.y, 7, { stop: 5, puffs: 6, sfx: "land" }); api.SFX.clink(); for (let i = 0; i < 8; i++) api.fx("spark", hx + api.rnd(-50, 50), hy + api.rnd(-8, 8), 12); }
      if (st.seal) st.seal = Math.max(0, st.seal - 0.02);
      if (t > 82 && t < 106) { e.state = "charge"; e.t = 8; e.trail = null; }
      if (t >= 106) { e.state = "pose"; e.t = 160; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 106) { api.SFX.swing(); api.fx("spark", e.x + e.facing * 22, e.y - 50, 12); } }
    },
    drawBack(api, st, t, cx) { if (!st.seal) return; const c = api.ctx; c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = st.seal * 0.7; glow(c, HATCH.x + (api.camX - cx), HATCH.y, 70, "rgba(90,255,110,0.9)"); c.restore(); },
    finish(api, e) { e.trail = null; if (G) { G.flash = 0; G.sp = true; } },
  };
  const SHRED = {'''
ENT2 = r'''  // ---- Boss entrance (entr v1): the lab wall bulges and bursts, Super Shredder roars in the breach, then leaps to the centre and shatters the floor ----
  const SU_ENTR = {
    len: 200, zoom: 1.24, sub: "MUTATED BY THE OOZE",
    setup(api, e, st) { if (!G) G = fresh(); if (!G.hole) G.hole = { x: e.x, t: 0 }; Object.assign(e, { state: "breach", t: 0, z: 0, facing: -1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x - (t < 70 ? 20 : 0), y: e.y - e.z - 60 }),
    step(api, e, st, t) {
      if (!G) return;
      G.chunks = G.chunks.filter((k) => { k.t++; k.x += k.vx; k.y += k.vy; k.vy += 0.15; return k.t < 60; });
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t <= 60) { e.state = "breach"; e.t = Math.round(t * 69 / 60); G.hole.t = e.t; if (t % 12 === 0) { api.SFX.rumble(); api.shake(2, 10, true); api.entr.debris(e.x + api.rnd(-30, 30), e.y - 4, 110, 2, { spread: 0.6, up: -1, scale: 0.6 }); } return; }
      if (t === 61) { G.hole.t = 70; e.state = "kwind"; e.t = 1; api.entr.impact(e.x, e.y - 40, 8, { stop: 6, puffs: 6 }); api.SFX.finisher(); api.fx("boom", e.x, e.y - 50, 40);
        for (let i = 0; i < 22; i++) G.chunks.push({ x: e.x + api.rnd(-20, 20), y: e.y - api.rnd(20, 80), vx: api.rnd(-3, 1.2), vy: api.rnd(-3, 0), t: 0, s: 2 + (Math.random() * 4 | 0) });
        api.entr.debris(e.x - 10, e.y, 40, 16, { spread: 2.6, dir: -1, up: 1.5, h: 40 }); }
      if (t > 61 && t < 104) { e.state = "kwind"; e.t = 1; if (t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-18, 18), e.y - api.rnd(30, 120), 10); } if (t === 70) api.SFX.charge(); }
      if (t === 104) { api.SFX.jump(); st.x0 = e.x; st.y0 = e.y; }
      if (t > 104 && t <= 138) { const k = (t - 104) / 34; e.state = "hop"; e.t = 5; e.x = api.lerp(st.x0, cxm, k); e.y = api.lerp(st.y0, mid, k); e.z = Math.sin(k * Math.PI) * 50; }
      if (t === 138) { e.z = 0; api.entr.impact(e.x, e.y, 9, { stop: 7, puffs: 8 }); api.fx("ring", e.x, e.y, 24); api.entr.debris(e.x, e.y, 2, 14, { spread: 3.2, up: 2.2 }); api.SFX.rumble(); }
      if (t > 138) { e.state = "walk"; e.walkT = 0; e.facing = api.player.x >= e.x ? 1 : -1; }
    },
    finish(api, e) { e.fightOn = true; if (G && G.hole) G.hole.t = Math.max(G.hole.t, 70); },
  };
  const SUPER = {'''
apply(15, [('''  const SHRED = {''', ENT1), ('''  const SUPER = {''', ENT2),
 ('''    spawn(api, e) { Object.assign(e, { state: "pose", t: 0, x: 300, y: api.floorTop + 6, z: 0, facing: -1, inv: 2, sumCd: 400 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "pose", t: 0, x: 300, y: api.floorTop + 6, z: 0, facing: -1, inv: 2, sumCd: 400 }); },
    entrance: SH_ENTR,'''),
 ('''      const hx = api.camX + 292;
      G.hole = { x: hx, t: 0 };''', '''      if (!G) G = fresh(); const hx = api.camX + 292; // entr v1: guard for Boss Rush (no section init)
      G.hole = { x: hx, t: 0 };'''),
 ('''      Object.assign(e, { state: "breach", t: 0, x: hx, y: api.floorTop + 1, z: 0, facing: -1, inv: 2 });
    },''', '''      Object.assign(e, { state: "breach", t: 0, x: hx, y: api.floorTop + 1, z: 0, facing: -1, inv: 2 });
    },
    entrance: SU_ENTR,''')])
