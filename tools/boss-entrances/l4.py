from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): Jetwash dives out of the sunset sky, skids his rocket boots along the asphalt, then lifts into a hover ----
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
    number: 4,'''
apply(4, [('''  SS.registerLevel({
    number: 4,''', ENT),
 ('''      spawn(api, e) { e.z = 14; e.rigCd = 200; },''', '''      spawn(api, e) { e.z = 14; e.rigCd = 200; },
      entrance: JW_ENTR,''')])
