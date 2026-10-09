from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): the rift flares, Viral compiles out of the data monolith pixel by pixel, glitches and steps into the arena ----
  const VR_ENTR = {
    len: 165, zoom: 1.3, sub: "THE GHOST IN THE MACHINE",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: MONO.x, y: 178, z: 0, facing: -1, state: "boot", t: 0 }); G.rift = 0.9; api.SFX.zap(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - 40 }),
    step(api, e, st, t) {
      if (!G) return;
      G.bits = G.bits.filter((g) => { g.t++; g.x += g.vx; g.y += g.vy; g.vy += 0.08; return g.t < g.life; });
      G.rift = Math.max(0.3, G.rift - 0.004);
      const mid = (api.floorTop + api.floorBot) / 2;
      if (t <= 78) { e.state = "boot"; e.t = Math.round(t * 90 / 78); if (t % 2 === 0) G.bits.push({ x: e.x + api.rnd(-22, 22), y: e.y - api.rnd(0, 76), vx: 0, vy: 0.6, t: 0, life: 20, c: t % 4 ? "#7aff5a" : "#ff5af0" });
        if (t % 16 === 0) api.SFX.zap(); return; }
      if (t === 79) { api.entr.impact(e.x, e.y, 5, { sfx: "charge", stop: 4, ring: true, puffs: 0 }); burst(e.x, e.y - 40, 18, ["#7aff5a", "#ff5af0", "#ffffff"]); G.rift = 1.2; }
      if (t > 79 && t < 96) { e.state = "walk"; e.walkT = 0; e.entrAlpha = (t % 4 < 2) ? 0.35 : 1; e.x = MONO.x + ((t % 6) - 3); }
      if (t >= 96 && t < 130) { e.entrAlpha = undefined; e.x = MONO.x; e.state = "walk"; e.walkT = (e.walkT || 0) + 1; e.y = api.lerp(178, mid, (t - 96) / 34); }
      if (t >= 130) { e.state = "kick"; e.t = 4; e.walkT = 0; if (t === 130) { api.SFX.swing(); burst(e.x - 12, e.y - 30, 6, ["#7aff5a"]); } }
    },
  };
  const bossCfg = {'''
apply(12, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "boot", t: 0, x: MONO.x, y: 178, z: 0, facing: -1, inv: 999, sumCd: 400 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "boot", t: 0, x: MONO.x, y: 178, z: 0, facing: -1, inv: 999, sumCd: 400 }); },
    entrance: VR_ENTR,''')])
