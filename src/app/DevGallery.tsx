import { Leva } from 'leva';
import { Nav, type EnhancementLevel, type NavLink, type NavMode } from '../components';
import { useThemeTweak } from './tweaks';

const ALL: NavLink[] = [
  { id: 'docs', label: 'Docs', href: '/docs' },
  { id: 'examples', label: 'Examples', href: '/examples' },
  { id: 'blog', label: 'Blog', href: '/blog' },
  { id: 'ecosystem', label: 'Ecosystem', href: '/ecosystem' },
  { id: 'showcase', label: 'Showcase', href: '/showcase' },
  { id: 'community', label: 'Community', href: '/community' },
  { id: 'sponsors', label: 'Sponsors', href: '/sponsors' },
  { id: 'jobs', label: 'Jobs', href: '/jobs' },
  { id: 'about', label: 'About', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];

const MODES: NavMode[] = ['full', 'compact', 'collapsed'];

/**
 * Required container width (px, incl. bleed) per mode for each link count,
 * measured on the pill with the page font. The mode is a consequence of the
 * width, so a cell just needs to sit inside the right band.
 */
const REQUIRED: Record<number, { full: number; compact: number }> = {
  1: { full: 397, compact: 292 },
  3: { full: 581, compact: 431 },
  6: { full: 955, compact: 723 },
  10: { full: 1323, compact: 1003 },
};
const widthFor = (mode: NavMode, n: number) => {
  const r = REQUIRED[n] ?? { full: 252 + 98 * n, compact: 237 + 75 * n };
  return mode === 'full'
    ? r.full + 40
    : mode === 'compact'
      ? Math.round((r.compact + r.full) / 2)
      : r.compact - 30;
};

/**
 * `/dev/nav`: every link count × every mode side by side. The mode is a
 * consequence of the container width, so each cell is a fixed-width box.
 * Cells are flat by default (a WebGL context each would exhaust the
 * browser); the last row shows the liquid pill in all three modes.
 */
export function DevGallery() {
  useThemeTweak();
  const counts = [1, 3, 6, 10];
  return (
    <main style={{ padding: 32, display: 'grid', gap: 40 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, opacity: 0.7 }}>nav gallery</h1>
      {counts.map((n) => (
        <Row
          key={n}
          title={`${n} link${n > 1 ? 's' : ''} · flat`}
          links={ALL.slice(0, n)}
          enhancement="flat"
        />
      ))}
      <Row title="3 links · liquid" links={ALL.slice(0, 3)} enhancement="full" />
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}

function Row({
  title,
  links,
  enhancement,
}: {
  title: string;
  links: NavLink[];
  enhancement: EnhancementLevel;
}) {
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{title}</h2>
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          overflowX: 'auto',
          paddingBottom: 8,
        }}
      >
        {MODES.map((m) => (
          <div
            key={m}
            style={{
              flex: 'none',
              width: widthFor(m, links.length),
              outline: '1px dashed color-mix(in srgb, currentColor 35%, transparent)',
              outlineOffset: 6,
            }}
          >
            <Nav links={links} enhancement={enhancement} />
          </div>
        ))}
      </div>
    </section>
  );
}
