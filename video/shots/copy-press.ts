import { defineShot } from '../capture/director';
import { APPROACH, BENTO, SQUARE } from './_common';

/** A press on the copy bar: it dips into the liquid and bobs back up. */
export default defineShot({
  ...SQUARE,
  path: '/',
  ready: BENTO.copy,
  warmup: 1.5,
  cursorStart: { x: 880, y: 860 },
  script: async (d) => {
    await d.mark('copyBar', BENTO.copyBar);
    await d.wait(0.3);
    await d.moveTo(BENTO.copy, { duration: APPROACH });
    await d.wait(0.15);
    await d.mark('press');
    await d.click(undefined, { hold: 0.14 });
    await d.wait(1.9);
  },
});
