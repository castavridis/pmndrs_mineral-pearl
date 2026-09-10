import { defineShot } from '../capture/director';
import { BENTO, NACRE_CALM, SQUARE, holdNacre } from './_common';

/** True once a theme change is over: the ink's overlay has gone. */
const themeSettled = (theme: string) =>
  document.documentElement.dataset.theme === theme && !document.querySelector('[class*="_overlay_"]');

/**
 * The front page in one take, on the dark page: the banner comes up and is
 * dismissed; the pointer skims the copy bar, the callout and the switch to
 * show their wakes, then lingers on the callout's nacre; the switch is dunked
 * and brought back; it floods the page light and the banner resurfaces; and
 * a last press starts the dark ink, the pointer coming to rest on the middle
 * of the callout as it covers everything.
 */
export default defineShot({
  ...SQUARE,
  path: '/',
  warmup: 0.4,
  cursorStart: { x: 940, y: 990 },
  track: {
    banner: BENTO.banner,
    copy: BENTO.copyBar,
    callout: BENTO.calloutBox,
    launcher: BENTO.launcher,
    switches: `${BENTO.launcher}, ${BENTO.disable}`,
    // the copy bar, the callout and the switches: the column the wide frame holds
    column: `.afloat, ${BENTO.disable}`,
  },
  setup: async (d) => {
    // less glare on the callout, so its white text reads
    await d.page.evaluate(holdNacre(NACRE_CALM));
  },
  script: async (d) => {
    // Unhurried throughout: every pointer move eases like a hand (`smooth`),
    // each press waits a beat after the pointer arrives, and the slow motion
    // eases in and out rather than switching.
    const hand = 'smooth' as const;

    // the page fades in (in the edit) and the banner comes up out of the liquid
    await d.mark('open');
    await d.wait(2.6);

    // dismiss it: it goes under and its room closes
    await d.moveTo(BENTO.dismiss, { duration: 1.2, ease: hand });
    await d.wait(0.2);
    await d.mark('dismiss');
    await d.click(undefined, { hold: 0.1 });
    await d.waitUntil(() => !document.querySelector('[aria-label="Dismiss announcement"]'), {
      max: 8,
    });
    await d.mark('dismissed');
    await d.wait(0.4);

    // one easy pass over the copy bar, the callout and the switch
    const copy = await d.rect(BENTO.copyBar);
    const cal = await d.rect(BENTO.calloutBox);
    const sw = await d.rect(BENTO.launcher);
    await d.mark('skim');
    await d.trace(
      [
        { x: copy.x + copy.width * 0.06, y: copy.y + copy.height * 0.5 },
        { x: copy.x + copy.width * 0.94, y: copy.y + copy.height * 0.55 },
        { x: cal.x + cal.width * 0.8, y: cal.y + cal.height * 0.35 },
        { x: cal.x + cal.width * 0.2, y: cal.y + cal.height * 0.65 },
        { x: sw.x + sw.width * 0.12, y: sw.y + sw.height * 0.5 },
        { x: sw.x + sw.width * 0.92, y: sw.y + sw.height * 0.5 },
        { x: sw.x + sw.width + 70, y: sw.y + sw.height + 36 },
      ],
      { duration: 3.6, ease: hand }
    );
    await d.wait(0.4);

    // back to the callout, and a slow loop through its nacre: the goo
    await d.moveTo(
      { x: cal.x + cal.width * 0.3, y: cal.y + cal.height * 0.5 },
      { duration: 1.0, ease: hand }
    );
    await d.mark('goo');
    await d.trace(
      [
        { x: cal.x + cal.width * 0.5, y: cal.y + cal.height * 0.25 },
        { x: cal.x + cal.width * 0.72, y: cal.y + cal.height * 0.7 },
        { x: cal.x + cal.width * 0.5, y: cal.y + cal.height * 0.5 },
        { x: cal.x + cal.width * 0.28, y: cal.y + cal.height * 0.3 },
        { x: cal.x + cal.width * 0.3, y: cal.y + cal.height * 0.72 },
        { x: cal.x + cal.width * 0.55, y: cal.y + cal.height * 0.45 },
      ],
      { duration: 4.0, ease: hand }
    );
    await d.wait(0.3);

    // dunk the switch, then bring it back
    await d.moveTo(BENTO.disable, { duration: 1.0, ease: hand });
    await d.wait(0.2);
    await d.mark('dunk');
    await d.click(undefined, { hold: 0.1 });
    await d.wait(2.0);
    await d.mark('rise');
    await d.click(undefined, { hold: 0.1 });
    await d.wait(1.4);

    // the switch floods the page light; the flood eases into slow motion and out
    await d.moveTo(BENTO.launcher, { duration: 0.9, ease: hand });
    await d.wait(0.2);
    await d.mark('flood');
    await d.click(undefined, { hold: 0.1 });
    d.speed(0.35, { over: 0.5 });
    await d.wait(2.2);
    d.speed(1, { over: 0.8 });
    await d.waitUntil(themeSettled, { arg: 'light', max: 10 });
    await d.mark('light');
    // the page is at the top already (the edit's camera rises to the banner);
    // the banner resurfaces into the light page
    await d.scrollTo(0, { duration: 0.3 });
    await d.wait(1.9);

    // the last press: dark ink, and the pointer comes to rest on the callout
    await d.moveTo(BENTO.launcher, { duration: 1.0, ease: hand });
    await d.wait(0.2);
    await d.mark('splat');
    await d.click(undefined, { hold: 0.1 });
    // easing to half speed: the ink covers everything for ~2 s before the dark
    // page comes back, long enough to settle on the pointer and fade out
    d.speed(0.5, { over: 0.5 });
    const c = await d.rect(BENTO.calloutBox);
    await d.moveTo({ x: c.x + c.width / 2, y: c.y + c.height / 2 }, { duration: 1.6, ease: hand });
    await d.mark('rest');
    await d.wait(3.0);
    await d.mark('end');
  },
});
