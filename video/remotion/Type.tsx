import { loadFont } from '@remotion/google-fonts/Inter';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { palette, type PaletteName } from './edit';

// the app's own face (src/index.css), at the weights a title needs
export const { fontFamily } = loadFont('normal', {
  weights: ['500', '700', '900'],
  subsets: ['latin'],
});

/**
 * One word, slammed in: black type on a slab of the cut's palette colour, a
 * sticker slapped on the frame. It scales down onto the frame on a stiff
 * spring with a twist and settles bottom-left; the slab reads on the dark page,
 * the light one and the ink between them.
 */
export function Word({
  text,
  color = 'green',
  kicker,
}: {
  text: string;
  color?: PaletteName;
  kicker?: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const slam = spring({ frame, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } });
  const scale = interpolate(slam, [0, 1], [1.9, 1]);
  const rot = interpolate(slam, [0, 1], [-11, -2.5]);
  const late = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 84 * unit,
          bottom: 78 * unit,
          fontFamily,
          transform: `scale(${scale}) rotate(${rot}deg)`,
          transformOrigin: '0% 100%',
          opacity: Math.min(1, slam * 3),
        }}
      >
        {kicker && (
          <div
            style={{
              display: 'inline-block',
              fontSize: 30 * unit,
              fontWeight: 700,
              color: '#fff',
              background: '#111',
              padding: `${6 * unit}px ${14 * unit}px`,
              marginBottom: 10 * unit,
              transform: `translateX(${interpolate(late, [0, 1], [-40, 0])}px)`,
              opacity: late,
            }}
          >
            {kicker}
          </div>
        )}
        <div
          style={{
            background: palette[color],
            color: '#0b0b0b',
            fontSize: 150 * unit,
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            padding: `${4 * unit}px ${34 * unit}px ${18 * unit}px ${26 * unit}px`,
            borderRadius: 10 * unit,
            boxShadow: `0 ${18 * unit}px ${50 * unit}px rgba(0,0,0,0.35)`,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** A closing title over the footage: the name, then the line under it. */
export function Card({ title, subtitle }: { title: string; subtitle?: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const a = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 150 } });
  const b = spring({ frame: frame - 16, fps, config: { damping: 18, stiffness: 140 } });
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 110 * unit,
        fontFamily,
        color: '#fff',
        mixBlendMode: 'difference',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 120 * unit,
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          opacity: a,
          transform: `translateY(${interpolate(a, [0, 1], [60, 0])}px) scale(${interpolate(a, [0, 1], [1.08, 1])})`,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            marginTop: 22 * unit,
            fontSize: 40 * unit,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            opacity: b * 0.9,
            transform: `translateY(${interpolate(b, [0, 1], [24, 0])}px)`,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}

/** A white flash that burns off in a few frames. */
export function Flash() {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 7], [0.85, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: '#fff', opacity: o, pointerEvents: 'none' }} />;
}
