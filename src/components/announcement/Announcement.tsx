'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { InkSink, type InkSinkHandle } from '../ink-sink/InkSink';
import { Surface } from '../surface/Surface';
import { InkSplat, type InkSplatHandle } from '../ink-splat';
import { useWebGL } from '../gate';
import { onInk, useResolvedTheme } from '../theme';
import { calloutKinds, type CalloutKind } from '../callout/kinds';
import type { SinkTier } from '../ink-sink/InkSink';
import { announcement } from './metrics';
import styles from './Announcement.module.css';

export interface AnnouncementProps {
  children: ReactNode;
  /** Maximum banner width in px; it fills its container up to this. Default 652. */
  width?: number;
  /**
   * How the banner floats. `auto` (default) lets the sink pick the best tier
   * the page can run; `liquid`, `swallow` and `quiet` force one of them (see
   * `InkSink`'s `tier`), and `flat` opts out of floating altogether for a
   * plain card whose dismissal is the ink exit.
   */
  variant?: 'auto' | SinkTier | 'flat';
  /**
   * Dismissible: a close button. Afloat, the blow sinks the banner into the
   * page and the liquid closes over it; flat, the ink closes over it. Called
   * once it is gone, so it can be unmounted.
   */
  onDismiss?: () => void;
  /**
   * Announce a kind: a blot of the kind's palette colour lands at the banner's
   * left end when it scrolls into view, with the kind's glyph on it. This is
   * where the ink blot lives now — it is an announcement, not a callout.
   */
  kind?: CalloutKind;
  /** Hold the blot until `ref.splat()`; by default it lands when it scrolls in. */
  blotTrigger?: 'view' | 'manual';
  className?: string;
  style?: CSSProperties;
}

/**
 * A wide banner afloat on the page: the page's liquid ground is the well and
 * the banner is a dry slab on it, tipping under the pointer, and a dismissal
 * is an impact that sinks it into the page. The content is DOM on the slab.
 */
export function Announcement({
  children,
  width = announcement.width,
  variant = 'auto',
  onDismiss,
  kind,
  blotTrigger = 'view',
  className,
  style,
}: AnnouncementProps) {
  // the sink resolves its own tier; only `flat` opts out of floating
  const liquid = variant !== 'flat';
  const sink = useRef<InkSinkHandle>(null);
  // sunk: the slab is under; after a beat the whole thing fades, leaving the
  // ground (the liquid it shows is the ground's, so nothing else changes)
  const [sunk, setSunk] = useState(false);
  const [fading, setFading] = useState(false);
  // the sink says when the liquid has closed over the slab; a backstop keeps
  // a dismissal from hanging if a tier never reports
  useEffect(() => {
    if (!sunk) return;
    const t = window.setTimeout(() => setFading(true), 3000);
    return () => window.clearTimeout(t);
  }, [sunk]);
  const onSunkSettled = (isSunk: boolean) => {
    if (isSunk) setFading(true);
  };

  // The blot: the kind's palette colour, landing at the left end.
  const spec = kind ? calloutKinds[kind] : null;
  const scheme = useResolvedTheme();
  const webgl = useWebGL();
  const blotInk = spec ? spec.ink[scheme] : '#000';
  const splatRef = useRef<InkSplatHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!spec || blotTrigger !== 'view' || webgl === false) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          splatRef.current?.splat();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [spec, blotTrigger, webgl]);

  // Each banner drifts on its own clock, so two on a page never move together.
  const [drift] = useState(() => ({
    dur: `${17 + Math.random() * 9}s`,
    delay: `${-Math.random() * 12}s`,
  }));
  const driftVars = {
    '--drift-dur': drift.dur,
    '--drift-delay': drift.delay,
  } as CSSProperties;

  const blot = spec && webgl !== false && (
    <span className={styles.blot} aria-hidden="true">
      <InkSplat
        ref={splatRef}
        ink={blotInk}
        logo={false}
        interactive={false}
        scale={0.55}
        nacre={0.85}
        flood={false}
      />
      <span className={styles.glyph} style={{ color: onInk(blotInk) }}>
        {spec.glyph}
      </span>
    </span>
  );
  const [exit, setExit] = useState<'none' | 'dismiss'>('none');

  const content = (
    <div
      ref={rootRef}
      className={styles.content}
      data-kind={kind || undefined}
      style={{ minHeight: announcement.height, padding: `16px ${announcement.paddingX}px` }}
    >
      {blot}
      <div className={styles.body}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss announcement"
          onPointerDown={(e) => {
            if (e.button !== 0 || sunk) return;
            sink.current?.impact(e.nativeEvent);
            setSunk(true);
          }}
          onClick={() => {
            if (!liquid) setExit('dismiss');
          }}
        >
          ×
        </button>
      )}
    </div>
  );

  if (!liquid) {
    return (
      <Surface
        shape="card"
        radius={announcement.radius}
        expressiveness="flat"
        exit={exit}
        onDone={onDismiss}
        className={`${styles.root} ${styles.flat} ${className ?? ''}`}
        style={{ width: '100%', maxWidth: width, ...driftVars, ...style }}
      >
        {content}
      </Surface>
    );
  }
  return (
    <InkSink
      ref={sink}
      well
      radius={announcement.radius}
      bleed={announcement.bleed}
      sinkOnClick={false}
      mercuryOnSink={false}
      sunk={sunk}
      tier={variant}
      onSunkSettled={onSunkSettled}
      className={`${styles.root} ${className ?? ''}`}
      style={{
        width: `calc(100% + ${announcement.bleed * 2}px)`,
        maxWidth: width + announcement.bleed * 2,
        margin: `${-announcement.bleed}px`,
        opacity: fading ? 0 : 1,
        transition: 'opacity 600ms ease',
        ...driftVars,
        ...style,
      }}
      onTransitionEnd={() => {
        if (fading) onDismiss?.();
      }}
    >
      {content}
    </InkSink>
  );
}
