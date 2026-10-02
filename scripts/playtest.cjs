#!/usr/bin/env electron
'use strict';

/**
 * Plays the game by itself, fast, to check that every row can be got past.
 *
 *   npm run dev                                   # in one terminal
 *   ../../node_modules/.bin/electron scripts/playtest.cjs [url]
 *
 * Electron comes from Sukhi Play's own node_modules, two levels up. The page
 * defaults to http://localhost:5181.
 *
 * Four three-minute runs, stepped sixty times a second without waiting for
 * the screen. Three follow the glowing button exactly as a child would be
 * told to, pressing the moment it lights; the fourth presses nothing. The
 * followers should never be bumped; the one that presses nothing should be
 * bumped a lot, or the obstacles are not doing anything. Exits non-zero if a
 * follower is bumped.
 *
 * It drives the Run class through the hook main.ts leaves for tests,
 * window.__run(), so it needs a run started first; it starts one with the
 * bear.
 */

const { app, BrowserWindow } = require('electron');

const URL_ = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:5181';

const PLAY = `(() => {
  const Run = window.__run().constructor;
  const out = [];
  for (const [world, seed, follows] of [['jungle', 1, true], ['swamp', 2, true], ['jungle', 3, true], ['jungle', 4, false]]) {
    const r = new Run(world, 2, seed);
    const bumps = [];
    for (let i = 0; i < 60 * 180; i++) {
      if (follows) {
        const need = r.hint();
        if (need === 'jump' && r.grounded) r.jump();
        else if (need === 'duck' && r.grounded && r.sliding <= 0) r.duck();
        else if (need === 'block') r.steer(r.way());
      }
      r.step(1 / 60);
      for (const e of r.events) {
        if (e.type !== 'bump' && e.type !== 'caught') continue;
        const hit = r.things.find((t) => t.kind === 'obstacle' && t.gone === 0);
        bumps.push({ at: +r.time.toFixed(1), hit: hit ? hit.act + '@' + hit.x : '?' });
      }
      // Keep going after a catch, to see the whole three minutes.
      if (r.caught) { r.caught = false; r.danger = 0; }
    }
    out.push({ world, seed, follows, coins: r.coins, speed: +r.speed.toFixed(1), bumps });
  }
  return JSON.stringify(out);
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { backgroundThrottling: false } });
  await win.loadURL(URL_);
  await new Promise((r) => setTimeout(r, 1500));
  await win.webContents.executeJavaScript(`document.querySelector('[data-chaser="bear"]').click()`);
  await new Promise((r) => setTimeout(r, 300));
  const runs = JSON.parse(await win.webContents.executeJavaScript(PLAY));
  let bad = false;
  for (const r of runs) {
    const who = r.follows ? 'follows the glow' : 'presses nothing ';
    console.log(`${r.world.padEnd(6)} seed ${r.seed}  ${who}  bumps ${String(r.bumps.length).padStart(3)}  coins ${r.coins}  top speed ${r.speed}`);
    if (r.follows && r.bumps.length) {
      bad = true;
      for (const b of r.bumps) console.log(`    bumped at ${b.at}s by ${b.hit}`);
    }
  }
  const idle = runs.find((r) => !r.follows);
  if (idle && idle.bumps.length < 10) { console.log('the run that pressed nothing was hardly bumped: are the obstacles there?'); bad = true; }
  app.exit(bad ? 1 : 0);
}).catch((e) => { console.error(e); app.exit(1); });
