'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type Ref,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { useReducedMotion } from '../gate';
import {
  BLOT_SCALE,
  DRAIN_LEN,
  DURATION,
  ENGULF_DURATION,
  ENGULF_FLOOD_LEN,
  ENGULF_FLOOD_START,
  FLOOD_LEN,
  FLOOD_START,
  MAX_PARTICLES,
} from './config';
import { DATA_BYTES, InkParticles } from './particles';
import { FIELD_FRAG, INK_FRAG, VERT } from './shaders';

// A react-three-fiber port of Kris's ink splat (see ./reference). The CPU
// particle sim is unchanged; the two WebGL passes now run through three:
// pass 1 renders the metaball density field into a reduced-resolution FBO,
// pass 2 thresholds it into ink on screen. The canvas is demand-driven, so
// nothing renders once the flood has covered the viewport.

export type InkTheme = 'light' | 'dark';

export interface InkSplatHandle {
  /** Re-seed and replay the splat (in `engulf` mode: the ink closes in again). */
  splat: () => void;
  /**
   * Withdraw the flood back to where it came from, leaving the droplets as
   * spatter. Only meaningful once the ink has settled.
   */
  drain: () => void;
}

/**
 * `splat` (default): a blot lands at `origin` and floods outward.
 * `engulf`: the inverse; droplets are thrown in from the box's edge and the
 * ink closes in behind them until everything inside is covered.
 */
export type InkMode = 'splat' | 'engulf';

/** A rounded box, inset from the canvas edges, that bounds the flood. */
export interface InkClip {
  /** Distance from each canvas edge to the box, CSS px. */
  inset: number;
  /** Corner radius, CSS px. */
  radius: number;
}

export interface InkSplatProps {
  ref?: Ref<InkSplatHandle>;
  /** The underlying canvas element, for reading the splat back (e.g. as a mask). */
  canvasRef?: Ref<HTMLCanvasElement>;
  /** Keep the drawing buffer after each frame so another context can read it. */
  preserve?: boolean;
  /** Device pixel ratio or range. Default [1, 2]. */
  dpr?: number | [number, number];
  className?: string;
  style?: CSSProperties;
  /**
   * Palette: `light` is black ink on white, `dark` is white ink on black.
   * When omitted the splat follows `data-theme` / a `dark` class on `<html>`.
   */
  theme?: InkTheme;
  /** Ink colour (any CSS colour three can parse). Defaults from the theme. */
  ink?: string;
  /**
   * Take the ink's colour from this screen-sized canvas instead (read every
   * frame; a WebGL source needs a preserved drawing buffer). The ink then
   * shows whatever lies beneath it, e.g. the liquid ground.
   */
  fillCanvas?: HTMLCanvasElement | null;
  /** Colour of the pmndrs mark. Defaults from the theme. */
  mark?: string;
  /** Show the pmndrs mark surfacing through the ink. Default true. */
  logo?: boolean;
  /** Blot scale relative to the longer canvas edge. Default 1.5. */
  scale?: number;
  /** Impact point as fractions of the canvas, `[0.5, 0.5]` is the centre. */
  origin?: [number, number];
  /** Bound the flood to a rounded box; droplets may still overhang it. */
  clip?: InkClip;
  /** `splat` (default) or `engulf`, the inverse. */
  mode?: InkMode;
  /** Splat on pointerdown over the canvas. Default true. */
  interactive?: boolean;
  /** Splat once on mount (and again if this turns on later). Default false. */
  autoplay?: boolean;
  /** Called at each impact. */
  onSplat?: () => void;
  /** Called once the flood has covered the canvas and the sim has stopped. */
  onSettle?: () => void;
  /** Called once a `drain()` has withdrawn the flood. */
  onDrain?: () => void;
}

const subscribeHtml = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  return () => observer.disconnect();
};
const readHtmlDark = () => {
  const html = document.documentElement;
  return html.dataset.theme ? html.dataset.theme === 'dark' : html.classList.contains('dark');
};
const readHtmlDarkServer = () => false;

/** Resolves the palette: an explicit prop wins, else `data-theme` / `.dark` on `<html>`. */
export function useInkTheme(theme?: InkTheme): InkTheme {
  const htmlDark = useSyncExternalStore(subscribeHtml, readHtmlDark, readHtmlDarkServer);
  return theme ?? (htmlDark ? 'dark' : 'light');
}

export function InkSplat({
  ref,
  canvasRef,
  preserve = false,
  dpr = [1, 2],
  className,
  style,
  theme,
  ink,
  fillCanvas = null,
  mark,
  logo = true,
  scale = BLOT_SCALE,
  origin,
  clip,
  mode = 'splat',
  interactive = true,
  autoplay = false,
  onSplat,
  onSettle,
  onDrain,
}: InkSplatProps) {
  const resolvedTheme = useInkTheme(theme);
  const dark = resolvedTheme === 'dark';
  // the scene mounts only once R3F has measured the canvas, so a splat asked
  // for before then (an intersection observer, a click handler) is kept and
  // fired as soon as the layer registers
  const controlsRef = useRef<InkSplatHandle | null>(null);
  const wantedRef = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      splat: () => {
        if (controlsRef.current) controlsRef.current.splat();
        else wantedRef.current = true;
      },
      drain: () => controlsRef.current?.drain(),
    }),
    []
  );

  return (
    <Canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      role="img"
      aria-label="pmndrs"
      frameloop="demand"
      dpr={dpr}
      // measure on resize only; the scroll-tracking measure can miss the first
      // layout of an absolutely positioned container and leave the canvas 300×150
      resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      flat
      linear
      gl={{
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: preserve,
        powerPreference: 'high-performance',
      }}
    >
      <InkSplatLayer
        controlsRef={controlsRef}
        wantedRef={wantedRef}
        ink={ink ?? (dark ? '#ededed' : '#111111')}
        fillCanvas={fillCanvas}
        mark={mark ?? (dark ? '#111111' : '#ffffff')}
        logo={logo}
        scale={scale}
        originX={origin?.[0] ?? 0.5}
        originY={origin?.[1] ?? 0.5}
        clipInset={clip?.inset}
        clipRadius={clip?.radius ?? 0}
        mode={mode}
        interactive={interactive}
        autoplay={autoplay}
        onSplat={onSplat}
        onSettle={onSettle}
        onDrain={onDrain}
      />
    </Canvas>
  );
}

interface LayerProps {
  controlsRef: RefObject<InkSplatHandle | null>;
  wantedRef: RefObject<boolean>;
  ink: string;
  fillCanvas: HTMLCanvasElement | null;
  mark: string;
  logo: boolean;
  scale: number;
  originX: number;
  originY: number;
  clipInset: number | undefined;
  clipRadius: number;
  mode: InkMode;
  interactive: boolean;
  autoplay: boolean;
  onSplat?: () => void;
  onSettle?: () => void;
  onDrain?: () => void;
}

/** GPU resources plus the mutable clock of one splat; lives in a ref. */
interface Resources {
  data: Uint8Array;
  dataTex: THREE.DataTexture;
  geometry: THREE.BufferGeometry;
  fieldMaterial: THREE.ShaderMaterial;
  inkMaterial: THREE.ShaderMaterial;
  camera: THREE.Camera;
  fieldScene: THREE.Scene;
  inkScene: THREE.Scene;
  particles: InkParticles;
  /** performance.now() of the last impact; the screen is blank while < 0 */
  start: number;
  /** fixed-step simulation clock, seconds since impact */
  simT: number;
  settled: boolean;
  /** performance.now() when a drain began; < 0 while not draining */
  drainStart: number;
  drained: boolean;
  /** flood timing for the current mode */
  floodStart: number;
  floodLen: number;
  duration: number;
}

function createResources(): Resources {
  // droplet state lives in a tiny RGBA8 texture (two rows per droplet
  // column) that the field pass loops over
  const data = new Uint8Array(DATA_BYTES);
  const dataTex = new THREE.DataTexture(
    data,
    MAX_PARTICLES,
    2,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  dataTex.minFilter = THREE.NearestFilter;
  dataTex.magFilter = THREE.NearestFilter;
  dataTex.wrapS = THREE.ClampToEdgeWrapping;
  dataTex.wrapT = THREE.ClampToEdgeWrapping;
  dataTex.generateMipmaps = false;
  dataTex.needsUpdate = true;

  // fullscreen triangle shared by both passes
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );

  const fieldMaterial = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {
      uDims: { value: new THREE.Vector2(1, 1) },
      uData: { value: dataTex },
      uCount: { value: 0 },
    },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });

  const inkMaterial = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: INK_FRAG,
    uniforms: {
      uField: { value: null as THREE.Texture | null },
      uDims: { value: new THREE.Vector2(1, 1) },
      uPx: { value: 1 },
      uTime: { value: 0 },
      uSeed: { value: 0 },
      uLogo: { value: 1 },
      uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uCover: { value: 1.5 },
      uInk: { value: new THREE.Vector3(0.067, 0.067, 0.067) },
      uFill: { value: null as THREE.Texture | null },
      uFillOn: { value: 0 },
      uFillRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uMark: { value: new THREE.Vector3(1, 1, 1) },
      uSheen: { value: 0.16 },
      uClipHalf: { value: new THREE.Vector2(0, 0) },
      uClipRadius: { value: 0 },
      uClipOn: { value: 0 },
      uFloodStart: { value: FLOOD_START },
      uFloodLen: { value: FLOOD_LEN },
      uEngulf: { value: 0 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });

  const camera = new THREE.Camera();
  const fieldScene = new THREE.Scene();
  const fieldMesh = new THREE.Mesh(geometry, fieldMaterial);
  fieldMesh.frustumCulled = false;
  fieldScene.add(fieldMesh);
  const inkScene = new THREE.Scene();
  const inkMesh = new THREE.Mesh(geometry, inkMaterial);
  inkMesh.frustumCulled = false;
  inkScene.add(inkMesh);

  return {
    data,
    dataTex,
    geometry,
    fieldMaterial,
    inkMaterial,
    camera,
    fieldScene,
    inkScene,
    particles: new InkParticles(),
    start: -1,
    simT: 0,
    settled: false,
    drainStart: -1,
    drained: false,
    floodStart: FLOOD_START,
    floodLen: FLOOD_LEN,
    duration: DURATION,
  };
}

function disposeResources(res: Resources) {
  res.dataTex.dispose();
  res.geometry.dispose();
  res.fieldMaterial.dispose();
  res.inkMaterial.dispose();
}

// the shaders work in display (sRGB) values, so colours are handed over
// without three's linear conversion
const tmpColor = new THREE.Color();
const tmpRGB = { r: 0, g: 0, b: 0 };
function setColor(target: THREE.Vector3, css: string) {
  tmpColor.set(css).getRGB(tmpRGB, THREE.SRGBColorSpace);
  target.set(tmpRGB.r, tmpRGB.g, tmpRGB.b);
}
const luminance = (v: THREE.Vector3) => 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;

function InkSplatLayer({
  controlsRef,
  wantedRef,
  ink,
  fillCanvas,
  mark,
  logo,
  scale,
  originX,
  originY,
  clipInset,
  clipRadius,
  mode,
  interactive,
  autoplay,
  onSplat,
  onSettle,
  onDrain,
}: LayerProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = useReducedMotion();

  // the field is smooth, so it is rendered at a fraction of the resolution
  const fieldScale = dpr >= 2 ? 3 : 2;
  const fieldW = Math.max(1, Math.ceil((size.width * dpr) / fieldScale));
  const fieldH = Math.max(1, Math.ceil((size.height * dpr) / fieldScale));
  const field = useFBO(fieldW, fieldH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

  // callbacks and the motion preference are read through refs so a new
  // inline handler never restarts the splat and `splat` itself stays stable
  const onSplatRef = useRef(onSplat);
  const onSettleRef = useRef(onSettle);
  const onDrainRef = useRef(onDrain);
  const reducedRef = useRef(reducedMotion);
  const modeRef = useRef(mode);
  useEffect(() => {
    onSplatRef.current = onSplat;
    onSettleRef.current = onSettle;
    onDrainRef.current = onDrain;
    reducedRef.current = reducedMotion;
    modeRef.current = mode;
  });

  const resRef = useRef<Resources | null>(null);
  // true once a splat has been asked for; lets the ink survive the resources
  // being rebuilt (React StrictMode remounts effects in development)
  const armedRef = useRef(false);

  const splat = useCallback(() => {
    const res = resRef.current;
    armedRef.current = true;
    if (!res) return;
    res.inkMaterial.uniforms.uSeed.value = Math.random() * 100;
    if (modeRef.current === 'engulf') res.particles.spawnEdge();
    else res.particles.spawn();
    // with reduced motion the clock starts at the end: the first frame is
    // the settled ink, no animation
    res.start = performance.now() - (reducedRef.current ? res.duration * 1000 : 0);
    res.simT = 0;
    res.settled = false;
    res.drainStart = -1;
    res.drained = false;
    onSplatRef.current?.();
    invalidate();
  }, [invalidate]);

  const drain = useCallback(() => {
    const res = resRef.current;
    if (!res || res.start < 0 || res.drainStart >= 0) return;
    res.drainStart = performance.now() - (reducedRef.current ? DRAIN_LEN * 1000 : 0);
    res.drained = false;
    invalidate();
  }, [invalidate]);

  // resources are created in the first effect so the later effects (which
  // run in declaration order) and the frame loop always find them
  useEffect(() => {
    const res = createResources();
    resRef.current = res;
    if (armedRef.current) splat();
    return () => {
      disposeResources(res);
      resRef.current = null;
    };
  }, [splat]);

  // flood timing follows the mode
  useEffect(() => {
    const res = resRef.current;
    if (!res) return;
    const engulf = mode === 'engulf';
    res.floodStart = engulf ? ENGULF_FLOOD_START : FLOOD_START;
    res.floodLen = engulf ? ENGULF_FLOOD_LEN : FLOOD_LEN;
    res.duration = engulf ? ENGULF_DURATION : DURATION;
    res.particles.floodStart = res.floodStart;
    res.particles.floodLen = res.floodLen;
    const u = res.inkMaterial.uniforms;
    u.uFloodStart.value = res.floodStart;
    u.uFloodLen.value = res.floodLen;
    u.uEngulf.value = engulf ? 1 : 0;
    invalidate();
  }, [mode, invalidate]);

  // viewport geometry in shader units
  useEffect(() => {
    const res = resRef.current;
    if (!res) return;
    const unit = Math.max(size.width, size.height) * scale;
    const dimX = size.width / unit;
    const dimY = size.height / unit;
    const ox = originX * dimX;
    const oy = originY * dimY;
    res.particles.cx = ox;
    res.particles.cy = oy;
    res.particles.dimX = dimX;
    res.particles.dimY = dimY;
    const clipOn = clipInset !== undefined;
    const hx = clipOn ? Math.max(0, size.width / 2 - clipInset) / unit : 0;
    const hy = clipOn ? Math.max(0, size.height / 2 - clipInset) / unit : 0;
    res.particles.clipHalfX = hx;
    res.particles.clipHalfY = hy;
    const u = res.inkMaterial.uniforms;
    res.fieldMaterial.uniforms.uDims.value.set(dimX, dimY);
    u.uDims.value.set(dimX, dimY);
    u.uPx.value = 1 / (unit * dpr);
    u.uField.value = field.texture;
    u.uOrigin.value.set(ox, oy);
    // the flood front must reach the farthest corner (or, closing in from the
    // edge, the centre), with room for its fingers
    u.uCover.value =
      mode === 'engulf'
        ? 2 * Math.min(clipOn ? hx : dimX / 2, clipOn ? hy : dimY / 2) + 0.15
        : 2 * Math.hypot(Math.max(ox, dimX - ox), Math.max(oy, dimY - oy)) + 0.15;
    u.uClipHalf.value.set(hx, hy);
    u.uClipRadius.value = clipRadius / unit;
    u.uClipOn.value = clipOn ? 1 : 0;
    invalidate();
  }, [size, dpr, scale, field, invalidate, originX, originY, clipInset, clipRadius, mode]);

  // the fill: a texture over the given canvas, refreshed every frame it draws
  const fillRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const res = resRef.current;
    if (!res) return;
    const u = res.inkMaterial.uniforms;
    fillRef.current?.dispose();
    fillRef.current = null;
    if (fillCanvas) {
      const tex = new THREE.CanvasTexture(fillCanvas);
      // a WebGL canvas arrives with its top row first; the shader flips
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      fillRef.current = tex;
    }
    u.uFill.value = fillRef.current;
    u.uFillOn.value = fillRef.current ? 1 : 0;
    invalidate();
    return () => {
      fillRef.current?.dispose();
      fillRef.current = null;
    };
  }, [fillCanvas, invalidate]);

  useEffect(() => {
    const res = resRef.current;
    if (!res) return;
    const u = res.inkMaterial.uniforms;
    setColor(u.uInk.value, ink);
    setColor(u.uMark.value, mark);
    // the wet edge brightens dark ink and darkens light ink
    u.uSheen.value = luminance(u.uInk.value) > 0.5 ? -0.14 : 0.16;
    u.uLogo.value = logo ? 1 : 0;
    invalidate();
  }, [ink, mark, logo, invalidate]);

  useEffect(() => {
    controlsRef.current = { splat, drain };
    if (wantedRef.current) {
      wantedRef.current = false;
      splat();
    }
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, wantedRef, splat, drain]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    el.addEventListener('pointerdown', splat);
    return () => el.removeEventListener('pointerdown', splat);
  }, [gl, interactive, splat]);

  // splats on mount when `autoplay` is set, and again if it is turned on later
  useEffect(() => {
    if (autoplay) splat();
  }, [autoplay, splat]);

  // priority 1 takes over rendering from R3F: two passes per frame, and
  // once the flood has covered the screen nothing moves, so the loop stops
  // after DURATION and only repaints on a palette change or resize
  useFrame(({ gl }) => {
    const res = resRef.current;
    gl.setClearColor(0x000000, 0);
    if (!res || res.start < 0) {
      gl.setRenderTarget(null);
      gl.clear();
      return;
    }
    let t = Math.min((performance.now() - res.start) / 1000, res.duration);
    let draining = false;
    if (res.drainStart >= 0) {
      // draining runs the flood clock backwards over DRAIN_LEN with the
      // droplets frozen where they lie: the front withdraws, they un-swell
      const back = (performance.now() - res.drainStart) / 1000 / DRAIN_LEN;
      t = Math.max(res.floodStart, res.duration - back * (res.duration - res.floodStart));
      draining = t > res.floodStart;
      // make sure the sim has reached the end before it is frozen
      while (res.simT < res.duration) {
        const dt = Math.min(1 / 120, res.duration - res.simT);
        res.particles.step(dt, res.simT);
        res.simT += dt;
      }
    } else {
      // fixed-step physics so the settle is identical at any frame rate
      while (res.simT < t) {
        const dt = Math.min(1 / 120, t - res.simT);
        res.particles.step(dt, res.simT);
        res.simT += dt;
      }
    }
    res.particles.encode(t, res.data);
    res.dataTex.needsUpdate = true;
    if (fillRef.current) {
      fillRef.current.needsUpdate = true;
      // where this canvas sits in the viewport, so a small overlay samples
      // its own patch of the (viewport-sized) fill
      const r = gl.domElement.getBoundingClientRect();
      const W = window.innerWidth || 1;
      const H = window.innerHeight || 1;
      res.inkMaterial.uniforms.uFillRect.value.set(r.left / W, r.top / H, r.width / W, r.height / H);
    }
    res.fieldMaterial.uniforms.uCount.value = res.particles.count;
    res.inkMaterial.uniforms.uTime.value = t;

    // pass 1: density field at reduced resolution
    gl.setRenderTarget(field);
    gl.clear();
    gl.render(res.fieldScene, res.camera);
    // pass 2: ink, flood, logo at full resolution
    gl.setRenderTarget(null);
    gl.clear();
    gl.render(res.inkScene, res.camera);

    if (res.drainStart >= 0) {
      if (draining) invalidate();
      else if (!res.drained) {
        res.drained = true;
        onDrainRef.current?.();
      }
    } else if (t < res.duration) {
      invalidate();
    } else if (!res.settled) {
      res.settled = true;
      onSettleRef.current?.();
    }
  }, 1);

  return null;
}
