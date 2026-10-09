  // ---------- ASSET PACKS + LOADING (engine v2) ----------
  // assets.json (written at deploy by ss_engine/build_assets.py) lists every image each level needs (+ byte sizes) and the core set;
  // the boot card preloads + decodes the core (all of level 1 included) before the title, and every plugin level's full manifest
  // (section backgrounds, def.images, enemySkins sheets, and any levels/... image its script names) is loaded AND decoded behind the
  // cabinet-styled bar before its title card, so nothing pops in mid-level. Without assets.json (file://, test harness) the list is
  // derived from the level def. sw.js caches everything after first play (offline + instant repeat visits), versioned per deploy.
  const ASSET = { man: null, warm: {}, size: (src) => (ASSET.man && ASSET.man.sizes && ASSET.man.sizes[src]) || 60000 };
  try { if (location.protocol !== "file:" && window.fetch) fetch("assets.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((m) => { if (m && m.levels) ASSET.man = m; }).catch(() => {}); } catch (_) {}
  function assetReady(im) { // loaded (or failed) and decoded
    if (!im) return true;
    if (im.__eng === 2) return true;
    if (!im.complete) return false;
    if (!im.naturalWidth) { im.__eng = 2; return true; } // broken / missing: never wait on it
    if (!im.__eng) { im.__eng = 1; if (im.decode) im.decode().then(() => (im.__eng = 2), () => (im.__eng = 2)); else im.__eng = 2; }
    return im.__eng === 2;
  }
  // ---- boot: core images (engine atlases, shared sprites, portraits, title/map art, level 1 backgrounds + painted enemies) ----
  const BOOT = { t: 0, list: null };
  if (!/[?&]noboot\b/.test(location.search)) { STATE.scene = "boot"; STATE.booting = true; }
  function bootList() {
    if (BOOT.list) return BOOT.list;
    const L = [];
    for (const im of document.querySelectorAll ? document.querySelectorAll("img[id^='atlas-'], img[id^='img-']") : []) L.push(im);
    for (const im of ART_ALL) if (!L.includes(im)) L.push(im);
    try { for (const t in L1_ENEMY_SKINS) { skinImg(L1_ENEMY_SKINS[t].img); const im = skinIm[L1_ENEMY_SKINS[t].img]; if (im && !L.includes(im)) L.push(im); } } catch (_) {}
    return (BOOT.list = L);
  }
  const srcOf = (im) => { const s = im.getAttribute ? im.getAttribute("src") || im.src : im.src; return String(s || "").replace(String(location.href || "").replace(/[^/]*$/, "") || "\u0000", ""); };
  function progOf(list) { let a = 0, b = 0; for (const im of list) { const w = ASSET.size(srcOf(im)); b += w; if (assetReady(im)) a += w; } return { k: b ? a / b : 1, done: a >= b }; }
  function updateBoot() {
    BOOT.t++; tapPoint = null; pressed.clear();
    const r = progOf(bootList()); BOOT.k = r.k;
    if ((r.done && BOOT.t > 12) || BOOT.t > 900) { STATE.booting = false; STATE.scene = "title"; titleT = 0; }
  }
  function drawBoot() { drawCabinetLoader("SHELL SHOCK", "LIVE ACTION", BOOT.k || 0, "INSERTING COIN"); }
  // ---- per-level manifest ----
  function levelAssetList(n, def) {
    const out = new Set(lvImages(def));
    if (def.enemySkins) for (const t in def.enemySkins) { const s = def.enemySkins[t]; if (s && s.img) out.add(s.img); }
    const m = ASSET.man && ASSET.man.levels && ASSET.man.levels[n]; if (m) for (const s of m) out.add(s);
    return [...out];
  }
  function levelAssetImg(def, src) { // the element that will actually be drawn (def._img for api.img, skinIm for enemySkins), else a warm-cache copy
    if (def._img && def._img[src]) return def._img[src];
    if (def.enemySkins) for (const t in def.enemySkins) if (def.enemySkins[t] && def.enemySkins[t].img === src) { skinImg(src); return skinIm[src]; }
    return ASSET.warm[src] || (ASSET.warm[src] = mkArt(src));
  }
  function levelProgress(n, def) {
    const list = levelAssetList(n, def); let a = 0, b = 0;
    for (const src of list) { const w = ASSET.size(src); b += w; if (assetReady(levelAssetImg(def, src))) a += w; }
    return { k: b ? a / b : 1, done: a >= b, n: list.length };
  }
  function dropWarm() { for (const k in ASSET.warm) { try { ASSET.warm[k].src = ""; } catch (_) {} delete ASSET.warm[k]; } }
  // ---- cabinet-styled loading card ----
  function drawCabinetLoader(top, sub, k, note) {
    k = Math.max(0, Math.min(1, k || 0));
    rect(0, 0, W, H, "#05040a");
    for (let y = 0; y < H; y += 3) rect(0, y, W, 1, "rgba(255,255,255,0.025)"); // scanlines
    const t = STATE.t, cx = W / 2;
    rect(cx - 150, 54, 300, 3, "#e8302a"); rect(cx - 150, 58, 300, 1, "#ffe060");
    ptext(top, cx, 74, 3, "#ffe060"); if (sub) ptext(sub, cx, 100, 2, "#fff");
    const bx = cx - 128, by = 132, bw = 256, bh = 18, SEG = 32, sw = (bw - 8) / SEG;
    rect(bx - 3, by - 3, bw + 6, bh + 6, "#c8ccd6"); rect(bx - 2, by - 2, bw + 4, bh + 4, "#3a3a4a"); rect(bx, by, bw, bh, "#000");
    const lit = Math.floor(k * SEG + 1e-6);
    for (let i = 0; i < SEG; i++) {
      const on = i < lit, c = i < SEG * 0.5 ? "#3fae3a" : i < SEG * 0.8 ? "#ffe060" : "#ff8c1a";
      rect(bx + 4 + i * sw, by + 4, Math.max(1, sw - 2), bh - 8, on ? c : "#1a1a26");
      if (on) rect(bx + 4 + i * sw, by + 4, Math.max(1, sw - 2), 2, "rgba(255,255,255,0.35)");
    }
    if (lit < SEG && Math.floor(t / 8) % 2) rect(bx + 4 + lit * sw, by + 4, Math.max(1, sw - 2), bh - 8, "#7fd85a");
    ptext(String(Math.round(k * 100)).padStart(3, "0") + "%", cx, by + bh + 14, 2, "#fff");
    ptext((note || "LOADING") + ".".repeat(1 + (Math.floor(t / 12) % 3)), cx, 192, 1, "#c8ccd6");
    if (Math.floor(t / 30) % 2) ptext("1P START", cx, 208, 1, "#e8302a");
  }
  // ---- service worker (https / localhost only; ?nosw unregisters) ----
  try {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
      if (/[?&]nosw\b/.test(location.search)) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      else addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
    }
  } catch (_) {}
