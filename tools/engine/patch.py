#!/usr/bin/env python3
"""ENGINE UPGRADES patcher for SHELL SHOCK LIVE (index.html). Targeted, idempotent str-replacements.
Each edit re-reads the file right before it is applied (other workers edit the same file) and writes immediately.
usage: patch.py <index.html> [group ...]    groups: loop ent assets fx (default all)
"""
import sys, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
B = lambda n: open(os.path.join(HERE, "blocks", n)).read()

def E(name, old, new, group):
    return dict(name=name, old=old, new=new, group=group)

EDITS = []
# ---------------- group "loop": fixed timestep, seeded RNG, record/replay, render split ----------------
EDITS += [
 E("nrand", "  // ---------- Audio ----------\n", "  const NRAND = Math.random; // engine v2: native RNG for audio + drawing (gameplay steps use the seeded RNG)\n  // ---------- Audio ----------\n", "loop"),
 E("aud1", "nd[i] = Math.random() * 2 - 1;", "nd[i] = NRAND() * 2 - 1;", "loop"),
 E("aud2", "s.start(t, Math.random() * 0.5);", "s.start(t, NRAND() * 0.5);", "loop"),
 E("aud3", "x.frequency.setValueAtTime(300 + Math.random() * 1600, t + i * 0.01);", "x.frequency.setValueAtTime(300 + NRAND() * 1600, t + i * 0.01);", "loop"),
 E("aud4", "const f = base * (0.85 + Math.random() * 0.45);", "const f = base * (0.85 + NRAND() * 0.45);", "loop"),
 E("engblock", "  // ---------- Loop ----------\n", "@@ENGINE@@  // ---------- Loop ----------\n", "loop"),
 E("frame",
   """  function frame() {
    requestAnimationFrame(frame);
    try {
      STATE.t++;
      pollGamepad();
      SCENES[STATE.scene].update();
    } catch (err) { frameErr("update", err); }
    try { capArrays(); } catch (_) {}
    try { document.documentElement.classList.toggle("on-title", STATE.scene === "title"); } catch (_) {}
    pressed.clear(); BTN_A.hit = BTN_B.hit = BTN_P.hit = false;
    try {
      ctx.setTransform(RES, 0, 0, RES, 0, 0);""",
   """  function render() { // engine v2: drawing only; the simulation runs in simStep() (fixed 60 Hz, see ENGINE v2)
    try { document.documentElement.classList.toggle("on-title", STATE.scene === "title"); } catch (_) {}
    try {
      ctx.setTransform(RES, 0, 0, RES, 0, 0);""", "loop"),
 E("frame2",
   """      SCENES[STATE.scene].draw();
      drawSpeaker();
    } catch (err) {""",
   """      SCENES[STATE.scene].draw();
      drawSpeaker(); recDraw();
    } catch (err) {""", "loop"),
 E("frame3",
   """      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    }
    try { audioFrame(); updateCabFx(); } catch (err) { frameErr("audio/ui", err); }
  }""",
   """      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    }
  }
  function frame() { // FREEZE FIX kept: the next frame is scheduled first; steps and draws each run inside try/catch
    requestAnimationFrame(frame);
    try { engFrame(); } catch (err) { frameErr("engine", err); }
    try { audioFrame(); updateCabFx(); } catch (err) { frameErr("audio/ui", err); }
  }""", "loop"),
 E("stagehook", """    if (STATE.section === "A") for (const o of L1_PROPS) spawnProp(o);
    STATE.scene = "card";
  }""", """    if (STATE.section === "A") for (const o of L1_PROPS) spawnProp(o);
    STATE.scene = "card";
    engStageStart(i, STATE.level, keep); // engine v2: replay sync point (deterministic resets + seed)
  }""", "loop"),
 E("ds_vfx", """    vfxObserve(p); vfxStep();
    ctx.save();
    if (VFX.shT > 0) { // 1px normal hits, 3px decaying on finishers, 4px boss and cannonball impacts
      const a = VFX.decay ? Math.ceil(VFX.shA * VFX.shT / VFX.shN) : VFX.shA; VFX.shT--;
      ctx.translate((Math.random() < 0.5 ? -a : a), Math.round(rnd(-a, a)));
    }
""", """    // engine v2: vfxObserve/vfxStep and the shake timer advance in simStep(); the decaying camera offset comes from shakeStep()
    ctx.save();
    if (ENG.shakeOn && (VFX.shOx || VFX.shOy)) ctx.translate(VFX.shOx, VFX.shOy); // Screen shake toggle: localStorage ssla_shake / ?shake=off
""", "loop"),
 E("ds_zoom", "if (STATE.zoom > 0) { STATE.zoom--; ctx.translate(W / 2, H / 2);", "if (STATE.zoomT > 0) { ctx.translate(W / 2, H / 2);", "loop"),
 E("hud_tag", "if (STATE.tagT > 0) { STATE.tagT--; if (", "if (STATE.tagT > 0) { if (", "loop"),
 E("lights", "    ctx.restore();\n    // HUD\n", "    drawLights(cx); // engine v2 dynamic light (additive low-res buffer)\n    ctx.restore();\n    // HUD\n", "loop"),
 E("flame", "    // warm additive glow on the nearby wall and floor\n    ctx.save();", "    // warm additive glow on the nearby wall and floor\n    light(x, cy, 44 * s, \"#ff7a1a\", 0.55); // engine v2 dynamic light\n    ctx.save();", "loop"),
]


# ---------------- group "ent": data-driven entities ----------------
EDITS += [
 E("entblock", "  // ---------- Stage ----------\n", "@@ENT@@  // ---------- Stage ----------\n", "ent"),
 E("e_hp", """    const hp = Math.max(1, Math.round((({ purple: 4, sword: 5, gunner: 3, heavy: 7, dasher: 4 }[type] || 3) + (Math.random() < 0.5 ? 1 : 0)) * diff().hp));""",
   """    const hp = Math.max(1, Math.round((((ENEMY_DEFS[type] || ENEMY_DEFAULT).hp || 3) + (Math.random() < 0.5 ? 1 : 0)) * diff().hp)); // engine v2: ENEMY_DEFS""", "ent"),
 E("e_hue", """hue: hue !== undefined ? hue : type === "dasher" ? 100 : type === "heavy" ? 150 : undefined,""",
   """hue: hue !== undefined ? hue : (ENEMY_DEFS[type] || ENEMY_DEFAULT).hue,""", "ent"),
 E("e_armour", """    if (e.type === "heavy" && !knock && !air && e.hp > 0 && e.state === "attack") return; // armoured mid-swing vs light hits""",
   """    if (edef(e).armour && !knock && !air && e.hp > 0 && e.state === "attack") return; // armoured mid-swing vs light hits (ENEMY_DEFS.armour)""", "ent"),
 E("e_drop", """!e.noDrop && Math.random() < diff().drop * (e.type === "heavy" ? 2.5 : 1)) spawnItem""",
   """!e.noDrop && Math.random() < diff().drop * (edef(e).drop || 1)) spawnItem""", "ent"),
 E("e_parry", """      if (e.type === "sword" && !power && (e.state === "walk" || e.state === "attack") && Math.sign(p.x - e.x) === e.facing && Math.random() < 0.4) {""",
   """      if (edef(e).parry && !power && (e.state === "walk" || e.state === "attack") && Math.sign(p.x - e.x) === e.facing && Math.random() < edef(e).parry) {""", "ent"),
 E("e_tokens", """    const pool = STATE.enemies.filter((e) => e.type !== "zap" && e.type !== "ramrod");""",
   """    const pool = STATE.enemies.filter((e) => !edef(e).boss);""", "ent"),
 E("e_disp", """    if (e.type === "zap") updateZap(e, p, dxp, dyp);
    else if (e.type === "ramrod") updateRamrod(e, p, dxp, dyp);""",
   """    const D = edef(e); // engine v2: behaviour comes from ENEMY_DEFS (bosses register their update function there)
    if (D.update) D.update(e, p, dxp, dyp);""", "ent"),
 E("e_foot", """      const foot = e.type === "purple" || e.type === "blue" || e.type === "sword";""", """      const foot = !!D.foot;""", "ent"),
 E("e_appr", """      let tx, ty = p.y, sp = e.type === "blue" ? 1.1 : e.type === "heavy" ? 0.5 : e.type === "dasher" ? 1.0 : 0.7;
      if (e.type === "star") tx = p.x + near * 110;
      else if (e.type === "gunner") tx = p.x + near * 100;
      else if (!tok) { // wait their turn: circle at medium range, shuffling in depth (blue waits behind the player)
        tx = p.x + (e.type === "blue" ? -p.facing : near) * (56 + e.ring);
        ty = p.y + Math.sin(e.t * 0.035 + e.ring) * 22; sp *= 0.75;
      } else if (e.type === "blue") { tx = p.x - p.facing * 20; if (Math.abs(e.x - tx) > 10) ty = p.y + e.side * 22; }
      else if (e.type === "dasher") tx = p.x + near * 84;
      else tx = p.x + near * 18;
""", """      const g = { tx: 0, ty: p.y, sp: D.speed }; ENEMY_APPROACH[D.approach](e, p, near, D, tok, g); // engine v2: walk-target behaviour
      let tx = g.tx, ty = g.ty, sp = g.sp;
""", "ent"),
 E("e_vy", """      const vy = e.type === "gunner" ? 1 : e.dodgeY""", """      const vy = D.vy ? D.vy : e.dodgeY""", "ent"),
 E("e_trig", """        if (e.type === "star" || e.type === "gunner") { if (Math.abs(dxp) > 60) { e.state = "attack"; e.t = 0; } }
        else if (e.type === "dasher") { if (Math.abs(dxp) > 46 && Math.abs(dxp) < 130 && Math.abs(e.x - tx) < 14) { e.state = "attack"; e.t = 0; e.hitP = false; } }
        else if (Math.abs(dxp) < 24 && Math.abs(e.x - tx) < 6) {
          if (e.type === "purple" && p.z === 0 && !p.hold && !p.carry && p.atk !== "power" && !p.heldAt && Math.random() < 0.3) {
            e.state = "grab"; e.t = 0; p.grabbedBy = e; p.mash = 0; p.drainT = 0; p.attackT = 0; p.atk = null;
          } else { e.state = "attack"; e.t = 0; }
        }
""", """        ENEMY_TRIGGER[D.trigger](e, p, dxp, dyp, tx, D); // engine v2: attack-trigger behaviour
""", "ent"),
 E("e_atk", '    } else if (e.state === "attack" && e.type === "dasher") { // crouch, then a low sliding dash across the row\n      if (e.t < 12) e.x -= e.facing * 0.4;\n      else if (e.t < 30) {\n        e.x += e.facing * 3.6; e.walkT += 2; if (e.t % 4 === 0) dust(e.x - e.facing * 6, e.y);\n        if (!e.hitP && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - e.x) < 14 && Math.abs(dyp) < 8 && p.z < 12) { e.hitP = true; hurtPlayer(1); }\n      }\n      if (e.t === 12) SFX.swing();\n      if (e.t >= 44) { e.state = "walk"; e.hitP = false; e.cool = 80 + (Math.random() * 40 | 0); e.token = false; e.back = 20; }\n    } else if (e.state === "attack" && e.type === "heavy") { // slow telegraphed haymaker that knocks you down\n      if (e.t === 18) { SFX.swing(); if (Math.abs(dxp) < 32 && Math.sign(dxp || e.facing) === e.facing && Math.abs(dyp) < 9 && p.z < 14) hurtPlayer(2, false, e.facing); }\n      if (e.t >= 38) { e.state = "walk"; e.cool = 70 + (Math.random() * 40 | 0); e.token = false; e.back = 24; }\n    } else if (e.state === "attack") {\n      if (e.type === "sword" && e.t >= 8 && e.t < 16) e.x += e.facing * 2.2;\n      if (e.type === "gunner" && e.t === 14) { STATE.stars.push({ x: e.x + e.facing * 14, y: e.y, vx: e.facing * 1.1, ray: true }); SFX.gun(); }\n      if (e.t === (e.type === "sword" ? 14 : 12)) {\n        if (e.type === "star") { STATE.stars.push({ x: e.x + e.facing * 8, y: e.y, vx: e.facing * 2.4 }); SFX.shuriken(); }\n        else if (e.type === "sword") { SFX.swing(); if (Math.abs(p.x - e.x) < 32 && Math.sign(p.x - e.x) === e.facing && Math.abs(dyp) < 9 && p.z < 14) hurtPlayer(2); }\n        else if (e.type !== "gunner" && Math.abs(dxp) < 26 && Math.sign(dxp) === e.facing && Math.abs(dyp) < 8 && p.z < 14) hurtPlayer(e.type === "blue" ? 2 : 1);\n      }\n      if (e.t >= (e.type === "sword" ? 30 : 24)) {\n        e.state = "walk"; e.cool = e.type === "star" ? 90 : e.type === "gunner" ? 120 : 50 + (Math.random() * 40 | 0);\n        e.token = false; e.back = 24 + (Math.random() * 16 | 0); // back off, hand the turn on\n      }\n', '    } else if (e.state === "attack") { // engine v2: attack-state behaviour from ENEMY_DEFS (std / dash / haymaker)\n      ENEMY_ATTACK[D.attack](e, p, dxp, dyp, D);\n', "ent"),
 E("e_bowl", """        if (o === e || o.type === "zap" || o.type === "ramrod" || o.inv > 0""", """        if (o === e || edef(o).boss || o.inv > 0""", "ent"),
 E("e_throw", """const canThrow = (e) => !e.boss && e.type !== "ramrod" && e.type !== "zap" && e.type !== "heavy" && !e.noThrow && e.hp > 0;""",
   """const canThrow = (e) => !e.boss && !edef(e).noThrow && !e.noThrow && e.hp > 0; // ENEMY_DEFS.noThrow: bosses, heavies""", "ent"),
 # projectiles
 E("p_arc", """        const near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < 10 && Math.abs(s.y - p.y) < 8 && Math.abs(s.z - p.z) < 14;
        if (near) { hurtPlayer(s.dmg || 2);""", """        const ah = projDef(s).arcHit || PROJ_DEFAULT.arcHit, near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < ah[0] && Math.abs(s.y - p.y) < ah[1] && Math.abs(s.z - p.z) < ah[2];
        if (near) { hurtPlayer(s.dmg || projDef(s).arcDmg || 2);""", "ent"),
 E("p_str", """      if (p.deadT === 0 && Math.abs(s.x - p.x) < 8 && Math.abs(s.y - p.y) < 6 && p.z < 14 && p.inv === 0) { hurtPlayer(s.ray ? 2 : 1); return false; }""",
   """      const sh = projDef(s).hit; if (p.deadT === 0 && Math.abs(s.x - p.x) < sh[0] && Math.abs(s.y - p.y) < sh[1] && p.z < sh[2] && p.inv === 0) { hurtPlayer(shotDmg(s)); return false; } // PROJ_DEFS""", "ent"),
 # props
 E("pr_def", """  const PROP_DEF = { barrel: { hp: 3, w: 12, h: 18 }, crate: { hp: 2, w: 14, h: 14 }, trash: { hp: 2, w: 12, h: 17 }, cone: { hp: 1, w: 9, h: 12 } };""",
   """  const PROP_DEF = PROP_DEFS; // engine v2: see DATA-DRIVEN ENTITIES""", "ent"),
 E("pr_cols", """    const COLS = { barrel: ["#2f5fa8", "#1a3a6a", "#5a8ad8", "#12284a"], crate: ["#a8743a", "#6a4420", "#c8945a", "#8a5a2a"], trash: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"], cone: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"] }[pr.kind];""",
   """    const PD = PROP_DEF[pr.kind], COLS = PD.debris;""", "ent"),
 E("pr_drop", """    const drop = pr.drop || (pr.kind !== "cone" && Math.random() < 0.15 ? "slice" : null);""",
   """    const drop = pr.drop || (PD.drop > 0 && Math.random() < PD.drop ? "slice" : null);""", "ent"),
 E("pr_roll", """    if (pr.kind === "barrel") { pr.state = "roll"; pr.vx = dir * (strong ? 3.6 : 2.7);""", """    if (PROP_DEF[pr.kind].rolls) { pr.state = "roll"; pr.vx = dir * (strong ? 3.6 : 2.7);""", "ent"),
 E("pr_th1", """          if (hitAny && pr.kind !== "barrel") { breakProp(pr, sgn(pr.vx)); continue; }""", """          if (hitAny && !PROP_DEF[pr.kind].rolls) { breakProp(pr, sgn(pr.vx)); continue; }""", "ent"),
 E("pr_th2", """          if (pr.kind === "barrel" && Math.abs(pr.vx) > 0.5) { pr.state = "roll"; pr.vx *= 0.75; pr.rollT = 0; }
          else if (pr.harmless || pr.kind === "cone") { pr.state = "idle"; pr.vx = 0; }""", """          if (PROP_DEF[pr.kind].rolls && Math.abs(pr.vx) > 0.5) { pr.state = "roll"; pr.vx *= 0.75; pr.rollT = 0; }
          else if (pr.harmless || PROP_DEF[pr.kind].bounce) { pr.state = "idle"; pr.vx = 0; }""", "ent"),
 E("pr_lock", """if (pr.kind === "barrel" && pr.state === "roll") breakProp(pr, sgn(pr.vx));""", """if (PROP_DEF[pr.kind].rolls && pr.state === "roll") breakProp(pr, sgn(pr.vx));""", "ent"),
 # pickups
 E("it_kind", """    const it = { kind: o.kind === "pizza" ? "pizza" : "slice",""", """    const it = { kind: PICKUP_DEFS[o.kind] ? o.kind : "slice",""", "ent"),
 E("it_heal", """        const full = p.hp >= 16, heal = it.kind === "pizza" ? 16 : 4;""", """        const ID = PICKUP_DEFS[it.kind] || PICKUP_DEFS.slice, full = p.hp >= 16, heal = ID.heal;""", "ent"),
 E("it_msg", """        const msg = full ? "+500" : it.kind === "pizza" ? "FULL HEALTH!" : "+HEALTH";""", """        const msg = full ? "+500" : ID.msg;""", "ent"),
 E("it_col", """ptext(msg, sx, f.y - k * 14, 1, it.kind === "pizza" ? "#7fffb0" : "#c8ffb0");""", """ptext(msg, sx, f.y - k * 14, 1, ID.col);""", "ent"),
 E("it_bark", """        if (it.kind === "pizza" || Math.random() < 0.4) playerBark(true, it.kind === "pizza" ? "A WHOLE PIE! YES!" : ["MMM, EXTRA CHEESE!", "SLICE OF LIFE!", "HOT AND FRESH!"][Math.random() * 3 | 0]);""",
   """        if (ID.bark >= 1 || Math.random() < ID.bark) playerBark(true, ID.line || ID.lines[Math.random() * ID.lines.length | 0]);""", "ent"),
 E("it_shadow", """    shadow(sx, it.y, it.z + 4, (it.kind === "pizza" ? 10 : 6) * ITEM_K);""", """    shadow(sx, it.y, it.z + 4, (PICKUP_DEFS[it.kind] || PICKUP_DEFS.slice).shadow * ITEM_K);""", "ent"),
 # skins / drawing read the defs
 E("sk_role", """SKIN_ROLE = { purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" };""",
   """SKIN_ROLE = {}; for (const t in ENEMY_DEFS) if (ENEMY_DEFS[t].role) SKIN_ROLE[t] = ENEMY_DEFS[t].role; // engine v2: ENEMY_DEFS.role""", "ent"),
 E("sk_pose", """    if (s === "attack") return e.type === "star" ? pick("throw", "attack") : e.type === "gunner" ? pick("shoot", "attack") : e.type === "dasher" ? pick("dash", "attack") : pick("attack");""",
   """    if (s === "attack") { const ps = edef(e).pose; return ps ? pick(ps, "attack") : pick("attack"); } // ENEMY_DEFS.pose""", "ent"),
 E("sk_k", """    const k = (s.sk.k || SKIN_K) * (s.sk.scale || 1) * (e.type === "heavy" ? 1.18 : 1), ax = fr[4] === undefined ? fr[2] / 2 : fr[4];
    const jx = e.type === "heavy" && e.state === "attack" && e.t < 16 ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder""",
   """    const ED = edef(e), k = (s.sk.k || SKIN_K) * (s.sk.scale || 1) * (ED.scale || 1), ax = fr[4] === undefined ? fr[2] / 2 : fr[4];
    const jx = ED.shudder && e.state === "attack" && e.t < ED.shudder ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder""", "ent"),
 E("na_sheet", """    if (e.type === "gunner" || e.type === "heavy") {
      const g = e.hue !== undefined""", """    const ED = edef(e);
    if (ED.sheet === "gunner") {
      const g = e.hue !== undefined""", "ent"),
 E("na_k", """      const jx = e.type === "heavy" && e.state === "attack" && e.t < 16 ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
      return drawFrame(g, ATLAS.gunner[ninjaFrame(e)], sx + jx, sy, NINJA_K * (e.type === "heavy" ? 1.18 : 1), e.facing);""",
   """      const jx = ED.shudder && e.state === "attack" && e.t < ED.shudder ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
      return drawFrame(g, ATLAS.gunner[ninjaFrame(e)], sx + jx, sy, NINJA_K * (ED.scale || 1), e.facing);""", "ent"),
 # level API
 E("api_def", """    playerDrawOffset(dx, dy) {""", """    defineEnemy: (n, d, base) => defineEntity("enemies", n, d, base), defineProp: (n, d, base) => defineEntity("props", n, d, base), // engine v2
    definePickup: (n, d, base) => defineEntity("pickups", n, d, base), defineProjectile: (n, d, base) => defineEntity("projectiles", n, d, base), ENT,
    light: (x, y, r, c, a) => light(x, y, r, c, a), // engine v2 dynamic light: screen-space glow for this frame (call from a draw hook)
    playerDrawOffset(dx, dy) {""", "ent"),
]


# ---------------- group "fx": hit-stop + shake tuning (gameplay timing change: needs fresh recordings) ----------------
EDITS += [
 E("hs_hit", """    e.hp -= dmg; e.flash = 5; buzz(8); STATE.stop = Math.max(STATE.stop, heavy ? 5 : 2); heavy ? SFX.finisher() : SFX.hit();""",
   """    const hp0 = e.hp; e.hp -= dmg; e.flash = 5; buzz(8); heavy ? SFX.finisher() : SFX.hit();
    { const bossHit = !!(e.boss || edef(e).boss), ko = hp0 > 0 && e.hp <= 0; // engine v2 hit-stop: 40-80 ms on heavy hits, specials, boss hits, KOs
      if (heavy || bossHit || ko) hitStop((heavy ? 0.35 : 0) + (p.atk === "power" ? 0.2 : 0) + (bossHit ? 0.25 : 0) + (ko ? 0.4 : 0) + Math.min(0.2, Math.max(0, dmg - 1) * 0.1));
      else STATE.stop = Math.max(STATE.stop, 2); } // light jab: 2 frames, as before""", "fx"),
 E("hs_boss", """STATE.stop = Math.max(STATE.stop, 8); shake(5, 30, true); SFX.boom();""", """hitStop(1); shake(5, 30, true); SFX.boom(); // engine v2: 80 ms cap (was 133 ms)""", "fx"),
 E("hs_combo", """      if (combo && STATE.stop <= 5) STATE.stop = k === "c3" ? 3 : 2; // 2-3 frames of hit-stop on weapon contact""",
   """      if (combo && STATE.stop < 2) STATE.stop = 2; // engine v2: weapon contact >= 2 frames; heavier stops come from hitStop() in hitEnemy""", "fx"),
 E("hs_toss", """SFX.finisher(); STATE.stop = Math.max(STATE.stop, 4); STATE.zoom = 1;""", """SFX.finisher(); hitStop(0.6); STATE.zoom = 1;""", "fx"),
 E("sh_hit", """    if (boss || ball) shake(4, 10, true);
    else if (finisher) shake(3, 10, true);
    else shake(1, 4, false);""", """    const ko = e.hp <= 0; // engine v2 camera shake, scaled by hit strength; light jabs stay at 1 px
    if (boss || ball) shake(ko ? 5 : 4, ko ? 22 : 12, true);
    else if (finisher) shake(ko || power ? 3.5 : 3, 12, true);
    else shake(1, 4, true);""", "fx"),
]


# ---------------- group "assets": manifests, boot + level preloading, cabinet loading bar, service worker ----------------
EDITS += [
 E("as_block", "  // ---------- Loop ----------\n", "@@ASSETS@@  // ---------- Loop ----------\n", "assets"),
 E("as_mkart", """  const mkArt = (src) => { const im = document.createElement("img"); im.src = src; return im; };""",
   """  const ART_ALL = []; const mkArt = (src) => { const im = document.createElement("img"); im.src = src; ART_ALL.push(im); return im; }; // engine v2: boot preload list""", "assets"),
 E("as_scene", """    loading: { update: updateLoading, draw: drawLoading },""", """    boot: { update: updateBoot, draw: drawBoot }, // engine v2: core asset preload before the title
    loading: { update: updateLoading, draw: drawLoading },""", "assets"),
 E("as_load", '      const def = LEVELS[L.n - 1];\n      const all = def ? lvImages(def).every((src) => { const im = def._img[src]; return !im || im.complete; }) : true;\n      if ((all && L.t > 20) || L.t > 480) { LOADING = null; startStage(L.broI, L.n, L.keep); }', '      const def = LEVELS[L.n - 1];\n      const pr = def ? levelProgress(L.n, def) : { k: 1, done: true }; L.k = pr.k; // engine v2: whole level manifest, loaded + decoded (no mid-level pop-in)\n      if ((pr.done && L.t > 20) || L.t > 900) { LOADING = null; startStage(L.broI, L.n, L.keep); }', "assets"),
 E("as_draw", '    ptext("SCENE " + L.n, W / 2, 84, 3, "#ffe060");\n    if (L.phase === "err") { ptext("COMING SOON!", W / 2, 116, 2, "#ff8c1a"); return; }\n    if (def) ptext(def.name, W / 2, 112, 2, "#fff");\n    const dots = ".".repeat(1 + (Math.floor(STATE.t / 12) % 3));\n    ptext("LOADING" + dots, W / 2 - 2, 150, 1, "#c8ccd6");\n    const k = L.phase === "img" && def ? lvImages(def).filter((s) => def._img[s] && def._img[s].complete).length / Math.max(1, lvImages(def).length) : 0.15;\n    rect(W / 2 - 60, 162, 120, 5, "#2a2a40"); rect(W / 2 - 60, 162, Math.round(120 * k), 5, "#7fd85a");', '    if (L.phase === "err") { ptext("SCENE " + L.n, W / 2, 84, 3, "#ffe060"); ptext("COMING SOON!", W / 2, 116, 2, "#ff8c1a"); return; }\n    drawCabinetLoader("SCENE " + L.n, def ? def.name : "", L.phase === "img" ? L.k || 0 : 0.03, "LOADING"); // engine v2 cabinet loader', "assets"),
 E("as_unload", """    def._img = null; def._bgCache = null;""", """    def._img = null; def._bgCache = null; dropWarm(); // engine v2""", "assets"),
]

def apply(path, groups):
    blocks = {"@@ENGINE@@": "engine.js", "@@ENT@@": "entities.js", "@@ASSETS@@": "assets.js"}
    done = skipped = 0; fails = []
    for e in EDITS:
        if groups and e["group"] not in groups: continue
        new = e["new"]
        for k, f in blocks.items():
            if k in new: new = new.replace(k, B(f))
        s = open(path).read()  # fresh read right before each edit
        sig = e.get("sig") or next((l for l in new.split("\n") if l.strip() and l not in e["old"]), new)
        if sig in s and (s.count(e["old"]) == 0 or e["old"] in new): skipped += 1; continue
        c = s.count(e["old"])
        if c != 1: fails.append("%s: anchor found %d times" % (e["name"], c)); continue
        open(path, "w").write(s.replace(e["old"], new, 1))
        done += 1
    return done, skipped, fails

if __name__ == "__main__":
    path = sys.argv[1]; groups = sys.argv[2:]
    d, sk, f = apply(path, groups)
    print("applied %d, already %d, FAIL %d" % (d, sk, len(f)))
    for x in f: print("  FAIL", x)
    sys.exit(1 if f else 0)
