from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): a fin circles the deck, stops dead over the grate, then Armaggon bursts up through the planks ----
  const AR_ENTR = {
    len: 170, zoom: 1.3, sub: "TERROR OF THE SEVEN SEAS",
    setup(api, e, st) { Object.assign(e, { x: GRATE.x + 90, y: 186, z: 0, facing: -1, state: "rise", t: 0 }); },
    focus: (api, e, st, t) => ({ x: e.x, y: t < 84 ? e.y - 20 : e.y - e.z - 50 }),
    step(api, e, st, t) {
      updateParts();
      if (t < 56) { const a = t * 0.11; e.x = GRATE.x + Math.cos(a) * 90; e.y = 186 + Math.sin(a) * 22; e.state = "rise"; e.t = 10; e.facing = -Math.sin(a) >= 0 ? 1 : -1; if (t % 8 === 0) splinters(e.x, e.y, 2); if (t % 18 === 0) api.SFX.swing(); return; }
      if (t === 56) { e.x = GRATE.x; e.y = GRATE.y + 18; api.SFX.charge(); }
      if (t < 84) { e.state = "rise"; e.t = 130; if (t % 6 === 0) api.shake(1, 6, true); return; }
      if (t === 84) { api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.SFX.finisher(); splinters(e.x, e.y, 16); splash(e.x, e.y, 12);
        const im = A.img(PR_IMG); if (ready(im)) api.entr.debris(e.x, e.y, 6, 6, { img: im, frames: [PF.scar], k: 0.18, spread: 2.2, up: 2.5, w: 14 });
        api.entr.debris(e.x, e.y, 4, 10, { spread: 2.4, up: 2.5, colors: ["#8a5a2a", "#d8a060", "#5a3a1a", "#bfeaff"] }); }
      if (t >= 84 && t <= 116) { const k = (t - 84) / 32; e.state = "slam"; e.t = 5; e.z = Math.sin(k * Math.PI) * 50; e.y = api.lerp(GRATE.y + 18, (api.floorTop + api.floorBot) / 2, k); }
      if (t === 116) { e.z = 0; api.entr.impact(e.x, e.y, 6, { stop: 4, sfx: "land" }); splash(e.x, e.y, 8); }
      if (t > 116) { e.state = t < 132 ? "slam" : "rise"; e.t = t < 132 ? 5 : 170; }
    },
    drawBack(api, st, t, cx) { if (t >= 84) AR_ENTR.persist(api, st, cx); },
    persist(api, st, cx) { spr(PF.scar, GRATE.x - cx, GRATE.y + 18, 46, 17); },
    finish(api, e) { e.go = true; },
  };
  const bossCfg = {'''
apply(10, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "rise", t: 0, x: GRATE.x, y: GRATE.y + 20, z: 0, facing: -1, inv: 999, sumCd: 400 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "rise", t: 0, x: GRATE.x, y: GRATE.y + 20, z: 0, facing: -1, inv: 999, sumCd: 400 }); },
    entrance: AR_ENTR,''')])
