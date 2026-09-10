import type { SwallowLook } from '../components';

/**
 * How the liquid takes a *control* down: the bento's copy bar and article
 * launcher. A banner is a slab you watch; a control is one you use, so this
 * look is the quieter of the two — thin, shallow, no droplets, and a bleed
 * only wide enough for the ripple to run.
 *
 * `/dev/bento` drives these from a panel; its "copy as defaults" button writes
 * this literal back out, ready to paste over the one here.
 */
export const CONTROL_SWALLOW: SwallowLook = {
  globSize: 1,
  globDensity: 0.5,
  globHeight: 0,
  globSettle: 0.9,
  globShading: false,
  droplets: false,
  viscosity: 0.22,
  pressDepth: -0.09,
  sinkDepth: -0.1,
  bleed: 44,
};

/**
 * The article launcher presses differently from the copy bar. A copy bar is a
 * row of separate actions and the hand lands on one of them, so the lean under
 * the finger is the point of it. The launcher is one face and a primary call
 * to action: it should give under the hand as a whole, softly, rather than
 * being knocked down at one corner. Nearly all heave, a shallower depth, and
 * the knock that comes with a lever falls away with it.
 */
export const LAUNCHER_SWALLOW: Partial<SwallowLook> = {
  pressHeave: 0.9,
  pressDepth: -0.05,
  // It also floats on the page's own liquid rather than on a thinner one of
  // its own: `undefined` here leaves the viscosity to the page look, which is
  // the pair of saved presets — "sunken spot" on the dark ground (0.4) and
  // "sunken spot (nacre)" on the light one (1.3). A control that sinks to
  // say it is unavailable should sink through the liquid the page is made of.
  viscosity: undefined,
};

/**
 * How hard the pointer's wake moves the middle tier. These are controls, not
 * ornaments: at 0.8 a ripple passing under one shoved it several pixels and a
 * degree of tilt, which read as an animation rather than as water. Halved, it
 * is a lean you notice only if you are looking at it.
 *
 * `useWake` carries the movement and the tilt in one number, so lowering it
 * softens both together.
 */
export const CONTROL_WAKE = 0.35;

/** The callout is a bigger, heavier slab, so it answers the water even less. */
export const CALLOUT_WAKE = 0.26;
