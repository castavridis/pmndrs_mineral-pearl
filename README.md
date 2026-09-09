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
    ink-callout/         InkCallout: a GitHub-style callout whose surface is a blot
    ink-engulf/          InkEngulf: the inverse, ink closing in from the edges over content
    ink-sink/            InkSink + LiquidPond + LiquidGround: the study's pond, as slab, ground or pill
    nacre-callout/       NacreCallout + NacreStage: one-context raymarched callouts on black nacre
    surface/             Surface: the one primitive (shape × material × expressiveness) under every element
  app/                   the site: AppShell, Home, /dev pages
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

### `<InkThemeToggle>` and `<InkThemeTransition>`

The toggle cycles dark → light → system and requests the change with its own position. The transition mounts a full-viewport overlay that splats from that point. With the liquid shaders on, the splat _is_ the liquid: its coverage masks every scheme-following ground (the page ground and the nav pill) so they show the new body, mineral or pearl, where the ink has landed, and the splat itself is drawn on top with the ground's own pixels for ink, so the new liquid rolls over the content too. When the flood has covered the page the grounds switch outright, the theme commits underneath, and the overlay fades to reveal the switched content. With the shaders off (a persisted switch in the theme store) or without WebGL, the splat is a flat flood of the new page colour. Reduced motion or a change with no visible effect commit at once. Render the transition once per page, after the content (see `src/app/AppShell.tsx`).

### `<InkCallout>`

```tsx
<InkCallout kind="tip" title="Start with the fiber docs" trigger="view">
  <p>Everything here is built from the same primitives you already know.</p>
</InkCallout>
```

Kinds: `note`, `tip`, `important`, `warning`, `caution`, each with an ink per scheme; `radius`, `bleed` and `scale` tune the blot. The content is DOM over a canvas that covers the card plus a bleed; the ink lands when the card scrolls into view (or on `ref.splat()` with `trigger="manual"`) and floods out to the rounded edge, spatter left around it. Until then the card is an outline. Without WebGL it is a solid card (`static` forces that look).

### `<InkEngulf>`

```tsx
const ref = useRef<InkEngulfHandle>(null)
;<InkEngulf ref={ref} onDone={() => setGone(true)}>
  <Banner onDismiss={() => ref.current?.engulf()} />
</InkEngulf>
```

The inverse of the callout. On `engulf()` droplets are flung in from the edges of the content's box and the ink closes in behind them until the content is drowned; the content is then hidden (and made inert), the ink drains back out, and the spatter fades. `keep` leaves the ink in place instead. The content keeps its layout box throughout; unmount it in `onDone`. Without WebGL the content simply goes.

### `<InkSink>`

```tsx
const ref = useRef<InkSinkHandle>(null)
;<InkSink ref={ref} liquid="auto" onContrast={(d) => console.log(d.lc)}>
  <Card />
</InkSink>
```

The pond from the "Liquid Button Ink" study (`reference/`), ported with its shaders and simulation and one change of model: the layer over the content is transparent with a hole where the slab's face is still dry, so the DOM content shows through it. `sink()` sends the slab under with an ink-splat particle swallow (droplets burst from the rim, are drawn back onto the slab and merge) while the surface closes over the face, ripples first, until nothing is left dry; the liquid is faintly translucent while shallow, so the content is seen receding into the ground, then fades. `rise()` brings it back; `press()` is a beat under and back; hover tips it. A click on the content is an impact: the slab tips into the hit and plunges, the liquid closing over that side first (`sinkOnClick`, with `onSunkChange` for a controlled `sunk`); a click when sunk raises it. `liquid` is mineral, pearl or mercury (`auto` follows the scheme). Raw WebGL2; without it the content only dims when sunk.

### `<Surface>`

```tsx
<Surface as="button" shape="pill" expressiveness="calm" onClick={...}>Copy</Surface>
```

The one surface every element sits on: a clipped box in one of three shapes (`pill`, `card`, `key`), filled with the page's liquid in one of three tiers of motion. `full` is the liquid with the page look's pointer reaction; `calm` is the same liquid nearly still, a quarter of the reaction; `flat` is tokens only, no canvas. The gates step the tier down on their own: reduced motion caps at calm, no WebGL or the shaders off means flat. `material` is `auto` (follows the scheme), `mineral`, `pearl` or `mercury`, read through the page look so a preset restyles every surface. `as` picks the tag (div, button, nav, a); other attributes pass through. The bento is built entirely on it.

### `<NacreCallout>`

```tsx
<NacreCallout kind="tip">
  <p>The droplet follows the pointer under the surface.</p>
</NacreCallout>
```

A port of the "single-context callout shaders" study (`reference/callout-shaders/`): every nacre callout on the page is drawn by one stage, one WebGL context and one framebuffer with a scissor per card. The slab over the card is raymarched: a droplet trail follows the pointer under the surface, ambient blobs drift beneath it, the card and a ghost of its own text are refracted through it with dispersion, and sheen glints, rim and specular ride the surface. The material is the black mineral nacre of the pond rather than the study's tinted glass, with brand iridescence where the slab curves away and the pond's facet glitter. Kinds are the study's (note, tip, important, warning, caution) with their accents and icons. The content is DOM on top; without WebGL it is a bordered card.

## Pages

| Route          | What                                                            |
| -------------- | --------------------------------------------------------------- |
| `/`            | The nav-page layout in ink: hero, callouts, the flooding toggle |
| `/dev/`        | Index of experiments                                            |
| `/dev/splat`   | Full-viewport splat with the leva panel (colour, mark, origin…) |
| `/dev/callout` | Every callout kind, replay all, and the static fallback         |

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
