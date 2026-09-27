/**
 * Drawing a run: a painted sky, a path drawn in perspective, and everything on
 * it as flat pictures standing up, the nearest last. Canvas 2D and nothing
 * else, so it runs on an old tablet.
 *
 * The camera is behind Sukhi and a little above him. A point x across, y up
 * and z in front of the camera lands on the screen at
 *
 *     left = middle + (x - camera) * f / z
 *     top  = horizon + (height - y) * f / z
 *
 * which is all the 3D there is. f is chosen so the three lanes always fit the
 * width, and on an upright phone the camera goes higher, so the path fills the
 * tall screen instead of leaving it mostly sky.
 */
import { AHEAD, HORIZON, LANE, type Run, type Thing } from './game';
import { SIZES, type Chaser, type Power } from './world';
import { img, has } from './sprites';

export interface View {
  w: number;
  h: number;
  f: number;
  horizon: number;
  camY: number;
  camX: number;
  mid: number;
}

export function view (w: number, h: number, x: number): View {
  const tall = h / w;
  const camY = Math.max(2.3, Math.min(4.4, 2.3 + (tall - 0.62) * 1.9));
  // Lanes to fill most of the width at his distance, but never so big he
  // towers over the screen.
  const f = Math.min(h * 0.88, (w * 0.98 * AHEAD) / (3 * LANE + 0.6));
  const feet = h * (tall > 1 ? 0.74 : 0.8);
  const horizon = Math.max(h * 0.2, feet - (camY * f) / AHEAD);
  return { w, h, f, horizon, camY, camX: x * 0.55, mid: w / 2 };
}

const px = (v: View, x: number, z: number): number => v.mid + ((x - v.camX) * v.f) / z;
const py = (v: View, y: number, z: number): number => v.horizon + ((v.camY - y) * v.f) / z;

/** A picture's size in metres, from whichever of width or height is set. */
function size (key: string, im: HTMLImageElement): [number, number] {
  const s = SIZES[key] ?? SIZES[key.replace(/-.*/, '')] ?? { h: 1 };
  const ratio = im.width / im.height;
  if (s.w) return [s.w, s.w / ratio];
  return [s.h! * ratio, s.h!];
}

/** Draws a picture standing at x, y, z, feet down; returns its screen box. */
function stand (ctx: CanvasRenderingContext2D, v: View, key: string, x: number, y: number, z: number,
  opts: { flip?: boolean; alpha?: number; scale?: number; rot?: number; shadow?: boolean; sizeKey?: string } = {}): void {
  if (!has(key) || z < 0.4) return;
  const im = img(key);
  const [mw, mh] = size(opts.sizeKey ?? key, im);
  const k = opts.scale ?? 1;
  const w = (mw * v.f * k) / z;
  const h = (mh * v.f * k) / z;
  const cx = px(v, x, z);
  const foot = py(v, y, z);
  if (cx + w < 0 || cx - w > v.w) return;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.shadow !== false) {
    const g = py(v, 0, z);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, g, w * 0.42, Math.max(2, w * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(cx, foot);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
}

function sky (ctx: CanvasRenderingContext2D, v: View, run: Run): void {
  const key = 'sky-' + run.world.id;
  ctx.fillStyle = run.world.fog;
  ctx.fillRect(0, 0, v.w, v.horizon + 2);
  if (!has(key)) return;
  const im = img(key);
  // Cover the space above the horizon, the picture's bottom on the horizon,
  // drifting a little as he changes lane.
  const scale = Math.max(v.w * 1.12 / im.width, (v.horizon + 2) / im.height);
  const w = im.width * scale;
  const h = im.height * scale;
  const x = (v.w - w) / 2 - v.camX * v.w * 0.02;
  ctx.drawImage(im, x, v.horizon + 2 - h, w, h);
}

function ground (ctx: CanvasRenderingContext2D, v: View, run: Run): void {
  const W = run.world;
  const cam = run.dist - AHEAD;
  const tile = 2.4;
  const near = 0.8;
  const half = LANE * 1.5 + 0.25;
  ctx.fillStyle = W.side[0];
  ctx.fillRect(0, v.horizon, v.w, v.h - v.horizon);
  let k = Math.floor((cam + HORIZON) / tile);
  for (; ; k--) {
    const s1 = k * tile;
    const s0 = Math.max(s1 - tile, cam + near);
    const zFar = s1 - cam;
    const zNear = s0 - cam;
    if (zNear >= zFar) break;
    const yF = py(v, 0, zFar);
    const yN = zNear <= near + 0.001 ? v.h + 2 : py(v, 0, zNear);
    const odd = (k & 1) === 1;
    ctx.fillStyle = W.side[odd ? 1 : 0];
    ctx.fillRect(0, yF, v.w, yN - yF + 1);
    const lF = px(v, -half, zFar); const rF = px(v, half, zFar);
    const lN = px(v, -half, zNear); const rN = px(v, half, zNear);
    // The edge stones.
    const e = 0.3;
    ctx.fillStyle = W.edge;
    quad(ctx, px(v, -half - e, zFar), yF, px(v, half + e, zFar), px(v, half + e, zNear), yN, px(v, -half - e, zNear));
    ctx.fillStyle = W.path[odd ? 1 : 0];
    quad(ctx, lF, yF, rF, rN, yN, lN);
    // A joint between tiles or planks, and the lane lines.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = Math.max(1, (0.05 * v.f) / zFar);
    ctx.beginPath();
    ctx.moveTo(lF, yF); ctx.lineTo(rF, yF);
    for (const lx of [-LANE / 2, LANE / 2]) {
      ctx.moveTo(px(v, lx, zFar), yF);
      ctx.lineTo(px(v, lx, zNear), yN);
    }
    ctx.stroke();
    if (s0 <= cam + near) break;
  }
  // A haze where the path meets the sky, thin enough to keep the green.
  const band = (v.h - v.horizon) * 0.14;
  const g = ctx.createLinearGradient(0, v.horizon - band * 0.5, 0, v.horizon + band);
  g.addColorStop(0, hexA(W.fog, 0));
  g.addColorStop(0.35, hexA(W.fog, 0.85));
  g.addColorStop(1, hexA(W.fog, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, v.horizon - band * 0.5, v.w, band * 1.5);
}

function quad (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, x2: number, y2: number, x3: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x2, y2); ctx.lineTo(x3, y2);
  ctx.closePath();
  ctx.fill();
}

function hexA (hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Which picture of him, and how, from what he is doing. */
function sukhi (ctx: CanvasRenderingContext2D, v: View, run: Run, t: number, blink: boolean): void {
  // Once the catch is playing, he is in the spotlight instead.
  if (run.caughtFor > 0.6) return;
  const z = AHEAD;
  let key = 'sukhi-run';
  let flip = Math.floor(t * 7) % 2 === 1;
  let bob = Math.abs(Math.sin(t * 22)) * 0.06;
  let rot = 0;
  if (run.caught) { key = 'sukhi-stumble'; flip = false; bob = 0; }
  else if (run.stumbling > 0) { key = 'sukhi-stumble'; flip = false; rot = Math.sin(run.stumbling * 30) * 0.08; bob = 0; }
  else if (run.y > 0.05) { key = 'sukhi-jump'; flip = false; bob = 0; }
  else if (run.sliding > 0) { key = 'sukhi-slide'; flip = false; bob = 0; }
  else if (run.lean !== 0) { key = 'sukhi-lean'; flip = run.lean < 0; bob = 0; }
  if (blink && Math.floor(t * 12) % 2 === 0) return;
  const scale = key === 'sukhi-slide' ? 0.62 : key === 'sukhi-jump' ? 1.02 : 1;
  stand(ctx, v, key, run.x, run.y + bob, z, { flip, rot, sizeKey: 'sukhi', scale: key === 'sukhi-run' ? 1 : scale * heightFix(key) });
}

/** The poses are cut from different sheets; this evens out how tall he looks. */
function heightFix (key: string): number {
  return ({ 'sukhi-stumble': 1.05, 'sukhi-lean': 1.0, 'sukhi-jump': 1.0, 'sukhi-slide': 1.0 } as Record<string, number>)[key] ?? 1;
}

function powerGlow (ctx: CanvasRenderingContext2D, v: View, run: Run, t: number): void {
  if (!run.has('bubble')) return;
  const cx = px(v, run.x, AHEAD);
  const cy = py(v, run.y + 0.62, AHEAD);
  const r = (0.95 * v.f) / AHEAD * (1 + Math.sin(t * 5) * 0.03);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.7, 'rgba(140,210,255,0.12)');
  g.addColorStop(1, 'rgba(120,190,255,0.5)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function thing (ctx: CanvasRenderingContext2D, v: View, run: Run, o: Thing, t: number): void {
  const z = o.s - (run.dist - AHEAD);
  if (z > HORIZON + AHEAD || z < 0.6) return;
  const fade = Math.min(1, (HORIZON + AHEAD - z) / 14);
  if (o.kind === 'coin') {
    if (o.gone !== undefined) {
      // Up and away, getting smaller.
      if (o.gone > 0.3) return;
      stand(ctx, v, o.sprite, o.x, o.y + o.gone * 4, z, { alpha: 1 - o.gone / 0.3, scale: 1 - o.gone, shadow: false });
      return;
    }
    const spin = Math.abs(Math.cos(t * 4 + o.s));
    stand(ctx, v, o.sprite, o.x, o.y, z, { alpha: fade, scale: 1, shadow: o.y < 0.6, flip: spin < 0.5 });
    return;
  }
  if (o.kind === 'power') {
    if (o.gone !== undefined) return;
    stand(ctx, v, o.sprite, o.x, o.y + Math.sin(t * 3 + o.s) * 0.12, z, { alpha: fade });
    return;
  }
  if (o.kind === 'obstacle' && o.gone !== undefined) {
    // Knocked aside: tumbles off the path and fades.
    const k = Math.min(1, o.gone / 0.6);
    const dir = o.x >= run.x ? 1 : -1;
    stand(ctx, v, o.sprite, o.x + dir * k * 2.5, k * 1.2 - k * k * 1.4, z, { alpha: 1 - k, rot: dir * k * 1.2, flip: o.flip, shadow: false });
    return;
  }
  stand(ctx, v, o.sprite, o.x, o.y, z, { alpha: fade, flip: o.flip, shadow: o.kind === 'obstacle' });
}

/**
 * The chaser, drawn close behind the camera: rising up from the bottom of the
 * screen as it gets closer, on the side away from Sukhi.
 */
function chaser (ctx: CanvasRenderingContext2D, v: View, run: Run, who: Chaser, t: number, state: { side: number }): void {
  const key = 'chaser-' + who.id;
  // Once the catch is playing, it is in the spotlight instead.
  if (!has(key) || run.caughtFor > 0.6) return;
  const im = img(key);
  const want = run.x > 0.2 ? -1 : run.x < -0.2 ? 1 : state.side || 1;
  state.side += (want - state.side) * 0.04;
  const tall = Math.min(v.h * 0.78, v.w * 0.9);
  const h = tall * (who.id === 'longlegs' ? 1.25 : 1);
  const w = (h * im.width) / im.height;
  const lunge = run.caught ? Math.min(1, run.caughtFor * 2.5) : 0;
  const d = Math.max(run.danger, lunge);
  // Just the top of its head at the bottom when far; most of it when close.
  const show = 0.14 + d * 0.62 + lunge * 0.2;
  const bob = Math.abs(Math.sin(t * 9)) * h * 0.02;
  const top = v.h - h * show + bob;
  const cx = v.mid + state.side * v.w * (0.3 - lunge * 0.22);
  ctx.save();
  ctx.translate(cx, top + h);
  ctx.rotate(Math.sin(t * 4.5) * 0.04);
  if (state.side < 0) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
}

/** Darkness around him at night, lifted by the firefly jar. */
function night (ctx: CanvasRenderingContext2D, v: View, run: Run, t: number): void {
  if (!run.world.night) return;
  const cx = px(v, run.x, AHEAD);
  const cy = py(v, 0.8, AHEAD);
  const jar = run.has('jar');
  const r = Math.max(v.w, v.h) * (jar ? 0.9 : 0.55) * (1 + Math.sin(t * 2) * 0.02);
  const g = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
  g.addColorStop(0, 'rgba(8,10,30,0)');
  g.addColorStop(1, `rgba(8,10,30,${jar ? 0.35 : 0.6})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.w, v.h);
}

/** A red edge that grows as the chaser closes in. */
function vignette (ctx: CanvasRenderingContext2D, v: View, run: Run, t: number): void {
  const d = run.caught ? 1 : run.danger;
  if (d <= 0.02) return;
  const pulse = 0.85 + Math.sin(t * 8) * 0.15;
  const r = Math.max(v.w, v.h) * 0.75;
  const g = ctx.createRadialGradient(v.mid, v.h * 0.5, r * 0.45, v.mid, v.h * 0.5, r);
  g.addColorStop(0, 'rgba(160,20,30,0)');
  g.addColorStop(1, `rgba(160,20,30,${0.55 * d * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.w, v.h);
}

export interface Bit { x: number; y: number; vx: number; vy: number; life: number; age: number; color: string; r: number; kind: 'spark' | 'dust' | 'fly' }

function bits (ctx: CanvasRenderingContext2D, list: Bit[]): void {
  for (const b of list) {
    const a = Math.max(0, 1 - b.age / b.life);
    ctx.globalAlpha = b.kind === 'fly' ? a * (0.6 + 0.4 * Math.sin(b.age * 9)) : a;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    if (b.kind === 'spark') {
      star(ctx, b.x, b.y, b.r * (1 - b.age / b.life * 0.5));
    } else {
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function star (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    const X = x + Math.cos(a) * rr; const Y = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.closePath();
}

/** Where on the screen he is, for sparkles. */
export function sukhiAt (v: View, run: Run): [number, number] {
  return [px(v, run.x, AHEAD), py(v, run.y + 0.7, AHEAD)];
}

export function frame (ctx: CanvasRenderingContext2D, v: View, run: Run, who: Chaser, t: number,
  list: Bit[], state: { side: number }, blink: boolean): void {
  sky(ctx, v, run);
  ground(ctx, v, run);
  // Far to near; he goes in among them at his distance.
  const sorted = [...run.things].sort((a, b) => b.s - a.s);
  let drawn = false;
  for (const o of sorted) {
    if (!drawn && o.s <= run.dist + 0.2) {
      sukhi(ctx, v, run, t, blink);
      powerGlow(ctx, v, run, t);
      drawn = true;
    }
    thing(ctx, v, run, o, t);
  }
  if (!drawn) { sukhi(ctx, v, run, t, blink); powerGlow(ctx, v, run, t); }
  night(ctx, v, run, t);
  bits(ctx, list);
  chaser(ctx, v, run, who, t, state);
  vignette(ctx, v, run, t);
}

/** The small rings round each power's picture, for how long is left. */
export const POWER_ICON: Record<Power, string> = { magnet: 'pick-magnet', bubble: 'pick-bubble', springs: 'pick-springs', jar: 'pick-jar' };
