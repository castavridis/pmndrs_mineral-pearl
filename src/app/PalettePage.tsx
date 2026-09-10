import { useEffect, useState } from 'react';
import { Leva, button, folder, useControls } from 'leva';
import {
  LOOK_DEFAULT,
  LiquidGround,
  POND_BG,
  useLook,
  usePageLook,
  useResolvedTheme,
  type Liquid,
  type PageLook,
} from '../components';
import { lookFromPanel, usePresets, type PresetValues } from './presets';
import { useThemeTweak } from './tweaks';

/** The look as `look.ts` would write it, on the clipboard and in the console. */
function copyLook(v: PageLook, scheme: string) {
  const name = scheme === 'light' ? 'LIGHT' : 'DARK';
  const text = `const ${name}: PageLook = ${JSON.stringify(v, null, 2)};`;
  navigator.clipboard?.writeText(text).catch(() => {});
  // the clipboard can be refused (an unfocused pane, a permission), so the
  // text is printed as well and nothing is lost either way
  console.log(text);
}

/* The panel's current values, where leva's buttons can reach them: a button's
   callback is made during render, so it cannot read a ref of its own. */
const current: { look: PageLook } = { look: LOOK_DEFAULT };

/**
 * Every number of the page look, live. The panel is built from the look in
 * force, so it follows a scheme change or a preset being applied — both bump
 * the key it is built under rather than writing into the fields, which would
 * fight whoever is typing.
 */
function useLookPanel(look: PageLook, scheme: string, sync: number) {
  const setLook = useLook((s) => s.setLook);
  const reset = useLook((s) => s.reset);
  const v = useControls(
    'look',
    () => ({
      viscosity: { value: look.viscosity, min: 0.15, max: 2, step: 0.05 },
      mineral: folder({
        minBase: { value: look.mineral.base, label: 'base' },
        minHigh: { value: look.mineral.highlight, label: 'crest' },
        minStone: { value: look.mineral.stoneGray, min: 0, max: 2, step: 0.05, label: 'stone gray' },
        minIrid: {
          value: look.mineral.iridescence,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'iridescence',
        },
        minSpec: { value: look.mineral.specular, min: 0, max: 1.5, step: 0.05, label: 'specular' },
        minGamma: { value: look.mineral.gamma, min: 0.4, max: 1.6, step: 0.02, label: 'gamma' },
      }),
      nacre: folder({
        pearlCream: { value: look.pearl.cream, label: 'cream' },
        pearlShade: { value: look.pearl.shade, label: 'shade' },
        pearlCloud: { value: look.pearl.clouding, min: 0, max: 1, step: 0.05, label: 'clouding' },
        pearlNacre: { value: look.pearl.nacre, min: 0, max: 0.3, step: 0.005, label: 'nacre' },
        pearlIrid: {
          value: look.pearl.iridescence,
          min: 0,
          max: 2,
          step: 0.05,
          label: 'iridescence',
        },
        pearlSpec: { value: look.pearl.specular, min: 0, max: 1.5, step: 0.05, label: 'specular' },
      }),
      quicksilver: folder(
        {
          mcFloor: { value: look.mercury.floor, label: 'floor' },
          mcSky: { value: look.mercury.sky, label: 'sky' },
          mcHorizon: { value: look.mercury.horizon, min: 0, max: 2, step: 0.05, label: 'horizon' },
          mcTop: { value: look.mercury.topLight, min: 0, max: 3, step: 0.05, label: 'top light' },
          mcSpec: { value: look.mercury.specular, min: 0, max: 2, step: 0.05, label: 'specular' },
          mcIrid: {
            value: look.mercury.iridescence,
            min: 0,
            max: 1,
            step: 0.02,
            label: 'iridescence',
          },
        },
        { collapsed: true }
      ),
      spectrum: folder(
        {
          spWhite: { value: look.spectrum.white, min: 0, max: 1, step: 0.02, label: 'white' },
          spSpread: { value: look.spectrum.spread, min: 0, max: 3, step: 0.05, label: 'spread' },
          spSwirl: { value: look.spectrum.swirl, min: 0.2, max: 8, step: 0.1, label: 'swirl' },
          spGlow: {
            value: look.spectrum.cursorGlow,
            min: 0,
            max: 2,
            step: 0.05,
            label: 'cursor glow',
          },
          spGrainSize: {
            value: look.spectrum.grainSize,
            min: 20,
            max: 400,
            step: 5,
            label: 'grain size',
          },
          spGrainDens: {
            value: look.spectrum.grainDensity,
            min: 0,
            max: 1,
            step: 0.05,
            label: 'grain density',
          },
          spGlitterDens: {
            value: look.spectrum.glitterDensity,
            min: 0,
            max: 1,
            step: 0.02,
            label: 'glitter density',
          },
          spFacet: {
            value: look.spectrum.facetSharpness,
            min: 10,
            max: 600,
            step: 10,
            label: 'facet sharpness',
          },
          spGlint: { value: look.spectrum.glint, min: 0, max: 4, step: 0.1, label: 'glint' },
          spLamina: { value: look.spectrum.lamina, min: 8, max: 400, step: 2, label: 'striations' },
        },
        { collapsed: true }
      ),
      pointer: folder(
        {
          ptReaction: { value: look.pointer.reaction, min: 0, max: 3, step: 0.05, label: 'reaction' },
          ptDimple: { value: look.pointer.dimple, min: 0, max: 3, step: 0.05, label: 'dimple' },
          ptWake: { value: look.pointer.wake, min: 0, max: 3, step: 0.05, label: 'wake' },
          ptTilt: { value: look.pointer.tilt, min: 0, max: 3, step: 0.05, label: 'tilt' },
          ptDrift: { value: look.pointer.drift, min: 0, max: 3, step: 0.05, label: 'drift' },
        },
        { collapsed: true }
      ),
      'copy as defaults': button(() => copyLook(current.look, scheme)),
      'reset both schemes': button(() => reset()),
    }),
    [scheme, sync]
  );
  // The panel's flat values are the same shape a saved preset has, so the same
  // reader turns them into a look. Keyed on their content rather than their
  // identity: leva hands back a fresh object each render, and writing the look
  // on every one of those is a render loop, since the look is what the page is
  // drawn from.
  const signature = JSON.stringify(v);
  useEffect(() => {
    setLook(lookFromPanel(JSON.parse(signature) as PresetValues));
  }, [signature, setLook]);
}

const LIQUIDS: Liquid[] = ['mineral', 'pearl', 'mercury'];

/** Sample size in CSS px. */
const SAMPLE = { width: 300, height: 190 };

/**
 * `/dev/palette`: one card per liquid with a live sample in the page look,
 * and one per saved preset, each applicable to the whole page. The sink
 * panel on `/dev/engulf` is where presets are made.
 */
export function PalettePage() {
  useThemeTweak();
  const look = usePageLook();
  const scheme = useResolvedTheme();
  const setLook = useLook((s) => s.setLook);
  const reset = useLook((s) => s.reset);
  // bumped whenever the look is changed from outside the panel, so the panel
  // is rebuilt from what is in force
  const [sync, setSync] = useState(0);
  useEffect(() => {
    current.look = look;
  }, [look]);
  useLookPanel(look, scheme, sync);
  const presets = usePresets((s) => s.presets);
  const names = Object.keys(presets);
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '72px 24px 96px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Palette</h1>
      <p style={{ margin: '0 0 28px', opacity: 0.6, maxWidth: 640 }}>
        Each liquid is a body the page can wear. The samples show the page look; a preset saved from
        the sink panel appears below with its own sample, and "apply to page" makes it the look of
        every surface.
      </p>
      <Grid>
        {LIQUIDS.map((liquid) => (
          <Card key={liquid} name={liquid} sub={bodyLine(liquid, look)} swatch={POND_BG[liquid]}>
            <LiquidGround liquid={liquid} maxDpr={2} unit={SAMPLE.height} />
          </Card>
        ))}
      </Grid>
      <h2 style={{ margin: '40px 0 8px', fontSize: 17, fontWeight: 500 }}>Presets</h2>
      <p style={{ margin: '0 0 20px', opacity: 0.6, maxWidth: 640 }}>
        {names.length ? 'Saved from the sink panel.' : 'None saved yet: make one on /dev/engulf.'}
      </p>
      <Grid>
        {names.map((name) => (
          <PresetCard
            key={name}
            name={name}
            values={presets[name]}
            onApply={(l) => {
              setLook(l);
              setSync((n) => n + 1);
            }}
          />
        ))}
      </Grid>
      <p style={{ margin: '28px 0 0' }}>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            reset();
            setSync((n) => n + 1);
          }}
        >
          reset the page look
        </button>
      </p>
      <Leva collapsed={false} titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}

const bodyLine = (liquid: Liquid, look: PageLook) =>
  liquid === 'mineral'
    ? `base ${look.mineral.base} · crest ${look.mineral.highlight}`
    : liquid === 'pearl'
      ? `cream ${look.pearl.cream} · shade ${look.pearl.shade}`
      : `floor ${look.mercury.floor} · sky ${look.mercury.sky}`;

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${SAMPLE.width}px, 1fr))`,
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  name,
  sub,
  swatch,
  action,
  children,
}: {
  name: string;
  sub: string;
  swatch: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={name}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
      }}
    >
      <div style={{ position: 'relative', height: SAMPLE.height }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            flex: 'none',
            borderRadius: 8,
            background: swatch,
            boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.15)',
          }}
        />
        <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 500 }}>{name}</span>
          <code style={{ fontSize: 12, opacity: 0.55 }}>{sub}</code>
        </div>
        {action}
      </div>
    </section>
  );
}

/** A saved preset: a sample in its own look, and the page can take it. */
function PresetCard({
  name,
  values,
  onApply,
}: {
  name: string;
  values: PresetValues;
  onApply: (look: ReturnType<typeof lookFromPanel>) => void;
}) {
  const partial = lookFromPanel(values);
  const liquid: Liquid =
    values.liquid === 'pearl' || values.liquid === 'mercury' ? values.liquid : 'mineral';
  const full: PageLook = {
    viscosity: partial.viscosity ?? LOOK_DEFAULT.viscosity,
    mineral: { ...LOOK_DEFAULT.mineral, ...partial.mineral },
    pearl: { ...LOOK_DEFAULT.pearl, ...partial.pearl },
    mercury: { ...LOOK_DEFAULT.mercury, ...partial.mercury },
    spectrum: { ...LOOK_DEFAULT.spectrum, ...partial.spectrum },
    pointer: { ...LOOK_DEFAULT.pointer, ...partial.pointer },
  };
  return (
    <Card
      name={name}
      sub={bodyLine(liquid, full)}
      swatch={POND_BG[liquid]}
      action={
        <button type="button" className="text-button" onClick={() => onApply(partial)}>
          apply to page
        </button>
      }
    >
      <LiquidGround
        liquid={liquid}
        maxDpr={2}
        unit={SAMPLE.height}
        viscosity={full.viscosity}
        mineral={full.mineral}
        pearl={full.pearl}
        mercury={full.mercury}
        spectrum={full.spectrum}
        reaction={full.pointer}
      />
    </Card>
  );
}
