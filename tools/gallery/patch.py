# Gallery v1: targeted in-place edits (re-reads the live file; idempotent via marker). usage: python3 patch.py <index.html> <reg.js>
import sys, re
path, regp = sys.argv[1], sys.argv[2]
s = open(path, encoding="utf-8").read()
if "(gallery v1)" in s: print("already patched", path); sys.exit(0)
core = open("/workspace/work/gallery/core.js").read(); reg = open(regp).read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count: raise SystemExit("anchor count %d != %d: %r" % (n, count, old[:80]))
    s = s.replace(old, new)
i = s.index("  // ---------- Select ----------")
s = s[:i] + core + reg + "\n" + s[i:]
rep("    if (MENU) return updateMenu(); // lvlsel", "    if (GAL) return galUpdate(); // gallery\n    if (MENU) return updateMenu(); // lvlsel")
rep("  function drawTitle() {\n    drawNight();", "  function drawTitle() {\n    if (GAL) { galDraw(); return; } // gallery\n    drawNight();")
rep("    const showHS = titleScoresFirst ?", "    galParade(); // gallery: title attract parade (top corners)\n    const showHS = titleScoresFirst ?")
rep('    it.push({ id: "pick", label: PROG_WORD + " SELECT", sub: p.done.length + " / " + PROG_N + " CLEAR" });\n    return it;',
    '    it.push({ id: "pick", label: PROG_WORD + " SELECT", sub: p.done.length + " / " + PROG_N + " CLEAR" });\n    it.push({ id: "gal", label: "GALLERY", sub: "EVERY HERO, BOSS AND ENEMY" }); // gallery\n    return it;')
rep('      else openGrid(nx > 0 && progBuilt(nx) ? nx : 1, "");', '      else if (c.id === "gal") galOpen(); // gallery\n      else openGrid(nx > 0 && progBuilt(nx) ? nx : 1, "");')
rep("MENU_Y0 = 104, MENU_RH = 30;", "MENU_Y0 = 100, MENU_RH = 26; // gallery: 26 (was 30) so a 4th entry fits above the hint")
open(path, "w", encoding="utf-8").write(s); print("patched", path)
