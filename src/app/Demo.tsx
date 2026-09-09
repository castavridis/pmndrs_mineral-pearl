import { useMemo, useState } from 'react';
import { Leva } from 'leva';
import { Nav, type NavLink } from '../components';
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

/** `/dev/demo`: the nav with link count, container width and current page controls. */
export function Demo() {
  useThemeTweak();
  const [count, setCount] = useState(3);
  const [width, setWidth] = useState(100);
  const links = useMemo(() => ALL.slice(0, count), [count]);
  const [current, setCurrent] = useState<string>(
    () =>
      (typeof window !== 'undefined' && ALL.find((l) => l.href === window.location.pathname)?.id) ||
      'docs'
  );

  return (
    <main style={{ padding: '48px 16px', display: 'grid', gap: 48 }}>
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        pmndrs nav demo
      </h1>
      <header
        style={{
          width: `${width}%`,
          margin: '0 auto',
          minWidth: 0,
          outline: '1px dashed color-mix(in srgb, currentColor 35%, transparent)',
          outlineOffset: 8,
        }}
      >
        <Nav links={links} active={current} />
      </header>

      <section
        aria-label="Dev controls"
        style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          flexWrap: 'wrap',
          fontSize: 14,
        }}
      >
        <label>
          Links: <output>{count}</output>{' '}
          <input
            type="range"
            min={1}
            max={ALL.length}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label>
          Current page:{' '}
          <select value={current} onChange={(e) => setCurrent(e.target.value)}>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Container: <output>{width}%</output>{' '}
          <input
            type="range"
            min={20}
            max={100}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
      </section>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </main>
  );
}
