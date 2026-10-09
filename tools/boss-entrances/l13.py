from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): Granitor's artillery shells the arena centre, then Traag leaps off the emplacement through the smoke and lands like a falling boulder ----
  const TG_ENTR = {
    len: 180, zoom: 1.28, sub: "STONE WARLORD OF DIMENSION X",
    setup(api, e, st) { if (!G) G = fresh(); Object.assign(e, { x: PART.x - 26, y: 176, z: 92, facing: -1, state: "walk", walkT: 0, t: 0, who: "traag" }); st.sh = null; api.SFX.rumble(); },
    focus: (api, e, st, t) => t < 44 ? { x: st.sh ? st.sh.x : api.camX + 260, y: st.sh ? st.sh.y - 20 : 110 } : { x: e.x, y: e.y - e.z - 40 },
    step(api, e, st, t) {
      if (!G) return;
      const P = G.partner, mid = Math.round((api.floorTop + api.floorBot) / 2), cxm = api.camX + api.W / 2;
      if (P.fireT > 0) P.fireT--; P.t++;
      if (t === 10) { P.fireT = 16; api.SFX.gun(); api.shake(2, 8, true); api.fx("boom", CANNON.x, CANNON.y, 14); st.sh = { x: CANNON.x, y: CANNON.y, k: 0 }; }
      if (st.sh && st.sh.k < 1) { st.sh.k = Math.min(1, (t - 10) / 24); st.sh.x = api.lerp(CANNON.x, cxm, st.sh.k); st.sh.y = api.lerp(CANNON.y, mid, st.sh.k) - Math.sin(st.sh.k * Math.PI) * 34; }
      if (t === 34) { st.sh = null; api.entr.impact(cxm, mid, 5, { stop: 3, puffs: 6 }); api.fx("boom", cxm, mid - 10, 30); G.craters.push({ x: cxm, y: mid, t: 0 }); api.entr.debris(cxm, mid, 4, 12, { spread: 2.8, up: 2 }); }
      if (t < 46) { e.state = "walk"; e.walkT = 0; e.facing = -1; if (t === 30) api.enemySay(e, "GRANITOR! CLEAR ME A LANDING!", 60, e.cfg.pitch, true); return; }
      if (t === 46) { api.SFX.jump(); st.x0 = e.x; st.z0 = e.z; st.y0 = e.y; }
      if (t > 46 && t <= 86) { const k = (t - 46) / 40; e.state = "charge"; e.t = 10; e.x = api.lerp(st.x0, cxm, k); e.y = api.lerp(st.y0, mid, k); e.z = api.lerp(st.z0, 0, k * k) + Math.sin(k * Math.PI) * 30;
        if (t % 4 === 0) api.fx("smoke", e.x, e.y - e.z - 10, 12); }
      if (t === 86) { e.z = 0; api.entr.impact(e.x, e.y, 8, { stop: 6, puffs: 8 }); api.entr.debris(e.x, e.y, 2, 16, { spread: 3.2, up: 2.5 }); api.SFX.rumble(); }
      if (t > 86 && t < 110) { e.state = "kwind"; e.t = 2; }
      if (t >= 110 && t < 140) { e.state = "fire"; e.mv = "blast"; e.t = t - 80; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 118) { api.SFX.gun(); api.shake(2, 8, true); api.fx("spark", e.x + e.facing * 34, e.y - 64, 14); e.recoil = 6; } if (e.recoil > 0) e.recoil--; }
      if (t >= 140) { e.state = "walk"; e.mv = null; e.walkT = 0; }
    },
    drawFront(api, st, t, cx) { const s = st.sh; if (!s) return; const c = api.ctx; c.save(); c.globalCompositeOperation = "lighter"; glow(c, s.x - cx, s.y, 9, "rgba(255,170,70,0.9)"); c.restore(); api.rect(s.x - cx - 2, s.y - 2, 4, 4, "#5a5a64"); },
    finish(api, e) { e.mv = null; e.recoil = 0; if (G) { G.partner.fireT = 0; G.barCd = Math.max(G.barCd, 300); } },
  };
  const bossCfg = {'''
apply(13, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { e.who = "traag"; e.cfg = Object.assign({}, bossCfg); e.sumCd = 600; },''',
  '''    spawn(api, e) { e.who = "traag"; e.cfg = Object.assign({}, bossCfg); e.sumCd = 600; },
    entrance: TG_ENTR,''')])
