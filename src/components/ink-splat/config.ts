// Shared tunables for the ink splat. Shader space is measured in "units" where
// one unit is the longer viewport edge times the blot scale; the blot sits at
// the centre of a (w/unit, h/unit) rectangle and scales with the window.

/** Default blot scale. Raising it grows everything. */
export const BLOT_SCALE = 1.5;
/** Seconds after impact when the ink begins to bleed outward. */
export const FLOOD_START = 1.2;
/** Seconds for the flood to cover the screen. */
export const FLOOD_LEN = 1.4;
/** Seconds until nothing moves anymore. */
export const DURATION = FLOOD_START + FLOOD_LEN + 0.2;
/** Droplet budget; also the width of the particle data texture. */
export const MAX_PARTICLES = 256;
/**
 * The metaball kernel (1 - q²)² crosses the 0.5 threshold at q = 0.541, so a
 * droplet's kernel reach is its visible radius divided by that.
 */
export const KERNEL_Q = 0.541;

/** Engulf mode: the edge flood starts almost at once and takes a little longer. */
export const ENGULF_FLOOD_START = 0.35;
export const ENGULF_FLOOD_LEN = 1.6;
export const ENGULF_DURATION = ENGULF_FLOOD_START + ENGULF_FLOOD_LEN + 0.2;
/** Seconds for the flood to withdraw again when drained. */
export const DRAIN_LEN = 1.1;

export const TAU = Math.PI * 2;

/** 0 → 1 progress of the flood at simulation time `t`. */
export const floodPhase = (t: number) => Math.min(Math.max((t - FLOOD_START) / FLOOD_LEN, 0), 1);
