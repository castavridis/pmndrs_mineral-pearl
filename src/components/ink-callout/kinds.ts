import type { ResolvedTheme } from '../theme';

/** GitHub-style callout kinds. Each has a label, a glyph and an ink per scheme. */
export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export interface CalloutKindSpec {
  label: string;
  glyph: string;
  ink: Record<ResolvedTheme, string>;
}

// Dark inks on the light page, light inks on the dark page: the callout
// inverts against its surroundings the way the traced outlines do.
export const calloutKinds: Record<CalloutKind, CalloutKindSpec> = {
  note: { label: 'Note', glyph: 'i', ink: { light: '#1a1a15', dark: '#eeeeea' } },
  tip: { label: 'Tip', glyph: '✦', ink: { light: '#1d5c3f', dark: '#9fe0bd' } },
  important: { label: 'Important', glyph: '!', ink: { light: '#4b3a9a', dark: '#c3b3f7' } },
  warning: { label: 'Warning', glyph: '△', ink: { light: '#7a4b00', dark: '#f3c46b' } },
  caution: { label: 'Caution', glyph: '⊘', ink: { light: '#8f2a2f', dark: '#f3a1a4' } },
};

export const CALLOUT_KINDS = Object.keys(calloutKinds) as CalloutKind[];
