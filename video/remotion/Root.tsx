import { Composition } from 'remotion';
import { designSystem } from './cuts/design-system';
import { hero } from './cuts/hero';
import { Reel, reelMetadata } from './Reel';
import { ScrollReel, scrollMetadata } from './Scroll';

// One composition per reel in cuts/. The frame's shape should match the shots'
// viewport: the hero is square, filmed at 960×960 (shots/_common.ts SQUARE).
// A vertical cut would be 1080×1920 with shots filmed in a tall viewport.
export function Root() {
  return (
    <>
      <Composition
        id="Hero"
        component={Reel}
        width={1080}
        height={1080}
        fps={60}
        durationInFrames={1}
        defaultProps={{ reel: hero }}
        calculateMetadata={reelMetadata}
      />
      <Composition
        id="DesignSystem"
        component={ScrollReel}
        width={1080}
        height={1080}
        fps={60}
        durationInFrames={1}
        defaultProps={{ reel: designSystem }}
        calculateMetadata={scrollMetadata}
      />
    </>
  );
}
