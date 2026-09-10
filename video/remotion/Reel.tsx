import {
  AbsoluteFill,
  Html5Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { layout, type ClipMeta, type Reel as ReelSpec } from './edit';
import { CutSfx } from './Sfx';
import { Shot } from './Shot';
import { Card, Flash, Word } from './Type';

export type ReelProps = { reel: ReelSpec; metas?: Record<string, ClipMeta> };

/** The reel's fade from and to black: 0 = clear, 1 = black. */
function blackAt(frame: number, total: number, fps: number, fadeIn = 0, fadeOut = 0) {
  const a = fadeIn ? interpolate(frame, [0, fadeIn * fps], [1, 0], { extrapolateRight: 'clamp' }) : 0;
  const b = fadeOut
    ? interpolate(frame, [total - fadeOut * fps, total - 1], [0, 1], { extrapolateLeft: 'clamp' })
    : 0;
  return Math.max(a, b);
}

function Fade({ reel, total }: { reel: ReelSpec; total: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = blackAt(frame, total, fps, reel.fadeIn, reel.fadeOut);
  return o > 0 ? <AbsoluteFill style={{ backgroundColor: '#000', opacity: o }} /> : null;
}

/** Plays a reel: its cuts back to back on the beat grid, with words, cards and the music. */
export function Reel({ reel, metas = {} }: ReelProps) {
  const { fps } = useVideoConfig();
  const { starts, total } = layout(reel, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {reel.cuts.map((cut, i) => {
        const meta = metas[cut.clip];
        const from = starts[i]!;
        const to = starts[i + 1] ?? total;
        if (!meta) throw new Error(`no clip "${cut.clip}" — capture it: pnpm capture ${cut.clip}`);
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={to - from}
            name={`${i + 1}. ${cut.clip}${cut.word ? ` · ${cut.word}` : ''}`}
          >
            <Shot cut={cut} meta={meta} />
            {cut.word && (
              <Sequence from={Math.round((cut.wordAt ?? 0) * fps)} layout="none">
                <Word text={cut.word} color={cut.color} kicker={cut.kicker} />
              </Sequence>
            )}
            {cut.card && <Card {...cut.card} />}
            {cut.flash && <Flash />}
            {reel.sfx !== false && <CutSfx cut={cut} meta={meta} durationInFrames={to - from} />}
          </Sequence>
        );
      })}
      {/* a soft vignette pulls the eye to the middle, where the action is */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.35) 100%)',
          pointerEvents: 'none',
        }}
      />
      <Fade reel={reel} total={total} />
      {reel.music && (
        <Html5Audio
          src={staticFile(reel.music)}
          // the music fades with the picture
          volume={(f) => 0.55 * (1 - blackAt(f, total, fps, reel.fadeIn, reel.fadeOut))}
          trimBefore={Math.round((reel.musicFrom ?? 0) * fps)}
        />
      )}
    </AbsoluteFill>
  );
}

/** Length from the beat grid; clip metadata fetched once, before the first frame. */
export const reelMetadata: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  const names = [...new Set(props.reel.cuts.map((c) => c.clip))];
  const metas: Record<string, ClipMeta> = {};
  await Promise.all(
    names.map(async (n) => {
      const res = await fetch(staticFile(`clips/${n}.json`));
      if (!res.ok) throw new Error(`no clip "${n}" — capture it: pnpm capture ${n}`);
      metas[n] = await res.json();
    })
  );
  const fps = 60;
  return { durationInFrames: layout(props.reel, fps).total, fps, props: { ...props, metas } };
};
