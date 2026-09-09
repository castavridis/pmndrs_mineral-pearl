const pages = [
  {
    href: '/',
    title: 'Home',
    text: 'The nav-page layout in ink: hero, callouts, and the theme toggle that floods the page.',
  },
  {
    href: '/dev/splat',
    title: 'Splat',
    text: 'The full-viewport ink splat with the tuning panel: colour, mark, origin, scale.',
  },
  {
    href: '/dev/callout',
    title: 'Callouts',
    text: 'Every callout kind as ink; kind, trigger, radius, bleed, scale, replay and drain in the panel.',
  },
  {
    href: '/dev/bento',
    title: 'Shader bento',
    text: 'The components by expressiveness: liquid nav and announcement, liquid buttons and nacre callout, plain controls.',
  },
  {
    href: '/dev/engulf',
    title: 'Engulf',
    text: 'Ink closing in from the edges of a block, and the pond it sinks into; every knob in the panel.',
  },
];

/** `/dev`: links to every experiment. */
export function DevIndex() {
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Experiments</h1>
      <p style={{ margin: '0 0 32px', opacity: 0.6 }}>
        Each page has the theme toggle and a leva panel with every prop of the components on it.
      </p>
      <ul className="dev-list">
        {pages.map((p) => (
          <li key={p.href}>
            <a href={p.href}>
              <span style={{ fontWeight: 500 }}>{p.title}</span>
              <span style={{ fontSize: 13, opacity: 0.6 }}>{p.text}</span>
              <code style={{ fontSize: 12, opacity: 0.45 }}>{p.href}</code>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
