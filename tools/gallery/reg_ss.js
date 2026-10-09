  // GALLERY REGISTRY (Shell Shock Live) - one line per painted character; galRegistry() is read lazily on first use.
  //   grp: HERO | BOSS | MINI-BOSS | ENEMY | ALLY     lv: scene number (0 = every scene)
  //   sheet: { atlas: "x" } (engine <img id="atlas-x"> + ATLAS.x) | { img: <img element>, fr: FRAMES } |
  //          { src: "levels/levelN_x.png", js: "levels/levelN.js", fr: "CONST_NAME" [, sub: "key"] }  (fr omitted = first
  //          `NAME = { idle: [...] ... }` literal after the src string in that script)
  //   sp: [sheet...] extra painted poses at the same scale (specials); skip: /regex/ pose names to leave out; face: -1 = sheet faces left
  // Hue-tinted placeholders (ninja/gunner re-hues) are deliberately NOT listed. New painted enemy -> add one line.
  function galRegistry() {
    const L = (n, file, fr, x) => Object.assign({ src: "levels/level" + n + "_" + file + ".png", js: "levels/level" + n + ".js", fr }, x || {});
    return [
      ...BROTHERS.map((b) => { const k = b.name.toLowerCase(); return { name: b.name, grp: "HERO", lv: 0, atlas: k, sp: SP_IM[k] && SPF[k] ? [{ img: SP_IM[k], fr: SPF[k] }] : [] }; }),
      { name: "RAMROD", grp: "BOSS", lv: 1, atlas: "ramrod" },
      { name: "ZAP", grp: "BOSS", lv: 1, atlas: "zap" },
      { name: "SCORCHER", grp: "MINI-BOSS", lv: 1, img: SCORCHER_IM, fr: SCORCHER_FR },
      { name: "RAZORBACK", grp: "MINI-BOSS", lv: 1, atlas: "razor" },
      { name: "BRICKJAW", grp: "BOSS", lv: 2, ...L(2, "brickjaw", "BJF") },
      { name: "GULCH GATOR", grp: "BOSS", lv: 3, ...L(3, "gator", "GTF") },
      { name: "JETWASH", grp: "BOSS", lv: 4, ...L(4, "jetwash", "JWF") },
      { name: "GRIMWALE", grp: "BOSS", lv: 5, ...L(5, "grimwale", "GWF") },
      { name: "COLD FRONT", grp: "BOSS", lv: 6, ...L(6, "coldfront", "CFF") },
      { name: "RUSTMAUL", grp: "BOSS", lv: 7, ...L(7, "rustmaul", "RMF") },
      { name: "RAZORBACK", grp: "BOSS", lv: 8, ...L(8, "razorback", "RZF") },
      { name: "KARAI", grp: "BOSS", lv: 9, ...L(9, "karai", "KF") },
      { name: "ARMAGGON", grp: "BOSS", lv: 10, ...L(10, "armaggon", "F") },
      { name: "LEATHERHEAD", grp: "BOSS", lv: 11, ...L(11, "gator", "GF") },
      { name: "VIRAL", grp: "BOSS", lv: 12, ...L(12, "viral", "VF") },
      { name: "GENERAL TRAAG", grp: "BOSS", lv: 13, ...L(13, "traag", "FR", { sub: "traag" }) },
      { name: "LT. GRANITOR", grp: "BOSS", lv: 13, ...L(13, "granitor", "FR", { sub: "granitor" }) },
      { name: "KRANG", grp: "BOSS", lv: 14, ...L(14, "krang", "KRF") },
      { name: "SHREDDER", grp: "BOSS", lv: 15, ...L(15, "shredder", "SHF") },
      { name: "SUPER SHREDDER", grp: "BOSS", lv: 15, ...L(15, "super", "SUF") },
      { name: "FOOT NINJA", grp: "ENEMY", lv: 0, atlas: "ninja" },
      { name: "FOOT GUNNER", grp: "ENEMY", lv: 0, atlas: "gunner" },
      { name: "FOOT ELITE", grp: "ENEMY", lv: 15, ...L(15, "elite", "ELF") },
      { name: "AMBER", grp: "ALLY", lv: 1, atlas: "amber" },
    ];
  }
