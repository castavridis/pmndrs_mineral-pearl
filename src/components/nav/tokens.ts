/**
 * Single source of truth for every magic number in the nav, the glass nav's
 * numbers so the two lay out alike. Shared with the CSS as `--nav-*` custom
 * properties via `tokensToCssVars`. All lengths are CSS px.
 */
export const tokens = {
  /** Height of the pill body. */
  pillHeight: 52,
  /** Corner radius of the pill caps (= height/2: a true stadium). */
  pillRadius: 26,
  /** Padding from the left cap edge to the logo. */
  pillPadStart: { full: 44, compact: 24, collapsed: 14 },
  /** Padding from the Cmd item to the right cap edge. */
  pillPadEnd: { full: 28, compact: 18, collapsed: 14 },
  /** Gap between items. */
  gap: { full: 32, compact: 20, collapsed: 12 },
  /** Item font size. */
  fontSize: { full: 18, compact: 15, collapsed: 15 },
  /** Logo glyph size (square). */
  logoSize: 28,
  /**
   * Room kept clear around the pill. The glass nav's clusters bled this far
   * outside its pill; keeping the same box means the nav takes the same
   * place on a page, and the liquid's ripples have somewhere to run out.
   */
  bleedX: 56,
  bleedY: 52,
  /** Hysteresis in px applied when switching modes, to avoid flapping. */
  modeHysteresis: 24,
  /** Cross-fade duration between flat and liquid, in ms. */
  swapDurationMs: 600,
} as const;

export type Tokens = typeof tokens;

/** Flatten tokens into `--nav-*` custom properties for the CSS. */
export function tokensToCssVars(t: Tokens = tokens): Record<`--nav-${string}`, string> {
  const vars: Record<string, string> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const name = prefix ? `${prefix}-${kebab(k)}` : kebab(k);
      if (typeof v === 'number') vars[`--nav-${name}`] = name.endsWith('-ms') ? `${v}ms` : `${v}px`;
      else if (v && typeof v === 'object') walk(v as Record<string, unknown>, name);
    }
  };
  walk(t as unknown as Record<string, unknown>, '');
  return vars as Record<`--nav-${string}`, string>;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
