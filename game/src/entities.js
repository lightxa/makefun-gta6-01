// Entities: the player, traffic cars, pedestrians, police and mission
// thugs. Each one is a plain object; the functions here move them, steer
// them and resolve their collisions. Rendering lives in render.js.

import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, VEHICLE_DEFS, PED_NAMES, PED_SHIRTS, BEACH_Y } from './config.js';
import { hitsBuilding, onRoad, nearestRoadX, nearestRoadY } from './city.js';
import { clamp, dist, angleTo, angleDiff } from './rng.js';
import { addHeat, showMessage } from './state.js';

let nextId = 1;

export function makeCar(x, y, angle, defIndex, opts) {
  const def = VEHICLE_DEFS[defIndex % VEHICLE_DEFS.length];
  return {
    id: nextId++, kind: 'car', def,
    x, y, angle, speed: 0,
    w: def.kind === 'van' ? 52 : 46, h: def.kind === 'van' ? 24 : 22,
    color: def.color, name: def.name,
    driver: opts && opts.driver !== undefined ? opts.driver : 'traffic',
    parked: !!(opts && opts.parked),
    ai: opts && opts.ai ? opts.ai : null, // traffic brain: {axis, dir, target}
    cop: !!(opts && opts.cop),
    hp: 100,
    honkCd: 0,
  };
}

// Traffic follows the road grid: pick an axis, a direction, drive to the
// next intersection, sometimes turn, never leave the road.
export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i++) {
    const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
    const horizontal = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const car = makeCar(
      horizontal ? 100 + Math.random() * (WORLD_W - 200) : rx + (dir > 0 ? 22 : -22),
      horizontal ? ry + (dir > 0 ? 22 : -22) : 100 + Math.random() * (BEACH_Y - 300),
      horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      Math.floor(Math.random() * VEHICLE_DEFS.length),
      { ai: { axis: horizontal ? 'x' : 'y', dir } },
    );
    car.speed = 90 + Math.random() * 60;
    state.cars.push(car);
  }
}

export function spawnParkedCars(state, count) {
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
    const horizontal = Math.random() < 0.5;
    const x = horizontal ? rx + (Math.random() < 0.5 ? -30 : 30) : 120 + Math.random() * (WORLD_W - 240);
    const y = horizontal ? 120 + Math.random() * (BEACH_Y - 300) : ry + (Math.random() < 0.5 ? -30 : 30);
    if (dist(x, y, state.player.x, state.player.y) < 200) continue;
    const angle = horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    state.cars.push(makeCar(x, y, angle, Math.floor(Math.random() * VEHICLE_DEFS.length), { parked: true }));
    placed++;
  }
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
    const horizontal = Math.random() < 0.5;
    state.peds.push({
      id: nextId++, kind: 'ped',
      name: PED_NAMES[Math.floor(Math.random() * PED_NAMES.length)],
      shirt: PED_SHIRTS[Math.floor(Math.random() * PED_SHIRTS.length)],
      x: horizontal ? 100 + Math.random() * (WORLD_W - 200) : rx + (Math.random() < 0.5 ? 62 : -62),
      y: horizontal ? ry + (Math.random() < 0.5 ? 62 : -62) : 100 + Math.random() * (BEACH_Y - 300),
      angle: Math.random() * Math.PI * 2,
      speed: 28 + Math.random() * 26,
      walkPhase: Math.random() * 10,
      panic: 0,
      hp: 30,
    });
  }
}

function steerToward(car, targetAngle, dt, rate) {
  const d = angleDiff(car.angle, targetAngle);
  car.angle += clamp(d, -rate * dt, rate * dt);
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (!car.ai) continue; // parked cars and the player's car sit still
    const brain = car.ai;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = nearestRoadX(car.x), nearY = nearestRoadY(car.y);
    const onX = Math.abs(car.x - nearX) < 6, onY = Math.abs(car.y - nearY) < 6;
    if (onX && onY && Math.random() < dt * 0.25) {
      brain.axis = brain.axis === 'x' ? 'y' : 'x';
      brain.dir = Math.random() < 0.5 ? 1 : -1;
    }
    const want = brain.axis === 'x' ? (brain.dir > 0 ? 0 : Math.PI) : (brain.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    steerToward(car, want, dt, 2.2);
    // Ease back onto the lane centre.
    if (brain.axis === 'x') {
      const laneY = nearestRoadY(car.y) + (brain.dir > 0 ? 22 : -22);
      car.y += clamp(laneY - car.y, -40 * dt, 40 * dt);
    } else {
      const laneX = nearestRoadX(car.x) + (brain.dir > 0 ? 22 : -22);
      car.x += clamp(laneX - car.x, -40 * dt, 40 * dt);
    }
    car.speed = 110;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the world edges so traffic never runs out.
    if (car.x < 40) { car.x = WORLD_W - 60; car.y = nearestRoadY(car.y); }
    if (car.x > WORLD_W - 40) { car.x = 60; car.y = nearestRoadY(car.y); }
    if (car.y < 40) { car.y = BEACH_Y - 60; car.x = nearestRoadX(car.x); }
    if (car.y > BEACH_Y - 20) { car.y = 60; car.x = nearestRoadX(car.x); }
    // Bump away from the car ahead so traffic does not pile up.
    for (const other of state.cars) {
      if (other === car || !other.ai) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70 && d > 0.01) {
        car.x -= Math.cos(car.angle) * 30 * dt;
        car.y -= Math.sin(car.angle) * 30 * dt;
      }
    }
    car.honkCd -= dt;
  }
}

export function updatePeds(state, dt) {
  for (const p of state.peds) {
    p.walkPhase += dt * 6;
    if (p.panic > 0) {
      p.panic -= dt;
      // Flee from the player.
      const a = angleTo(state.player.x, state.player.y, p.x, p.y);
      p.angle = a;
      p.x += Math.cos(a) * 130 * dt;
      p.y += Math.sin(a) * 130 * dt;
    } else {
      // Wander along the sidewalk; turn at random, avoid buildings.
      if (Math.random() < dt * 0.15) p.angle += (Math.random() - 0.5) * 2.4;
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!hitsBuilding(state.city, nx, ny, 10) && ny < BEACH_Y + 80) {
        p.x = nx; p.y = ny;
      } else {
        p.angle += Math.PI / 2;
      }
      p.x = clamp(p.x, 40, WORLD_W - 40);
      p.y = clamp(p.y, 40, WORLD_H - 40);
    }
  }
}

// --- Police ---

export function spawnCopCar(state) {
  const a = Math.random() * Math.PI * 2;
  const x = clamp(state.player.x + Math.cos(a) * 700, 120, WORLD_W - 120);
  const y = clamp(state.player.y + Math.sin(a) * 500, 120, BEACH_Y - 120);
  const car = makeCar(x, y, angleTo(x, y, state.player.x, state.player.y), 1, { cop: true, driver: 'police' });
  car.color = '#1c2733';
  car.name = 'Interceptor';
  car.ai = { axis: 'x', dir: 1, chase: true };
  car.speed = 0;
  state.copCars.push(car);
  return car;
}

export function spawnFootCop(state) {
  const a = Math.random() * Math.PI * 2;
  state.cops.push({
    id: nextId++, kind: 'cop',
    x: clamp(state.player.x + Math.cos(a) * 420, 60, WORLD_W - 60),
    y: clamp(state.player.y + Math.sin(a) * 320, 60, WORLD_H - 60),
    angle: 0, speed: 0, hp: 60, punchCd: 0, walkPhase: Math.random() * 10,
  });
}

export function updatePolice(state, dt) {
  const p = state.player;
  const want = state.wanted;
  // Spawn pressure scales with stars; despawn when the heat is gone.
  if (want > 0) {
    const maxCars = [0, 1, 2, 3, 4, 5][want];
    if (state.copCars.length < maxCars && Math.random() < dt * 0.5) spawnCopCar(state);
    if (want >= 2 && state.cops.length < want && Math.random() < dt * 0.4) spawnFootCop(state);
  }
  for (const car of state.copCars) {
    const d = dist(car.x, car.y, p.x, p.y);
    const target = angleTo(car.x, car.y, p.x, p.y);
    steerToward(car, target, dt, 3.2);
    const top = 300 + want * 45;
    car.speed = Math.min(top, car.speed + 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram the player: a hard hit on foot hurts, a hit on their car dents it.
    if (d < 52) {
      if (p.onFoot) {
        hurtPlayer(state, 12, 'run down by a police Interceptor');
      } else if (p.car) {
        p.car.hp -= 18 * dt * 10;
        if (Math.random() < dt * 2) state.sound.crash();
      }
      // Bounce the cop car off so it does not sit on top of the player.
      car.x -= Math.cos(car.angle) * 30 * dt;
      car.y -= Math.sin(car.angle) * 30 * dt;
    }
    if (want === 0 && d > 900) car.gone = true;
  }
  state.copCars = state.copCars.filter((c) => !c.gone);

  for (const cop of state.cops) {
    cop.walkPhase += dt * 7;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (want === 0 && d > 700) { cop.gone = true; continue; }
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    const speed = d > 60 ? 150 : 0;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    cop.punchCd -= dt;
    if (d < 34 && cop.punchCd <= 0) {
      cop.punchCd = 1.1;
      hurtPlayer(state, 9, 'cuffed by Officer Duarte’s patrol');
      state.sound.punch();
    }
  }
  state.cops = state.cops.filter((c) => !c.gone);

  // Busted: a foot cop stands on the player while the player is hurt and slow.
  if (want > 0 && p.onFoot && p.hp <= 25) {
    for (const cop of state.cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 40) {
        state.mode = 'busted';
        state.sound.busted();
        return;
      }
    }
  }
}

export function hurtPlayer(state, dmg, why) {
  const p = state.player;
  if (p.hurtCd > 0 || state.mode !== 'playing') return;
  p.hurtCd = 0.7;
  p.hp -= dmg;
  state.sound.punch();
  burst(state, p.x, p.y, '#e5534b', 8);
  if (p.hp <= 0) {
    p.hp = 0;
    state.mode = 'busted';
    state.sound.busted();
    state.bustedWhy = why || 'Mara is down.';
  }
}

export function burst(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({
      x, y, vx: Math.cos(a) * (40 + Math.random() * 120), vy: Math.sin(a) * (40 + Math.random() * 120),
      life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

// Steal the nearest car: the classic open-world move. Costs heat.
export function tryEnterCar(state) {
  const p = state.player;
  if (!p.onFoot) {
    // Getting out: step beside the car and leave it parked.
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    car.parked = true;
    car.ai = null;
    state.sound.carDoor();
    return 'out';
  }
  let best = null, bd = 90;
  for (const car of state.cars) {
    if (car.cop) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return null;
  if (best.driver === 'traffic' || best.parked) {
    // A car with a driver, or a parked car, is a theft: witnesses notice.
    addHeat(state, best.parked ? 12 : 18);
    state.stats.carsStolen++;
    showMessage(state, `Stole the ${best.name}! The city saw that.`, 3);
    state.sound.carDoor();
    if (best.driver === 'traffic') {
      // The driver bails out and runs.
      state.peds.push({
        id: nextId++, kind: 'ped', name: 'Driver', shirt: '#e87f4b',
        x: best.x + 30, y: best.y + 30, angle: Math.random() * 6, speed: 120,
        walkPhase: 0, panic: 3, hp: 30,
      });
    }
  } else {
    state.sound.carDoor();
  }
  best.driver = 'player';
  best.parked = false;
  best.ai = null;
  p.car = best;
  p.onFoot = false;
  p.x = best.x; p.y = best.y;
  return best;
}

// On-foot movement with building collision, one axis at a time so the
// player slides along walls instead of sticking to them.
export function movePlayerOnFoot(state, vx, vy, dt) {
  const p = state.player;
  const nx = p.x + vx * dt;
  if (!hitsBuilding(state.city, nx, p.y, 12)) p.x = nx;
  const ny = p.y + vy * dt;
  if (!hitsBuilding(state.city, p.x, ny, 12)) p.y = ny;
  const b = { x: p.x, y: p.y };
  const clamped = { x: Math.max(30, Math.min(WORLD_W - 30, b.x)), y: Math.max(30, Math.min(WORLD_H - 30, b.y)) };
  p.x = clamped.x; p.y = clamped.y;
}
