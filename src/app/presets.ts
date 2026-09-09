import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import shipped from './pond-presets.json';

// Saved sink-panel presets, kept in localStorage. Leva has no persistence of
// its own; the panel's buttons write here and read the latest panel values
// through `latest`, which the page updates from an effect.
//
// localStorage is per origin: a dev server on another port has its own. The
// presets in pond-presets.json ship with the app and are always in the list;
// a saved one under the same name wins, and deleting a shipped one only
// lasts until the next load.

export type PresetValues = Record<string, unknown>;

/** The presets that ship with the app (pond-presets.json). */
export const SHIPPED_PRESETS: Record<string, PresetValues> = shipped;

interface PresetState {
  presets: Record<string, PresetValues>;
  save: (name: string, values: PresetValues) => void;
  remove: (name: string) => void;
}

export const usePresets = create<PresetState>()(
  persist(
    (set) => ({
      presets: { ...SHIPPED_PRESETS },
      save: (name, values) => set((s) => ({ presets: { ...s.presets, [name]: values } })),
      remove: (name) =>
        set((s) => {
          const next = { ...s.presets };
          delete next[name];
          return { presets: next };
        }),
    }),
    {
      name: 'pmndrs-pond-presets',
      merge: (persisted, current) => {
        const p = (persisted as Partial<PresetState> | undefined)?.presets ?? {};
        return { ...current, presets: { ...SHIPPED_PRESETS, ...p } };
      },
    }
  )
);

/** The panel's current values and its setter, reachable from leva's buttons. */
export const latest: {
  values: PresetValues;
  set: ((v: PresetValues) => void) | null;
  /** the panel's name field and the selected saved preset, kept via onChange */
  name: string;
  preset: string;
} = {
  values: {},
  set: null,
  name: 'my pond',
  preset: '',
};

/** Values that are look, not state: the sunk toggle is left out of a preset. */
export const presetable = (values: PresetValues): PresetValues => {
  const out: PresetValues = {};
  for (const [k, v] of Object.entries(values)) if (k !== 'sunk') out[k] = v;
  return out;
};

import type { PageLook } from '../components';

/** The sink panel's flat values, regrouped as a page look (missing keys left out). */
export function lookFromPanel(
  v: PresetValues
): Partial<{ [K in keyof PageLook]: Partial<PageLook[K]> }> {
  const n = (k: string) => (typeof v[k] === 'number' ? (v[k] as number) : undefined);
  const c = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined);
  const strip = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined)) as T;
  return {
    viscosity: n('viscosity'),
    mineral: strip({
      base: c('minBase'),
      highlight: c('minHigh'),
      stoneGray: n('minStone'),
      iridescence: n('minIrid'),
      specular: n('minSpec'),
      gamma: n('minGamma'),
    }),
    pearl: strip({
      cream: c('pearlCream'),
      shade: c('pearlShade'),
      clouding: n('pearlCloud'),
      nacre: n('pearlNacre'),
      iridescence: n('pearlIrid'),
      specular: n('pearlSpec'),
    }),
    mercury: strip({
      floor: c('mcFloor'),
      sky: c('mcSky'),
      horizon: n('mcHorizon'),
      topLight: n('mcTop'),
      specular: n('mcSpec'),
      iridescence: n('mcIrid'),
    }),
    spectrum: strip({
      white: n('spWhite'),
      spread: n('spSpread'),
      swirl: n('spSwirl'),
      cursorGlow: n('spGlow'),
      grainSize: n('spGrainSize'),
      grainDensity: n('spGrainDens'),
      glitterDensity: n('spGlitterDens'),
      facetSharpness: n('spFacet'),
      glint: n('spGlint'),
      glintFollowsPointer: n('spGlintPtr'),
      lamina: n('spLamina'),
    }),
    pointer: strip({
      reaction: n('ptReaction'),
      dimple: n('ptDimple'),
      wake: n('ptWake'),
      tilt: n('ptTilt'),
      drift: n('ptDrift'),
    }),
  };
}
