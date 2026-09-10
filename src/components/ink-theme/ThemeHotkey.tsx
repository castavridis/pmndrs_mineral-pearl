'use client';

import { useEffect } from 'react';
import { resolveTheme, useThemeStore } from '../theme';

/** A key press meant for something being typed into, not for the page. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * `T` switches between the dark and light themes, through the ink like any
 * other switch. The splat lands where the pointer last was — the keyboard has
 * no point of its own, and the pointer is where the eye tends to be — or in
 * the middle of the viewport before the pointer has moved. The key is left
 * alone while something is being typed into, with a modifier held (so the
 * browser's own shortcuts stand), on a held key's repeats, and while a change
 * is already under way. Render once per page.
 */
export function ThemeHotkey() {
  useEffect(() => {
    let at: [number, number] = [0.5, 0.5];
    const move = (e: PointerEvent) => {
      at = [e.clientX / window.innerWidth, e.clientY / window.innerHeight];
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.defaultPrevented) return;
      if (typing(e.target)) return;
      const { theme, pending, requestTheme } = useThemeStore.getState();
      if (pending) return;
      const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      requestTheme(resolveTheme(theme, system) === 'dark' ? 'light' : 'dark', at);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', key);
    };
  }, []);
  return null;
}
