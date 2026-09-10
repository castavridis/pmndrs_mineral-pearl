import { Html5Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { ClipMeta, Cut } from './edit';

/** Frames (within the cut) at which the footage shows a press. */
export function pressesIn(cut: Cut, meta: ClipMeta, durationInFrames: number) {
  const rate = cut.rate ?? 1;
  const first = cut.from * meta.fps;
  const out: number[] = [];
  meta.cursor.forEach((c, i) => {
    if (!c[2] || meta.cursor[i - 1]?.[2]) return;
    const local = (i - first) / rate;
    if (local >= 0 && local < durationInFrames) out.push(Math.round(local));
  });
  return out;
}

const Hit = ({ at, src, volume = 1 }: { at: number; src: string; volume?: number }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={120} layout="none">
    <Html5Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

/** The sound design a cut implies: clicks where the pointer presses, impacts, a whoosh in. */
export function CutSfx({
  cut,
  meta,
  durationInFrames,
}: {
  cut: Cut;
  meta: ClipMeta;
  durationInFrames: number;
}) {
  const { fps } = useVideoConfig();
  return (
    <>
      {pressesIn(cut, meta, durationInFrames).map((f) => (
        <Hit key={`c${f}`} at={f} src="sfx/click.wav" volume={0.5} />
      ))}
      {cut.shake !== undefined && (
        <Hit at={Math.round(cut.shake * fps)} src="sfx/impact.wav" volume={0.5} />
      )}
      {cut.hit !== undefined && (
        <Hit at={Math.round(cut.hit * fps)} src="sfx/impact.wav" volume={0.45} />
      )}
      {cut.whoosh && <Hit at={0} src="sfx/whoosh.wav" volume={0.4} />}
    </>
  );
}
