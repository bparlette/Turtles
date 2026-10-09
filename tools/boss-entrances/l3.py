from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): the gator surfaces out of the glowing channel, then belly-flops into the arena ----
  const GT_ENTR = {
    len: 175, zoom: 1.3, sub: "KING OF THE SEWER",
    setup(api, e, st) { st.wx = api.camX + api.W / 2 + 70; st.wy = api.floorTop + 3; Object.assign(e, { x: st.wx, y: st.wy, z: -96, facing: -1, state: "throw", mv: "surf", mt: 10, t: 20, entrClip: st.wy + 1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: t < 70 ? st.wy - 40 : e.y - e.z - 46 }),
    step(api, e, st, t) {
      if (t < 24) { if (t % 4 === 0) splash(api, st.wx + api.rnd(-16, 16), st.wy, false); if (t % 8 === 0) api.shake(1, 6, false); return; }
      if (t === 24) { api.SFX.boom(); splash(api, st.wx, st.wy, true); splash(api, st.wx - 14, st.wy + 2, true); api.shake(3, 14, true); }
      if (t < 70) { e.z = Math.min(0, -96 + (t - 24) * 2.6); e.entrClip = st.wy + 1; if (t % 5 === 0) splash(api, e.x + api.rnd(-14, 14), st.wy, t % 10 === 0); return; }
      if (t === 70) { e.z = 0; e.entrClip = undefined; api.SFX.jump(); st.y0 = e.y; }
      if (t >= 70 && t <= 104) { const k = (t - 70) / 34; e.x = api.lerp(st.wx, api.camX + api.W / 2, k); e.y = api.lerp(st.y0, (api.floorTop + api.floorBot) / 2, k); e.z = Math.sin(k * Math.PI) * 52; e.state = "slam"; e.t = 30; if (t % 3 === 0) api.fx("pop", e.x, e.y - e.z - 20, 12); }
      if (t === 104) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); splash(api, e.x - 18, e.y, true); splash(api, e.x + 18, e.y, true); api.entr.debris(e.x, e.y, 2, 6, { colors: ["#3ae06a", "#2a8a3a", "#5a4a3a"] }); }
      if (t > 104 && t < 124) { e.state = "slam"; e.t = 50; }
      if (t >= 124) { e.state = "summon"; e.t = 2; }
    },
    finish(api, e) { e.mv = null; e.mt = 0; },
  };
  const boss = {
    name: "GULCH GATOR", base: "ramrod",'''
apply(3, [('''  const boss = {
    name: "GULCH GATOR", base: "ramrod",''', ENT),
 ('''    spawn(api, e) { // surf out of the outflow pipe instead of walking in''', '''    entrance: GT_ENTR,
    spawn(api, e) { // surf out of the outflow pipe instead of walking in''')])
