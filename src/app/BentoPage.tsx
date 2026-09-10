import { useRef, useState } from 'react';
import { Leva, folder, useControls } from 'leva';
import { useEffect } from 'react';
import {
  Announcement,
  Logo,
  NACRE_DEFAULT,
  Nav,
  NacreCallout,
  InkSink,
  Surface,
  getNacreStage,
  palette,
  useResolvedTheme,
  useWake,
  type InkSinkHandle,
  type NacreConfig,
  type NavLink,
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
  // The launcher stands against the page the way the nav bar does: the dark
  // page carries the mineral ground, so the launcher floats on pearl, and the
  // light page the other way about. Naming the liquid also keeps this well out
  // of the theme's masked switch, which is what makes it the page's opposite
  // rather than a patch of it.
  const scheme = useResolvedTheme();
  const launcherGround = scheme === 'dark' ? 'pearl' : 'mineral';
  useNacreTweaks();
  const [gone, setGone] = useState(false);
  const [launcherDisabled, setLauncherDisabled] = useState(false);
  const [tab, setTab] = useState(2);
  // The launcher floats on the page like the announcement, and the nacre stage
  // draws its face, so it is iridescent rather than flat. Disabled it settles
  // just under the surface — still seen through the liquid, which is what
  // unavailable should look like. A press dips it and it bobs back.
  // Nothing in this tier idles. Each floats on the ground and is moved only
  // by the wake the pointer drags across it.
  const copyWake = useRef<HTMLDivElement>(null);
  const launcherWake = useRef<HTMLDivElement>(null);
  const calloutWake = useRef<HTMLDivElement>(null);
  useWake(copyWake, 0.8);
  useWake(launcherWake, 0.8);
  useWake(calloutWake, 0.6);
  const copySink = useRef<InkSinkHandle>(null);
  const launcherSink = useRef<InkSinkHandle>(null);
  const launcherFace = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = launcherFace.current;
    if (!el) return;
    const stage = getNacreStage();
    if (!stage) return;
    // no icon on a control, so the accent would pool in a corner and wash the
    // label; the nacre's own dark keeps the slab iridescent but legible
    return stage.register({ el, icon: null, accent: palette.dark, radius: 8 });
  }, []);
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
            <div ref={copyWake} className="afloat afloat-front">
              <InkSink
                ref={copySink}
                well
                bare
                radius={8}
                bleed={44}
                sinkOnClick={false}
                viscosity={0.22}
                pressDepth={-0.05}
                sinkSplash={false}
                className="launcher-sink"
                style={{ width: 'calc(100% + 88px)', margin: -44 }}
              >
                {/* pointerdown bubbles from whichever action was pressed */}
                <div onPointerDown={(e) => copySink.current?.press(e.nativeEvent)}>
                  <CopyButton
                    value="pnpm add @react-three/fiber"
                    actions={[
                      { key: 'docs', label: 'Open the docs', icon: <InfoIcon />, href: '/dev/' },
                      {
                        key: 'sandbox',
                        label: 'Open a sandbox',
                        icon: <ExternalIcon />,
                        href: '/dev/splat',
                      },
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
                </div>
              </InkSink>
            </div>
            <div className="bento-inline">
              <div ref={launcherWake} className="afloat afloat-inline">
                <InkSink
                  ref={launcherSink}
                  well
                  bare
                  liquid={launcherGround}
                  radius={8}
                  bleed={44}
                  sinkOnClick={false}
                  viscosity={0.22}
                  sunk={launcherDisabled}
                  sinkDepth={-0.1}
                  pressDepth={-0.05}
                  sinkSplash={false}
                  className="launcher-sink"
                  style={{ width: 'calc(100% + 88px)', margin: -44 }}
                >
                  <button
                    ref={launcherFace}
                    type="button"
                    className="surface-button launcher"
                    aria-disabled={launcherDisabled || undefined}
                    onPointerDown={(e) => {
                      if (!launcherDisabled) launcherSink.current?.press(e.nativeEvent);
                    }}
                  >
                    Article Launcher
                  </button>
                </InkSink>
              </div>
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
            <div ref={calloutWake} className="afloat">
              <NacreCallout kind="tip">
                <p>
                  A callout on black mineral nacre: the droplet follows the pointer under the surface,
                  and the text is refracted through it.
                </p>
              </NacreCallout>
            </div>
          </div>
        </div>
      </section>

      <section className="bento-tier">
        <h2>Utilitarian</h2>
        <div className="bento-row">
          <div className="bento-inline">
            <Button onClick={() => document.querySelector<HTMLElement>('[data-id="cmd"]')?.click()}>
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
