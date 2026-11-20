// The screenshot scenes behind ?shot=cover|chase|mission|drive. Each one builds
// the real game from the world's seed, then plays it forward for a fixed number
// of fixed steps with a scripted driver, so the frame is what the game really
// looks like in motion — traffic flowing, police closing in, the beacon up —
// and the same seed always gives the same frame.
import { PLAYER, STEP } from './config.js';
import { createPoliceCar, wrapAngle } from './entities.js';
import { idleInput } from './input.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Steer the player's car toward a lookahead point, full but careful throttle. */
function driveInput(state, lookX, lookY, throttle) {
  const car = state.player.inCar;
  const input = idleInput();
  if (!car) return input;
  const desired = Math.atan2(lookY - car.y, lookX - car.x);
  input.steer = clamp(wrapAngle(desired - car.angle) * 2.4, -1, 1);
  input.throttle = throttle;
  return input;
}

/** Walk Mari toward a point. */
function walkInput(state, x, y, run) {
  const p = state.player;
  const input = idleInput();
  const dx = x - p.x;
  const dy = y - p.y;
  const mag = Math.hypot(dx, dy) || 1;
  input.moveX = dx / mag;
  input.moveY = dy / mag;
  input.run = !!run;
  return input;
}

/** Put the player behind the wheel of a parked car, wherever it happens to be. */
function teleportIntoCar(state, x, y, angle, speed) {
  const car = state.cars.find((c) => c.kind === 'parked' && !c.marked) || state.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.playerDriven = true;
  car.wasPlayerCar = true;
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

function stageCover(world) {
  world.reset();
  const idle = idleInput();
  for (let i = 0; i < 200; i += 1) world.step(STEP, idle);
  // Compose the cover over the club block, avenue traffic in the foreground.
  world.state.camera.x = 860;
  world.state.camera.y = 690;
  return { screen: SCREEN_TITLE, hasSave: false };
}

function stageChase(world) {
  world.startRun(null);
  const state = world.state;
  teleportIntoCar(state, 1576, 2380, -Math.PI / 2, 170);
  state.setHeat(70); // Four stars: the whole shift answers.
  const spots = [[1536, 2560], [1618, 2690], [1576, 2830]];
  for (const [x, y] of spots) {
    const cop = createPoliceCar(state.rng, x, y);
    cop.angle = -Math.PI / 2;
    cop.speed = 190;
    state.cars.push(cop);
  }
  // One long straight up the avenue: the interceptors close in and trade paint,
  // but the scene is a chase, not an arrest — the bust meter is pinned while
  // staging so a lucky ram cannot end the run (and fine Mari) mid-frame.
  for (let i = 0; i < 250; i += 1) {
    const car = state.player.inCar;
    if (!car) break;
    world.step(STEP, driveInput(state, 1576, car.y - 280, 1));
    state.bust = 0;
    if (state.heat < 60) state.setHeat(70);
  }
  state.player.health = PLAYER.maxHealth;
  state.setHeat(70);
  return { screen: SCREEN_PLAY, hasSave: false };
}

function stageMission(world) {
  world.startRun(null);
  const state = world.state;
  const door = state.city.places.club.door;
  for (let i = 0; i < 165; i += 1) {
    world.step(STEP, walkInput(state, door.x, door.y, false));
  }
  return { screen: SCREEN_PLAY, hasSave: false };
}

function stageDrive(world) {
  world.startRun(null);
  const state = world.state;
  state.tint = 'sunset';
  teleportIntoCar(state, 3276, 2160, -Math.PI / 2, 150);
  for (let i = 0; i < 250; i += 1) {
    const car = state.player.inCar;
    if (!car) break;
    world.step(STEP, driveInput(state, 3276, car.y - 280, 0.92));
  }
  return { screen: SCREEN_PLAY, hasSave: false };
}

/**
 * Set `world` to the named scene and return what the renderer should paint.
 * Any name other than chase, mission or drive is the cover.
 */
export function stageShot(name, world) {
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMission(world);
  if (name === 'drive') return stageDrive(world);
  return stageCover(world);
}
