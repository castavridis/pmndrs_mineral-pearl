import type { SwallowLook } from '../ink-sink/swallow';

/** The banner's swallow; see `SwallowLook` for what each number does. */
export type AnnouncementSwallow = SwallowLook;

/**
 * The numbers the site ships. `/dev/announcement` drives the same ones from a
 * panel, and its "copy as defaults" button writes this literal back out.
 */
export const ANNOUNCEMENT_SWALLOW: AnnouncementSwallow = {
  globSize: 1.6,
  globDensity: 0.9,
  globHeight: 0.8,
  globSettle: 1.1,
  globShading: true,
  droplets: false,
  viscosity: 0.8,
  pressDepth: -0.06,
  sinkDepth: -0.38,
  bleed: 116,
};
