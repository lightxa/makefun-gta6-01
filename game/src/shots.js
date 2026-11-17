// Screenshot staging: ?shot=chase|drive|onfoot|mission sets up a real
// playable scene — the same world, the same rules, just placed where the
// camera can prove several systems at once. The game then runs forward
// for a couple of seconds so traffic, pedestrians and police are mid-motion
// when the frame is taken. Nothing here is faked: every car, cop and
// pedestrian in the shot is a live entity.

import { addHeat, showMessage } from './state.js';
import { spawnCopCar, spawnFootCop, makeCar } from './entities.js';
import { startMission } from './missions.js';

function putPlayerInCar(state, defIndex, x, y, angle) {
  const car = makeCar(x, y, angle, defIndex, { driver: 'player' });
  car.speed = 180;
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x; p.y = y; p.angle = angle;
  state.camera.x = x; state.camera.y = y;
  return car;
}

function seedCrowd(state, cx, cy, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ped = state.peds[i % state.peds.length];
    if (!ped) break;
    ped.x = cx + Math.cos(a) * (60 + (i % 3) * 40);
    ped.y = cy + Math.sin(a) * (60 + (i % 3) * 40);
    ped.panic = 0;
  }
}

export function stageShot(name, state) {
  const p = state.player;
  state.mode = 'playing';
  state.phoneOpen = false;
  state.message = '';
  state.objective = '';

  if (name === 'chase') {
    // Cover: a police chase down Calle Sol with three stars, the minimap,
    // and a mission objective on the HUD.
    putPlayerInCar(state, 4, 2400, 1020, 0); // Flecha GT, eastbound
    state.player.car.speed = 320;
    addHeat(state, 50); // three stars
    spawnCopCar(state); spawnCopCar(state); spawnCopCar(state);
    state.copCars.forEach((c, i) => {
      c.x = p.x - 220 - i * 90;
      c.y = p.y + (i - 1) * 60;
      c.speed = 300;
    });
    spawnFootCop(state);
    startMission(state, 3); // Heat Wave: escape the cops
    state.mission.stage = 'survive';
    state.mission.escapeTimer = 20;
    state.missionTimer = 20;
    state.objective = 'HEAT WAVE: lose the cops — survive 45 seconds, then reach the Safehouse.';
    showMessage(state, 'Three stars! Lose the Interceptors!', 5);
  } else if (name === 'drive') {
    // Driving through Downtown with traffic all around.
    putPlayerInCar(state, 1, 1440, 1420, Math.PI / 2); // Caballo, southbound
    state.player.car.speed = 200;
    // Pack the avenue with traffic cars ahead and behind.
    state.cars.slice(0, 8).forEach((car, i) => {
      if (car.ai) {
        car.x = 1440 + (i % 2 === 0 ? 22 : -22);
        car.y = 1420 - 260 + i * 130;
        car.angle = Math.PI / 2;
        car.speed = 120;
      }
    });
    startMission(state, 1); // Borrowed Wheels
    showMessage(state, 'Deliver the car to the Harbor Garage.', 5);
  } else if (name === 'mission') {
    // Night: the docks fight, thugs, package, muzzle-light mood. Mara
    // stands just west of the docks so the camera can centre on her.
    state.night = true;
    state.dayTime = 0.86;
    p.x = 3000; p.y = 1850; p.angle = Math.PI / 4;
    p.onFoot = true; p.car = null;
    p.weapon = 'pistol'; p.ammo = 24;
    state.camera.x = p.x; state.camera.y = p.y;
    startMission(state, 2); // Dockside Debt
    state.mission.stage = 'fight';
    seedCrowd(state, 3280, 1920, 6);
    showMessage(state, 'The collectors are here. Take them down!', 5);
  } else {
    // onfoot (default): Mara on foot by the Calle Sol Market, pedestrians
    // around her, a parked car to steal, a mission waiting.
    p.x = 2620; p.y = 880; p.angle = Math.PI / 2;
    p.onFoot = true; p.car = null;
    state.camera.x = p.x; state.camera.y = p.y;
    seedCrowd(state, 2620, 880, 10);
    const parked = state.cars.find((c) => c.parked);
    if (parked) { parked.x = 2700; parked.y = 900; }
    startMission(state, 0); // Homecoming
    showMessage(state, 'Welcome to Solmar Bay, Mara. Get to the Safehouse.', 5);
  }
  return true;
}
