import { useState } from 'react';
import { Leva, folder, useControls } from 'leva';
import { useEffect } from 'react';
import {
  Announcement,
  InkCallout,
  Logo,
  NACRE_DEFAULT,
  Nav,
  NacreCallout,
  Surface,
  getNacreStage,
  type NacreConfig,
  type NavLink,
  type SurfaceExit,
} from '../components';

const LINKS: NavLink[] = [
  { id: 'docs', label: 'Docs', href: '/docs' },
  { id: 'examples', label: 'Examples', href: '/examples' },
  { id: 'blog', label: 'Blog', href: '/blog' },
];
import { useThemeTweak } from './tweaks';

/** Every parameter of the nacre stage, applied live to the page's stage. */
function useNacreTweaks() {
  const d = NACRE_DEFAULT;
  const c = useControls('nacre', {
    slab: folder({
      wholeCard: { value: d.wholeCard, label: 'whole card' },
      thickness: { value: d.thickness, min: 0.02, max: 0.6, step: 0.01 },
      cornerN: { value: d.cornerN, min: 2, max: 8, step: 0.1, label: 'corner n' },
      edgeRoll: { value: d.edgeRoll, min: 0.02, max: 1, step: 0.02, label: 'edge roll' },
    }),
    droplet: folder({
      droplet: { value: d.droplet, label: 'pointer droplet' },
      size: { value: d.size, min: 4, max: 60, step: 1 },
      blend: { value: d.blend, min: 1, max: 30, step: 0.5 },
      blobs: { value: d.blobs, label: 'ambient blobs' },
      ambient: { value: d.ambient, min: 0, max: 4, step: 0.05, label: 'blob speed' },
      goo: { value: d.goo, min: 0.5, max: 12, step: 0.1 },
    }),
    optics: folder({
      refraction: { value: d.refraction, min: 0, max: 120, step: 1 },
      ior: { value: d.ior, min: 1, max: 4, step: 0.05 },
      dispersion: { value: d.dispersion, min: 0, max: 3, step: 0.05 },
      rim: { value: d.rim, min: 0, max: 1.5, step: 0.05 },
      shine: { value: d.shine, min: 0, max: 2, step: 0.05 },
      lightAngle: { value: d.lightAngle, min: 0, max: 360, step: 1, label: 'light angle' },
      lightColor: { value: d.lightColor, label: 'light colour' },
    }),
    nacre: folder({
      swirl: { value: d.swirl, min: 0.2, max: 12, step: 0.1 },
      lamina: { value: d.lamina, min: 8, max: 400, step: 2, label: 'striations' },
      striation: { value: d.striation, min: 0, max: 1.5, step: 0.05, label: 'striation depth' },
      iridescence: { value: d.iridescence, min: 0, max: 3, step: 0.05, label: 'sheen glints' },
      intensity: { value: d.intensity, min: 0, max: 2, step: 0.05, label: 'glint intensity' },
      sheenSpeed: { value: d.sheenSpeed, min: 0, max: 1, step: 0.01, label: 'sheen speed' },
      glint: { value: d.glint, min: 0, max: 4, step: 0.1, label: 'facet glitter' },
    }),
    ghost: folder({
      textGhost: { value: d.textGhost, label: 'text ghost' },
      ghostOpacity: { value: d.ghostOpacity, min: 0, max: 0.5, step: 0.01, label: 'opacity' },
      ghostScale: { value: d.ghostScale, min: 0.5, max: 1.2, step: 0.01, label: 'scale' },
      ghostBlur: { value: d.ghostBlur, min: 0, max: 8, step: 0.5, label: 'blur' },
    }),
    quality: { value: d.quality, options: ['high', 'balanced', 'battery'] },
  });
  useEffect(() => {
    const stage = getNacreStage();
    if (!stage) return;
    const next = { ...(c as unknown as NacreConfig) };
    const qualityChanged = next.quality !== stage.config.quality;
    stage.config = next;
    if (qualityChanged) stage.refresh();
  }, [c]);
}

/**
 * `/dev/bento`: the shader bento, every element one `Surface` in a shape and
 * a tier of motion. Most expressive: the pill nav and the announcement, full.
 * Somewhat expressive: buttons, calm, beside the nacre and ink callouts.
 * Utilitarian: key caps and a tabbed card, flat.
 */
export function BentoPage() {
  useThemeTweak();
  useNacreTweaks();
  const [gone, setGone] = useState(false);
  const [copyExit, setCopyExit] = useState<SurfaceExit>('none');
  const [copied, setCopied] = useState(false);
  const [launcherDisabled, setLauncherDisabled] = useState(false);
  const [tab, setTab] = useState(2);
  const copy = () => {
    if (copyExit !== 'none') return;
    setCopyExit('pending');
    window.setTimeout(() => {
      setCopied(true);
      setCopyExit('none');
    }, 1500);
  };
  return (
    <main className="bento">
      <section className="bento-tier">
        <h2>Most Expressive</h2>
        <div className="bento-row">
          <div className="bento-grow" style={{ flexBasis: 620 }}>
            <Nav links={LINKS} active="docs" enhancement="full" />
          </div>
          <div className="bento-grow" style={{ padding: '52px 0' }}>
            {!gone && (
              <Announcement width={720} onDismiss={() => setGone(true)}>
                <span>
                  <strong>v10 is out.</strong> Petals, glass and the growing pill, in one package.
                </span>
                <a href="/blog/v10">Read more</a>
              </Announcement>
            )}
          </div>
        </div>
      </section>

      <section className="bento-tier">
        <h2>Somewhat Expressive</h2>
        <div className="bento-row">
          <div className="bento-stack">
            <div className="bento-inline">
              <Surface
                as="button"
                type="button"
                shape="pill"
                expressiveness="calm"
                className="surface-button"
                exit={copyExit}
                onClick={copy}
              >
                {copyExit === 'pending' ? 'Copying…' : copied ? 'Copied!' : 'Copy'}
              </Surface>
              <button type="button" className="text-button" onClick={() => setCopied(false)}>
                reset
              </button>
            </div>
            <div className="bento-inline">
              <Surface
                as="button"
                type="button"
                shape="pill"
                expressiveness="calm"
                className="surface-button wide"
                exit={launcherDisabled ? 'disable' : 'none'}
              >
                Article Launcher
              </Surface>
              <button
                type="button"
                className="text-button"
                onClick={() => setLauncherDisabled((d) => !d)}
              >
                {launcherDisabled ? 'enable' : 'disable'}
              </button>
            </div>
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
            {['Cmd K', 'TW', 'DI', 'GH'].map((k) => (
              <Surface
                key={k}
                as="button"
                type="button"
                shape="key"
                expressiveness="flat"
                className="surface-key"
              >
                {k}
              </Surface>
            ))}
          </div>
          <Surface shape="card" expressiveness="flat" className="tabs-card">
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
                  {i === 0 ? <Logo width={18} height={18} /> : t}
                </button>
              ))}
            </div>
            <ul>
              <li>Does it have limitations?</li>
              <li>Point 2</li>
              <li>Point 3</li>
            </ul>
          </Surface>
        </div>
      </section>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
