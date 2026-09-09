'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { InkSink, type InkSinkHandle } from '../ink-sink/InkSink';
import { Surface, useSurfaceTier } from '../surface/Surface';
import { announcement } from './metrics';
import styles from './Announcement.module.css';

export interface AnnouncementProps {
  children: ReactNode;
  /** Maximum banner width in px; it fills its container up to this. Default 652. */
  width?: number;
  /**
   * `auto` (default): a slab afloat on the page's liquid where the shaders
   * run, a flat card otherwise. `liquid` and `flat` force one.
   */
  variant?: 'auto' | 'liquid' | 'flat';
  /**
   * Dismissible: a close button. Afloat, the blow sinks the banner into the
   * page and the liquid closes over it; flat, the ink closes over it. Called
   * once it is gone, so it can be unmounted.
   */
  onDismiss?: () => void;
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
  className,
  style,
}: AnnouncementProps) {
  const tier = useSurfaceTier(variant === 'flat' ? 'flat' : 'full');
  const liquid = variant !== 'flat' && tier !== 'flat';
  const sink = useRef<InkSinkHandle>(null);
  // sunk: the slab is under; after a beat the whole thing fades, leaving the
  // ground (the liquid it shows is the ground's, so nothing else changes)
  const [sunk, setSunk] = useState(false);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!sunk) return;
    const t = window.setTimeout(() => setFading(true), 1400);
    return () => window.clearTimeout(t);
  }, [sunk]);
  const [exit, setExit] = useState<'none' | 'dismiss'>('none');

  const content = (
    <div className={styles.content} style={{ minHeight: announcement.height, padding: `16px ${announcement.paddingX}px` }}>
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
        style={{ width: '100%', maxWidth: width, ...style }}
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
      className={`${styles.root} ${className ?? ''}`}
      style={{
        width: `calc(100% + ${announcement.bleed * 2}px)`,
        maxWidth: width + announcement.bleed * 2,
        margin: `${-announcement.bleed}px`,
        opacity: fading ? 0 : 1,
        transition: 'opacity 600ms ease',
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
