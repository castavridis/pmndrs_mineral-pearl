'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { InkSplat, type InkSplatHandle } from '../ink-splat';
import { getFixedGround } from '../ink-sink/grounds';
import { useWebGL } from '../gate';
import { page, useResolvedTheme, useThemeStore } from '../theme';
import styles from './InkEngulf.module.css';

export interface InkEngulfHandle {
  /** Send the ink in. */
  engulf: () => void;
  /** Let a kept (covered) element back up: the ink drains and the content is restored. */
  release: () => void;
}

export type InkEngulfPhase =
  'idle' | 'engulfing' | 'covered' | 'draining' | 'releasing' | 'fading' | 'done';

export interface InkEngulfProps {
  ref?: Ref<InkEngulfHandle>;
  children: ReactNode;
  /** Ink colour when the ink is not the ground; defaults to the page ink of the current scheme. */
  ink?: string;
  /**
   * `ground` (default): the ink samples the page's liquid ground beneath, so
   * the ground reclaims the element; falls back to `ink` when there is no
   * ground or the shaders are off. `ink`: always the colour.
   */
  fill?: 'ground' | 'ink';
  /** Corner radius of the box the ink closes in on, px. Default 14. */
  radius?: number;
  /** Room around the box for spatter, px. Default 48. */
  bleed?: number;
  /** Blot scale relative to the canvas. Default 0.7. */
  scale?: number;
  /** Leave the ink in place once it has covered the content; `release()` lifts it. */
  keep?: boolean;
  /** Hide the content once covered (default). Off, it stays visible under the ink. */
  hideContent?: boolean;
  /** Controlled: true sends the ink in, false (after a keep) releases it. */
  engulfed?: boolean;
  /** Mount the canvas only once something has been engulfed (cheap while idle). */
  lazy?: boolean;
  /** The ink has covered the content. */
  onCovered?: () => void;
  /** The ink has drained and faded after a dismissal; safe to unmount. (At once without WebGL.) */
  onDone?: () => void;
  /** The ink has drained and faded after a release; the content is back. */
  onReleased?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The universal exit: ink closes in from the edges of the content's box,
 * fingers first, droplets flung in ahead of it, until the content is under.
 * With `fill="ground"` the ink is the page's own liquid, so the ground
 * reclaims the element wherever it sits. Then either the ink drains and the
 * spatter fades (a dismissal, `onDone`), or with `keep` it stays until
 * `release()` drains it and gives the content back (`onReleased`). The
 * content keeps its layout box throughout.
 */
export function InkEngulf({
  ref,
  children,
  ink,
  fill = 'ground',
  radius = 14,
  bleed = 48,
  scale = 0.7,
  keep = false,
  hideContent = true,
  engulfed,
  lazy = false,
  onCovered,
  onDone,
  onReleased,
  className,
  style,
}: InkEngulfProps) {
  const theme = useResolvedTheme();
  const inkColor = ink ?? page[theme].ink;
  const shaders = useThemeStore((s) => s.shaders);
  const webgl = useWebGL();
  const splatRef = useRef<InkSplatHandle | null>(null);
  const [phase, setPhase] = useState<InkEngulfPhase>('idle');
  // mirrors for the callbacks and handlers, refreshed after every render
  const phaseRef = useRef(phase);
  const keepRef = useRef(keep);
  const cbs = useRef({ onCovered, onDone, onReleased });
  useEffect(() => {
    phaseRef.current = phase;
    keepRef.current = keep;
    cbs.current = { onCovered, onDone, onReleased };
  });
  // true while the drain under way is a release rather than a dismissal
  const releaseRef = useRef(false);

  // the phase is the request; the effect fires the splat/drain after the
  // commit that mounted the (possibly lazy) canvas. The splat's handle is
  // set in the layout phase, before this runs, and it keeps an early splat()
  // until its scene has registered, so no "mounted" signal is needed (state
  // set from a ref callback kept fiber from ever measuring its canvas).
  useEffect(() => {
    if (phase === 'engulfing') splatRef.current?.splat();
    else if (phase === 'releasing') splatRef.current?.drain();
  }, [phase]);

  const engulf = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    if (webgl === false) {
      // no ink to do it: the content just goes (or is simply held)
      setPhase(keepRef.current ? 'covered' : 'done');
      cbs.current.onCovered?.();
      if (!keepRef.current) cbs.current.onDone?.();
      return;
    }
    setPhase('engulfing');
  }, [webgl]);

  const release = useCallback(() => {
    if (phaseRef.current !== 'covered') return;
    if (webgl === false) {
      setPhase('idle');
      cbs.current.onReleased?.();
      return;
    }
    releaseRef.current = true;
    setPhase('releasing');
  }, [webgl]);
  useImperativeHandle(ref, () => ({ engulf, release }), [engulf, release]);

  // controlled use
  useEffect(() => {
    if (engulfed === undefined) return;
    if (engulfed && phaseRef.current === 'idle') engulf();
    else if (!engulfed && phaseRef.current === 'covered') release();
  }, [engulfed, engulf, release]);

  const onSettle = useCallback(() => {
    setPhase('covered');
    cbs.current.onCovered?.();
    if (!keepRef.current) {
      releaseRef.current = false;
      splatRef.current?.drain();
      setPhase('draining');
    }
  }, []);
  const onDrain = useCallback(() => setPhase('fading'), []);

  const under = phase !== 'idle' && phase !== 'engulfing';
  const hidden = hideContent && under && phase !== 'fading' && phase !== 'releasing';
  const inert = under && phase !== 'releasing' && phase !== 'fading';
  const groundFill = fill === 'ground' && shaders ? (getFixedGround()?.canvas ?? null) : null;
  const canvasWanted = !lazy || phase !== 'idle' || !!engulfed;
  return (
    <div className={`${styles.root} ${className ?? ''}`} style={style} data-phase={phase}>
      <div
        className={styles.content}
        data-hidden={hidden || undefined}
        data-covered={under && !hideContent ? true : undefined}
        aria-hidden={hidden || undefined}
        inert={inert || undefined}
      >
        {children}
      </div>
      {webgl !== false && phase !== 'done' && canvasWanted && (
        <div
          className={styles.canvas}
          style={{ inset: -bleed }}
          data-fading={phase === 'fading' || undefined}
          onTransitionEnd={() => {
            if (phase !== 'fading') return;
            if (releaseRef.current) {
              setPhase('idle');
              cbs.current.onReleased?.();
            } else {
              setPhase('done');
              cbs.current.onDone?.();
            }
          }}
          aria-hidden="true"
        >
          <InkSplat
            ref={splatRef}
            mode="engulf"
            ink={inkColor}
            fillCanvas={groundFill}
            logo={false}
            scale={scale}
            clip={{ inset: bleed, radius }}
            interactive={false}
            onSettle={onSettle}
            onDrain={onDrain}
          />
        </div>
      )}
    </div>
  );
}
