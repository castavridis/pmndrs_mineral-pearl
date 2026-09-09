import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Saved sink-panel presets, kept in localStorage. Leva has no persistence of
// its own; the panel's buttons write here and read the latest panel values
// through `latest`, which the page updates from an effect.

export type PresetValues = Record<string, unknown>;

interface PresetState {
  presets: Record<string, PresetValues>;
  save: (name: string, values: PresetValues) => void;
  remove: (name: string) => void;
}

export const usePresets = create<PresetState>()(
  persist(
    (set) => ({
      presets: {},
      save: (name, values) => set((s) => ({ presets: { ...s.presets, [name]: values } })),
      remove: (name) =>
        set((s) => {
          const next = { ...s.presets };
          delete next[name];
          return { presets: next };
        }),
    }),
    { name: 'pmndrs-pond-presets' }
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
