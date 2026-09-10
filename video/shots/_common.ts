// Shared framing for the shots. Files starting with _ are not shots.

/**
 * The square reel's camera body: a square page, filmed at 2.25× so the
 * 2160 px footage is exactly twice the 1080 px output — close-ups stay sharp.
 */
export const SQUARE = { viewport: { width: 960, height: 960 }, scale: 2.25 } as const;

/** The shell's fixed theme toggle, for takes where it would be clutter. */
export const HIDE_TOGGLE = 'button[aria-label^="Theme:"] { display: none !important; }';

/**
 * Bento (front page) targets. Where a component's box matters (for the
 * camera), the selector is its outer box, not a label inside it.
 */
export const BENTO = {
  banner: 'div:has(> [aria-label="Dismiss announcement"])',
  dismiss: '[aria-label="Dismiss announcement"]',
  nav: 'nav[aria-label="Main"]',
  copyBar: '.afloat-front',
  copy: 'button:has-text("Copy")',
  callout: '.afloat:has-text("A callout on black mineral nacre")',
  /** The callout's box, as plain CSS (tracks are measured in the page, without Playwright's selectors). */
  calloutBox: '.afloat:has([data-ghost])',
  launcher: '.launcher',
  disable: '.cta-toggle',
} as const;

/**
 * How long a take lets the pointer travel before its action, so the edit can
 * hold wide while the viewer gets their bearings, then push in.
 */
export const APPROACH = 1.1;

/**
 * The callout's nacre with its glare turned down, so the white text over it
 * reads. The green glow is the sheen, and it is steep: `intensity` 0.9 → 0.75
 * all but puts it out, so 0.83 dims it and keeps it; the shine, sparkle and
 * film are trimmed with it. A take-only look; the app's own is NACRE_DEFAULT
 * in src/components/nacre-callout/stage.ts.
 */
export const NACRE_CALM = { intensity: 0.83, iridescence: 0.85, shine: 0.2, glint: 0.65, film: 0.35 };

/**
 * A script that lays `over` on the page's nacre stage for the rest of the
 * take: `await d.page.evaluate(holdNacre(NACRE_CALM))`. It holds across
 * re-renders — whatever the page assigns to the stage's config later (the
 * tweak panel re-applies its values) gets the override laid over it too. A
 * string, not a function: tsx's name helpers do not exist inside the page.
 */
export const holdNacre = (over: Record<string, number | string | boolean>) => `(() => {
  const s = globalThis.__pmndrsNacreStage;
  if (!s) throw new Error('no nacre stage on this page');
  const over = ${JSON.stringify(over)};
  let merged = { ...s.config, ...over };
  Object.defineProperty(s, 'config', {
    configurable: true,
    get: () => merged,
    set: (v) => { merged = { ...v, ...over }; },
  });
})()`;
