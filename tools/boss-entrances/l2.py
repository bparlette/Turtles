from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): Brickjaw shoulder-charges out through the brick storefront wall ----
  const BJ_ENTR = {
    len: 170, zoom: 1.32, sub: "LANDLORD OF THE BLOCK",
    setup(api, e, st) { st.wx = api.camX + 300; st.wy = api.floorTop + 2; Object.assign(e, { x: st.wx, y: st.wy, z: 0, state: "tele", t: 4, entrHide: true, facing: -1 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => (t < 40 ? { x: st.wx, y: 132 } : { x: e.x, y: e.y - e.z - 44 }),
    step(api, e, st, t) {
      const B = api.entr.BITS, mid = (api.floorTop + api.floorBot) / 2;
      if (t < 38) { if (t % 9 === 0) { api.shake(2, 8, true); api.SFX.rumble(); api.entr.debris(st.wx, st.wy, 30, 1, { spread: 0.6, up: 0.2, frames: [B[0]], back: true }); } return; }
      if (t === 38) { e.entrHide = false; api.entr.impact(st.wx, st.wy, 6, { stop: 5 }); api.entr.debris(st.wx, st.wy + 6, 28, 18, { spread: 2.4, up: 2, w: 18, h: 26, dir: -0.6, frames: [B[0], B[0], B[0], B[1]] }); api.SFX.finisher(); }
      if (t >= 38 && t <= 72) { const k = (t - 38) / 34; e.x = api.lerp(st.wx, api.camX + api.W / 2, k); e.y = api.lerp(st.wy, mid, k); e.z = Math.sin(k * Math.PI) * 30 + (1 - k) * 18; e.state = "charge"; e.t = 10; }
      if (t === 72) { e.z = 0; api.entr.impact(e.x, e.y, 7, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 6, { spread: 1.8, frames: [B[0]] }); }
      if (t > 72 && t < 92) { e.state = "tele"; e.t = 4; }
      if (t >= 92) { e.state = "summon"; e.t = 30; if (t === 96) api.SFX.charge(); }
    },
    drawBack(api, st, t, cx) { const x = st.wx - cx; if (t < 38) api.entr.cracks(x, 138, 34, t / 38); else BJ_ENTR.persist(api, st, cx, Math.min(1, (t - 38) / 4)); },
    persist(api, st, cx, k) { api.entr.hole(st.wx - cx, 140, 24, 30, k === undefined ? 1 : k, "#0a0608", "#4a2a22"); },
  };
  const BOSS = {
    name: "BRICKJAW", base: "ramrod", hp: 36,'''
apply(2, [('''  const BOSS = {
    name: "BRICKJAW", base: "ramrod", hp: 36,''', ENT),
 ('''lines: { intro: "THIS IS MY BLOCK, SHELL-FOR-BRAINS!",''', '''entrance: BJ_ENTR,
    lines: { intro: "THIS IS MY BLOCK, SHELL-FOR-BRAINS!",''')])
