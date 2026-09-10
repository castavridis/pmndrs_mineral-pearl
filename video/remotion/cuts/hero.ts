import type { CameraKey, Reel } from '../edit';

/**
 * The hero cut: the front page in one continuous take (shots/main-page.ts),
 * square, no words. Fade in on the dark page, framed on the banner as it comes
 * up; it is dismissed; the pointer skims the copy bar, the callout and the
 * switch, then lingers in the callout's nacre; the switch is dunked and
 * brought back; it floods the page light, and the camera rises to watch the
 * banner resurface; a last press starts the dark ink and the pointer comes to
 * rest in the middle of the callout as the ink covers everything; fade out.
 *
 * Zoomed out, the frame holds the callout with 1.5rem either side — or, where
 * the banner is the subject, the banner with 1.5rem either side. The camera
 * pushes in for each interaction and comes back out.
 * Camera times are marks in the take (see its marks in
 * public/clips/main-page.json). Silent.
 */

/** 1.5rem, the margin every wide frame gives its subject. */
const MARGIN = 24;
/** The callout's width (560 px) and its margins. */
const WIDE = 560 + 2 * MARGIN;
/** The banner's width (671 px, once it is up) and its margins. */
const BANNER_SPAN = 671 + 2 * MARGIN;

// Where the wide frames sit. The banner frame is pinned to the page's top
// (the banner is 46 px down it), so everything under the banner shows too.
// Without the banner, the callout frame holds the nav to the switch control.
const BANNER: [number, number] = [482, 0];
const NO_BANNER: [number, number] = [480, 380];

const at = (
  t: CameraKey['t'],
  span: number,
  focus: CameraKey['focus'],
  ease?: CameraKey['ease']
): CameraKey => ({ t, span, focus, ease });

export const hero: Reel = {
  bpm: 120,
  // silent: no music, no sound effects
  sfx: false,
  fadeIn: 1.4,
  fadeOut: 1.6,
  cuts: [
    {
      clip: 'main-page',
      from: 0,
      beats: 68, // 34 s: the take, to the ink's last frame before the dark page returns
      // Elegant, not punchy: every move is a slow sine glide of a second or
      // more, with no shake, no zoom kick on a press, and a soft cursor.
      // Times are marks in the take (shots/main-page.ts), so re-timing the take
      // keeps the camera in step.
      punch: false,
      cursorStyle: 'soft',
      camera: [
        // the page fades in on the banner as it comes up out of the liquid
        at(0, BANNER_SPAN, BANNER),
        at('dismiss-1.5', BANNER_SPAN, BANNER),
        // in on its close button as the pointer makes its way there
        at('dismiss-0.1', 420, [640, 80], 'sine'),
        at('dismiss+0.9', 400, [640, 80], 'sine'),
        // out to the callout's frame as the banner's room closes
        at('skim', WIDE, NO_BANNER, 'sine'),
        // the skim over the copy bar, the callout and the switch: all in frame
        at('goo-1.0', WIDE, NO_BANNER),
        // in on the callout for the slow loop through its nacre, drifting closer
        at('goo+0.5', 450, 'track:callout', 'sine'),
        at('dunk-1.4', 420, 'track:callout', 'sine'),
        // across to the switch and the control under it: dunked, and back; the
        // switch stays in this frame for the press that floods the page
        at('dunk-0.1', 380, 'track:switches', 'sine'),
        at('flood', 360, 'track:switches', 'sine'),
        // the flood carries the camera up and out to the banner's frame, to
        // watch it resurface into the light page
        at('light+0.3', BANNER_SPAN, BANNER, 'sine'),
        at('splat-1.4', BANNER_SPAN, BANNER),
        // in again for the last press
        at('splat-0.1', 380, 'track:switches', 'sine'),
        // out, centred on the callout, where the pointer comes to rest as the
        // dark ink covers everything
        at('rest+0.3', WIDE, 'track:callout', 'sine'),
        at('rest+2.5', WIDE - 30, 'track:callout', 'sine'),
      ],
    },
  ],
};
