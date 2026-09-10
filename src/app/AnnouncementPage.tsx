import { useEffect, useState } from 'react';
import { Leva, button, folder, useControls } from 'leva';
import { ANNOUNCEMENT_SWALLOW, Announcement, type AnnouncementSwallow } from '../components';
import { useThemeTweak } from './tweaks';

/* The panel's current values, where leva's buttons can reach them: a button's
   callback is made during render, so it cannot read a ref of its own. Same
   arrangement as `latest` in presets.ts. */
const current: { look: AnnouncementSwallow } = { look: ANNOUNCEMENT_SWALLOW };

/** The look as `swallow.ts` would write it, on the clipboard and in the console. */
function copyDefaults(v: AnnouncementSwallow) {
  const lines = Object.entries(v)
    .filter(([, x]) => x !== undefined)
    .map(([k, x]) => `  ${k}: ${x},`)
    .join('\n');
  const text = `export const ANNOUNCEMENT_SWALLOW: AnnouncementSwallow = {\n${lines}\n};`;
  navigator.clipboard?.writeText(text).catch(() => {});
  // the clipboard can be refused (an unfocused pane, a permission), so the
  // text is printed as well and nothing is lost either way
  console.log(text);
}

/** `/dev/announcement`: the banner afloat on the page, at two widths. */
export function AnnouncementPage() {
  useThemeTweak();
  const [gen, setGen] = useState(0);
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const d = ANNOUNCEMENT_SWALLOW;
  const c = useControls('announcement', {
    variant: {
      value: 'auto',
      options: ['auto', 'liquid', 'swallow', 'quiet', 'flat', 'ink'],
      hint: 'liquid is the pond; swallow and quiet are the fallbacks; flat opts out of floating; ink is a splash that floods the banner',
    },
    dismissible: true,
    restore: button(() => {
      setGone({});
      setGen((g) => g + 1);
    }),
    // The panel is where a look is found; `swallow.ts` is where it lives. This
    // writes the current values as that file's literal, ready to paste over
    // the one there — leva has no persistence of its own, and a default the
    // site ships has to be in the source rather than in a browser's storage.
    'copy as defaults': button(() => copyDefaults(current.look)),
    // the dismissal: what the liquid does as it takes the banner down. Dismiss
    // a banner, tune, hit restore, dismiss again.
    swallow: folder({
      globSize: { value: d.globSize, min: 0.4, max: 3, step: 0.05, label: 'droplet size' },
      globDensity: { value: d.globDensity, min: 0, max: 1, step: 0.05, label: 'density' },
      globHeight: { value: d.globHeight, min: 0, max: 2.5, step: 0.05, label: 'heap height' },
      globSettle: { value: d.globSettle, min: 0, max: 4, step: 0.05, label: 'settle (s)' },
      globShading: { value: d.globShading, label: 'lit mass' },
      droplets: { value: d.droplets, label: 'throw droplets' },
      // the panel opens on the shipped look, whatever that is
      viscous: { value: d.viscosity !== undefined, label: 'own viscosity' },
      viscosity: {
        value: d.viscosity ?? 0.4,
        min: 0.15,
        max: 2,
        step: 0.05,
        render: (get) => get('announcement.swallow.viscous'),
      },
      sinkDepth: { value: d.sinkDepth, min: -1, max: 0, step: 0.01, label: 'rest depth' },
      pressDepth: { value: d.pressDepth, min: -0.6, max: 0, step: 0.01, label: 'press depth' },
      bleed: { value: d.bleed, min: 24, max: 200, step: 4 },
    }),
  });
  const swallow: AnnouncementSwallow = {
    globSize: c.globSize,
    globDensity: c.globDensity,
    globHeight: c.globHeight,
    globSettle: c.globSettle,
    globShading: c.globShading,
    droplets: c.droplets,
    viscosity: c.viscous ? c.viscosity : undefined,
    // in the order `AnnouncementSwallow` declares them, so the copied block
    // reads as a straight replacement for the one in swallow.ts
    pressDepth: c.pressDepth,
    sinkDepth: c.sinkDepth,
    bleed: c.bleed,
  };
  useEffect(() => {
    current.look = swallow;
  });
  const variant = c.variant as 'auto' | 'liquid' | 'swallow' | 'quiet' | 'flat' | 'ink';
  const dismiss = (id: string) => () => setGone((g) => ({ ...g, [id]: true }));
  const items = [
    {
      id: 'a',
      title: 'Announcement · 652px',
      width: 652,
      body: (
        <>
          <span>
            <strong>Mineral &amp; pearl.</strong> Liquid surfaces for pmndrs, grown from Kris's ink
            splat.
          </span>
          <a href="/dev/">Look inside</a>
        </>
      ),
    },
    {
      id: 'b',
      title: 'Announcement · 900px',
      width: 900,
      body: (
        <>
          <span>
            <strong>Everything sinks.</strong> Banners, controls and callouts float on the page's own
            liquid, and go under when they leave.
          </span>
          <a href="/dev/engulf">Try one</a>
        </>
      ),
    },
  ];
  return (
    <main
      key={gen}
      style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', gap: 96, padding: 64 }}
    >
      {items.map((it) => (
        <section key={it.id} aria-label={it.title} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{it.title}</h2>
          <div style={{ width: it.width, maxWidth: 'calc(100vw - 128px)', minHeight: 94 }}>
            {!gone[it.id] && (
              <Announcement
                width={it.width}
                variant={variant}
                swallow={swallow}
                onDismiss={c.dismissible ? dismiss(it.id) : undefined}
              >
                {it.body}
              </Announcement>
            )}
          </div>
        </section>
      ))}
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
