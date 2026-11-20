// Marisol Heat's rules and state, with no drawing and no browser in it: Mari on
// foot and behind the wheel, traffic and police, heat and busts, cash and shells,
// and the save-game shape. step() advances one fixed step from an input object
// (see input.js — the screenshot scenes build the same objects by hand) and
// records what happened in state.events for the caller to react to.
import {
  CAR_MODELS, HEAT, PLAYER, SHELL_VALUE, VIEW, WORLD, starsForHeat,
} from './config.js';
import { buildCity, clampToWorld, isWater, resolveCircle } from './city.js';
import {
  createParkedCar, createPed, createPoliceCar, createTrafficCar,
  stepPed, stepPoliceCar, stepTrafficCar, wrapAngle,
} from './entities.js';
import { createStory, createTaxi } from './missions.js';

const TRAFFIC_TARGET = 13;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld(rng) {
  const state = {
    time: 0,
    rng,
    city: null,
    started: false,
    storyDone: false,
    tint: null,
    player: null,
    focus: null,
    cars: [],
    peds: [],
    pickups: [],
    shells: [],
    shellsFound: 0,
    heat: 0,
    stars: 0,
    lastWitnessAt: -99,
    bust: 0,
    events: [],
    phone: null,
    phoneQueue: [],
    objective: null,
    prompt: null,
    taxiOffer: null,
    taxiDest: null,
    camera: { x: 0, y: 0 },
    skids: [],
    sparks: [],
    markedCar: null,
    story: null,
    taxi: null,
    punchCd: 0,
    hurtCd: 0,
    policeTimer: 0,
  };
  state.focus = state.player;

  state.toast = (name, text) => {
    state.phoneQueue.push({ name, text });
    state.events.push('phone');
  };
  state.addCash = (n) => {
    state.player.cash += n;
  };
  state.setHeat = (n) => {
    state.heat = Math.max(0, Math.min(HEAT.max, n));
    state.lastWitnessAt = state.time;
    state.stars = starsForHeat(state.heat);
  };
  state.spawnTaxiPed = (point) => {
    const ped = createPed(rng, point.x, point.y);
    ped.state = 'wait';
    ped.isTaxi = true;
    state.peds.push(ped);
    return ped;
  };

  function witnessed() {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.active && ped.state !== 'down' && Math.hypot(ped.x - p.x, ped.y - p.y) < HEAT.witnessRadiusPed) return true;
    }
    for (const car of state.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < HEAT.witnessRadiusPolice) return true;
    }
    return false;
  }

  function addHeat(amount) {
    const seen = witnessed();
    state.heat = Math.min(HEAT.max, state.heat + (seen ? amount : amount * 0.35));
    if (seen) {
      state.lastWitnessAt = state.time;
      state.events.push('crime');
    }
    state.stars = starsForHeat(state.heat);
  }
  state.addHeat = addHeat;

  function burst(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      state.sparks.push({
        x, y,
        vx: rng.range(-160, 160), vy: rng.range(-160, 160),
        life: rng.range(0.25, 0.6),
      });
    }
    if (state.sparks.length > 240) state.sparks.splice(0, state.sparks.length - 240);
  }

  function damagePlayer(amount) {
    if (!state.started || state.player.health <= 0) return;
    state.player.health -= amount;
    if (state.player.health <= 0) doWasted();
  }

  function clearPolice() {
    state.cars = state.cars.filter((car) => car.kind !== 'police');
  }

  function doBusted() {
    const p = state.player;
    const fine = Math.min(p.cash, 100 + Math.floor(p.cash * 0.1));
    p.cash -= fine;
    p.inCar = null;
    p.x = state.city.places.police.respawn.x;
    p.y = state.city.places.police.respawn.y;
    p.health = Math.max(p.health, 55);
    state.heat = 0;
    state.stars = 0;
    state.bust = 0;
    clearPolice();
    state.events.push('busted');
    state.toast('MBPD', `Busted. Fine paid: $${fine}. Walk it off, Mari.`);
  }

  function doWasted() {
    const p = state.player;
    const fee = Math.min(p.cash, 150);
    p.cash -= fee;
    p.inCar = null;
    p.x = state.city.places.hospital.respawn.x;
    p.y = state.city.places.hospital.respawn.y;
    p.health = PLAYER.maxHealth;
    state.heat = 0;
    state.stars = 0;
    state.bust = 0;
    clearPolice();
    state.events.push('wasted');
    state.toast('Hospital', `You flatlined, Mari. Bill: $${fee}. Take it slower.`);
  }

  function reset() {
    state.city = buildCity(rng);
    state.time = 0;
    state.started = false;
    state.storyDone = false;
    state.tint = null;
    state.cars = [];
    state.peds = [];
    state.pickups = [];
    state.shells = state.city.shellSpots.map((s) => ({ x: s.x, y: s.y, taken: false }));
    state.shellsFound = 0;
    state.heat = 0;
    state.stars = 0;
    state.lastWitnessAt = -99;
    state.bust = 0;
    state.events = [];
    state.phone = null;
    state.phoneQueue = [];
    state.objective = null;
    state.prompt = null;
    state.taxiOffer = null;
    state.taxiDest = null;
    state.skids = [];
    state.sparks = [];
    state.punchCd = 0;
    state.hurtCd = 0;
    state.policeTimer = 0;
    state.player = {
      x: 910, y: 780, angle: -Math.PI / 2, health: PLAYER.maxHealth, cash: 120, inCar: null,
    };
    state.focus = state.player;

    const places = state.city.places;
    const coupe = createParkedCar(rng, places.club.lot, 'coupe');
    coupe.color = '#ff2fb3';
    coupe.marked = true;
    state.cars.push(coupe);
    state.markedCar = coupe;
    state.cars.push(createParkedCar(rng, places.club.lot, 'sedan'));
    state.cars[state.cars.length - 1].x = 742;
    state.cars[state.cars.length - 1].y = 758;
    for (const spot of state.city.parkedSpots) {
      if (rng.chance(0.8)) state.cars.push(createParkedCar(rng, spot));
    }
    for (let i = 0; i < TRAFFIC_TARGET; i += 1) spawnTraffic(true);
    for (let i = 0; i < 26; i += 1) {
      const point = rng.pick(state.city.sidewalkPoints);
      state.peds.push(createPed(rng, point.x, point.y));
    }
    state.story = createStory();
    state.taxi = createTaxi();
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function spawnTraffic(anywhere) {
    const point = rng.pick(state.city.intersections);
    if (!anywhere && Math.hypot(point.x - state.player.x, point.y - state.player.y) < 700) return;
    const heading = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = createTrafficCar(rng, point.x + rng.range(-14, 14), point.y + rng.range(-14, 14), heading);
    state.cars.push(car);
  }

  function startRun(save) {
    reset();
    state.started = true;
    if (save) {
      state.player.cash = save.cash | 0;
      if (save.storyDone) {
        state.story.done = true;
        state.story.index = 5;
        state.storyDone = true;
      } else if (Number.isInteger(save.missionIndex)) {
        state.story.index = Math.max(0, Math.min(4, save.missionIndex));
      }
      if (Array.isArray(save.shells)) {
        state.shells.forEach((shell, i) => {
          shell.taken = !!save.shells[i];
          if (shell.taken) state.shellsFound += 1;
        });
      }
      state.toast('Mari', 'Back in Marisol Bay. The city kept your tab.');
    }
  }

  function saveData() {
    return {
      cash: state.player.cash,
      missionIndex: state.story.index,
      storyDone: state.storyDone,
      shells: state.shells.map((s) => (s.taken ? 1 : 0)),
    };
  }

  // --- player -------------------------------------------------------------

  function stepFoot(dt, input) {
    const p = state.player;
    const mag = Math.hypot(input.moveX, input.moveY);
    if (mag > 0) {
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = (input.moveX / mag) * speed * dt;
      const ny = (input.moveY / mag) * speed * dt;
      const px = p.x;
      const py = p.y;
      p.x += nx;
      p.y += ny;
      if (isWater(p.x, p.y)) {
        p.x = px;
        p.y = py;
      }
      p.angle = Math.atan2(input.moveY, input.moveX);
    }
    clampToWorld(p, PLAYER.radius + 2);
    resolveCircle(p, PLAYER.radius, state.city.buildings);

    // Traffic is not watching where it goes: a fast car clips Mari.
    if (state.hurtCd <= 0) {
      for (const car of state.cars) {
        if (Math.abs(car.speed) > 70 && Math.hypot(car.x - p.x, car.y - p.y) < 27) {
          damagePlayer(9);
          state.hurtCd = 0.7;
          p.x += Math.cos(Math.atan2(p.y - car.y, p.x - car.x)) * 16;
          p.y += Math.sin(Math.atan2(p.y - car.y, p.x - car.x)) * 16;
          state.events.push('crash');
          burst(p.x, p.y, 6);
          break;
        }
      }
    }
  }

  function stepDriving(dt, input) {
    const p = state.player;
    const car = p.inCar;
    const model = CAR_MODELS[car.model];
    const wrecked = car.health <= 0;
    const topSpeed = wrecked ? 0 : model.maxSpeed * (car.health < 35 ? 0.55 : 1);

    if (!wrecked) {
      if (input.throttle > 0) {
        car.speed += model.accel * dt * input.throttle;
      } else if (input.throttle < 0) {
        // Brake hard while rolling forward; once down to a crawl the same
        // pedal becomes reverse, up to a modest backing speed.
        if (car.speed > 8) car.speed = Math.max(0, car.speed - 430 * dt);
        else car.speed = Math.max(-95, car.speed - 150 * dt);
      }
    }
    car.speed -= car.speed * 0.14 * dt;
    if (input.throttle === 0) car.speed -= car.speed * 0.7 * dt;
    car.speed = Math.max(-95, Math.min(topSpeed, car.speed));

    if (Math.abs(car.speed) > 4) {
      car.angle += input.steer * 2.1 * dt * Math.max(-1, Math.min(1, car.speed / 110));
    }
    car.angle = wrapAngle(car.angle);

    const px = car.x;
    const py = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    clampToWorld(car, 24);
    if (isWater(car.x, car.y)) {
      car.x = px;
      car.y = py;
      car.speed *= -0.3;
    }
    const impact = Math.abs(car.speed);
    if (resolveCircle(car, 18, state.city.buildings)) {
      if (impact > 170) {
        state.events.push('crash');
        car.health -= (impact - 170) / 9;
        damagePlayer((impact - 170) / 22);
        burst(car.x, car.y, 10);
      } else if (impact > 60) {
        burst(car.x, car.y, 3);
      }
      car.speed = -car.speed * 0.32;
    }

    // Skid marks when the tyres are working hard.
    if (Math.abs(car.speed) > 165 && (input.throttle < 0 || Math.abs(input.steer) > 0)) {
      state.skids.push({ x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16, life: 1 });
      if (state.skids.length > 420) state.skids.shift();
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }

  function carCollisions() {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= 45) continue;
        const push = (45 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        const aHeld = a.playerDriven;
        const bHeld = b.playerDriven;
        if (!aHeld) { a.x -= ux * push; a.y -= uy * push; }
        if (!bHeld) { b.x += ux * push; b.y += uy * push; }
        if (aHeld || bHeld) { a.x -= ux * push * 0.4; b.x += ux * push * 0.4; }
        const closing = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;
        const other = aHeld ? b : a;
        if (closing > 105) {
          if (other.hitCooldown <= 0) {
            other.hitCooldown = 1;
            state.events.push('crash');
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
            a.health -= 5;
            b.health -= 5;
            if (state.started && other.kind !== 'police') addHeat(HEAT.hitCar);
            if (other.kind === 'police') damagePlayer(4);
          }
          if (aHeld) a.speed *= 0.55;
          if (bHeld) b.speed *= 0.55;
        }
      }
    }
  }

  function tryInteract() {
    const p = state.player;
    if (p.inCar) {
      if (Math.abs(p.inCar.speed) < 60) {
        const car = p.inCar;
        car.playerDriven = false;
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 32;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 32;
        resolveCircle(p, PLAYER.radius, state.city.buildings);
        clampToWorld(p, PLAYER.radius + 2);
        state.events.push('door');
      }
      return;
    }
    let best = null;
    let bestDist = PLAYER.enterRange;
    for (const car of state.cars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestDist) {
        best = car;
        bestDist = d;
      }
    }
    if (!best) return;
    if (best.kind === 'traffic') {
      const driver = createPed(rng, best.x + 24, best.y + 10);
      driver.state = 'flee';
      driver.fleeTimer = 3;
      driver.fleeX = p.x;
      driver.fleeY = p.y;
      state.peds.push(driver);
      best.kind = 'parked';
      best.speed = 0;
    }
    if (best.kind === 'police') return; // Mari has standards.
    p.inCar = best;
    best.playerDriven = true;
    p.x = best.x;
    p.y = best.y;
    state.events.push('door');
    if (!best.wasPlayerCar && best !== state.markedCar && state.started) addHeat(HEAT.theft);
    best.wasPlayerCar = true;
  }

  function tryPunch() {
    const p = state.player;
    if (p.inCar || state.punchCd > 0) return;
    state.punchCd = PLAYER.punchCooldown;
    let best = null;
    let bestDist = PLAYER.punchRange;
    for (const ped of state.peds) {
      if (!ped.active || ped.state === 'down') continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < bestDist) {
        best = ped;
        bestDist = d;
      }
    }
    if (!best) return;
    best.state = 'down';
    best.downTimer = 6;
    state.pickups.push({ x: best.x + rng.range(-8, 8), y: best.y + rng.range(-8, 8), amount: rng.int(10, 30) });
    state.events.push('punch');
    if (state.started) addHeat(HEAT.punch);
  }

  // --- police -------------------------------------------------------------

  function policeManagement(dt) {
    const desired = state.stars;
    const police = state.cars.filter((c) => c.kind === 'police');
    if (desired === 0) {
      for (const car of police) {
        if (Math.hypot(car.x - state.player.x, car.y - state.player.y) > 480) {
          car.kind = 'traffic';
          car.cruise = 140;
          car.heading = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
        }
      }
      return;
    }
    state.policeTimer -= dt;
    if (police.length < desired && state.policeTimer <= 0) {
      state.policeTimer = 0.9;
      const point = rng.pick(state.city.intersections);
      const d = Math.hypot(point.x - state.player.x, point.y - state.player.y);
      if (d > 620 && d < 1080) state.cars.push(createPoliceCar(rng, point.x, point.y));
    }
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind === 'police' && Math.hypot(car.x - state.player.x, car.y - state.player.y) > 1600) {
        state.cars.splice(i, 1);
      }
    }
  }

  function bustLogic(dt) {
    if (!state.started || state.stars === 0) {
      state.bust = Math.max(0, state.bust - dt);
      return;
    }
    const p = state.player;
    const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
    let near = false;
    for (const car of state.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 62) near = true;
    }
    if (near && playerSpeed < 42) state.bust = Math.min(1, state.bust + dt / 2.4);
    else state.bust = Math.max(0, state.bust - dt * 0.7);
    if (state.bust >= 1) doBusted();
  }

  // --- the step -------------------------------------------------------------

  function step(dt, input) {
    state.time += dt;
    state.events.length = 0;
    state.taxiOffer = null;
    const p = state.player;
    state.punchCd = Math.max(0, state.punchCd - dt);
    state.hurtCd = Math.max(0, state.hurtCd - dt);

    if (state.phone === null && state.phoneQueue.length > 0) {
      const next = state.phoneQueue.shift();
      state.phone = { name: next.name, text: next.text, until: state.time + 5.2 };
    } else if (state.phone !== null && state.time > state.phone.until) {
      state.phone = null;
    }

    if (input.interact) tryInteract();
    if (input.attack) tryPunch();

    if (p.inCar) stepDriving(dt, input);
    else stepFoot(dt, input);

    for (const car of state.cars) {
      car.hitCooldown = Math.max(0, car.hitCooldown - dt);
      if (car.playerDriven) continue;
      if (car.kind === 'traffic') stepTrafficCar(state, car, dt);
      else if (car.kind === 'police') stepPoliceCar(state, car, dt);
    }
    carCollisions();
    if (p.inCar) {
      p.x = p.inCar.x;
      p.y = p.inCar.y;
    }

    // Running people over is very much a crime.
    if (p.inCar && Math.abs(p.inCar.speed) > 60 && state.started) {
      for (const ped of state.peds) {
        if (!ped.active || ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.x, ped.y - p.y) < 26) {
          ped.state = 'down';
          ped.downTimer = 7;
          addHeat(HEAT.hitPed);
          state.events.push('crash');
          burst(ped.x, ped.y, 5);
        }
      }
    }
    // Nearby chaos makes pedestrians run.
    for (const ped of state.peds) {
      if (ped.active && ped.state === 'wander' && state.heat > 0
        && Math.hypot(ped.x - p.x, ped.y - p.y) < 130 && state.stars > 0) {
        ped.state = 'flee';
        ped.fleeTimer = 1.6;
        ped.fleeX = p.x;
        ped.fleeY = p.y;
      }
      stepPed(state, ped, dt);
    }

    policeManagement(dt);
    bustLogic(dt);

    // Heat cools when nobody is watching and the patrols lose the trail.
    if (state.heat > 0) {
      let policeNear = false;
      for (const car of state.cars) {
        if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < HEAT.escapeRadius) policeNear = true;
      }
      if (state.time - state.lastWitnessAt > HEAT.decayDelay && !policeNear) {
        state.heat = Math.max(0, state.heat - HEAT.decayRate * dt);
        state.stars = starsForHeat(state.heat);
      }
    }

    // Cash pickups drift toward Mari on foot and pay out on touch.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      const d = Math.hypot(pickup.x - p.x, pickup.y - p.y);
      if (!p.inCar && d < 96 && d > 1) {
        pickup.x += ((p.x - pickup.x) / d) * 250 * dt;
        pickup.y += ((p.y - pickup.y) / d) * 250 * dt;
      }
      if (d < 26) {
        state.addCash(pickup.amount);
        state.events.push('pickup');
        state.pickups.splice(i, 1);
      }
    }
    for (const shell of state.shells) {
      if (!shell.taken && Math.hypot(shell.x - p.x, shell.y - p.y) < 32) {
        shell.taken = true;
        state.shellsFound += 1;
        state.addCash(SHELL_VALUE);
        state.events.push('shell');
      }
    }

    if (state.started) state.story.update(state, dt);
    state.taxi.update(state, dt);

    for (const skid of state.skids) skid.life -= dt * 0.05;
    state.skids = state.skids.filter((s) => s.life > 0);
    for (const spark of state.sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
    }
    state.sparks = state.sparks.filter((s) => s.life > 0);

    const cam = state.camera;
    const ease = 1 - Math.exp(-5 * dt);
    cam.x += (p.x - cam.x) * ease;
    cam.y += (p.y - cam.y) * ease;
    cam.x = Math.max(VIEW.width / 2 - 80, Math.min(WORLD.width - VIEW.width / 2 + 80, cam.x));
    cam.y = Math.max(VIEW.height / 2 - 80, Math.min(WORLD.height - VIEW.height / 2 + 80, cam.y));

    // Context prompt for the renderer.
    state.prompt = null;
    if (!p.inCar) {
      let nearCar = null;
      let nearDist = PLAYER.enterRange;
      for (const car of state.cars) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < nearDist) {
          nearCar = car;
          nearDist = d;
        }
      }
      if (nearCar && nearCar.kind !== 'police') {
        state.prompt = `E — Get in the ${CAR_MODELS[nearCar.model].label}`;
      }
    } else if (p.inCar.health <= 0) {
      state.prompt = 'This car is wrecked. E — get out and find another.';
    } else if (Math.abs(p.inCar.speed) < 24) {
      state.prompt = state.taxiOffer ? 'A passenger is waiting — stop beside them' : 'E — Exit';
    }
  }

  reset();
  return { state, reset, startRun, saveData, step };
}
