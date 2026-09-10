# Decision log

Why this repo looks the way it does: the choices made while building it, the studies
they came from, and the algorithms and theory the code implements. Commit hashes
anchor each decision; `git show <hash>` has the diff.

Everything here was built in one session on 2026-09-09, so the order below is the order
of the work, not of the calendar.

---

## 1. Toolchain and shape of the project

| Decision | Why |
| --- | --- |
| Vite + react-three-fiber, deployed on Vercel (`f303a1b`) | The brief was a pmndrs design system, so the pmndrs stack: three 0.182, fiber 9.7, drei 10.7, zustand 5, leva 0.10, React 19. |
| Pin Node 22 and TypeScript 5.9 rather than the template's Node 26 / TS 7 | Kris's template assumed a toolchain this machine does not have. Recorded as a memory so it is not rediscovered. |
| Path routing in `main.tsx`, no router | Every route is served the same `index.html` by a Vercel rewrite. A router would be the only dependency doing nothing else. |
| React Compiler on, with its lint rules treated as law | It forced patterns that turned out to be right anyway: resources created in effects and held in refs, callbacks mirrored through refs, external state read with `useSyncExternalStore`, leva button handlers in module-level registries. |
| Demand-driven rendering everywhere (`frameloop="demand"` + `invalidate()`) | An idle component should cost nothing. Written into the conventions in `AGENTS.md`. |
| Components own their `<Canvas>` unless designed to live in someone else's scene | Keeps a component droppable into any page. The one deliberate exception is the nacre stage, below. |

## 2. The ink splat

| Decision | Why |
| --- | --- |
| Port Kris's vanilla-WebGL experiment to fiber, keeping his original verbatim in `reference/` (`383fe81`) | The port is a translation, not a rewrite; the original stays as the reference to diff against. |
| CPU particle simulation, GPU metaball field | The droplet count is small and the physics is cheap; the expensive part is the field, which the GPU sums per pixel. |
| Two passes: density field to a half-resolution buffer, then threshold at full resolution | The field is smooth, so it upsamples cleanly, and the threshold still yields a crisp edge. Cheap where it can be, sharp where it must be. |
| Fixed 1/120 s substeps | The settle then looks identical at any frame rate, on any machine. |
| `fillCanvas` + `uFillRect`: the ink can take its colour from another canvas | This is what lets the ink be *the page's liquid* rather than a colour. It made the theme flood and the universal exit possible. |
| A `wanted` flag for splats requested before the fiber scene mounts, and re-arming on StrictMode remount | Measurement happens after mount; without this the first splat of a page was silently dropped. |
| `nacre` (0..1) on the ink, default off (`678d7ce`, `94f7e6d`) | Asked for: iridescence and surface tension on the blot without changing its colour. Off by default so the theme flood and engulf stay matte. |
| Dark ink gets an *added* film, light ink a *multiplied* tint | A near-black cannot be tinted by multiplication. Splitting the two by luminance is what made the black note callout iridesce at all. |
| `point()` / `leave()` on the handle; the callout forwards its pointer | The blot dents under the cursor and its spectrum turns around it, matching the nacre callout's droplet. |

## 3. The liquid pond

Ported from the "Liquid Button Ink" study with its shaders and simulation intact. Every
departure is marked `(port)` in [`liquid-pond.ts`](src/components/ink-sink/liquid-pond.ts)
so the study can still be diffed against.

| Decision | Why |
| --- | --- |
| One change of model: the liquid layer is *transparent with a hole* where the slab's face is still dry (`c5eb634`) | The study drew liquid over an opaque button. Here the content is real DOM and must show through. The hole closes as the slab sinks, so nothing of it is left dry. |
| No `loseContext()` on destroy | StrictMode remounts on the same canvas and `getContext()` would hand the next pond a dead context. |
| Tilt only on an inner `.face`, at 0.22 rather than the study's 0.55, signs flipped | With liquid closing over whatever dips below the surface, the study's tilt drowned a whole side on hover. The flip was a direct correction: the edge under the pointer should turn *into* the screen. |
| Vignette measured against the longer edge | The study assumed a near-square canvas; on a wide nav pill the ends went black. |
| `unit`: CSS px per uv unit, decoupled from canvas height (`00f1020`) | Otherwise a page-sized ground had features three times coarser than a card, and the two never looked like the same substance. |
| Glob shading off by default; a cone run-off on rise | Asked for: the mass should read as coverage, not as shaded blobs, and the droplets should slide off a rising slab believably. A cone with its apex at the centre sheds radially down a constant slope. |
| Irregular two-layer facet scatter (`429a71c`) | The regular grid read as a pattern. Two jittered layers at different scales read as glitter. |
| `well` mode: the whole page is the well (`59855de`) | Asked for the announcement to behave like the card afloat with the site as the liquid. A pond in a well draws in the *viewport's* frame (`uShiftPx`, the ground's vignette, unit and resolution), shares one clock with every other pond, takes the window's pointer, shares the ground's ripple array, and registers as a ground so the theme's mask rolls it over. Only the slab, its collar and its droplets are its own. |
| The cling took its shape from the viscous free-surface papers | Not a solver, three corrections to the term. Its reach now grows as the square root of viscosity, because that is how far momentum diffuses — before, a thin liquid and a thick one dragged the surface exactly as far, which is the one thing viscosity most obviously changes. Its profile meets the slab smoothly rather than turning a corner at the rim, since a free surface carries no shear to hold a crease. And it follows a lagged velocity rather than the instantaneous one, so the surface is dragged late and keeps moving after the slab stops. Measured: the lag ramps to a peak of -0.73 and eases back through zero instead of jumping. |
| The middle tier answers the wake instead of drifting | A drift is a thing moving on its own, which for a row of controls is just fidgeting. Reading the ground's own ripples means they are still until the pointer disturbs the water, and then they lift and tip with it — the same surface the shader draws, sampled in JS. |
| Superseded: the somewhat-expressive tier drifts, dampened | Half the announcement's amplitude over a longer period, each item on its own delay. They are controls: a control that wanders is harder to hit. |
| A disabled control rests under the surface, not beneath it | Asked for. Sinking it right under says gone; resting it a little under says unavailable and still there, which is the state a disabled control is in. `sinkDepth`, `pressDepth`, `sinkSplash` and `bare` are what that needed, and the launcher combines them with the nacre stage drawing its face. |
| A landed glob relaxes flat | Asked for. The relief belongs to the arrival: a bead of liquid holds its own height for a moment and then the surface takes it. `globHeight` is now the height they land at and `globSettle` how long they take to lose it, rather than a constant the mass keeps forever. |
| The stage's canvas was sized from `innerWidth` | That includes the scrollbar, while the canvas is fixed and inset 0, so its box excludes it. Everything the stage drew was stretched across the page and drifted right, which is why a callout's slab sat outside its own border. It measures its own box now, and watches it, since a scrollbar coming and going fires no resize. |
| One corner, 8px, everywhere but the nav's bar | The bar is a stadium by shape; everything else agrees. `Surface` no longer picks a radius per shape, and `radius` is the opt-out. |
| The pointer's dent has its core everywhere | The deep core was reached only through `uGoop`, which rises as a slab goes under. A page-sized ground has no slab, so it never got past the shallow bowl and the cursor barely marked it. The dent is now a bowl, a tight core and the meniscus the displaced liquid pushes up, at every size. |
| Tilt and drift capped at 1 in a well | The page look's reaction of 3 is right for the liquid and far too much for a thing floating on it. |
| The well layer feathers out over its last 48 px (`fcddabc`) | The slab's displacement collar reaches past the canvas; without the fade a rectangle showed on the ground. |
| **Both bodies' materials in one shader** (`787781f`) | The masked theme switch showed the incoming body wearing the *outgoing* body's spectrum until commit. Now mineral and pearl parameters are uploaded side by side and mixed per pixel by the body in force there, so the incoming liquid is drawn whole from the first frame and nothing swaps at commit. |

| Two fallback tiers under the pond, not one | Asked for a fallback for the card afloat. A faithful CPU port is three to four orders of magnitude out of reach (five height-field samples per pixel, each three octave-summed noises, before a 128-droplet loop), so the fallbacks reproduce the *experience* instead: `swallow` keeps the droplets and the closing front, `quiet` keeps only the recession. |
| The swallow reuses `InkParticles` unchanged | The simulation was already on the CPU; only the rendering was GPU-bound. The fallback drives the same class in engulf mode, so the droplets, drag and flood push are the shipped ones rather than a second implementation. |
| Merging is done by an SVG filter, not by JavaScript | A metaball field thresholded at one half is blurred alpha with its contrast pushed, so a gaussian blur plus a colour matrix on the alpha channel gives the merge for free, in compositor code. The frame costs a few dozen `arc` calls. |
| Each axis of the front closes in proportion to its own size | Insetting uniformly covered a wide, short banner's short axis in the first quarter of the animation, before the droplets had done anything. |
| Reduced motion gets `quiet`, not a cheaper imitation of more | Less motion is the correct answer there. It is also why reduced motion does not force the fallback when the pond can run: the pond already stills itself. |
| `onSunkSettled` instead of a constant | The three tiers cover in 1400, 1250 and 620 ms; a dismissal timed by a hardcoded 1400 ms left the quiet tier sitting on an empty box. |

| The blot ended up behind the callout's lens | Asked for, after a pass where it announced instead. A blot flooding a card was too much and a blot on a banner was beside the point; thrown at the corner under the lens ring it marks the kind without washing anything out. `flood={false}` is what makes that possible. |
| The blot moved from callouts to announcements, then back | Asked for. A blot flooding a card said "read this carefully"; a blot at a banner's left end says "here is news", which is what the ink was always doing. `InkSplat` gained `flood={false}` so a blot can stay a blot rather than spilling to fill its box. |
| `InkCallout` was retired rather than left unused | Its blot lives in `Announcement` now, and its kinds moved to `callout/kinds.ts`. Keeping a second, unused implementation is the same trap as the three copies of the mark. |
| Kind colours are the official palette | `theme/palette.ts`, the nine colours the pond's `brand()` spectrum already ran through and the sibling repo tints its glass with. The palette is pitched for light on dark, so the light page carries each colour toward its ink rather than using it raw, which would put cyan on cream. |
| The nav bar drifts by `left`/`top`, not `transform` | A transform opens a stacking context, and the sliding pill is drawn by the nacre stage into a canvas at the body: a context anywhere between the labels and the page seals that canvas out. Same reason the bar sets `isolation: auto` over `Surface`'s default. |
| The liquid pools around the current item instead of a pill sliding behind it | A pill is a shape that happens to move; liquid arriving around the item is the bar behaving like what it is made of. Built from shapes merged by a blur and an alpha threshold, so it necks and pinches on its own rather than being animated. |
| The pool arrives rather than slides, and it arrives as beads | Asked for: globs in from the top and the bottom, pooling together. A tongue reaching to the bar's edge cannot work here — the row is the bar's full height, so there is no bar left above or below to reach across, and the two slivers that were left pinched the pill into a diamond under the threshold. Beads as deep as the pool dropped in from outside the bar and came to rest inside the pool's box, so they added nothing to the resting silhouette. **Superseded** by the sliding pill below. |
| Two loose globs at the pool's ends, absorbed | The same pull that draws a swallow's droplets back onto a slab: each necked and pinched off as it went under the threshold. **Superseded** with the pool. |
| **The pool is gone; one pill slides again, drawn by the callout's shader** | Asked for, as a new approach. The goo filter could only ever make a silhouette — a blurred, thresholded flat colour — while the callouts next to it are a raymarched slab with a thin film. Registering the pill with the nacre stage gives the bar the same material as the cards for the cost of one more scissored draw, and the stage reads the element's box every frame, so sliding it is a matter of moving `left`/`width`. The accent is the mark's green: a callout takes its kind's colour and the bar has no kind. |
| The article launcher floats on the page's own body | Tried the opposite, inverted like the nav bar, and taken back: the bar is a thing standing on the page, but the launcher is a slab lying in it, and a pool of the other liquid under one control read as a hole rather than a surface. Every well on the page is the page's: mineral on the dark page, pearl on the light one. |
| The announcement is submerged on load and surfaces when the page is ready | Asked for. It also covers the beat before the shaders have drawn: the banner spends it under the liquid, where nothing is expected to be legible, instead of sitting flat and then coming alive. `load` and the fonts say when, with a backstop in case either never resolves. |
| A pond's opening state neither splashes nor travels | It is a fact, not a movement: a slab that starts under has always been under. Without the snap it sank into place over half a second, which reads as a dip rather than as something already submerged. |
| The sink tells the pond what it is at birth (`onReady` too) | The first attempt at a well finds no ground and bails, so the pond is commonly built on a later pass — after the state React holds has stopped changing. The `sunk` effect only fires on a change, so that pond floated while the component believed it was under, and the rise that followed was a no-op. This was the whole of "the announcements don't animate in". `onReady` closes the other half: the banner waits for the liquid to be drawing before it comes up. It is told either way, afloat as well as sunk: a pond that is never told has no state to have changed from, so the first sink it is handed reads as an opening state and pops — which is why the launcher's first "disable" jumped straight under. |
| A keyboard blow lands at the middle of what was activated | Asked for. Enter and Space have no coordinates, so the element stands in for the hand. A click with no pointer behind it (`detail === 0`) is the signal, which keeps the pointer and keyboard paths from both firing for one press, and it covers Space on a button and Enter on a link alike. It is also what finally made the announcement dismissable from the keyboard: that path listened for `pointerdown` alone. |
| The pond's focus ring waits for keyboard focus | It was drawn on any focus, so a click left a ring standing at the slab's undented box while the liquid pushed the face away from it — the outline in the screenshots. It now follows `:focus-visible`, the rule the CSS ring already followed. |
| A press is a load at a point | Asked for: the click should push the area under the cursor below the liquid. The slab gives a little as a whole and tips about its centre until the pressed point is at `pressDepth` — solved from the face's height equation rather than tuned, with a floor on the lever (a press in the middle has none) and a ceiling on the tilt (a press at the edge of a small slab must not stand it on end). |
| A press throws no droplets | It used to fire the rim's whole swallow. On the copy bar that read as spatter; on the announcement, tuned for a dramatic dismissal, one click buried the entire face. A press displaces liquid locally, so it leaves a ring and nothing else; the burst belongs to going under. |
| The banner's swallow is a named look, not numbers in the JSX | Asked for a way to tune the dismissal. `ANNOUNCEMENT_SWALLOW` holds the shipped values with a note on what each does, `swallow` overrides any of them, and `/dev/announcement` drives the set from a panel — the same arrangement the pond's own look already had. |
| A dismissed banner's room closes rather than vanishing | Asked for. The liquid closing over the slab was already an animation, but the space it held disappeared in a frame when the parent unmounted, so the page jumped. The slot is pinned to its measured height and run to zero — a height transition needs a number at both ends — and `onDismiss` fires after that. |
| A slab in a well casts no shadow | Asked for: the grey halo around the announcement, the copy bar and the launcher on the light page. The well's canvas is a window onto the page's own surface and the ground beyond it casts nothing, so the shadow was darkness belonging to no light. It read as a soft grey box on the pearl and was invisible on the black mineral, which is why it survived this long. A panel pond still casts one. |
| The article launcher's face is drawn in the other scheme's body | Asked for: pearl on dark, mineral on light, while every ground on the page stays the page's own. The stage gained a per-card `invert`, since its light and dark treatments were one uniform for the whole frame. The label and edge take `--page-bg`, which on either page is the colour that reads against the body the button wears. |
| The announcement's swallow is sized like the card afloat's (`globSize` 1.6, dense, heaped, lit) | Asked for. In a well the unit is the page ground's 420 px, so a droplet sized for a pond panel reads as a speck against a 652 px banner and the banner went under a flat wash. `globSize` is the only scale that belongs to the mass rather than to the ground, and `globShading` is what makes it liquid rather than coverage. The bleed went 64 → 96 px, the room the card afloat keeps, so the splash has somewhere to land. |
| A blob pinned in each corner of a nacre card | Asked for: hide the sharp corners. The mass inside a card is a rounded box with the card's own 8 px radius, and at these sizes its corners still read as a point where the liquid turns. A corner blob is merged by the same `smin` that merges the droplets, so the turn is rounded by liquid; raising the radius instead would round the card's edge along with it. Four blobs joined the five roamers, placed by their own radius rather than clamped inside the card's box. |
| A press lands under the cursor | Superseded: one pill that moves, not a pill per item | The pill follows the pointer and falls back to the current page, so there is a single slab for the shader to draw and it stretches between labels as it goes. |
| The pill's label is light in both schemes | The gooey callout shader is the black mineral body in either scheme, so the ink above it cannot follow the page. It follows the pill. |

| The callout has a light treatment, not a dark one dimmed | Asked for. On the light page the card is the page's own ground faintly tinted by the kind, from `callout-shaders-iridescence.html`, rather than black stone on cream. The nacre's structure stays as shading. |
| Thin-film interference, not another colour ramp | The iridescence study derives hue from optical path difference through a film of a given thickness, sampled at three wavelengths, so the colour tracks the view angle physically. It is the light page's iridescence; the dark page keeps the nacre's ramp and takes only a third of the film. |
| The nacre panel merges over the defaults | It replaced the whole config, so any key it did not show became `undefined`, uploaded NaN and read back as zero. That is why the new film was inert until it was exposed. |

## 4. Theme, ground and page look

| Decision | Why |
| --- | --- |
| The theme change is an ink flood, and with shaders on the ink *is* the liquid (`25cb769`) | The splat's coverage is fed to every ground as a mask; where the ink has landed the ground renders the new body live. The overlay is drawn with the ground's own pixels, so the new liquid rolls over the content too. |
| Solid colour only as a fallback | Asked for explicitly: no solid fill unless the shaders are off or WebGL is missing. |
| `sameLook` judged only in the splat phase | Judged after commit it was always true, and the toggle stuck after one use. |
| The ground registry lives on `globalThis`, read reactively via `useGroundCount` | Vite can serve one module under two URLs, and two registries would never meet. The React Compiler also cached a plain registry call made before any ground existed. |
| `body` background transparent, the page colour on `<html>` | The body's own background painted above the fixed, `z-index: -1` ground and hid it. |
| A page look store, applied from the sink panel's presets (`c5ebe1c`) | One preset should restyle every liquid surface at once, not card by card. |
| **The page look is per scheme** (`bffc727`) | The dark and light grounds want genuinely different materials. The dark ground defaults to the "sunken spot" tuning, the light ground to "sunken spot (nacre)"; `ThemeApplier` keeps the look in force on the scheme. |
| The mineral body wears the dark look, the pearl body the light look, in either scheme | Follows from the two-material shader: a body's dress belongs to the body, not to the page's current mode. |
| Presets ship in `src/app/pond-presets.json` as well as `localStorage` | `localStorage` is per origin and the dev server's port moves, which is exactly how a session's tuning went missing. Anything a user saves in the browser should be shippable in the repo. |

## 5. Components

| Decision | Why |
| --- | --- |
| `Surface`: one primitive, shape × material × expressiveness (`41c5ef3`) | Asked for a way to make the elements feel universal. Three shapes (pill, card, key), three tiers of motion (full, calm, flat), with the gates stepping the tier down: reduced motion caps at calm, no WebGL or shaders off means flat. |
| **Engulf is the universal exit** (`01a88f9`) | Removing, disabling or holding an element is always `exit` on its `Surface` — `dismiss`, `disable`, `pending` — never a bespoke transition. The engulfing ink samples the page ground, so the ground reclaims the element wherever it sits. |
| `disable` keeps the content visible, dimmed, and `aria-disabled` | The study's rule that sunk means unavailable but still findable. `aria-disabled` rather than `disabled` keeps it in the accessibility tree. |
| One WebGL context for every nacre callout on a page (`5d1b2cc`) | A context per card exhausts the browser. One stage, one framebuffer, a scissor rectangle per card. |
| The nacre callout uses the pond's black mineral, not the study's tinted glass | The house material. Brand iridescence where the slab curves away, the pond's facet glitter on the surface. |
| The callout's `surface` variant is the nacre stage under the lens layout (`06d80e9`) | Asked for: the glass callout's layout combined with the bento callout's shader. The lens is registered as the stage's icon and the text as its ghost. |
| One `Logo` component, sourced from `reference/logo.svg` (`8fee8e1`, `af1c285`) | The mark existed in three places: a traced path in the nav component, an inline copy in the bento page, and the shader's SDF. The bento copy is gone, and the remaining two are now both derived from the supplied SVG. |
| The traced path was missing a block | The nav's mark had been drawn since the port from a trace that omitted the centre square, while the shader's SDF had all five. Replacing it with the real source fixed a logo that had been quietly wrong, and let the SDF's approximated block positions be made exact. |
| The flat set is copied verbatim, not adapted (`src/ui`) | The sibling session built it portable by design — only `--ui-*` tokens, no app imports — and mirroring that repo is already the convention here. Copying keeps one implementation across both projects; theming happens by overriding tokens, which is the extension point it provides. |
| The utilitarian tier is the flat set rather than `Surface` flat | `Surface` flat and these are the same thing (tokens only, no canvas); these are simply the designed version, from `reference/ui-screenshots/`. |
| The nav bar wears the liquid the page is *not* | Asked for: the dark page gets the pearl bar, the light page the black mineral, with the active item a pill of the page's own liquid. The bar reads as a window onto the other body rather than a panel matching the page. |
| Mirror `~/Git/@pmndrs/3d-2d-nav` one for one (`44bd2b2`, `fc363cc`, `b5c25a9`) | Nav, Announcement, Callout and the `/dev` pages keep that repo's names, props, tokens and metrics, with liquid where it had glass. Written into `AGENTS.md` so both repos stay aligned. |
| Its 3D-model pages are out of scope | `/dev/stage`, `/dev/cube`, `/dev/trace` and the frankenstein page have no ink counterpart. Said so rather than inventing one. |
| The nav pill is a `Surface`; the DOM nav is the source of truth in every tier | Progressive enhancement: the liquid is only the pill's face. Accessibility, SEO and the tab order never depend on WebGL. |

---

## Sources

The direct provenance of the code in this repo.

1. **Kris Baumgartner, ink splat experiment** — <https://github.com/krispya/ink-splat>.
   The particle fluid, the metaball field and the two-pass render. Kept verbatim at
   `src/components/ink-splat/reference/`; the fiber port is a translation of it.
2. **"Liquid Button Ink" component study** — `reference/liquid-button-ink/`.
   The pond: its GLSL, its droplet simulation, its mineral and pearl materials, its
   quicksilver, its viscosity model. Ported near-verbatim, departures marked `(port)`.
3. **"Single-context callout shaders" study** — `reference/callout-shaders/`.
   The one-context stage: scissor per card, raymarched slab, droplet trail, text ghost
   rasterization, refraction with dispersion, and the five GitHub callout kinds.
4. **Sibling repo `~/Git/@pmndrs/3d-2d-nav`** — the layout being mirrored: the nav's
   token set and mode resolver, the announcement and callout metrics, and the `/dev` pages.

## Algorithms and theory

What the code implements, and where the technique comes from. These are the canonical
sources for the methods, not citations made by the studies themselves.

**Implicit surfaces**

- *Metaball / blobby density field.* Droplets are summed into a scalar field and the
  surface is the 0.5 iso-contour. The tradition is Blinn's blobby model — J. F. Blinn,
  "A Generalization of Algebraic Surface Drawing", *ACM TOG* 1(3), 1982 — with the
  compact-support polynomial falloff of Wyvill, McPheeters and Wyvill, "Data structure
  for soft objects", *The Visual Computer* 2(4), 1986. Here the kernel is `(1 - q²)²`,
  which crosses 0.5 at `q = 0.541`; that constant (`KERNEL_Q`) is what converts a
  droplet's visual radius into its kernel reach.
- *Signed distance functions.* The rounded box (`sdRound`) and the slab bounds are
  standard 2D SDF primitives in Inigo Quilez's formulations.
- *Distance-field antialiasing.* Edge softness is `fwidth()` of the field, so the
  antialiasing width follows the pixel footprint rather than a fixed constant.
- *Sphere tracing.* The nacre slab is marched — J. C. Hart, "Sphere Tracing: A Geometric
  Method for the Antialiased Ray Tracing of Implicit Surfaces", *The Visual Computer*, 1996.

**Procedural texture**

- *Value noise and fBm.* `vn()` is value noise on a hash lattice with Perlin's cubic
  fade `f²(3 − 2f)` — K. Perlin, "An Image Synthesizer", SIGGRAPH 1985 — summed over
  four octaves as fractional Brownian motion (Mandelbrot; the standard construction in
  Ebert et al., *Texturing & Modeling: A Procedural Approach*).
- *Domain warping.* The pond's surface warps its own noise lookup by a second noise
  field, which is what gives the nacre its swirl rather than a uniform grain.
- *Cellular / jittered-grid sampling.* The facet glitter walks a hashed grid with a
  jittered point per cell and sums neighbours — the structure of S. Worley, "A Cellular
  Texture Basis Function", SIGGRAPH 1996. Two layers at different scales, to break the
  regularity a single grid betrays.
- *Hash functions.* `h21`/`h22`/`h33` are the fract-multiply-dot integer hashes in
  common shader use (Dave Hoskins' catalogue is the usual reference).

**Shading**

- *Fresnel.* `pow(1 − dot(N, V), k)` — the Schlick approximation, C. Schlick, "An
  Inexpensive BRDF Model for Physically-based Rendering", *Eurographics* 1994. It drives
  both the rim and the iridescence phase.
- *Specular.* Half-vector Blinn-Phong — J. F. Blinn, "Models of light reflection for
  computer synthesized pictures", SIGGRAPH 1977. The pond's `uGlintFollowsPointer`
  interpolates the half-vector between a fixed light and one hanging over the cursor.
- *Spectral pre-integration of the film.* L. Belcour and P. Barla, "A Practical
  Extension to Microfacet Theory for the Modeling of Varying Iridescence",
  *ACM TOG* 36(4), SIGGRAPH 2017. Sampling interference at three delta
  wavelengths keeps the colour vivid however thick the film gets, which
  disagrees with a spectral render. The nacre stage now integrates against a
  Gaussian sensor band instead, which transforms in closed form to an envelope
  damping the oscillation as the optical path difference grows. Verified: at
  200 nm the saturation is essentially unchanged (0.343 → 0.322) and at 800 nm
  it collapses (0.873 → 0.251), which is Newton's series washing to pearl.
- *Thin-film interference (nacre).* A stylized model of the physics: nacre's colour comes
  from interference between light reflected off stacked aragonite platelets, so the
  spectrum shifts with view angle and layer thickness. Here the phase is driven by the
  Fresnel term, the swirl noise and the laminar striations (`uLamina`), then mapped
  through a colour ramp. The ink blot's version uses a cosine palette,
  `0.5 + 0.5·cos(phase + offsets)` (Quilez); the pond's `brand()` is a custom cyclic ramp
  through the pmndrs spectrum instead, so the iridescence is house-coloured.
- *Chromatic dispersion.* Three `refract()` calls at per-channel IOR, the standard
  real-time stand-in for wavelength-dependent refraction (Cauchy's relation is the physics).
- *Premultiplied alpha compositing.* The ink material blends `One / OneMinusSrcAlpha` and
  outputs `col * alpha` — Porter and Duff, "Compositing Digital Images", SIGGRAPH 1984.

**Fluid surfaces from particles** — implemented, measured, then backed out

Both were implemented and verified in isolation (the numbers below are real),
and both were then removed from the render path because, integrated, they
erode a blot at icon size to nothing. A blot here is usually a mark a hundred
pixels across, not a wash over a viewport, and that case has to keep working.
The code is in git at `d4fe3b0` and `7061faf` for a second attempt; what is
missing is a step size and a kernel scale that follow the feature size rather
than the texel grid. One real bug was found and fixed along the way: the
smoothing pass had blending left on, so every iteration multiplied the field
by its own alpha and squared it.


- *Anisotropic kernels.* J. Yu and G. Turk, "Reconstructing Surfaces of
  Particle-Based Fluids Using Anisotropic Kernels", *ACM TOG* 32(1), 2013.
  Implemented in `ink-splat/particles.ts`: a weighted covariance about the
  weighted mean, decomposed as a symmetric 2×2 in closed form, with their clamp
  on the axis ratio and their neighbour-count rule, so a strand of droplets gets
  a kernel stretched along the strand and a lone one stays round. Centres are
  drawn toward the weighted mean as they do. A stretched kernel is thinned so it
  gains no mass. Verified: horizontal, vertical and diagonal runs orient to 0°,
  90° and 45°; a clump stays at ratio 1.06.
- *Curvature-flow smoothing.* W. J. van der Laan, S. Green and M. Sainz, "Screen
  Space Fluid Rendering with Curvature Flow", *I3D* 2009 (not SIGGRAPH).
  Implemented in `ink-splat/shaders.ts` as `SMOOTH_FRAG`: mean curvature motion
  over the density field before it is thresholded. They smooth a depth buffer
  with a perspective correction; this field is flat and orthographic, so it is
  the plain level-set form, `df/dt = div(∇f/|∇f|)·|∇f|`. Verified: one step cut
  the mean absolute Laplacian of a lumpy field from 68.6 to 36.9 while coverage
  above the iso-contour held at 355 → 356, which is what separates curvature
  flow from a blur.

**Simulation**

- *Semi-implicit (symplectic) Euler at a fixed timestep.* Velocity is integrated before
  position, in 1/120 s substeps with the frame's remainder accumulated. Standard
  real-time practice (Erin Catto's GDC solver talks are the usual reference); it is what
  makes the settle reproducible across frame rates.
- *Exponential drag.* `v *= exp(−k·dt)` is the closed-form solution of linear drag, so
  damping is exact and frame-rate independent rather than a per-frame multiply.
- *Cohesion as surface tension.* A weak attraction between droplets whose kernels overlap
  but which have drifted apart, in the spirit of the surface-tension term in
  Müller, Charypar and Gross, "Particle-Based Fluid Simulation for Interactive
  Applications", *SCA* 2003 — simplified here to a distance-band spring, so strands relax
  and bulbs pinch off without debris being dragged home.
- *Damped harmonic oscillator.* `springOut(t) = 1 − e^(−ζt)·cos(ωt)` is the step response
  of an underdamped second-order system; it gives the surfacing mark its overshoot and
  settle. The slab's depth, tilt and mode transitions are the same idea integrated
  numerically.
- *Wave ripples.* Each ripple is a damped travelling wavefront, `sin(kr − ωt)` under two
  exponential envelopes (age and distance), with wavelength, speed and damping all
  driven by viscosity — so a thick liquid ripples slowly and dies fast.

**Interface**

- *Hysteresis (Schmitt-trigger switching).* `resolveMode` downgrades the nav as soon as
  the container is too small but only upgrades once it exceeds the larger mode's
  requirement by a margin, so a resize hovering at a threshold cannot flap.
- *Measure-by-probing.* The pill's natural width in every mode is read by swapping
  `data-mode` synchronously and reading `scrollWidth`, restoring the attribute before
  returning, with transitions suppressed during the probe and the whole thing deferred
  to the next frame to avoid ResizeObserver loops.
- *Container-relative layout.* The nav responds to its container, not the viewport, which
  is what lets the dev gallery show every mode side by side at fixed widths.
- *Progressive enhancement.* DOM first in every component; the canvas is an enhancement,
  and the gates (`useWebGL`, `useReducedMotion`, the shaders switch) step each component
  down rather than off.
- *Tearing-free external state.* `useSyncExternalStore` for the ground registry, the
  media queries and the WebGL probe.

## Background: read, not implemented

Offline simulation, well out of a fragment shader's reach, but these are the
papers that characterise what the components imitate. Worth reading before
changing the behaviour they stand in for.

- *An object taken by liquid.* M. Carlson, P. J. Mucha and G. Turk, "Rigid
  Fluid: Animating the Interplay Between Rigid Bodies and Fluid", SIGGRAPH 2004.
  Two-way coupling through distributed Lagrange multipliers: the body displaces
  the liquid and the liquid pushes back. This is the sinking slab.
- *A surface closing over and pinching off.* D. Enright, S. Marschner and
  R. Fedkiw, "Animation and Rendering of Complex Water Surfaces", SIGGRAPH 2002.
  The particle level set, which is how a surface closes over a thing and sheds
  droplets without losing volume.
- *The topology change itself.* C. Wojtan, N. Thürey, M. Gross and G. Turk,
  "Deforming Meshes that Split and Merge", SIGGRAPH 2009. Detecting merges and
  splits and stitching the surface back together — what the metaball threshold
  gets for free and cannot control.
- *Gloop: viscous free surfaces.* C. Batty and R. Bridson, "Accurate Viscous
  Free Surfaces for Buckling, Coiling and Rotating Liquids", *SCA* 2008 (the
  Symposium on Computer Animation, not SIGGRAPH). The shear-stress boundary
  condition at a free surface, enforced variationally, is what makes a thick
  rope of liquid buckle and coil on itself instead of just flowing slowly. A
  reference implementation is at `christopherbatty/VariationalViscosity3D`.
- *Gloop: solving viscosity with pressure.* E. Larionov, C. Batty and
  R. Bridson, "Variational Stokes: A Unified Pressure-Viscosity Solver for
  Accurate Viscous Liquids", *ACM TOG* 36(4), SIGGRAPH 2017. Simulators
  usually solve pressure and viscosity in separate stages, which gets the free
  surface wrong; solving them together as one implicit Stokes problem is what
  makes a very viscous liquid drag its own surface correctly. The pond's
  `cling` term, where a sinking slab pulls the surface down with it and a
  rising one lifts it, is a hand-made stand-in for exactly that coupling, and
  its viscosity is a damping coefficient on a one-dimensional depth spring
  rather than a solve.
- *Beading and contact angle.* H. Wang, P. J. Mucha and G. Turk, "Water Drops on
  Surfaces", SIGGRAPH 2005. The interfacial tensions behind a bead holding a
  shape and then relaxing, which is what `globSettle` fakes.

## Browser and platform facts that shaped the code

Learned the hard way; each one is load-bearing somewhere.

- Chrome uploads a **WebGL** canvas into a texture with its **top row at t = 0**, the
  opposite of a 2D canvas. The mask sampling is top-based because of it.
- react-three-fiber sets `pointer-events: auto` on its wrapper *and* its canvas, so every
  overlay needs `.canvas, .canvas * { pointer-events: none !important }` or the bleed
  swallows clicks meant for the page.
- A `body` background paints *above* a fixed `z-index: -1` child when `<html>` carries its
  own background.
- `localStorage` is per origin, and a dev server's port is not stable across sessions.
- Vite's HMR can serve one module under two URLs, so a module-level registry can silently
  split in two.
- A hidden browser pane pauses `requestAnimationFrame` and reports a 0×0 window; the pond
  keeps a `setInterval` watchdog so a surface still paints when rAF is starved.
- leva's `button` has no label option — the key *is* the label.
