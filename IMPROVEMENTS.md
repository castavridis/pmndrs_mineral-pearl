# Improvements

A review of the implementation at the end of the first build session (2026-09-10),
ranked by what each change would buy. The status here and in section 6 of
[`CHANGELOG.md`](CHANGELOG.md) is kept current as items are taken on.

The through-line: the biggest wins are structural. Fewer WebGL contexts, a smaller
front-page bundle, and tests for the state bugs that kept recurring. Nearly every bug
in the session was a state or timing fault rather than a visual one.

| #   | Improvement                                        | Status           |
| --- | -------------------------------------------------- | ---------------- |
| 1   | Draw every well with one WebGL context             | Next             |
| 2   | Split the front page's bundle                      | Open             |
| 3   | Tests where the bugs actually were                 | Next             |
| 4   | Resolve sink options in one place                  | Done (`a1cdfd9`) |
| 5   | Make the stacking-context rule a check             | Open             |
| 6   | Group per-card and per-pond knobs into named looks | Open             |
| 7   | A debug overlay and a deterministic clock          | Open             |
| 8   | Accessibility gaps                                 | Open             |
| 9   | Revisit the "for now" decisions                    | Open             |
| 10  | Slim the docs                                      | Open             |

Suggested order: 3, then 1, then 2. Tests first because they are cheap and would have
prevented most of the session's regressions, and because item 1 is a refactor of the
most stateful code in the repo and wants a net under it.

---

## 1. Draw every well with one WebGL context

**Problem.** Every `InkSink` builds its own `LiquidPond`, and each pond owns a canvas
and a WebGL2 context. Each `InkSplat` blot runs its own three.js renderer. Add the fixed
page ground and the nacre stage, and the bento has about eight canvases live. Browsers
cap live WebGL contexts at around sixteen and silently drop the oldest past that, so a
page with more afloat elements would lose some.

**Why not one overlay canvas, the way the nacre stage works.** The stage can draw every
callout into one body-level canvas because a card's liquid lies _under_ its DOM text.
A well is the other way up: its liquid must pass _over_ its content to swallow it, so
its canvas sits above the content, inside the element's own stacking context
(`.afloat`, `.afloat-front`, and the `z-index: 3` given to the switch's toggle all
depend on that). One overlay above every well would sit above every well's content at
once. Where two wells' bleeds overlap, the later well's pass would paint opaque ground
liquid over the earlier well's dry face — the exact overlap bug `.afloat-front` was
added to fix, moved into shader space where no z-index can reach it.

**Design.** One shared WebGL2 context renders every well; each well keeps a plain 2D
canvas as its presentation surface.

- A module-level `WellRenderer` owns an offscreen canvas (not in the DOM), its WebGL2
  context, and the pond program, compiled once.
- A well-mode pond renders into the shared context: viewport set to its own pixel size,
  its uniforms uploaded, one draw. It then copies the result into its own canvas with
  `ctx2d.drawImage(shared, 0, sharedH - ph, pw, ph, 0, 0, pw, ph)`. GL's origin is
  bottom-left, so the region drawn at viewport `(0, 0)` sits at `y = sharedH - ph` in
  image coordinates.
- The copy happens in the same callback as the draw, so the drawing buffer is still
  valid and `preserveDrawingBuffer` is not needed.
- Each well's canvas stays exactly where it is in the DOM, so every stacking-context
  fix made during the session still holds.
- 2D canvases do not count against the WebGL limit. The page goes from one context per
  well to one context for all of them.
- The page ground stays its own context. It is full-viewport, and copying a viewport
  every frame would cost more than the context saves.

**Things to get right.**

- The program is shared, so a pond can no longer rely on a uniform keeping the value it
  set last frame: another pond has drawn in between. Every uniform a pond uses must be
  uploaded every frame. Check `liquid-pond.ts` for uploads made only when something is
  dirty (the look block, the mask) and make them unconditional in shared mode.
- Textures (the masked theme switch's mask) are per context. Each pond creates its own
  in the shared context; that is fine, but they must be deleted on `destroy()`.
- Context loss must now take down and rebuild every well at once, not one.
- The shared canvas must be at least as large as the largest well; grow it, never
  shrink it every frame.
- Non-well ponds (the `/dev/engulf` demo, the palette samples) can keep their own
  contexts at first, then move over once wells are proven.

**Verify.** Count live contexts on the bento before and after; confirm the switch's
toggle is still above the switch's liquid, the copy bar's face is not painted over by
the switch's bleed, and the banner still surfaces, presses and dismisses.

## 2. Split the front page's bundle

One chunk carries everything to the front page:

| Bundle  | Size    | Gzipped |
| ------- | ------- | ------- |
| Main JS | 1.47 MB | 434 kB  |

three.js, react-three-fiber, drei and leva are all in it, and leva is a dev tool.

- Lazy-load the `/dev` pages (`React.lazy` per route in `main.tsx`).
- Load leva only where a panel is shown, and consider not showing one on the front page
  at all (see item 9).
- Port the ink splat to raw WebGL like the pond. That drops three.js, fiber and drei
  from the main path entirely.

## 3. Tests where the bugs actually were

No tests exist. The bugs worth pinning, all found during the session:

| Bug                                                                                                                                                      | Where the test goes                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A pond built on a later pass was never told it was sunk, so it floated while the component believed it was under, and the banner's entrance was a no-op. | `LiquidPond` contract: the first `sunk` assignment snaps (no splash, depth set outright); a later change animates and spawns a ring. Needs the pond constructible without WebGL.       |
| The builder forced mercury off for a well and the updater handed the default back.                                                                       | `resolvePondOptions`: a well never has `mercuryOnSink`; a well takes the ground's unit and resolution; a prop wins over the look; `updatableOptions` never carries `liquid` or `well`. |
| The palette panel keyed an effect on leva's setter, which is new every render, and put the stored look back over every edit.                             | A render smoke test of `/dev/palette` that edits a field and asserts the look changed.                                                                                                 |
| The palette read the store's `look`, which lags a theme change by a render, and wrote the dark look into the light slot.                                 | The look store: `setLook` writes only into the current scheme's slot; `setScheme` switches the look in force.                                                                          |
| A stored `system` or `light` theme reopened the page light.                                                                                              | The theme store's persist config: any stored theme migrates to or is ignored for `dark`; `shaders` survives.                                                                           |
| —                                                                                                                                                        | Presets: `panelFromLook(lookFromPanel(p))` round-trips every shipped preset.                                                                                                           |

**Tooling.** Vitest with jsdom: it fits Vite and needs no browser download.

- Stub `ResizeObserver` and `matchMedia` in a setup file.
- The WebGL gate (`useWebGL`) reports `false` under jsdom, so components render their
  fallback tiers. That is enough for a smoke test that mounts each route and fails on a
  thrown error, a `console.error`, or React's "Maximum update depth exceeded" — which
  would have caught the palette page going blank.
- A Playwright smoke test against the built site would catch the rest (blank canvases,
  real WebGL), at the cost of downloading browsers; worth adding in CI later.

## 4. Resolve sink options in one place — done

`resolvePondOptions` in [`src/components/ink-sink/pondOptions.ts`](src/components/ink-sink/pondOptions.ts)
is the only place the sink's rules live. The sink builds a pond from it and updates a
live one from it, keyed on the settings' content rather than a 25-entry dependency list.

## 5. Make the stacking-context rule a check

"Nothing between a registered card and the page may open a stacking context" bit three
times and lives only as a comment in `AGENTS.md`. In development, walk each registered
card's ancestors when it registers and warn if any has a `transform`, `filter`,
`isolation: isolate`, `opacity < 1`, `will-change` of those, or a `z-index` on a
positioned element, naming the element. Cheap, and it turns a silent visual bug into a
console line.

## 6. Group per-card and per-pond knobs into named looks

The nacre stage's cards take `invert`, `dark`, `sheen`, `film` and `blobs`; the pond
takes `pressHeave`, `sinkSpeed` and `slabLiquid`. Each was added for one element. Group
them the way `SwallowLook` groups the sink's settings (`ANNOUNCEMENT_SWALLOW`,
`CONTROL_SWALLOW`), so tuning lives in one named object per kind of element and the
component APIs stay small.

## 7. A debug overlay and a deterministic clock

Several motions could not be verified during the session: a hidden browser pane
produces no frames, CSS transitions do not advance, and timers throttle to about a
second. A `?debug` overlay showing each pond's depth, tilt, velocity and sunk state, and
a way to drive every pond from a stepped clock, would make timing fixes checkable
instead of argued.

## 8. Accessibility gaps

- The banner sits under the liquid for up to 1.5 s on load. Confirm it is in the
  accessibility tree from the start and not announced late.
- Text over moving liquid is protected by halos, but its contrast has never been
  measured. Sample the worst frame under each callout's text and check it against
  WCAG AA.
- Honour `prefers-reduced-transparency` alongside `prefers-reduced-motion`.
- The theme switch's label says what a press will do, which is right; make sure its
  accessible name says the same.

## 9. Revisit the "for now" decisions

Each was made as temporary:

- callouts pinned to mineral on either page
- dark forced on every load, the theme choice not remembered
- the system's colour-scheme preference ignored
- the leva panel shown on the front page
- the bento as the front page, the former home at `/dev/home`

## 10. Slim the docs

The README has grown into a narrative and the decision log into a long one. A short
README (what it is, how to run it, where things are) plus the decision log and this
file would serve a newcomer and a maintainer better.
