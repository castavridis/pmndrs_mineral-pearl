const pages = [
  {
    href: '/dev/demo',
    title: 'Demo',
    text: 'The nav in a page, with link count, container width and current page controls.',
  },
  {
    href: '/dev/nav',
    title: 'Nav gallery',
    text: '1, 3, 6 and 10 links across full, compact and collapsed; flat rows and a liquid row.',
  },
  {
    href: '/dev/callout',
    title: 'Callout',
    text: 'GitHub-style callouts: liquid surface or plain card with the lens, every kind, and the ink blots with their panel.',
  },
  {
    href: '/dev/bento',
    title: 'Bento',
    text: 'The components by expressiveness: liquid nav and announcement, liquid controls and nacre callout, plain docs chrome.',
  },
  {
    href: '/dev/palette',
    title: 'Palette',
    text: 'Every liquid as a live sample, and the saved presets, each applicable to the whole page.',
  },
  {
    href: '/dev/announcement',
    title: 'Announcement',
    text: 'A wide banner afloat on the page, sinking into it when dismissed.',
  },
  {
    href: '/dev/splat',
    title: 'Splat',
    text: 'The full-viewport ink splat with the tuning panel: colour, mark, origin, scale.',
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
        Each page has the theme toggle and a leva panel; ⌘K opens the palette where a nav is
        present.
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
