from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): Razorback rises from the throne as the core flares, vaults off the dais and craters the floor ----
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
    name: "RAZORBACK",'''
apply(8, [('''  const bossCfg = {
    name: "RAZORBACK",''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "throne", t: 0, x: THRONE_X, y: DAIS_Y, z: DAIS_Z, facing: -1, inv: 999, sumCd: 500 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "throne", t: 0, x: THRONE_X, y: DAIS_Y, z: DAIS_Z, facing: -1, inv: 999, sumCd: 500 }); },
    entrance: RZ_ENTR,''')])
