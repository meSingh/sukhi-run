/**
 * Who chases Sukhi, where, and what is in the way.
 *
 * Everything here is data. Sizes are in metres, near enough: Sukhi is 1.25
 * tall and a lane is 1.6 wide, and the rest is in proportion to him.
 */

export type ChaserId = 'gorilla' | 'bear' | 'bog' | 'croc' | 'trex' | 'raptor' | 'mummy' | 'pumpkin' | 'longlegs';
export type WorldId = 'jungle' | 'swamp';
/** The grown-up's setting: 1 silly, 2 spooky, 3 scary. */
export type Scare = 1 | 2 | 3;

/** How each one catches him, played out on the caught screen. */
export type Catch = 'shoulders' | 'hug' | 'burp' | 'tickle' | 'sneeze' | 'shoe' | 'wrap' | 'crows' | 'hammock';
/** The noise each one makes as it closes in. */
export type Voice = 'hoot' | 'growl' | 'gloop' | 'snap' | 'roar' | 'screech' | 'moan' | 'cackle' | 'creak';

export interface Chaser {
  id: ChaserId;
  /** For grown-ups and screen readers; a child never needs to read it. */
  name: string;
  /** The least scare setting it appears at. */
  scare: Scare;
  /** Where it lives, when the setting allows the night. */
  home: WorldId;
  catches: Catch;
  voice: Voice;
}

/** In order from friendliest to scariest, which is the order a child sees. */
export const CHASERS: readonly Chaser[] = [
  { id: 'gorilla', name: 'Gus the gorilla', scare: 1, home: 'jungle', catches: 'shoulders', voice: 'hoot' },
  { id: 'bear', name: 'Bumble the bear', scare: 1, home: 'jungle', catches: 'hug', voice: 'growl' },
  { id: 'bog', name: 'Gloop the bog monster', scare: 1, home: 'swamp', catches: 'burp', voice: 'gloop' },
  { id: 'croc', name: 'Snappy the crocodile', scare: 2, home: 'jungle', catches: 'tickle', voice: 'snap' },
  { id: 'trex', name: 'Roary the T-Rex', scare: 2, home: 'jungle', catches: 'sneeze', voice: 'roar' },
  { id: 'raptor', name: 'Zip the raptor', scare: 2, home: 'jungle', catches: 'shoe', voice: 'screech' },
  { id: 'mummy', name: 'Mumbles the mummy', scare: 2, home: 'swamp', catches: 'wrap', voice: 'moan' },
  { id: 'pumpkin', name: 'Pumpkin Jack', scare: 2, home: 'swamp', catches: 'crows', voice: 'cackle' },
  { id: 'longlegs', name: 'Long-Legs', scare: 3, home: 'swamp', catches: 'hammock', voice: 'creak' }
];

export const chaser = (id: ChaserId): Chaser => CHASERS.find((c) => c.id === id)!;
export const allowed = (scare: Scare): Chaser[] => CHASERS.filter((c) => c.scare <= scare);
/** The night is for spooky and up: on silly, everyone lives in the jungle. */
export const worldFor = (c: Chaser, scare: Scare): WorldId => (scare >= 2 ? c.home : 'jungle');

/** What an obstacle asks of him: hop over it, duck under it, or go round it. */
export type Act = 'jump' | 'duck' | 'block';

export interface Size { w?: number; h?: number }

export interface World {
  id: WorldId;
  night: boolean;
  /** The path, in two alternating tones, and its edge. */
  path: [string, string];
  edge: string;
  /** Either side of the path, in two alternating tones. */
  side: [string, string];
  /** What the far distance fades into. */
  fog: string;
  obstacles: Record<Act, string[]>;
  /** Things along the sides, never in the way. */
  scenery: string[];
}

export const WORLDS: Record<WorldId, World> = {
  jungle: {
    id: 'jungle',
    night: false,
    path: ['#D8C49A', '#CDB88C'],
    edge: '#9C8A64',
    side: ['#6FAE4B', '#5E9E40'],
    fog: '#F2D6A2',
    obstacles: { jump: ['jungle-log'], duck: ['jungle-arch'], block: ['jungle-boulder'] },
    scenery: ['jungle-palm', 'jungle-bush', 'jungle-pillar', 'jungle-bush']
  },
  swamp: {
    id: 'swamp',
    night: true,
    path: ['#6B5140', '#5D4636'],
    edge: '#3B2A20',
    side: ['#1E3A40', '#1A3338'],
    fog: '#27455A',
    obstacles: { jump: ['swamp-log'], duck: ['swamp-arch'], block: ['swamp-stump'] },
    scenery: ['swamp-tree', 'swamp-lantern', 'swamp-mushrooms', 'swamp-tree']
  }
};

/** How big each picture is in the world. One of the two; the other follows. */
export const SIZES: Record<string, Size> = {
  'jungle-log': { w: 1.55 },
  'jungle-arch': { w: 1.75 },
  'jungle-boulder': { w: 1.35 },
  'jungle-pillar': { h: 2.8 },
  'jungle-bush': { w: 2.4 },
  'jungle-palm': { h: 5.2 },
  'swamp-log': { w: 1.55 },
  'swamp-arch': { h: 1.9 },
  'swamp-stump': { w: 1.3 },
  'swamp-tree': { h: 5.6 },
  'swamp-lantern': { h: 2.3 },
  'swamp-mushrooms': { h: 1.0 },
  'pick-coin': { h: 0.5 },
  'pick-magnet': { h: 0.8 },
  'pick-bubble': { h: 0.8 },
  'pick-springs': { h: 0.75 },
  'pick-jar': { h: 0.85 },
  sukhi: { h: 1.25 }
};

export type Power = 'magnet' | 'bubble' | 'springs' | 'jar';
export const POWERS: readonly Power[] = ['magnet', 'bubble', 'springs', 'jar'];
/** How long each lasts, in seconds. The bubble lasts until it is used. */
export const POWER_TIME: Record<Power, number> = { magnet: 10, bubble: Infinity, springs: 10, jar: 12 };
