import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';

// A reel made from full-page screenshots instead of captured clips: the page
// fills the frame edge to edge (the screenshots are pre-scaled to the frame's
// width), the motion is the scroll, and the theme change is a crossfade.
// Reels live in cuts/ (design-system.ts).

export interface Page {
  /** A screenshot in public/, as wide as the frame. */
  src: string;
  /** The page's ground: what it fades in from and out to. */
  ground: string;
}

export interface Scroll {
  seconds: number;
  pages: { light: Page; dark: Page };
  /** Seconds [start, end] of the fade from the light page's ground. */
  fadeIn: [number, number];
  /** Eased scrolls, in seconds; `y` is where the page's top ends up, px above the frame. */
  scroll: { from: number; to: number; y: number }[];
  /** Seconds [start, end] of the crossfade from the light page to the dark. */
  crossfade: [number, number];
  /** Seconds [start, end] of the fade to the dark page's ground. */
  fadeOut: [number, number];
}

// sine, not cubic: a long scroll peaks at half the speed, so the page stays readable
const scrollEase = Easing.inOut(Easing.sin);

function scrollAt(t: number, keys: Scroll['scroll']) {
  let y = 0;
  for (const k of keys) {
    if (t >= k.to) y = k.y;
    else if (t > k.from) return interpolate(t, [k.from, k.to], [y, k.y], { easing: scrollEase });
  }
  return y;
}

function PageImage({ page, y }: { page: Page; y: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: page.ground }}>
      <Img
        src={staticFile(page.src)}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${-y}px)` }}
      />
    </AbsoluteFill>
  );
}

export function ScrollReel({ reel }: { reel: Scroll }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const y = scrollAt(t, reel.scroll);
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const dark = interpolate(t, reel.crossfade, [0, 1], { easing: Easing.inOut(Easing.sin), ...clamp });
  const fadeIn = interpolate(t, reel.fadeIn, [1, 0], clamp);
  const fadeOut = interpolate(t, reel.fadeOut, [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: reel.pages.light.ground }}>
      {dark < 1 && <PageImage page={reel.pages.light} y={y} />}
      {dark > 0 && (
        <AbsoluteFill style={{ opacity: dark }}>
          <PageImage page={reel.pages.dark} y={y} />
        </AbsoluteFill>
      )}
      {fadeIn > 0 && <AbsoluteFill style={{ backgroundColor: reel.pages.light.ground, opacity: fadeIn }} />}
      {fadeOut > 0 && <AbsoluteFill style={{ backgroundColor: reel.pages.dark.ground, opacity: fadeOut }} />}
    </AbsoluteFill>
  );
}

export const scrollMetadata: CalculateMetadataFunction<{ reel: Scroll }> = ({ props }) => ({
  durationInFrames: Math.round(props.reel.seconds * 60),
  fps: 60,
});
