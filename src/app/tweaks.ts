import { useEffect } from 'react';
import { useControls } from 'leva';
import { useThemeStore, type ThemeChoice } from '../components';

// Shared bits for the dev pages' leva panels.

/** A theme select at the top of the panel; changes commit at once (no ink). */
export function useThemeTweak() {
  const theme = useThemeStore((s) => s.theme);
  const shaders = useThemeStore((s) => s.shaders);
  const requestTheme = useThemeStore((s) => s.requestTheme);
  const setShaders = useThemeStore((s) => s.setShaders);
  const { theme: choice, shaders: shadersOn } = useControls({
    theme: { value: theme, options: ['system', 'light', 'dark'] as ThemeChoice[] },
    shaders: { value: shaders, label: 'liquid shaders' },
  });
  useEffect(() => {
    if (choice !== useThemeStore.getState().theme) requestTheme(choice);
  }, [choice, requestTheme]);
  useEffect(() => {
    if (shadersOn !== useThemeStore.getState().shaders) setShaders(shadersOn);
  }, [shadersOn, setShaders]);
}

/**
 * Handles reachable from leva buttons. Buttons are plain closures, so they
 * read this module-level registry rather than a React ref during render.
 */
type Handle = Record<string, unknown>;
export const handles: Record<string, Handle | null> = {};
export const register =
  <T extends object>(name: string) =>
  (h: T | null) => {
    handles[name] = h as Handle | null;
  };
export const call = (name: string, method: string) => () => {
  const fn = handles[name]?.[method];
  if (typeof fn === 'function') (fn as () => void)();
};
