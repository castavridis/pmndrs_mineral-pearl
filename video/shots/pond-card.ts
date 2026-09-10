import { defineShot } from '../capture/director';
import { APPROACH, HIDE_TOGGLE, SQUARE } from './_common';

const CARD = 'text=A rounded slab rests on a thin, heavy liquid';

/** A slab afloat on the pond: it tips under the pointer's weight, then a press sinks it with a splash. */
export default defineShot({
  ...SQUARE,
  path: '/dev/engulf',
  css: HIDE_TOGGLE,
  ready: CARD,
  warmup: 1,
  cursorStart: { x: 900, y: 860 },
  setup: async (d) => {
    await d.evaluate(() => {
      const el = [...document.querySelectorAll('p')].find((p) =>
        p.textContent?.startsWith('A rounded slab')
      );
      el?.scrollIntoView({ block: 'center' });
    });
    await d.wait(1.2);
  },
  script: async (d) => {
    const r = await d.rect(CARD);
    await d.mark('card', CARD);
    await d.wait(0.3);
    await d.moveTo({ x: r.x + r.width * 0.9, y: r.y + r.height * 0.3 }, { duration: APPROACH });
    // lean on it: the slab tips under the pointer's weight
    await d.mark('tilt');
    await d.trace(
      [
        { x: r.x + r.width * 0.1, y: r.y + r.height * 0.4 },
        { x: r.x + r.width * 0.5, y: r.y + r.height * 0.8 },
      ],
      { duration: 1.4 }
    );
    await d.mark('sink');
    await d.click(undefined, { hold: 0.12 });
    await d.wait(3);
  },
});
