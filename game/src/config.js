// Marisol Heat — every tuning number, colour and city constant in one place.
// The renderer paints a fixed 1280x720 view that is scaled to the window, and the
// simulation advances in fixed steps, so no rule below depends on the screen size
// or the display's refresh rate.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The logical view the camera shows, in world units. */
export const VIEW = { width: 1280, height: 720 };

/** The whole city of Marisol Bay, in world units. */
export const WORLD = { width: 3600, height: 2600 };

/** Centre lines of the vertical avenues and horizontal streets. */
export const AVENUES_X = [350, 950, 1550, 2150, 2750, 3250];
export const STREETS_Y = [350, 900, 1450, 2000];

/** Half the width of a road: the asphalt spans centre ± ROAD_HALF. */
export const ROAD_HALF = 55;

/** Where the sand starts on the east coast, and where the sea takes over. */
export const BEACH_X = 3305;
export const WATER_X = 3490;

/** The pier: a plank strip running east from the coast road at street 1450. */
export const PIER = { x0: BEACH_X, x1: 3596, cy: 1450, half: 40 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  runSpeed: 292,
  maxHealth: 100,
  punchRange: 48,
  punchCooldown: 0.35,
  enterRange: 62,
};

export const CAR_MODELS = {
  coupe: { label: 'Vireo Coupe', maxSpeed: 336, accel: 268, length: 46, width: 24 },
  sedan: { label: 'Alder Sedan', maxSpeed: 288, accel: 228, length: 48, width: 25 },
  wagon: { label: 'Brisa Wagon', maxSpeed: 262, accel: 205, length: 50, width: 25 },
  pickup: { label: 'Duna Pickup', maxSpeed: 252, accel: 198, length: 52, width: 26 },
  police: { label: 'MBPD Interceptor', maxSpeed: 318, accel: 262, length: 48, width: 25 },
};

export const HEAT = {
  max: 100,
  theft: 16,
  hitCar: 8,
  hitPed: 26,
  punch: 14,
  decayDelay: 5,
  decayRate: 5.2,
  witnessRadiusPed: 260,
  witnessRadiusPolice: 340,
  escapeRadius: 300,
};

/** Stars shown for a heat value: 0 at rest, then one star per 20 heat, capped at 5. */
export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.floor(heat / 20) + 1);
}

export const PALETTE = {
  backdrop: '#241423',
  sidewalk: '#9aa0a3',
  sidewalkEdge: '#7e8589',
  road: '#3c3f45',
  roadLine: '#e8d44d',
  roadEdge: '#f2f2ee',
  sand: '#ecd28f',
  water: '#1f7f9e',
  waterLight: '#3fa7c4',
  grass: '#79a85b',
  palmTrunk: '#8a6642',
  palmLeaf: '#3e8e4f',
  player: '#ff5d8f',
  playerSkin: '#f2c29b',
  cash: '#57d977',
  beacon: '#ffd94d',
  policeBlue: '#274bdb',
  policeRed: '#e83a3a',
  panel: 'rgba(20,12,24,0.82)',
  panelEdge: '#ffd94d',
  text: '#fdf6ec',
  muted: '#cdbfd4',
  health: '#e83a5f',
  healthBack: '#4a2432',
};

export const ROOF_COLORS = [
  '#e2725b', '#e88ca0', '#f2b879', '#8ecae6', '#90be6d', '#f9c74f',
  '#b565d8', '#43aa8b', '#f3722c', '#6d9dc5', '#e0a899', '#7fb5a3',
];

export const CAR_COLORS = [
  '#e83a3a', '#f2f2ee', '#274bdb', '#ffd94d', '#2b2b30', '#57d977',
  '#ff8c42', '#b565d8', '#3fa7c4', '#c0c6cc', '#8a2f4b', '#2e6f5e',
];

export const PED_COLORS = ['#f2c29b', '#c68863', '#8d5524', '#ffdbac', '#e0ac69', '#6b4423'];

export const PED_SHIRTS = [
  '#ffd94d', '#3fa7c4', '#ff5d8f', '#57d977', '#f2f2ee', '#ff8c42', '#b565d8',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save game is kept between visits (this browser only). */
export const SAVE_KEY = 'marisol-heat-save-v1';

export const SHELL_COUNT = 20;
export const SHELL_VALUE = 25;
