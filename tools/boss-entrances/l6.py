from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): the frozen fountain cracks, shatters, and Cold Front leaps out of the ice ----
  const CF_ENTR = {
    len: 170, zoom: 1.3, sub: "100% CHANCE OF PAIN",
    setup(api, e, st) { st.fx = api.camX + 192; st.fy = api.floorTop - 6; Object.assign(e, { x: st.fx, y: st.fy, z: 22, facing: -1, state: "tele", t: 4, entrHide: true }); api.SFX.rumble(); },
    focus: (api, e, st, t) => (t < 48 ? { x: st.fx, y: 112 } : { x: e.x, y: e.y - e.z - 46 }),
    step(api, e, st, t) {
      const mid = (api.floorTop + api.floorBot) / 2, im = prImg(), ice = im ? { img: im, frames: [PRF.chunk, PRF.chunk, PRF.icicle, PRF.snowball], k: 0.5 } : {};
      if (t < 46) { if (t % 8 === 0) { api.shake(2, 6, true); api.SFX.clink(); } if (t % 12 === 0) api.fx("smoke", st.fx + api.rnd(-24, 24), api.rnd(70, 140), 20); return; }
      if (t === 46) { e.entrHide = false; api.entr.impact(st.fx, st.fy, 7, { stop: 6, ring: false }); api.SFX.finisher();
        api.entr.debris(st.fx, st.fy, 50, 18, Object.assign({ spread: 2.6, up: 1.5, w: 26, h: 40, colors: ["#e8f6ff", "#a8d8f8", "#7ab8e8", "#ffffff"] }, ice)); }
      if (t >= 46 && t <= 84) { const k = (t - 46) / 38; e.x = st.fx; e.y = api.lerp(st.fy, mid, k); e.z = 22 * (1 - k) + Math.sin(k * Math.PI) * 46; e.state = "slam"; e.t = 30; }
      if (t === 84) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6 }); api.entr.debris(e.x, e.y, 2, 8, Object.assign({ spread: 2, colors: ["#e8f6ff", "#a8d8f8"] }, ice)); }
      if (t > 84 && t < 104) { e.state = "tele"; e.t = 4; }
      if (t >= 104) { e.state = "summon"; e.t = 2; if (t % 6 === 0) api.fx("smoke", e.x + e.facing * 14, e.y - 70, 18); }
    },
    drawBack(api, st, t, cx) { const x = st.fx - cx; if (t < 46) api.entr.cracks(x, 108, 40, t / 46, "rgba(240,250,255,0.95)"); else CF_ENTR.persist(api, st, cx, Math.min(1, (t - 46) / 4)); },
    persist(api, st, cx, k) { api.entr.hole(st.fx - cx, 116, 22, 30, k === undefined ? 1 : k, "rgba(20,40,70,0.85)", "rgba(220,244,255,0.9)"); },
  };
  SS.registerLevel({
    number: 6,'''
apply(6, [('''  SS.registerLevel({
    number: 6,''', ENT),
 ('''      update: bossUpdate, draw: bossDraw,
      lines: { intro: "FORECAST: 100% CHANCE OF SHELL-SICLES!",''', '''      update: bossUpdate, draw: bossDraw, entrance: CF_ENTR,
      lines: { intro: "FORECAST: 100% CHANCE OF SHELL-SICLES!",''')])
