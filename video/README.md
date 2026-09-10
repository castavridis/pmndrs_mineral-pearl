# video

Promo videos of the ink-splat UI, made in code. Two stages:

1. **Capture** (`capture/`, `shots/`): Playwright drives the real app in headless Chrome on the real GPU,
   with every clock in the page — `performance.now`, `Date`, `requestAnimationFrame`, timers, CSS animations,
   `Math.random` — replaced by a virtual one the driver steps one frame at a time. Every frame is a real,
   fully rendered frame of the shaders, however long it took to draw, so footage is perfectly smooth,
   identical on every take, and can be shot in true slow motion.
2. **Edit** (`remotion/`): a [Remotion](https://remotion.dev) composition plays a declarative cut list on a beat
   grid — camera moves, punch-ins on clicks, the recorded pointer, kinetic words, sound effects and music.

```sh
cd video
pnpm install
pnpm capture all        # builds the app, films every shot → public/clips/
pnpm audio              # placeholder music + sfx → public/music, public/sfx
pnpm hero               # renders the hero cut → out/hero.mp4
pnpm studio             # or scrub the edit live in Remotion Studio
```

Needs Google Chrome installed (headless Chrome gets ANGLE-on-Metal WebGL2; the fallback bundled Chromium
would need `npx playwright install chromium`), ffmpeg, and Python 3 with numpy for the audio.

## Shots

A shot is a file in `shots/` (files starting with `_` are helpers). Its name is the file name.

```ts
import { defineShot } from '../capture/director'

export default defineShot({
  path: '/', // app route
  ready: '.launcher', // wait for this before rolling
  viewport: { width: 1280, height: 720 }, // CSS px (default); smaller = UI reads bigger
  scale: 2, // device pixels, for crisp punch-ins (default)
  setup: async (d) => {}, // staging, not recorded: switch theme, scroll
  script: async (d) => {
    await d.moveTo('.launcher') // glide the pointer (selector, {x,y}, or {selector, anchor})
    await d.mark('flood') // name a moment for the edit
    await d.click() // press + release (with a target, travels there first)
    d.speed(0.25) // 4× slow motion from here on — real frames, no interpolation
    await d.wait(2.4) // hold: screen time
    d.speed(1)
  },
})
```

| Director call                              | What it does                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `wait(s)`                                  | record `s` seconds                                                             |
| `moveTo(target, {duration, ease})`         | arcing, eased pointer move (`ease`: smooth, sine, inOut, snap, …)              |
| `trace([targets], {duration})`             | one smooth spline gesture through several points                               |
| `click(target?, {hold, move})`             | press and release; `mouseDown()` / `mouseUp()` for more control                |
| `drag(from, to)` · `scroll(dy)`            | gestures                                                                       |
| `speed(f, {over})`                         | virtual-time rate for following frames (0.25 = 4× slow-mo); `over` ramps to it |
| `skip(s)`                                  | let time pass unrecorded                                                       |
| `mark(name, selector?)`                    | record a moment (and an element's box) for the edit: `focus: 'mark:name'`      |
| `invoke(text)`                             | click a button by its text without the pointer (e.g. the hidden Leva `engulf`) |
| `waitUntil(fn, {max, after})`              | keep recording until a condition holds in the page (a transition ended)        |
| `scrollTo(y, {duration})`                  | eased page scroll                                                              |
| `evaluate(fn, arg)` · `rect(sel)` · `page` | escape hatches                                                                 |

A shot can also `track` elements — `track: { callout: '.afloat:has([data-ghost])' }`, plain CSS, a list
meaning one box around every match — and their boxes are recorded on every frame, so the edit can frame a
component wherever the layout moves it (`focus: 'track:callout'`).

Each shot writes `public/clips/<name>.mp4` (the viewport × scale, 60 fps), `<name>.json` (pointer track,
press frames, marks, tracks) and `<name>.sheet.jpg`, a 12-frame contact sheet for checking a take without
playing it.

`pnpm capture <names…>` by default builds the app (`vite build` into `.cache/site`) and serves it, so a take is
never disturbed by someone's hot reload; the build is reused until a source changes (`--rebuild` forces one).
No dev server needs to be running. `--dev` uses a Vite dev server instead; `--url http://localhost:5173`
films a server that's already running.

## The edit

A reel is a list of cuts (`remotion/cuts/*.ts`, types in `remotion/edit.ts`), registered as a composition in
`remotion/Root.tsx`:

```ts
{
  clip: 'theme-flood',      // a captured shot
  from: 0.2,                // seconds into the clip
  beats: 9,                 // screen time on the reel's beat grid (bpm)
  rate: 1,                  // playback speed
  camera: [                 // eased keys; zoom 1 = whole page
    { t: 0, zoom: 2.5, focus: 'mark:launcher' },
    { t: 2.6, zoom: 1, focus: 'center', ease: 'inOut' },
  ],
  word: 'Flood.', color: 'green', wordAt: 0.45,   // sticker word, pmndrs palette
  shake: 0.4,               // camera jolt + impact sound
}
```

Camera `t` (and a key's time generally) can be a mark in the take instead of seconds — `'flood'`,
`'flood-1.2'` — so re-timing the take keeps the edit in step. Eases: `sine` and `smooth` for gentle moves,
`inOut`, `snap`, …; zoom interpolates in log space.

Also: `cursorStyle: 'soft'`; `span` instead of `zoom` (how many page px the frame shows across); `focus: 'track:<name>'`,
`'cursor'` (smoothed pointer) or `[x, y]` page px; reel-level `fadeIn` / `fadeOut` (seconds, picture and music); `card: { title, subtitle }`; `flash`; `hit`
(impact without shake); `whoosh`; `frameAt` (where the focus lands on screen); `punch: false` (no zoom kick on
presses); `cursor: false`. Every press in the footage automatically gets a zoom punch, a click sound and a ring.

Render: `pnpm hero` (renders, then limits the audio peaks), or `pnpm render <Composition> out/x.mp4`; one frame: `pnpm still Hero out/f.png --frame=300`.

## Music

`audio/beat.py` synthesises a placeholder track so the edit has something to cut to. For release, drop a
licensed track into `public/music/` and point the reel's `music` at it with its `bpm`.

Remotion is free for individuals and companies of up to three people; larger organisations need a
[company license](https://www.remotion.dev/license).
