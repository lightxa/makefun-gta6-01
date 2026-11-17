// Solmar Bay city generation: a fixed road grid, blocks of buildings,
// parks, palms, the beach and the sea, all from one seed so the map is
// the same every time the game loads.

import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, BEACH_Y, PALETTE, LANDMARKS, DISTRICTS } from './config.js';
import { mulberry32, pick, randRange } from './rng.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const lamps = [];

  // Buildings fill the blocks between roads. A block is the rectangle
  // between two neighbouring road centrelines, inset by the sidewalk.
  for (let xi = 0; xi < ROADS_X.length - 1; xi++) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi++) {
      const x0 = ROADS_X[xi] + 62, x1 = ROADS_X[xi + 1] - 62;
      const y0 = ROADS_Y[yi] + 62, y1 = ROADS_Y[yi + 1] - 62;
      if (y0 > BEACH_Y - 40) continue; // the beach strip stays open
      if (rng() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: 4 + Math.floor(rng() * 6) });
        continue;
      }
      const cols = x1 - x0 > 260 ? 2 : 1;
      const rows = y1 - y0 > 260 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.12) continue; // a courtyard gap keeps blocks airy
          const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
          const w = bw * randRange(rng, 0.55, 0.8);
          const h = bh * randRange(rng, 0.55, 0.8);
          const x = x0 + (c * bw) + (bw - w) / 2 + randRange(rng, -8, 8);
          const y = y0 + (r * bh) + (bh - h) / 2 + randRange(rng, -8, 8);
          const ci = Math.floor(rng() * PALETTE.buildingRoof.length);
          buildings.push({
            x, y, w, h,
            roof: PALETTE.buildingRoof[ci],
            wall: PALETTE.buildingWall[ci],
            height: 14 + Math.floor(rng() * 30), // extrusion depth for the 2.5D look
            tall: rng() < 0.22,
          });
        }
      }
    }
  }

  // Palm trees line the beach promenade and dot the parks.
  for (let x = 120; x < WORLD_W - 100; x += 90 + Math.floor(rng() * 60)) {
    palms.push({ x, y: BEACH_Y - 24 - rng() * 40, s: 0.8 + rng() * 0.5 });
  }
  for (const p of parks) {
    for (let i = 0; i < p.trees; i++) {
      palms.push({ x: p.x + 20 + rng() * (p.w - 40), y: p.y + 20 + rng() * (p.h - 40), s: 0.7 + rng() * 0.6 });
    }
  }
  // Street lamps along the main avenues.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (rng() < 0.5) lamps.push({ x: rx + 58, y: ry + 58 });
    }
  }

  return {
    buildings, parks, palms, lamps,
    landmarks: LANDMARKS,
    beachY: BEACH_Y,
    // Docks: wooden piers jutting into the sea at the east end.
    piers: [
      { x: 3100, y: BEACH_Y + 60, w: 26, h: 150 },
      { x: 3260, y: BEACH_Y + 60, w: 26, h: 190 },
      { x: 3420, y: BEACH_Y + 60, w: 26, h: 130 },
    ],
  };
}

// True when the point is inside a building (solid for walking and driving).
export function hitsBuilding(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Nearest road centreline to a point, used to snap traffic onto roads.
export function nearestRoadX(x) {
  let best = ROADS_X[0], bd = Infinity;
  for (const rx of ROADS_X) { const d = Math.abs(rx - x); if (d < bd) { bd = d; best = rx; } }
  return best;
}
export function nearestRoadY(y) {
  let best = ROADS_Y[0], bd = Infinity;
  for (const ry of ROADS_Y) { const d = Math.abs(ry - y); if (d < bd) { bd = d; best = ry; } }
  return best;
}

export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < 52) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < 52) return true;
  return false;
}

export function districtAt(x, y) {
  // Returns the district name for the HUD location readout.
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar Bay';
}
