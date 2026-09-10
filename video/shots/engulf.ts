import { defineShot } from '../capture/director';
import { HIDE_TOGGLE, SQUARE } from './_common';

/** Ink closes in on a paragraph from its edges, then drains, leaving the stain. */
export default defineShot({
  ...SQUARE,
  path: '/dev/engulf',
  css: HIDE_TOGGLE,
  ready: 'text=This paragraph is about to be drowned',
  warmup: 1,
  script: async (d) => {
    await d.mark('paragraph', 'text=This paragraph is about to be drowned');
    await d.wait(0.3);
    await d.invoke('engulf');
    await d.wait(4.5);
  },
});
