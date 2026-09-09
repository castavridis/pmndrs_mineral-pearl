import { useRef, useState } from 'react';
import { InkCallout, InkEngulf, LiquidGround, type InkEngulfHandle } from '../components';

const LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Showcase', href: '/showcase' },
  { label: 'Blog', href: '/blog' },
];

/**
 * `/`: the site home, the iridescent-nav layout redrawn in ink. Everything is
 * DOM; the ink arrives after mount, callout by callout, as they scroll in.
 */
export function Home() {
  const banner = useRef<InkEngulfHandle>(null);
  const [bannerGone, setBannerGone] = useState(false);
  return (
    <>
      <header className="site-header">
        <nav aria-label="Primary" className="pill">
          <LiquidGround />
          <a href="/" className="pill-logo" aria-label="pmndrs home">
            <svg viewBox="0 0 1 1" width="34" height="34" aria-hidden="true">
              <g fill="currentColor">
                <rect x="0.35" y="0" width="0.65" height="0.288" />
                <rect x="0.7" y="0" width="0.3" height="0.64" />
                <rect x="0.35" y="0.339" width="0.3" height="0.3" />
                <rect x="0" y="0.339" width="0.3" height="0.3" />
                <rect x="0.35" y="0.689" width="0.3" height="0.308" />
              </g>
            </svg>
          </a>
          <div className="pill-links">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
          <button type="button" className="pill-kbd" aria-label="Open command palette">
            ⌘K
          </button>
        </nav>
      </header>
      <main className="page">
        {!bannerGone && (
          <section aria-label="Announcement" style={{ display: 'grid', justifyItems: 'center' }}>
            <InkEngulf ref={banner} style={{ maxWidth: 652 }} onDone={() => setBannerGone(true)}>
              <div className="banner">
                <span>
                  <strong>v10 is out.</strong> Petals, glass and the growing pill, in one package.
                </span>
                <a href="/blog/v10">Read more</a>
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
          </section>
        )}
        <section className="hero">
          <h1>React, three and a well of ink.</h1>
          <p>
            The pmndrs collective builds the tools that make 3D on the web feel like the rest of your
            app: a renderer that speaks React, layout that flexes, springs that settle. This page is
            the nav explorations drawn again in ink: the theme toggle floods the page, and each
            callout lands as a blot.
          </p>
        </section>
        <section aria-label="Callouts" className="callouts">
          <InkCallout kind="tip" title="Start with the fiber docs">
            <p>
              Everything here is built from the same primitives you already know: components, hooks
              and props.
            </p>
          </InkCallout>
          <InkCallout kind="warning" title="Big models load lazily">
            <p>
              The ink layers ship as separate chunks. Outlined cards stand in until the canvas has
              landed its first blot.
            </p>
          </InkCallout>
          <InkCallout kind="note" title="Reduced motion is respected">
            <p>
              With reduced motion the ink appears already settled, and without WebGL the cards are
              plain solid ink.
            </p>
          </InkCallout>
        </section>
        <footer className="site-footer">
          <a href="/dev/">Experiments and tuning pages →</a>
        </footer>
      </main>
    </>
  );
}
