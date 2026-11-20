// The people and vehicles of Marisol Bay: factories for cars and pedestrians,
// and the three brains that move them — traffic cars that follow the road grid
// lane by lane, police interceptors that hunt the player, and pedestrians who
// stroll the sidewalks and run from trouble. Pure simulation: no DOM, no drawing.
import { AVENUES_X, CAR_COLORS, CAR_MODELS, PED_COLORS, PED_SHIRTS, STREETS_Y } from './config.js';
import { clampToWorld, isWater, resolveCircle } from './city.js';

export const HEADING_E = 0;
export const HEADING_S = Math.PI / 2;
export const HEADING_W = Math.PI;
export const HEADING_N = -Math.PI / 2;
const HEADINGS = [HEADING_E, HEADING_S, HEADING_W, HEADING_N];

/** Wrap an angle difference to -PI..PI. */
export function wrapAngle(a) {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function baseCar(kind, model, x, y, angle, color) {
  return {
    kind, model, x, y, angle,
    speed: 0, color, health: 100,
    heading: angle, cruise: 0, turnCooldown: 0,
    reverseTimer: 0, hitCooldown: 0, marked: false, playerDriven: false,
  };
}

export function createTrafficCar(rng, x, y, heading) {
  const model = rng.pick(['sedan', 'sedan', 'wagon', 'coupe', 'pickup']);
  const car = baseCar('traffic', model, x, y, heading, rng.pick(CAR_COLORS));
  car.heading = heading;
  car.cruise = rng.range(118, 172);
  car.speed = car.cruise;
  return car;
}

export function createParkedCar(rng, spot, model) {
  const chosen = model || rng.pick(['sedan', 'wagon', 'coupe', 'pickup', 'sedan']);
  // A spot without a heading (a named place's lot, say) parks facing east;
  // an undefined angle here would poison every later movement with NaN.
  const angle = Number.isFinite(spot.angle) ? spot.angle : 0;
  return baseCar('parked', chosen, spot.x, spot.y, angle, rng.pick(CAR_COLORS));
}

export function createPoliceCar(rng, x, y) {
  const car = baseCar('police', 'police', x, y, rng.pick(HEADINGS), '#f2f2ee');
  car.cruise = CAR_MODELS.police.maxSpeed;
  return car;
}

export function createPed(rng, x, y) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(52, 82), skin: rng.pick(PED_COLORS), shirt: rng.pick(PED_SHIRTS),
    state: 'wander', targetX: x, targetY: y,
    fleeX: 0, fleeY: 0, fleeTimer: 0, downTimer: 0, waitTimer: rng.range(0, 2),
    active: true, isTaxi: false,
  };
}

/** The lane centre line a traffic car should hold for its heading on the nearest road. */
function laneTarget(car) {
  const dx = Math.cos(car.heading);
  const dy = Math.sin(car.heading);
  if (Math.abs(dx) > Math.abs(dy)) {
    let street = STREETS_Y[0];
    for (const sy of STREETS_Y) if (Math.abs(car.y - sy) < Math.abs(car.y - street)) street = sy;
    const laneY = street + (dx > 0 ? 26 : -26);
    return { x: car.x + dx * 150, y: laneY };
  }
  let avenue = AVENUES_X[0];
  for (const ax of AVENUES_X) if (Math.abs(car.x - ax) < Math.abs(car.x - avenue)) avenue = ax;
  const laneX = avenue + (dy > 0 ? -26 : 26);
  return { x: laneX, y: car.y + dy * 150 };
}

function moveCar(state, car, dt) {
  const px = car.x;
  const py = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car, 22);
  if (isWater(car.x, car.y)) {
    car.x = px;
    car.y = py;
    car.speed *= -0.3;
    return true;
  }
  const hit = resolveCircle(car, 17, state.city.buildings);
  if (hit && Math.abs(car.speed) > 60) car.speed *= 0.45;
  return hit;
}

/** Traffic: hold the lane, turn at some intersections, brake for the car ahead. */
export function stepTrafficCar(state, car, dt) {
  const rng = state.rng;
  car.turnCooldown = Math.max(0, car.turnCooldown - dt);

  const nearCross = state.city.intersections.some(
    (p) => Math.abs(car.x - p.x) < 30 && Math.abs(car.y - p.y) < 30,
  );
  if (nearCross && car.turnCooldown <= 0) {
    const roll = rng.next();
    if (roll < 0.34) car.heading = wrapAngle(car.heading - Math.PI / 2);
    else if (roll < 0.68) car.heading = wrapAngle(car.heading + Math.PI / 2);
    car.turnCooldown = 3;
  }

  const target = laneTarget(car);
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = wrapAngle(desired - car.angle);
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));

  let targetSpeed = car.cruise;
  const dirX = Math.cos(car.angle);
  const dirY = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car) continue;
    const relX = other.x - car.x;
    const relY = other.y - car.y;
    const forward = relX * dirX + relY * dirY;
    const lateral = Math.abs(relX * -dirY + relY * dirX);
    if (forward > 0 && forward < 72 && lateral < 21) {
      targetSpeed = Math.min(targetSpeed, forward < 36 ? 0 : other.speed * 0.92);
    }
  }
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 130 * dt);
  else car.speed = Math.max(targetSpeed, car.speed - 320 * dt);
  moveCar(state, car, dt);
}

/** Police: steer straight at the player, back up when a building gets in the way. */
export function stepPoliceCar(state, car, dt) {
  const focus = state.focus;
  const dx = focus.x - car.x;
  const dy = focus.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    car.speed = Math.max(-95, car.speed - 240 * dt);
    moveCar(state, car, dt);
    return;
  }
  const desired = Math.atan2(dy, dx);
  const diff = wrapAngle(desired - car.angle);
  car.angle += Math.max(-3.1 * dt, Math.min(3.1 * dt, diff));
  const targetSpeed = CAR_MODELS.police.maxSpeed * (dist > 320 ? 1 : 0.84);
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + CAR_MODELS.police.accel * dt);
  else car.speed = Math.max(targetSpeed, car.speed - 300 * dt);
  const hit = moveCar(state, car, dt);
  if (hit && Math.abs(car.speed) > 70) car.reverseTimer = 0.42;
}

/** Pedestrians: stroll between sidewalk points, flee danger, lie still when floored. */
export function stepPed(state, ped, dt) {
  if (!ped.active) return;
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.state = 'flee';
      ped.fleeTimer = 2.2;
      ped.fleeX = state.focus.x;
      ped.fleeY = state.focus.y;
    }
    return;
  }
  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    tx = ped.x + Math.cos(away) * 120;
    ty = ped.y + Math.sin(away) * 120;
    speed = 196;
    if (ped.fleeTimer <= 0) ped.state = 'wander';
  } else if (ped.state === 'wait') {
    return; // A taxi fare standing at the kerb, thumb out.
  } else {
    tx = ped.targetX;
    ty = ped.targetY;
    const dist = Math.hypot(tx - ped.x, ty - ped.y);
    if (dist < 14) {
      ped.waitTimer -= dt;
      if (ped.waitTimer <= 0) {
        const point = state.rng.pick(state.city.sidewalkPoints);
        // New targets stay in the neighbourhood, so crowds feel local.
        if (Math.hypot(point.x - ped.x, point.y - ped.y) < 620) {
          ped.targetX = point.x;
          ped.targetY = point.y;
        }
        ped.waitTimer = state.rng.range(0.4, 2.4);
      }
      return;
    }
  }
  const desired = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle += Math.max(-6 * dt, Math.min(6 * dt, wrapAngle(desired - ped.angle)));
  const px = ped.x;
  const py = ped.y;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  clampToWorld(ped, 12);
  if (isWater(ped.x, ped.y)) {
    ped.x = px;
    ped.y = py;
    ped.angle += Math.PI;
    return;
  }
  resolveCircle(ped, 10, state.city.buildings);
}
