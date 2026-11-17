// Missions and the story of Solmar Bay. Five missions, one arc: Mara owes
// Tomas "Tide" Rivas $4,000 and works it off job by job. Each mission is a
// small state machine: a target point, a condition to finish, a reward.
// The phone (M key) lists them; finishing one unlocks the next.

import { gainCash, gainXp, showMessage, addHeat } from './state.js';
import { dist } from './rng.js';

export const MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    giver: 'Lena Kova',
    brief: 'Lena is waiting at the Safehouse on Calle Sol. Get there, on foot or by car, and hear the plan.',
    target: { x: 1200, y: 1300, label: 'Safehouse' },
    reward: 150,
    intro: 'LENA: “Mara! You came back. Tide owns half this town now. Get to my place, I have a plan.”',
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Lena Kova',
    brief: 'Tide needs a Flecha GT for a “client”. Steal any car and deliver it to the Harbor Garage. Watch the wanted stars.',
    target: { x: 480, y: 480, label: 'Harbor Garage' },
    reward: 400,
    needsCar: true,
    intro: 'LENA: “First job: bring me a car. Any car. The garage pays for clean ones. Just don’t let the cops see you take it.”',
  },
  {
    id: 'dockside-debt',
    title: 'Dockside Debt',
    giver: 'Tomas “Tide” Rivas',
    brief: 'Three of Big Sal’s collectors are shaking down the Fish Market Docks. Deal with them, then grab the package on the pier.',
    target: { x: 3300, y: 1900, label: 'Fish Market Docks' },
    reward: 700,
    intro: 'TIDE: “Sal’s boys are on my docks, Mara. Remind them whose water this is. The package is on the pier when you’re done.”',
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'Lena Kova',
    brief: 'The cops are on you. Lose the heat: survive 45 seconds with a wanted level, then reach the Safehouse with no stars on you.',
    target: { x: 1200, y: 1300, label: 'Safehouse' },
    reward: 900,
    escape: true,
    intro: 'LENA: “Duarte put your face on every board in town. Shake them off and get back here. Don’t get busted.”',
  },
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    giver: 'Tomas “Tide” Rivas',
    brief: 'The final run: carry the package to the Solmar Lighthouse at the north point. Deliver it and the debt is paid.',
    target: { x: 3480, y: 250, label: 'Solmar Lighthouse' },
    reward: 2000,
    intro: 'TIDE: “Last one, Mara. Lighthouse, midnight, no questions. Do this and the $4,000 is gone. You’re free.”',
  },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    def, stage: 'go', timer: 0, done: false,
    enemiesLeft: def.id === 'dockside-debt' ? 3 : 0,
    packageTaken: false,
  };
  state.objective = def.brief;
  state.missionTimer = 0;
  showMessage(state, `MISSION: ${def.title} — ${def.giver}`, 5);
  state.sound.click();
  if (def.id === 'dockside-debt') spawnThugs(state);
  if (def.id === 'heat-wave') addHeat(state, 45); // three stars, on purpose
  if (def.id === 'harbor-lights') { state.night = true; state.dayTime = 0.86; }
  return true;
}

function spawnThugs(state) {
  const spots = [
    { x: 3240, y: 1840 }, { x: 3320, y: 1960 }, { x: 3180, y: 2000 },
  ];
  for (const s of spots) {
    state.enemies.push({
      id: 9000 + Math.floor(Math.random() * 900), kind: 'thug',
      name: 'Collector', shirt: '#3a3f46',
      x: s.x, y: s.y, angle: 0, speed: 110, hp: 60,
      punchCd: 0, walkPhase: 0,
    });
  }
  showMessage(state, 'Three collectors guard the docks. Deal with them.', 4);
}

export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  m.done = true;
  state.missionsDone.push(m.def.id);
  state.stats.missionsDone++;
  gainCash(state, m.def.reward, `— ${m.def.title} complete`);
  gainXp(state, 100);
  state.sound.missionDone();
  state.mode = 'missionDone';
  state.mission = null;
  state.objective = '';
}

export function failMission(state, why) {
  state.sound.missionFail();
  state.mode = 'missionFail';
  state.failWhy = why || 'Mission failed.';
  state.mission = null;
  state.objective = '';
}

// Called every frame while a mission is active.
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  state.missionTimer += dt;
  const tx = m.def.target.x, ty = m.def.target.y;
  const d = dist(p.x, p.y, tx, ty);

  if (m.def.id === 'dockside-debt') {
    if (m.stage === 'go' && d < 220) {
      m.stage = 'fight';
      showMessage(state, 'The collectors are here. Take them down!', 4);
    }
    if (m.stage === 'fight') {
      const alive = state.enemies.filter((e) => e.hp > 0).length;
      if (alive === 0) {
        m.stage = 'grab';
        state.pickups.push({ x: tx + 40, y: ty + 120, kind: 'package', label: 'Package' });
        showMessage(state, 'Docks clear. Grab the package on the pier.', 4);
      }
    }
    if (m.stage === 'grab' && m.packageTaken) completeMission(state);
    return;
  }

  if (m.def.id === 'heat-wave') {
    if (m.stage === 'go') {
      if (state.wanted >= 3 && state.missionTimer > 10) m.stage = 'survive';
      if (state.wanted >= 3) m.escapeTimer = (m.escapeTimer || 0) + dt;
      if ((m.escapeTimer || 0) > 45) {
        m.stage = 'safehouse';
        showMessage(state, 'You shook them! Get to the Safehouse.', 4);
      }
    }
    if (m.stage === 'survive' && (m.escapeTimer || 0) > 45) {
      m.stage = 'safehouse';
      showMessage(state, 'You shook them! Get to the Safehouse.', 4);
    }
    if (m.stage === 'safehouse' && state.wanted === 0 && d < 130) completeMission(state);
    return;
  }

  // Simple go-to missions (and the final delivery).
  if (m.def.needsCar && p.onFoot) {
    state.objective = `${m.def.brief} (you need a car — press E near one)`;
  }
  if (d < 120 && (!m.def.needsCar || !p.onFoot)) completeMission(state);
}

export function nextMissionAvailable(state) {
  return state.missionIndex < MISSIONS.length && !state.mission && state.mode === 'playing';
}
