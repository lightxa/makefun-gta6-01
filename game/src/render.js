// Rendering only: world state in, pixels out. A top-down 2.5D camera
// follows Mara through Solmar Bay, buildings extrude with a shadow and a
// roof, and the HUD carries cash, health, wanted stars, a live minimap
// and the mission objective. Menus are drawn here too.

import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, BEACH_Y, PALETTE, DISTRICTS } from './config.js';
import { MISSIONS } from './missions.js';
import { districtAt } from './city.js';
import { clamp, dist } from './rng.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280, vh = 720, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  function text(str, x, y, size, color, align, weight) {
    ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
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

  // ---------- world ----------

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    ctx.fillStyle = state.night ? '#4a6b3a' : PALETTE.grass;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Mown stripes for a little texture.
    ctx.fillStyle = state.night ? '#425f34' : PALETTE.grassDark;
    for (let y = 0; y < WORLD_H; y += 160) ctx.fillRect(0, y, WORLD_W, 40);
    // Parks.
    for (const p of city.parks) {
      ctx.fillStyle = state.night ? '#3d5c33' : PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    // Beach sand and the sea.
    ctx.fillStyle = state.night ? '#8a7648' : PALETTE.sand;
    ctx.fillRect(0, BEACH_Y, WORLD_W, WORLD_H - BEACH_Y);
    const wave = Math.sin(state.time * 1.4) * 6;
    ctx.fillStyle = state.night ? '#123a52' : PALETTE.sea;
    ctx.fillRect(0, BEACH_Y + 110 + wave, WORLD_W, WORLD_H - BEACH_Y - 110);
    ctx.fillStyle = state.night ? '#0e2f44' : PALETTE.seaDeep;
    ctx.fillRect(0, BEACH_Y + 170 + wave, WORLD_W, WORLD_H - BEACH_Y - 170);
    // Piers.
    ctx.fillStyle = '#7a5c38';
    for (const pier of city.piers) ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    // Roads: dark asphalt, pale sidewalks, dashed centre lines.
    ctx.fillStyle = state.night ? '#2a2e33' : PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - 48, 0, 96, BEACH_Y + 40);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - 48, WORLD_W, 96);
    ctx.strokeStyle = state.night ? '#8a8070' : PALETTE.sidewalk;
    ctx.lineWidth = 10;
    for (const rx of ROADS_X) {
      ctx.beginPath(); ctx.moveTo(rx - 52, 0); ctx.lineTo(rx - 52, BEACH_Y + 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + 52, 0); ctx.lineTo(rx + 52, BEACH_Y + 40); ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath(); ctx.moveTo(0, ry - 52); ctx.lineTo(WORLD_W, ry - 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ry + 52); ctx.lineTo(WORLD_W, ry + 52); ctx.stroke();
    }
    ctx.strokeStyle = state.night ? '#b8a13c' : PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, BEACH_Y + 40); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // District labels painted on the ground, like a tourist map.
    ctx.font = '700 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    for (const d of DISTRICTS) {
      ctx.fillText(d.name.toUpperCase(), (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2);
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // Shadow offset down-right sells the height.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 6, b.y + b.height * 0.4 + 6, b.w, b.h);
      // Wall face (the south side of the extrusion).
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y + b.height * 0.4, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof details: a vent or a pool on bigger roofs.
      if (b.w > 90 && b.h > 70) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.25, b.h * 0.2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, b.w * 0.2, b.h * 0.22);
      }
      if (b.tall) {
        // A taller tower gets a second, smaller roof on top.
        ctx.fillStyle = b.roof;
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.2, b.w * 0.5, b.h * 0.45);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(b.x + b.w * 0.25, b.y + b.h * 0.2, b.w * 0.5, b.h * 0.45);
      }
    }
    // Landmarks.
    for (const lm of state.city.landmarks) {
      if (lm.kind === 'lighthouse') {
        ctx.fillStyle = '#e8e4d8';
        ctx.fillRect(lm.x - 14, lm.y - 60, 28, 70);
        ctx.fillStyle = '#c94f4f';
        ctx.fillRect(lm.x - 14, lm.y - 60, 28, 12);
        ctx.fillRect(lm.x - 14, lm.y - 30, 28, 12);
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath(); ctx.arc(lm.x, lm.y - 66, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(242,201,76,0.25)';
        ctx.beginPath(); ctx.arc(lm.x, lm.y - 66, 34 + Math.sin(state.time * 2) * 6, 0, Math.PI * 2); ctx.fill();
      } else if (lm.kind === 'marina') {
        ctx.fillStyle = '#d9c9a8';
        ctx.fillRect(lm.x - 90, lm.y - 30, 180, 60);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(lm.x - 70 + i * 40, lm.y - 18, 26, 12);
        }
      }
      ctx.font = '700 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,30,40,0.75)';
      ctx.fillText(lm.name, lm.x, lm.y + 92);
    }
    // Palm trees: a trunk line and a star of fronds.
    for (const palm of state.city.palms) {
      const s = palm.s;
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3 * s, palm.y - 16 * s); ctx.stroke();
      ctx.fillStyle = state.night ? '#2f5c2a' : '#3f7d33';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + state.time * 0.05;
        ctx.beginPath();
        ctx.ellipse(palm.x + 3 * s + Math.cos(a) * 10 * s, palm.y - 16 * s + Math.sin(a) * 7 * s, 12 * s, 4 * s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Street lamps.
    ctx.fillStyle = '#2c3036';
    for (const lamp of state.city.lamps) ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 12);
    if (state.night) {
      ctx.fillStyle = 'rgba(242,201,76,0.5)';
      for (const lamp of state.city.lamps) {
        ctx.beginPath(); ctx.arc(lamp.x, lamp.y - 4, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCarShape(car, isPlayer, time, night) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = car.w, h = car.h;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    roundRect(-w / 2 + 3, -h / 2 + 4, w, h, 8); ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    roundRect(-w / 2, -h / 2, w, h, 8); ctx.stroke();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,30,40,0.75)';
    roundRect(-w * 0.12, -h / 2 + 3, w * 0.32, h - 6, 4); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.8)';
    ctx.fillRect(w * 0.22, -h / 2 + 4, 4, h - 8);
    // Wheels.
    ctx.fillStyle = '#14181c';
    ctx.fillRect(-w * 0.32, -h / 2 - 3, 12, 5);
    ctx.fillRect(w * 0.14, -h / 2 - 3, 12, 5);
    ctx.fillRect(-w * 0.32, h / 2 - 2, 12, 5);
    ctx.fillRect(w * 0.14, h / 2 - 2, 12, 5);
    if (car.cop) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.05, -h / 2 + 2, w * 0.2, h - 4);
      ctx.fillStyle = '#1c2733';
      ctx.font = '700 9px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      const blink = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = blink ? '#e5534b' : '#3f6fb5';
      ctx.beginPath(); ctx.arc(-w * 0.28, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#3f6fb5' : '#e5534b';
      ctx.beginPath(); ctx.arc(w * 0.28, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      roundRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 9); ctx.stroke();
    }
    ctx.restore();
    // Headlights at night.
    if (night) {
      const hx = car.x + Math.cos(car.angle) * (w / 2 + 26);
      const hy = car.y + Math.sin(car.angle) * (w / 2 + 26);
      ctx.fillStyle = 'rgba(255,240,180,0.20)';
      ctx.beginPath(); ctx.arc(hx, hy, 26, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, walkPhase, opts) {
    const bob = Math.sin(walkPhase) * 2;
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Legs (two dots that scissor while walking).
    ctx.fillStyle = '#2c3036';
    ctx.beginPath(); ctx.arc(-4 + bob * 0.6, 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4 - bob * 0.6, 5, 3, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
    // Head.
    ctx.fillStyle = opts && opts.skin ? opts.skin : '#e8b98a';
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2 - 2, 6, 0, Math.PI * 2); ctx.fill();
    if (opts && opts.cap) {
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath(); ctx.arc(0, -3, 6, Math.PI, 0); ctx.fill();
    }
    if (opts && opts.badge) {
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-2, -1, 4, 4);
    }
    ctx.restore();
  }

  function drawWorld(state) {
    drawGround(state);
    drawBuildings(state);
    // Pickups.
    for (const pk of state.pickups) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.12;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);
      if (pk.kind === 'health') { ctx.fillStyle = '#ffffff'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#e5534b'; ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4); }
      else if (pk.kind === 'ammo') { ctx.fillStyle = '#5fb56a'; ctx.fillRect(-10, -7, 20, 14); ctx.fillStyle = '#1c2733'; ctx.fillRect(-6, -3, 12, 6); }
      else if (pk.kind === 'package') { ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-10, -8, 20, 16); ctx.fillStyle = '#f2c94c'; ctx.fillRect(-10, -2, 20, 4); }
      else { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a6f1f'; ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4); }
      ctx.restore();
      ctx.font = '600 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(pk.label, pk.x, pk.y - 16);
    }
    // Mission beacon: a column of light and a pulsing diamond.
    if (state.mission) {
      const t = state.mission.def.target;
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.fillStyle = 'rgba(242,201,76,0.18)';
      ctx.fillRect(t.x - 14, t.y - 160, 28, 160);
      ctx.save();
      ctx.translate(t.x, t.y - 40 * pulse);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#8a6f1f'; ctx.lineWidth = 2; ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#f2c94c';
      ctx.fillText(state.mission.def.target.label, t.x, t.y - 62);
    }
    // Cars, sorted so nearer ones draw last.
    const allCars = [...state.cars, ...state.copCars];
    for (const car of allCars) drawCarShape(car, state.player.car === car, state.time, state.night);
    // People.
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.walkPhase, { skin: '#e8b98a' });
    }
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      drawPerson(e.x, e.y, e.angle, '#3a3f46', e.walkPhase, { skin: '#c98a6a' });
      // Health bar over a thug.
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 14, e.y - 26, 28, 5);
      ctx.fillStyle = '#e5534b'; ctx.fillRect(e.x - 14, e.y - 26, 28 * (e.hp / 60), 5);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1c3a5e', cop.walkPhase, { skin: '#d9a06a', badge: true });
    }
    // The player, on foot: a gold ring marks Mara so she never gets lost
    // in a crowd of pedestrians.
    const p = state.player;
    if (p.onFoot) {
      ctx.strokeStyle = 'rgba(242,201,76,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
      const hurt = p.hurtCd > 0 && Math.floor(state.time * 12) % 2 === 0;
      drawPerson(p.x, p.y, p.angle, hurt ? '#e5534b' : '#14b8a6', p.moving ? state.time * 10 : 0, { skin: '#e8b98a', cap: true });
      // Aim line with the pistol.
      if (p.weapon === 'pistol') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * 60, p.y + Math.sin(p.angle) * 60); ctx.stroke();
      }
    }
    // Bullets as tracer lines.
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(b.angle) * 18, b.y - Math.sin(b.angle) * 18); ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Night darkness with a lit circle around the player.
    if (state.night) {
      const g = ctx.createRadialGradient(p.x, p.y, 90, p.x, p.y, 520);
      g.addColorStop(0, 'rgba(8,12,28,0)');
      g.addColorStop(1, 'rgba(8,12,28,0.68)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 560, p.y - 560, 1120, 1120);
    }
    // Warm sun tint in the morning, cooler at dusk.
    if (!state.night) {
      ctx.fillStyle = state.dayTime > 0.7 ? 'rgba(255,140,60,0.06)' : 'rgba(255,220,120,0.05)';
      ctx.fillRect(p.x - 700, p.y - 500, 1400, 1000);
    }
  }

  // ---------- HUD ----------

  function drawMinimap(state) {
    const mw = 210, mh = 152, mx = vw - mw - 16, my = 16;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,24,0.82)';
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.stroke();
    // Sea strip at the bottom.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(mx, my + (BEACH_Y / WORLD_H) * mh, mw, mh - (BEACH_Y / WORLD_H) * mh);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mx, my + ((BEACH_Y - 20) / WORLD_H) * mh, mw, 6);
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
    // Mission target.
    if (state.mission) {
      const t = state.mission.def.target;
      ctx.fillStyle = '#f2c94c';
      ctx.save();
      ctx.translate(mx + t.x * sx, my + t.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Cop cars red, player white.
    ctx.fillStyle = '#e5534b';
    for (const c of state.copCars) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    text('SOLMAR BAY', mx, my + mh + 22, 11, 'rgba(255,255,255,0.75)', 'left', '700');
  }

  function drawHud(state) {
    // Top-left: cash, level, health.
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    roundRect(14, 14, 250, 92, 10); ctx.fill();
    text('$' + state.cash.toLocaleString('en-US'), 28, 46, 26, '#7dff9a', 'left', '800');
    text('LVL ' + state.level + '   •   ' + districtAt(state.player.x, state.player.y).toUpperCase(), 28, 70, 13, '#ffffff', 'left', '700');
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(28, 80, 180, 12, 6); ctx.fill();
    const hpFrac = state.player.hp / state.player.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#5fb56a' : hpFrac > 0.25 ? '#e8b13c' : '#e5534b';
    roundRect(28, 80, 180 * hpFrac, 12, 6); ctx.fill();
    text('HP ' + Math.ceil(state.player.hp), 214, 92, 11, '#ffffff', 'left', '700');
    // Wanted stars, top centre.
    const stars = state.wanted;
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    roundRect(vw / 2 - 150, 14, 300, 44, 10); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const on = i < stars;
      ctx.fillStyle = on ? '#f2c94c' : 'rgba(255,255,255,0.25)';
      const cx = vw / 2 - 88 + i * 40, cy = 36;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
        const px = cx + Math.cos(a) * 13, py = cy + Math.sin(a) * 13;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
    if (stars > 0) text('WANTED', vw / 2 + 96, 26, 10, '#ff8a7a', 'left', '800');    // Minimap.
    drawMinimap(state);
    // Mission objective banner, bottom centre.
    if (state.objective) {
      ctx.font = '600 15px ' + FONT;
      const w = Math.min(vw - 80, ctx.measureText(state.objective).width + 36);
      ctx.fillStyle = 'rgba(10,16,24,0.78)';
      roundRect((vw - w) / 2, vh - 96, w, 40, 10); ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect((vw - w) / 2, vh - 96, 5, 40);
      text(state.objective, (vw - w) / 2 + 20, vh - 70, 15, '#ffffff', 'left', '600');
    }
    // Toast message.
    if (state.message && state.time - state.messageAt < (state.messageFor || 4)) {
      ctx.font = '700 17px ' + FONT;
      const w = ctx.measureText(state.message).width + 32;
      ctx.fillStyle = 'rgba(20,28,38,0.85)';
      roundRect((vw - w) / 2, 72, w, 36, 9); ctx.fill();
      text(state.message, vw / 2, 96, 17, '#ffffff', 'center', '700');
    }
    // Controls hint, bottom left.
    text('WASD move/drive   •   E enter car   •   SPACE punch   •   CLICK shoot   •   M phone   •   P pause', 16, vh - 16, 12, 'rgba(255,255,255,0.65)', 'left', '600');
    // Driving readout.
    if (!state.player.onFoot && state.player.car) {
      const kmh = Math.round(Math.abs(state.player.car.speed) * 0.36);
      text(kmh + ' km/h', 16, vh - 44, 22, '#ffffff', 'left', '800');
      text(state.player.car.name.toUpperCase() + '  •  ' + (state.player.weapon === 'pistol' ? 'PISTOL ' + state.player.ammo : 'FISTS'), 16, vh - 66, 12, 'rgba(255,255,255,0.75)', 'left', '700');
    } else {
      text((state.player.weapon === 'pistol' ? 'PISTOL ' + state.player.ammo + ' ROUNDS' : 'FISTS') + '  •  1/2 switch weapon', 16, vh - 44, 12, 'rgba(255,255,255,0.75)', 'left', '700');
    }
    // Mission progress.
    text('MISSIONS ' + state.missionsDone.length + '/' + MISSIONS.length + '   •   $' + state.cash.toLocaleString('en-US'), vw - 16, vh - 16, 12, 'rgba(255,255,255,0.7)', 'right', '700');
  }

  // ---------- menus ----------

  function panel(x, y, w, h, title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8,14,22,0.88)';
    roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = accent || '#f2c94c'; ctx.lineWidth = 2;
    roundRect(x, y, w, h, 14); ctx.stroke();
    text(title, vw / 2, y + 52, 34, '#ffffff', 'center', '800');
    lines.forEach((line, i) => {
      text(line.text, vw / 2, y + 100 + i * 26, line.size || 15, line.color || 'rgba(255,255,255,0.85)', 'center', line.weight || '600');
    });
    if (prompt) text(prompt, vw / 2, y + h - 28, 16, '#f2c94c', 'center', '700');
  }

  function drawMenu(state) {
    // Dim the city behind the menu.
    ctx.fillStyle = 'rgba(8,14,22,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    const lines = [
      { text: 'SOLMAR BAY', size: 20, color: '#f2c94c', weight: '800' },
      { text: 'An open-world crime story. All original: one city, one debt, five jobs.', size: 15 },
      { text: 'Mara Solis is back in Solmar Bay owing Tomas “Tide” Rivas $4,000.', size: 15 },
      { text: 'Drive the avenues, steal what you need, work the jobs, lose the cops.', size: 15 },
      { text: '', size: 15 },
      { text: 'WASD move / drive    E enter a car    SPACE punch    CLICK shoot', size: 14, color: '#7dff9a' },
      { text: 'M phone (missions)    P pause    SHIFT sprint    1 / 2 weapon', size: 14, color: '#7dff9a' },
      { text: '', size: 15 },
      { text: '5 missions  •  wanted stars  •  traffic & pedestrians  •  save with S', size: 14, color: 'rgba(255,255,255,0.65)' },
    ];
    panel(vw / 2 - 340, vh / 2 - 220, 680, 440, 'SOLMAR BAY', lines, 'Press ENTER or click to start', '#f2c94c');
  }

  function drawPhone(state) {
    ctx.fillStyle = 'rgba(8,14,22,0.6)';
    ctx.fillRect(0, 0, vw, vh);
    const lines = [];
    MISSIONS.forEach((m, i) => {
      const done = state.missionsDone.includes(m.id);
      const current = i === state.missionIndex && !state.mission;
      lines.push({
        text: (done ? '✓  ' : current ? '►  ' : '·  ') + (i + 1) + '. ' + m.title + ' — ' + m.giver + '  ($' + m.reward + ')',
        size: 15, color: done ? '#7dff9a' : current ? '#f2c94c' : 'rgba(255,255,255,0.85)',
      });
      lines.push({ text: '     ' + m.brief, size: 12, color: 'rgba(255,255,255,0.6)' });
    });
    lines.push({ text: '', size: 12 });
    lines.push({ text: 'Press ENTER to start the next job, M to close.', size: 14, color: '#7dff9a' });
    panel(vw / 2 - 360, vh / 2 - 230, 720, 460, 'MARA’S PHONE', lines, '', '#14b8a6');
  }

  function drawOverlay(state) {
    if (state.mode === 'menu') { drawMenu(state); return; }
    if (state.mode === 'paused') {
      panel(vw / 2 - 260, vh / 2 - 140, 520, 280, 'PAUSED', [
        { text: 'Solmar Bay waits for no one. Except now.', size: 15 },
        { text: 'Progress saves with S. M opens the phone.', size: 14, color: 'rgba(255,255,255,0.65)' },
      ], 'Press P to resume', '#14b8a6');
      return;
    }
    if (state.mode === 'missionDone') {
      const m = MISSIONS[state.missionIndex - 1] || MISSIONS[0];
      panel(vw / 2 - 280, vh / 2 - 130, 560, 260, 'JOB DONE', [
        { text: m.title + ' complete. +$' + m.reward, size: 17, color: '#7dff9a' },
        { text: state.missionsDone.length >= MISSIONS.length ? 'The debt is paid. Solmar Bay is yours, Mara.' : 'The next job is waiting on your phone (M).', size: 14 },
      ], 'Press ENTER to keep playing', '#7dff9a');
      return;
    }
    if (state.mode === 'missionFail') {
      panel(vw / 2 - 280, vh / 2 - 130, 560, 260, 'JOB FAILED', [
        { text: state.failWhy || 'The job went sideways.', size: 15 },
        { text: 'Try it again from your phone (M).', size: 14, color: 'rgba(255,255,255,0.65)' },
      ], 'Press ENTER to keep playing', '#e5534b');
      return;
    }
    if (state.mode === 'busted') {
      panel(vw / 2 - 280, vh / 2 - 150, 560, 300, 'BUSTED', [
        { text: state.bustedWhy || 'Officer Duarte finally caught up with Mara.', size: 15 },
        { text: 'A night in the cells. $200 bail, and the heat is gone.', size: 14, color: 'rgba(255,255,255,0.65)' },
      ], 'Press ENTER to walk free', '#e5534b');
      return;
    }
    if (state.mode === 'storyDone') {
      panel(vw / 2 - 300, vh / 2 - 160, 600, 320, 'DEBT PAID', [
        { text: 'All five jobs done. Mara owns her mornings again.', size: 16, color: '#7dff9a' },
        { text: 'Solmar Bay stays open: drive, explore, and keep the score climbing.', size: 14 },
        { text: 'Thanks for playing Solmar Bay.', size: 14, color: 'rgba(255,255,255,0.65)' },
      ], 'Press ENTER to keep exploring', '#f2c94c');
      return;
    }
  }

  // ---------- frame ----------

  function draw(state) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e1a24';
    ctx.fillRect(0, 0, vw, vh);
    // Camera: follow the player, clamped to the world.
    const cam = state.camera;
    const scale = Math.min(vw / 1280, vh / 720) * 1.15;
    const cx = clamp(cam.x, vw / 2 / scale, WORLD_W - vw / 2 / scale);
    const cy = clamp(cam.y, vh / 2 / scale, WORLD_H - vh / 2 / scale);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    drawWorld(state);
    ctx.restore();
    if (state.mode === 'playing' || state.mode === 'paused' || state.phoneOpen) {
      drawHud(state);
    }
    if (state.phoneOpen) drawPhone(state);
    else drawOverlay(state);
  }

  return { draw, resize };
}
