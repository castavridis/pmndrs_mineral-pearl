import { Leva, button, useControls } from 'leva';
import { CALLOUT_KINDS, InkCallout, type CalloutKind, type InkSplatHandle } from '../components';
import { useThemeTweak } from './tweaks';

const COPY: Record<string, string> = {
  note: 'Highlights information that users should take into account, even when skimming.',
  tip: 'Optional information to help a user be more successful.',
  important: 'Crucial information necessary for users to succeed.',
  warning: 'Critical content demanding immediate user attention due to potential risks.',
  caution: 'Negative potential consequences of an action.',
};

// every mounted callout, so the panel's replay reaches all of them
const cards = new Map<string, InkSplatHandle>();
const keep = (kind: string) => (h: InkSplatHandle | null) => {
  if (h) cards.set(kind, h);
  else cards.delete(kind);
};

/** `/dev/callout`: every kind as ink, with every prop in the panel. */
export function CalloutPage() {
  useThemeTweak();
  const c = useControls('callout', {
    kinds: { value: 'all', options: ['all', ...CALLOUT_KINDS] },
    trigger: { value: 'view', options: ['view', 'manual'] },
    static: false,
    radius: { value: 14, min: 0, max: 40, step: 1 },
    bleed: { value: 64, min: 0, max: 160, step: 4 },
    scale: { value: 0.65, min: 0.3, max: 2, step: 0.05 },
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
    <main className="page">
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Ink callouts</h1>
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
            maxWidth={c.maxWidth}
            ref={keep(kind)}
          >
            <p>{COPY[kind]}</p>
          </InkCallout>
        ))}
      </div>
      <Leva collapsed={false} titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
