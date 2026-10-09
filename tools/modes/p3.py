import sys
F=sys.argv[1]; s=open(F).read()
if "function applyRestructure" in s: print("already"); sys.exit(0)
helpers = r'''  // ---- restructure helpers (twist v1): def.restructure turns a level's long zone section into zone1 + twist + zone2 (+ arena) ----
  // R = { split: i (the long zone section), n1 (waves kept in zone 1, default 2), twist: {...}, tsec: {section overrides},
  //       z2bg, z2waves, z2: {zone-2 overrides}, z2sec: j (zone 2 already exists as section j), arena: {new arena section}, images: [...] }
  function applyRestructure(secs, R) {
    const out = secs.slice(), i = R.split || 0, s = out[i]; if (!s) return out;
    const L = s.locks || [], Wv = s.waves || [], n1 = R.n1 || Math.min(2, Wv.length);
    const z1 = Object.assign({}, s, { seg: "zone1", waves: Wv.slice(0, n1), locks: L.slice(0, n1) }, R.z1 || {});
    if (R.z2sec === undefined) z1.length = Math.min(s.length || 1800, s.auto ? (L[n1 - 1] || 0) + 900 : (L[n1 - 1] || 0) + W + 320);
    const tw = Object.assign({}, s, { seg: "twist", locks: [], waves: [], hazards: [], props: [], pickups: [], length: W, bgMirror: false }, R.tsec || {}, { twist: R.twist });
    let z2;
    if (R.z2sec !== undefined) z2 = Object.assign({}, out[R.z2sec], { seg: "zone2" }, R.z2bg ? { bg: R.z2bg } : {}, R.z2 || {});
    else {
      const wv = R.z2waves || Wv.slice(n1), base = L[n1] || 0, lk = R.z2waves ? R.z2waves.map((_, k) => k * 620) : L.slice(n1).map((x) => Math.max(0, x - base));
      z2 = Object.assign({}, s, { seg: "zone2", bg: R.z2bg || s.bg, bgMirror: false, waves: wv, locks: lk, props: [], pickups: [] }, R.z2 || {});
      if (!(R.z2 && R.z2.length)) z2.length = s.auto ? Math.max(1200, (lk[lk.length - 1] || 0) + 900) : Math.max(W + 300, (lk[lk.length - 1] || 0) + W + 320);
    }
    out.splice(i, R.z2sec !== undefined ? R.z2sec - i + 1 : 1, z1, tw, z2);
    if (R.arena) out.push(Object.assign({ seg: "arena" }, R.arena));
    return out;
  }
  function stripDraw(o) { // boss cfg.draw from a bottom-anchored strip sheet: fr { name: [x, y, w, h, anchorX] }, map { state: frame }
    return (api, e, sx, sy) => {
      const im = lvImg(o.img); if (!im) return;
      let f = (o.map && o.map[e.state]) || "idle";
      if (e.state === "walk" && e.walkT) f = Math.floor(e.walkT / 8) % 2 ? "walk1" : "walk2";
      const F = o.fr[f] || o.fr.idle, k = o.k || 0.5, w = F[2] * k, h = F[3] * k, ax = (F[4] || F[2] / 2) * k;
      const flip = (e.facing < 0) !== !!o.faceLeft;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      contactShadow(sx, sy, 0, 22);
      if (e.flash > 0 && e.flash % 4 < 2) ctx.filter = "brightness(2.4)";
      else if ((e.state === "tele" || e.state === "kwind") && e.t % 6 < 3) ctx.filter = "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)";
      const y = Math.round(sy - e.z - h);
      if (flip) { ctx.translate(Math.round(sx), 0); ctx.scale(-1, 1); ctx.drawImage(im, F[0], F[1], F[2], F[3], -ax, y, w, h); }
      else ctx.drawImage(im, F[0], F[1], F[2], F[3], Math.round(sx - ax), y, w, h);
      ctx.restore();
    };
  }
'''
R=[
("  function twSpr(d, name, x, y, k, flip, alpha) {", helpers+"  function twSpr(d, name, x, y, k, flip, alpha) {"),
("      def.sections = (def.sections && def.sections.length ? def.sections : [{}]).map((s) => normSection(s, def));",
 "      if (def.restructure) { const R = def.restructure; def.sections = applyRestructure(def.sections || [], R); def.images = (def.images || []).concat(R.images || []); } // twist v1\n      def.sections = (def.sections && def.sections.length ? def.sections : [{}]).map((s) => normSection(s, def));"),
("    bossEntrance: (e, def) => entrStart(e, def), // entr v1", "    bossEntrance: (e, def) => entrStart(e, def), // entr v1\n    stripDraw: (o) => stripDraw(o), twistSprite: (d, n, x, y, k, f, a) => twSpr(d, n, x, y, k, f, a), // twist v1"),
("        if (d.gate) twSpr(d, T.goal && d.gateOpen ? d.gateOpen : d.gate, sx + 44, FLOOR_TOP + 4, 0.42);", "        if (d.gateSpr) twSpr(d, T.goal && d.gateOpen ? d.gateOpen : d.gateSpr, sx + 44, FLOOR_TOP + 4, 0.42);"),
("      for (const e of STATE.enemies) if (!e.boss) e.hp = Math.min(e.hp, e.hp); // (no carry-over handling needed: sections start empty)\n", ""),
]
for a,b in R:
  c=s.count(a)
  if c!=1: print("COUNT",c,repr(a[:90])); sys.exit(1)
  s=s.replace(a,b)
open(F,'w').write(s); print("ok",len(R))
