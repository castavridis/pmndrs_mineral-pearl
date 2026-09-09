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
import type { ResolvedTheme } from './tokens';

// The page's look: what every liquid surface (the ground, the pills, the
// ponds, the nacre callouts) uses unless a component is given its own. There
// is one per scheme: the dark ground is mineral, the light ground pearl, and
// each is tuned on its own. A preset saved from the sink panel can be applied
// to the current scheme's look for the whole page.

export interface PageLook {
  viscosity: number;
  mineral: MineralLook;
  pearl: PearlLook;
  mercury: MercuryLook;
  spectrum: SpectrumLook;
  pointer: PointerLook;
}

/** The dark ground: black mineral, coarse glitter, no pointer halo ("sunken spot"). */
const DARK: PageLook = {
  viscosity: 0.4,
  mineral: {
    base: '#080709',
    highlight: '#000000',
    stoneGray: 1.65,
    iridescence: 0.9,
    specular: 0.05,
    gamma: 1.1,
  },
  pearl: {
    cream: '#faf5ea',
    shade: '#c2bdb3',
    clouding: 0.6,
    nacre: 0.07,
    iridescence: 0.5,
    specular: 0.9,
  },
  mercury: { ...MERCURY_DEFAULT, floor: '#0f0f12', sky: '#edeff5' },
  spectrum: {
    white: 0.62,
    spread: 1.15,
    swirl: 1.6,
    cursorGlow: 0,
    grainSize: 350,
    grainDensity: 1,
    glitterDensity: 0.96,
    facetSharpness: 160,
    glint: 1.2,
    glintFollowsPointer: 1,
    lamina: 212,
  },
  pointer: { reaction: 3, dimple: 3, wake: 1, tilt: 1, drift: 0.75 },
};

/** The light ground: cream nacre, thick, fine soft glitter, a pointer halo ("sunken spot (nacre)"). */
const LIGHT: PageLook = {
  viscosity: 1.3,
  mineral: {
    base: '#080709',
    highlight: '#000000',
    stoneGray: 1.65,
    iridescence: 0.85,
    specular: 0.2,
    gamma: 0.58,
  },
  pearl: {
    cream: '#faf5ea',
    shade: '#faf5ea',
    clouding: 0.75,
    nacre: 0.08,
    iridescence: 1.4,
    specular: 1.2,
  },
  mercury: { ...MERCURY_DEFAULT, floor: '#0f0f12', sky: '#edeff5' },
  spectrum: {
    white: 0.3,
    spread: 0.65,
    swirl: 2.1,
    cursorGlow: 1.55,
    grainSize: 115,
    grainDensity: 1,
    glitterDensity: 1,
    facetSharpness: 10,
    glint: 0.7,
    glintFollowsPointer: 1,
    lamina: 212,
  },
  pointer: { reaction: 3, dimple: 3, wake: 0.6, tilt: 0.95, drift: 1.9 },
};

/** The default look of each scheme's ground. */
export const LOOK_DEFAULTS: Record<ResolvedTheme, PageLook> = { dark: DARK, light: LIGHT };
/** The dark ground's default look (the study's own numbers are the *_DEFAULT exports of the pond). */
export const LOOK_DEFAULT: PageLook = DARK;
/** The study's untuned look, for reference. */
export const LOOK_STUDY: PageLook = {
  viscosity: 0.4,
  mineral: MINERAL_DEFAULT,
  pearl: PEARL_DEFAULT,
  mercury: MERCURY_DEFAULT,
  spectrum: SPECTRUM_DEFAULT,
  pointer: POINTER_DEFAULT,
};

type PartialLook = Partial<{ [K in keyof PageLook]: Partial<PageLook[K]> }>;

interface LookState {
  /** A look applied to a scheme, or null for that scheme's default. */
  looks: Record<ResolvedTheme, PageLook | null>;
  /** The scheme the page is in (ThemeApplier keeps it current). */
  scheme: ResolvedTheme;
  /** The look in force: the current scheme's, live. */
  look: PageLook;
  setScheme: (scheme: ResolvedTheme) => void;
  /** Merge a partial look (each group merged over the current one) into the current scheme's look. */
  setLook: (partial: PartialLook) => void;
  /** Back to the defaults, both schemes. */
  reset: () => void;
}

const inForce = (looks: LookState['looks'], scheme: ResolvedTheme) =>
  looks[scheme] ?? LOOK_DEFAULTS[scheme];

export const useLook = create<LookState>()(
  persist(
    (set) => ({
      looks: { dark: null, light: null },
      scheme: 'dark',
      look: DARK,
      setScheme: (scheme) =>
        set((s) => (s.scheme === scheme ? s : { scheme, look: inForce(s.looks, scheme) })),
      setLook: (partial) =>
        set((s) => {
          const cur = s.look;
          const next: PageLook = {
            viscosity: partial.viscosity ?? cur.viscosity,
            mineral: { ...cur.mineral, ...partial.mineral },
            pearl: { ...cur.pearl, ...partial.pearl },
            mercury: { ...cur.mercury, ...partial.mercury },
            spectrum: { ...cur.spectrum, ...partial.spectrum },
            pointer: { ...cur.pointer, ...partial.pointer },
          };
          return { looks: { ...s.looks, [s.scheme]: next }, look: next };
        }),
      reset: () =>
        set((s) => ({ looks: { dark: null, light: null }, look: LOOK_DEFAULTS[s.scheme] })),
    }),
    {
      name: 'pmndrs-page-look',
      version: 1,
      partialize: (s) => ({ looks: s.looks }),
      // v0 kept one look for both schemes; the tuned defaults replace it
      migrate: () => ({ looks: { dark: null, light: null } }),
      merge: (persisted, current) => {
        const p = (persisted as Partial<Pick<LookState, 'looks'>> | undefined)?.looks;
        const looks = { dark: p?.dark ?? null, light: p?.light ?? null };
        return { ...current, looks, look: inForce(looks, current.scheme) };
      },
    }
  )
);

/** The page look in force, live. */
export const usePageLook = () => useLook((s) => s.look);
