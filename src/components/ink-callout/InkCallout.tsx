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
import { useWebGL } from '../gate';
import { onInk, useResolvedTheme } from '../theme';
import { calloutKinds, type CalloutKind } from './kinds';
import styles from './InkCallout.module.css';

export interface InkCalloutProps {
  ref?: Ref<InkSplatHandle>;
  /** GitHub-style kind: sets the label, the glyph and the ink colour. Default `note`. */
  kind?: CalloutKind;
  title: string;
  children: ReactNode;
  /** `view` (default) splats when the card scrolls into view; `manual` waits for `ref.splat()`. */
  trigger?: 'view' | 'manual';
  /** Maximum card width; the card fills its container up to this. Default 560. */
  maxWidth?: number | string;
  /** Corner radius of the card and of the flood, px. Default 14. */
  radius?: number;
  /** Force the no-WebGL look: a solid card, no ink. */
  static?: boolean;
  /** Room around the card for droplets to land in, px. Default 64. */
  bleed?: number;
  /** Blot scale relative to the canvas. Default 0.65. */
  scale?: number;
  /** Surface tension and iridescence on the ink, 0..1. Default 0.8. */
  nacre?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A callout whose surface is ink. The content is DOM (accessible, selectable,
 * wraps) over a canvas that covers the card plus a bleed; when triggered the
 * ink lands on the card and floods it out to its rounded edge, with the
 * spatter left lying around it. Until then the card is an outline, as the
 * traced fallbacks are in the nav.
 */
export function InkCallout({
  ref,
  kind = 'note',
  title,
  children,
  trigger = 'view',
  maxWidth = 560,
  radius = 14,
  static: forceStatic = false,
  bleed = 64,
  scale = 0.65,
  nacre = 0.8,
  className,
  style,
}: InkCalloutProps) {
  const spec = calloutKinds[kind];
  const theme = useResolvedTheme();
  const ink = spec.ink[theme];
  const webgl = useWebGL();
  const isStatic = forceStatic || webgl === false;

  const splatRef = useRef<InkSplatHandle>(null);
  useImperativeHandle(
    ref,
    () => ({
      splat: () => splatRef.current?.splat(),
      drain: () => splatRef.current?.drain(),
    }),
    []
  );

  // `inked` from the impact on (the text switches to the on-ink colour),
  // `covered` once the flood has reached the card edge (the outline goes)
  const [inked, setInked] = useState(false);
  const [covered, setCovered] = useState(false);
  const onSplat = useCallback(() => {
    setInked(true);
    setCovered(false);
  }, []);
  const onSettle = useCallback(() => setCovered(true), []);

  // splat the first time half the card is on screen
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (trigger !== 'view' || isStatic) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          splatRef.current?.splat();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [trigger, isStatic]);

  const vars = { '--ink': ink, '--on-ink': onInk(ink), '--radius': `${radius}px` } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className ?? ''}`}
      style={{ maxWidth, ...vars, ...style }}
    >
      {!isStatic && (
        <div className={styles.canvas} style={{ inset: -bleed }} aria-hidden="true">
          <InkSplat
            ref={splatRef}
            ink={ink}
            logo={false}
            scale={scale}
            nacre={nacre}
            clip={{ inset: bleed, radius }}
            interactive={false}
            onSplat={onSplat}
            onSettle={onSettle}
          />
        </div>
      )}
      <div
        className={styles.card}
        data-inked={inked || undefined}
        data-covered={covered || undefined}
        data-static={isStatic || undefined}
      >
        <div className={styles.kind}>
          <span className={styles.glyph} aria-hidden="true">
            {spec.glyph}
          </span>
          {spec.label}
        </div>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
