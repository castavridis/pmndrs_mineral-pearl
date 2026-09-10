/**
 * How the liquid takes a banner down, and how the banner rides while it is up.
 * These are the numbers the site ships; `/dev/announcement` drives the same
 * ones from a panel, so a look can be found there and pasted back here.
 *
 * In a well the unit is the page ground's (420 CSS px), not the banner's, so a
 * droplet sized for a pond panel reads as a speck against a 652 px banner.
 * `globSize` is the only scale that belongs to the mass rather than to the
 * ground, which is why it carries most of the weight here.
 */
export interface AnnouncementSwallow {
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
  /** Thickness of the liquid; undefined follows the page look's. */
  viscosity?: number;
  /** How deep a press drives the point under the finger, in uv. */
  pressDepth: number;
  /** How deep the banner rests once the liquid has closed over it, in uv. */
  sinkDepth: number;
  /** Liquid kept around the banner, px: where its ripples and droplets run. */
  bleed: number;
}

export const ANNOUNCEMENT_SWALLOW: AnnouncementSwallow = {
  globSize: 1.6,
  globDensity: 0.9,
  globHeight: 0.8,
  globSettle: 1.1,
  globShading: true,
  pressDepth: -0.12,
  sinkDepth: -0.34,
  bleed: 96,
};
