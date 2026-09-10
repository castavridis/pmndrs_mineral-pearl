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
