// Solmar Bay game state: one plain object every module reads and writes,
// created fresh by newGameState and mutated by the loop. Nothing here
// draws or listens; it only holds the truth about the world.

import { WORLD_W, WORLD_H } from './config.js';

export function newGameState(city) {
  return {
    city,
    mode: 'menu', // menu | playing | paused | missionDone | missionFail | busted | storyDone
    time: 0, // seconds since the run started
    dayTime: 0.32, // 0..1 across the day; 0.32 is a bright morning
    night: false, // dusk/night lighting flag (used by the night screenshot)
    cash: 120,
    xp: 0,
    level: 1,
    missionIndex: 0,
    missionsDone: [],
    wanted: 0, // stars 0..5
    heat: 0, // 0..100, feeds the stars
    lastCrimeAt: -999,
    message: '',
    messageAt: 0,
    objective: '',
    camera: { x: 1200, y: 1300 },
    player: {
      x: 1200, y: 1300, angle: -Math.PI / 2, speed: 0,
      hp: 100, maxHp: 100,
      onFoot: true, car: null,
      weapon: 'fists', ammo: 24,
      punchCd: 0, shootCd: 0, hurtCd: 0,
      moving: false, sprinting: false,
    },
    cars: [], // traffic + parked cars the player can steal
    peds: [],
    cops: [], // foot police
    copCars: [],
    enemies: [], // mission thugs
    pickups: [], // cash, health, ammo lying on the street
    particles: [],
    bullets: [],
    mission: null, // active mission runtime object, see missions.js
    missionTimer: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, distanceDriven: 0 },
    muted: false,
    saveNotice: '',
  };
}

export function addHeat(state, amount) {
  state.heat = Math.min(100, state.heat + amount);
  state.lastCrimeAt = state.time;
  const stars = state.heat <= 0 ? 0 : state.heat < 20 ? 1 : state.heat < 40 ? 2 : state.heat < 60 ? 3 : state.heat < 85 ? 4 : 5;
  if (stars > state.wanted) {
    state.wanted = stars;
  } else if (stars < state.wanted) {
    // Stars only fall once the heat has truly cooled.
    state.wanted = stars;
  }
}

export function decayWanted(state, dt) {
  if (state.time - state.lastCrimeAt < 6) return; // still hot from the last crime
  state.heat = Math.max(0, state.heat - 2.2 * dt);
  const stars = state.heat <= 0 ? 0 : state.heat < 20 ? 1 : state.heat < 40 ? 2 : state.heat < 60 ? 3 : state.heat < 85 ? 4 : 5;
  state.wanted = stars;
}

export function showMessage(state, text, seconds) {
  state.message = text;
  state.messageAt = state.time;
  state.messageFor = seconds || 4;
}

export function gainCash(state, amount, reason) {
  state.cash += amount;
  showMessage(state, `+$${amount}  ${reason || ''}`, 3);
}

export function gainXp(state, amount) {
  state.xp += amount;
  const need = state.level * 100;
  if (state.xp >= need) {
    state.xp -= need;
    state.level += 1;
    state.player.maxHp = Math.min(150, state.player.maxHp + 10);
    state.player.hp = state.player.maxHp;
    showMessage(state, `LEVEL UP — now level ${state.level}. Max health up!`, 4);
  }
}

export function worldBounds(x, y) {
  return {
    x: Math.max(40, Math.min(WORLD_W - 40, x)),
    y: Math.max(40, Math.min(WORLD_H - 40, y)),
  };
}
