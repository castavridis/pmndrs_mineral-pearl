'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { useResolvedTheme, useThemeStore, type ThemeChoice } from '../theme';

const ALL: ThemeChoice[] = ['dark', 'light', 'system'];
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const GLYPH: Record<ThemeChoice, string> = { system: '◐', light: '☀', dark: '☾' };

/**
 * Cycles through `modes`, dark → light → system by default. Give it two and it
 * is a switch rather than a cycle: `['dark', 'light']` leaves the system's own
 * choice out of it, for a page that is about the two grounds themselves.
 *
 * Each change is requested with the button's position, so `InkThemeTransition`
 * floods the page from the toggle.
 */
export function InkThemeToggle({
  style,
  modes = ALL,
}: {
  style?: CSSProperties;
  modes?: ThemeChoice[];
}) {
  const theme = useThemeStore((s) => s.theme);
  const busy = useThemeStore((s) => s.pending !== null);
  const requestTheme = useThemeStore((s) => s.requestTheme);
  const resolved = useResolvedTheme();

  // where this click leaves the theme: the next mode in the ring, and the
  // first of them if the theme is currently one this toggle does not offer
  const at = modes.indexOf(theme);
  const next = modes[at < 0 ? 0 : (at + 1) % modes.length]!;

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const origin: [number, number] = [
      (r.left + r.width / 2) / window.innerWidth,
      (r.top + r.height / 2) / window.innerHeight,
    ];
    requestTheme(next, origin);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={busy || undefined}
      aria-label={`Theme: ${LABEL[theme]} (${resolved}). Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[theme]}`}
      style={{
        font: 'inherit',
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
        background: 'color-mix(in srgb, var(--page-bg) 70%, transparent)',
        color: 'inherit',
        cursor: busy ? 'progress' : 'pointer',
        ...style,
      }}
    >
      <span aria-hidden="true">{GLYPH[theme]}</span>
      {LABEL[theme]}
    </button>
  );
}
