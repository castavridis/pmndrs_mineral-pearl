import { defineShot } from '../capture/director';
import { APPROACH, BENTO, SQUARE } from './_common';

/** Dismissing the banner: the liquid swallows it. */
export default defineShot({
  ...SQUARE,
  path: '/',
  ready: BENTO.dismiss,
  warmup: 1.5,
  cursorStart: { x: 900, y: 420 },
  script: async (d) => {
    await d.mark('banner', BENTO.banner);
    await d.wait(0.3);
    await d.moveTo(BENTO.dismiss, { duration: APPROACH });
    await d.wait(0.15);
    await d.mark('dismiss');
    await d.click(undefined, { hold: 0.1 });
    await d.wait(2.6);
  },
});
