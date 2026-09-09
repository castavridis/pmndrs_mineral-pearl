import { Leva, button, useControls } from 'leva';
import {
  CALLOUT_KINDS,
  Callout,
  InkCallout,
  calloutKinds,
  type CalloutKind,
  type InkSplatHandle,
} from '../components';
import { useThemeTweak } from './tweaks';

const COPY: Record<string, string> = {
  note: 'Highlights information that users should take into account, even when skimming.',
  tip: 'Optional information to help a user be more successful.',
  important: 'Crucial information necessary for users to succeed.',
  warning: 'Critical content demanding immediate user attention due to potential risks.',
  caution: 'Negative potential consequences of an action.',
};

// every mounted ink callout, so the panel's replay reaches all of them
const cards = new Map<string, InkSplatHandle>();
const keep = (kind: string) => (h: InkSplatHandle | null) => {
  if (h) cards.set(kind, h);
  else cards.delete(kind);
};

const H2 = ({ children }: { children: string }) => (
  <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{children}</h2>
);

/** `/dev/callout`: the callout variants side by side, every kind, and the ink blots with their panel. */
export function CalloutPage() {
  useThemeTweak();
  const c = useControls('ink callout', {
    kinds: { value: 'all', options: ['all', ...CALLOUT_KINDS] },
    trigger: { value: 'view', options: ['view', 'manual'] },
    static: false,
    radius: { value: 14, min: 0, max: 40, step: 1 },
    bleed: { value: 64, min: 0, max: 160, step: 4 },
    scale: { value: 0.65, min: 0.3, max: 2, step: 0.05 },
    nacre: { value: 0.8, min: 0, max: 1, step: 0.05 },
    maxWidth: { value: 560, min: 280, max: 900, step: 10 },
    replay: button(() => {
      for (const h of cards.values()) h.splat();
    }),
    drain: button(() => {
      for (const h of cards.values()) h.drain();
    }),
  });
  const kinds = c.kinds === 'all' ? CALLOUT_KINDS : [c.kinds as CalloutKind];
  return (
    <main style={{ display: 'grid', placeContent: 'center', gap: 64, padding: '96px 64px' }}>
      <section aria-label="Liquid surface" style={{ display: 'grid', gap: 12 }}>
        <H2>Liquid surface behind DOM content</H2>
        <Callout variant="surface" kind="note" title="Announcing v10">
          <p>
            The nav, the liquid and the ink now ship as one package. The pill grows to fit your
            links; the ground floods on a theme change.
          </p>
          <p>Read the release notes for the migration guide.</p>
        </Callout>
      </section>
      <section aria-label="Plain card" style={{ display: 'grid', gap: 12 }}>
        <H2>Plain card, the liquid calm</H2>
        <Callout variant="plain" kind="tip" title="Announcing v10">
          <p>
            The nav, the liquid and the ink now ship as one package. The pill grows to fit your
            links; the ground floods on a theme change.
          </p>
          <p>Read the release notes for the migration guide.</p>
        </Callout>
      </section>
      <section aria-label="Kinds" style={{ display: 'grid', gap: 12 }}>
        <H2>All kinds (plain)</H2>
        <div style={{ display: 'grid', gap: 24 }}>
          {CALLOUT_KINDS.map((kind) => (
            <Callout key={kind} variant="plain" kind={kind} title={`${calloutKinds[kind].label} callout`}>
              <p>
                Body copy for a {calloutKinds[kind].label.toLowerCase()} callout. The lens carries
                the kind's symbol; the label takes its colour.
              </p>
            </Callout>
          ))}
        </div>
      </section>
      <section aria-label="Ink" style={{ display: 'grid', gap: 12 }}>
        <H2>As ink blots (the panel)</H2>
        <div className="callouts">
          {kinds.map((kind) => (
            <InkCallout
              key={kind}
              kind={kind}
              title={`A ${kind} in ink`}
              trigger={c.trigger as 'view' | 'manual'}
              static={c.static}
              radius={c.radius}
              bleed={c.bleed}
              scale={c.scale}
              nacre={c.nacre}
              maxWidth={c.maxWidth}
              ref={keep(kind)}
            >
              <p>{COPY[kind]}</p>
            </InkCallout>
          ))}
        </div>
      </section>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
