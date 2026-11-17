// Save and load for Solmar Bay: one small JSON blob in localStorage.
// It keeps Mara's cash, level, mission progress, position and health so
// a session can pick up where it left off. Nothing leaves the browser.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash,
      xp: state.xp,
      level: state.level,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      wanted: state.wanted,
      heat: state.heat,
      player: {
        x: state.player.x, y: state.player.y,
        hp: state.player.hp, maxHp: state.player.maxHp,
        ammo: state.player.ammo, weapon: state.player.weapon,
      },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.saveNotice = 'Progress saved.';
    return true;
  } catch {
    state.saveNotice = 'Save failed: storage is off in this browser.';
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(state, data) {
  if (!data) return;
  state.cash = data.cash;
  state.xp = data.xp || 0;
  state.level = data.level || 1;
  state.missionIndex = data.missionIndex || 0;
  state.missionsDone = data.missionsDone || [];
  state.wanted = 0;
  state.heat = 0;
  state.player.x = data.player.x;
  state.player.y = data.player.y;
  state.player.hp = data.player.hp;
  state.player.maxHp = data.player.maxHp;
  state.player.ammo = data.player.ammo;
  state.player.weapon = data.player.weapon || 'fists';
  state.camera.x = data.player.x;
  state.camera.y = data.player.y;
}
