// Page palette per colour scheme. index.css carries the same values as
// custom properties for the pre-JS render; keep the two in sync.
export type ResolvedTheme = 'light' | 'dark';

// The ground is the study's liquid: mineral on the dark scheme, pearl on the
// light. Its body colours are the page colours, so the theme flood and the ink
// splat in the liquid's own colour.
export const page = {
  dark: { bg: '#0c0a06', ink: '#eeeeea' },
  light: { bg: '#faf5ea', ink: '#12100c' },
} as const satisfies Record<ResolvedTheme, { bg: string; ink: string }>;

/** Relative luminance of a `#rrggbb` colour, 0..1 (sRGB, no linearisation). */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** The page colour that reads on a given ink: dark bg on light ink and vice versa. */
export const onInk = (ink: string) => (luminance(ink) > 0.5 ? page.dark.bg : page.light.bg);
