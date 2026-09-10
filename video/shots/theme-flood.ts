import { defineShot } from '../capture/director';
import { APPROACH, BENTO, SQUARE } from './_common';

/** The theme switch: ink floods the page from the button in slow motion, then dark ink floods it back. */
export default defineShot({
  ...SQUARE,
  path: '/',
  ready: BENTO.launcher,
  warmup: 1.5,
  cursorStart: { x: 880, y: 900 },
  script: async (d) => {
    await d.mark('launcher', BENTO.launcher);
    await d.wait(0.3);
    await d.moveTo(BENTO.launcher, { duration: APPROACH });
    await d.wait(0.15);
    await d.mark('flood');
    await d.click(undefined, { hold: 0.1 });
    // the flood is the money shot: 4× slow motion, every frame a real one
    d.speed(0.25);
    await d.wait(2.4);
    d.speed(1);
    // the switch is busy until the flood has settled; a press before then is ignored
    await d.wait(2.2);
    await d.mark('back');
    await d.click(BENTO.launcher, { hold: 0.1, move: 0.5 });
    d.speed(0.5);
    await d.wait(2);
    d.speed(1);
    await d.wait(1.2);
  },
});
