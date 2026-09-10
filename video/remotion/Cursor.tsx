import { palette, type ClipMeta } from './edit';

const RIPPLE_FRAMES = 22;
/** The soft style: a ring that opens slowly and barely shows. */
const SOFT_RIPPLE_FRAMES = 40;

/**
 * The recorded pointer, drawn over the footage (a headless capture has none):
 * a clean arrow that grows with the camera, dips on a press, and throws a
 * ring of the brand's green where it clicks — or, `soft`, barely dips and
 * leaves a faint white ring that opens slowly.
 */
export function Cursor({
  meta,
  clipFrame,
  toScreen,
  scale,
  soft = false,
}: {
  meta: ClipMeta;
  clipFrame: number;
  toScreen: (x: number, y: number) => [number, number];
  scale: number;
  soft?: boolean;
}) {
  const rippleFrames = soft ? SOFT_RIPPLE_FRAMES : RIPPLE_FRAMES;
  const i = Math.min(Math.max(Math.round(clipFrame), 0), meta.cursor.length - 1);
  const c = meta.cursor[i];
  if (!c) return null;
  const [x, y] = toScreen(c[0], c[1]);
  const size = Math.min(Math.max(19 * scale, 26), 58);
  const pressed = c[2] === 1;

  const ripples: { x: number; y: number; age: number }[] = [];
  for (let k = Math.max(1, i - rippleFrames); k <= i; k++) {
    const p = meta.cursor[k]!;
    if (p[2] && !meta.cursor[k - 1]![2]) {
      const [rx, ry] = toScreen(p[0], p[1]);
      ripples.push({ x: rx, y: ry, age: (clipFrame - k) / rippleFrames });
    }
  }

  return (
    <>
      {ripples.map((r, n) => {
        const radius = soft
          ? size * (0.35 + 0.9 * (1 - (1 - r.age) ** 2))
          : size * (0.3 + 1.6 * (1 - (1 - r.age) ** 3));
        return (
          <div
            key={n}
            style={{
              position: 'absolute',
              left: r.x - radius,
              top: r.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: '50%',
              border: soft
                ? `1.5px solid rgba(255, 255, 255, 0.9)`
                : `${Math.max(2, size * 0.12 * (1 - r.age))}px solid ${palette.green}`,
              opacity: soft ? 0.45 * (1 - r.age) ** 1.5 : 1 - r.age,
              boxShadow: soft ? '0 0 6px rgba(0, 0, 0, 0.25)' : undefined,
            }}
          />
        );
      })}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x - size * 0.2,
          top: y - size * 0.12,
          transform: `scale(${pressed ? (soft ? 0.95 : 0.86) : 1})`,
          transformOrigin: '20% 12%',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))',
          overflow: 'visible',
        }}
      >
        <path
          d="M4.8 2.9 19.2 13.7c.7.5.4 1.6-.5 1.7l-6.2.6 3.4 6.4c.3.5.1 1.1-.5 1.4l-1.8.9c-.5.3-1.1.1-1.4-.5l-3.3-6.5-4.4 4.3c-.6.6-1.7.2-1.7-.7V3.6c0-.8.9-1.2 1.5-.7Z"
          fill="#fff"
          stroke="#111"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
