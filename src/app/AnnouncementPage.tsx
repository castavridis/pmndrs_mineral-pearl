import { useState } from 'react';
import { Leva, button, useControls } from 'leva';
import { Announcement, CALLOUT_KINDS, calloutKinds } from '../components';
import { useThemeTweak } from './tweaks';

/** `/dev/announcement`: the banner afloat on the page, at two widths. */
export function AnnouncementPage() {
  useThemeTweak();
  const [gen, setGen] = useState(0);
  const [gone, setGone] = useState<Record<string, boolean>>({});
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
  });
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
      <section aria-label="Kinds" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>
          Announcing a kind · the blot lands at the left, in the kind's palette colour
        </h2>
        <div style={{ display: 'grid', gap: 40, width: 652, maxWidth: 'calc(100vw - 128px)' }}>
          {CALLOUT_KINDS.map((k) => (
            <Announcement key={k} width={652} variant={variant} kind={k}>
              <span>
                <strong>{calloutKinds[k].label}.</strong> The ink is the palette's{' '}
                {calloutKinds[k].colour}.
              </span>
            </Announcement>
          ))}
        </div>
      </section>
      {items.map((it) => (
        <section key={it.id} aria-label={it.title} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{it.title}</h2>
          <div style={{ width: it.width, maxWidth: 'calc(100vw - 128px)', minHeight: 94 }}>
            {!gone[it.id] && (
              <Announcement
                width={it.width}
                variant={variant}
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
