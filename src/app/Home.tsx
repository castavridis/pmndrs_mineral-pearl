import { useState } from 'react';
import { Announcement, Callout, Nav, type NavLink } from '../components';

const LINKS: NavLink[] = [
  { id: 'docs', label: 'Docs', href: '/docs' },
  { id: 'examples', label: 'Examples', href: '/examples' },
  { id: 'blog', label: 'Blog', href: '/blog' },
];

/**
 * `/`: the site home. The nav, an announcement banner and two callouts, all
 * on the page's liquid: the pill and the callouts wear it as their surface,
 * the banner floats on it as a slab and sinks into it when dismissed. Every
 * layer is DOM first; the liquid arrives after mount where it can run.
 */
export function Home() {
  const [bannerGone, setBannerGone] = useState(false);
  return (
    <>
      <header style={{ padding: '72px 8px 0' }}>
        <Nav links={LINKS} />
      </header>
      <main className="page" style={{ gap: 'clamp(40px, 7vw, 56px)' }}>
        <section aria-label="Announcement" style={{ display: 'grid', justifyItems: 'center' }}>
          {!bannerGone && (
            <Announcement width={652} onDismiss={() => setBannerGone(true)}>
              <span>
                <strong>v10 is out.</strong> Petals, glass and the growing pill, in one package.
              </span>
              <a href="/blog/v10">Read more</a>
            </Announcement>
          )}
        </section>
        <section className="hero">
          <h1>React, three and a well of ink.</h1>
          <p>
            The pmndrs collective builds the tools that make 3D on the web feel like the rest of
            your app: a renderer that speaks React, layout that flexes, springs that settle.
          </p>
        </section>
        <section aria-label="Callouts" className="callouts" style={{ justifyItems: 'center' }}>
          <Callout variant="surface" kind="tip" title="Start with the fiber docs">
            <p>
              Everything here is built from the same primitives you already know: components, hooks
              and props.
            </p>
          </Callout>
          <Callout variant="plain" kind="warning" title="Big models load lazily">
            <p>
              The liquid layers arrive after mount. Flat outlines stand in until the canvas has
              drawn its first frame.
            </p>
          </Callout>
        </section>
        <footer className="site-footer">
          <a href="/dev/">Experiments and tuning pages →</a>
        </footer>
      </main>
    </>
  );
}
