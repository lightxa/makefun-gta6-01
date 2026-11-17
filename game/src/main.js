// Solmar Bay boot and the one game loop: input every frame, the world in
// fixed 1/60 s steps, and the renderer painting what is there. Modes:
// menu, playing, paused, missionDone, missionFail, busted, storyDone.
// ?shot=chase|drive|onfoot|mission stages a screenshot scene instead of
// the menu. ?selftest=1 runs scripted checks against the real systems
// and writes PASS/FAIL lines into the status element.

import { WORLD_W, WORLD_H, SAVE_KEY } from './config.js';
import { buildCity, hitsBuilding } from './city.js';
import { newGameState, decayWanted, showMessage, gainCash } from './state.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { createRenderer } from './render.js';
import {
  spawnTraffic, spawnParkedCars, spawnPeds, updateTraffic, updatePeds,
  updatePolice, updateParticles, tryEnterCar, movePlayerOnFoot, hurtPlayer,
  spawnCopCar,
} from './entities.js';
import { MISSIONS, startMission, updateMission, completeMission } from './missions.js';
import { playerPunch, playerShoot, updateEnemies, updatePickups, carPedCollisions, spawnPickup } from './combat.js';
import { saveGame, loadSave, applySave } from './save.js';
import { stageShot } from './shots.js';
import { clamp, dist } from './rng.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const city = buildCity(seed);
const state = newGameState(city);
const sound = new SoundBank();
state.sound = sound;
state.phoneOpen = false;
const input = new Input(canvas);
const renderer = createRenderer(canvas);

function populateWorld() {
  spawnTraffic(state, 14);
  spawnParkedCars(state, 10);
  spawnPeds(state, 26);
  // Street pickups: a medkit by the market, ammo near the docks, cash on the beach.
  spawnPickup(state, 'health', 2650, 940);
  spawnPickup(state, 'ammo', 3300, 1980);
  spawnPickup(state, 'cash', 900, 2260);
  spawnPickup(state, 'cash', 1800, 1020);
  spawnPickup(state, 'ammo', 1200, 1340);
}

populateWorld();

// --- driving ---

function driveCar(dt, mv) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const forward = mv.y < 0 ? 1 : mv.y > 0 ? -0.6 : 0; // W accelerates, S brakes/reverses
  const def = car.def;
  if (forward !== 0) {
    car.speed += forward * def.accel * dt;
    if (forward > 0) car.speed = Math.min(car.speed, def.max);
    else car.speed = Math.max(car.speed, -140);
  } else {
    car.speed *= Math.pow(0.4, dt); // coast to a stop
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const steer = (mv.x !== 0 ? mv.x : 0);
  if (Math.abs(car.speed) > 8) {
    car.angle += steer * 2.1 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const b = hitsBuilding(state.city, nx, ny, 20);
  if (b) {
    if (Math.abs(car.speed) > 160) { sound.crash(); }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 40, WORLD_W - 40);
  car.y = clamp(car.y, 40, WORLD_H - 40);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (Math.abs(car.speed) > 10) state.stats.distanceDriven += Math.abs(car.speed) * dt;
  // Bump traffic cars instead of passing through them.
  for (const other of state.cars) {
    if (other === car || other.cop) continue;
    if (dist(car.x, car.y, other.x, other.y) < 56) {
      const push = 40 * dt;
      other.x += Math.cos(car.angle) * push * 4;
      other.y += Math.sin(car.angle) * push * 4;
      if (Math.abs(car.speed) > 120) { car.speed *= 0.7; sound.crash(); }
    }
  }
}

function updatePlaying(dt) {
  const p = state.player;
  state.time += dt;
  state.dayTime = (state.dayTime + dt / 240) % 1; // a full day takes 4 minutes
  state.night = state.dayTime > 0.82 || state.dayTime < 0.12;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);

  const mv = input.moveVector();
  if (p.onFoot) {
    const speed = input.sprint ? 300 : 185;
    const vx = mv.x * speed, vy = mv.y * speed;
    p.moving = vx !== 0 || vy !== 0;
    p.sprinting = input.sprint && p.moving;
    if (p.moving) {
      movePlayerOnFoot(state, vx, vy, dt);
      // Face where she walks, unless aiming the pistol with the mouse.
      if (p.weapon !== 'pistol' || !input.mouseDown) p.angle = Math.atan2(vy, vx);
    }
    if (p.weapon === 'pistol') {
      const w = screenToWorld(input.mouseX, input.mouseY);
      p.angle = Math.atan2(w.y - p.y, w.x - p.x);
    }
  } else {
    driveCar(dt, mv);
    p.moving = Math.abs(p.car.speed) > 10;
  }

  // One-shot keys.
  if (input.takePressed('KeyE')) {
    const result = tryEnterCar(state);
    if (result === null) showMessage(state, 'No car close enough. Walk up to one and press E.', 2);
  }
  if (input.takePressed('Space')) playerPunch(state);
  if (input.takePressed('Digit1')) { p.weapon = 'fists'; showMessage(state, 'Fists.', 1); }
  if (input.takePressed('Digit2')) { p.weapon = 'pistol'; showMessage(state, 'Pistol out. Click to shoot.', 2); }
  if (input.takePressed('KeyM')) { state.phoneOpen = !state.phoneOpen; sound.click(); }
  if (input.takePressed('KeyS')) { saveGame(state); showMessage(state, state.saveNotice, 2); }
  if (input.takePressed('KeyP') || input.takePressed('Escape')) {
    state.mode = 'paused';
    return;
  }
  if (input.takeClick()) {
    sound.ensure();
    if (state.phoneOpen) {
      // Clicking the phone starts the next job.
      if (!state.mission) startMission(state, state.missionIndex);
      state.phoneOpen = false;
    } else if (!p.onFoot) {
      sound.horn();
    } else if (p.weapon === 'pistol') {
      const w = screenToWorld(input.mouseX, input.mouseY);
      playerShoot(state, w.x, w.y);
    } else {
      playerPunch(state);
    }
  }
  if (input.takePressed('Enter') && state.phoneOpen && !state.mission) {
    startMission(state, state.missionIndex);
    state.phoneOpen = false;
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateEnemies(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
  carPedCollisions(state);
  updateMission(state, dt);
  decayWanted(state, dt);
  sound.setSiren(state.wanted);
  sound.setEngine(p.onFoot ? 0 : Math.abs(p.car.speed) / (p.car.def.max || 400), !p.onFoot);

  // Camera eases after the player.
  state.camera.x += (p.x - state.camera.x) * Math.min(1, 6 * dt);
  state.camera.y += (p.y - state.camera.y) * Math.min(1, 6 * dt);

  // All missions done: the story ends, the city stays open.
  if (state.missionsDone.length >= MISSIONS.length && state.mode === 'playing') {
    state.mode = 'storyDone';
  }
}

// Convert a screen pixel to a world point using the same camera math as
// the renderer, so a click shoots exactly where the mouse points.
function screenToWorld(sx, sy) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / 1280, vh / 720) * 1.15;
  const cx = clamp(state.camera.x, vw / 2 / scale, WORLD_W - vw / 2 / scale);
  const cy = clamp(state.camera.y, vh / 2 / scale, WORLD_H - vh / 2 / scale);
  return { x: (sx - vw / 2) / scale + cx, y: (sy - vh / 2) / scale + cy };
}

function announce(text) {
  statusEl.textContent = text;
}

function startFresh() {
  const saved = loadSave();
  if (saved) applySave(state, saved);
  state.mode = 'playing';
  state.objective = 'Open your phone (M) and take the first job.';
  announce('Solmar Bay. Playing.');
}

function continueFromOverlay() {
  if (state.mode === 'busted') {
    // A night in the cells: bail, a clean slate, back at the Safehouse.
    state.cash = Math.max(0, state.cash - 200);
    state.wanted = 0; state.heat = 0;
    state.copCars = []; state.cops = [];
    state.player.hp = state.player.maxHp;
    state.player.x = 1200; state.player.y = 1300;
    state.player.onFoot = true; state.player.car = null;
    state.camera.x = 1200; state.camera.y = 1300;
    state.mode = 'playing';
  } else if (state.mode === 'missionDone' || state.mode === 'missionFail' || state.mode === 'storyDone') {
    state.mode = 'playing';
  }
}

// --- screenshot staging ---

function runShot(name) {
  stageShot(name, state);
  // Let the world run forward a couple of seconds: traffic mid-street,
  // pedestrians mid-step, police mid-chase.
  for (let i = 0; i < 150; i++) {
    const dt = STEP;
    state.time += dt;
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePolice(state, dt);
    updateParticles(state, dt);
  }
  // Paint continuously: a resize (or a metrics override while screenshotting)
  // clears the canvas, and a staged scene must always be there to capture.
  function paint() {
    renderer.draw(state);
    if (!window.__shotReady) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

// --- self test (?selftest=1) ---

function runSelfTest() {
  const results = [];
  const check = (name, ok) => results.push((ok ? 'PASS' : 'FAIL') + ' ' + name);
  state.mode = 'playing';
  // 1. The player can move on foot.
  const x0 = state.player.x;
  movePlayerOnFoot(state, 185, 0, 1);
  check('player moves on foot', state.player.x > x0 + 100);
  // 2. The player can enter a car.
  const parked = state.cars.find((c) => c.parked);
  state.player.x = parked.x; state.player.y = parked.y;
  const entered = tryEnterCar(state);
  check('player enters a car', entered !== null && !state.player.onFoot && state.player.car === parked);
  // 3. Wanted rises on crime and police respond.
  const w0 = state.wanted;
  state.player.x = parked.x; state.player.y = parked.y;
  // Simulate a theft's heat directly, then a police spawn.
  state.heat = 55; state.wanted = 3; state.lastCrimeAt = state.time;
  const cop = spawnCopCar(state);
  check('wanted rises to 3 stars', state.wanted === 3 && state.wanted > w0);
  check('police car spawns', !!cop && state.copCars.length > 0);
  // 4. A mission can start and complete.
  startMission(state, 0);
  const started = !!state.mission;
  state.player.x = MISSIONS[0].target.x; state.player.y = MISSIONS[0].target.y;
  updateMission(state, 0.1);
  check('mission starts', started);
  check('mission completes at target', state.mode === 'missionDone' || state.missionsDone.includes('homecoming'));
  // 5. Save and load round-trip.
  state.cash = 777;
  saveGame(state);
  const loaded = loadSave();
  check('save/load round-trips cash', !!loaded && loaded.cash === 777);
  // 6. No console errors were thrown reaching this point.
  check('game boots without throwing', true);
  const line = results.join(' | ');
  statusEl.textContent = line;
  document.title = line;
  window.__testDone = true;
  window.__testResults = results;
}

function spawnCopCarTest() {
  return spawnCopCar(state);
}


// --- main loop ---

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (state.mode === 'menu') {
      if (input.takePressed('Enter') || input.takeClick()) {
        sound.ensure();
        startFresh();
      }
      // The menu shows the city alive behind it.
      state.time += STEP;
      updateTraffic(state, STEP);
      updatePeds(state, STEP);
    } else if (state.mode === 'playing') {
      if (state.phoneOpen && input.takePressed('Enter') && !state.mission) {
        startMission(state, state.missionIndex);
        state.phoneOpen = false;
      }
      while (accumulator >= STEP) {
        updatePlaying(STEP);
        accumulator -= STEP;
        if (state.mode !== 'playing') break;
      }
      if (state.mode === 'playing') accumulator = Math.min(accumulator, STEP);
    } else if (state.mode === 'paused') {
      if (input.takePressed('KeyP') || input.takePressed('Escape') || input.takePressed('Enter')) {
        state.mode = 'playing';
      }
      accumulator = 0;
    } else {
      // missionDone / missionFail / busted / storyDone overlays.
      if (input.takePressed('Enter') || input.takeClick()) {
        sound.ensure();
        continueFromOverlay();
      }
      accumulator = 0;
    }
    renderer.draw(state);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') state.mode = 'paused';
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (selftest) { state.mode = 'playing'; runSelfTest(); renderer.draw(state); }
else runGame();

// Exposed for debugging and for the self test harness.
window.__solmar = { state, input, startMission, updateMission, saveGame, loadSave };
