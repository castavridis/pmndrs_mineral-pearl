import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Cursor } from './Cursor';
import { EASINGS, type CameraKey, type ClipMeta, type Cut, type CutTime, type Focus } from './edit';

/** The pointer at a clip frame, averaged over a window so a camera can follow it without jitter. */
function smoothCursor(meta: ClipMeta, f: number, window = 18): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = Math.round(f) - window; i <= Math.round(f) + window; i++) {
    const c = meta.cursor[Math.min(Math.max(i, 0), meta.cursor.length - 1)];
    if (!c) continue;
    x += c[0];
    y += c[1];
    n++;
  }
  return n ? [x / n, y / n] : [meta.viewport.width / 2, meta.viewport.height / 2];
}

function resolveFocus(focus: Focus | undefined, meta: ClipMeta, clipFrame: number): [number, number] {
  const { width, height } = meta.viewport;
  if (!focus || focus === 'center') return [width / 2, height / 2];
  if (focus === 'cursor') return smoothCursor(meta, clipFrame);
  if (typeof focus === 'string' && focus.startsWith('track:')) {
    const name = focus.slice('track:'.length);
    const track = meta.tracks?.[name];
    if (!track) throw new Error(`clip "${meta.name}" tracked no "${name}"`);
    // the box as it stands on this frame; where it is absent, the nearest frame that has it
    const f = Math.min(Math.max(Math.round(clipFrame), 0), track.length - 1);
    for (let d = 0; d < track.length; d++) {
      const r = track[f - d] ?? track[f + d];
      if (r) return [r[0] + r[2] / 2, r[1] + r[3] / 2];
    }
    return [width / 2, height / 2];
  }
  if (typeof focus === 'string') {
    const name = focus.slice('mark:'.length);
    const r = meta.marks.find((m) => m.name === name)?.rect;
    if (!r) throw new Error(`clip "${meta.name}" has no mark "${name}" with a rect`);
    return [r.x + r.width / 2, r.y + r.height / 2];
  }
  return focus;
}

/** A CutTime in seconds into the cut: a number, or a mark with an optional offset ('flood+0.4'). */
export function cutTime(t: CutTime, cut: Cut, meta: ClipMeta): number {
  if (typeof t === 'number') return t;
  const m = /^([\w-]+?)([+-]\d*\.?\d+)?$/.exec(t.trim());
  const mark = m && meta.marks.find((k) => k.name === m[1]);
  if (!m || !mark) throw new Error(`clip "${meta.name}" has no mark for "${t}"`);
  return (mark.frame / meta.fps - cut.from) / (cut.rate ?? 1) + Number(m[2] ?? 0);
}

/** Zoom and focus at `t` seconds into the cut, eased between keys. */
function cameraAt(
  cut: Cut,
  t: number,
  meta: ClipMeta,
  clipFrame: number,
  frameWidth: number,
  cover: number
) {
  // a span (page px across the frame) is a zoom by another name
  const zoomOf = (k: CameraKey) => (k.span ? frameWidth / (cover * k.span) : (k.zoom ?? 1));
  const ks = (cut.camera?.length ? cut.camera : [{ t: 0, zoom: 1 }]).map((k) => ({
    ...k,
    at: cutTime(k.t, cut, meta),
  }));
  let a = ks[0]!;
  let b = ks[0]!;
  for (const k of ks) {
    if (k.at <= t) a = k;
    if (k.at >= t) {
      b = k;
      break;
    }
    b = k;
  }
  const span = b.at - a.at;
  const u = span > 0 ? EASINGS[b.ease ?? 'inOut'](Math.min(Math.max((t - a.at) / span, 0), 1)) : 1;
  const fa = resolveFocus(a.focus, meta, clipFrame);
  const fb = resolveFocus(b.focus, meta, clipFrame);
  // zoom runs in log space: every doubling takes the same share of the move,
  // so a push in reads as one even glide rather than a lurch at the far end
  const za = Math.log(zoomOf(a));
  const zb = Math.log(zoomOf(b));
  return {
    zoom: Math.exp(za + (zb - za) * u),
    focus: [fa[0] + (fb[0] - fa[0]) * u, fa[1] + (fb[1] - fa[1]) * u] as [number, number],
  };
}

/** A kick of extra zoom after each press in the footage, and on the cut itself. */
function punchAt(meta: ClipMeta, clipFrame: number, localFrame: number, fps: number) {
  let p = 0.05 * Math.exp(-localFrame / (0.09 * fps)); // every cut lands a little hot
  const f = Math.floor(clipFrame);
  for (let i = Math.max(1, f - 40); i <= f; i++) {
    if (meta.cursor[i]?.[2] && !meta.cursor[i - 1]?.[2]) {
      const since = (clipFrame - i) / fps;
      // quick attack, slow release
      p += 0.06 * Math.min(1, since / 0.04) * Math.exp(-since / 0.18);
    }
  }
  return p;
}

export function Shot({ cut, meta }: { cut: Cut; meta: ClipMeta }) {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const rate = cut.rate ?? 1;
  const t = frame / fps;
  // the footage frame on screen (clip and reel share a frame rate: 60)
  const clipFrame = Math.min(cut.from * meta.fps + frame * rate * (meta.fps / fps), meta.frames - 1);

  const vw = meta.viewport.width;
  const vh = meta.viewport.height;
  const cover = Math.max(W / vw, H / vh);
  const cam = cameraAt(cut, t, meta, clipFrame, W, cover);
  const punch = cut.punch === false ? 0 : punchAt(meta, clipFrame, frame, fps);
  const s = cover * cam.zoom * (1 + punch);

  // The focus lands at `frameAt` on screen, but the frame never leaves the
  // page: along each axis, the page's offset on screen.
  const [ax, ay] = cut.frameAt ?? (cut.word ? [0.57, 0.4] : [0.5, 0.5]);
  const place = (focus: number, at: number, screen: number, page: number) => {
    const span = screen / s; // page px across the screen
    if (span >= page) return (screen - page * s) / 2; // all of it fits: centre it
    const c = Math.min(Math.max(focus, at * span), page - (1 - at) * span);
    return at * screen - c * s;
  };

  let shakeX = 0;
  let shakeY = 0;
  if (cut.shake !== undefined && t >= cut.shake) {
    const since = t - cut.shake;
    const amp = 22 * Math.exp(-since / 0.12);
    shakeX = Math.sin(since * 83) * amp;
    shakeY = Math.cos(since * 61) * amp * 0.7;
  }

  const left = place(cam.focus[0], ax, W, vw) + shakeX;
  const top = place(cam.focus[1], ay, H, vh) + shakeY;
  const toScreen = (x: number, y: number): [number, number] => [left + x * s, top + y * s];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(`clips/${meta.name}.mp4`)}
        trimBefore={Math.round(cut.from * meta.fps)}
        playbackRate={rate}
        muted
        style={{ position: 'absolute', left, top, width: vw * s, height: vh * s, maxWidth: 'none' }}
      />
      {cut.cursor !== false && (
        <Cursor
          meta={meta}
          clipFrame={clipFrame}
          toScreen={toScreen}
          scale={s}
          soft={cut.cursorStyle === 'soft'}
        />
      )}
    </AbsoluteFill>
  );
}
