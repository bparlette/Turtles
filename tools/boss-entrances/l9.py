from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): Karai poses on the gate roof against the moon, then dives off it and lands blade-first in a burst of smoke ----
  const KR_ENTR = {
    len: 160, zoom: 1.32, sub: "MISTRESS OF THE FOOT",
    setup(api, e, st) { Object.assign(e, { x: GATE_X, y: ROOF_Y, z: ROOF_Z, facing: -1, state: "perch", t: 0 }); api.SFX.shuriken(); },
    focus: (api, e, st, t) => ({ x: e.x, y: e.y - e.z - 34 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, cxm = api.camX + api.W / 2;
      if (t < 50) { e.state = t > 30 ? "throw" : "perch"; e.t = 30; e.x = GATE_X; e.y = ROOF_Y; e.z = ROOF_Z; if (t === 30) { api.SFX.swing(); api.fx("spark", e.x + 12, e.y - e.z - 40, 10); } return; }
      if (t === 50) { api.SFX.jump(); puff(api, GATE_X, ROOF_Y - ROOF_Z + 4, 4); }
      if (t >= 50 && t <= 86) { const k = (t - 50) / 36; e.x = api.lerp(GATE_X, cxm, k) + Math.sin(k * Math.PI) * 26; e.y = api.lerp(ROOF_Y, mid, k); e.z = api.lerp(ROOF_Z, 0, k * k) + Math.sin(k * Math.PI) * 28; e.state = "hop"; e.t = 5;
        if (t % 4 === 0) api.fx("smoke", e.x, e.y - e.z - 20, 10); }
      if (t === 86) { e.z = 0; api.entr.impact(e.x, e.y, 6, { stop: 5, sfx: "land" }); puff(api, e.x, e.y, 8, true); api.SFX.clink(); }
      if (t > 86 && t < 104) { e.state = "charge"; e.t = 4; }
      if (t >= 104) { e.state = "perch"; e.t = 0; e.walkT = 0; }
    },
    finish(api, e) { e.go = true; },
  };
  const bossCfg = {'''
apply(9, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "perch", t: 0, x: GATE_X, y: ROOF_Y, z: ROOF_Z, facing: -1, inv: 999, sumCd: 520 }); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "perch", t: 0, x: GATE_X, y: ROOF_Y, z: ROOF_Z, facing: -1, inv: 999, sumCd: 520 }); },
    entrance: KR_ENTR,''')])
