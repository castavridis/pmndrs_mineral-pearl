'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { InkSink, type InkSinkHandle } from '../ink-sink/InkSink';
import { Surface } from '../surface/Surface';
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
  className?: string;
  style?: CSSProperties;
}

/** The layer's fade, and the close of the room it held. Both are CSS above. */
const FADE_MS = 600;
const COLLAPSE_MS = 460;

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
  // the sink resolves its own tier; only `flat` opts out of floating
  const liquid = variant !== 'flat';
  const sink = useRef<InkSinkHandle>(null);
  // dismissed: the slab is under for good; after a beat the whole thing fades,
  // leaving the ground (the liquid it shows is the ground's, so nothing else
  // changes)
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);
  // The banner starts under the surface and comes up once two things are
  // true: the page is ready (`load` and the web fonts, with a backstop in case
  // either never resolves), and the liquid is actually drawing. The second
  // matters — a well waits for the page's ground before it builds its pond,
  // and a rise spent before that is a rise nobody sees.
  const [surfaced, setSurfaced] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [sinkReady, setSinkReady] = useState(false);
  useEffect(() => {
    if (!liquid) return;
    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      setPageReady(true);
    };
    const backstop = window.setTimeout(mark, 1500);
    const loaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((res) => window.addEventListener('load', () => res(), { once: true }));
    Promise.all([loaded, document.fonts?.ready ?? Promise.resolve()])
      .then(mark)
      .catch(mark);
    return () => {
      done = true;
      window.clearTimeout(backstop);
    };
  }, [liquid]);
  useEffect(() => {
    if (!liquid || !pageReady || !sinkReady) return;
    // a beat under the surface, long enough to be seen as submerged, before it
    // comes up
    const t = window.setTimeout(() => setSurfaced(true), 450);
    return () => window.clearTimeout(t);
  }, [liquid, pageReady, sinkReady]);
  // the sink says when the liquid has closed over the slab; a backstop keeps
  // a dismissal from hanging if a tier never reports
  useEffect(() => {
    if (!dismissed) return;
    const t = window.setTimeout(() => setFading(true), 3000);
    return () => window.clearTimeout(t);
  }, [dismissed]);
  // it settles under twice — once on load, once for good — and only the
  // second is a dismissal
  const onSunkSettled = (isSunk: boolean) => {
    if (isSunk && dismissed) setFading(true);
  };

  // The liquid has closed and the layer has faded; now the room it took has to
  // close as well. The slot is pinned to the height it has, given a frame to
  // take that as a starting number, and run to zero — a height transition needs
  // a number at both ends. `onDismiss` follows, so the parent unmounts a banner
  // that is already gone rather than one that pops out from under the page.
  const slotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fading) return;
    const el = slotRef.current;
    if (!el) return;
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        el.style.height = `${el.offsetHeight}px`;
        timers.push(
          window.setTimeout(() => {
            el.style.height = '0px';
            timers.push(window.setTimeout(() => onDismiss?.(), COLLAPSE_MS + 40));
          }, 20)
        );
      }, FADE_MS)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [fading, onDismiss]);

  // Each banner drifts on its own clock, so two on a page never move together.
  const [drift] = useState(() => ({
    dur: `${17 + Math.random() * 9}s`,
    delay: `${-Math.random() * 12}s`,
  }));
  const driftVars = {
    '--drift-dur': drift.dur,
    '--drift-delay': drift.delay,
  } as CSSProperties;

  // the flat card's dismissal is the ink exit rather than a sinking
  const [exit, setExit] = useState<'none' | 'dismiss'>('none');

  const content = (
    <div
      className={styles.content}
      style={{ minHeight: announcement.height, padding: `16px ${announcement.paddingX}px` }}
      // a click anywhere on the banner is a load at that point: the slab tips
      // until the spot under the finger is under the liquid. The dismissal is
      // its own, heavier blow, so it is left alone.
      onPointerDown={(e) => {
        if (!liquid || dismissed || e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button[aria-label="Dismiss announcement"]')) return;
        sink.current?.press(e.nativeEvent);
      }}
    >
      <div className={styles.body}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss announcement"
          onPointerDown={(e) => {
            if (e.button !== 0 || dismissed) return;
            sink.current?.impact(e.nativeEvent);
            setDismissed(true);
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
    <div ref={slotRef} className={styles.slot}>
      <InkSink
        ref={sink}
        well
        radius={announcement.radius}
        bleed={announcement.bleed}
        sinkOnClick={false}
        mercuryOnSink={false}
        /* The swallow, as the card afloat on the study's pond has it: big,
           dense droplets that heap above the surface and are lit, rather than
           the flat coverage a page-sized well would otherwise give. In a well
           the unit is the ground's (420 px), so a droplet sized for a pond
           panel reads as a speck against a 652 px banner; `globSize` is the
           only scale that is the mass's own and not the ground's. */
        globSize={1.6}
        globDensity={0.9}
        globHeight={0.8}
        globSettle={1.1}
        globShading
        // the press drives the point under the finger this far down; the slab
        // gives a little as a whole and tips about its centre for the rest
        pressDepth={-0.12}
        sunk={dismissed || !surfaced}
        tier={variant}
        onSunkSettled={onSunkSettled}
        onReady={() => setSinkReady(true)}
        className={`${styles.root} ${className ?? ''}`}
        style={{
          width: `calc(100% + ${announcement.bleed * 2}px)`,
          maxWidth: width + announcement.bleed * 2,
          margin: `${-announcement.bleed}px`,
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ease`,
          ...driftVars,
          ...style,
        }}
      >
        {content}
      </InkSink>
    </div>
  );
}
