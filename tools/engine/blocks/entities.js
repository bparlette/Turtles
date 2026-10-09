  // ---------- DATA-DRIVEN ENTITIES (engine v2) ----------
  // Regular enemies, props/breakables, pickups and projectiles are declared here: stats, hitboxes, sprite/skin refs and behaviour
  // NAMES that map to the reusable behaviour functions below (ENEMY_APPROACH / ENEMY_TRIGGER / ENEMY_ATTACK). A new enemy or prop
  // is one table entry (levels: api.defineEnemy / api.defineProp / api.defineProjectile). Tuning is the pre-v2 engine's, value for
  // value; boss AI stays code (zap / ramrod register their update functions here). Gallery (galRegistry) and the per-level
  // enemySkins / ENEMY_F frame tables are untouched: skins still map type -> role (light / weapon / big) via def.role.
  //   hit boxes are [dx, dy, dz] half-extents in world px (|player.x - x| < dx, |player.y - y| < dy, player.z < dz)
  const ENEMY_DEFS = {
    purple: { hp: 4, foot: true, speed: 0.7, approach: "close", range: 18, trigger: "melee", grab: 0.3, attack: "std",
      strike: { t: 12, kind: "melee", dmg: 1, hit: [26, 8, 14] }, end: 24, sheet: "ninja", role: "light", outfit: "purple" },
    blue: { hp: 3, foot: true, speed: 1.1, approach: "flank", circleBehind: true, trigger: "melee", attack: "std",
      strike: { t: 12, kind: "melee", dmg: 2, hit: [26, 8, 14] }, end: 24, sheet: "ninja", role: "light", outfit: "blue" },
    sword: { hp: 5, foot: true, speed: 0.7, approach: "close", range: 18, trigger: "melee", parry: 0.4, attack: "std",
      lunge: { t0: 8, t1: 16, v: 2.2 }, strike: { t: 14, kind: "melee", dmg: 2, hit: [32, 9, 14], sfx: "swing" }, end: 30, sheet: "ninja", role: "weapon", outfit: "sword" },
    star: { hp: 3, speed: 0.7, approach: "range", range: 110, trigger: "ranged", minRange: 60, attack: "std",
      strike: { t: 12, kind: "shoot", proj: "shuriken", dx: 8, vx: 2.4, sfx: "shuriken" }, end: 24, cool: 90, sheet: "ninja", role: "weapon", pose: "throw", outfit: "star" },
    gunner: { hp: 3, speed: 0.7, vy: 1, approach: "range", range: 100, trigger: "ranged", minRange: 60, attack: "std",
      shot: { t: 14, proj: "ray", dx: 14, vx: 1.1, sfx: "gun" }, end: 24, cool: 120, sheet: "gunner", role: "big", pose: "shoot", outfit: "gunner",
      muzzle: { t0: 13, t1: 18, dx: 14, dy: 22, r: 26, c: "#ff6a3a", a: 0.85 } },
    heavy: { hp: 7, speed: 0.5, approach: "close", range: 18, trigger: "melee", attack: "haymaker", armour: true, noThrow: true, drop: 2.5, hue: 150,
      haymaker: { t: 18, dmg: 2, hit: [32, 9, 14], end: 38 }, sheet: "gunner", scale: 1.18, shudder: 16, bubble: 68, role: "big" },
    dasher: { hp: 4, speed: 1.0, approach: "close", range: 84, trigger: "dash", attack: "dash", hue: 100,
      dash: { crouch: 12, run: 30, end: 44, v: 3.6, hit: [14, 8, 12], dmg: 1 }, sheet: "ninja", role: "light", pose: "dash" },
    zap: { boss: true, noThrow: true, update: (e, p, dxp, dyp) => updateZap(e, p, dxp, dyp) },
    ramrod: { boss: true, noThrow: true, update: (e, p, dxp, dyp) => updateRamrod(e, p, dxp, dyp) },
  };
  const ENEMY_DEFAULT = { hp: 3, speed: 0.7, approach: "close", range: 18, trigger: "melee", attack: "std", strike: { t: 12, kind: "melee", dmg: 1, hit: [26, 8, 14] }, end: 24, sheet: "ninja" };
  const edef = (e) => ENEMY_DEFS[e.type] || ENEMY_DEFAULT;
  // ---- reusable enemy behaviours (walk targeting, attack trigger, attack state) ----
  function circleWait(e, p, near, d, g) { // wait for an attack token: circle at medium range, shuffling in depth
    g.tx = p.x + (d.circleBehind ? -p.facing : near) * (56 + e.ring);
    g.ty = p.y + Math.sin(e.t * 0.035 + e.ring) * 22; g.sp *= 0.75;
  }
  const ENEMY_APPROACH = {
    range(e, p, near, d, tok, g) { g.tx = p.x + near * d.range; },                                   // keep shooting range, token or not
    close(e, p, near, d, tok, g) { if (!tok) circleWait(e, p, near, d, g); else g.tx = p.x + near * d.range; },
    flank(e, p, near, d, tok, g) { // get behind the player
      if (!tok) return circleWait(e, p, near, d, g);
      g.tx = p.x - p.facing * 20; if (Math.abs(e.x - g.tx) > 10) g.ty = p.y + e.side * 22;
    },
  };
  const ENEMY_TRIGGER = {
    ranged(e, p, dxp, dyp, tx, d) { if (Math.abs(dxp) > d.minRange) { e.state = "attack"; e.t = 0; } },
    dash(e, p, dxp, dyp, tx, d) { if (Math.abs(dxp) > 46 && Math.abs(dxp) < 130 && Math.abs(e.x - tx) < 14) { e.state = "attack"; e.t = 0; e.hitP = false; } },
    melee(e, p, dxp, dyp, tx, d) {
      if (!(Math.abs(dxp) < 24 && Math.abs(e.x - tx) < 6)) return;
      if (d.grab && p.z === 0 && !p.hold && !p.carry && p.atk !== "power" && !p.heldAt && Math.random() < d.grab) {
        e.state = "grab"; e.t = 0; p.grabbedBy = e; p.mash = 0; p.drainT = 0; p.attackT = 0; p.atk = null;
      } else { e.state = "attack"; e.t = 0; }
    },
  };
  const inHit = (p, e, h) => Math.abs(p.x - e.x) < h[0] && Math.sign(p.x - e.x) === e.facing && Math.abs(p.y - e.y) < h[1] && p.z < h[2];
  const ENEMY_ATTACK = {
    std(e, p, dxp, dyp, d) { // lunge / shot / strike on fixed frames, then back off and hand the turn on
      const L = d.lunge, S = d.shot, K = d.strike;
      if (L && e.t >= L.t0 && e.t < L.t1) e.x += e.facing * L.v;
      if (S && e.t === S.t) { STATE.stars.push(makeShot(S.proj, e.x + e.facing * S.dx, e.y, e.facing * S.vx)); SFX[S.sfx](); }
      if (K && e.t === K.t) {
        if (K.kind === "shoot") { STATE.stars.push(makeShot(K.proj, e.x + e.facing * K.dx, e.y, e.facing * K.vx)); SFX[K.sfx](); }
        else { if (K.sfx) SFX[K.sfx](); if (inHit(p, e, K.hit)) hurtPlayer(K.dmg); }
      }
      if (e.t >= d.end) {
        e.state = "walk"; e.cool = d.cool !== undefined ? d.cool : 50 + (Math.random() * 40 | 0);
        e.token = false; e.back = 24 + (Math.random() * 16 | 0);
      }
    },
    dash(e, p, dxp, dyp, d) { // crouch, then a low sliding dash across the row
      const D = d.dash;
      if (e.t < D.crouch) e.x -= e.facing * 0.4;
      else if (e.t < D.run) {
        e.x += e.facing * D.v; e.walkT += 2; if (e.t % 4 === 0) dust(e.x - e.facing * 6, e.y);
        if (!e.hitP && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - e.x) < D.hit[0] && Math.abs(dyp) < D.hit[1] && p.z < D.hit[2]) { e.hitP = true; hurtPlayer(D.dmg); }
      }
      if (e.t === D.crouch) SFX.swing();
      if (e.t >= D.end) { e.state = "walk"; e.hitP = false; e.cool = 80 + (Math.random() * 40 | 0); e.token = false; e.back = 20; }
    },
    haymaker(e, p, dxp, dyp, d) { // slow telegraphed haymaker that knocks you down
      const H = d.haymaker;
      if (e.t === H.t) { SFX.swing(); if (Math.abs(dxp) < H.hit[0] && Math.sign(dxp || e.facing) === e.facing && Math.abs(dyp) < H.hit[1] && p.z < H.hit[2]) hurtPlayer(H.dmg, false, e.facing); }
      if (e.t >= H.end) { e.state = "walk"; e.cool = 70 + (Math.random() * 40 | 0); e.token = false; e.back = 24; }
    },
  };
  // ---- projectiles: straight shots (dmg / hit) and lobbed arcs (arcDmg / arcHit); sprite = shared_sprites frame; light = glow ----
  const PROJ_DEFS = {
    shuriken: { dmg: 1, hit: [8, 6, 14], draw: "star", light: { r: 10, c: "#c8d0ff", a: 0.25 } },
    ray: { dmg: 2, hit: [8, 6, 14], flag: "ray", draw: "ray", light: { r: 24, c: "#ff5a3a", a: 0.8 } },
    rock: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "rock" },
    brick: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "brick" },
    snowball: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "snowball", light: { r: 12, c: "#bfe4ff", a: 0.25 } },
    sludge: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "sludge", light: { r: 20, c: "#6ae03a", a: 0.6 } },
    tire: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "tire" },
  };
  const PROJ_DEFAULT = { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14] };
  const projDef = (s) => (s.kind && PROJ_DEFS[s.kind]) || (s.ray ? PROJ_DEFS.ray : s.kind ? PROJ_DEFAULT : PROJ_DEFS.shuriken);
  const shotDmg = (s) => (s.ray ? PROJ_DEFS.ray.dmg : s.kind && s.kind !== "ray" ? projDef(s).dmg : PROJ_DEFS.shuriken.dmg); // straight shots: ray 2, everything else 1 (pre-v2 rule)
  function makeShot(name, x, y, vx) { const o = { x, y, vx }; const d = PROJ_DEFS[name]; if (d && d.flag) o[d.flag] = true; return o; }
  // ---- props / breakables ----
  //   rolls: hit/thrown it rolls and bowls (barrel); bounce: a thrown one lands upright instead of breaking (cone); drop: chance of a slice
  const PROP_DEFS = {
    barrel: { hp: 3, w: 12, h: 18, rolls: true, drop: 0.15, sprite: "barrel", debris: ["#2f5fa8", "#1a3a6a", "#5a8ad8", "#12284a"] },
    crate: { hp: 2, w: 14, h: 14, drop: 0.15, sprite: "crate", debris: ["#a8743a", "#6a4420", "#c8945a", "#8a5a2a"] },
    trash: { hp: 2, w: 12, h: 17, drop: 0.15, sprite: "trash", debris: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"] },
    cone: { hp: 1, w: 9, h: 12, bounce: true, drop: 0, sprite: "cone", debris: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"] },
  };
  // ---- pickups ----
  const PICKUP_DEFS = {
    slice: { heal: 4, shadow: 6, msg: "+HEALTH", col: "#c8ffb0", bark: 0.4, lines: ["MMM, EXTRA CHEESE!", "SLICE OF LIFE!", "HOT AND FRESH!"], sprite: "slice" },
    pizza: { heal: 16, shadow: 10, msg: "FULL HEALTH!", col: "#7fffb0", bark: 1, line: "A WHOLE PIE! YES!", sprite: "pizza" },
  };
  const ENT = { enemies: ENEMY_DEFS, props: PROP_DEFS, pickups: PICKUP_DEFS, projectiles: PROJ_DEFS, approach: ENEMY_APPROACH, trigger: ENEMY_TRIGGER, attack: ENEMY_ATTACK };
  function defineEntity(table, name, def, base) { // level/API hook: register (or extend) an entry; returns the stored def
    if (!name || !def || typeof def !== "object") return null;
    const T = ENT[table]; if (!T) return null;
    return (T[name] = Object.assign({}, base ? T[base] || {} : T[name] || {}, def));
  }
