import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResolvedTheme } from './tokens';
import { useLook } from './look';

export type ThemeChoice = ResolvedTheme | 'system';

/** A theme change in flight: the ink floods from `origin` (viewport fractions) before it commits. */
export interface PendingTheme {
  theme: ThemeChoice;
  origin: [number, number];
  /** `splat` while the ink is landing; `fade` once the theme has committed under it. */
  phase: 'splat' | 'fade';
}

interface ThemeState {
  /** The committed choice; `system` follows prefers-color-scheme. Persisted per browser. */
  theme: ThemeChoice;
  pending: PendingTheme | null;
  /** Ask for a theme. With an origin the change waits for the ink; without, it commits at once. */
  requestTheme: (theme: ThemeChoice, origin?: [number, number]) => void;
  /** Commit the pending theme (the ink has covered the page). */
  commit: () => void;
  /** The overlay has faded; the transition is over. */
  finish: () => void;
  /** The liquid shaders. Off, the ground is a flat colour and the theme floods in a flat colour. */
  shaders: boolean;
  setShaders: (on: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Dark, and the system's preference is not consulted for now: the page is
      // designed on the black mineral first, and a first visit should see it.
      theme: 'dark',
      pending: null,
      requestTheme: (theme, origin) => {
        if (get().pending) return;
        if (!origin) set({ theme });
        else set({ pending: { theme, origin, phase: 'splat' } });
      },
      commit: () => {
        const { pending } = get();
        if (pending) set({ theme: pending.theme, pending: { ...pending, phase: 'fade' } });
      },
      finish: () => set({ pending: null }),
      shaders: true,
      setShaders: (shaders) => set({ shaders }),
    }),
    {
      name: 'pmndrs-theme',
      partialize: (s) => ({ theme: s.theme, shaders: s.shaders }),
      // v0 defaulted to following the system. A visitor still on that choice
      // is moved to dark rather than kept on the OS's preference; one who
      // picked light or dark keeps it.
      version: 1,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<Pick<ThemeState, 'theme' | 'shaders'>>;
        return {
          theme: p.theme === 'system' || !p.theme ? 'dark' : p.theme,
          shaders: p.shaders ?? true,
        } as ThemeState;
      },
    }
  )
);

const query = () =>
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null;
const subscribeSystem = (onChange: () => void) => {
  const mq = query();
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
};
const readSystem = (): ResolvedTheme => (query()?.matches ? 'light' : 'dark');
const readSystemServer = (): ResolvedTheme => 'dark';

/** The OS preference, live. */
export function useSystemTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeSystem, readSystem, readSystemServer);
}

export const resolveTheme = (choice: ThemeChoice, system: ResolvedTheme): ResolvedTheme =>
  choice === 'system' ? system : choice;

/** The scheme in effect: the committed choice, or the OS preference. */
export function useResolvedTheme(): ResolvedTheme {
  const choice = useThemeStore((s) => s.theme);
  return resolveTheme(choice, useSystemTheme());
}

/**
 * Stamps `data-theme` (and a `dark` class) on <html> so CSS and the ink follow
 * the resolved scheme. Render once per page.
 */
export function ThemeApplier() {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // the page look in force is the scheme's
    useLook.getState().setScheme(resolved);
  }, [resolved]);
  return null;
}
