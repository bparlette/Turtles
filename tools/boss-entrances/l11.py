from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): eyes glow in the coal tender, then Leatherhead explodes out of the train car in a hail of coal ----
  const LH_ENTR = {
    len: 170, zoom: 1.3, sub: "THE OUTLAW OF THE RAILS",
    setup(api, e, st) { Object.assign(e, { x: TENDER.x, y: TENDER.y, z: TENDER.z, facing: 1, state: "lurk", t: 30, coal: 0 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 36 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t < 44) { e.state = "lurk"; e.t = 30 + t; e.coal = 0; if (t % 11 === 0) { api.shake(1, 6, false); api.SFX.rumble(); } return; }
      if (t === 44) { e.coal = 1; api.entr.impact(e.x, e.y - e.z, 7, { stop: 6, ring: false });
        const im = pimg(); if (im) api.entr.debris(e.x, e.y, e.z + 4, 12, { img: im, frames: [PF.coal], k: 0.09, spread: 2.6, up: 2.2, w: 22, h: 10 });
        api.entr.debris(e.x, e.y, e.z, 10, { spread: 2.4, up: 2, colors: ["#16151b", "#24232a", "#3a3436", "#ff8c1a"] }); for (let i = 0; i < 6; i++) api.fx("smoke", e.x + api.rnd(-26, 26), e.y - e.z - api.rnd(0, 20), 24); }
      if (t > 44 && t < 62) { e.state = "lurk"; e.t = 100; }
      if (t === 62) api.SFX.jump();
      if (t >= 62 && t <= 98) { const k = (t - 62) / 36; e.x = api.lerp(TENDER.x, cxm, k); e.y = api.lerp(TENDER.y, mid, k); e.z = api.lerp(TENDER.z, 0, k) + Math.sin(k * Math.PI) * 44; e.state = "hop"; e.t = 5; e.facing = 1; }
      if (t === 98) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 6, { spread: 2, colors: ["#8a5a2a", "#5a3a1a", "#16151b"] }); }
      if (t > 98) { e.state = "attack"; e.mv = "chomp"; e.t = t < 128 ? 60 : 41; if (t === 104 || t === 116) api.SFX.clink(); }
    },
    finish(api, e) { e.mv = null; e.coal = 1; },
  };
  const bossCfg = {'''
apply(11, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "lurk", t: 0, x: TENDER.x, y: TENDER.y, z: TENDER.z, facing: 1, inv: 999, sumCd: 400 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "lurk", t: 0, x: TENDER.x, y: TENDER.y, z: TENDER.z, facing: 1, inv: 999, sumCd: 400 }); },
    entrance: LH_ENTR,''')])
