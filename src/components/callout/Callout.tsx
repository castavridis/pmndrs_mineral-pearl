'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { InkSplat, type InkSplatHandle } from '../ink-splat';
import { Surface } from '../surface/Surface';
import { onInk } from '../theme';
import { useWebGL } from '../gate';
import { calloutKinds, type CalloutKind } from './kinds';
import { nacreKinds } from '../nacre-callout/NacreCallout';
import { getNacreStage } from '../nacre-callout/stage';
import { callout } from './metrics';
import styles from './Callout.module.css';

export interface CalloutProps {
  /**
   * `surface`: the black mineral nacre slab of the page's single stage behind
   * the content (the droplet under the surface, the text refracted through
   * it). `plain`: a calm card on the page's liquid. `svg`: a flat outline,
   * no WebGL. Every variant steps down to what the page can run.
   */
  variant?: 'surface' | 'plain' | 'svg';
  /** GitHub-style kind: sets the symbol inside the lens, the label and the tint. */
  kind?: CalloutKind;
  title: string;
  children: ReactNode;
  /** Maximum card width; the card fills its container up to this (default 560). */
  maxWidth?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A callout: the lens icon in the top-left corner and DOM content. The
 * content is always DOM (accessible, selectable, wraps); only the surface
 * moves. The `surface` variant is drawn by the nacre stage (one WebGL
 * context for every card on the page), the others sit on a `Surface`.
 */
export function Callout({
  variant = 'surface',
  kind = 'note',
  title,
  children,
  maxWidth = callout.width,
  className,
  style,
}: CalloutProps) {
  const k = calloutKinds[kind];
  const n = nacreKinds[kind];
  const webgl = useWebGL();
  const nacre = variant === 'surface' && webgl !== false;
  // The blot is the kind's palette colour, unmuted: it is a mark on the card,
  // not text, so it is not carried toward the page's ink. The icon sitting on
  // it takes whatever reads against it.
  const blotInk = k.hex;
  const onBlot = onInk(blotInk);
  // the label beside it is text, so that one does take the readable ink
  // every callout is mineral on either page for now, so its label takes the
  // ink that reads on mineral
  const tint = k.ink.dark;
  const vars = {
    '--tint': tint,
    '--accent': n.accent,
    '--icon': `${callout.icon}px`,
    '--icon-x': `${callout.iconX}px`,
    '--icon-y': `${callout.iconY}px`,
    '--pad': `${callout.padding}px`,
  } as CSSProperties;

  // the nacre stage draws the slab under this card; the lens is its icon
  // (the accent breathes round it) and the text is its ghost
  const cardRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);

  // The blot behind the lens: the kind's ink, landing at the card's top-left
  // corner when the card scrolls into view. It does not flood — it is a mark
  // under the icon, not a wash over the card.
  const rootRef = useRef<HTMLDivElement>(null);
  const splatRef = useRef<InkSplatHandle>(null);
  useEffect(() => {
    if (webgl === false) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          splatRef.current?.splat();
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [webgl]);
  useEffect(() => {
    const el = cardRef.current;
    if (!nacre || !el) return;
    const stage = getNacreStage();
    if (!stage) return;
    const off = stage.register({ el, icon: lensRef.current, accent: n.accent, dark: true });
    const obs = new MutationObserver(() => stage.refresh());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      obs.disconnect();
      off();
    };
  }, [nacre, n.accent]);

  const inner = (
    <>
      {webgl !== false && (
        <span className={styles.blot} aria-hidden="true">
          <InkSplat
            ref={splatRef}
            preserve
            ink={blotInk}
            logo={false}
            interactive={false}
            flood={false}
            nacre={0.85}
            scale={0.8}
          />
        </span>
      )}
      {/* The kind's symbol, centred in the lens (DOM, so it stays crisp at any size). */}
      <div ref={lensRef} className={styles.lens} style={{ color: onBlot }} aria-hidden="true">
        <svg className={styles.symbol} viewBox="0 0 16 16">
          <path d={n.d} />
        </svg>
      </div>
      <div className={styles.content}>
        <div className={styles.kind} data-ghost>
          {k.label}
        </div>
        <h3 className={styles.title} data-ghost>
          {title}
        </h3>
        <div className={styles.body} data-ghost>
          {children}
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className ?? ''}`}
      style={{ width: '100%', maxWidth, ...vars, ...style }}
    >
      {nacre ? (
        <div ref={cardRef} className={`${styles.card} ${styles.nacre}`} data-variant="surface">
          {inner}
        </div>
      ) : (
        <Surface
          shape="card"
          // mineral on either page for now, as the nacre slab is
          material="mineral"
          radius={callout.radius}
          expressiveness={variant === 'plain' ? 'calm' : 'flat'}
          unit={callout.width * 0.75}
          className={styles.card}
          data-variant={variant}
        >
          {inner}
        </Surface>
      )}
    </div>
  );
}
