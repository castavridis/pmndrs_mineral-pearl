import type { Scroll } from '../Scroll';

/**
 * The design system on the r3f docs, from two full-page screenshots
 * (reference/design-system/, pre-scaled into public/design-system/ by
 * `pnpm ds:assets`). No capture, no camera: the page fills the square edge to
 * edge and the motion is the scroll.
 *
 * Fade in on the light page from its own ground; scroll all the way down to
 * the contributors; crossfade to the dark page at the same place; scroll back
 * up; fade out to the dark page's ground. Silent. On a 120 BPM grid (0.5 s a
 * beat).
 */

/** Contributors at the foot of the frame, just above the page footer (px of the 1080-wide page). */
const CONTRIBUTORS = 3062 - 1080;

export const designSystem: Scroll = {
  seconds: 14,
  pages: {
    light: { src: 'design-system/light.png', ground: '#fffefc' },
    dark: { src: 'design-system/dark.png', ground: '#191712' },
  },
  fadeIn: [0, 0.8],
  scroll: [
    { from: 2, to: 5.5, y: CONTRIBUTORS },
    { from: 8.5, to: 12, y: 0 },
  ],
  crossfade: [6, 7],
  fadeOut: [13.2, 14],
};
