import {
  MERCURY_DEFAULT,
  MINERAL_DEFAULT,
  PEARL_DEFAULT,
  POINTER_DEFAULT,
  SPECTRUM_DEFAULT,
  type Liquid,
  type MercuryLook,
  type MineralLook,
  type PearlLook,
  type PointerLook,
  type PondOptions,
  type SpectrumLook,
} from './liquid-pond';
import type { PageLook } from '../theme/look';

/** What a sink was given: its props, with the component's own defaults applied. */
export interface SinkSettings {
  liquid: Liquid;
  viscosity?: number;
  mercuryOnSink: boolean;
  globSize: number;
  globDensity: number;
  globHeight: number;
  globSettle: number;
  sinkDepth?: number;
  pressDepth?: number;
  pressHeave?: number;
  sinkSpeed?: number;
  sinkSplash?: boolean;
  globShading: boolean;
  slabLiquid: boolean;
  radius: number;
  unit?: number;
  well: boolean;
  mineral?: Partial<MineralLook>;
  pearl?: Partial<PearlLook>;
  spectrum?: Partial<SpectrumLook>;
  pointer?: Partial<PointerLook>;
  mercury?: Partial<MercuryLook>;
}

/** The two things a well takes from the ground it is a window onto. */
export interface GroundFrame {
  unit?: number;
  maxDpr: number;
}

/**
 * Every option a sink's pond runs with, from what the sink was given, the page
 * look, and — in a well — the ground. It is the one place these rules live:
 * the sink builds a pond from it and updates a live one from it, so the two can
 * never disagree. They did once, when the builder forced mercury off for a well
 * and the updater handed the default straight back on the next render.
 *
 * The rules:
 *
 * - A well never turns to mercury. It is a window onto the page's own surface,
 *   and the page does not turn to chrome because one slab in it went under.
 * - A well samples like the ground: the ground's unit and resolution, so the
 *   liquid inside the window lines up with the liquid outside it.
 * - The mineral body wears the dark look and the pearl body the light one; a
 *   prop given to this sink wins over either, and the study's numbers fill in
 *   anything neither sets.
 */
export function resolvePondOptions(
  s: SinkSettings,
  looks: Record<'dark' | 'light', PageLook>,
  look: PageLook,
  ground: GroundFrame | null
): PondOptions {
  const well = s.well;
  return {
    liquid: s.liquid,
    viscosity: s.viscosity ?? looks.dark.viscosity,
    viscosityPearl: s.viscosity ?? looks.light.viscosity,
    mercuryOnSink: well ? false : s.mercuryOnSink,
    globSize: s.globSize,
    globDensity: s.globDensity,
    globHeight: s.globHeight,
    globSettle: s.globSettle,
    sinkDepth: s.sinkDepth,
    pressDepth: s.pressDepth,
    pressHeave: s.pressHeave,
    sinkSpeed: s.sinkSpeed,
    sinkSplash: s.sinkSplash,
    globShading: s.globShading,
    slabLiquid: s.slabLiquid,
    radius: s.radius,
    maxDpr: well && ground ? ground.maxDpr : 2,
    unit: well ? ground?.unit : s.unit,
    well,
    mineral: { ...MINERAL_DEFAULT, ...looks.dark.mineral, ...s.mineral },
    pearl: { ...PEARL_DEFAULT, ...looks.light.pearl, ...s.pearl },
    mercury: { ...MERCURY_DEFAULT, ...look.mercury, ...s.mercury },
    spectrum: { ...SPECTRUM_DEFAULT, ...looks.dark.spectrum, ...s.spectrum },
    pointer: { ...POINTER_DEFAULT, ...looks.dark.pointer, ...s.pointer },
    spectrumPearl: { ...SPECTRUM_DEFAULT, ...looks.light.spectrum, ...s.spectrum },
    pointerPearl: { ...POINTER_DEFAULT, ...looks.light.pointer, ...s.pointer },
  };
}

/**
 * The options a live pond takes on an update: everything resolved, except the
 * ones fixed when it was built. `liquid` goes through `setLiquid`, which runs
 * the switch between bodies and would skip it if the option were already set;
 * `well` decides how the pond was wired up and cannot change under it.
 */
export function updatableOptions(o: PondOptions): Partial<PondOptions> {
  const { liquid: _liquid, well: _well, ...rest } = o;
  return rest;
}
