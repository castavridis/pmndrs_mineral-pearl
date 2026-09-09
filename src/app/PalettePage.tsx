import { Leva } from 'leva';
import {
  LOOK_DEFAULT,
  LiquidGround,
  POND_BG,
  useLook,
  usePageLook,
  type Liquid,
  type PageLook,
} from '../components';
import { lookFromPanel, usePresets, type PresetValues } from './presets';
import { useThemeTweak } from './tweaks';

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
  const setLook = useLook((s) => s.setLook);
  const reset = useLook((s) => s.reset);
  const presets = usePresets((s) => s.presets);
  const names = Object.keys(presets);
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '72px 24px 96px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Palette</h1>
      <p style={{ margin: '0 0 28px', opacity: 0.6, maxWidth: 640 }}>
        Each liquid is a body the page can wear. The samples show the page look; a preset saved
        from the sink panel appears below with its own sample, and "apply to page" makes it the
        look of every surface.
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
          <PresetCard key={name} name={name} values={presets[name]} onApply={setLook} />
        ))}
      </Grid>
      <p style={{ margin: '28px 0 0' }}>
        <button type="button" className="text-button" onClick={reset}>
          reset the page look
        </button>
      </p>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
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
