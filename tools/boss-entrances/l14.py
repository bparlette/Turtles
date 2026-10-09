from lp import apply
ENT = r'''  // ---- Boss entrance (entr v1): the Technodrome's hatch irises open, Krang's android body stomps down the ramp out of the violet glow ----
  const KG_ENTR = {
    len: 200, zoom: 1.26, sub: "WARLORD OF DIMENSION X",
    setup(api, e, st) { Object.assign(e, { x: api.camX + OUT_DOOR.x, y: OUT_DOOR.y, z: OUT_DOOR.z, facing: 1, state: "walk", walkT: 0, t: 0, vuln: 0, entrAlpha: 0 }); st.door = 0; api.SFX.door(); api.SFX.rumble(); },
    focus: (api, e, st, t) => t < 50 ? { x: api.camX + OUT_DOOR.x, y: OUT_DOOR.y - OUT_DOOR.z - 20 } : { x: e.x, y: e.y - e.z - 46 },
    step(api, e, st, t) {
      const mid = Math.round((api.floorTop + api.floorBot) / 2);
      st.door = Math.min(1, t / 40);
      if (t < 40) { if (t % 10 === 0) { api.shake(1, 6, true); api.SFX.zap(); } if (t % 6 === 0) api.fx("smoke", api.camX + OUT_DOOR.x + api.rnd(-14, 14), OUT_DOOR.y - OUT_DOOR.z + 6, 16); e.entrAlpha = 0; return; }
      if (t < 64) { e.entrAlpha = (t - 40) / 24; e.walkT = 0; e.facing = api.player.x >= e.x ? 1 : -1; if (t === 46) api.SFX.charge(); return; }
      e.entrAlpha = undefined;
      if (t < 150) { const k = (t - 64) / 86; e.y = api.lerp(OUT_DOOR.y, mid, k); e.z = api.lerp(OUT_DOOR.z, 0, k); e.walkT = (e.walkT || 0) + 1; e.state = "walk";
        if ((t - 64) % 18 === 0) { api.SFX.land(); api.shake(2 + k * 2, 10, true); api.dust(e.x - 10, e.y); api.dust(e.x + 10, e.y); } return; }
      if (t === 150) { e.z = 0; e.walkT = 0; api.entr.impact(e.x, e.y, 6, { stop: 5, puffs: 6 }); api.entr.debris(e.x, e.y, 2, 10, { spread: 2.6 }); api.fx("ring", e.x, e.y, 20); }
      if (t > 150 && t < 186) { e.state = "summon"; e.t = t - 150; if (t % 8 === 0) api.fx("spark", e.x + api.rnd(-16, 16), e.y - api.rnd(30, 90), 10); }
      if (t >= 186) { e.state = "walk"; e.walkT = 0; }
    },
    drawBack(api, st, t, cx) { // the hatch opening: dark slit widening, violet light spilling out and down the ramp
      if (!st.door) return; const c = api.ctx, x = OUT_DOOR.x + (api.camX - cx), y = OUT_DOOR.y - OUT_DOOR.z, k = st.door, fade = Math.min(1, (200 - t) / 30);
      c.save(); c.globalAlpha = fade; c.fillStyle = "#08020e"; c.fillRect(x - 15 * k, y - 34, 30 * k, 36);
      c.globalCompositeOperation = "lighter"; c.globalAlpha = fade * (0.55 + 0.25 * Math.sin(t * 0.3)); glow(c, x, y - 14, 20 + 30 * k, "rgba(190,90,255,0.9)");
      c.globalAlpha = fade * 0.35 * k; c.fillStyle = "rgba(200,140,255,1)"; c.beginPath(); c.moveTo(x - 15 * k, y + 2); c.lineTo(x + 15 * k, y + 2); c.lineTo(x + 34 * k, OUT_DOOR.y + 30); c.lineTo(x - 34 * k, OUT_DOOR.y + 30); c.closePath(); c.fill();
      c.restore();
    },
    finish(api, e) { e.go = true; e.vuln = 0; e.entrAlpha = undefined; },
  };
  const bossCfg = {'''
apply(14, [('''  const bossCfg = {''', ENT),
 ('''    spawn(api, e) { Object.assign(e, { state: "phase", t: 0, x: 250, y: 186, z: 0, facing: -1, inv: 999, sumCd: 520, vuln: 0 }); api.SFX.zap(); },''',
  '''    spawn(api, e) { Object.assign(e, { state: "phase", t: 0, x: 250, y: 186, z: 0, facing: -1, inv: 999, sumCd: 520, vuln: 0 }); api.SFX.zap(); },
    entrance: KG_ENTR,''')])
