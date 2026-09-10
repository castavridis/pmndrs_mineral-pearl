import { defineShot } from '../capture/director';
import { HIDE_TOGGLE, SQUARE } from './_common';

/** The ink hits the glass, the mark surfaces, and the ink takes the screen. */
export default defineShot({
  ...SQUARE,
  path: '/dev/splat',
  css: `.hint { display: none !important; } ${HIDE_TOGGLE}`,
  warmup: 0.5,
  cursorStart: { x: 860, y: 900 },
  script: async (d) => {
    await d.wait(0.3);
    await d.moveTo({ x: 480, y: 450 }, { duration: 0.7, ease: 'snap' });
    await d.mark('impact');
    await d.click(undefined, { hold: 0.08 });
    await d.wait(3.4);
  },
});
