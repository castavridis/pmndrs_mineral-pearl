import { defineShot } from '../capture/director';
import { APPROACH, BENTO, SQUARE } from './_common';

/** Disabled is under the surface: the switch sinks into the liquid, then rises again. */
export default defineShot({
  ...SQUARE,
  path: '/',
  ready: BENTO.disable,
  warmup: 1.5,
  cursorStart: { x: 860, y: 920 },
  script: async (d) => {
    await d.mark('launcher', BENTO.launcher);
    // the switch and the control under it, together: what the camera frames
    await d.mark('switches', `${BENTO.launcher}, ${BENTO.disable}`);
    await d.wait(0.3);
    await d.moveTo(BENTO.disable, { duration: APPROACH });
    await d.wait(0.15);
    await d.mark('sunk');
    await d.click(undefined, { hold: 0.1 });
    await d.wait(2);
    await d.mark('risen');
    await d.click(BENTO.disable, { move: 0.2 });
    await d.wait(1.6);
  },
});
