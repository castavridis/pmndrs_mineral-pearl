import { defineShot } from '../capture/director';
import { APPROACH, BENTO, SQUARE } from './_common';

/** The pointer drags a droplet under the nacre callout; the text refracts through it. */
export default defineShot({
  ...SQUARE,
  path: '/',
  ready: BENTO.callout,
  warmup: 1.5,
  cursorStart: { x: 900, y: 880 },
  script: async (d) => {
    const r = await d.rect(BENTO.callout);
    await d.mark('callout', BENTO.callout);
    await d.wait(0.3);
    await d.moveTo({ x: r.x - 16, y: r.y + r.height * 0.6 }, { duration: APPROACH });
    await d.mark('sweep');
    await d.trace(
      [
        { x: r.x + r.width * 0.25, y: r.y + r.height * 0.3 },
        { x: r.x + r.width * 0.5, y: r.y + r.height * 0.75 },
        { x: r.x + r.width * 0.75, y: r.y + r.height * 0.25 },
        { x: r.x + r.width * 0.97, y: r.y + r.height * 0.6 },
      ],
      { duration: 2.6 }
    );
    await d.wait(0.6);
  },
});
