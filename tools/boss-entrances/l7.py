from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): the yard crane lowers Rustmaul on its electromagnet, cuts the power, and he drops like a wrecking ball ----
  const RM_ENTR = {
    len: 180, zoom: 1.28, sub: "THE SCRAPYARD KING",
    setup(api, e, st) { st.x = api.camX + api.W / 2; st.my = 0; Object.assign(e, { x: st.x, y: (api.floorTop + api.floorBot) / 2, z: 230, facing: -1, state: "pull", t: 0 }); api.SFX.rumble(); },
    focus: (api, e, st, t) => ({ x: e.x, y: Math.max(70, e.y - e.z - 50) }),
    step(api, e, st, t) {
      const head = 106;
      if (t <= 60) { e.z = 230 - (170 * (1 - Math.pow(1 - t / 60, 2))); e.state = "pull"; e.t = 0; if (t % 20 === 0) api.SFX.rumble(); }
      else if (t < 82) { e.z = 60 + Math.sin(t * 0.3) * 1.5; if (t % 6 === 0) { api.SFX.zap(); api.fx("spark", e.x + api.rnd(-14, 14), e.y - e.z - head + api.rnd(-6, 6), 10); } }
      if (t === 82) { api.SFX.clink(); api.fx("spark", e.x, e.y - e.z - head, 14); st.cut = t; }
      if (t > 82 && e.z > 0) { e.z = Math.max(0, e.z - (t - 82) * 1.4); e.state = "slam"; e.t = 20; if (e.z === 0) { st.land = t; e.t = 50; api.entr.impact(e.x, e.y, 9, { stop: 7 });
        const im = prImg(api); if (im) api.entr.debris(e.x, e.y, 4, 10, { img: im, frames: [PR.scrap0, PR.scrap1, PR.scrap2, PR.scrap3, PR.tire], k: 0.28, spread: 2.6, up: 2, w: 20 });
        api.entr.debris(e.x, e.y, 2, 6, { spread: 2, colors: ["#6a6e78", "#8a3a22", "#4a5a3a", "#5a5050"] }); } }
      if (st.land && t - st.land < 18) { e.state = "slam"; e.t = 50; }
      if (st.land && t - st.land >= 18) { e.state = "summon"; e.t = 2; if (t - st.land === 20) api.SFX.charge(); }
      st.my = st.cut ? st.my + (t - st.cut) * 0.5 : 0; // the magnet winds back up after letting go
    },
    drawFront(api, st, t, cx, en) {
      const e = en.e, im = prImg(api); if (!e || !im) return;
      const c = api.ctx, mw = 34, mh = mw * PR.magnet[3] / PR.magnet[2], x = st.x - cx;
      const bot = (st.cut ? api.floorTop + (api.floorBot - api.floorTop) / 2 - 60 - 106 : e.y - e.z - 106) - st.my, top = bot - mh + 4;
      if (top < -mh) return;
      c.save(); c.imageSmoothingEnabled = true;
      c.drawImage(im, PR.cable[0], PR.cable[1], PR.cable[2], PR.cable[3], x - 2, -10, 4.5, Math.max(0, top + 12));
      c.drawImage(im, PR.magnet[0], PR.magnet[1], PR.magnet[2], PR.magnet[3], x - mw / 2, top, mw, mh);
      if (!st.cut && t % 8 < 4) { c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(140,200,255,0.35)"; c.fillRect(x - mw / 2, bot - 4, mw, 8); }
      c.restore();
    },
  };
  const BOSS_CFG = {
    name: "RUSTMAUL",'''
apply(7, [('''  const BOSS_CFG = {
    name: "RUSTMAUL",''', ENT),
 ('''    draw: drawRustmaul,
    spawn(api, e) { BOSS = e;''', '''    draw: drawRustmaul, entrance: RM_ENTR,
    spawn(api, e) { BOSS = e;''')])
