'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { useResolvedTheme, useThemeStore } from '../theme';
import { usePageLook } from '../theme/look';
import { useWebGL } from '../gate';
import { registerGround } from './grounds';
import {
  LiquidPond,
  MERCURY_DEFAULT,
  MINERAL_DEFAULT,
  PEARL_DEFAULT,
  POINTER_DEFAULT,
  POND_BG,
  SPECTRUM_DEFAULT,
  type Liquid,
  type MercuryLook,
  type MineralLook,
  type PearlLook,
  type PointerLook,
  type SpectrumLook,
} from './liquid-pond';

export interface LiquidGroundProps {
  /** `auto` (default): mineral on the dark scheme, pearl on the light. */
  liquid?: Liquid | 'auto';
  /** Fill the viewport behind the page (fixed, behind content). Otherwise fill the parent. */
  fixed?: boolean;
  /** Where the pointer is read from: the whole window (default when fixed) or this element. */
  pointer?: 'window' | 'self';
  /** Cap on device pixel ratio; the shader is heavy, so the ground defaults to 1. */
  maxDpr?: number;
  viscosity?: number;
  mineral?: Partial<MineralLook>;
  pearl?: Partial<PearlLook>;
  mercury?: Partial<MercuryLook>;
  spectrum?: Partial<SpectrumLook>;
  reaction?: Partial<PointerLook>;
  className?: string;
  style?: CSSProperties;
}

/**
 * The study's liquid with no slab: the ground the page stands on, or the
 * surface of a nav pill. It drifts on its own, dents under the pointer and
 * sheds a wake when the pointer is dragged across it.
 */
export function LiquidGround({
  liquid = 'auto',
  fixed = false,
  pointer = fixed ? 'window' : 'self',
  maxDpr = fixed ? 1 : 2,
  viscosity,
  mineral,
  pearl,
  mercury,
  spectrum,
  reaction,
  className,
  style,
}: LiquidGroundProps) {
  // the page look is the default; a prop on this ground wins over it
  const look = usePageLook();
  const visc = viscosity ?? look.viscosity;
  const merged = () => ({
    mineral: { ...MINERAL_DEFAULT, ...look.mineral, ...mineral },
    pearl: { ...PEARL_DEFAULT, ...look.pearl, ...pearl },
    mercury: { ...MERCURY_DEFAULT, ...look.mercury, ...mercury },
    spectrum: { ...SPECTRUM_DEFAULT, ...look.spectrum, ...spectrum },
    pointer: { ...POINTER_DEFAULT, ...look.pointer, ...reaction },
  });
  const theme = useResolvedTheme();
  const liq: Liquid = liquid === 'auto' ? (theme === 'dark' ? 'mineral' : 'pearl') : liquid;
  const shaders = useThemeStore((s) => s.shaders);
  const webgl = useWebGL();
  const live = shaders && webgl !== false;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pondRef = useRef<LiquidPond | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || !live) return;
    const pond = new LiquidPond(host, canvas, null, {
      liquid: liq,
      viscosity: visc,
      mercuryOnSink: false,
      globSize: 1,
      globDensity: 0.5,
      globHeight: 0,
      globShading: false,
      radius: 0,
      maxDpr,
      // the fixed ground is read back by the theme transition's splat
      preserveDrawingBuffer: fixed,
      ...merged(),
    });
    pondRef.current = pond;
    // only a scheme-following ground takes part in the theme's masked switch
    const unregister = liquid === 'auto' ? registerGround(pond) : () => {};
    const target: GlobalEventHandlers = pointer === 'window' ? window : host;
    const move = (e: Event) => pond.point(e as PointerEvent);
    const leave = () => pond.leave();
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerdown', move);
    target.addEventListener('pointerleave', leave);
    return () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerdown', move);
      target.removeEventListener('pointerleave', leave);
      unregister();
      pond.destroy();
      pondRef.current = null;
    };
    // built once per shaders state; options are pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(() => {
    const pond = pondRef.current;
    if (!pond) return;
    pond.opts.viscosity = visc;
    pond.opts.maxDpr = maxDpr;
    Object.assign(pond.opts, merged());
    pond.setLiquid(liq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liq, visc, maxDpr, look, mineral, pearl, mercury, spectrum, reaction]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden="true"
      style={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        zIndex: fixed ? -1 : 0,
        overflow: 'hidden',
        background: POND_BG[liq],
        pointerEvents: 'none',
        ...style,
      }}
    >
      {live && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        />
      )}
    </div>
  );
}
