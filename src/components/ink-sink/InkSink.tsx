'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { useResolvedTheme } from '../theme';
import { usePageLook } from '../theme/look';
import {
  LiquidPond,
  MERCURY_DEFAULT,
  MINERAL_DEFAULT,
  PEARL_DEFAULT,
  POINTER_DEFAULT,
  POND_BG,
  SLAB_LOOK,
  SPECTRUM_DEFAULT,
  type Liquid,
  type MercuryLook,
  type MineralLook,
  type PearlLook,
  type PointerLook,
  type SpectrumLook,
} from './liquid-pond';
import styles from './InkSink.module.css';

export interface InkSinkHandle {
  /** Let the content go under. It stays there until `rise()`. */
  sink: () => void;
  /** Bring it back up; the ink slides off and thins away as it bobs up. */
  rise: () => void;
  /** A press: a beat under with a splash, then it bobs back. */
  press: () => void;
}

export interface InkSinkProps {
  ref?: Ref<InkSinkHandle>;
  children: ReactNode;
  /**
   * `mineral` (dark, glittering), `pearl` (cream nacre) or `mercury`.
   * `auto` (default) picks mineral on the dark scheme and pearl on the light.
   */
  liquid?: Liquid | 'auto';
  /** 0.15..2, lower = faster, less damped. Default 0.4. */
  viscosity?: number;
  /** Mineral or pearl turn to mercury as the slab goes under. Default true. */
  mercuryOnSink?: boolean;
  /** Droplet size, density (0..1) and heap height of the swallow. */
  globSize?: number;
  globDensity?: number;
  globHeight?: number;
  /** Shade the ink mass (sheen and lip). Default false: pure coverage. */
  globShading?: boolean;
  /** The mineral body's colours and strengths; defaults are the study's. */
  mineral?: Partial<MineralLook>;
  /** The pearl (nacre) body's colours and strengths; defaults are the study's. */
  pearl?: Partial<PearlLook>;
  /** Iridescence and facet glitter shared by every body; defaults are the study's. */
  spectrum?: Partial<SpectrumLook>;
  /** How much the liquid and the slab answer the pointer; all 1 in the study. */
  pointer?: Partial<PointerLook>;
  /** Quicksilver's reflection colours and strengths; defaults are the study's. */
  mercury?: Partial<MercuryLook>;
  /** Corner radius of the slab and the pond, px. Default 16. */
  radius?: number;
  /** Liquid around the content, px. Default 96. */
  bleed?: number;
  /** Start (or become) sunk. Uncontrolled when omitted; use the ref. */
  sunk?: boolean;
  /** Reported when a click sinks or raises the slab, so a controlled `sunk` can follow. */
  onSunkChange?: (sunk: boolean) => void;
  /** A click on the content is an impact that sinks it there; a click when sunk raises it. Default true. */
  sinkOnClick?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The content floats as a slab on a thin, heavy liquid, the pond from the
 * "Liquid Button Ink" study. Hover and it tips under the pointer like a plank
 * with a ball on it. `sink()` and it goes under with a splash: droplets burst
 * from its rim, fly, strand and pinch off, then are drawn back onto it and
 * merge until the mass has closed over it. `rise()` and they slide off and
 * thin away as it bobs back up. The content is real DOM riding on the slab,
 * seen through a hole the liquid layer leaves where the face is still dry:
 * as the slab sinks the surface closes over it, ripples first, until nothing
 * of it is left dry, and it recedes into the ground beneath.
 */
export function InkSink({
  ref,
  children,
  liquid = 'auto',
  viscosity,
  mercuryOnSink = true,
  globSize = 1,
  globDensity = 0.5,
  globHeight = 0,
  globShading = false,
  mineral,
  pearl,
  spectrum,
  pointer,
  mercury,
  radius = 16,
  bleed = 96,
  sunk,
  onSunkChange,
  sinkOnClick = true,
  className,
  style,
}: InkSinkProps) {
  const theme = useResolvedTheme();
  const liq: Liquid = liquid === 'auto' ? (theme === 'dark' ? 'mineral' : 'pearl') : liquid;
  // the page look is the default; a prop on this pond wins over it
  const look = usePageLook();
  const visc = viscosity ?? look.viscosity;
  const merged = () => ({
    mineral: { ...MINERAL_DEFAULT, ...look.mineral, ...mineral },
    pearl: { ...PEARL_DEFAULT, ...look.pearl, ...pearl },
    mercury: { ...MERCURY_DEFAULT, ...look.mercury, ...mercury },
    spectrum: { ...SPECTRUM_DEFAULT, ...look.spectrum, ...spectrum },
    pointer: { ...POINTER_DEFAULT, ...look.pointer, ...pointer },
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const pondRef = useRef<LiquidPond | null>(null);
  // uncontrolled state; a `sunk` prop wins when given
  const [ownSunk, setIsSunk] = useState(false);
  const isSunk = sunk ?? ownSunk;
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const slab = slabRef.current;
    if (!host || !canvas || !slab) return;
    const pond = new LiquidPond(host, canvas, slab, {
      liquid: liq,
      viscosity: visc,
      mercuryOnSink,
      globSize,
      globDensity,
      globHeight,
      globShading,
      radius,
      maxDpr: 2,
      ...merged(),
    });
    pond.face = faceRef.current;
    pondRef.current = pond;
    return () => {
      pond.destroy();
      pondRef.current = null;
    };
    // the pond is built once; options are pushed into it below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pond = pondRef.current;
    if (!pond) return;
    pond.opts.viscosity = visc;
    pond.opts.mercuryOnSink = mercuryOnSink;
    pond.opts.globSize = globSize;
    pond.opts.globDensity = globDensity;
    pond.opts.globHeight = globHeight;
    pond.opts.globShading = globShading;
    pond.opts.radius = radius;
    Object.assign(pond.opts, merged());
    pond.setLiquid(liq);
    // merged() reads the look and the props listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liq,
    visc,
    mercuryOnSink,
    globSize,
    globDensity,
    globHeight,
    globShading,
    radius,
    look,
    mineral,
    pearl,
    spectrum,
    pointer,
    mercury,
  ]);

  useEffect(() => {
    const pond = pondRef.current;
    if (pond && pond.sunk !== isSunk) pond.sunk = isSunk;
  }, [isSunk]);

  useImperativeHandle(
    ref,
    () => ({
      sink: () => setIsSunk(true),
      rise: () => setIsSunk(false),
      press: () => pondRef.current?.press(),
    }),
    []
  );

  const onSlabPointerDown = (e: React.PointerEvent) => {
    const pond = pondRef.current;
    if (!sinkOnClick || !pond || e.button !== 0) return;
    if (isSunk) {
      setIsSunk(false);
      onSunkChange?.(false);
      return;
    }
    // the pond takes the blow now; React's state follows so a re-render
    // doesn't undo it
    pond.impact(pond.uv(e.nativeEvent));
    setIsSunk(true);
    onSunkChange?.(true);
  };

  const vars = {
    '--pond-radius': `${radius}px`,
    '--pond-bg': POND_BG[liq],
    '--slab-bg': SLAB_LOOK[liq].bg,
    '--slab-fg': SLAB_LOOK[liq].fg,
  } as CSSProperties;
  return (
    <div
      ref={hostRef}
      className={`${styles.root} ${className ?? ''}`}
      style={{ padding: bleed, ...vars, ...style }}
      onPointerMove={(e) => pondRef.current?.point(e.nativeEvent)}
      onPointerDown={(e) => pondRef.current?.point(e.nativeEvent)}
      onPointerLeave={() => pondRef.current?.leave()}
      onFocus={() => pondRef.current?.setFocus(true)}
      onBlur={() => pondRef.current?.setFocus(false)}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div
        ref={slabRef}
        className={styles.slab}
        data-sunk={isSunk || undefined}
        data-clickable={sinkOnClick || undefined}
        onPointerDown={onSlabPointerDown}
      >
        <div ref={faceRef} className={styles.face}>
          {children}
        </div>
      </div>
    </div>
  );
}
