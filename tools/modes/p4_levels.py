import re,sys,json
D='/workspace/work/deploy/shell-shock-live-action/levels/'
M8=json.load(open('/workspace/work/restructure/L8-15/out/meta.json'))
M1=json.load(open('/workspace/work/restructure/L1-7/meta.json'))['props']
def fr(sheet): 
  f = M1[sheet]['frames'] if sheet in M1 else M8[sheet]
  return json.dumps(f).replace('"','')  # keys unquoted is fine JS
def frq(sheet):
  f = M1[sheet]['frames'] if sheet in M1 else M8[sheet]
  return json.dumps(f)
B={}
B[2]='''    restructure: { // phase 2: street (zone 1) -> searchlight stealth on the roofs (twist) -> rooftops (zone 2) -> helipad arena
      split: 0, images: ["levels/level2_twist.png", "levels/level2_rooftops.jpg", "levels/level2_rooftop_boss.jpg"],
      tsec: { bg: "levels/level2_rooftops.jpg", weather: "rain", hazards: [] },
      twist: { kind: "searchlight", title: "FOOT CHOPPER OVERHEAD!", sub: "HIDE BEHIND THE ROOF HATCHES - DON'T GET LIT UP", len: 2100, img: "levels/level2_twist.png", fr: %s,
        heli: true, lights: [{ y: 44, spd: 0.011 }], covers: [{ spr: "hatch", x: 96, w: 40, d: 22, k: 0.42 }, { spr: "hatch", x: 286, w: 40, d: 22, k: 0.42 }],
        alarm: ["gunner", "purple"], volley: true, drip: ["purple"], gap: 330, cap: 2, color: "#ffe27a" },
      z2bg: "levels/level2_rooftops.jpg", z2: { hazards: [], weather: "rain" },
      arena: { bg: "levels/level2_rooftop_boss.jpg", floor: [168, 218], length: 384, locks: [], waves: [], weather: "rain", hazards: [], grade: "rgba(20,10,60,0.10)" },
    },
''' % frq('level2_twist.png')
B[3]='''    restructure: { // phase 2: tunnels (zone 1) -> flood chase (twist) -> pump station (zone 2) -> existing boss chamber
      split: 0, images: ["levels/level3_twist.png", "levels/level3_pumpstation.jpg"],
      tsec: { length: 1500, hazards: [] },
      twist: { kind: "chase", goal: "reach", title: "THE SLUICE GATE BURST!", sub: "OUTRUN THE FLOOD - GET TO THE LADDER", img: "levels/level3_twist.png", fr: %s,
        speed: 1.25, start: "frame", end: "ladder", crest: "wave", color: "#2f7a3a",
        floaters: [{ spr: "raft", x: 420, y: 200 }, { spr: "drum", x: 760, y: 176 }, { spr: "raft", x: 1100, y: 190 }],
        drip: ["dasher", "purple"], gap: 210, cap: 2, from: "right" },
      z2bg: "levels/level3_pumpstation.jpg", z2waves: [["sword", "dasher", "gunner", "purple"], ["heavy", "dasher", "star", "sword", "purple"]],
    },
''' % frq('level3_twist.png')
B[4]='''    restructure: { // phase 2: highway (zone 1) -> water-cannon truck (twist) -> tunnel (zone 2) -> tunnel-exit arena
      split: 0, z2sec: 1, images: ["levels/level4_twist.png", "levels/level4_tunnel.jpg", "levels/level4_tunnel_boss.jpg"],
      tsec: { auto: 2.4, hazards: [road], weather: "speed" },
      twist: { kind: "turret", title: "MAN THE WATER CANNON!", sub: "UP / DOWN TO AIM - ATTACK TO FIRE", img: "levels/level4_twist.png", fr: %s,
        goal: "kills", need: 10, every: 70, air: true, tspeed: 1.6, base: "truck", baseK: 0.42, baseDy: 14, gun: "turret", gunK: 0.36, spray: "spray", hudText: "DRONES", color: "#7fdcff" },
      z2bg: "levels/level4_tunnel.jpg", z2: { grade: "rgba(40,30,10,0.18)" },
      arena: { bg: "levels/level4_tunnel_boss.jpg", floor: [160, 216], length: 260, auto: 2.0, locks: [], waves: [], weather: "speed", hazards: [road], trafficGap: 9999, debrisGap: 9999, sky: "#c8505a", ground: "#3a3438" },
    },
''' % frq('level4_twist.png')
B[5]='''    restructure: { // phase 2: docks (zone 1) -> harbour patrol-boat chase (twist) -> cargo ship deck (zone 2) -> existing superstructure arena
      split: 0, images: ["levels/level5_twist.png", "levels/level5_harbour.jpg", "levels/level5_shipdeck.jpg"],
      tsec: { bg: "levels/level5_harbour.jpg", auto: 3, floor: [170, 214], hazards: [] },
      twist: { kind: "ride", title: "HARBOUR CHASE!", sub: "FOOT JET-SKIS INCOMING - HOLD THE DECK", len: 2400, img: "levels/level5_twist.png", fr: %s,
        deck: "deck", deckK: 0.54, ski: "jetski", wake: "wake", bow: "bow", buoy: "buoy", drip: ["dasher", "purple", "dasher", "star"], gap: 170, cap: 3, color: "#7fdcff" },
      z2bg: "levels/level5_shipdeck.jpg", z2waves: [["dasher", "heavy", "gunner", "purple"], ["sword", "heavy", "dasher", "star", "blue"]], z2: { hazards: [craneHooks, dockCrates] },
    },
''' % frq('level5_twist.png')
B[6]='''    restructure: { // phase 2: brownstones (zone 1) -> thin-ice pond (twist) -> snowy park (zone 2) -> existing rink arena
      split: 0, images: ["levels/level6_twist.png", "levels/level6_park.jpg"],
      tsec: { bg: "levels/level6_park.jpg", length: 1100, hazards: [], weather: "snow" },
      twist: { kind: "ice", goal: "reach", title: "THIN ICE!", sub: "DON'T STAND STILL - THE POND CRACKS", img: "levels/level6_twist.png", fr: %s,
        slide: "slide", post: "sawhorse", drip: ["purple", "star"], gap: 220, cap: 2, color: "#bfe8ff" },
      z2bg: "levels/level6_park.jpg", z2waves: [["heavy", "sword", "star", "dasher"], ["heavy", "gunner", "dasher", "purple", "blue"]], z2: { hazards: [snowballs, icicles, ice] },
    },
''' % frq('level6_twist.png')
B[7]='''    restructure: { // phase 2: junkyard (zone 1) -> falling freight elevator (twist) -> foundry (zone 2) -> existing crusher arena
      split: 0, images: ["levels/level7_twist.png", "levels/level7_shaft.jpg", "levels/level7_foundry.jpg"],
      tsec: { bg: "levels/level7_shaft.jpg", floor: [176, 206], hazards: [], weather: null },
      twist: { kind: "elevator", title: "GOING DOWN!", sub: "THE FREIGHT LIFT DROPS INTO THE SMELTER", len: 2400, img: "levels/level7_twist.png", fr: %s,
        shaft: "levels/level7_shaft.jpg", lift: "lift", liftY: 244, brake: "brake", junk: ["cube", "hook"], drip: ["purple", "star", "dasher", "heavy"], from: "drop", gap: 150, cap: 3, color: "#ffb04a" },
      z2bg: "levels/level7_foundry.jpg", z2waves: [["sword", "gunner", "purple", "blue"], ["heavy", "dasher", "star", "sword", "purple"]], z2: { hazards: [grinder, rollers, magnet] },
    },
''' % frq('level7_twist.png')
B[8]='''    restructure: { // phase 2: fortress corridor (zone 1) -> lockdown searchlights (twist) -> reactor hangar (zone 2) -> existing throne room
      split: 0, images: ["levels/level8_sentry.png", "levels/level8_reactor.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "searchlight", title: "LOCKDOWN SWEEP!", sub: "STAY OUT OF THE LIGHTS - HIDE BEHIND COVER", len: 2100, img: "levels/level8_sentry.png", fr: %s,
        lights: [{ y: 30, spd: 0.012 }, { y: 30, spd: 0.017 }], covers: [{ spr: "cover", x: 92, w: 52, d: 16, k: 0.36 }, { spr: "cover", x: 300, w: 52, d: 16, k: 0.36 }],
        alarm: ["purple", "gunner"], drip: ["purple"], gap: 320, cap: 2, color: "#ff7af0" },
      z2bg: "levels/level8_reactor.jpg", z2: { hazards: [vents, doors, panels] },
    },
''' % frq('level8_sentry.png')
B[9]='''    restructure: { // phase 2: village (zone 1) -> the ronin at the gate (mini-boss twist) -> bamboo road (zone 2) -> existing courtyard
      split: 0, images: ["levels/level9_ronin.png", "levels/level9_bamboo.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "miniboss", goal: "boss", title: "THE RONIN AT THE GATE", sub: "BREAK HIS GUARD WITH JUMP ATTACKS AND THROWS", summon: ["star", "star"], color: "#ff9ae8",
        boss: { name: "ONI RONIN", base: "ramrod", hp: 24, speed: 1.1, chargeSpeed: 1.7, cool: 76, pitch: 70, height: 88, moves: ["kick", "charge"],
          lines: { intro: "NONE SHALL PASS THIS GATE.", hit: ["WEAK!", "YOUR STANCE IS SLOPPY."], summon: "SHADOWS, TO ME!", ko: "THE GATE... IS YOURS..." },
          draw: A.stripDraw ? A.stripDraw({ img: "levels/level9_ronin.png", k: 0.5, fr: %s,
            map: { kwind: "wind", kick: "slash", tele: "guard", charge: "lunge", hurt: "hurt", stagger: "hurt", down: "down", dying: "down", fire: "wind" } }) : undefined } },
      z2bg: "levels/level9_bamboo.jpg", z2: { hazards: [arrival, smoke, spikes, volley] },
    },
''' % frq('level9_ronin.png')
B[10]='''    restructure: { // phase 2: main deck (zone 1) -> TIMBER! mast collapse (twist) -> gun deck (zone 2) -> existing quarterdeck
      split: 0, images: ["levels/level10_collapse.png", "levels/level10_gundeck.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "collapse", title: "BROADSIDE! THE MAST IS GOING!", sub: "THE DECK IS SPLITTING - KEEP OFF THE HOLES", len: 2100, img: "levels/level10_collapse.png", fr: %s,
        mast: true, mastMsg: "TIMBER!", fallSpr: ["plank1", "plank2", "plank3"], fallK: 0.5, drip: ["purple", "sword", "star"], gap: 170, cap: 3, color: "#ffb04a", clearMsg: "THE DECK GIVES WAY!" },
      z2bg: "levels/level10_gundeck.jpg", z2: { drawBack: rollView("levels/level10_gundeck.jpg") },
    },
''' % frq('level10_collapse.png')
B[11]='''    restructure: { // phase 2: boxcar roofs (zone 1) -> handcar pursuit (twist) -> saloon car (zone 2) -> existing flatcar arena
      split: 0, images: ["levels/level11_handcar.png", "levels/level11_saloon.jpg", "levels/level11_desert.jpg"],
      tsec: { bg: "levels/level11_desert.jpg", auto: 3, hazards: [] },
      twist: { kind: "ride", goal: "car", title: "HANDCAR PURSUIT!", sub: "HIT THE OUTLAW CAR'S SHIELD 3 TIMES - TWICE", img: "levels/level11_handcar.png", fr: %s,
        car: "outlawCar", cartA: "handcarA", cartB: "handcarB", track: "track", drip: ["purple", "star", "dasher"], color: "#ffb04a" },
      z2bg: "levels/level11_saloon.jpg", z2: { hazards: [hats], weather: null },
    },
''' % frq('level11_handcar.png')
B[12]='''    restructure: { // phase 2: skyway (zone 1) -> defend the hacker bot (twist) -> maglev station (zone 2) -> existing data hub
      split: 0, images: ["levels/level12_ally.png", "levels/level12_station.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "defend", goal: "kind", title: "HACK THE GATE!", sub: "KEEP THEM OFF THE BOT WHILE IT WORKS", img: "levels/level12_ally.png", fr: %s,
        gateSpr: "gateLock", gateOpen: "gateOpen", hack: "botHack", hurt: "botHurt", cheer: "botCheer", botX: 250, work: 2400, botHp: 10,
        drip: ["gunner", "dasher", "purple", "dasher"], gap: 140, cap: 4, color: "#5ae0ff" },
      z2bg: "levels/level12_station.jpg", z2: { hazards: [pads, drones] },
    },
''' % frq('level12_ally.png')
B[13]='''    restructure: { // phase 2: alien plain (zone 1) -> seize the cannon (twist) -> crystal canyon (zone 2) -> existing fortress approach
      split: 0, images: ["levels/level13_turret.png", "levels/level13_canyon.jpg"],
      tsec: { hazards: [] },
      twist: { kind: "turret", goal: "kills", title: "SEIZE THE CANNON!", sub: "SHOOT THE DROP-PODS BEFORE THEY LAND", img: "levels/level13_turret.png", fr: %s,
        need: 8, every: 95, arc: true, tspeed: 1.2, landSpawn: "heavy", gun: "cannon", gunFire: "cannonFire", gunK: 0.26, shell: "shell", target: "pod", targetK: 0.22, hudText: "PODS", color: "#b8ff7a" },
      z2bg: "levels/level13_canyon.jpg",
    },
''' % frq('level13_turret.png')
B[14]='''    restructure: { // phase 2: portal street (zone 1) -> tendril alley timed escape (twist) -> under the El (zone 2) -> existing plaza
      split: 0, images: ["levels/level14_tendril.png", "levels/level14_elstreet.jpg"],
      tsec: { length: 1400, hazards: [] },
      twist: { kind: "run", goal: "reach", title: "TENDRIL ALLEY!", sub: "MAKE THE EL OVERPASS BEFORE THE PORTAL SURGE", img: "levels/level14_tendril.png", fr: %s,
        clock: 2700, reclock: 1200, surgeMsg: "PORTAL SURGE!", hudText: "PORTAL SURGE IN", drip: ["purple"], gap: 260, cap: 2, color: "#d08aff" },
      z2bg: "levels/level14_elstreet.jpg",
    },
''' % frq('level14_tendril.png')
for n,blk in B.items():
  F=D+'level%d.js'%n; s=open(F).read()
  if 'restructure: {' in s: print(n,'already'); continue
  i=s.index('sections:')
  m=re.compile(r'^ {3,4}boss[:,]',re.M).search(s,i)
  assert m, n
  s=s[:m.start()]+blk+s[m.start():]
  open(F,'w').write(s); print(n,'ok')
