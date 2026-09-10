---
name: make-video
description: Make a promo / demo video of this repo's UI — film the real app frame-exactly (Playwright on a virtual clock) and cut it in Remotion with camera moves, kinetic words, sound and music. Use when asked for a video, reel, clip, trailer, teaser, GIF or social post of the components, or to add a shot or re-cut an existing video.
---

# Making a video of the UI

Everything lives in `video/` (its own package; read `video/README.md` for the full API). The pipeline:

```
shots/*.ts ──pnpm capture──▶ public/clips/<shot>.{mp4,json,sheet.jpg}
remotion/cuts/*.ts ──pnpm hero / pnpm render──▶ out/*.mp4
```

Run everything from `video/`. If `node_modules` is missing, `pnpm install` first.

## Workflow

1. **Plan the reel before filming.** Pick a tempo (120 BPM = 30 frames a beat at 60 fps), then list the cuts:
   one effect per cut, 6–9 beats each (the establishing beat included), a climax two thirds in, a payoff at
   the end. The square hero is 64 beats (32 s).
2. **Find the moments.** Look at the page in the Browser pane first (routes: `/` is the bento; `/dev/splat`,
   `/dev/engulf`, `/dev/announcement`, `/dev/callout` are the component pages). Selectors that are stable:
   `shots/_common.ts`.
3. **Write or reuse shots** in `video/shots/`. One interaction per shot: start `...SQUARE`, give the pointer
   the `APPROACH` travel before the action (the establishing beat), and 1–2 s of tail so the edit has handles. `mark()` every moment the edit will want to cut on or frame (pass a
   selector to record the element's box for `focus: 'mark:<name>'`). Put slow motion (`d.speed(0.25)`) in
   the capture, not the edit — captured slow-mo is made of real frames.
4. **Capture:** `pnpm capture <shot…>` (builds the app and serves it; `--url` to use a running server).
   Then **Read `public/clips/<shot>.sheet.jpg`** — a 4×3 grid of the take. Check the effect happened and
   read the timings you need from `public/clips/<shot>.json` (`marks`, and presses are frames where
   `cursor[i][2]` goes 0→1).
5. **Cut:** write the reel in `video/remotion/cuts/<reel>.ts` and register it in `remotion/Root.tsx`
   at the same shape as the shots' viewport (square: 1080×1080 with `...SQUARE` shots). Convert clip
   timings to the cut: `from` is seconds into the clip; camera `t`, `shake` and `hit` are seconds into the cut.
6. **Check stills before rendering the whole thing:** `pnpm still <Comp> out/f.png --frame=<n>` and Read the
   PNG. Check framing: wide frames show the whole component, close-ups keep the subject whole and centred,
   nothing important is cropped. A still takes ~20 s, a full 20 s render ~4 min.
7. **Render** (`pnpm render <Comp> out/<reel>.mp4 --codec=h264 --crf=16`), then make a contact sheet of the
   render and Read it:
   `ffmpeg -i out/x.mp4 -vf "select='not(mod(n\,55))',scale=480:-2,tile=4x6" -frames:v 1 out/x.sheet.jpg`.
   Check loudness with `-af volumedetect`: peaks should stay under 0 dB.
8. Send the user the video (SendUserFile) and say what each cut shows.

## The house style (from the user's notes)

- **Square 1:1, 1080×1080**, filmed in a square page (`...SQUARE` from `shots/_common.ts`: 960×960 at
  2.25×, so the footage is twice the output and close-ups stay sharp).
- **Zoomed out means the Tip callout with 1.5rem either side** (`span: 560 + 2 * 24`) — except where the
  banner is the subject (the opening; its resurfacing after a theme change), which gets its own 1.5rem either
  side (`671 + 2 * 24`). Nothing is ever cut off. The camera pushes in from there for each interaction.
- **Calm the callout's glare** so its white text reads: `setup: (d) => d.page.evaluate(holdNacre(NACRE_CALM))`
  (`shots/_common.ts`). The green glow is steep in `intensity`; 0.83 dims it, 0.75 all but puts it out.
- **Establish, then push in.** Hold the wide frame while the pointer travels to the next thing, then push in
  so the camera is close when the action lands.
- **One continuous take of the main page** (`shots/main-page.ts`, cut `remotion/cuts/hero.ts`), following the
  user's shot list, with `fadeIn` / `fadeOut`. Frame components with `focus: 'track:<name>'` — the layout
  moves (the banner surfaces, is dismissed, and comes back after a theme change) and tracks follow it.
- **No on-screen text** — no words, no closing card — unless the user asks for it again.
- **Silent** — no music, no sound effects (`sfx: false`, no `music`) unless the user asks for sound.
- The engulf is left out; the full-screen ink splat (`/dev/splat`) is saved for a later video.

## Movement: elegant, not punchy

The user found the first cuts' movement too punchy. Keep it unhurried:

- **Camera:** every move a `sine` glide of at least ~1.2 s (a long pull-out, 2–4 s); zoom already glides in
  log space. Hold between moves; a slow drift after a push should also be `sine`, never `linear` (a linear
  segment after an eased one starts with a jolt).
- **No shake, no zoom kick on presses** (`punch: false`), and `cursorStyle: 'soft'` (a slight dip and a faint
  ring instead of a bold green one).
- **Pointer:** `ease: 'smooth'` (minimum jerk, like an unhurried hand) on every move, 1–1.6 s per move, and a
  0.2 s beat after arriving before a press.
- **Slow motion eases in and out:** `d.speed(0.35, { over: 0.5 })` … `d.speed(1, { over: 0.8 })`.
- **Key camera times to marks** (`t: 'flood-1.2'`), not seconds, so re-timing the take keeps the camera in
  step with it.
- Build to one climax (the theme flood), and let the ending breathe (the ink holds, the fade is long).

## Gotchas

- The page runs on virtual time: nothing moves unless the director records or skips frames. `wait()` is the only
  way to let an effect play out. Real-time waits (`setTimeout` in the shot script) do nothing for the page.
- The theme switch ignores presses while its flood is running (~2 s of page time). Wait before pressing it again.
- Link clicks are blocked during a take (`allowNavigation: true` to allow). The Leva panel is hidden; press its
  buttons with `d.invoke('<label>')`.
- The shell's fixed theme toggle shows on the `/dev/*` pages; hide it with `css: HIDE_TOGGLE`.
- Dark is the default theme on every load. For a light-page take, press the toggle in `setup` and wait ~3.5 s.
- A theme change brings a dismissed banner back (by design); the page shifts down ~48 px as it resurfaces.
  Wait for a change to finish with `d.waitUntil(() => !document.querySelector('[class*="_overlay_"]'))`.
- The dark flood covers the whole page with ink for ~1 s before the dark UI returns; slow the page
  (`d.speed(0.5)`) after the press to hold on it longer.
- The engulf ink is the page's own colour, so it reads weakly on camera; the pond card on `/dev/engulf`
  (tip it, then press it: it sinks and the pond turns to mercury) is the stronger shot.
- `--dev` captures pick up other people's hot reloads mid-take (page errors like "changed size between
  renders"); use the default production build for anything you'll keep.
- Frames must come out at viewport × scale (2160 px for `SQUARE`); the director checks the first one. The scale
  is the browser's own (`--force-device-scale-factor`, one browser per scale), because headless Chrome's
  screenshot of an emulated scale comes back at CSS size.
- Functions passed to `d.page.evaluate` must not be named helpers defined in shot files (tsx wraps them in a
  `__name` the page doesn't have): pass a script string, like `holdNacre()` returns.
- Captures are ~70–300 ms a frame depending on load (another capture or render running at the same time
  roughly triples it); a 5 s shot takes 30–90 s. Run long captures in the
  background.
- `public/clips`, `public/music`, `public/sfx` and `out/` are git-ignored; everything is regenerated from code.
