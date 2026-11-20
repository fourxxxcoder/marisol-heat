// Keyboard and pointer input. Held keys give smooth movement (walking on foot,
// throttle and steering in a car); one-shot presses — interact, attack, pause,
// confirm, mute — are latched as edge flags and handed over exactly once by
// frame(), so a press between two frames is never lost and never counted twice.
// The object frame() returns is the only thing the world ever sees, which is
// what lets the screenshot scenes drive the same world with scripted inputs.

const HELD = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};

const EDGES = {
  interact: ['KeyE'],
  attack: ['KeyF'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Space', 'Enter'],
  mute: ['KeyM'],
  continueSave: ['KeyC'],
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  const edges = { interact: false, attack: false, pause: false, confirm: false, mute: false, continueSave: false };
  const codeToHeld = new Map();
  const codeToEdge = new Map();
  for (const [name, codes] of Object.entries(HELD)) for (const code of codes) codeToHeld.set(code, name);
  for (const [name, codes] of Object.entries(EDGES)) for (const code of codes) codeToEdge.set(code, name);

  window.addEventListener('keydown', (event) => {
    const heldName = codeToHeld.get(event.code);
    if (heldName) {
      held[heldName] = true;
      event.preventDefault();
      return;
    }
    const edgeName = codeToEdge.get(event.code);
    if (edgeName) {
      if (!event.repeat) edges[edgeName] = true;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const heldName = codeToHeld.get(event.code);
    if (heldName) held[heldName] = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    for (const name of Object.keys(held)) held[name] = false;
  });
  target.addEventListener('pointerdown', () => {
    edges.confirm = true;
  });

  return {
    /**
     * The input for one fixed step: movement axes in -1..1, the throttle and
     * steering a car reads from the same keys, and this step's one-shot presses.
     */
    frame() {
      const moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const moveY = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const out = {
        moveX,
        moveY,
        run: held.run,
        throttle: -moveY,
        steer: moveX,
        interact: edges.interact,
        attack: edges.attack,
        pause: edges.pause,
        confirm: edges.confirm,
        mute: edges.mute,
        continueSave: edges.continueSave,
      };
      for (const name of Object.keys(edges)) edges[name] = false;
      return out;
    },
  };
}

/** A silent input with every field at rest, for ambient scenes and tests. */
export function idleInput() {
  return {
    moveX: 0, moveY: 0, run: false, throttle: 0, steer: 0,
    interact: false, attack: false, pause: false, confirm: false, mute: false, continueSave: false,
  };
}
