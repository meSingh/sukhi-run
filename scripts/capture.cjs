#!/usr/bin/env electron
'use strict';

/**
 * Screenshots of the game at any moment, for looking at a change.
 *
 *   ../../node_modules/.bin/electron scripts/capture.cjs OUTDIR 'name=URL|W|H|STEPS'
 *
 * STEPS is page JavaScript, split by "@" into steps; each step can end with
 * "~ms" to wait that long before the picture. One picture per step, named
 * name-1.png, name-2.png ... For example, a T-Rex run and then a catch:
 *
 *   'trex=http://localhost:5181|1280|800|document.querySelector("[data-chaser=trex]").click()~2500@window.__run().bump();window.__run().bump()~4000'
 *
 * Pictures are at the screen's pixel ratio (2x on a Retina Mac). The website
 * shots are made by scripts/run-shots.js in Sukhi Play instead.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith('capture.cjs')) + 1);
const OUT = args.shift();

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ show: false, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  for (const spec of args) {
    const cut = spec.indexOf('=');
    const name = spec.slice(0, cut);
    const [url, w, h, script = ''] = spec.slice(cut + 1).split('|');
    win.setContentSize(+w, +h);
    await win.loadURL(url);
    await new Promise((r) => setTimeout(r, 1200));
    const steps = script.split('@');
    for (let i = 0; i < steps.length; i++) {
      const [code, ms] = steps[i].split('~');
      if (code) {
        try { await win.webContents.executeJavaScript(`(async () => { ${code} })()`); } catch (e) { console.log('step failed:', e.message); }
      }
      await new Promise((r) => setTimeout(r, +(ms || 800)));
      const file = path.join(OUT, steps.length > 1 ? `${name}-${i + 1}.png` : `${name}.png`);
      fs.writeFileSync(file, (await win.webContents.capturePage()).toPNG());
      console.log('wrote', file);
    }
  }
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
