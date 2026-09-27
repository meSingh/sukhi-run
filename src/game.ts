/**
 * The run itself: where Sukhi is, what is coming, and how close the chaser is.
 * No drawing and no sound here; the game says what happened as events, and
 * main.ts turns those into pictures and noises.
 *
 * ## The rules, for a four-year-old
 *
 * He runs by himself, slowly at first and a little faster over two minutes,
 * never too fast to follow. Three lanes. Four moves: left, right, hop and
 * duck. A bump makes him stumble and brings the chaser close; run clean and it
 * drops back. A second bump while it is still close, and he is caught. That
 * is the only way a run ends, and being caught is the fun part.
 *
 * Every row of things leaves at least one lane he can run straight down, and
 * the gaps between rows are measured in seconds, not metres, so it never gets
 * faster than a small child can react to.
 */
import { WORLDS, POWER_TIME, type Act, type Power, type Scare, type World, type WorldId } from './world';

export const LANE = 1.6;
/** How far in front of the camera he runs. */
export const AHEAD = 4.2;
/** How far ahead things appear. */
export const HORIZON = 80;

const GRAVITY = 22;
const JUMP = 7.4;
const JUMP_HIGH = 10.4;
const SLIDE = 0.75;
const STUMBLE = 0.7;
/** Lane changes, in metres a second: a lane in about an eighth of a second. */
const STEER = 13;
/** No obstacles before this far, so the first moments are only coins. */
const WARM_UP = 55;
/** How close the chaser must still be for a bump to be a catch. */
const STILL_CLOSE = 0.3;

export type Kind = 'obstacle' | 'coin' | 'power' | 'scenery';

export interface Thing {
  kind: Kind;
  /** Distance along the path. */
  s: number;
  /** Across: metres from the middle. */
  x: number;
  /** Height off the ground, for coins in an arc and powers floating. */
  y: number;
  sprite: string;
  act?: Act;
  power?: Power;
  /** Hit, taken or knocked aside, with how long ago. */
  gone?: number;
  /** Pulled towards him by the magnet, 0 to 1. */
  pull?: number;
  /** Scenery facing the other way, for variety. */
  flip?: boolean;
}

export type Event =
  | { type: 'coin'; streak: number }
  | { type: 'jump' } | { type: 'duck' } | { type: 'steer' }
  | { type: 'bump' } | { type: 'pop' }
  | { type: 'power'; power: Power }
  | { type: 'close' }
  | { type: 'caught' };

/** A small seeded random, so a run can be replayed exactly in a test. */
function random (seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Run {
  readonly world: World;
  readonly scare: Scare;
  private rand: () => number;

  time = 0;
  /** How far he has run. He is at this distance; the camera is AHEAD behind. */
  dist = 0;
  speed = 0;
  /** -1, 0 or 1. */
  lane = 0;
  /** Where he is across, easing towards the lane. */
  x = 0;
  /** Height off the ground, and speed upwards, while hopping. */
  y = 0;
  vy = 0;
  /** Counting down while ducking and while stumbling. */
  sliding = 0;
  stumbling = 0;
  /** Which way he is leaning while changing lane, -1, 0 or 1. */
  lean = 0;
  /** 0, far behind, to 1, right on his heels. */
  danger = 0;
  coins = 0;
  streak = 0;
  private streakAt = -1;
  powers: Partial<Record<Power, number>> = {};
  caught = false;
  /** How long since he was caught, for the chaser's last lunge. */
  caughtFor = 0;

  things: Thing[] = [];
  private nextRow = 18;
  private nextScenery = 0;
  private nextPower = 160;
  /**
   * The distance a hop floats or a duck holds until, when it was pressed for
   * something close ahead. A small child presses when the button lights up,
   * which is often a little early; this makes early still work.
   */
  private holdTo = 0;
  private buffered: 'jump' | 'duck' | null = null;
  private bufferedFor = 0;

  events: Event[] = [];

  constructor (world: WorldId, scare: Scare, seed = Date.now()) {
    this.world = WORLDS[world];
    this.scare = scare;
    this.rand = random(seed);
    this.speed = this.pace();
    this.spawn();
  }

  get grounded (): boolean { return this.y <= 0 && this.vy <= 0; }

  /** Metres a second: from 8 to 14 over two minutes, gentler on silly. */
  private pace (): number {
    const ramp = Math.min(this.time, 120) / 120;
    return (8 + ramp * 6) * (this.scare === 1 ? 0.88 : 1);
  }

  has (p: Power): boolean { return (this.powers[p] ?? 0) > 0; }

  // ---- moves ---------------------------------------------------------------

  steer (dir: -1 | 1): void {
    if (this.caught) return;
    const to = Math.max(-1, Math.min(1, this.lane + dir));
    if (to === this.lane) return;
    this.lane = to;
    this.lean = dir;
    this.events.push({ type: 'steer' });
  }

  jump (): void {
    if (this.caught) return;
    if (!this.grounded) { this.buffer('jump'); return; }
    this.sliding = 0;
    this.vy = this.has('springs') ? JUMP_HIGH : JUMP;
    this.holdTo = this.next(this.has('springs') ? ['jump', 'block'] : ['jump']);
    this.events.push({ type: 'jump' });
  }

  duck (): void {
    if (this.caught) return;
    if (!this.grounded) {
      // Down in the air comes down fast, and ducks on landing.
      this.vy = Math.min(this.vy, -9);
      this.buffer('duck');
      return;
    }
    this.sliding = SLIDE;
    this.holdTo = this.next(['duck']);
    this.events.push({ type: 'duck' });
  }

  /** Just past the nearest thing of these kinds coming up in his lane, if one is close. */
  private next (acts: Act[]): number {
    let s = 0;
    for (const t of this.things) {
      if (t.kind !== 'obstacle' || t.gone !== undefined || !acts.includes(t.act!)) continue;
      const along = t.s - this.dist;
      if (along < -0.5 || along > this.speed * 1.3) continue;
      if (Math.abs(t.x - this.lane * LANE) > 0.2) continue;
      if (!s || t.s < s) s = t.s;
    }
    return s ? s + 0.7 : 0;
  }

  /** A press a moment too early still counts, as it lands. */
  private buffer (move: 'jump' | 'duck'): void {
    this.buffered = move;
    this.bufferedFor = 0.2;
  }

  // ---- the world -----------------------------------------------------------

  private pick<T> (list: readonly T[]): T { return list[Math.floor(this.rand() * list.length)]; }

  private add (t: Thing): void { this.things.push(t); }

  private coinsFrom (s: number, lane: number, n: number, arc = false): void {
    for (let i = 0; i < n; i++) {
      const y = arc ? Math.sin((i / (n - 1)) * Math.PI) * 1.5 : 0;
      this.add({ kind: 'coin', s: s + i * 2.2, x: lane * LANE, y: 0.35 + y, sprite: 'pick-coin' });
    }
  }

  /** Keeps the path filled out to the horizon. */
  private spawn (): void {
    while (this.nextScenery < this.dist + HORIZON + 10) {
      // Both sides, most of the time: low things close to the path, tall
      // ones further out, so it feels like a path through somewhere.
      for (const side of [-1, 1]) {
        if (this.rand() < 0.25) continue;
        const sprite = this.pick(this.world.scenery);
        const tall = sprite.endsWith('palm') || sprite.endsWith('tree');
        const x = side * (LANE * 1.5 + (tall ? 2.2 : 0.9) + this.rand() * (tall ? 2.5 : 1.2));
        this.add({ kind: 'scenery', s: this.nextScenery + this.rand() * 1.5, x, y: 0, sprite, flip: this.rand() < 0.5 });
      }
      this.nextScenery += 2.4 + this.rand() * 1.8;
    }

    while (this.nextRow < this.dist + HORIZON + 10) {
      const s = this.nextRow;
      const ramp = Math.min(this.time, 120) / 120;
      // Rows arrive every 1.7 seconds at first, every 1.15 at the end.
      const gap = this.pace() * (1.7 - ramp * 0.55) * (0.9 + this.rand() * 0.25);
      this.nextRow += gap;

      if (s < WARM_UP) {
        this.coinsFrom(s, this.pick([-1, 0, 1]), 5);
        continue;
      }

      const lanes = [-1, 0, 1].sort(() => this.rand() - 0.5);
      // Later on, sometimes two lanes are in the way. Never three that must
      // be gone round: the third is always open, or a log to hop.
      const two = this.time > 25 && this.rand() < 0.35 + ramp * 0.25;
      const wall = this.time > 45 && this.rand() < 0.12;
      if (wall) {
        for (const l of [-1, 0, 1]) this.obstacle(s, l, 'jump');
        this.coinsFrom(s - 3.3, lanes[0], 4, true);
        continue;
      }
      const first: Act = this.pick(['jump', 'duck', 'block', 'jump', 'block'] as const);
      this.obstacle(s, lanes[0], first);
      if (two) this.obstacle(s, lanes[1], this.pick(['block', 'jump', 'duck'] as const));
      const open = two ? lanes[2] : lanes[this.rand() < 0.5 ? 1 : 2];

      if (s >= this.nextPower && this.rand() < 0.6) {
        const power = this.pick(['magnet', 'bubble', 'springs', 'jar'] as const);
        this.add({ kind: 'power', s: s + gap / 2, x: open * LANE, y: 0.55, sprite: 'pick-' + power, power });
        this.nextPower = s + 260 + this.rand() * 200;
      } else if (first === 'jump' && this.rand() < 0.5) {
        this.coinsFrom(s - 3.3, lanes[0], 4, true);
      } else {
        this.coinsFrom(s + 3, open, 4 + Math.floor(this.rand() * 3));
      }
    }
  }

  private obstacle (s: number, lane: number, act: Act): void {
    this.add({ kind: 'obstacle', s, x: lane * LANE, y: 0, sprite: this.pick(this.world.obstacles[act]), act, flip: this.rand() < 0.5 });
  }

  // ---- a step --------------------------------------------------------------

  step (dt: number): void {
    dt = Math.min(dt, 1 / 20);
    this.events = [];
    if (this.caught) {
      this.caughtFor += dt;
      this.speed = Math.max(0, this.speed - 30 * dt);
      this.dist += this.speed * dt;
      return;
    }
    this.time += dt;
    const target = this.pace() * (this.stumbling > 0 ? 0.7 : 1);
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    this.dist += this.speed * dt;

    // Across, towards the lane.
    const goal = this.lane * LANE;
    const d = goal - this.x;
    const move = Math.sign(d) * Math.min(Math.abs(d), STEER * dt);
    this.x += move;
    if (Math.abs(goal - this.x) < 0.05) this.lean = 0;

    // Up and down.
    const holding = this.dist < this.holdTo;
    if (!this.grounded || this.vy > 0) {
      // Floating over the thing he hopped for, until it has gone by.
      if (holding && this.vy < 0 && this.y < 1.0) this.vy = 0;
      else this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.sliding = holding && this.sliding > 0 ? Math.max(this.sliding, 0.15) : Math.max(0, this.sliding - dt);
    this.stumbling = Math.max(0, this.stumbling - dt);
    if (this.buffered) {
      this.bufferedFor -= dt;
      if (this.grounded) {
        const m = this.buffered;
        this.buffered = null;
        if (m === 'jump') this.jump(); else this.duck();
      } else if (this.bufferedFor <= 0 && this.buffered === 'jump') this.buffered = null;
    }

    // The chaser drops back while he runs clean, faster with the firefly jar.
    const wasClose = this.danger > 0.6;
    this.danger = Math.max(0, this.danger - dt * (this.has('jar') ? 0.22 : 0.1));
    if (!wasClose && this.danger > 0.6) this.events.push({ type: 'close' });

    for (const p of Object.keys(this.powers) as Power[]) {
      if (p === 'bubble') continue;
      this.powers[p] = Math.max(0, (this.powers[p] ?? 0) - dt);
    }

    if (this.streakAt >= 0 && this.time - this.streakAt > 1.2) this.streak = 0;

    this.touch(dt);
    this.spawn();
    // Behind the camera is gone for good.
    const behind = this.dist - AHEAD - 2;
    this.things = this.things.filter((t) => t.s > behind);
  }

  /** What he runs into, picks up, and hops over. */
  private touch (dt: number): void {
    const magnet = this.has('magnet');
    for (const t of this.things) {
      if (t.gone !== undefined) { t.gone += dt; continue; }
      const along = t.s - this.dist;

      if (t.kind === 'coin' && magnet && along < 14 && along > -0.5) {
        t.pull = Math.min(1, (t.pull ?? 0) + dt * 3);
        t.x += (this.x - t.x) * t.pull;
        t.y += (this.y + 0.6 - t.y) * t.pull * 0.5;
      }

      if (Math.abs(along) > 0.55) continue;
      const across = Math.abs(t.x - this.x);

      if (t.kind === 'coin' && across < 0.85 && Math.abs(t.y - (this.y + 0.5)) < 1.1) {
        t.gone = 0;
        this.coins += 1;
        this.streak = this.time - this.streakAt < 1.2 ? this.streak + 1 : 0;
        this.streakAt = this.time;
        this.events.push({ type: 'coin', streak: this.streak });
      } else if (t.kind === 'power' && across < 0.9) {
        t.gone = 0;
        this.powers[t.power!] = POWER_TIME[t.power!];
        this.events.push({ type: 'power', power: t.power! });
      } else if (t.kind === 'obstacle' && across < 0.95) {
        const clear =
          (t.act === 'jump' && this.y > 0.5) ||
          (t.act === 'duck' && this.sliding > 0) ||
          (t.act === 'block' && this.has('springs') && this.y > 1.4);
        if (!clear) {
          t.gone = 0;
          this.bump();
        }
      }
    }
  }

  private bump (): void {
    if (this.has('bubble')) {
      delete this.powers.bubble;
      this.events.push({ type: 'pop' });
      return;
    }
    this.stumbling = STUMBLE;
    this.sliding = 0;
    if (this.danger > STILL_CLOSE) {
      this.caught = true;
      this.danger = 1;
      this.events.push({ type: 'caught' });
      return;
    }
    this.danger = 1;
    this.events.push({ type: 'bump' });
  }

  /** The move that gets him past whatever is next in his lane, if anything is close. */
  hint (): Act | null {
    if (this.caught) return null;
    const soon = this.speed * 1.0;
    let best: Thing | null = null;
    for (const t of this.things) {
      if (t.kind !== 'obstacle' || t.gone !== undefined) continue;
      const along = t.s - this.dist;
      if (along < 0.5 || along > soon) continue;
      if (Math.abs(t.x - this.lane * LANE) > 0.2) continue;
      if (!best || t.s < best.s) best = t;
    }
    return best?.act ?? null;
  }

  /** For a block ahead, which way is open. */
  way (): -1 | 1 {
    const open = (lane: number): boolean => !this.things.some((t) =>
      t.kind === 'obstacle' && t.act === 'block' && t.gone === undefined &&
      Math.abs(t.x - lane * LANE) < 0.2 && t.s - this.dist > 0 && t.s - this.dist < this.speed * 1.2);
    if (this.lane === -1) return 1;
    if (this.lane === 1) return -1;
    return open(-1) ? -1 : 1;
  }
}
