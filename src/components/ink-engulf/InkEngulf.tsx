'use client';

import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { InkSplat, type InkSplatHandle } from '../ink-splat';
import { useWebGL } from '../gate';
import { page, useResolvedTheme } from '../theme';
import styles from './InkEngulf.module.css';

export interface InkEngulfHandle {
  /** Send the ink in. */
  engulf: () => void;
}

export type InkEngulfPhase = 'idle' | 'engulfing' | 'covered' | 'draining' | 'fading' | 'done';

export interface InkEngulfProps {
  ref?: Ref<InkEngulfHandle>;
  children: ReactNode;
  /** Ink colour; defaults to the page ink of the current scheme. */
  ink?: string;
  /** Corner radius of the box the ink closes in on, px. Default 14. */
  radius?: number;
  /** Room around the box for spatter, px. Default 48. */
  bleed?: number;
  /** Leave the ink in place once it has covered the content instead of draining. */
  keep?: boolean;
  /** Blot scale relative to the canvas. Default 0.7. */
  scale?: number;
  /** The ink has covered the content; the content is hidden from here on. */
  onCovered?: () => void;
  /** The ink has drained and faded; safe to unmount. (Fires at once without WebGL.) */
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The inverse of the callout: ink closes in from the edges of the content's
 * box, fingers first, droplets flung in ahead of it, until the content is
 * drowned. The content is then hidden, the ink withdraws to where it came
 * from, and the spatter fades. The content keeps its layout box the whole
 * time; the parent decides what happens to the space in `onDone`.
 */
export function InkEngulf({
  ref,
  children,
  ink,
  radius = 14,
  bleed = 48,
  keep = false,
  scale = 0.7,
  onCovered,
  onDone,
  className,
  style,
}: InkEngulfProps) {
  const theme = useResolvedTheme();
  const inkColor = ink ?? page[theme].ink;
  const webgl = useWebGL();
  const splatRef = useRef<InkSplatHandle>(null);
  const [phase, setPhase] = useState<InkEngulfPhase>('idle');

  const engulf = useCallback(() => {
    if (webgl === false) {
      // no ink to do it: the content just goes
      setPhase('done');
      onCovered?.();
      onDone?.();
      return;
    }
    splatRef.current?.splat();
    setPhase('engulfing');
  }, [webgl, onCovered, onDone]);
  useImperativeHandle(ref, () => ({ engulf }), [engulf]);

  const onSettle = useCallback(() => {
    setPhase('covered');
    onCovered?.();
    if (!keep) {
      splatRef.current?.drain();
      setPhase('draining');
    }
  }, [keep, onCovered]);
  const onDrain = useCallback(() => setPhase('fading'), []);

  const hidden = phase !== 'idle' && phase !== 'engulfing';
  return (
    <div className={`${styles.root} ${className ?? ''}`} style={style}>
      <div
        className={styles.content}
        data-hidden={hidden || undefined}
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
      >
        {children}
      </div>
      {webgl !== false && phase !== 'done' && (
        <div
          className={styles.canvas}
          style={{ inset: -bleed }}
          data-fading={phase === 'fading' || undefined}
          onTransitionEnd={() => {
            if (phase === 'fading') {
              setPhase('done');
              onDone?.();
            }
          }}
          aria-hidden="true"
        >
          <InkSplat
            ref={splatRef}
            mode="engulf"
            ink={inkColor}
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
