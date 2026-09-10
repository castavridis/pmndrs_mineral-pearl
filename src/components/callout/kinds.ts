import type { ResolvedTheme } from '../theme/tokens';
import { mixHex, palette, type PaletteName } from '../theme/palette';

/** GitHub-style callout kinds, mapped onto the official pmndrs palette. */
export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export interface CalloutKindSpec {
  label: string;
  glyph: string;
  /** The kind's place in the palette. */
  colour: PaletteName;
  /** The palette colour itself: the ink of a blot, the tint of a lens. */
  hex: string;
  /**
   * The colour as text. The palette is pitched for light on dark, so on the
   * dark page it is used as it is and on the light page it is carried toward
   * the page's ink until it reads against cream.
   */
  ink: Record<ResolvedTheme, string>;
}

const KINDS: Record<CalloutKind, { label: string; glyph: string; colour: PaletteName }> = {
  note: { label: 'Note', glyph: 'i', colour: 'blue' },
  tip: { label: 'Tip', glyph: '✦', colour: 'green' },
  important: { label: 'Important', glyph: '!', colour: 'purple' },
  warning: { label: 'Warning', glyph: '△', colour: 'orange' },
  caution: { label: 'Caution', glyph: '⊘', colour: 'red' },
};

const PAGE_INK_LIGHT = '#12100c';

export const calloutKinds = Object.fromEntries(
  Object.entries(KINDS).map(([k, v]) => {
    const hex = palette[v.colour];
    return [
      k,
      {
        ...v,
        hex,
        ink: { dark: hex, light: mixHex(hex, PAGE_INK_LIGHT, 0.55) },
      } satisfies CalloutKindSpec,
    ];
  })
) as Record<CalloutKind, CalloutKindSpec>;

export const CALLOUT_KINDS = Object.keys(calloutKinds) as CalloutKind[];
