/**
 * Being caught, which is the fun part: each chaser catches him its own silly
 * way, played out in a spotlight over the path. No words and no "game over";
 * he is laughing in every one.
 *
 *   gorilla   swings him up onto its shoulders
 *   bear      the biggest hug
 *   bog       swallows him and burps him out green
 *   croc      tickles him with its tail
 *   trex      tiny arms cannot reach, so it sneezes him into the leaves
 *   raptor    runs off with his shoe
 *   mummy     wraps him up like a present
 *   pumpkin   his crows come down and sit on him
 *   longlegs  rocks him in a hammock of branches
 */
import type { Catch, Chaser } from './world';
import { img, has } from './sprites';

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (t: number): number => Math.max(0, Math.min(1, t));
/** A little wriggle once he is wrapped. */
const p1 = (t: number): number => (t > 2 ? Math.sin(t * 7) * 0.05 : 0);

interface Pose { key: string; x: number; foot: number; h: number; flip?: boolean; rot?: number; alpha?: number; sx?: number; sy?: number }

function put (ctx: CanvasRenderingContext2D, p: Pose): [number, number] {
  if (!has(p.key)) return [0, 0];
  const im = img(p.key);
  const w = (p.h * im.width) / im.height;
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.foot);
  if (p.rot) ctx.rotate(p.rot);
  ctx.scale((p.flip ? -1 : 1) * (p.sx ?? 1), p.sy ?? 1);
  ctx.drawImage(im, -w / 2, -p.h, w, p.h);
  ctx.restore();
  return [w, p.h];
}

/** The same picture, washed green, for coming out of the bog. */
let greenCanvas: HTMLCanvasElement | null = null;
function greened (key: string): HTMLCanvasElement | null {
  if (!has(key)) return null;
  if (greenCanvas) return greenCanvas;
  const im = img(key);
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const g = c.getContext('2d')!;
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(120,220,40,0.45)';
  g.fillRect(0, 0, c.width, c.height);
  greenCanvas = c;
  return c;
}

function heart (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.fill();
}

function leaf (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, shade: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = ['#4E9A36', '#6DB84A', '#3E8430', '#8BC34A'][shade % 4];
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A crow, flying (wings up and down) or sitting. */
function crow (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, flap: number, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#1B1B24';
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.85, -r * 0.45, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.1); ctx.lineTo(-r * 1.6, -r * 0.35); ctx.lineTo(-r * 1.5, r * 0.25); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.2);
  ctx.lineTo(r * 0.1, -r * 0.2 - r * 1.3 * flap);
  ctx.lineTo(r * 0.5, -r * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F4A020';
  ctx.beginPath(); ctx.moveTo(r * 1.2, -r * 0.5); ctx.lineTo(r * 1.65, -r * 0.35); ctx.lineTo(r * 1.2, -r * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(r * 0.95, -r * 0.55, r * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** His rainbow trainer, for the raptor to run off with. */
function shoe (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.roundRect(-r, -r * 0.2, r * 2, r * 0.5, r * 0.2); ctx.fill();
  const colours = ['#E8453C', '#F4A020', '#F4D03F', '#4CAF50', '#2F6FD6'];
  colours.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.roundRect(-r * 0.9 + i * r * 0.28, -r * 0.75, r * 0.3, r * 0.6, r * 0.1); ctx.fill();
  });
  ctx.fillStyle = '#EDEDED';
  ctx.beginPath(); ctx.roundRect(-r * 1.02, r * 0.2, r * 2.04, r * 0.22, r * 0.1); ctx.fill();
  ctx.restore();
}

/**
 * Bandages, wound round him from his feet to his chin as p goes from 0 to 1,
 * and a bow on the front when he is done: a present with a laughing face.
 */
function wrap (ctx: CanvasRenderingContext2D, x: number, foot: number, w: number, h: number, p: number, t: number): void {
  const chin = foot - h * 0.64;
  const top = foot - (foot - chin) * p;
  const half = w * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - half, top, half * 2, foot - top, Math.min(half * 0.5, (foot - top) / 2));
  ctx.clip();
  const strip = h * 0.06;
  for (let i = 0; i * strip < foot - chin + strip * 2; i++) {
    const y = foot - i * strip;
    ctx.fillStyle = i % 2 ? '#EDE5CF' : '#D9CDAF';
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y - strip * 0.7);
    ctx.lineTo(x + half, y - strip * 1.9);
    ctx.lineTo(x - half, y - strip * 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (p >= 1) {
    const s = 1 + Math.sin(t * 6) * 0.06;
    const r = w * 0.13;
    ctx.save();
    ctx.translate(x + half * 0.35, chin + h * 0.14);
    ctx.scale(s, s);
    ctx.fillStyle = '#E8453C';
    ctx.beginPath(); ctx.ellipse(-r, 0, r, r * 0.6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r, 0, r, r * 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-r * 0.25, 0, r * 0.5, r * 1.3);
    ctx.fillStyle = '#B92E26';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/**
 * One frame of the catch, T seconds in. The picture behind is already drawn;
 * this dims it, lights a spot in the middle, and plays the catch there.
 */
export function drawCatch (ctx: CanvasRenderingContext2D, W: number, H: number, who: Chaser, T: number): void {
  const fadeIn = clamp(T / 0.4);
  const g = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, Math.max(W, H) * 0.7);
  g.addColorStop(0, `rgba(255,236,190,${0.25 * fadeIn})`);
  g.addColorStop(0.5, `rgba(20,16,40,${0.45 * fadeIn})`);
  g.addColorStop(1, `rgba(10,8,24,${0.8 * fadeIn})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Standing clear of the buttons that come up underneath.
  const floor = Math.min(H * 0.9, H - 190);
  const U = Math.min(floor * 0.8, W * 0.8);
  const kid = U * 0.5;
  const cx = W / 2;
  const enter = ease(T / 0.5);
  const beast = 'chaser-' + who.id;
  const move: Catch = who.catches;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, floor, U * 0.55, U * 0.06, 0, 0, Math.PI * 2); ctx.fill();

  switch (move) {
    case 'shoulders': {
      const bounce = Math.abs(Math.sin(T * 5)) * U * 0.02;
      put(ctx, { key: beast, x: cx, foot: floor - bounce, h: U, alpha: enter });
      const up = ease((T - 0.5) / 0.8);
      const sx = cx + (1 - up) * U * 0.45;
      const sf = floor - up * U * 0.72 - Math.sin(up * Math.PI) * U * 0.25 - bounce;
      put(ctx, { key: up > 0.2 ? 'sukhi-cheer' : 'sukhi-laugh', x: sx, foot: sf, h: kid, rot: Math.sin(T * 5) * 0.05 * up });
      break;
    }
    case 'hug': {
      const squeeze = T > 0.7 ? Math.sin((T - 0.7) * 6) * 0.05 : 0;
      put(ctx, { key: beast, x: cx, foot: floor, h: U, alpha: enter, sx: 1 - squeeze, sy: 1 + squeeze * 0.5 });
      put(ctx, { key: 'sukhi-laugh', x: cx, foot: floor - U * 0.1, h: kid * 0.95, sx: 1 - squeeze * 1.5 });
      ctx.fillStyle = '#FF5A7A';
      for (let i = 0; i < 5; i++) {
        const k = ((T * 0.6 + i / 5) % 1);
        if (T < 0.8) break;
        ctx.globalAlpha = 1 - k;
        heart(ctx, cx + Math.sin(i * 2.1 + T) * U * 0.35, floor - U * (0.8 + k * 0.5), U * 0.04);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'burp': {
      const out = ease((T - 1.3) / 0.6);
      const wob = T < 1.3 ? Math.sin(T * 14) * 0.06 * clamp(T - 0.4) : 0;
      if (T < 0.7) put(ctx, { key: 'sukhi-laugh', x: cx + U * 0.3 * (1 - ease(T / 0.7)), foot: floor, h: kid });
      put(ctx, { key: beast, x: cx, foot: floor, h: U * 0.9, alpha: enter, sx: 1 + wob, sy: 1 - wob + (T > 1.2 && T < 1.45 ? 0.08 : 0) });
      if (T >= 1.3) {
        const green = greened('sukhi-laugh');
        const x = cx + out * U * 0.55;
        const foot = floor - Math.sin(out * Math.PI) * U * 0.5;
        if (green) {
          const w = (kid * green.width) / green.height;
          ctx.save(); ctx.translate(x, foot); ctx.rotate((1 - out) * -1.2);
          ctx.drawImage(green, -w / 2, -kid, w, kid);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(160,230,60,0.8)';
        for (let i = 0; i < 12; i++) {
          const k = (T - 1.3) * 1.2 + i * 0.37;
          const a = i * 2.4;
          ctx.beginPath();
          ctx.arc(cx + U * 0.1 + Math.cos(a) * k * U * 0.2, floor - U * 0.55 - k * U * 0.12 + Math.sin(a) * U * 0.08, U * 0.018 * (1 + (i % 3)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'tickle': {
      put(ctx, { key: beast, x: cx - U * 0.2, foot: floor, h: U * 0.95, alpha: enter, rot: Math.sin(T * 3) * 0.04 });
      const giggle = T > 0.5 ? Math.sin(T * 26) * 0.12 : 0;
      const [sw] = put(ctx, { key: 'sukhi-laugh', x: cx + U * 0.32, foot: floor - Math.abs(Math.sin(T * 13)) * U * 0.03, h: kid, rot: giggle });
      if (T > 0.5) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(2, U * 0.008);
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const x = cx + U * 0.32 + (i - 1) * sw * 0.55;
          const y = floor - kid * (0.4 + (i % 2) * 0.25);
          ctx.beginPath();
          for (let j = 0; j <= 8; j++) ctx.lineTo(x + Math.sin(j + T * 20) * U * 0.012, y - j * U * 0.012);
          ctx.stroke();
        }
      }
      break;
    }
    case 'sneeze': {
      const back = T > 0.4 && T < 1.2 ? ease((T - 0.4) / 0.8) : 0;
      const achoo = T >= 1.2 ? Math.max(0, 1 - (T - 1.2) * 3) : 0;
      put(ctx, { key: beast, x: cx - U * 0.22, foot: floor, h: U, alpha: enter, rot: -back * 0.12 + achoo * 0.12, flip: true });
      put(ctx, { key: 'sukhi-laugh', x: cx + U * 0.36, foot: floor, h: kid, rot: T > 1.2 ? Math.sin(T * 8) * 0.05 : 0 });
      if (T >= 1.2) {
        const k = T - 1.2;
        for (let i = 0; i < 28; i++) {
          const fly = clamp(k * 1.6 - (i % 7) * 0.05);
          const sx = cx - U * 0.05; const sy = floor - U * 0.78;
          const ex = cx + U * 0.36 + Math.sin(i * 3.3) * kid * 0.45;
          const ey = floor - kid * (0.1 + ((i * 37) % 90) / 100);
          const x = sx + (ex - sx) * ease(fly);
          const y = sy + (ey - sy) * fly + Math.sin(fly * Math.PI) * -U * 0.1;
          leaf(ctx, x, y, U * 0.03, i + k * (1 - fly) * 6, i);
        }
      }
      break;
    }
    case 'shoe': {
      const dash = ease((T - 0.6) / 0.5);
      const circle = T > 1.1 ? Math.sin((T - 1.1) * 2.2) : 0;
      const rx = cx + U * 0.4 - dash * U * 0.5 + circle * U * 0.25;
      put(ctx, { key: 'sukhi-laugh', x: cx - U * 0.25, foot: floor - Math.abs(Math.sin(T * 7)) * U * 0.04, h: kid });
      put(ctx, { key: beast, x: rx, foot: floor - Math.abs(Math.sin(T * 12)) * U * 0.03, h: U * 0.85, alpha: enter, flip: T > 1.1 ? Math.cos((T - 1.1) * 2.2) > 0 : false });
      if (T > 1.0) shoe(ctx, rx - U * 0.06, floor - U * 0.66, U * 0.06, Math.sin(T * 10) * 0.3);
      break;
    }
    case 'wrap': {
      put(ctx, { key: beast, x: cx - U * 0.28, foot: floor, h: U, alpha: enter, rot: Math.sin(T * 4) * 0.03 });
      const sx = cx + U * 0.28;
      const [w, h] = put(ctx, { key: 'sukhi-toward', x: sx, foot: floor, h: kid, rot: p1(T) });
      const p = clamp((T - 0.6) / 1.4);
      wrap(ctx, sx, floor, w, h, p, T);
      // The strip, from the mummy's hand to him, while it is wrapping.
      if (p > 0 && p < 1) {
        ctx.strokeStyle = '#E9E0C8';
        ctx.lineWidth = U * 0.02;
        ctx.beginPath();
        ctx.moveTo(cx - U * 0.02, floor - U * 0.62);
        ctx.quadraticCurveTo(cx + U * 0.1, floor - U * 0.3, sx - w * 0.3, floor - h * 0.64 * p);
        ctx.stroke();
      }
      break;
    }
    case 'crows': {
      put(ctx, { key: beast, x: cx - U * 0.26, foot: floor, h: U, alpha: enter });
      const sx = cx + U * 0.3;
      const [w, h] = put(ctx, { key: 'sukhi-laugh', x: sx, foot: floor, h: kid, rot: Math.sin(T * 3) * 0.03 });
      const spots: [number, number][] = [[0, -1.02], [-0.42, -0.62], [0.44, -0.66], [-0.2, -0.98], [0.24, -0.97]];
      spots.forEach(([ox, oy], i) => {
        const land = ease((T - 0.4 - i * 0.25) / 0.7);
        const tx = sx + ox * w; const ty = floor + oy * h;
        const fx = W + U * 0.2; const fy = -U * 0.1 + i * U * 0.1;
        const x = fx + (tx - fx) * land;
        const y = fy + (ty - fy) * land - Math.sin(land * Math.PI) * U * 0.15;
        const flap = land < 1 ? (Math.sin(T * 24 + i) + 1) / 2 : 0.1 + Math.max(0, Math.sin(T * 3 + i * 1.7)) * 0.2;
        crow(ctx, x, y, U * 0.045, flap, -1);
      });
      break;
    }
    case 'hammock': {
      const tall = U * 1.25;
      put(ctx, { key: beast, x: cx, foot: floor, h: tall, alpha: enter });
      const lift = ease((T - 0.4) / 0.8);
      const swing = Math.sin(T * 2.4) * 0.18 * lift;
      const hy = floor - tall * 0.47;
      const span = tall * 0.26;
      const kx = cx + Math.sin(swing) * span * 0.4;
      const ky = floor + (hy + span * 0.35 - floor) * lift;
      put(ctx, { key: 'sukhi-laugh', x: kx, foot: ky + kid * 0.32, h: kid * 0.9, rot: -1.25 * lift + swing });
      if (lift > 0) {
        // The hammock in front of him: two ropes of twigs and a net between.
        ctx.strokeStyle = '#6B4A2F';
        ctx.lineWidth = U * 0.014;
        ctx.globalAlpha = lift;
        ctx.beginPath();
        ctx.moveTo(cx - span, hy);
        ctx.quadraticCurveTo(kx, ky + span * 0.5, cx + span, hy);
        ctx.stroke();
        ctx.lineWidth = U * 0.006;
        for (let i = 1; i < 8; i++) {
          const a = i / 8;
          const x = (1 - a) * (1 - a) * (cx - span) + 2 * a * (1 - a) * kx + a * a * (cx + span);
          const y = (1 - a) * (1 - a) * hy + 2 * a * (1 - a) * (ky + span * 0.5) + a * a * hy;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + span * 0.05, y - span * 0.25); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
  }
}

/** When to show the button to go again: once the catch has played. */
export const CATCH_TIME = 2.2;
