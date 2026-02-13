export const MAPS = [
  // 0 — Classic Arena
  {
    name: 'Classic Arena',
    description: 'Flat stage, no surprises.',
    bgColor: 0x16213e,
    groundColor: 0x333344,
    groundLineColor: 0x555577,
    groundY: 620,
    stageLeft: 50,
    stageRight: 1230,
    platforms: [],
    decorations: [],
    hazards: [],
    animated: false,
    p1SpawnX: 350,
    p2SpawnX: 930,
  },

  // 1 — Inferno Pit (Lava)
  {
    name: 'Inferno Pit',
    description: 'Molten lava churns below.',
    bgColor: 0x1a0a0a,
    groundColor: 0x3a2218,
    groundLineColor: 0x6a4030,
    groundY: 620,
    stageLeft: 50,
    stageRight: 1230,
    platforms: [
      { x: 180, y: 480, width: 220, height: 16, color: 0x5a4a3a, lineColor: 0x7a6a5a },
      { x: 550, y: 400, width: 180, height: 16, color: 0x5a4a3a, lineColor: 0x7a6a5a },
      { x: 880, y: 480, width: 220, height: 16, color: 0x5a4a3a, lineColor: 0x7a6a5a },
    ],
    decorations: [
      // Stone pillars
      { type: 'rect', x: 60, y: 460, w: 30, h: 160, color: 0x4a3a2a, alpha: 0.6 },
      { type: 'rect', x: 1190, y: 460, w: 30, h: 160, color: 0x4a3a2a, alpha: 0.6 },
      // Hanging chains
      { type: 'chain', x: 300, y: 0, length: 180 },
      { type: 'chain', x: 980, y: 0, length: 200 },
      { type: 'chain', x: 640, y: 0, length: 130 },
    ],
    hazards: [
      { type: 'lava', y: 620, color1: 0xff2200, color2: 0xff6600, color3: 0xffcc00 },
    ],
    animated: true,
    p1SpawnX: 290,
    p1SpawnY: 480,   // on left stone platform
    p2SpawnX: 990,
    p2SpawnY: 480,   // on right stone platform
  },

  // 2 — Sky Temple
  {
    name: 'Sky Temple',
    description: 'Battle among the clouds.',
    bgColor: 0x0a0a2e,
    groundColor: 0x44446a,
    groundLineColor: 0x6666aa,
    groundY: 620,
    stageLeft: 50,
    stageRight: 1230,
    platforms: [
      // Low sides
      { x: 150, y: 520, width: 200, height: 14, color: 0x5555aa, lineColor: 0x7777cc },
      { x: 930, y: 520, width: 200, height: 14, color: 0x5555aa, lineColor: 0x7777cc },
      // Mid
      { x: 350, y: 400, width: 180, height: 14, color: 0x6666bb, lineColor: 0x8888dd },
      { x: 750, y: 400, width: 180, height: 14, color: 0x6666bb, lineColor: 0x8888dd },
      // High center
      { x: 550, y: 300, width: 180, height: 14, color: 0x7777cc, lineColor: 0x9999ee },
    ],
    decorations: [
      // Stars
      { type: 'stars', count: 40 },
      // Clouds
      { type: 'cloud', x: 100, y: 80, w: 140, alpha: 0.08 },
      { type: 'cloud', x: 500, y: 140, w: 100, alpha: 0.06 },
      { type: 'cloud', x: 900, y: 60, w: 160, alpha: 0.07 },
      { type: 'cloud', x: 1100, y: 180, w: 120, alpha: 0.05 },
    ],
    hazards: [],
    animated: false,
    p1SpawnX: 250,
    p2SpawnX: 1030,
  },

  // 3 — Underground Cavern
  {
    name: 'Underground Cavern',
    description: 'Deep beneath the earth.',
    bgColor: 0x0d0d0d,
    groundColor: 0x2a2218,
    groundLineColor: 0x4a3a28,
    groundY: 620,
    stageLeft: 50,
    stageRight: 1230,
    platforms: [
      { x: 160, y: 460, width: 190, height: 16, color: 0x3a3020, lineColor: 0x5a5040 },
      { x: 480, y: 510, width: 160, height: 16, color: 0x3a3020, lineColor: 0x5a5040 },
      { x: 760, y: 430, width: 170, height: 16, color: 0x3a3020, lineColor: 0x5a5040 },
      { x: 1050, y: 350, width: 150, height: 16, color: 0x3a3020, lineColor: 0x5a5040 },
    ],
    decorations: [
      // Stalactites from ceiling
      { type: 'stalactite', x: 200, y: 0, h: 70 },
      { type: 'stalactite', x: 440, y: 0, h: 50 },
      { type: 'stalactite', x: 680, y: 0, h: 85 },
      { type: 'stalactite', x: 900, y: 0, h: 60 },
      { type: 'stalactite', x: 1100, y: 0, h: 45 },
      // Stalagmites from floor
      { type: 'stalagmite', x: 100, groundY: 620, h: 40 },
      { type: 'stalagmite', x: 600, groundY: 620, h: 55 },
      { type: 'stalagmite', x: 1150, groundY: 620, h: 35 },
      // Glowing crystals on platforms
      { type: 'crystal', x: 255, y: 460, color: 0x44ffaa },
      { type: 'crystal', x: 560, y: 510, color: 0x44aaff },
      { type: 'crystal', x: 845, y: 430, color: 0xff44aa },
      { type: 'crystal', x: 1125, y: 350, color: 0xaaff44 },
    ],
    hazards: [],
    animated: false,
    p1SpawnX: 350,
    p2SpawnX: 930,
  },

  // 4 — Neon Rooftop
  {
    name: 'Neon Rooftop',
    description: 'Fight on the city skyline.',
    bgColor: 0x0a0a18,
    groundColor: 0x222233,
    groundLineColor: 0x00ffff,
    groundY: 620,
    stageLeft: 50,
    stageRight: 1230,
    platforms: [
      // M-shape: sides
      { x: 130, y: 500, width: 180, height: 14, color: 0x222244, lineColor: 0xff00ff },
      { x: 970, y: 500, width: 180, height: 14, color: 0x222244, lineColor: 0xff00ff },
      // Bridges
      { x: 350, y: 460, width: 160, height: 14, color: 0x222244, lineColor: 0x00ffff },
      { x: 770, y: 460, width: 160, height: 14, color: 0x222244, lineColor: 0x00ffff },
      // High center
      { x: 550, y: 420, width: 180, height: 14, color: 0x222244, lineColor: 0xffff00 },
    ],
    decorations: [
      // Building silhouettes with lit windows
      { type: 'building', x: 0, w: 60, h: 200, groundY: 620, windowColor: 0xffee88 },
      { type: 'building', x: 60, w: 45, h: 280, groundY: 620, windowColor: 0x88ccff },
      { type: 'building', x: 1180, w: 55, h: 240, groundY: 620, windowColor: 0xffee88 },
      { type: 'building', x: 1235, w: 45, h: 180, groundY: 620, windowColor: 0x88ccff },
      // Distant buildings
      { type: 'building', x: 150, w: 40, h: 140, groundY: 620, windowColor: 0x445566, distant: true },
      { type: 'building', x: 1100, w: 50, h: 160, groundY: 620, windowColor: 0x445566, distant: true },
      // Stars
      { type: 'stars', count: 20 },
    ],
    hazards: [],
    animated: false,
    p1SpawnX: 350,
    p2SpawnX: 930,
  },
];
