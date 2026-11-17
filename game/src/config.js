// Solmar Bay: tuning, palette, names and static data for the whole game.
// Everything here is original: a fictional coastal city, its districts,
// its people and its vehicles. Nothing is borrowed from any other game.

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 96;
export const BLOCK = 400;

// Road centre lines, laid out on a regular grid so traffic can follow them.
export const ROADS_X = [240, 640, 1040, 1440, 1840, 2240, 2640, 3040, 3360];
export const ROADS_Y = [220, 620, 1020, 1420, 1820, 2220];
export const BEACH_Y = 2380; // sand starts here; the sea is below it

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  sand: '#e8d29a',
  sea: '#2e7fa8',
  seaDeep: '#1d5f86',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  sidewalk: '#b9b3a4',
  lane: '#e8d44d',
  buildingRoof: ['#c96f4a', '#d9a441', '#7d8aa5', '#a85f7a', '#5f8f6e', '#b08954'],
  buildingWall: ['#8a4f34', '#9c7a2e', '#5b6577', '#7a4356', '#456b52', '#7d6238'],
  park: '#5d9b4a',
  water: '#2e7fa8',
};

export const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 0, x1: 900, y1: 700, tint: '#8a6f4d' },
  { name: 'Marina Row', x0: 900, y0: 0, x1: 2200, y1: 700, tint: '#4d7a8a' },
  { name: 'Calle Sol', x0: 2200, y0: 0, x1: 3600, y1: 1100, tint: '#c98a3d' },
  { name: 'The Terraces', x0: 0, y0: 700, x1: 1400, y1: 1600, tint: '#6e8a4d' },
  { name: 'Downtown Solmar', x0: 1400, y0: 700, x1: 3600, y1: 1600, tint: '#5d6e8a' },
  { name: 'Palma Beach', x0: 0, y0: 1600, x1: 3600, y1: 2600, tint: '#d9b36c' },
];

export const LANDMARKS = [
  { name: 'Solmar Lighthouse', x: 3480, y: 250, kind: 'lighthouse' },
  { name: 'Grand Marina', x: 1750, y: 320, kind: 'marina' },
  { name: 'Calle Sol Market', x: 2650, y: 900, kind: 'market' },
  { name: 'The Pelican Club', x: 900, y: 1500, kind: 'club' },
  { name: 'Harbor Garage', x: 480, y: 480, kind: 'garage' },
  { name: 'Safehouse', x: 1200, y: 1300, kind: 'house' },
  { name: 'Fish Market Docks', x: 3300, y: 1900, kind: 'docks' },
];

export const VEHICLE_DEFS = [
  { name: 'Sardine', kind: 'hatch', color: '#c94f4f', top: 74, accel: 260, max: 300 },
  { name: 'Caballo', kind: 'sedan', color: '#3f6fb5', top: 96, accel: 300, max: 360 },
  { name: 'Brisa', kind: 'convertible', color: '#e8b13c', top: 110, accel: 340, max: 420 },
  { name: 'Tortuga Van', kind: 'van', color: '#7a7f85', top: 84, accel: 220, max: 280 },
  { name: 'Flecha GT', kind: 'sport', color: '#8a2f5e', top: 140, accel: 420, max: 520 },
  { name: 'Solmar Taxi', kind: 'taxi', color: '#e8c832', top: 90, accel: 290, max: 350 },
];

export const PED_NAMES = [
  'Alba', 'Bruno', 'Carmen', 'Dario', 'Elena', 'Felix', 'Greta', 'Hugo',
  'Ines', 'Jorge', 'Kira', 'Leo', 'Marta', 'Nico', 'Olga', 'Pablo',
];
export const PED_SHIRTS = ['#d95f4b', '#4b7fd9', '#e8c832', '#5fb56a', '#9b5fd9', '#e87fb5', '#4bd9c9', '#d98a4b'];

export const PLAYER_NAME = 'Mara Solis';
export const CREW = ['Tomas “Tide” Rivas', 'Lena Kova', 'Big Sal', 'Officer Duarte'];
export const STORY_INTRO =
  'Mara Solis is back in Solmar Bay with a busted scooter, a $4,000 debt to Tomas “Tide” Rivas, ' +
  'and one week to pay it. The city is hers to work: drive, deliver, settle scores, and stay out of the cells.';

// Wanted: stars 0..5, heat is a 0..100 meter feeding the stars.
export const WANTED_DECAY_PER_SEC = 2.2;
export const COP_CAR_MAX = [0, 1, 2, 3, 4, 5];

export const SAVE_KEY = 'solmarbay.save.v1';
