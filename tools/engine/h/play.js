// Headless auto-play: node play.js [search] [maxFrames]
// Auto-attacking player plays through; logs milestones; exits 1 on exception.
const fs = require("fs");
const SEARCH = process.argv[2] || "";
const MAXF = +(process.argv[3] || 60000);
let src = fs.readFileSync(process.env.GAME, "utf8");
src = src.replace("const STATE = {", "const STATE = globalThis.__S = {");
const stubCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === "measureText") return (s) => ({ width: String(s).length * 5 });
    if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return () => ({ addColorStop() {} });
    if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
    return function () { return undefined; };
  },
  set(t, k, v) { t[k] = v; return true; },
});
function mkEl(id) {
  const isImg = /^(atlas-|img-)/.test(id);
  const el = {
    id, style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, appendChild() {}, contains() { return false; },
    getContext: () => stubCtx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1152, height: 672, right: 1152, bottom: 672 }),
    width: 1152, height: 672, clientWidth: 1152, clientHeight: 672, offsetWidth: 1152, offsetHeight: 672, setPointerCapture() {},
  };
  if (isImg || id === "c-img") Object.assign(el, { complete: true, naturalWidth: 400, naturalHeight: 300 });
  el.remove = () => { el.removed = true; };
  return el;
}
const els = {}, handlers = {}, loadedScripts = [], missingScripts = [];
const SITE = process.env.SITE;
global.window = global;
global.location = { search: SEARCH };
global.innerWidth = 1280; global.innerHeight = 800;
global.navigator = { getGamepads: () => [], vibrate() {}, userAgent: "node" };
global.document = {
  getElementById: (id) => (els[id] = els[id] || mkEl(id)),
  createElement: (t) => mkEl("c-" + t), documentElement: { clientWidth: 1280, clientHeight: 800, classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, dataset: {} },
  addEventListener() {}, body: mkEl("body"), head: { appendChild(el) { // emulate <script src> injection
    const path = SITE + "/" + String(el.src).split("?")[0];
    if (el.src && fs.existsSync(path)) { try { require("vm").runInThisContext(fs.readFileSync(path, "utf8"), { filename: path }); loadedScripts.push(el.src); el.onload && el.onload(); } catch (e) { console.log("LEVEL SCRIPT ERROR", e.stack); el.onerror && el.onerror(); } }
    else { missingScripts.push(el.src); el.onerror && el.onerror(); }
  } }, querySelector: () => mkEl("q"), querySelectorAll: () => [],
};
global.getComputedStyle = () => ({ paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px" });
global.addEventListener = (t, f) => { (handlers[t] = handlers[t] || []).push(f); };
let raf = null;
global.requestAnimationFrame = (f) => { raf = f; };
global.setTimeout = () => 0;
let now = 0;
global.performance = { now: () => now };
const key = (t, k) => (handlers[t] || []).forEach((f) => f({ key: k, preventDefault() {} }));
const tap = (k) => { key("keydown", k); key("keyup", k); };
const held = new Set();
const hold = (k, on) => { if (on && !held.has(k)) { key("keydown", k); held.add(k); } if (!on && held.has(k)) { key("keyup", k); held.delete(k); } };

eval(src);
if (globalThis.__SSENG) __SSENG.seed(+process.env.SEED || 1);
const S = globalThis.__S, seen = new Set();
let f = 0;
const mark = (m) => { if (!seen.has(m)) { seen.add(m); console.log(`f${f}: ${m}`); } };
let stuck = 0, lastProg = "", levelsDone = [];
try {
  for (f = 0; f < MAXF; f++) {
    now += 16.7;
    const p = S.player;
    if (S.scene === "title" && f % 20 === 5) tap("enter");
    if (S.scene === "select" && f % 20 === 15) tap("enter");
    if (S.scene === "stage" && p) {
      mark("stage lvl=" + (S.level || 1) + " section=" + S.section + (S.sec !== undefined && S.section === "L" ? S.sec : ""));
      if (S.outro) mark("outro lvl=" + S.level);
      if (p.sinkT > 0) mark("fell in a hole lvl=" + S.level);
      if (process.env.DEATHS && p.deadT === 0 && p.z === 0 && f % 500 === 0 && (S.deaths||0) < 7 && !S.results && !S.pizza && !S.cut) { p.hp = 0; p.deadT = 1; }
      else if (p.deadT === 0) p.hp = Math.max(p.hp, 8); // keep alive
      if (S.tagT === 119) console.log("f" + f + " TAG-IN " + p.bro.name + " deaths=" + S.deaths + " bodies=" + S.bodies.length);
      if (S.results) { mark("results lvl=" + (S.level || 1)); if (S.results.t > 60 && f % 10 === 0) tap("j"); }
      else if (S.pizza) { mark("pizza lvl=" + (S.level || 1)); }
      else if (S.cut) mark("cutscene");
      else {
        let foes = S.enemies.filter((e) => !["dying", "fly", "intro"].includes(e.state) && e.entered);
        let tx = null, ty = p.y;
        if (foes.length) {
          foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
          const e = foes[0]; tx = e.x + (e.x > p.x ? -18 : 18); ty = e.y;
          if (e.boss || e.type === "ramrod") mark("boss fight lvl=" + (S.level || 1) + " " + (e.name || e.type));
        } else if (S.enemies.length && S.locked) { tx = S.camX + 192; ty = 185; } else tx = p.x + 60;
        // hazard avoidance is NOT done: the bot eats hazards, which tests them
        hold("arrowright", tx > p.x + 3); hold("arrowleft", tx < p.x - 3);
        hold("arrowdown", ty > p.y + 2); hold("arrowup", ty < p.y - 2);
        if (foes.length && Math.abs(foes[0].x - p.x) < 30 && f % 7 === 0) {
          if (Math.sign(foes[0].x - p.x) !== p.facing) { hold("arrowright", foes[0].x > p.x); hold("arrowleft", foes[0].x < p.x); }
          tap("j");
        }
        if (f % 97 === 0) tap("k"); // occasional jump (auto-scroll obstacles)
        for (const e of S.enemies) { if (e.taunt > 0) mark("taunt seen: " + e.say); if (e.dodgeY !== undefined) mark("dodge seen"); }
        if (S.pBark) mark("bark: " + S.pBark.s);
      }
      // force progress if a lock lasts too long
      const prog = [S.level, S.section, S.wave, S.phase, S.enemies.length, S.queue.length, Math.round(S.camX / 50)].join(",");
      if (prog === lastProg) stuck++; else { stuck = 0; lastProg = prog; }
      if (stuck > 2400 && !S.results && !S.pizza && !S.cut) {
        console.log("FORCE progress at f" + f + " prog=" + prog + " px=" + p.x.toFixed(0));
        for (const e of S.enemies) { e.hp = 0; e.state = "dying"; e.t = 0; } p.grabbedBy = null;
        stuck = 0;
      }
    }
    if (S.scene === "loading") mark("loading scene");
    if (S.scene === "title" && f > 300) { mark("back to title"); }
    raf();
    if (S.level && !levelsDone.includes(S.level) && S.results) levelsDone.push(S.level);
    if (process.env.STOPAT && seen.has(process.env.STOPAT)) break;
  }
  if (window.__SS) console.log("after: LEVELS loaded=" + window.__SS.LEVELS.map((d, i) => d ? i + 1 : "-").join(",") + " LVLOAD=" + Object.keys(window.__SS.LVLOAD).join(","));
  console.log("scripts loaded=" + loadedScripts.join(",") + " missing=" + missingScripts.join(",") + " SS=" + (typeof window.SS));
  console.log("HASH " + (globalThis.__SSENG ? __SSENG.hash() : "-") + " t=" + S.t + " score=" + S.score);
  console.log("END f=" + f + " scene=" + S.scene + " level=" + S.level + " kills=" + S.kills + " levelsWithResults=" + levelsDone.join(","));
} catch (err) { console.log("EXCEPTION at f" + f, err.stack); process.exit(1); }
