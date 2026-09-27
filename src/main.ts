/**
 * Sukhi's Run.
 *
 * Sukhi runs, something chases him, and he gets caught. For children of about
 * four who cannot read yet, so nothing a child needs is in words: pick a face
 * (or press go for a surprise), steer, and laugh when it catches him.
 *
 * Four moves, three ways, because small hands manage one or the other:
 *
 *   swipe     left, right, up to hop, down to duck; a tap is a hop
 *   buttons   big arrows at the bottom, left and right under one thumb, hop
 *             and duck under the other, and the one he needs glows
 *   keys      the arrows, or W A S D, and Space to hop; Escape pauses
 *
 * How scary it gets is a grown-up's choice, behind a press-and-hold: silly
 * (friendly animals, daylight), spooky (the dinosaurs, the crocodile, the
 * mummy and Pumpkin Jack, and the night swamp) or scary (Long-Legs too).
 */
import './style.css';
import { Run, type Event } from './game';
import { frame, view, sukhiAt, type Bit } from './draw';
import { drawCatch, CATCH_TIME } from './catch';
import { Sound } from './sound';
import { load, URLS } from './sprites';
import * as store from './store';
import { install } from './install';
import { ICONS } from './icons';
import { allowed, chaser, worldFor, CHASERS, POWERS, POWER_TIME, type Chaser, type ChaserId, type Scare } from './world';

const sound = new Sound();
const app = document.getElementById('app')!;

const SCARE_LABEL: Record<Scare, [string, string]> = {
  1: ['Silly', 'The gorilla, the bear and the bog monster, in daylight.'],
  2: ['Spooky', 'Adds the dinosaurs, the crocodile, the mummy and Pumpkin Jack, and the swamp at night.'],
  3: ['Scary', 'Adds Long-Legs, the tall one made of branches.']
};

app.innerHTML = `
  <canvas class="scene" aria-hidden="true"></canvas>

  <section class="start" aria-label="Sukhi's Run">
    <div class="start-top">
      <button type="button" class="round sound" aria-label="Sound"></button>
      <span class="grow"></span>
      <button type="button" class="round grownup" aria-label="For grown-ups: press and hold">${ICONS.grownup}<span class="ring" aria-hidden="true"></span></button>
    </div>
    <h1 class="title">Sukhi's Run</h1>
    <div class="faces" role="group" aria-label="Who chases him"></div>
    <button type="button" class="go" aria-label="Go, with a surprise chaser">${ICONS.go}</button>
  </section>

  <div class="hud" hidden>
    <span class="coins"><img src="${URLS['pick-coin']}" alt="" width="36" height="38"><b>0</b></span>
    <span class="meter" aria-hidden="true">
      <span class="track"><span class="fill"></span></span>
      <img class="m-chaser" alt="" width="52" height="52">
      <img class="m-sukhi" src="${URLS['face-sukhi']}" alt="" width="52" height="52">
    </span>
    <span class="powers" aria-hidden="true"></span>
    <button type="button" class="round pause" aria-label="Pause">${ICONS.pause}</button>
  </div>

  <div class="pad" hidden>
    <div class="steer">
      <button type="button" class="key" data-move="left" aria-label="Left">${ICONS.left}</button>
      <button type="button" class="key" data-move="right" aria-label="Right">${ICONS.right}</button>
    </div>
    <div class="acts">
      <button type="button" class="key" data-move="up" aria-label="Hop">${ICONS.up}</button>
      <button type="button" class="key" data-move="down" aria-label="Duck">${ICONS.down}</button>
    </div>
  </div>

  <section class="overlay paused" hidden aria-label="Paused">
    <button type="button" class="go" data-do="resume" aria-label="Keep running">${ICONS.go}</button>
    <button type="button" class="round big" data-do="home" aria-label="Pick who chases">${ICONS.home}</button>
  </section>

  <section class="overlay caught" hidden aria-label="Caught">
    <span class="total"><img src="${URLS['pick-coin']}" alt="" width="44" height="46"><b>0</b></span>
    <div class="caught-row">
      <button type="button" class="round big" data-do="home" aria-label="Pick who chases">${ICONS.home}</button>
      <button type="button" class="go again" data-do="again" aria-label="Run again">${ICONS.again}</button>
    </div>
  </section>

  <section class="overlay grown" hidden aria-label="For grown-ups">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="grown-title">
      <div class="card-top">
        <h2 id="grown-title">How scary?</h2>
        <button type="button" class="round" data-do="close" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="scares" role="radiogroup" aria-label="How scary">
        ${([1, 2, 3] as Scare[]).map((s) => `
          <button type="button" class="scare" role="radio" data-scare="${s}">
            <img src="${URLS['scare-' + s]}" alt="">
            <span class="scare-text"><b>${SCARE_LABEL[s][0]}</b><span>${SCARE_LABEL[s][1]}</span></span>
          </button>`).join('')}
      </div>
      <p class="note">Being caught is never a game over: a silly moment, then go again. Nothing is collected and it works with no internet.</p>
    </div>
  </section>

  <div class="loading" aria-live="polite"><span></span></div>
`;

const $ = <T extends HTMLElement>(sel: string): T => app.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>('canvas.scene');
const ctx = canvas.getContext('2d')!;
const startEl = $('.start');
const hud = $('.hud');
const pad = $('.pad');
const pausedEl = $('.paused');
const caughtEl = $('.caught');
const grownEl = $('.grown');
const facesEl = $('.faces');
const coinsEl = $('.hud .coins b');
const meterFill = $('.meter .fill');
const meterChaser = $<HTMLImageElement>('.m-chaser');
const powersEl = $('.powers');
const soundBtn = $<HTMLButtonElement>('.sound');
startEl.style.setProperty('--cover', `url("${URLS.cover}")`);

type Mode = 'start' | 'run' | 'paused' | 'caught';
let mode: Mode = 'start';
let scare = store.scare();
let run: Run | null = null;
let who: Chaser = CHASERS[0];
let clock = 0;
let bits: Bit[] = [];
const side = { side: 1 };
let shake = 0;
let voiceIn = 6;

// ---- the start screen --------------------------------------------------------

function faces (): void {
  facesEl.innerHTML = allowed(scare).map((c) =>
    `<button type="button" class="face" data-chaser="${c.id}" aria-label="${c.name}"><img src="${URLS['face-' + c.id]}" alt="" width="96" height="96"></button>`).join('');
}

function showSound (): void {
  soundBtn.innerHTML = sound.muted ? ICONS.soundOff : ICONS.soundOn;
  soundBtn.setAttribute('aria-pressed', String(!sound.muted));
}

function show (m: Mode): void {
  mode = m;
  startEl.hidden = m !== 'start';
  hud.hidden = m === 'start';
  pad.hidden = m !== 'run';
  pausedEl.hidden = m !== 'paused';
  if (m !== 'caught') caughtEl.hidden = true;
  canvas.hidden = m === 'start';
  if (m === 'run') sound.startBeat(); else sound.stopBeat();
}

function begin (id?: ChaserId): void {
  sound.wake();
  const list = allowed(scare);
  who = id ? chaser(id) : list[Math.floor(Math.random() * list.length)];
  run = new Run(worldFor(who, scare), scare);
  bits = [];
  side.side = 1;
  meterChaser.src = URLS['face-' + who.id];
  sound.night = run.world.night;
  sound.danger = 0;
  voiceIn = 5 + Math.random() * 4;
  show('run');
  sound.go();
  window.setTimeout(() => sound.voice(who.voice), 500);
  canvas.focus({ preventScroll: true });
}

// ---- moves ---------------------------------------------------------------------

type Move = 'left' | 'right' | 'up' | 'down';

function act (m: Move): void {
  if (mode !== 'run' || !run) return;
  sound.wake();
  if (m === 'left') run.steer(-1);
  else if (m === 'right') run.steer(1);
  else if (m === 'up') run.jump();
  else run.duck();
  const key = pad.querySelector<HTMLElement>(`[data-move="${m}"]`);
  key?.classList.remove('pressed');
  void key?.offsetWidth;
  key?.classList.add('pressed');
}

for (const key of pad.querySelectorAll<HTMLButtonElement>('.key')) {
  key.addEventListener('pointerdown', (e) => { e.preventDefault(); act(key.dataset.move as Move); });
  // Enter or Space on a focused button; a pointer has already been handled.
  key.addEventListener('click', (e) => { if (e.detail === 0) act(key.dataset.move as Move); });
}

// Swipes anywhere on the path, and a tap to hop.
let swipe: { x: number; y: number; id: number; used: boolean } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'run') return;
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, used: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.id !== e.pointerId || swipe.used) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < 26) return;
  swipe.used = true;
  if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right');
  else act(dy < 0 ? 'up' : 'down');
});
canvas.addEventListener('pointerup', (e) => {
  if (swipe && swipe.id === e.pointerId && !swipe.used) act('up');
  swipe = null;
});
canvas.addEventListener('pointercancel', () => { swipe = null; });

const KEYS: Record<string, Move> = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up',
  ArrowDown: 'down', s: 'down', S: 'down'
};

window.addEventListener('keydown', (e) => {
  if (!grownEl.hidden) {
    if (e.key === 'Escape') closeGrown();
    return;
  }
  if (mode === 'run') {
    const m = KEYS[e.key];
    if (m) {
      e.preventDefault();
      if (!e.repeat) act(m);
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { pause(); e.preventDefault(); }
  } else if (mode === 'paused' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
    resume();
  } else if (mode === 'caught' && !caughtEl.hidden && (e.key === 'Enter' || e.key === ' ') && document.activeElement === document.body) {
    begin(who.id);
  }
});

// ---- pause, caught, home -----------------------------------------------------------

function pause (): void {
  if (mode !== 'run') return;
  show('paused');
  $<HTMLButtonElement>('.paused .go').focus();
}

function resume (): void {
  if (mode !== 'paused') return;
  show('run');
  last = performance.now();
  canvas.focus({ preventScroll: true });
}

function home (): void {
  run = null;
  faces();
  show('start');
  $<HTMLButtonElement>('.start .go').focus({ preventScroll: true });
}

$('.pause').addEventListener('click', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

app.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  sound.wake();
  const face = b.dataset.chaser as ChaserId | undefined;
  if (face) { begin(face); return; }
  switch (b.dataset.do) {
    case 'resume': resume(); break;
    case 'home': sound.tap(); home(); break;
    case 'again': begin(who.id); break;
    case 'close': closeGrown(); break;
  }
});

$('.start .go').addEventListener('click', () => begin());

soundBtn.addEventListener('click', () => {
  sound.wake();
  sound.setMuted(!sound.muted);
  showSound();
  sound.tap();
});

// ---- the grown-ups' setting, behind a press and hold --------------------------------

const grownBtn = $<HTMLButtonElement>('.grownup');
let holdTimer = 0;

function holdStart (): void {
  grownBtn.classList.add('holding');
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => { holdEnd(); openGrown(); }, 1500);
}
function holdEnd (): void {
  grownBtn.classList.remove('holding');
  window.clearTimeout(holdTimer);
}
grownBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); holdStart(); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) grownBtn.addEventListener(ev, holdEnd);
grownBtn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); holdStart(); } });
grownBtn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') holdEnd(); });
grownBtn.addEventListener('contextmenu', (e) => e.preventDefault());

function markScare (): void {
  for (const b of grownEl.querySelectorAll<HTMLButtonElement>('.scare')) {
    b.setAttribute('aria-checked', String(Number(b.dataset.scare) === scare));
  }
}

function openGrown (): void {
  markScare();
  grownEl.hidden = false;
  grownEl.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
}

function closeGrown (): void {
  grownEl.hidden = true;
  faces();
  grownBtn.focus();
}

for (const b of grownEl.querySelectorAll<HTMLButtonElement>('.scare')) {
  b.addEventListener('click', () => {
    scare = Number(b.dataset.scare) as Scare;
    store.setScare(scare);
    markScare();
    sound.tap();
  });
}
grownEl.addEventListener('click', (e) => { if (e.target === grownEl) closeGrown(); });

// ---- the frame -------------------------------------------------------------------

let W = 0;
let H = 0;
function fit (): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fit);

function burst (x: number, y: number, n: number, color: string, kind: Bit['kind'], speed: number, r: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.5 + Math.random() * 0.4, age: 0, color, r: r * (0.6 + Math.random() * 0.6), kind });
  }
}

function react (events: Event[]): void {
  if (!run) return;
  const v = view(W, H, run.x);
  const [sx, sy] = sukhiAt(v, run);
  for (const e of events) {
    switch (e.type) {
      case 'coin': sound.coin(e.streak); burst(sx, sy - H * 0.05, 5, '#FFD34A', 'spark', H * 0.4, H * 0.014); break;
      case 'jump': sound.jump(); break;
      case 'duck': sound.duck(); break;
      case 'steer': sound.steer(); break;
      case 'bump':
        sound.bump();
        window.setTimeout(() => sound.voice(who.voice), 250);
        burst(sx, sy + H * 0.08, 12, 'rgba(200,180,140,0.9)', 'dust', H * 0.3, H * 0.02);
        shake = 0.35;
        break;
      case 'pop': sound.pop(); burst(sx, sy, 14, 'rgba(180,225,255,0.9)', 'spark', H * 0.5, H * 0.012); break;
      case 'power': sound.power(e.power); burst(sx, sy, 16, '#FFFFFF', 'spark', H * 0.5, H * 0.012); break;
      case 'close': break;
      case 'caught':
        sound.bump();
        sound.voice(who.voice, true);
        sound.caught();
        shake = 0.6;
        break;
    }
  }
}

function hints (): void {
  if (!run) return;
  const need = run.hint();
  const move: Move | null = need === 'jump' ? 'up' : need === 'duck' ? 'down' : need === 'block' ? (run.way() < 0 ? 'left' : 'right') : null;
  for (const key of pad.querySelectorAll<HTMLElement>('.key')) key.classList.toggle('hint', key.dataset.move === move);
}

let lastPowers = '';
function hudUpdate (): void {
  if (!run) return;
  coinsEl.textContent = String(run.coins);
  meterFill.style.transform = `scaleX(${run.danger})`;
  meterChaser.style.left = `${run.danger * 62}%`;
  hud.classList.toggle('danger', run.danger > 0.3);
  const on = POWERS.filter((p) => run!.has(p));
  const sig = on.join(',');
  if (sig !== lastPowers) {
    lastPowers = sig;
    powersEl.innerHTML = on.map((p) => `<span class="power" data-power="${p}"><img src="${URLS['pick-' + p]}" alt=""></span>`).join('');
  }
  for (const el of powersEl.querySelectorAll<HTMLElement>('.power')) {
    const p = el.dataset.power as keyof typeof POWER_TIME;
    const left = p === 'bubble' ? 1 : (run.powers[p] ?? 0) / POWER_TIME[p];
    el.style.setProperty('--left', String(left));
  }
}

function ambient (dt: number): void {
  if (!run) return;
  if (run.world.night && Math.random() < dt * 3) {
    bits.push({ x: Math.random() * W, y: H * (0.3 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15, life: 2.5, age: 0, color: '#E8FF7A', r: 2 + Math.random() * 2, kind: 'fly' });
  }
  for (const b of bits) {
    b.age += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.kind !== 'fly') b.vy += H * 0.8 * dt;
  }
  bits = bits.filter((b) => b.age < b.life);
}

let last = performance.now();
function tick (now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  if (run && (mode === 'run' || mode === 'caught')) {
    run.step(dt);
    react(run.events);
    ambient(dt);
    hudUpdate();
    hints();
    sound.tempo = 1 + (run.speed - 8) / 12;
    sound.danger = run.danger;

    if (mode === 'run') {
      voiceIn -= dt;
      if (voiceIn <= 0) { sound.voice(who.voice); voiceIn = 8 + Math.random() * 7; }
      if (run.caught) {
        mode = 'caught';
        pad.hidden = true;
        sound.stopBeat();
      }
    }

    shake = Math.max(0, shake - dt);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 24, (Math.random() - 0.5) * shake * 24);
    const v = view(W, H, run.x);
    frame(ctx, v, run, who, clock, bits, side, false);
    ctx.restore();

    if (mode === 'caught') {
      const T = run.caughtFor - 0.6;
      if (T > 0) drawCatch(ctx, W, H, who, T);
      if (T > CATCH_TIME && caughtEl.hidden) {
        caughtEl.hidden = false;
        caughtEl.querySelector('.total b')!.textContent = String(run.coins);
        hud.hidden = true;
        $<HTMLButtonElement>('.caught .again').focus({ preventScroll: true });
      }
    }
  } else if (run && mode === 'paused') {
    const v = view(W, H, run.x);
    frame(ctx, v, run, who, clock, bits, side, false);
  }
  requestAnimationFrame(tick);
}

// ---- off we go -----------------------------------------------------------------------

fit();
faces();
showSound();
show('start');
install();
void load().then(() => {
  app.querySelector('.loading')?.remove();
  requestAnimationFrame((t) => { last = t; tick(t); });
});

// For tests: the run, to read and drive from outside.
(window as unknown as { __run: () => Run | null }).__run = () => run;
