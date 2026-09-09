import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MERCURY_DEFAULT,
  MINERAL_DEFAULT,
  PEARL_DEFAULT,
  POINTER_DEFAULT,
  SPECTRUM_DEFAULT,
  type MercuryLook,
  type MineralLook,
  type PearlLook,
  type PointerLook,
  type SpectrumLook,
} from '../ink-sink/liquid-pond';

// The page's look: what every liquid surface (the ground, the pills, the
// ponds, the nacre callouts) uses unless a component is given its own. A
// preset saved from the sink panel can be applied here for the whole page.

export interface PageLook {
  viscosity: number;
  mineral: MineralLook;
  pearl: PearlLook;
  mercury: MercuryLook;
  spectrum: SpectrumLook;
  pointer: PointerLook;
}

export const LOOK_DEFAULT: PageLook = {
  viscosity: 0.4,
  mineral: MINERAL_DEFAULT,
  pearl: PEARL_DEFAULT,
  mercury: MERCURY_DEFAULT,
  spectrum: SPECTRUM_DEFAULT,
  pointer: POINTER_DEFAULT,
};

interface LookState {
  look: PageLook;
  /** Merge a partial look (each group merged over the current one). */
  setLook: (partial: Partial<{ [K in keyof PageLook]: Partial<PageLook[K]> }>) => void;
  reset: () => void;
}

export const useLook = create<LookState>()(
  persist(
    (set) => ({
      look: LOOK_DEFAULT,
      setLook: (partial) =>
        set((s) => ({
          look: {
            viscosity: partial.viscosity ?? s.look.viscosity,
            mineral: { ...s.look.mineral, ...partial.mineral },
            pearl: { ...s.look.pearl, ...partial.pearl },
            mercury: { ...s.look.mercury, ...partial.mercury },
            spectrum: { ...s.look.spectrum, ...partial.spectrum },
            pointer: { ...s.look.pointer, ...partial.pointer },
          },
        })),
      reset: () => set({ look: LOOK_DEFAULT }),
    }),
    { name: 'pmndrs-page-look' }
  )
);

/** The page look, live. */
export const usePageLook = () => useLook((s) => s.look);
