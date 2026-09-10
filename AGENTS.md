# Agent context

## What this is

A Vite + React 19 app whose `src/components/` directory is the surface of a growing pmndrs design-system component library. Components are built on pmndrs libraries (react-three-fiber, drei, zustand, leva, maath). `src/demo/` is the showcase app. It deploys to Vercel as a static SPA (see `vercel.json`).

The engine, `InkSplat`, is a react-three-fiber port of Kris's vanilla-WebGL experiment. The original is kept verbatim in `src/components/ink-splat/reference/` as the behavioural reference: when changing the sim or shaders, diff against it. On top of it sit `InkThemeToggle`/`InkThemeTransition` (theme change as a flood) `InkCallout` (a callout whose surface is a blot) and `InkEngulf` (the inverse: `mode="engulf"` on the engine, ink closing in from the box's edge, then `drain()`), and `InkSink` (`LiquidPond`, a near-verbatim port of the "Liquid Button Ink" study in `reference/`: raw WebGL2, shaders byte-for-byte, its own particle sim and APCA measurement; not the R3F ink engine). When changing it, diff against the study's `ink-liquid-button.js`. These follow the patterns of the sibling `../3d-2d-nav` repo: DOM first, decoration in a bleed canvas, outline until ready, a WebGL / reduced-motion gate (`src/components/gate.ts`), a persisted theme store stamping `data-theme` on `<html>`.

Gotchas learned while building:

- R3F mounts the scene only after measuring the canvas, so `InkSplat` keeps a `splat()` asked for before then and fires it once the layer registers.
- React StrictMode remounts effects in dev; the GPU resources are rebuilt and the splat re-armed, so a blot requested between the two mounts still lands.
- Hot-reloading a file whose hook order changed breaks the live R3F roots ("rendered more hooks"); reload the page before judging a bug.
- react-three-fiber sets `pointer-events: auto` on its wrapper div and canvas, overriding an inherited `none`. Every ink overlay needs `.canvas, .canvas * { pointer-events: none !important }` or its bleed swallows clicks on neighbouring controls.
- A hidden Browser pane pauses `requestAnimationFrame`, so the demand-driven ink cannot animate or settle there; verify with the pane visible.
- In clipped mode droplets never swell with the flood (they would burst past the clip box); the front alone covers the card.

## Workspace tools

- **Package manager:** pnpm (10.x, Node 22)
- **Linter:** oxlint (`.config/oxlint.json`)
- **Formatter:** prettier (`.config/prettier.json`)
- **Types:** `pnpm typecheck` (project references in `tsconfig.json`)

## After editing

Check types, then format and lint only the files you touched:

```sh
pnpm typecheck
pnpm exec prettier --config .config/prettier.json --ignore-path .config/prettierignore --write <files>
pnpm lint -- <files>
```

Avoid whole-repo `pnpm format` / `pnpm lint` unless asked.

## Planned work

[`IMPROVEMENTS.md`](IMPROVEMENTS.md) holds the ranked improvement plan and the design worked out for each item; section 6 of `CHANGELOG.md` mirrors its status. Read it before touching `ink-sink/` or the nacre stage, and keep both status columns current.

## Conventions

- Components live in `src/components/<name>/` with an `index.ts` barrel and are re-exported from `src/components/index.ts`.
- New elements are built on `Surface` (shape × material × expressiveness) rather than as one-off boxes; the liquid inside is a `LiquidGround` reading the page look. Use `flat` for utilitarian controls.
- Removing, disabling or holding an element is always `exit` on its `Surface` (dismiss / disable / pending), never a bespoke transition.
- The pages and components mirror `~/Git/@pmndrs/3d-2d-nav` (Nav, Announcement, Callout, the /dev pages) one for one; keep names, props and metrics aligned with that repo when adding to either. Its 3D-model pages are out of scope here.
- A thing afloat on the page (the Announcement) is an `InkSink` in `well` mode: the fixed ground is the liquid, never a pond panel of its own.
- The sink has three tiers (`liquid`, `swallow`, `quiet`); a component above it passes `tier` through rather than gating on the shaders itself, and times a dismissal from `onSunkSettled`, never a hardcoded duration.
- `src/ui` is the flat set, shared verbatim with the sibling repo: it reads only `--ui-*` from its own `tokens.css` and imports nothing from the app, so keep it portable — theme it by overriding tokens at the app level, never by importing app modules into it.
- The nav's bar is the liquid the page is not, and the active item is a pill of the page's own; both inks come from `onInk(POND_BG[...])`.
- Kind colours come from `theme/palette.ts` (the official pmndrs palette), never ad-hoc hexes.
- Dark is the project's default theme, on every load. The system's preference is not followed and a theme switched to is not carried into the next visit (`theme/store.ts` persists only the shaders switch). Design and check on the dark page first; the light page is the variant.
- The ink blot announces: it belongs to `Announcement` via `kind`, not to callouts.
- Nothing between the nav's labels and the page may open a stacking context — the sliding pill is drawn by the body-level nacre stage, so a `transform`, an `isolation` or a `z-index` on the bar or its wrappers will hide it.
- The mark's source is `reference/logo.svg`; it is drawn as paths in `nav/Logo.tsx` and as an SDF in the ink shader's `logoSDF`. Those two are the only copies — change both together.
- `localStorage` is per origin, and the dev server's port changes: anything a user saves in the browser (presets) should also be shippable in the repo (`src/app/pond-presets.json`).
- Components own their `<Canvas>` unless they are explicitly designed to live inside an existing scene.
- Prefer demand-driven rendering (`frameloop="demand"` + `invalidate()`) so idle components cost nothing.
- `erasableSyntaxOnly` is on: no enums, no parameter properties.
- Vercel builds with `pnpm build`; keep `vercel.json` in sync if the output dir or build command changes.
