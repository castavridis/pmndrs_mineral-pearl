import { Leva } from 'leva';
import { CALLOUT_KINDS, Callout, calloutKinds } from '../components';
import { useThemeTweak } from './tweaks';

const H2 = ({ children }: { children: string }) => (
  <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{children}</h2>
);

/**
 * `/dev/callout`: the callout variants side by side and every kind. The ink
 * blot is not here any more — it announces (see `/dev/announcement`).
 */
export function CalloutPage() {
  useThemeTweak();
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
        <H2>All kinds (plain), on the official palette</H2>
        <div style={{ display: 'grid', gap: 24 }}>
          {CALLOUT_KINDS.map((kind) => (
            <Callout
              key={kind}
              variant="plain"
              kind={kind}
              title={`${calloutKinds[kind].label} callout`}
            >
              <p>
                Body copy for a {calloutKinds[kind].label.toLowerCase()} callout. The lens carries
                the kind's symbol; the label takes its palette colour ({calloutKinds[kind].colour}).
              </p>
            </Callout>
          ))}
        </div>
      </section>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
