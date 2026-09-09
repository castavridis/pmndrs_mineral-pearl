import { useEffect, useState } from 'react';
import { Leva, button, folder, useControls } from 'leva';
import { create } from 'zustand';
import {
  InkEngulf,
  InkSink,
  MERCURY_DEFAULT,
  MINERAL_DEFAULT,
  PEARL_DEFAULT,
  POINTER_DEFAULT,
  SPECTRUM_DEFAULT,
  page,
  type InkEngulfHandle,
  type InkSinkHandle,
  type Liquid,
  useResolvedTheme,
} from '../components';
import { latest, presetable, usePresets } from './presets';
import { call, register, useThemeTweak } from './tweaks';

// restore remounts the engulfed block; leva's button needs a setter it can
// reach without a hook, so the run counter lives in a tiny store
const useRuns = create<{ run: number; restore: () => void }>((set) => ({
  run: 0,
  restore: () => set((s) => ({ run: s.run + 1 })),
}));

/** `/dev/engulf`: content swallowed by ink from its edges, or afloat on the study's pond. */
export function EngulfPage() {
  useThemeTweak();
  const theme = useResolvedTheme();
  const run = useRuns((s) => s.run);
  const [gone, setGone] = useState(false);

  const engulf = useControls('engulf', {
    radius: { value: 14, min: 0, max: 40, step: 1 },
    bleed: { value: 48, min: 0, max: 160, step: 4 },
    scale: { value: 0.7, min: 0.3, max: 2, step: 0.05 },
    keep: false,
    inkOverride: { value: false, label: 'custom ink' },
    ink: { value: page.light.ink, render: (get) => get('engulf.inkOverride') },
    engulf: button(call('engulf', 'engulf')),
    restore: button(() => useRuns.getState().restore()),
  });

  const [sink, setSink] = useControls('sink', () => ({
    liquid: { value: 'auto', options: ['auto', 'mineral', 'pearl', 'mercury'] },
    sunk: false,
    press: button(call('sink', 'press')),
    viscosity: { value: 0.4, min: 0.15, max: 2, step: 0.05 },
    mercuryOnSink: { value: true, label: 'mercury on sink' },
    globs: folder({
      globSize: { value: 1, min: 0.4, max: 2.5, step: 0.1, label: 'size' },
      globDensity: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'density' },
      globHeight: { value: 0, min: 0, max: 2.5, step: 0.1, label: 'height' },
      globShading: { value: false, label: 'shading' },
    }),
    radius: { value: 16, min: 0, max: 40, step: 1 },
    bleed: { value: 96, min: 24, max: 200, step: 4 },
    mineral: folder(
      {
        minBase: { value: MINERAL_DEFAULT.base, label: 'base' },
        minHigh: { value: MINERAL_DEFAULT.highlight, label: 'highlight' },
        minStone: {
          value: MINERAL_DEFAULT.stoneGray,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'stone gray',
        },
        minIrid: {
          value: MINERAL_DEFAULT.iridescence,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'iridescence',
        },
        minSpec: { value: MINERAL_DEFAULT.specular, min: 0, max: 1.5, step: 0.05, label: 'specular' },
        minGamma: { value: MINERAL_DEFAULT.gamma, min: 0.4, max: 1.6, step: 0.02, label: 'gamma' },
      },
      { collapsed: true }
    ),
    nacre: folder(
      {
        pearlCream: { value: PEARL_DEFAULT.cream, label: 'cream' },
        pearlShade: { value: PEARL_DEFAULT.shade, label: 'shade' },
        pearlCloud: {
          value: PEARL_DEFAULT.clouding,
          min: 0,
          max: 1,
          step: 0.05,
          label: 'white clouding',
        },
        pearlNacre: { value: PEARL_DEFAULT.nacre, min: 0, max: 0.3, step: 0.005, label: 'nacre' },
        pearlIrid: {
          value: PEARL_DEFAULT.iridescence,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'iridescence',
        },
        pearlSpec: { value: PEARL_DEFAULT.specular, min: 0, max: 1.5, step: 0.05, label: 'specular' },
      },
      { collapsed: true }
    ),
    quicksilver: folder(
      {
        mcFloor: { value: MERCURY_DEFAULT.floor, label: 'floor' },
        mcSky: { value: MERCURY_DEFAULT.sky, label: 'sky' },
        mcHorizon: { value: MERCURY_DEFAULT.horizon, min: 0, max: 2, step: 0.05, label: 'horizon' },
        mcTop: { value: MERCURY_DEFAULT.topLight, min: 0, max: 3, step: 0.05, label: 'top light' },
        mcSpec: { value: MERCURY_DEFAULT.specular, min: 0, max: 2, step: 0.05, label: 'specular' },
        mcIrid: {
          value: MERCURY_DEFAULT.iridescence,
          min: 0,
          max: 1,
          step: 0.02,
          label: 'iridescence',
        },
      },
      { collapsed: true }
    ),
    pointer: folder(
      {
        ptReaction: {
          value: POINTER_DEFAULT.reaction,
          min: 0,
          max: 3,
          step: 0.05,
          label: 'reaction',
        },
        ptDimple: { value: POINTER_DEFAULT.dimple, min: 0, max: 3, step: 0.05, label: 'dimple' },
        ptWake: { value: POINTER_DEFAULT.wake, min: 0, max: 3, step: 0.05, label: 'wake' },
        ptTilt: { value: POINTER_DEFAULT.tilt, min: 0, max: 3, step: 0.05, label: 'tilt' },
        ptDrift: { value: POINTER_DEFAULT.drift, min: 0, max: 3, step: 0.05, label: 'drift' },
      },
      { collapsed: true }
    ),
    spectrum: folder(
      {
        spWhite: {
          value: SPECTRUM_DEFAULT.white,
          min: 0,
          max: 1,
          step: 0.02,
          label: 'white transparency',
        },
        spSpread: {
          value: SPECTRUM_DEFAULT.spread,
          min: 0,
          max: 3,
          step: 0.05,
          label: 'spectrum spread',
        },
        spSwirl: { value: SPECTRUM_DEFAULT.swirl, min: 0.2, max: 8, step: 0.1, label: 'nacre swirl' },
        spGlow: {
          value: SPECTRUM_DEFAULT.cursorGlow,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'cursor glow',
        },
        spGrainSize: {
          value: SPECTRUM_DEFAULT.grainSize,
          min: 20,
          max: 400,
          step: 5,
          label: 'grain size',
        },
        spGrainDens: {
          value: SPECTRUM_DEFAULT.grainDensity,
          min: 0,
          max: 1,
          step: 0.05,
          label: 'grain density',
        },
        spGlitterDens: {
          value: SPECTRUM_DEFAULT.glitterDensity,
          min: 0,
          max: 1,
          step: 0.02,
          label: 'glitter density',
        },
        spFacet: {
          value: SPECTRUM_DEFAULT.facetSharpness,
          min: 10,
          max: 600,
          step: 10,
          label: 'facet sharpness',
        },
        spGlint: {
          value: SPECTRUM_DEFAULT.glint,
          min: 0,
          max: 4,
          step: 0.1,
          label: 'glint strength',
        },
        spGlintPtr: {
          value: SPECTRUM_DEFAULT.glintFollowsPointer,
          min: 0,
          max: 1,
          step: 0.05,
          label: 'glint follows cursor',
        },
      },
      { collapsed: true }
    ),
  }));
  // presets: the whole sink panel, saved by name in localStorage
  const presets = usePresets((s) => s.presets);
  const names = Object.keys(presets).sort();
  useEffect(() => {
    latest.values = sink;
    latest.set = (v) => setSink(v as Parameters<typeof setSink>[0]);
  });
  // the select's onChange does not fire for its initial value, so an
  // untouched selection means the first saved preset
  const chosen = () => {
    const all = usePresets.getState().presets;
    return latest.preset in all ? latest.preset : (Object.keys(all).sort()[0] ?? '');
  };
  useControls(
    'presets',
    () => ({
      name: {
        value: latest.name,
        label: 'name',
        onChange: (v: string) => {
          latest.name = v;
        },
        transient: false,
      },
      save: button(() => {
        const name = latest.name.trim();
        if (name) usePresets.getState().save(name, presetable(latest.values));
      }),
      preset: {
        value: names.includes(latest.preset) ? latest.preset : (names[0] ?? ''),
        options: names.length ? names : [''],
        label: 'saved',
        onChange: (v: string) => {
          latest.preset = v;
        },
        transient: false,
      },
      load: button(() => {
        const v = usePresets.getState().presets[chosen()];
        if (v) latest.set?.(v);
      }),
      delete: button(() => usePresets.getState().remove(chosen())),
      'copy JSON': button(
        () => void navigator.clipboard?.writeText(JSON.stringify(presetable(latest.values), null, 2))
      ),
    }),
    [names.join('|')]
  );

  const mineral = {
    base: sink.minBase,
    highlight: sink.minHigh,
    stoneGray: sink.minStone,
    iridescence: sink.minIrid,
    specular: sink.minSpec,
    gamma: sink.minGamma,
  };
  const pearl = {
    cream: sink.pearlCream,
    shade: sink.pearlShade,
    clouding: sink.pearlCloud,
    nacre: sink.pearlNacre,
    iridescence: sink.pearlIrid,
    specular: sink.pearlSpec,
  };
  const mercury = {
    floor: sink.mcFloor,
    sky: sink.mcSky,
    horizon: sink.mcHorizon,
    topLight: sink.mcTop,
    specular: sink.mcSpec,
    iridescence: sink.mcIrid,
  };
  const pointer = {
    reaction: sink.ptReaction,
    dimple: sink.ptDimple,
    wake: sink.ptWake,
    tilt: sink.ptTilt,
    drift: sink.ptDrift,
  };
  const spectrum = {
    white: sink.spWhite,
    spread: sink.spSpread,
    swirl: sink.spSwirl,
    cursorGlow: sink.spGlow,
    grainSize: sink.spGrainSize,
    grainDensity: sink.spGrainDens,
    glitterDensity: sink.spGlitterDens,
    facetSharpness: sink.spFacet,
    glint: sink.spGlint,
    glintFollowsPointer: sink.spGlintPtr,
  };

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Ink engulf</h1>
        <p style={{ margin: 0, opacity: 0.6 }}>
          The inverse of the callout: the ink comes in from the edges and the content goes under.
          After that the ink drains and only the spatter is left; with <code>keep</code> it stays.
          Below it, the study's pond. Every knob is in the panel.
        </p>
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, opacity: 0.7 }}>
          A paragraph, {engulf.keep ? 'kept under the ink' : 'drained afterwards'}
          {gone ? ' · gone' : ''}
        </h2>
        <InkEngulf
          key={run}
          ref={register<InkEngulfHandle>('engulf')}
          radius={engulf.radius}
          bleed={engulf.bleed}
          scale={engulf.scale}
          keep={engulf.keep}
          ink={engulf.inkOverride ? engulf.ink : undefined}
          onDone={() => setGone(true)}
          onCovered={() => setGone(false)}
        >
          <div className="prose-card">
            <p>
              The pmndrs collective builds the tools that make 3D on the web feel like the rest of
              your app: a renderer that speaks React, layout that flexes, springs that settle.
            </p>
            <p>
              This paragraph is about to be drowned. The ink closes in from the card's edges, fingers
              first; the text disappears under it, the flood withdraws, and the stain remains.
            </p>
          </div>
        </InkEngulf>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, opacity: 0.7 }}>
          A card afloat on the pond · {theme}
        </h2>
        <InkSink
          ref={register<InkSinkHandle>('sink')}
          liquid={sink.liquid as Liquid | 'auto'}
          sunk={sink.sunk}
          onSunkChange={(v) => setSink({ sunk: v })}
          viscosity={sink.viscosity}
          mercuryOnSink={sink.mercuryOnSink}
          globSize={sink.globSize}
          globDensity={sink.globDensity}
          globHeight={sink.globHeight}
          globShading={sink.globShading}
          mineral={mineral}
          pearl={pearl}
          spectrum={spectrum}
          pointer={pointer}
          mercury={mercury}
          radius={sink.radius}
          bleed={sink.bleed}
        >
          <div className="slab-card">
            <p>
              A rounded slab rests on a thin, heavy liquid. Hover and it tips under the pointer's
              weight like a plank with a ball on it. Sink it and it goes under with a splash: droplets
              burst from the rim, fly, strand and pinch off, then are drawn back onto the slab and
              merge until the mass has closed over it. Let it rise and they slide off and thin away as
              it bobs back up.
            </p>
          </div>
        </InkSink>
      </section>
      <Leva collapsed={false} titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
