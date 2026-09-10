import { useState } from 'react';
import { Leva, button, folder, useControls } from 'leva';
import { ANNOUNCEMENT_SWALLOW, Announcement } from '../components';
import { useThemeTweak } from './tweaks';

/** `/dev/announcement`: the banner afloat on the page, at two widths. */
export function AnnouncementPage() {
  useThemeTweak();
  const [gen, setGen] = useState(0);
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const d = ANNOUNCEMENT_SWALLOW;
  const c = useControls('announcement', {
    variant: {
      value: 'auto',
      options: ['auto', 'liquid', 'swallow', 'quiet', 'flat'],
      hint: 'liquid is the pond; swallow and quiet are the fallbacks; flat opts out of floating',
    },
    dismissible: true,
    restore: button(() => {
      setGone({});
      setGen((g) => g + 1);
    }),
    // the dismissal: what the liquid does as it takes the banner down. Dismiss
    // a banner, tune, hit restore, dismiss again.
    swallow: folder({
      globSize: { value: d.globSize, min: 0.4, max: 3, step: 0.05, label: 'droplet size' },
      globDensity: { value: d.globDensity, min: 0, max: 1, step: 0.05, label: 'density' },
      globHeight: { value: d.globHeight, min: 0, max: 2.5, step: 0.05, label: 'heap height' },
      globSettle: { value: d.globSettle, min: 0, max: 4, step: 0.05, label: 'settle (s)' },
      globShading: { value: d.globShading, label: 'lit mass' },
      droplets: { value: d.droplets, label: 'throw droplets' },
      viscous: { value: false, label: 'own viscosity' },
      viscosity: {
        value: 0.4,
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
  const swallow = {
    globSize: c.globSize,
    globDensity: c.globDensity,
    globHeight: c.globHeight,
    globSettle: c.globSettle,
    globShading: c.globShading,
    droplets: c.droplets,
    viscosity: c.viscous ? c.viscosity : undefined,
    sinkDepth: c.sinkDepth,
    pressDepth: c.pressDepth,
    bleed: c.bleed,
  };
  const variant = c.variant as 'auto' | 'liquid' | 'swallow' | 'quiet' | 'flat';
  const dismiss = (id: string) => () => setGone((g) => ({ ...g, [id]: true }));
  const items = [
    {
      id: 'a',
      title: 'Announcement · 652px',
      width: 652,
      body: (
        <>
          <span>
            <strong>v10 is out.</strong> Petals, glass and the growing pill, in one package.
          </span>
          <a href="/blog">Read more</a>
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
            <strong>Workshop next week.</strong> Bring your own GLBs; we will make them iridescent.
          </span>
          <a href="/events">Register</a>
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
