import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import type { NavLink, NavMode } from './types';
import { tokens } from './tokens';

export interface NavState {
  links: NavLink[];
  mode: NavMode;
  hovered: string | null;
  /** The pill's settled width in px (Nav2D measures it). */
  pillWidth: number | null;
  /** Keyboard focus among the items (mirrors the DOM anchors' focus). */
  focused: string | null;
  active: string | null;
  /** True once the pill is liquid (a canvas), not the flat fallback. */
  isLiquid: boolean;
  /** Collapsed-mode disclosure. */
  menuOpen: boolean;
  /** Cmd palette dialog. */
  paletteOpen: boolean;
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;

  setLinks: (links: NavLink[]) => void;
  setMode: (mode: NavMode) => void;
  setHovered: (id: string | null) => void;
  setPillWidth: (w: number | null) => void;
  setFocused: (id: string | null) => void;
  setActive: (id: string | null) => void;
  setIsLiquid: (isLiquid: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export type NavStoreApi = StoreApi<NavState>;

/** One store per <Nav>, so several navs can live on one page (e.g. the dev gallery). */
export function createNavStore(initial?: Partial<Pick<NavState, 'links'>>): NavStoreApi {
  return createStore<NavState>()((set) => ({
    links: initial?.links ?? [],
    mode: 'full',
    hovered: null,
    pillWidth: null,
    focused: null,
    active: null,
    isLiquid: false,
    menuOpen: false,
    paletteOpen: false,
    reducedMotion: false,

    setLinks: (links) => set({ links }),
    setMode: (mode) => set((s) => (s.mode === mode ? s : { mode, menuOpen: false })),
    setHovered: (hovered) => set({ hovered }),
    setPillWidth: (pillWidth) => set((s) => (s.pillWidth === pillWidth ? s : { pillWidth })),
    setFocused: (focused) => set({ focused }),
    setActive: (active) => set({ active }),
    setIsLiquid: (isLiquid) => set({ isLiquid }),
    setMenuOpen: (menuOpen) => set({ menuOpen }),
    setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  }));
}

export const NavStoreContext = createContext<NavStoreApi | null>(null);

/** Shared store for components used outside a <Nav> (callouts, announcements, experiments). */
let sharedStore: NavStoreApi | undefined;
const getSharedStore = () => (sharedStore ??= createNavStore());

/** The store instance of the enclosing <Nav>, or a shared default when there is none. */
export function useNavStoreApi(): NavStoreApi {
  return useContext(NavStoreContext) ?? getSharedStore();
}

/** Selector hook, same shape as a zustand bound store. */
export function useNavStore<T>(selector: (s: NavState) => T): T {
  return useStore(useNavStoreApi(), selector);
}

/** Keep `reducedMotion` in sync with the OS setting. Call once per store on the client. */
export function watchReducedMotion(api: NavStoreApi): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => api.getState().setReducedMotion(mq.matches);
  apply();
  mq.addEventListener('change', apply);
  return () => mq.removeEventListener('change', apply);
}

/**
 * Pure mode resolver with hysteresis. `required` is the measured content width
 * for each mode (undefined when not yet measured).
 *
 * Downgrades happen as soon as the container is too small for the current mode.
 * Upgrades only happen when the container exceeds the *larger* mode's requirement
 * by `hysteresis`, so a resize hovering around a threshold never flaps.
 */
export function resolveMode(
  current: NavMode,
  container: number,
  required: Partial<Record<NavMode, number>>,
  hysteresis: number = tokens.modeHysteresis
): NavMode {
  const fits = (m: NavMode, slack = 0) => {
    const w = required[m];
    return w === undefined ? false : container >= w + slack;
  };
  if (current === 'full') {
    if (fits('full')) return 'full';
    return fits('compact') || required.compact === undefined ? 'compact' : 'collapsed';
  }
  if (current === 'compact') {
    if (fits('full', hysteresis)) return 'full';
    if (fits('compact')) return 'compact';
    return 'collapsed';
  }
  // collapsed
  if (fits('full', hysteresis)) return 'full';
  if (fits('compact', hysteresis)) return 'compact';
  return 'collapsed';
}
