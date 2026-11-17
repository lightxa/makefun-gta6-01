// Combat: fists, the pistol, enemy attacks, pickups and the wanted
// consequences of violence. Shots are hitscan-ish projectiles so the
// player can see tracer lines; fists are a short arc in front of Mara.

import { dist, angleTo, angleDiff, clamp } from './rng.js';
import { addHeat, showMessage, gainCash } from './state.js';
import { burst, hurtPlayer } from './entities.js';

export function playerPunch(state) {
  const p = state.player;
  if (p.punchCd > 0 || !p.onFoot) return;
  p.punchCd = 0.45;
  state.sound.punch();
  const reach = 46;
  const fx = p.x + Math.cos(p.angle) * reach;
  const fy = p.y + Math.sin(p.angle) * reach;
  burst(state, fx, fy, '#f2c94c', 5);
  // Hit thugs, cops and pedestrians standing in the arc.
  const victims = [...state.enemies, ...state.cops, ...state.peds];
  for (const v of victims) {
    if (v.hp <= 0) continue;
    if (dist(fx, fy, v.x, v.y) < 34) {
      v.hp -= 22;
      burst(state, v.x, v.y, '#e5534b', 8);
      if (v.kind === 'ped') {
        v.panic = 3;
        addHeat(state, 8);
        state.stats.pedsHit++;
      }
      if (v.hp <= 0) onKill(state, v);
    }
  }
}

export function playerShoot(state, tx, ty) {
  const p = state.player;
  if (p.weapon !== 'pistol' || p.shootCd > 0) return;
  if (p.ammo <= 0) {
    showMessage(state, 'Out of ammo — find an ammo pickup (green crate).', 3);
    p.shootCd = 0.4;
    return;
  }
  p.shootCd = 0.28;
  p.ammo--;
  state.stats.shotsFired++;
  state.sound.gunshot();
  const angle = angleTo(p.x, p.y, tx, ty);
  p.angle = angle;
  state.bullets.push({ x: p.x, y: p.y, angle, speed: 900, life: 0.5, fromPlayer: true });
  addHeat(state, 6);
  // Find the first thing the shot crosses.
  let best = null, bd = 520;
  const targets = [...state.enemies, ...state.cops, ...state.peds];
  for (const v of targets) {
    if (v.hp <= 0) continue;
    const d = dist(p.x, p.y, v.x, v.y);
    if (d > 520) continue;
    const diff = Math.abs(angleDiff(angle, angleTo(p.x, p.y, v.x, v.y)));
    if (diff < 0.09 && d < bd) { bd = d; best = v; }
  }
  if (best) {
    best.hp -= 34;
    burst(state, best.x, best.y, '#e5534b', 10);
    if (best.kind === 'ped') { best.panic = 3; addHeat(state, 10); }
    if (best.hp <= 0) onKill(state, best);
  }
}

function onKill(state, v) {
  if (v.kind === 'cop') {
    addHeat(state, 30);
    showMessage(state, 'You took down a cop. The whole city will hear about this.', 4);
    state.pickups.push({ x: v.x, y: v.y, kind: 'ammo', label: 'Ammo' });
  } else if (v.kind === 'thug') {
    gainCash(state, 40, '— took it off a collector');
  } else if (v.kind === 'ped') {
    showMessage(state, 'A bystander is down. The cops are coming.', 3);
  }
}

// Thugs chase Mara and swing; they only exist during Dockside Debt.
export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    e.walkPhase += dt * 7;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 420) {
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      if (d > 34) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
      e.punchCd -= dt;
      if (d < 36 && e.punchCd <= 0) {
        e.punchCd = 1.2;
        hurtPlayer(state, 10, 'beaten down by Big Sal’s collectors');
        state.sound.punch();
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0 || e.deathAt > state.time - 1);
  for (const e of state.enemies) if (e.hp <= 0 && !e.deathAt) e.deathAt = state.time;
}

export function spawnPickup(state, kind, x, y) {
  state.pickups.push({ x, y, kind, label: kind === 'health' ? 'Medkit' : kind === 'ammo' ? 'Ammo' : 'Cash' });
}

export function updatePickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      state.sound.pickup();
      if (pk.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        showMessage(state, 'Medkit: +40 health.', 2);
      } else if (pk.kind === 'ammo') {
        p.ammo += 18;
        showMessage(state, 'Ammo: +18 rounds.', 2);
      } else if (pk.kind === 'cash') {
        gainCash(state, 60, '— street cash');
      } else if (pk.kind === 'package') {
        if (state.mission) state.mission.packageTaken = true;
        showMessage(state, 'Package secured. Tide will be pleased.', 3);
      }
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
}

// Driving into a pedestrian is a crime, and it feels awful on purpose.
export function carPedCollisions(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    if (dist(p.x, p.y, ped.x, ped.y) < 30 && Math.abs(p.car.speed) > 60) {
      ped.hp = 0;
      ped.panic = 0;
      burst(state, ped.x, ped.y, '#e5534b', 12);
      state.stats.pedsHit++;
      addHeat(state, 14);
      state.sound.crash();
      showMessage(state, 'You hit a pedestrian! Wanted level rising.', 3);
    }
  }
}
