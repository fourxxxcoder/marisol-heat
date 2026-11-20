// The story of Marisol Heat: five jobs Valentina Cruz hands Mari Solano from the
// Club Coral, told through phone messages and a gold beacon on the map. The
// runner below is a small state machine — each mission is a list of steps, and
// a step is done when the player reaches a point, takes a car, or shakes the
// police. Taxi fares live here too: the city's other honest living.

export const MISSION_NAMES = [
  'First Wheels', 'Marina Run', 'Neon Debts', 'Lose the Heat', 'Lighthouse Finale',
];

export const MISSION_REWARDS = [300, 450, 600, 750, 1000];

const ENVELOPES = [
  { x: 1612, y: 288 },
  { x: 2820, y: 2062 },
  { x: 880, y: 1520 },
];

const INTROS = [
  'Mari. You came home. The club needs a car moved — come see me. — V',
  'A package is waiting at the Marina. No questions, quick hands. — V',
  'Three friends owe the club. Envelopes, on my desk, tonight. — V',
  'Mari, the whole bay is looking for you. Lose them. Then hide. — V',
  'Last job, Mari. The lighthouse. Make it count and the debt is gone. — V',
];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createStory() {
  const story = {
    index: 0,
    step: 0,
    timer: null,
    begun: false,
    done: false,

    /** Run a mission's opening beat (scripted heat, timers) exactly once. */
    begin(state) {
      story.begun = true;
      story.step = 0;
      story.timer = null;
      state.toast('Valentina Cruz', INTROS[story.index]);
      if (story.index === 2) story.timer = 240;
      if (story.index === 3) state.setHeat(82);
      if (story.index === 4) {
        state.setHeat(55);
        story.timer = 150;
      }
    },

    fail(state, why) {
      state.events.push('fail');
      state.toast('Valentina Cruz', why);
      story.step = 0;
      story.timer = story.index === 2 ? 240 : story.index === 4 ? 150 : null;
      if (story.index === 4) state.setHeat(55);
    },

    complete(state) {
      const reward = MISSION_REWARDS[story.index];
      state.addCash(reward);
      state.events.push('mission');
      state.toast('Valentina Cruz', `Done, Mari. $${reward} is yours.`);
      story.index += 1;
      story.begun = false;
      story.timer = null;
      if (story.index >= MISSION_NAMES.length) {
        story.done = true;
        state.storyDone = true;
        state.events.push('finale');
      }
    },

    update(state, dt) {
      if (story.done) return;
      if (!story.begun) story.begin(state);
      const places = state.city.places;
      const p = state.player;

      if (story.timer !== null) {
        story.timer -= dt;
        if (story.timer <= 0) {
          story.fail(state, story.index === 2
            ? 'Too slow — the debtors scattered. Start the round again.'
            : 'The moment passed, Mari. Try the run again.');
          return;
        }
      }

      const at = (point, r) => dist(p.x, p.y, point.x, point.y) < r;

      if (story.index === 0) {
        if (story.step === 0) {
          state.objective = { text: 'Meet Valentina at Club Coral', x: places.club.door.x, y: places.club.door.y };
          if (at(places.club.door, 62)) {
            state.toast('Valentina Cruz', 'The magenta coupe outside. Bring it round to my garage.');
            story.step = 1;
          }
        } else if (story.step === 1) {
          const car = state.markedCar;
          state.objective = { text: 'Steal the magenta Vireo Coupe', x: car.x, y: car.y };
          if (p.inCar === car) {
            state.toast('Valentina Cruz', 'Good. Now the garage, behind the club.');
            story.step = 2;
          }
        } else {
          state.objective = { text: 'Deliver the coupe to the club garage', x: places.club.garage.x, y: places.club.garage.y };
          if (p.inCar === state.markedCar && at(places.club.garage, 88)) story.complete(state);
        }
      } else if (story.index === 1) {
        if (story.step === 0) {
          state.objective = { text: 'Pick up the package at the Marina', x: places.marina.pickup.x, y: places.marina.pickup.y };
          if (at(places.marina.pickup, 84)) {
            state.setHeat(38);
            state.toast('Dockhand', 'No names. Drive it to the Hotel Aurelia, and shake the patrol first if you can.');
            story.step = 1;
          }
        } else {
          state.objective = { text: 'Deliver the package to Hotel Aurelia', x: places.hotel.door.x, y: places.hotel.door.y };
          if (at(places.hotel.door, 92)) story.complete(state);
        }
      } else if (story.index === 2) {
        const spot = ENVELOPES[story.step];
        state.objective = {
          text: `Collect debt envelope ${story.step + 1} of 3 — ${Math.max(0, Math.ceil(story.timer))}s left`,
          x: spot.x, y: spot.y,
        };
        if (at(spot, 58)) {
          state.addCash(40);
          state.events.push('pickup');
          story.step += 1;
          if (story.step >= ENVELOPES.length) story.complete(state);
          else state.toast('Valentina Cruz', 'One down. Keep moving, Mari.');
        }
      } else if (story.index === 3) {
        if (story.step === 0) {
          state.objective = { text: 'Lose the police — get your stars to zero', x: null, y: null };
          if (state.stars === 0) {
            state.toast('Valentina Cruz', 'Clean. Now get to the hideout, north-west corner.');
            story.step = 1;
          }
        } else {
          state.objective = { text: 'Reach the hideout', x: places.hideout.point.x, y: places.hideout.point.y };
          if (at(places.hideout.point, 84)) story.complete(state);
        }
      } else if (story.index === 4) {
        state.objective = {
          text: `Reach the Lighthouse — ${Math.max(0, Math.ceil(story.timer))}s left`,
          x: places.lighthouse.point.x, y: places.lighthouse.point.y,
        };
        if (at(places.lighthouse.point, 96)) story.complete(state);
      }
    },
  };
  return story;
}

/**
 * Taxi work: a waiting pedestrian flags the player down; stop beside them in a
 * car and they board, naming a destination. Fares pay by the trip's length.
 */
export function createTaxi() {
  const taxi = {
    phase: 'idle',
    timer: 6,
    ped: null,
    dest: null,
    fare: 0,

    update(state, dt) {
      const p = state.player;
      if (taxi.phase === 'idle') {
        taxi.timer -= dt;
        if (taxi.timer <= 0 && state.started) {
          const point = state.rng.pick(state.city.sidewalkPoints);
          taxi.ped = state.spawnTaxiPed(point);
          taxi.phase = 'offer';
        }
        return;
      }
      if (taxi.phase === 'offer') {
        const ped = taxi.ped;
        if (!ped || !ped.active) {
          taxi.phase = 'idle';
          taxi.timer = 18;
          taxi.ped = null;
          return;
        }
        state.taxiOffer = { x: ped.x, y: ped.y };
        if (p.inCar && Math.abs(p.inCar.speed) < 26 && dist(p.x, p.y, ped.x, ped.y) < 54) {
          const spots = [
            state.city.places.hotel.door, state.city.places.marina.door,
            state.city.places.club.door, state.city.places.garage.door,
            state.city.places.police.door, state.city.places.hospital.door,
          ];
          taxi.dest = state.rng.pick(spots);
          taxi.fare = 70 + Math.round(dist(ped.x, ped.y, taxi.dest.x, taxi.dest.y) / 22);
          ped.active = false;
          taxi.phase = 'riding';
          state.toast('Passenger', 'Thanks! Take me across town — fare is on the meter.');
          state.events.push('phone');
        }
        return;
      }
      // riding
      state.taxiDest = { x: taxi.dest.x, y: taxi.dest.y };
      if (p.inCar && Math.abs(p.inCar.speed) < 30 && dist(p.x, p.y, taxi.dest.x, taxi.dest.y) < 92) {
        state.addCash(taxi.fare);
        state.events.push('mission');
        state.toast('Passenger', `Here is $${taxi.fare}. Five stars, friend.`);
        taxi.phase = 'idle';
        taxi.timer = state.rng.range(16, 28);
        taxi.dest = null;
        state.taxiDest = null;
      }
    },
  };
  return taxi;
}
