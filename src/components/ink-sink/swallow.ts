/**
 * How the liquid takes a slab down, and how it rides while it is up: one look
 * for everything afloat on a well. `ANNOUNCEMENT_SWALLOW` and the bento's
 * `CONTROL_SWALLOW` are instances of it, and the dev panels drive the same
 * fields, so a look can be found in a panel and pasted back into a default.
 *
 * In a well the unit is the page ground's (420 CSS px), not the slab's, so a
 * droplet sized for a pond panel reads as a speck against a wide banner.
 * `globSize` is the only scale that belongs to the mass rather than to the
 * ground, which is why it carries most of the weight here.
 */
export interface SwallowLook {
  /** Droplet size, relative to the study's. */
  globSize: number;
  /** How many droplets the swallow throws, 0..1. */
  globDensity: number;
  /** How far a landed glob heaps above the surface before it relaxes. */
  globHeight: number;
  /** Seconds a landed glob takes to relax to flat. */
  globSettle: number;
  /** Light the mass, rather than drawing it as flat coverage. */
  globShading: boolean;
  /**
   * Throw the rim's droplets as the slab goes under. Off, the liquid simply
   * closes over it: a quiet swallow, with the ring from the blow and nothing
   * flying. The droplets are the swallow's own — a press never throws them.
   */
  droplets: boolean;
  /** Thickness of the liquid; undefined follows the page look's. */
  viscosity?: number;
  /** How deep a press drives the point under the finger, in uv. */
  pressDepth: number;
  /** How deep the slab rests once the liquid has closed over it, in uv. */
  sinkDepth: number;
  /** Liquid kept around the slab, px: where its ripples and droplets run. */
  bleed: number;
}
