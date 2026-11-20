// Marisol Bay itself: the road grid, the city blocks and their buildings, the
// beach and the pier, and the named places the story visits. Everything is laid
// out from the seeded rng at boot, so a seed always builds the same city.
// Buildings are solid rectangles; the collision helpers at the bottom keep the
// player and the cars out of them. Nothing here touches the DOM.
import {
  AVENUES_X, BEACH_X, PIER, ROAD_HALF, ROOF_COLORS, STREETS_Y, WATER_X, WORLD,
} from './config.js';

/** Block columns and rows: the land between the roads, where buildings stand. */
const BLOCK_X = [[30, 295], [405, 895], [1005, 1495], [1605, 2095], [2205, 2695], [2805, 3195]];
const BLOCK_Y = [[30, 295], [405, 845], [1005, 1395], [1505, 1945], [2055, 2570]];

const SIGNS = [
  'CAFE SOL', 'PANADERIA', 'FARMACIA', 'BAR NEON', 'GYM OLA', 'LAVANDERIA',
  'TATTOO FIN', 'LIBROS', 'PIZZA MAR', 'SUSHI REEF', 'FLORERIA', 'BARBERIA',
  'HELADERIA', 'DISCOS', 'OPTICA', 'JOYERIA', 'MERCADO', 'CINE LUNA',
];

function overlaps(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

/** The named places: a solid building (or, for the hideout, just a spot) and the points the game uses. */
function namedPlaces() {
  return {
    club: {
      name: 'Club Coral', sign: 'CLUB CORAL', color: '#b565d8',
      rect: { x: 540, y: 520, w: 230, h: 150 },
      door: { x: 655, y: 706 }, garage: { x: 915, y: 790 }, lot: { x: 640, y: 758 },
    },
    marina: {
      name: 'Marina', sign: 'MARINA', color: '#3fa7c4',
      rect: { x: 2920, y: 2140, w: 170, h: 110 },
      door: { x: 3005, y: 2285 }, pickup: { x: 3175, y: 2200 },
    },
    hotel: {
      name: 'Hotel Aurelia', sign: 'HOTEL AURELIA', color: '#f2b879',
      rect: { x: 1130, y: 80, w: 250, h: 140 },
      door: { x: 1255, y: 250 },
    },
    police: {
      name: 'Police Station', sign: 'POLICE', color: '#8ecae6',
      rect: { x: 2300, y: 1120, w: 250, h: 140 },
      door: { x: 2425, y: 1295 }, respawn: { x: 2425, y: 1330 },
    },
    hospital: {
      name: 'Hospital', sign: 'HOSPITAL', color: '#f2f2ee',
      rect: { x: 60, y: 2180, w: 200, h: 130 },
      door: { x: 160, y: 2345 }, respawn: { x: 160, y: 2385 },
    },
    garage: {
      name: 'Garage', sign: 'TALLER SOL', color: '#90be6d',
      rect: { x: 1750, y: 1620, w: 200, h: 120 },
      door: { x: 1850, y: 1775 },
    },
    lighthouse: {
      name: 'Lighthouse', sign: null, color: '#e83a3a',
      rect: { x: 3508, y: 1424, w: 52, h: 52 },
      point: { x: 3462, y: 1450 },
    },
    hideout: {
      name: 'Hideout', sign: null, color: null, rect: null,
      point: { x: 215, y: 215 },
    },
  };
}

export function buildCity(rng) {
  const places = namedPlaces();
  const buildings = [];
  const reserved = [];
  for (const key of Object.keys(places)) {
    const place = places[key];
    if (place.rect) {
      buildings.push({
        x: place.rect.x, y: place.rect.y, w: place.rect.w, h: place.rect.h,
        color: place.color, sign: place.sign, place: key,
      });
      reserved.push(place.rect);
    }
  }
  // The club's parking lot and the hideout's corner stay free of buildings.
  reserved.push({ x: 545, y: 690, w: 300, h: 140 });
  reserved.push({ x: 165, y: 165, w: 100, h: 100 });

  const palms = [];
  const lamps = [];
  for (const ax of AVENUES_X) {
    for (const sy of STREETS_Y) {
      lamps.push({ x: ax - ROAD_HALF - 10, y: sy - ROAD_HALF - 10 });
      lamps.push({ x: ax + ROAD_HALF + 10, y: sy + ROAD_HALF + 10 });
    }
  }

  for (const [bx0, bx1] of BLOCK_X) {
    for (const [by0, by1] of BLOCK_Y) {
      let lotY = by0 + 16;
      while (lotY < by1 - 90) {
        const lotH = Math.min(rng.range(84, 128), by1 - 16 - lotY);
        let lotX = bx0 + 16;
        while (lotX < bx1 - 80) {
          const lotW = Math.min(rng.range(92, 148), bx1 - 16 - lotX);
          const rect = { x: lotX, y: lotY, w: lotW, h: lotH };
          const blocked = reserved.some((zone) => overlaps(rect, zone, 10));
          if (!blocked && rng.chance(0.86)) {
            buildings.push({
              x: rect.x, y: rect.y, w: rect.w, h: rect.h,
              color: rng.pick(ROOF_COLORS),
              sign: rng.chance(0.34) ? rng.pick(SIGNS) : null,
              place: null,
            });
          } else if (!blocked && rng.chance(0.5)) {
            palms.push({ x: lotX + lotW / 2, y: lotY + lotH / 2, s: rng.range(0.8, 1.25) });
          }
          lotX += lotW + rng.range(16, 30);
        }
        lotY += lotH + rng.range(16, 30);
      }
    }
  }

  // Palms line the beach promenade.
  for (let y = 90; y < WORLD.height - 60; y += rng.range(95, 150)) {
    palms.push({ x: BEACH_X + rng.range(14, 40), y, s: rng.range(0.9, 1.3) });
  }

  // Sidewalk points: the strips around each block where pedestrians stroll.
  const sidewalkPoints = [];
  for (const [bx0, bx1] of BLOCK_X) {
    for (const [by0, by1] of BLOCK_Y) {
      for (let x = bx0 + 20; x < bx1 - 10; x += 105) {
        sidewalkPoints.push({ x, y: by0 - 12 });
        sidewalkPoints.push({ x, y: by1 + 12 });
      }
      for (let y = by0 + 20; y < by1 - 10; y += 105) {
        sidewalkPoints.push({ x: bx0 - 12, y });
        sidewalkPoints.push({ x: bx1 + 12, y });
      }
    }
  }
  for (let y = 140; y < WORLD.height - 80; y += 170) sidewalkPoints.push({ x: BEACH_X + 26, y });

  // Parked-car spots: hugging the kerbs of the avenues, plus the club lot.
  const parkedSpots = [];
  for (const ax of AVENUES_X) {
    for (let i = 0; i < 4; i += 1) {
      const y = rng.range(120, WORLD.height - 160);
      if (STREETS_Y.some((sy) => Math.abs(y - sy) < 110)) continue;
      parkedSpots.push({ x: ax + (rng.chance(0.5) ? -40 : 40), y, angle: Math.PI / 2 });
    }
  }
  parkedSpots.push({ x: 742, y: 758, angle: 0 });

  // Shell spots: most along the sand, a few hidden in the city.
  const shellSpots = [];
  for (let i = 0; i < 14; i += 1) {
    shellSpots.push({ x: rng.range(BEACH_X + 30, WATER_X - 45), y: rng.range(70, WORLD.height - 90) });
  }
  for (let i = 0; i < 6; i += 1) {
    const point = sidewalkPoints[rng.int(0, sidewalkPoints.length - 1)];
    shellSpots.push({ x: point.x + rng.range(-8, 8), y: point.y + rng.range(-8, 8) });
  }

  const intersections = [];
  for (const ax of AVENUES_X) for (const sy of STREETS_Y) intersections.push({ x: ax, y: sy });

  return { buildings, palms, lamps, places, sidewalkPoints, parkedSpots, shellSpots, intersections };
}

/** True when the point is on asphalt (or on the pier planks). */
export function isOnRoad(x, y) {
  for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return true;
  return isOnPier(x, y);
}

export function isOnPier(x, y) {
  return x >= PIER.x0 && x <= PIER.x1 && Math.abs(y - PIER.cy) <= PIER.half;
}

/** True when the point is open sea: pretty to look at, fatal to drive into. */
export function isWater(x, y) {
  return x > WATER_X && !isOnPier(x, y);
}

/**
 * Push a circle out of every building it overlaps. Returns true when it hit
 * something, so callers can slow down, bounce or play a crash.
 */
export function resolveCircle(pos, radius, buildings) {
  let hit = false;
  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    const nearX = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nearX;
    const dy = pos.y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = nearX + (dx / dist) * radius;
      pos.y = nearY + (dy / dist) * radius;
    } else {
      // The centre is inside the building: leave by the nearest face.
      const left = pos.x - (b.x - radius);
      const right = b.x + b.w + radius - pos.x;
      const top = pos.y - (b.y - radius);
      const bottom = b.y + b.h + radius - pos.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = b.x - radius;
      else if (min === right) pos.x = b.x + b.w + radius;
      else if (min === top) pos.y = b.y - radius;
      else pos.y = b.y + b.h + radius;
    }
  }
  return hit;
}

/** Clamp a point to the playable world (the sea wall on the east edge). */
export function clampToWorld(pos, radius) {
  pos.x = Math.max(radius, Math.min(WORLD.width - radius, pos.x));
  pos.y = Math.max(radius, Math.min(WORLD.height - radius, pos.y));
}
