# @pmndrs/ink-splat

Novel components for the pmndrs design system, built on the [pmndrs](https://github.com/pmndrs) stack. The first component is a [react-three-fiber](https://github.com/pmndrs/react-three-fiber) port of [Kris's ink splat experiment](https://github.com/krispya/ink-splat): a particle-fluid ink blot rendered as a metaball field, with the pmndrs mark surfacing through it.

Live demo: deployed on Vercel from `main`.

## Stack

| Concern       | Library                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Rendering     | [three](https://threejs.org) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) |
| Helpers       | [@react-three/drei](https://github.com/pmndrs/drei) (`useFBO`)                                     |
| State         | [zustand](https://github.com/pmndrs/zustand)                                                       |
| Tuning UI     | [leva](https://github.com/pmndrs/leva)                                                             |
| Math          | [maath](https://github.com/pmndrs/maath)                                                           |
| Build         | [Vite](https://vite.dev) 8 + React Compiler                                                        |
| Lint / format | oxlint, prettier (configs in `.config/`)                                                           |

## Layout

```
src/
  components/            the design-system components (the package surface)
    index.ts
    gate.ts              useWebGL / useReducedMotion: DOM first, ink where it can run
    theme/               page palette tokens, persisted theme store, ThemeApplier
    ink-splat/
      InkSplat.tsx       R3F component: <Canvas> + two-pass render loop
      particles.ts       CPU droplet simulation (spawn, step, encode)
      shaders.ts         GLSL for the field pass and the ink pass
      config.ts          timing and scale constants
      reference/         Kris's original vanilla-WebGL component, verbatim
    ink-theme/           InkThemeToggle + InkThemeTransition: the theme change as ink
    ink-engulf/          InkEngulf: the inverse, ink closing in from the edges over content
    ink-sink/            InkSink + LiquidPond + LiquidGround: the study's pond, as slab, ground or pill
    nacre-callout/       NacreCallout + NacreStage: one-context raymarched callouts on black nacre
    surface/             Surface: the one primitive (shape × material × expressiveness) under every element
    nav/                 Nav: the responsive pill nav (full / compact / collapsed) and its ⌘K palette
    announcement/        Announcement: the banner afloat on the page, sinking into it on dismiss
    callout/             Callout: the lens callout (surface / plain / svg), and the kinds
  ui/                    the flat set: Button, CopyButton, Picker, Popover, Icons, tokens.css
  app/                   the site: AppShell, Home, /dev pages (mirroring the 3d-2d-nav pages)
  main.tsx, index.css
```

## Components

The components take the patterns of the [3d-2d-nav](../3d-2d-nav) explorations (DOM first, decoration in a bleed canvas sized to the DOM box, an outline until the layer is ready, a gate for WebGL and reduced motion, a persisted theme with `data-theme` on `<html>`) and draw them in ink.

### `<InkSplat>`

The engine. Owns its `<Canvas>`, renders on demand, fills its parent.

```tsx
import { InkSplat, type InkSplatHandle } from './components'

const ref = useRef<InkSplatHandle>(null)

;<InkSplat
  ref={ref} // ref.current.splat() replays the effect
  theme="dark" // 'light' | 'dark'; omit to follow data-theme / .dark on <html>
  ink="#1d5c3f" // any CSS colour; defaults from the theme
  mark="#ffffff" // colour of the pmndrs mark
  logo // show the mark (default true)
  scale={1.5} // blot size relative to the longer canvas edge
  origin={[0.5, 0.5]} // impact point, canvas fractions
  clip={{ inset: 64, radius: 14 }} // bound the flood to a rounded box; droplets overhang
  interactive // pointerdown on the canvas splats (default true)
  autoplay={false} // splat once on mount
  onSplat={() => {}} // each impact
  onSettle={() => {}} // the flood has covered the canvas
/>
```

With `prefers-reduced-motion` the splat lands already settled. A `splat()` asked for before the scene has mounted is kept and fired when it has.

`nacre` (0..1) gives the ink a surface: from a height built on the density field (steep at the meniscus, flat inside) and slow bumps of surface tension across the mass the shader takes a normal, darkens a lip just inside the rim, catches a thin highlight on the rim, adds a specular and mixes in a spectral iridescence where the surface curves away, weighted so the ink's own colour stays the body of it. `InkCallout` uses 0.8 by default (its panel has the slider); the theme flood and engulf stay matte.

The droplet kernels are anisotropic, after Yu and Turk: each is oriented and stretched by the run of droplets around it, so a strand reads as a strand rather than a row of lumps, and `anisotropy` dials that from the ballistic shape alone up to the neighbourhood's. Before the field is thresholded it takes `smooth` steps of mean curvature flow, after van der Laan et al., which rounds the lumps between kernels without moving the surface. Both are in the panel on `/dev/splat`. See the changelog for the citations.

`flood={false}` keeps the ink a blot: the front never starts and the droplets are never shoved outward, so the mass settles where it landed with its spatter around it. That is the decorative form, used for the announcement's blot and the mark's.

### `<InkThemeToggle>` and `<InkThemeTransition>`

The toggle cycles dark → light → system and requests the change with its own position. The transition mounts a full-viewport overlay that splats from that point. With the liquid shaders on, the splat _is_ the liquid: its coverage masks every scheme-following ground (the page ground and the nav pill) so they show the new body, mineral or pearl, where the ink has landed, and the splat itself is drawn on top with the ground's own pixels for ink, so the new liquid rolls over the content too. When the flood has covered the page the grounds switch outright, the theme commits underneath, and the overlay fades to reveal the switched content. With the shaders off (a persisted switch in the theme store) or without WebGL, the splat is a flat flood of the new page colour. Reduced motion or a change with no visible effect commit at once. Render the transition once per page, after the content (see `src/app/AppShell.tsx`).

### `<InkEngulf>`

```tsx
const ref = useRef<InkEngulfHandle>(null)
;<InkEngulf ref={ref} onDone={() => setGone(true)}>
  <Banner onDismiss={() => ref.current?.engulf()} />
</InkEngulf>
```

The inverse of the callout, and the behaviour behind `Surface`'s `exit`. On `engulf()` (or `engulfed`) droplets are flung in from the edges of the content's box and the ink closes in behind them; with `fill="ground"` (default) the ink is the page's liquid. Then the ink drains and the spatter fades (`onDone`), or with `keep` it stays until `release()` drains it and gives the content back (`onReleased`); `hideContent={false}` leaves the content visible under the ink. `lazy` mounts the canvas only once something is engulfed. The content keeps its layout box throughout. Without WebGL the content simply goes, or is held.

### `<InkSink>`

```tsx
const ref = useRef<InkSinkHandle>(null)
;<InkSink ref={ref} liquid="auto" onContrast={(d) => console.log(d.lc)}>
  <Card />
</InkSink>
```

The pond from the "Liquid Button Ink" study (`reference/`), ported with its shaders and simulation and one change of model: the layer over the content is transparent with a hole where the slab's face is still dry, so the DOM content shows through it. `sink()` sends the slab under with an ink-splat particle swallow (droplets burst from the rim, are drawn back onto the slab and merge) while the surface closes over the face, ripples first, until nothing is left dry; the liquid is faintly translucent while shallow, so the content is seen receding into the ground, then fades. `rise()` brings it back; `press()` is a beat under and back; hover tips it. A click on the content is an impact: the slab tips into the hit and plunges, the liquid closing over that side first (`sinkOnClick`, with `onSunkChange` for a controlled `sunk`); a click when sunk raises it. `liquid` is mineral, pearl or mercury (`auto` follows the scheme). Raw WebGL2; without it the content only dims when sunk.

Without the pond there are two fallback tiers, picked by `tier` (`auto` by default, or forced to test): `swallow` runs the ink splat's own CPU droplet simulation and draws the droplets as plain circles into a 2D canvas behind a front that closes in over the slab, merged by an SVG gaussian blur and a colour matrix that hardens the alpha — a metaball field thresholded at one half is blurred alpha with its contrast pushed, so the browser does the per-pixel work in compositor code and the frame costs a few dozen `arc` calls. `quiet` drops the canvas entirely and leaves the slab's CSS recession, which is what reduced motion should get. Both pair with the slab drawing back, softening and darkening over a dent in the ground, and neither carries the material: the mass is flat ink, with no nacre, glitter or refraction. `onSunkSettled` reports when the liquid has closed, so a dismissal is timed by the tier rather than by a constant.

The globs stand proud as they land and then relax flat: `globSettle` (seconds, default 0.9) eases their relief from `globHeight` to nothing once they have arrived, because a bead cannot hold its own height after the liquid has taken it. Set it to 0 to keep them raised.

The pointer's dent is a wide bowl, a tight core and the meniscus around it, the same at every size — a ground the size of a page has no slab, and the core used to be reached only as a slab went under, which left the cursor barely marking it.

`well` makes the whole page the well: the sink has no panel of its own, and its liquid continues the fixed `LiquidGround`'s surface exactly. The pond draws in the viewport's frame (a `uShiftPx` offset into the ground's coordinates, the ground's vignette, unit and resolution), every pond runs on one clock, the window's pointer drives it, its ripples are the ground's own array (an impact on the slab rings out across the page), and it registers as a ground so the theme's masked switch rolls it over with the page. Only the slab, its collar and the droplets of the swallow are its own. `Announcement` is built on it.

### `<Surface>`

```tsx
<Surface as="button" shape="pill" expressiveness="calm" onClick={...}>Copy</Surface>
```

The one surface every element sits on: a clipped box in one of three shapes (`pill`, `card`, `key`), filled with the page's liquid in one of three tiers of motion. `full` is the liquid with the page look's pointer reaction; `calm` is the same liquid nearly still, a quarter of the reaction; `flat` is tokens only, no canvas. The gates step the tier down on their own: reduced motion caps at calm, no WebGL or the shaders off means flat. `material` is `auto` (follows the scheme), `mineral`, `pearl` or `mercury`, read through the page look so a preset restyles every surface. `as` picks the tag (div, button, nav, a); other attributes pass through. The bento is built entirely on it.

Every surface has one exit, `exit`: `dismiss` (the ground's own liquid closes in over it, drains, and the content is gone; `onDone` fires), `disable` (the liquid closes over and stays; the content stays visible but dimmed and the surface is `aria-disabled`, the study's rule that sunk means unavailable but still findable), and `pending` (the same while it lasts; back to `none`, the liquid drains and the content is restored). The engulfing ink samples the page ground rather than a colour, so the ground reclaims the element wherever it sits; without a ground or with the shaders off it is the page ink.

### The mark

`reference/logo.svg` is the source of the pmndrs mark: an 800 unit box on a 40 unit grid, five blocks (a top bar, a right arm, and three squares). It is drawn twice, because the two consumers cannot share a representation:

- [`nav/Logo.tsx`](src/components/nav/Logo.tsx) carries the source's paths verbatim, with the fills dropped so the ink is inherited. This is the mark in the nav pill, the command palette and the bento.
- `logoSDF` in [`ink-splat/shaders.ts`](src/components/ink-splat/shaders.ts) carries it as five `sdBox` calls in a unit square, the mark that surfaces through the ink. Every block is 0.15 half-extent but the top bar (0.325 wide) and the arm (0.325 tall).

Change one and check the other.

### The flat set (`src/ui`)

`Button`, `ButtonLink`, `Kbd`, `CopyButton`, `Picker` and `Popover`, built from `reference/ui-screenshots/` and shared verbatim with the sibling repo. The folder is portable on purpose: the components read only the `--ui-*` custom properties in `ui/tokens.css` and import nothing from the rest of the app, so it can be copied between projects as one piece. `tokens.css` is imported once in `main.tsx`, before the app's own sheet, and follows `data-theme` with a `prefers-color-scheme` fallback.

These are the utilitarian tier made properly: flat surfaces with a hairline border and 10px corners, no canvas. `Button` carries ⌘K and the social links, `Popover` the menu on a trigger, `Picker` the ⌘K panel (`CmdPalette` renders it inside a `<dialog>`), and `CopyButton` the brand-green bar, identical in both schemes, which can host sibling actions beside the copy action.

### `<Nav>`

```tsx
<Nav links={[{ id: 'docs', label: 'Docs', href: '/docs' }]} active="docs" />
```

The site nav of the 3d-2d-nav explorations, its bar a `Surface`. The bar stands against the page rather than with it: the dark page carries the pearl liquid and the light page the black mineral. Its ink follows the liquid it sits on (`--nav-ink`), not the page's.

The mark sits on a blot of the page's own liquid, splashed onto the bar when the nav mounts. A click anywhere on the bar is a blow: it gives in that direction and drifts back over about a second and a half. The drift is `left`/`top` rather than a transform on purpose — a transform there opens a stacking context, and that would seal the nacre stage's canvas out of the bar (see the pill below).

One pill moves under the items: it follows whatever the pointer is over and falls back to the current page when the pointer leaves, so it stretches between labels rather than appearing per item. It is drawn by the page's nacre stage — the gooey callout shader — as one more card with a pill's own corner radius, which is why the bar sets `isolation: auto` and the labels ride at `z-index: 1`. The stage's nacre is the black mineral body in either scheme, so the label above the pill takes `--nav-pill-ink` and is light in both. Without a shader (the flat tier) the pill is the bar's opposite liquid, flat. It is DOM in every tier (the a11y and SEO source of truth); `enhancement` is `auto` (the gates), `full`, `calm` or `flat`, and in dev `?nav=` overrides. The layout mode follows the container: the pill is measured in every mode (`full`, `compact`, `collapsed`) by swapping `data-mode`, and `resolveMode` picks one with hysteresis so a resize around a threshold never flaps. Collapsed, the links become a disclosure under the pill. Every length is a token (`navTokens`), the glass nav's numbers, shared with the CSS as `--nav-*`. The Cmd item and ⌘K / Ctrl+K open `CmdPalette`, a `<dialog>` listing the links. One zustand store per nav (`createNavStore`, `useNavStore`) so several can share a page.

### `<Announcement>`

```tsx
<Announcement width={652} onDismiss={() => setGone(true)}>
  <span><strong>v10 is out.</strong> …</span>
  <a href="/blog/v10">Read more</a>
</Announcement>
```

The wide banner, afloat: the whole page is the well. It is an `InkSink` in `well` mode, so the liquid around the slab is the fixed page ground's own surface, drawn in the same frame, and the slab tips under the pointer and sinks into the page. Every banner drifts on its own clock, a few pixels over twenty-odd seconds, so two on a page never move together; reduced motion stills them.

`onDismiss` adds a close button; the click is an impact at that point, the banner plunges and the liquid closes over it, then the layer fades (the liquid it shows is the ground's, so only the slab goes) and `onDismiss` fires. Flat (`variant="flat"`, or the gates) it is a flat `Surface` card and the dismissal is the `exit`.

### `<Callout>`

```tsx
<Callout variant="surface" kind="tip" title="Start with the fiber docs">
  <p>…</p>
</Callout>
```

The glass callout's layout on a `Surface`: the kind's symbol in a lens ring at the top-left corner (the glass metrics: 96 px at 64, 64), the kind label, a title and body. `surface` is the liquid in full motion, `plain` the liquid calm, `svg` a flat outline; each steps down to what the page can run. A blot of the kind's ink is thrown at the card's top-left corner when it scrolls into view, under the lens ring, and does not flood the card. Kinds are `note`, `tip`, `important`, `warning` and `caution`, mapped onto the official pmndrs palette (blue, green, purple, orange, red) in `callout/kinds.ts`. The palette itself is `theme/palette.ts`, the same nine colours the pond's `brand()` spectrum runs through. The palette is pitched for light on dark, so a kind's colour is used as it is on the dark page and carried toward the page's ink on the light one.

### `<NacreCallout>`

```tsx
<NacreCallout kind="tip">
  <p>The droplet follows the pointer under the surface.</p>
</NacreCallout>
```

On the dark page the slab is the black mineral nacre. On the light page it takes the light treatment of the companion study (`reference/callout-shaders/callout-shaders-iridescence.html`): the card is the page's own ground, faintly tinted by the kind, with the nacre's structure kept as shading rather than as stone. Riding both is that study's thin film — interference from a film a few hundred nanometres thick, sampled at 650, 545 and 460 nm, so the hue tracks the view angle instead of being painted on by a ramp. The film carries the light page's iridescence and is dialled back on the dark page, where the nacre already has its own.

A port of the "single-context callout shaders" study (`reference/callout-shaders/`): every nacre callout on the page is drawn by one stage, one WebGL context and one framebuffer with a scissor per card. The slab over the card is raymarched: a droplet trail follows the pointer under the surface, ambient blobs drift beneath it, the card and a ghost of its own text are refracted through it with dispersion, and sheen glints, rim and specular ride the surface. The material is the black mineral nacre of the pond rather than the study's tinted glass, with brand iridescence where the slab curves away and the pond's facet glitter. Kinds are the study's (note, tip, important, warning, caution) with their accents and icons. The content is DOM on top; without WebGL it is a bordered card.

## Pages

The pages mirror the 3d-2d-nav repo's, page for page, with the liquid where it had glass. Its 3D-model pages (`/dev/stage`, `/dev/cube`, `/dev/trace`, `/dev/x/…`) have no ink counterpart and are not mirrored.

| Route               | What                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `/`                 | The site home: Nav, Announcement, hero, two Callouts, the flooding theme toggle        |
| `/dev/`             | Index of experiments                                                                   |
| `/dev/demo`         | The nav in a page, with link count, container width and current page controls         |
| `/dev/nav`          | 1, 3, 6 and 10 links × full, compact, collapsed; flat rows and a liquid row            |
| `/dev/callout`      | Callout surface / plain / every kind, then the ink blots with their panel              |
| `/dev/announcement` | The banner afloat at 652 and 900 px; variant and dismissal in the panel                |
| `/dev/palette`      | Every liquid as a live sample, and the saved presets, each applicable to the page      |
| `/dev/bento`        | The shader bento: the components by expressiveness                                     |
| `/dev/splat`        | Full-viewport splat with the leva panel (colour, mark, origin…)                        |
| `/dev/engulf`       | Engulf and the pond, every knob; presets are saved here                                |

The pond shader carries both bodies' materials at once: the mineral body wears the dark look (its colours, spectrum, pointer dimple, viscosity) and the pearl body the light look, uploaded side by side and mixed per pixel by the body in force there. So under the theme's ink mask the incoming body is drawn whole, in its own dress, and nothing swaps at commit. The page look (`useLook`, `pmndrs-page-look`) is per scheme: the dark ground's default is the "sunken spot" preset (black mineral, coarse glitter, no pointer halo), the light ground's is "sunken spot (nacre)" (cream nacre, thick, fine soft glitter, a pointer halo); `ThemeApplier` keeps the look in force on the current scheme, "apply to page" writes to that scheme's look, and reset returns both to the defaults.

Pond presets are kept in `localStorage` (`pmndrs-pond-presets`), which is per origin: a dev server on another port has its own. The ones in `src/app/pond-presets.json` ship with the app and are always in the list.

## Development

```sh
pnpm install
pnpm dev          # Vite dev server
pnpm typecheck
pnpm lint
pnpm build        # → dist/
pnpm preview      # serve dist/
pnpm lgtm         # typecheck + lint + build
```

Requires Node 22.12+ and pnpm 10 (`.nvmrc` is set to 22).

## Deploying to Vercel

The repo is Vercel-ready: `vercel.json` sets the Vite framework preset, `pnpm build`, `dist/` as the output, a single-page rewrite to `index.html`, and immutable caching for hashed assets. Import the repository in Vercel or run:

```sh
npx vercel
```

Preview deployments are created for every branch; `main` deploys to production.

## Credits

The ink splat simulation and shaders are by Kris Baumgartner ([krispya/ink-splat](https://github.com/krispya/ink-splat)). This repo ports them onto the pmndrs stack and grows a component library around them.
