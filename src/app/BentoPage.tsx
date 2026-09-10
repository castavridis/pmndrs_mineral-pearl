import { useState } from 'react';
import { Leva, folder, useControls } from 'leva';
import { useEffect } from 'react';
import {
  Announcement,
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
import { Button, ButtonLink, CopyButton, Kbd, Popover } from '../ui';
import {
  BoltIcon,
  DiscordIcon,
  ExternalIcon,
  GitHubIcon,
  InfoIcon,
  TerminalIcon,
  TwitterIcon,
} from '../ui/Icons';

const LINKS: NavLink[] = [
  {
    id: 'docs',
    label: 'Docs',
    href: '/docs',
    description: 'Guides and API reference for the whole collective.',
    section: 'pmndrs / docs',
  },
  {
    id: 'examples',
    label: 'Examples',
    href: '/examples',
    description: 'Live sandboxes you can fork and edit in place.',
    section: 'pmndrs / examples',
  },
  {
    id: 'blog',
    label: 'Blog',
    href: '/blog',
    description: 'Release notes, deep dives and the odd experiment.',
    section: 'pmndrs / blog',
  },
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
      film: { value: d.film, min: 0, max: 2, step: 0.05, label: 'thin film' },
      filmNm: { value: d.filmNm, min: 120, max: 900, step: 5, label: 'film nm' },
      filmBand: { value: d.filmBand, min: 0, max: 120, step: 2, label: 'film band nm' },
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
    // the panel defines only the keys it shows, so merge over the defaults —
    // a missing key would upload NaN and read back as zero
    const next = { ...NACRE_DEFAULT, ...(c as unknown as NacreConfig) };
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
  const [launcherDisabled, setLauncherDisabled] = useState(false);
  const [launcherExit, setLauncherExit] = useState<SurfaceExit>('none');
  const [tab, setTab] = useState(2);
  // the launcher carries both held exits: `pending` while it works, `disable` when it is off
  const launch = () => {
    if (launcherDisabled || launcherExit !== 'none') return;
    setLauncherExit('pending');
    window.setTimeout(() => setLauncherExit('none'), 1500);
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
            <CopyButton
              value="pnpm add @react-three/fiber"
              actions={[
                { key: 'docs', label: 'Open the docs', icon: <InfoIcon />, href: '/dev/' },
                { key: 'sandbox', label: 'Open a sandbox', icon: <ExternalIcon />, href: '/dev/splat' },
                {
                  key: 'repo',
                  label: 'View the repository',
                  icon: <GitHubIcon />,
                  href: 'https://github.com/pmndrs',
                },
                { key: 'run', label: 'Run it', icon: <BoltIcon /> },
                { key: 'cli', label: 'Copy the CLI command', icon: <TerminalIcon /> },
              ]}
            />
            <div className="bento-inline">
              <Surface
                as="button"
                type="button"
                shape="pill"
                expressiveness="calm"
                className="surface-button wide"
                exit={launcherDisabled ? 'disable' : launcherExit}
                onClick={launch}
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

          </div>
        </div>
      </section>

      <section className="bento-tier">
        <h2>Utilitarian</h2>
        <div className="bento-row">
          <div className="bento-inline">
            <Button
              onClick={() => document.querySelector<HTMLElement>('[data-id="cmd"]')?.click()}
            >
              Cmd <Kbd>K</Kbd>
            </Button>
            <ButtonLink icon href="https://twitter.com/pmndrs" aria-label="Twitter">
              <TwitterIcon />
            </ButtonLink>
            <ButtonLink icon href="https://discord.gg/poimandres" aria-label="Discord">
              <DiscordIcon />
            </ButtonLink>
            <ButtonLink icon href="https://github.com/pmndrs" aria-label="GitHub">
              <GitHubIcon />
            </ButtonLink>
            <Popover
              label="Open"
              items={[
                { key: 'github', label: 'Open in GitHub', href: 'https://github.com/pmndrs' },
                { key: 'chatgpt', label: 'Open in ChatGPT', href: 'https://chat.openai.com' },
                { key: 'claude', label: 'Open in Claude', href: 'https://claude.ai' },
                { key: 'cursor', label: 'Open in Cursor', href: 'https://cursor.com' },
              ]}
            />
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
