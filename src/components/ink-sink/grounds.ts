import { useSyncExternalStore } from 'react';
import type { LiquidPond, Liquid } from './liquid-pond';

// Every mounted LiquidGround whose liquid follows the scheme, so the theme
// transition can roll them all from mineral to pearl under the ink mask.
// Kept on globalThis: in development Vite can serve one module under two
// URLs (hot-reload timestamps), and two registries would never meet.
// Reactive: components read the count through `useGroundCount`, so a value
// derived from it is recomputed when grounds mount (the React Compiler would
// otherwise cache a plain call made before any ground existed).
interface Registry {
  grounds: Set<LiquidPond>;
  listeners: Set<() => void>;
}
const KEY = '__pmndrsLiquidGrounds';
const g = globalThis as unknown as Record<string, Registry | undefined>;
if (!(g[KEY]?.grounds instanceof Set)) g[KEY] = { grounds: new Set(), listeners: new Set() };
const reg = g[KEY] as Registry;

const notify = () => {
  for (const l of reg.listeners) l();
};

export const registerGround = (pond: LiquidPond) => {
  reg.grounds.add(pond);
  notify();
  return () => {
    reg.grounds.delete(pond);
    notify();
  };
};

export const getGrounds = () => [...reg.grounds];

/** The viewport-filling ground, whose canvas the theme splat draws with. */
export const getFixedGround = () =>
  [...reg.grounds].find((p) => p.host.style.position === 'fixed') ?? null;

const subscribe = (l: () => void) => {
  reg.listeners.add(l);
  return () => {
    reg.listeners.delete(l);
  };
};
const readCount = () => reg.grounds.size;
const readCountServer = () => 0;

/** How many scheme-following grounds are mounted, live. */
export const useGroundCount = () => useSyncExternalStore(subscribe, readCount, readCountServer);

export const schemeLiquid = (dark: boolean): Liquid => (dark ? 'mineral' : 'pearl');
