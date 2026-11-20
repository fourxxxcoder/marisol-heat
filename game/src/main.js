// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens — title, play, paused, busted, wasted and the
// story-complete card — are decided here; the world itself knows nothing of
// them, it only reports events, and this file turns events into sound and
// screen changes.
//
// ?seed=N fixes the city layout. ?shot=cover|chase|mission|drive (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { createInput, idleInput } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_FINALE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || !Number.isFinite(data.cash)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let noticeUntil = 0;
  let saveTimer = 0;
  let lastObjective = '';

  function announce(message) {
    status.textContent = message;
  }

  function playEvent(event) {
    if (event === 'pickup') audio.pickup();
    else if (event === 'shell') audio.shell();
    else if (event === 'punch') audio.punch();
    else if (event === 'crash') audio.crash(0.6);
    else if (event === 'crime') audio.crime();
    else if (event === 'phone') audio.phone();
    else if (event === 'mission') audio.success();
    else if (event === 'fail') audio.fail();
    else if (event === 'door') audio.door();
    else if (event === 'busted') audio.busted();
    else if (event === 'wasted') audio.wasted();
    else if (event === 'finale') audio.success();
  }

  function reactToEvents() {
    for (const event of world.state.events) {
      playEvent(event);
      if (event === 'busted') {
        screen = SCREEN_BUSTED;
        noticeUntil = performance.now() + 2400;
        writeSave();
        announce('Busted. The police take a fine and let you walk.');
      } else if (event === 'wasted') {
        screen = SCREEN_WASTED;
        noticeUntil = performance.now() + 2400;
        writeSave();
        announce('Wasted. You wake up at the hospital.');
      } else if (event === 'finale') {
        screen = SCREEN_FINALE;
        writeSave();
        announce('Story complete. Marisol Bay is yours.');
      } else if (event === 'mission') {
        writeSave();
      }
    }
  }

  function startRun(withSave) {
    audio.unlock();
    world.startRun(withSave);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(withSave ? 'Welcome back to Marisol Bay.' : 'Marisol Heat. Run Valentina\u2019s jobs and mind the stars.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const inp = input.frame();
    if (inp.confirm || inp.interact || inp.continueSave) audio.unlock();
    if (inp.mute) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }

    // Screen-level keys.
    if (screen === SCREEN_TITLE) {
      if (inp.confirm) startRun(null);
      else if (inp.continueSave && save) startRun(save);
    } else if (screen === SCREEN_PLAY) {
      if (inp.pause) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (inp.pause || inp.confirm) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (inp.confirm || now > noticeUntil) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_FINALE) {
      if (inp.confirm) screen = SCREEN_PLAY;
    }

    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (screen === SCREEN_TITLE) {
      const idle = idleInput();
      while (accumulator >= STEP) {
        world.step(STEP, idle);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const stepInput = first ? inp : { ...inp, interact: false, attack: false };
        first = false;
        world.step(STEP, stepInput);
        reactToEvents();
        accumulator -= STEP;
      }
      saveTimer += Math.min((now - last) / 1000 + STEP, 0.05);
      if (saveTimer > 5) {
        saveTimer = 0;
        if (world.state.started) writeSave();
        save = readSave();
      }
      const objective = world.state.objective ? world.state.objective.text : '';
      if (objective !== lastObjective) {
        lastObjective = objective;
        if (objective) announce(objective);
      }
    } else {
      accumulator = 0;
    }

    const p = world.state.player;
    const driving = !!(p.inCar && screen === SCREEN_PLAY);
    const ratio = p.inCar ? Math.abs(p.inCar.speed) / 336 : 0;
    audio.setLoops(driving, Math.min(1, ratio), world.state.stars > 0 && screen === SCREEN_PLAY);
    renderer.draw(world.state, screen, { hasSave: !!save });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Marisol Heat. Press Enter for a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
