#!/usr/bin/env node
// lint-random.mjs - Math.random / NRAND determinism lint for the Shell Shock engine (plain Node, no deps).
//
// The rule, from the engine's own docs (index.html, "ENGINE v2" block + the NRAND line):
//   "Every Math.random() made inside a step comes from RNG (one mulberry32 stream); audio and drawing keep the native one (NRAND)."
//   simStep() swaps Math.random = RNG.next for the duration of one fixed 60 Hz step, so gameplay code (scene update(), level
//   hooks, AI, spawns, twists, VFX stepped inside the step) is SUPPOSED to call plain Math.random(): it is seeded there and
//   replays bit-for-bit. Determinism breaks only where that swap does NOT cover the call, or where native randomness leaks
//   into the step:
//     R1 outside-step  Math.random() inside a callback the browser runs later (setTimeout / setInterval /
//                      requestAnimationFrame / addEventListener / on* handler / .then / queueMicrotask). That code never runs
//                      inside simStep, so it gets the native RNG - a real violation if it touches game state.
//     R2 load-time     Math.random() at the top level of a script (outside every function): runs once when the script loads,
//                      outside any step.
//     R3 native-in-sim NRAND() in gameplay (non-render, non-audio) code: the native RNG inside a step diverges on replay.
//     R4 cached-ref    a bare Math.random reference that is not called (`const r = Math.random`): a reference captured
//                      outside a step bypasses the swap.
//   Allowed without annotation (reported as info):
//     - Math.random() / NRAND() inside render/VFX/audio-only functions (draw*, render*, paint*, sfx/tone/osc/noise ..., see
//       RENDER_RE), and any Math.random() in ordinary functions (gameplay code - seeded by the swap).
//   Allowlist: a `// rand-ok` comment (optionally with a reason) on the same line or the line directly above silences a hit.
//
// Usage: node tools/lint-random.mjs [siteDir]   (default: cwd). Scans <siteDir>/index.html (inline <script> blocks) and
//        <siteDir>/levels/*.js. Exit code 1 if any violation; --json prints machine-readable findings; --all lists info hits.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const root = path.resolve(args.find((a) => !a.startsWith("--")) || ".");

const DEFER_CALLEES = /^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|addEventListener|then|catch|finally|queueMicrotask|onload|onerror|onmessage)$/;
// render/VFX/audio-only function names: a prefix match, or Audio/Sfx/Sound/Draw/Render anywhere in the name
const RENDER_RE = /^(draw|render|paint|blit|zig|stroke|sprite|hud|glow|flicker|sfx|tone|osc|noise|music|audio|beep|sound|snd|voice|speak)|(Audio|Sfx|SFX|Sound|Draw|Render)/;
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "with", "return", "typeof", "else", "do", "try", "finally", "new", "in", "of", "case", "void", "delete", "instanceof", "await", "yield"]);

function scan(code, file, lineBase) {
  const out = [];
  const lines = code.split("\n");
  const randOk = (ln) => /\/\/.*\brand-ok\b/.test(lines[ln] || "") || /^\s*\/\/.*\brand-ok\b/.test(lines[ln - 1] || "");
  // frames: { t: "brace"|"paren"|"tmpl", fn: name|null, isFn, deferred, callee }
  const stack = [];
  let i = 0, line = 0, lastSig = "", lastWord = "", stmtStart = 0;
  const n = code.length;
  const prevCode = (k) => code.slice(Math.max(stmtStart, k - 400), k);
  const fnHeader = (pre) => {
    // returns { isFn, name } for a `{` whose preceding text is pre
    let m;
    if ((m = pre.match(/function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*$/))) return { isFn: true, name: m[1] || null };
    if ((m = pre.match(/(?:([A-Za-z_$][\w$]*)\s*[:=]\s*)?(?:async\s*)?(?:\([^()]*(?:\([^()]*\)[^()]*)*\)|[A-Za-z_$][\w$]*)\s*=>\s*$/))) return { isFn: true, name: m[1] || null };
    if ((m = pre.match(/(?:^|[,{;\s}])(?:get\s+|set\s+|async\s+|static\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*$/)) && !KEYWORDS.has(m[1])) return { isFn: true, name: m[1] };
    return { isFn: false, name: null };
  };
  const ctx = () => {
    let names = [], deferred = false, inFn = false;
    for (let k = stack.length - 1; k >= 0; k--) {
      const f = stack[k];
      if (f.deferred) deferred = true;
      if (f.isFn) { inFn = true; if (f.fn) names.push(f.fn); else if (!f.iife) names.push("(anon)"); }
      if (f.iife) break; // an IIFE body counts as module top level
    }
    return { names, deferred, inFn: stack.some((f) => f.isFn && !f.iife) };
  };
  const exprArrowName = (k) => { // `name = (a, b) => expr` / `name: () => expr` without braces, on the current statement
    const pre = prevCode(k);
    const m = pre.match(/([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>[^;{}]*$/);
    return m ? m[1] : null;
  };
  const regexAllowed = () => !lastSig || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || /^(return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(lastWord);
  while (i < n) {
    const c = code[i], c2 = code[i + 1];
    const top = stack[stack.length - 1];
    if (top && top.t === "tmpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { stack.pop(); i++; continue; }
      if (c === "$" && c2 === "{") { stack.push({ t: "brace", isFn: false, tmplExpr: true }); i += 2; lastSig = "{"; continue; }
      if (c === "\n") line++;
      i++; continue;
    }
    if (c === "\n") { line++; if (process.env.LDBG && line + lineBase >= +process.env.LDBG && line + lineBase < +process.env.LDBG + 40) console.error(line + lineBase + 1, stack.map((f) => f.t[0] + (f.isFn ? "F" : "")).join("")); i++; continue; }
    if (c === "/" && c2 === "/") { while (i < n && code[i] !== "\n") i++; continue; }
    if (c === "/" && c2 === "*") { const e = code.indexOf("*/", i + 2); const seg = code.slice(i, e < 0 ? n : e + 2); line += (seg.match(/\n/g) || []).length; i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < n && code[i] !== c) { if (code[i] === "\\") i++; else if (code[i] === "\n") line++; i++; } i++; lastSig = "s"; lastWord = ""; continue; }
    if (c === "`") { stack.push({ t: "tmpl" }); i++; lastSig = "s"; continue; }
    if (c === "/" && regexAllowed()) { // regex literal
      i++; let cls = false;
      while (i < n && (cls || code[i] !== "/")) { if (code[i] === "\\") i++; else if (code[i] === "[") cls = true; else if (code[i] === "]") cls = false; else if (code[i] === "\n") break; i++; }
      i++; while (/[a-z]/i.test(code[i] || "")) i++; lastSig = "r"; lastWord = ""; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && /[\w$]/.test(code[j])) j++;
      const w = code.slice(i, j);
      const isMember = code[i - 1] === ".";
      if (w === "Math" && code.slice(j, j + 7) === ".random") {
        const after = code.slice(j + 7).match(/^\s*(\(|=(?!=))?/);
        const called = after && after[1] === "(";
        const assignedTo = after && after[1] === "=";
        const cx = ctx(), ln = line;
        const fnName = cx.names[0] || exprArrowName(i);
        let kind, rule = null;
        if (!called) { kind = assignedTo ? "swap" : "ref"; rule = "R4 cached-ref"; }
        else if (cx.deferred) rule = "R1 outside-step";
        else if (!cx.inFn && !exprArrowName(i)) rule = "R2 load-time";
        else kind = fnName && RENDER_RE.test(fnName) ? "render" : "gameplay";
        if (rule && fnName && RENDER_RE.test(fnName) && rule !== "R4 cached-ref") { rule = null; kind = "render"; }
        out.push({ file, line: ln + 1 + lineBase, fn: [fnName, ...cx.names.slice(1)].filter(Boolean).join(" < ") || "(top)", what: "Math.random" + (called ? "()" : ""), rule, kind: kind || "violation", ok: rule ? randOk(ln) : true, annotated: randOk(ln), src: lines[ln].trim().slice(0, 140) });
        i = j + 7; lastSig = "w"; lastWord = "random"; continue;
      }
      if (w === "NRAND" && !isMember && /^\s*\(/.test(code.slice(j))) {
        const cx = ctx(), ln = line, fnName = cx.names[0] || exprArrowName(i);
        const render = fnName && RENDER_RE.test(fnName);
        const rule = render ? null : "R3 native-in-sim";
        out.push({ file, line: ln + 1 + lineBase, fn: [fnName, ...cx.names.slice(1)].filter(Boolean).join(" < ") || "(top)", what: "NRAND()", rule, kind: render ? "render" : "violation", ok: rule ? randOk(ln) : true, annotated: randOk(ln), src: lines[ln].trim().slice(0, 140) });
      }
      // `el.onclick = function () {` / `onkeydown = (e) => {` handlers are deferred too
      lastWord = w; lastSig = "w"; i = j; continue;
    }
    if (c === "(") {
      const pre = code.slice(Math.max(0, i - 60), i);
      const m = pre.match(/([A-Za-z_$][\w$]*)\s*$/);
      const callee = m ? m[1] : null;
      // IIFE: `(() => {` / `(function () {` at statement start
      stack.push({ t: "paren", callee, start: i });
      lastSig = "("; lastWord = ""; i++; continue;
    }
    if (c === ")") { if (top && top.t === "paren") stack.pop(); lastSig = ")"; lastWord = ""; i++; continue; }
    if (c === "{") {
      const pre = prevCode(i);
      const h = fnHeader(pre);
      const frame = { t: "brace", isFn: h.isFn, fn: h.name };
      if (h.isFn) {
        // deferred if this function is an argument of a deferring callee, or assigned to an on* handler
        const parens = stack.filter((f) => f.t === "paren");
        const p = parens[parens.length - 1];
        const innermostBrace = [...stack].reverse().find((f) => f.t === "brace");
        const pIdx = p ? stack.lastIndexOf(p) : -1, bIdx = innermostBrace ? stack.lastIndexOf(innermostBrace) : -1;
        if (p && pIdx > bIdx && p.callee && DEFER_CALLEES.test(p.callee)) frame.deferred = true;
        if (/\.on[a-z]+\s*=\s*(?:function\b[^{]*|\([^)]*\)\s*=>\s*|[A-Za-z_$][\w$]*\s*=>\s*)$/.test(pre)) frame.deferred = true;
        // IIFE (module wrapper): anonymous fn directly inside a paren that has no callee, at depth 0/1
        if (!h.name && p && pIdx > bIdx && !p.callee && !stack.some((f) => f.t === "brace" && f.isFn && !f.iife)) frame.iife = true;
        if (h.name && /^on[a-z]+$/.test(h.name)) frame.deferred = true;
        if (!h.name && !frame.iife && p && pIdx > bIdx && p.callee) frame.fn = p.callee;
      }
      stack.push(frame); stmtStart = i + 1; lastSig = "{"; lastWord = ""; i++; continue;
    }
    if (c === "}") {
      if (top && top.t === "brace") { stack.pop(); if (top.tmplExpr) { i++; continue; } }
      stmtStart = i + 1; lastSig = "}"; lastWord = ""; i++; continue;
    }
    if (c === ";") { stmtStart = i + 1; lastSig = ";"; lastWord = ""; i++; continue; }
    if (!/\s/.test(c)) { lastSig = c; lastWord = ""; }
    i++;
  }
  if (stack.length) console.error(`lint-random: warning: ${file}: tokenizer ended with ${stack.length} open frame(s); results for this file may be incomplete`);
  return out;
}

const findings = [];
const idx = path.join(root, "index.html");
if (fs.existsSync(idx)) {
  const html = fs.readFileSync(idx, "utf8");
  const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) {
    const startLine = html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length - 1;
    findings.push(...scan(m[1], "index.html", startLine));
  }
}
const ldir = path.join(root, "levels");
if (fs.existsSync(ldir)) for (const f of fs.readdirSync(ldir).filter((f) => f.endsWith(".js")).sort((a, b) => a.localeCompare(b, "en", { numeric: true })))
  findings.push(...scan(fs.readFileSync(path.join(ldir, f), "utf8"), "levels/" + f, 0));

const bad = findings.filter((f) => !f.ok);
const annotated = findings.filter((f) => f.rule && f.ok);
if (flags.has("--json")) { console.log(JSON.stringify({ root, findings }, null, 1)); process.exit(bad.length ? 1 : 0); }
const count = (k) => findings.filter((f) => f.kind === k).length;
console.log(`lint-random: ${root}`);
console.log(`  ${findings.length} RNG call sites: ${count("gameplay")} gameplay (seeded by simStep swap), ${count("render")} render/audio scope, ${annotated.length} allowlisted (// rand-ok), ${bad.length} violation(s)`);
if (flags.has("--all")) for (const f of findings) console.log(`  [${f.rule ? (f.ok ? "ok " + f.rule : f.rule) : f.kind}] ${f.file}:${f.line} ${f.what} in ${f.fn}: ${f.src}`);
else for (const f of annotated) console.log(`  allow  ${f.file}:${f.line} ${f.rule} in ${f.fn}: ${f.src}`);
for (const f of bad) console.log(`  FAIL   ${f.file}:${f.line} ${f.rule} ${f.what} in ${f.fn}: ${f.src}`);
process.exit(bad.length ? 1 : 0);
