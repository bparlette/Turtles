from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): klaxons, then Grimwale bursts out through the middle cargo hatch, ripping the roller door off ----
  const GW_ENTR = {
    len: 175, zoom: 1.3, sub: "SCOURGE OF THE HARBOUR",
    setup(api, e, st) {
      const z = (api.STATE.haz || []).find((q) => q.h === hatches); st.d = z && z.st.doors[1];
      st.hx = st.d ? (st.d.x0 + st.d.x1) / 2 : api.camX + 235; st.hy = api.floorTop + 1;
      Object.assign(e, { x: st.hx, y: st.hy, z: 0, facing: -1, state: "charge", t: 5, entrHide: true });
      if (st.d) { st.d.alarm = 120; st.d.open = 0; st.d.want = 0; st.d.hold = 0; }
      api.SFX.door();
    },
    focus: (api, e, st, t) => (t < 44 ? { x: st.hx, y: 120 } : { x: e.x, y: e.y - 46 }),
    step(api, e, st, t) {
      const d = st.d, mid = (api.floorTop + api.floorBot) / 2;
      if (t < 42) { if (t % 10 === 0) { api.SFX.clink(); api.shake(2, 6, true); } return; }
      if (t === 42) {
        if (d) { d.open = 1; d.want = 1; d.hold = 999; }
        e.entrHide = false; api.entr.impact(st.hx, st.hy, 7, { stop: 6 }); api.SFX.finisher();
        const im = api.img(PR_IMG);
        if (ready(im)) api.entr.debris(st.hx, st.hy + 8, 40, 1, { img: im, frames: [PRF.shutter], k: 0.17, spread: 0.6, up: 2.5, w: 4, h: 4 });
        api.entr.debris(st.hx, st.hy + 6, 30, 10, { spread: 2.2, up: 1.6, w: 26, h: 30, frames: [api.entr.BITS[2], api.entr.BITS[3], api.entr.BITS[4]] });
      }
      if (t > 42 && t <= 86) { const k = (t - 42) / 44; e.x = api.lerp(st.hx, api.camX + api.W / 2, k); e.y = api.lerp(st.hy, mid, k); e.state = k < 0.55 ? "charge" : "walk"; e.t = 5; e.walkT = (e.walkT || 0) + 1;
        if (t % 6 === 0) { api.SFX.land(); api.dust(e.x, e.y); } }
      if (t === 86) api.entr.impact(e.x, e.y, 4, { sfx: "land", stop: 0, ring: false, puffs: 2 });
      if (t > 86) { e.state = "summon"; e.t = 2; if (t === 92) api.SFX.rumble(); }
    },
    finish(api, e, st) { if (st.d) { st.d.hold = 50; st.d.want = 1; st.d.open = Math.max(st.d.open, 1); } },
  };
  SS.registerLevel({
    number: 5,'''
apply(5, [('''  SS.registerLevel({
    number: 5,''', ENT),
 ('''      draw: gwBossDraw, // painted sheet (was the tinted Ramrod atlas)''', '''      draw: gwBossDraw, // painted sheet (was the tinted Ramrod atlas)
      entrance: GW_ENTR,''')])
