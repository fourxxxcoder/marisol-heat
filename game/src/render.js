// Drawing only: the world state and the current screen go in, pixels come out.
// The camera follows Mari (or her car) through Marisol Bay; the HUD frames the
// view with cash, health, wanted stars, the current objective, a phone message
// and a minimap. Screens — title, pause, busted, wasted, story complete — are
// panels laid over the living city.
import {
  AVENUES_X, BEACH_X, CAR_MODELS, FONT, PALETTE, PIER, STREETS_Y, VIEW, WATER_X, WORLD, starsForHeat,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_FINALE = 'finale';

const MAP = { x: VIEW.width - 252, y: 16, w: 236, h: 170 };

function money(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- the city -----------------------------------------------------------

  function drawGround(state, camX, camY) {
    const city = state.city;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(camX - 40, camY - 40, VIEW.width + 80, VIEW.height + 80);

    // Beach and sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X, 0, WORLD.width - BEACH_X, WORLD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(WATER_X, 0, WORLD.width - WATER_X, WORLD.height);
    ctx.strokeStyle = PALETTE.waterLight;
    ctx.lineWidth = 3;
    for (let y = 30; y < WORLD.height; y += 90) {
      ctx.beginPath();
      for (let x = WATER_X + 8; x < WORLD.width - 6; x += 14) {
        const wy = y + Math.sin(state.time * 1.6 + x * 0.05 + y) * 4;
        if (x === WATER_X + 8) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    // The pier.
    ctx.fillStyle = '#a9805a';
    ctx.fillRect(PIER.x0, PIER.cy - PIER.half, PIER.x1 - PIER.x0, PIER.half * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = PIER.x0 + 16; x < PIER.x1; x += 26) ctx.fillRect(x, PIER.cy - PIER.half, 3, PIER.half * 2);

    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES_X) ctx.fillRect(ax - 55, 0, 110, WORLD.height);
    for (const sy of STREETS_Y) ctx.fillRect(0, sy - 55, WORLD.width, 110);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const ax of AVENUES_X) { ctx.moveTo(ax, 0); ctx.lineTo(ax, WORLD.height); }
    for (const sy of STREETS_Y) { ctx.moveTo(0, sy); ctx.lineTo(BEACH_X + 60, sy); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const ax of AVENUES_X) {
      ctx.moveTo(ax - 53, 0); ctx.lineTo(ax - 53, WORLD.height);
      ctx.moveTo(ax + 53, 0); ctx.lineTo(ax + 53, WORLD.height);
    }
    for (const sy of STREETS_Y) {
      ctx.moveTo(0, sy - 53); ctx.lineTo(BEACH_X + 60, sy - 53);
      ctx.moveTo(0, sy + 53); ctx.lineTo(BEACH_X + 60, sy + 53);
    }
    ctx.stroke();

    // Buildings: a soft shadow, the roof, and a sign where the shop paid for one.
    for (const b of city.buildings) {
      if (b.x + b.w < camX - 30 || b.x > camX + VIEW.width + 30 || b.y + b.h < camY - 30 || b.y > camY + VIEW.height + 30) continue;
      ctx.fillStyle = 'rgba(30,16,28,0.35)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(30,16,28,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x + 8, b.y + 8, Math.max(10, b.w - 60), 12);
      if (b.sign) {
        ctx.textBaseline = 'middle';
        text(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 8, b.w > 170 ? 19 : 15, 'rgba(24,12,20,0.78)', 'center', '700');
      }
    }

    // Place name labels float over the named buildings.
    ctx.textBaseline = 'alphabetic';
    for (const key of Object.keys(city.places)) {
      const place = city.places[key];
      if (!place.rect) continue;
      const cx = place.rect.x + place.rect.w / 2;
      const cy = place.rect.y - 10;
      if (cx < camX - 60 || cx > camX + VIEW.width + 60 || cy < camY - 30 || cy > camY + VIEW.height + 30) continue;
      text(place.name.toUpperCase(), cx, cy, 15, '#fff7e0', 'center', '700');
    }

    // Palms and lamps.
    for (const palm of city.palms) {
      if (palm.x < camX - 40 || palm.x > camX + VIEW.width + 40 || palm.y < camY - 40 || palm.y > camY + VIEW.height + 40) continue;
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 4 * palm.s;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 4, palm.y - 6);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.palmLeaf;
      ctx.lineWidth = 3 * palm.s;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + palm.x * 0.01;
        ctx.beginPath();
        ctx.moveTo(palm.x + 4, palm.y - 6);
        ctx.quadraticCurveTo(
          palm.x + 4 + Math.cos(a) * 13 * palm.s, palm.y - 12 * palm.s,
          palm.x + 4 + Math.cos(a) * 20 * palm.s, palm.y - 2 * palm.s,
        );
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#5a5148';
    for (const lamp of city.lamps) {
      if (lamp.x < camX - 20 || lamp.x > camX + VIEW.width + 20 || lamp.y < camY - 20 || lamp.y > camY + VIEW.height + 20) continue;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBeacon(state) {
    const o = state.objective;
    if (!o || o.x === null || o.x === undefined) return;
    const bob = Math.sin(state.time * 3.2) * 6;
    ctx.fillStyle = 'rgba(255,217,77,0.16)';
    ctx.fillRect(o.x - 17, o.y - 560, 34, 560);
    ctx.fillStyle = PALETTE.beacon;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 26 + Math.sin(state.time * 3.2) * 3, 0, Math.PI * 2);
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - 52 + bob);
    ctx.lineTo(o.x - 13, o.y - 78 + bob);
    ctx.lineTo(o.x + 13, o.y - 78 + bob);
    ctx.closePath();
    ctx.fill();
  }

  function drawCar(car, state) {
    const model = CAR_MODELS[car.model];
    const len = model.length;
    const wid = model.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(20,10,16,0.35)';
    roundRect(-len / 2 + 3, -wid / 2 + 4, len, wid, 7);
    ctx.fill();
    ctx.fillStyle = car.kind === 'police' ? '#f2f2ee' : car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#23232a';
      roundRect(-len / 2 + 4, -wid / 2, 15, wid, 5);
      ctx.fill();
      roundRect(len / 2 - 19, -wid / 2, 15, wid, 5);
      ctx.fill();
      const flash = Math.floor(state.time * 4) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.policeRed : PALETTE.policeBlue;
      roundRect(-8, -wid / 2 + 3, 16, 7, 3);
      ctx.fill();
      ctx.fillStyle = flash ? PALETTE.policeBlue : PALETTE.policeRed;
      roundRect(-8, wid / 2 - 10, 16, 7, 3);
      ctx.fill();
    }
    // Cabin and glass.
    ctx.fillStyle = 'rgba(18,24,34,0.88)';
    roundRect(-9, -wid / 2 + 4, 21, wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,235,0.5)';
    ctx.fillRect(9, -wid / 2 + 5, 4, wid - 10);
    // Wheels.
    ctx.fillStyle = '#17171c';
    ctx.fillRect(-len / 2 + 5, -wid / 2 - 2, 10, 4);
    ctx.fillRect(-len / 2 + 5, wid / 2 - 2, 10, 4);
    ctx.fillRect(len / 2 - 15, -wid / 2 - 2, 10, 4);
    ctx.fillRect(len / 2 - 15, wid / 2 - 2, 10, 4);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
    if (car.marked) {
      ctx.strokeStyle = PALETTE.beacon;
      ctx.lineWidth = 2.5;
      roundRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 9);
      ctx.stroke();
    }
    if (car.health < 45) {
      ctx.fillStyle = `rgba(60,60,60,${0.25 + 0.2 * Math.sin(state.time * 9)})`;
      ctx.beginPath();
      ctx.arc(-len / 2 + 6, 0, 8 + (state.time * 13) % 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ped, state) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      roundRect(-11, -6, 22, 12, 6);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(14, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(20,10,16,0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(3, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (ped.isTaxi && ped.state === 'wait') {
      const bob = Math.sin(state.time * 4) * 3;
      ctx.fillStyle = '#ff8c42';
      roundRect(ped.x - 11, ped.y - 40 + bob, 22, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#241423';
      ctx.textBaseline = 'middle';
      text('TAXI', ped.x, ped.y - 30 + bob, 10, '#241423', 'center', '800');
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(20,10,16,0.35)';
    ctx.beginPath();
    ctx.arc(2, 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(4, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241423';
    ctx.fillRect(8, -5, 4, 10);
    ctx.restore();
    // A soft ring so Mari is never lost in a crowd.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16 + Math.sin(state.time * 3) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- HUD ------------------------------------------------------------------

  function drawMinimap(state) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(16,20,28,0.88)';
    roundRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,77,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(MAP.x, MAP.y, MAP.w, MAP.h);
    ctx.clip();
    ctx.fillStyle = '#565d63';
    ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(MAP.x + BEACH_X * sx, MAP.y, (WORLD.width - BEACH_X) * sx, MAP.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(MAP.x + WATER_X * sx, MAP.y, (WORLD.width - WATER_X) * sx, MAP.h);
    ctx.strokeStyle = '#2e3138';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const ax of AVENUES_X) { ctx.moveTo(MAP.x + ax * sx, MAP.y); ctx.lineTo(MAP.x + ax * sx, MAP.y + MAP.h); }
    for (const sy2 of STREETS_Y) { ctx.moveTo(MAP.x, MAP.y + sy2 * sy); ctx.lineTo(MAP.x + MAP.w, MAP.y + sy2 * sy); }
    ctx.stroke();
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(MAP.x + x * sx, MAP.y + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const shell of state.shells) if (!shell.taken) dot(shell.x, shell.y, '#ffe9a8', 1.6);
    for (const car of state.cars) {
      if (car.kind === 'police') dot(car.x, car.y, Math.floor(state.time * 4) % 2 ? '#e83a3a' : '#5b83ff', 3);
    }
    if (state.taxiDest) dot(state.taxiDest.x, state.taxiDest.y, '#ff8c42', 3.5);
    else if (state.taxiOffer) dot(state.taxiOffer.x, state.taxiOffer.y, '#ff8c42', 3);
    const o = state.objective;
    if (o && o.x !== null && o.x !== undefined) dot(o.x, o.y, PALETTE.beacon, 4);
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(MAP.x + p.x * sx, MAP.y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.textBaseline = 'top';
    text('MARISOL BAY', MAP.x + MAP.w / 2, MAP.y + MAP.h + 10, 12, PALETTE.muted, 'center', '700');
  }

  function drawHud(state) {
    const p = state.player;
    ctx.textBaseline = 'top';
    // Cash and shells, top-left.
    ctx.fillStyle = PALETTE.panel;
    roundRect(14, 14, 218, 64, 9);
    ctx.fill();
    text(money(p.cash), 28, 22, 27, '#7be495', 'left', '800');
    text(`Shells ${state.shellsFound}/20`, 28, 54, 14, PALETTE.muted, 'left', '600');
    // Health bar under the cash panel.
    ctx.fillStyle = PALETTE.healthBack;
    roundRect(14, 86, 218, 13, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.health;
    if (p.health > 0) {
      roundRect(14, 86, Math.max(10, 218 * (p.health / 100)), 13, 6);
      ctx.fill();
    }
    // Wanted stars, top-centre.
    const stars = starsForHeat(state.heat);
    ctx.textBaseline = 'top';
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width / 2 - 78 + i * 38, 12, 34, i < stars ? '#ffd94d' : 'rgba(255,255,255,0.22)', 'left', '800');
    }
    if (state.bust > 0.02 && stars > 0) {
      ctx.fillStyle = 'rgba(20,12,24,0.7)';
      roundRect(VIEW.width / 2 - 70, 54, 140, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#e83a3a';
      roundRect(VIEW.width / 2 - 70, 54, 140 * state.bust, 12, 6);
      ctx.fill();
      text('BUSTED?', VIEW.width / 2, 70, 13, '#ff7b7b', 'center', '800');
    }
    drawMinimap(state);
    // Objective, bottom-left.
    if (state.objective) {
      ctx.fillStyle = PALETTE.panel;
      const label = state.objective.text;
      roundRect(14, VIEW.height - 58, Math.min(560, 26 + label.length * 8.4), 44, 9);
      ctx.fill();
      ctx.fillStyle = PALETTE.beacon;
      ctx.fillRect(14, VIEW.height - 58, 5, 44);
      text(label, 30, VIEW.height - 47, 17, PALETTE.text, 'left', '600');
    }
    // Speed and car health, bottom-right, while driving.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.62);
      text(`${kmh} km/h`, VIEW.width - 24, VIEW.height - 62, 30, PALETTE.text, 'right', '800');
      text(CAR_MODELS[p.inCar.model].label, VIEW.width - 24, VIEW.height - 88, 14, PALETTE.muted, 'right', '600');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(VIEW.width - 174, VIEW.height - 30, 150, 9, 4);
      ctx.fill();
      ctx.fillStyle = p.inCar.health > 35 ? '#7be495' : '#e83a3a';
      if (p.inCar.health > 0) {
        roundRect(VIEW.width - 174, VIEW.height - 30, 150 * (p.inCar.health / 100), 9, 4);
        ctx.fill();
      }
    }
    // Context prompt, bottom-centre.
    if (state.prompt) {
      ctx.fillStyle = 'rgba(20,12,24,0.75)';
      const w = 30 + state.prompt.length * 8.2;
      roundRect(VIEW.width / 2 - w / 2, VIEW.height - 104, w, 34, 8);
      ctx.fill();
      text(state.prompt, VIEW.width / 2, VIEW.height - 96, 16, '#ffe9a8', 'center', '600');
    }
    // Phone toast, top-centre under the stars.
    if (state.phone) {
      const msg = state.phone;
      const w = Math.min(620, 90 + Math.max(msg.name.length * 8, msg.text.length * 7.4));
      ctx.fillStyle = 'rgba(24,18,32,0.92)';
      roundRect(VIEW.width / 2 - w / 2, 96, w, 58, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,217,77,0.6)';
      ctx.lineWidth = 1.5;
      roundRect(VIEW.width / 2 - w / 2, 96, w, 58, 10);
      ctx.stroke();
      text(`📱 ${msg.name}`, VIEW.width / 2 - w / 2 + 14, 103, 13, PALETTE.beacon, 'left', '800');
      text(msg.text, VIEW.width / 2 - w / 2 + 14, 122, 15, PALETTE.text, 'left', '500');
    }
    ctx.textBaseline = 'alphabetic';
  }

  // --- screens ----------------------------------------------------------------

  function dim(alpha) {
    ctx.fillStyle = `rgba(16,8,18,${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function panel(title, titleColor, lines, prompt) {
    const w = 680;
    const h = 150 + lines.length * 30 + 60;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 14);
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 44, titleColor, 'center', '800');
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 122 + i * 30, 18, PALETTE.muted, 'center', '500');
    });
    text(prompt, VIEW.width / 2, y + h - 26, 19, '#ffe9a8', 'center', '700');
  }

  function drawTitle(state, hasSave) {
    dim(0.45);
    const cx = VIEW.width / 2;
    ctx.textBaseline = 'alphabetic';
    const grad = ctx.createLinearGradient(0, 150, 0, 260);
    grad.addColorStop(0, '#ffd94d');
    grad.addColorStop(0.55, '#ff8c42');
    grad.addColorStop(1, '#ff5d8f');
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = grad;
    ctx.textAlign = 'center';
    ctx.fillText('MARISOL HEAT', cx, 238);
    text('An open-world homecoming in Marisol Bay, Verano', cx, 282, 21, '#fdf6ec', 'center', '600');
    text('Mari Solano is back in town — and the town owes her.', cx, 314, 17, PALETTE.muted, 'center', '500');
    const lines = hasSave
      ? ['ENTER — New game', 'C — Continue your saved game']
      : ['ENTER — New game'];
    lines.forEach((line, i) => text(line, cx, 386 + i * 34, 22, '#ffe9a8', 'center', '700'));
    const controls = [
      'WASD / arrows — move & drive      SHIFT — run',
      'E — enter / exit car      F — punch      P — pause      M — mute',
      'Run Valentina\u2019s jobs, work taxi fares, find 20 shells.',
      'Mind the stars: the MBPD always answers.',
    ];
    controls.forEach((line, i) => text(line, cx, 500 + i * 27, 16, PALETTE.muted, 'center', '500'));
  }

  /** Paint one frame: the city from the camera, then the HUD or a screen panel. */
  function draw(state, screen, opts) {
    const options = opts || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    const camX = state.camera.x - VIEW.width / 2;
    const camY = state.camera.y - VIEW.height / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();
    ctx.translate(-camX, -camY);
    drawGround(state, camX, camY);
    drawBeacon(state);
    // Skid marks under everything that moves.
    ctx.fillStyle = 'rgba(22,20,24,0.5)';
    for (const skid of state.skids) ctx.fillRect(skid.x - 3, skid.y - 3, 6, 6);
    for (const shell of state.shells) {
      if (shell.taken) continue;
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(shell.x, shell.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shell.x, shell.y, 4, 0.4, Math.PI * 1.5);
      ctx.stroke();
    }
    for (const pickup of state.pickups) {
      ctx.fillStyle = PALETTE.cash;
      roundRect(pickup.x - 9, pickup.y - 6, 18, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.textBaseline = 'middle';
      text('$', pickup.x, pickup.y + 1, 11, '#14532d', 'center', '800');
      ctx.textBaseline = 'alphabetic';
    }
    for (const ped of state.peds) if (ped.active) drawPed(ped, state);
    for (const car of state.cars) drawCar(car, state);
    drawPlayer(state);
    ctx.fillStyle = '#ffd94d';
    for (const spark of state.sparks) ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
    ctx.restore();

    if (state.tint === 'sunset') {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
      grad.addColorStop(0, 'rgba(255,120,60,0.13)');
      grad.addColorStop(1, 'rgba(120,30,90,0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (screen === SCREEN_TITLE) {
      drawTitle(state, !!options.hasSave);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      dim(0.5);
      panel('Paused', PALETTE.text, ['Marisol Bay waits for no one — except now.'], 'P or ENTER — back to the streets');
    } else if (screen === SCREEN_BUSTED) {
      dim(0.55);
      panel('BUSTED', '#ff7b7b', ['The MBPD thanks you for your donation.', 'Your heat is gone. Your dignity is recoverable.'], 'ENTER — walk out of the station');
    } else if (screen === SCREEN_WASTED) {
      dim(0.55);
      panel('WASTED', '#ff7b7b', ['You wake up smelling of antiseptic and salt air.', 'The hospital kept the change.'], 'ENTER — back to the streets');
    } else if (screen === SCREEN_FINALE) {
      dim(0.5);
      panel('STORY COMPLETE', '#ffd94d', [
        'The lighthouse light sweeps the bay. Valentina\u2019s debt is paid.',
        `Cash earned: ${money(state.player.cash)} · Shells found: ${state.shellsFound}/20`,
        'Marisol Bay is yours now — taxis, shells and trouble remain.',
      ], 'ENTER — free roam');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
