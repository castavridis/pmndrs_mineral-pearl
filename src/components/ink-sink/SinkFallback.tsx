'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { InkParticles } from '../ink-splat/particles';
import styles from './SinkFallback.module.css';

/** Seconds for the mass to close over the slab, and for it to withdraw again. */
export const COVER_S = 1.25;
export const RISE_S = 0.7;

export interface SinkFallbackProps {
  /** The pond's host; the canvas fills it. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** The slab the mass closes over. Measured untransformed, so the CSS recession does not shrink it. */
  slabRef: RefObject<HTMLDivElement | null>;
  sunk: boolean;
  /** Corner radius of the slab, CSS px. */
  radius: number;
  /** The mass's colour, any CSS colour. */
  ink: string;
  /** The mass has closed over the slab. */
  onCovered?: () => void;
}

/**
 * The swallow without a shader: the same CPU droplet simulation the ink splat
 * runs (`InkParticles` in engulf mode, so the droplets come in off the slab's
 * rim), drawn as plain circles into a 2D canvas behind a closing front.
 *
 * The merging is not computed here at all. A metaball field thresholded at
 * one half is the same thing as blurred alpha with its contrast pushed, so
 * the canvas is filtered by an SVG gaussian blur and a colour matrix that
 * hardens the alpha channel, and the browser does that per-pixel work in
 * compositor code. Per frame this costs a few dozen `arc` calls.
 *
 * What it cannot carry is the material: no nacre, no glitter, no refraction.
 * The mass is flat ink. Pair it with the slab's CSS recession (see
 * `InkSink.module.css`) and the two together read as sinking.
 */
export function SinkFallback({
  hostRef,
  slabRef,
  sunk,
  radius,
  ink,
  onCovered,
}: SinkFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawId = useId();
  const filterId = `sink-goo-${rawId.replace(/[^a-zA-Z0-9-]/g, '')}`;

  // props the loop reads, mirrored so it never closes over a stale render
  const live = useRef({ sunk, radius, ink, onCovered });
  useEffect(() => {
    live.current = { sunk, radius, ink, onCovered };
  }, [sunk, radius, ink, onCovered]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parts = new InkParticles();
    let raf = 0;
    let last = performance.now();
    /** simulation clock, seconds since the droplets were spawned */
    let simT = 0;
    /** 0 afloat, 1 covered */
    let cover = 0;
    let wasSunk = false;
    let covered = false;
    let spawned = false;

    // a rounded rectangle, with a straight fallback for engines without roundRect
    const box = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      const rr = Math.max(0, Math.min(r, w / 2, h / 2));
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, rr);
      else ctx.rect(x, y, w, h);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const slab = slabRef.current;
      if (!slab) return;

      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // the slab's untransformed box: the CSS recession must not shrink the mass
      const sx = slab.offsetLeft;
      const sy = slab.offsetTop;
      const sw = slab.offsetWidth;
      const sh = slab.offsetHeight;
      const unit = Math.max(w, h);

      const { sunk: wantSunk, radius: rad, ink: colour, onCovered: done } = live.current;

      if (wantSunk && !wasSunk) {
        // droplets come in off the slab's rim, as the engulf exit's do
        parts.dimX = w / unit;
        parts.dimY = h / unit;
        parts.clipHalfX = sw / 2 / unit;
        parts.clipHalfY = sh / 2 / unit;
        parts.floodStart = 0.22;
        parts.floodLen = COVER_S - 0.22;
        parts.spawnEdge();
        simT = 0;
        spawned = true;
        covered = false;
      }
      wasSunk = wantSunk;

      // the front closes in while sinking, withdraws while rising
      const target = wantSunk ? 1 : 0;
      const rate = wantSunk ? 1 / COVER_S : 1 / RISE_S;
      cover = Math.min(1, Math.max(0, cover + Math.sign(target - cover) * rate * dt));
      if (wantSunk && cover >= 1 && !covered) {
        covered = true;
        done?.();
      }
      if (!wantSunk && cover <= 0 && spawned) {
        spawned = false;
        parts.count = 0;
      }

      if (spawned) {
        simT += dt;
        parts.step(dt, simT);
      }

      ctx.clearRect(0, 0, w, h);
      if (cover <= 0 && !spawned) return;
      ctx.fillStyle = colour;

      // the closing front: the slab, with a dry hole that shrinks away
      if (cover > 0) {
        box(sx, sy, sw, sh, rad);
        ctx.fill();
        // each axis closes in proportion to its own size, so a wide, short
        // banner does not have its short axis covered in the first moment
        const ix = cover * (sw / 2) * 1.02;
        const iy = cover * (sh / 2) * 1.02;
        if (ix < sw / 2 && iy < sh / 2) {
          ctx.globalCompositeOperation = 'destination-out';
          box(sx + ix, sy + iy, sw - ix * 2, sh - iy * 2, Math.max(0, rad - Math.min(ix, iy)));
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // the droplets, merged into the front by the filter
      if (spawned) {
        for (let i = 0; i < parts.count; i++) {
          if (parts.born[i] > simT) continue;
          const r = parts.rad[i] * unit;
          if (r <= 0.2) continue;
          ctx.beginPath();
          ctx.arc(parts.px[i] * unit, parts.py[i] * unit, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hostRef, slabRef]);

  return (
    <>
      {/* metaballs without the per-pixel maths: blur the alpha, then harden it */}
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blurred" />
          <feColorMatrix
            in="blurred"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
          />
        </filter>
      </svg>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ filter: `url(#${filterId})` }}
        aria-hidden="true"
      />
    </>
  );
}
