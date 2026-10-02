# Working on Sukhi's Run

Notes for whoever changes this next: how it is put together, the numbers
that make it feel the way it does, how to check a change, and what is left.
The README says what it is; this says how it works.

## Where things are

| Path | What it is |
| --- | --- |
| `src/main.ts` | The screens (start, run, pause, caught, the grown-ups' card), input, the frame loop, and the sounds and sparkles that go with each event. |
| `src/game.ts` | The run itself, with no drawing or sound: lanes, hop, duck, obstacles, coins, helpers, the chaser's distance, and the rules for a catch. Seeded, so a run can be replayed. |
| `src/draw.ts` | The perspective: sky, path, everything standing on it far to near, the chaser at the bottom of the screen, night, the red edge. |
| `src/catch.ts` | The nine catch scenes, drawn over the stopped run. |
| `src/world.ts` | Data only: the chasers, the two worlds, sizes in metres, the helpers. |
| `src/sound.ts` | Every sound, synthesised, and the beat under the run. |
| `src/sprites.ts` | Loads every picture before the first run. |
| `src/store.ts` | The scare setting. The sound setting is kept in `sound.ts`. |
| `src/icons.ts` | The SVG icons. |
| `public/sw.js` | The offline worker: the page network first, everything else cache first. |
| `art/`, `design/` | Not in the repository. The sheets the sprites are cut from, the world pictures the backdrops are cropped from and the design boards are kept apart from the code. The scripts below expect the sheets in `art/sheets/` and the world pictures in `art/`. |

## The pictures

All of them come from `art/`, which is not in the repository. With the
sheets in place, to remake them:

```
python3 scripts/cut-sheet.py art/sheets/chasers-a.jpg chaser-trex chaser-croc chaser-gorilla chaser-bear chaser-raptor
python3 scripts/faces.py       # round faces for the picker and the chase meter
python3 scripts/scenes.py      # sky-jungle, sky-swamp, cover, scare-1..3
python3 scripts/build-icons.py # public/ icons
```

`cut-sheet.py` takes a sheet on a plain background and writes one
transparent WebP per name, in the order the figures sit on the sheet (by
row, then left to right). It keys by distance from the background colour, so
a figure's own green (the mummy's eyes) survives. If two figures touch it
splits them at the emptiest columns. The sheets and their names:

| Sheet | Names, in order |
| --- | --- |
| `sukhi-back.jpg` | `sukhi-run-side sukhi-run sukhi-jump sukhi-slide sukhi-lean` |
| `sukhi-front.jpg` | `sukhi-laugh sukhi-cheer sukhi-toward sukhi-stumble` |
| `chasers-a.jpg` | `chaser-trex chaser-croc chaser-gorilla chaser-bear chaser-raptor` |
| `chasers-b.jpg` | `chaser-longlegs chaser-mummy chaser-bog chaser-pumpkin` |
| `props-jungle.jpg` | `jungle-log jungle-arch jungle-boulder jungle-pillar jungle-bush jungle-palm` |
| `props-swamp.jpg` | `swamp-log swamp-arch swamp-stump swamp-lantern swamp-tree swamp-mushrooms` |
| `pickups.jpg` | `pick-coin pick-magnet pick-bubble pick-springs pick-jar` |

Check every cut on a dark background before using it. `faces.py` has the
head positions as numbers at the top; adjust those if a face is off centre.

A new picture needs a size in `SIZES` in `world.ts` (a width or a height in
metres; Sukhi is 1.25 tall and a lane is 1.6 wide).

## The numbers that matter

In `game.ts` unless it says otherwise.

| What | Value | Why |
| --- | --- | --- |
| Speed | 8 to 14 m/s over 120 s, times 0.88 on silly | Never too fast for a four-year-old to follow. |
| Gap between rows | 1.7 s at the start, 1.15 s at two minutes | Measured in seconds, so reaction time stays the same as he speeds up. |
| Warm-up | No obstacles in the first 55 m | The first moments are only coins. |
| Two lanes blocked | After 25 s, 35% rising to 60% | One lane is always open, or is a log to hop. |
| A wall of logs | After 45 s, 12% of rows | All three lanes hop at once. |
| Hop | 7.4 up, gravity 22: about 0.67 s in the air | Springs: 10.4. |
| Duck | 0.75 s | |
| Lane change | 13 m/s, about an eighth of a second a lane | |
| Chaser drops back | 0.1 a second (0.22 with the firefly jar) | A bump sets it to 1. |
| Still close | 0.3 | A bump while the chaser is above this is a catch: a window of about 7 s. |
| The glow | Shown when an obstacle in his lane is less than a second away | `hint()` and `way()`. |
| The assist | A hop or duck pressed for something less than 1.3 s ahead holds until it has passed | See below. |

**The assist** is the one rule that is not obvious. A child presses the
moment the button lights, a second ahead, but a hop is in the air for two
thirds of a second, so an early hop lands before the log. `jump()` and
`duck()` find the nearest matching obstacle ahead in the lane (`next()`), and
`step()` floats the hop at about a metre up, or keeps the duck going, until
he is 0.7 m past it. A press with nothing coming is an ordinary hop or duck.
Before the assist, a player who followed the glow was bumped 3 to 7 times in
three minutes; after it, never.

## The screen

`view()` in `draw.ts` picks the focal length so the three lanes fill the
width at Sukhi's distance, and raises the camera on a tall screen, so an
upright phone shows path rather than sky. The chaser is drawn in screen space,
not on the path: it rises up from the bottom, on the side away from Sukhi, by
how close it is (`run.danger`). Its pictures face the camera, which is why it
is not drawn on the path behind him.

Once a catch is 0.6 s old, `draw.ts` stops drawing both Sukhi and the chaser
on the path, and `catch.ts` draws them in the spotlight instead. Without that
there are two of each.

## Checking a change

```
npm run dev                                   # http://localhost:5181
npm run check                                 # types
../../node_modules/.bin/electron scripts/playtest.cjs
../../node_modules/.bin/electron scripts/capture.cjs /tmp/shots 'trex=http://localhost:5181|1280|800|document.querySelector("[data-chaser=trex]").click()~2500@window.__run().bump();window.__run().bump()~4000'
```

Electron comes from Sukhi Play's own `node_modules`, two directories up.

- `playtest.cjs` plays four three-minute runs at full speed without drawing:
  three that press exactly what the glow says, and one that presses nothing.
  The first three must get no bumps; the last should get dozens. It fails
  otherwise. Run it after touching anything in `game.ts`.
- `capture.cjs` takes pictures at any moment, steps split by `@`, waits by
  `~ms`. Two bumps in a row (`window.__run().bump()` twice) is a catch, for
  looking at the catch scenes.
- `window.__run()` is left in `main.ts` for these. It returns the current
  `Run`, and its constructor makes fresh ones.

A browser preview that is not on screen does not run animation frames, so
use these rather than a hidden browser tab to see the game move.

On the website, `scripts/run-shots.js` in Sukhi Play makes the playground's
screenshots from the built copy, and `node scripts/playground-app.mjs run`
builds it into `web/public/playground/run/`, website only, because
package.json says `"sukhi": { "experiment": true }`.

## Where it differs from the design canvas

The design boards are what was approved. What was built
differs in these ways, on purpose or for now:

- **Two worlds, not four.** Jungle Temple by day and Haunted Swamp at night.
  The city and volcano pictures are drawn, for later. Which world a
  run is in follows the chaser: the swamp ones (bog monster, mummy, Pumpkin
  Jack, Long-Legs) run at night, the rest in the jungle, and on silly
  everyone is in the jungle.
- **The chase meter is two faces**, the chaser's sliding towards Sukhi's, not
  the board's three lights with the word CLOSE, so there is nothing to read.
- **No separate music switch.** One sound button covers the beat and the
  effects.
- **Pause is not behind a grown-up hold.** Pausing is harmless and reversible;
  only the scare setting is held.
- **No look-back or cheer poses during the run.** Sukhi turns to face the
  chaser (the front-facing stumble) when bumped, and cheers on the gorilla's
  shoulders.
- **Coins rather than stars**, because the pickup art is coins.

## What is next

- Watch a child play it, then tune speed, the size of the buttons and the
  catch scenes from that.
- The city and volcano worlds: props sheets for each, a `WORLDS` entry, a
  `HORIZON` in `scenes.py`.
- More than one obstacle sprite per kind, so rows look less alike.
- A post for the website, and its own repository, then a submodule in Sukhi
  Play, as the railway was.
