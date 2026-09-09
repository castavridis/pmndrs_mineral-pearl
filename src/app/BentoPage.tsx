import { useRef, useState } from 'react';
import {
  InkCallout,
  InkEngulf,
  LiquidGround,
  NacreCallout,
  type InkEngulfHandle,
} from '../components';

const Logo = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 1 1" width={size} height={size} aria-hidden="true">
    <g fill="currentColor">
      <rect x="0.35" y="0" width="0.65" height="0.288" />
      <rect x="0.7" y="0" width="0.3" height="0.64" />
      <rect x="0.35" y="0.339" width="0.3" height="0.3" />
      <rect x="0" y="0.339" width="0.3" height="0.3" />
      <rect x="0.35" y="0.689" width="0.3" height="0.308" />
    </g>
  </svg>
);

/** A small control on the liquid: a pill-shaped pond with the label on it. */
function LiquidButton({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <button type="button" className={`bento-liquid ${wide ? 'wide' : ''}`}>
      <LiquidGround />
      <span>{children}</span>
    </button>
  );
}

/**
 * `/dev/bento`: the shader bento, the components laid out by how expressive
 * they are. Most expressive: the liquid pill nav and the ink announcement.
 * Somewhat expressive: liquid buttons and the nacre callout. Utilitarian:
 * plain controls and a tabbed card.
 */
export function BentoPage() {
  const banner = useRef<InkEngulfHandle>(null);
  const [gone, setGone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState(2);
  return (
    <main className="bento">
      <section className="bento-tier">
        <h2>Most Expressive</h2>
        <div className="bento-row">
          <nav className="pill pill-sm" aria-label="Bento nav">
            <LiquidGround />
            <a href="/" className="pill-logo" aria-label="pmndrs home">
              <Logo />
            </a>
            <div className="pill-links">
              <a href="/docs">
                <strong>Docs</strong>
              </a>
              <a href="/examples">Examples</a>
              <a href="/blog">Blog</a>
            </div>
          </nav>
          {!gone && (
            <InkEngulf ref={banner} className="bento-grow" onDone={() => setGone(true)}>
              <div className="banner">
                <span>
                  <strong>Announcement.</strong> The ink layers ship as separate chunks.
                </span>
                <a href="/blog">Read more</a>
                <button
                  type="button"
                  className="banner-dismiss"
                  aria-label="Dismiss announcement"
                  onClick={() => banner.current?.engulf()}
                >
                  ×
                </button>
              </div>
            </InkEngulf>
          )}
        </div>
      </section>

      <section className="bento-tier">
        <h2>Somewhat Expressive</h2>
        <div className="bento-row">
          <div className="bento-stack">
            <div className="bento-inline">
              <LiquidButton>{copied ? 'Copied!' : 'Copy'}</LiquidButton>
              <button type="button" className="text-button" onClick={() => setCopied((c) => !c)}>
                toggle
              </button>
            </div>
            <LiquidButton wide>Article Launcher</LiquidButton>
          </div>
          <div className="bento-grow bento-stack">
            <NacreCallout kind="tip">
              <p>
                A callout on black mineral nacre: the droplet follows the pointer under the surface,
                and the text is refracted through it.
              </p>
            </NacreCallout>
            <InkCallout kind="note" title="And the ink callout" maxWidth="100%">
              <p>The blot lands when it scrolls into view and floods the card.</p>
            </InkCallout>
          </div>
        </div>
      </section>

      <section className="bento-tier">
        <h2>Utilitarian</h2>
        <div className="bento-row">
          <div className="bento-inline">
            <button type="button" className="kbd">
              Cmd K
            </button>
            <button type="button" className="kbd">
              TW
            </button>
            <button type="button" className="kbd">
              DI
            </button>
            <button type="button" className="kbd">
              GH
            </button>
          </div>
          <div className="tabs-card">
            <div className="tabs" role="tablist">
              {['Logo', 'React Three Fiber', 'Introduction'].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  className={tab === i ? 'active' : ''}
                  onClick={() => setTab(i)}
                >
                  {i === 0 ? <Logo size={18} /> : t}
                </button>
              ))}
            </div>
            <ul>
              <li>Does it have limitations?</li>
              <li>Point 2</li>
              <li>Point 3</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
