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
import { useResolvedTheme, useThemeStore } from '../theme';
import { useReducedMotion, useWebGL } from '../gate';
import { COVER_S, RISE_S, SinkFallback } from './SinkFallback';
import { usePageLook, usePageLooks } from '../theme/look';
import { getFixedGround, registerGround, useGroundCount } from './grounds';
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
  /**
   * A press: a beat under with a splash, then it bobs back. Given a point, the
   * blow lands there and the slab tips into it, so the dip reads under the
   * cursor rather than across the whole face.
   */
  press: (at?: { clientX: number; clientY: number }) => void;
  /** An impact where the pointer is: the slab takes the hit there and goes under, and stays. */
  impact: (at: { clientX: number; clientY: number }) => void;
}

/**
 * How the sink renders. `liquid` is the pond; the two below it are the
 * fallbacks, and neither can carry the material — see `SinkFallback`.
 */
export type SinkTier = 'liquid' | 'swallow' | 'quiet';

/** How long the liquid takes to close over the slab, per tier, in ms. */
/**
 * The centre of an element as a pointer-like point, for a blow that came from
 * the keyboard: Enter and Space have no coordinates of their own, so the thing
 * activated stands in for the hand.
 */
export const centreOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
};

export const sinkCoverMs = (tier: SinkTier, reduced = false) =>
  tier === 'liquid' ? 1400 : tier === 'swallow' ? COVER_S * 1000 : reduced ? 260 : 620;

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
  /**
   * Seconds a landed glob takes to relax from `globHeight` to flat; the relief
   * belongs to the arrival, not to the settled mass. 0 keeps them proud.
   */
  globSettle?: number;
  /**
   * How deep a sunk slab rests, in uv (negative is below the surface). The
   * default takes it right under and the liquid closes over it; a shallower
   * rest leaves it under the surface but still seen through it.
   */
  sinkDepth?: number;
  /**
   * How much of the press depth the slab gives as a whole, 0..1. Low is a lean
   * on the point under the finger; high is the whole slab giving softly.
   */
  pressHeave?: number;
  /** How quickly it goes under, as a multiple of the study's rate. Default 1. */
  sinkSpeed?: number;
  /** How deep a press dips it before it bobs back. */
  pressDepth?: number;
  /** Whether going under throws a swallow of droplets. Off for a shallow rest. */
  sinkSplash?: boolean;
  /**
   * Drop the slab's own colours, so whatever is drawn behind it shows through
   * (the nacre stage, say) while the liquid still closes over it as it sinks.
   */
  bare?: boolean;
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
  /** CSS px per unit of the liquid's features. Default: the pond's height. */
  unit?: number;
  /** Start (or become) sunk. Uncontrolled when omitted; use the ref. */
  sunk?: boolean;
  /** Reported when a click sinks or raises the slab, so a controlled `sunk` can follow. */
  onSunkChange?: (sunk: boolean) => void;
  /** A click on the content is an impact that sinks it there; a click when sunk raises it. Default true. */
  sinkOnClick?: boolean;
  /**
   * The slab wears a body rather than a flat colour: the pearl where the
   * ground is mineral and the mineral where it is pearl, so it keeps the
   * study's contrast and gains that body's nacre and iridescence.
   */
  slabLiquid?: boolean;
  /**
   * The whole page is the well: no pond panel of its own, the liquid around
   * the slab continues the fixed page ground's surface (same frame, clock,
   * pointer, ripples, unit and resolution) and the slab sinks into the page.
   * Needs a fixed `LiquidGround` on the page; without one it is a plain slab.
   */
  well?: boolean;
  /**
   * Which tier renders the liquid. `auto` (default) picks the best the page
   * can run: `liquid` (the pond) where WebGL2 and the shaders are available,
   * `swallow` (a 2D canvas mass over a receding slab) where they are not, and
   * `quiet` (the recession alone, no canvas) under reduced motion. Force one
   * to see the fallbacks on a capable machine.
   */
  tier?: SinkTier | 'auto';
  /** The liquid has closed over the slab, or has withdrawn from it. */
  onSunkSettled?: (sunk: boolean) => void;
  /**
   * The liquid is up and drawing: the pond exists (or the tier that stands in
   * for it is mounted). A slab that opens sunk waits for this before it rises,
   * so the rise is seen rather than being spent before there is anything to
   * see it in.
   */
  onReady?: () => void;
  className?: string;
  style?: CSSProperties;
  /** On the host: a fade set through `style` ending, for instance. */
  onTransitionEnd?: () => void;
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
  globSettle = 0.9,
  sinkDepth,
  pressDepth,
  pressHeave,
  sinkSpeed,
  sinkSplash,
  bare = false,
  globShading = false,
  mineral,
  pearl,
  spectrum,
  pointer,
  mercury,
  radius = 8,
  bleed = 96,
  unit,
  sunk,
  onSunkChange,
  sinkOnClick = true,
  well = false,
  slabLiquid = false,
  tier: wantedTier = 'auto',
  onSunkSettled,
  onReady,
  className,
  style,
  onTransitionEnd,
}: InkSinkProps) {
  const theme = useResolvedTheme();
  const liq: Liquid = liquid === 'auto' ? (theme === 'dark' ? 'mineral' : 'pearl') : liquid;
  // which tier renders the liquid: the pond where it can run, else a fallback
  const webgl = useWebGL();
  const shaders = useThemeStore((st) => st.shaders);
  const reduced = useReducedMotion();
  const tier: SinkTier =
    wantedTier !== 'auto'
      ? wantedTier
      : webgl !== false && shaders
        ? 'liquid'
        : reduced
          ? 'quiet'
          : 'swallow';
  // in a well the pond is built once the page ground is there, and rebuilt if it changes
  const grounds = useGroundCount();
  // the page look is the default; a prop on this pond wins over it
  const look = usePageLook();
  // the mineral body is dressed by the dark look, the pearl body by the light
  const looks = usePageLooks();
  const visc = viscosity ?? looks.dark.viscosity;
  const merged = () => ({
    mineral: { ...MINERAL_DEFAULT, ...looks.dark.mineral, ...mineral },
    pearl: { ...PEARL_DEFAULT, ...looks.light.pearl, ...pearl },
    mercury: { ...MERCURY_DEFAULT, ...look.mercury, ...mercury },
    spectrum: { ...SPECTRUM_DEFAULT, ...looks.dark.spectrum, ...spectrum },
    pointer: { ...POINTER_DEFAULT, ...looks.dark.pointer, ...pointer },
    spectrumPearl: { ...SPECTRUM_DEFAULT, ...looks.light.spectrum, ...spectrum },
    pointerPearl: { ...POINTER_DEFAULT, ...looks.light.pointer, ...pointer },
    viscosityPearl: viscosity ?? looks.light.viscosity,
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const pondRef = useRef<LiquidPond | null>(null);
  // uncontrolled state; a `sunk` prop wins when given
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  // the tiers with no pond are up as soon as they are mounted
  useEffect(() => {
    if (tier !== 'liquid') ready.current?.();
  }, [tier]);

  const [ownSunk, setIsSunk] = useState(false);
  const isSunk = sunk ?? ownSunk;
  // read by the pond's first breath, which happens outside this render
  const sunkAtBirth = useRef(isSunk);
  useEffect(() => {
    sunkAtBirth.current = isSunk;
  }, [isSunk]);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const slab = slabRef.current;
    if (!host || !canvas || !slab || tier !== 'liquid') return;
    // read here, not in render: the registry is not reactive to the compiler
    const ground = well ? getFixedGround() : null;
    if (well && !ground) return;
    const pond = new LiquidPond(host, canvas, slab, {
      liquid: liq,
      viscosity: visc,
      mercuryOnSink: well ? false : mercuryOnSink,
      globSize,
      globDensity,
      globHeight,
      globSettle,
      sinkDepth,
      pressDepth,
      pressHeave,
      sinkSpeed,
      sinkSplash,
      globShading,
      slabLiquid,
      radius,
      // in a well the liquid must sample like the ground: its unit and resolution
      maxDpr: ground ? ground.opts.maxDpr : 2,
      unit: ground ? ground.opts.unit : unit,
      well,
      ...merged(),
    });
    pond.face = faceRef.current;
    pondRef.current = pond;
    // A well waits for the page's ground, so this effect commonly runs once,
    // bails, and builds the pond on a later pass. A pond born then has missed
    // the state React already holds — the `sunk` effect below only fires on a
    // change — so it would float while the component believes it is under.
    // Telling it now is also its opening state, so it snaps rather than sinks.
    //
    // It is told either way, not only when it opens sunk. A pond that is never
    // told has no state to have changed from, so the first sink it is given
    // reads as an opening state too and pops instead of going under.
    pond.sunk = sunkAtBirth.current;
    ready.current?.();
    if (!ground) {
      return () => {
        pond.destroy();
        pondRef.current = null;
      };
    }
    // the well: the ground's ripples, the window's pointer, and the theme's
    // masked switch (registered like a ground, so it rolls over with the page)
    pond.joinWell(ground);
    const unregister = liquid === 'auto' ? registerGround(pond) : () => {};
    const move = (e: Event) => pond.point(e as PointerEvent);
    const leave = () => pond.leave();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', move);
    window.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerleave', leave);
      unregister();
      pond.destroy();
      pondRef.current = null;
    };
    // the pond is built once (per ground); options are pushed into it below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [well, grounds, tier]);

  useEffect(() => {
    const pond = pondRef.current;
    if (!pond) return;
    pond.opts.viscosity = visc;
    // the same rule the pond was built with: a well is a window onto the
    // page's own surface, and the page does not turn to quicksilver because
    // one slab in it went under. Without this the update below handed the
    // default straight back and every well sank into mercury.
    pond.opts.mercuryOnSink = well ? false : mercuryOnSink;
    pond.opts.globSize = globSize;
    pond.opts.globDensity = globDensity;
    pond.opts.globHeight = globHeight;
    pond.opts.globSettle = globSettle;
    pond.opts.sinkDepth = sinkDepth;
    pond.opts.pressDepth = pressDepth;
    pond.opts.pressHeave = pressHeave;
    pond.opts.sinkSpeed = sinkSpeed;
    pond.opts.sinkSplash = sinkSplash;
    pond.opts.globShading = globShading;
    pond.opts.slabLiquid = slabLiquid;
    pond.opts.radius = radius;
    if (!pond.opts.well) pond.opts.unit = unit;
    Object.assign(pond.opts, merged());
    pond.setLiquid(liq);
    // merged() reads the look and the props listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liq,
    visc,
    mercuryOnSink,
    well,
    globSize,
    globDensity,
    globHeight,
    globSettle,
    sinkDepth,
    pressDepth,
    pressHeave,
    sinkSpeed,
    sinkSplash,
    globShading,
    slabLiquid,
    radius,
    unit,
    look,
    looks,
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

  // the swallow tier reports for itself (it knows when its front has closed);
  // the pond and the quiet recession are timed
  const settled = useRef(onSunkSettled);
  useEffect(() => {
    settled.current = onSunkSettled;
  }, [onSunkSettled]);
  useEffect(() => {
    if (tier === 'swallow') return;
    const ms = isSunk ? sinkCoverMs(tier, reduced) : RISE_S * 1000;
    const id = window.setTimeout(() => settled.current?.(isSunk), ms);
    return () => window.clearTimeout(id);
  }, [isSunk, tier, reduced]);
  const onCovered = useCallback(() => settled.current?.(true), []);

  useImperativeHandle(
    ref,
    () => ({
      sink: () => setIsSunk(true),
      rise: () => setIsSunk(false),
      press: (at) => {
        const pond = pondRef.current;
        if (pond) pond.press(at ? pond.uv(at) : undefined);
      },
      impact: (at) => {
        const pond = pondRef.current;
        if (pond) pond.impact(pond.uv(at));
        setIsSunk(true);
      },
    }),
    []
  );

  const onSlabPointerDown = (e: React.PointerEvent) => {
    const pond = pondRef.current;
    if (!sinkOnClick || e.button !== 0) return;
    if (isSunk) {
      setIsSunk(false);
      onSunkChange?.(false);
      return;
    }
    // the pond takes the blow now; React's state follows so a re-render
    // doesn't undo it
    if (pond) pond.impact(pond.uv(e.nativeEvent));
    setIsSunk(true);
    onSunkChange?.(true);
  };

  const vars = {
    '--pond-radius': `${radius}px`,
    '--pond-bg': POND_BG[liq],
    // the study's slab colours stand either way: a slab wearing a body wears
    // the other one, which is the colour these already are
    '--slab-bg': SLAB_LOOK[liq].bg,
    '--slab-fg': SLAB_LOOK[liq].fg,
    '--pond-bleed': `${bleed}px`,
  } as CSSProperties;
  // in a well the window's pointer drives the pond (attached above)
  const own = !well;
  return (
    <div
      ref={hostRef}
      className={`${styles.root} ${className ?? ''}`}
      style={{ padding: bleed, ...vars, ...style }}
      data-well={well || undefined}
      data-tier={tier}
      data-sunk={isSunk || undefined}
      onTransitionEnd={onTransitionEnd}
      onPointerMove={own ? (e) => pondRef.current?.point(e.nativeEvent) : undefined}
      onPointerDown={own ? (e) => pondRef.current?.point(e.nativeEvent) : undefined}
      onPointerLeave={own ? () => pondRef.current?.leave() : undefined}
      onFocus={(e) => {
        // the shader's ring is a focus ring, so it follows the same rule the
        // CSS one does: keyboard focus shows it, a click does not
        let keyboard = true;
        try {
          keyboard = (e.target as Element).matches(':focus-visible');
        } catch {
          /* older engines: keep the ring rather than lose it */
        }
        if (keyboard) pondRef.current?.setFocus(true);
      }}
      onBlur={() => pondRef.current?.setFocus(false)}
    >
      {tier === 'liquid' && <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />}
      {tier === 'swallow' && (
        <SinkFallback
          hostRef={hostRef}
          slabRef={slabRef}
          sunk={isSunk}
          radius={radius}
          ink={POND_BG[liq] === SLAB_LOOK[liq].bg ? SLAB_LOOK[liq].fg : POND_BG[liq]}
          onCovered={onCovered}
        />
      )}
      <div
        ref={slabRef}
        className={styles.slab}
        data-sunk={isSunk || undefined}
        data-bare={bare || undefined}
        data-fallback={tier !== 'liquid' || undefined}
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
