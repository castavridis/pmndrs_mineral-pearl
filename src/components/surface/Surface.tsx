'use client';

import type { CSSProperties, ElementType, FC, ReactNode } from 'react';
import { useReducedMotion, useWebGL } from '../gate';
import { useThemeStore } from '../theme';
import { LiquidGround } from '../ink-sink/LiquidGround';
import { InkEngulf } from '../ink-engulf/InkEngulf';
import type { Liquid } from '../ink-sink/liquid-pond';
import styles from './Surface.module.css';

export type SurfaceShape = 'pill' | 'card' | 'key';
export type SurfaceMaterial = Liquid | 'auto';
/**
 * How much the surface moves. `full`: the liquid with the page look's pointer
 * reaction. `calm`: the liquid nearly still, a quarter of the reaction.
 * `flat`: tokens only, no canvas. Reduced motion caps at calm; no WebGL (or
 * the shaders switched off) means flat.
 */
export type SurfaceTier = 'full' | 'calm' | 'flat';

/**
 * The universal exit. `dismiss`: the ground's ink closes over the surface,
 * drains, and the content is gone (`onDone`). `disable`: the ink closes over
 * and stays; the content stays visible, dimmed, and the surface is
 * aria-disabled (unavailable, still findable). `pending`: the same while it
 * lasts; back to `none`, the ink drains and the content is restored.
 */
export type SurfaceExit = 'none' | 'dismiss' | 'disable' | 'pending';

export interface SurfaceProps {
  as?: ElementType;
  exit?: SurfaceExit;
  /** A dismissal has drained and faded; the surface may be unmounted. */
  onDone?: () => void;
  shape?: SurfaceShape;
  material?: SurfaceMaterial;
  expressiveness?: SurfaceTier;
  /** CSS px per unit of the liquid's features; default the surface's height. */
  unit?: number;
  /** Corner radius, px; default by shape (pill round, card 14, key 8). */
  radius?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Dim the content (an unavailable surface). */
  dim?: boolean;
  [attr: string]: unknown;
}

/** The tier a surface really renders at, after the gates. */
export function useSurfaceTier(wanted: SurfaceTier): SurfaceTier {
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const shaders = useThemeStore((s) => s.shaders);
  if (wanted === 'flat' || webgl === false || !shaders) return 'flat';
  if (reduced) return 'calm';
  return wanted;
}

/**
 * The one surface every element sits on: a clipped box in one of three
 * shapes, filled with the page's liquid in one of three tiers of motion. The
 * material is read through the page look, so a preset restyles every
 * surface at once. Content rides above the liquid; the liquid never takes
 * pointer events.
 */
export function Surface({
  as = 'div',
  shape = 'card',
  material = 'auto',
  expressiveness = 'full',
  unit,
  radius: radiusProp,
  className,
  style,
  children,
  dim = false,
  exit = 'none',
  onDone,
  ...rest
}: SurfaceProps) {
  const tier = useSurfaceTier(expressiveness);
  const unavailable = exit === 'disable' || exit === 'pending';
  const engulfed = exit !== 'none';
  const radius = radiusProp ?? (shape === 'pill' ? 999 : shape === 'card' ? 14 : 8);
  const vars = radiusProp !== undefined ? { '--surface-radius': `${radiusProp}px` } : undefined;
  // any intrinsic or component tag; attributes are passed through untyped
  const Tag = as as unknown as FC<Record<string, unknown>>;
  return (
    <Tag
      className={`${styles.surface} ${className ?? ''}`}
      style={vars ? { ...vars, ...style } : style}
      data-shape={shape}
      data-tier={tier}
      aria-disabled={unavailable ? 'true' : undefined}
      data-exit={exit !== 'none' ? exit : undefined}
      {...rest}
    >
      {tier !== 'flat' && (
        <LiquidGround
          liquid={material}
          unit={unit}
          maxDpr={2}
          viscosity={tier === 'calm' ? 1.2 : undefined}
          reaction={tier === 'calm' ? { reaction: 0.25 } : undefined}
        />
      )}
      <InkEngulf
        lazy
        bleed={0}
        radius={Math.min(radius, 200)}
        engulfed={engulfed}
        keep={exit !== 'dismiss'}
        hideContent={exit === 'dismiss'}
        onDone={onDone}
        className={styles.exit}
      >
        <span className={styles.content} data-dim={dim || unavailable || undefined}>
          {children}
        </span>
      </InkEngulf>
    </Tag>
  );
}
