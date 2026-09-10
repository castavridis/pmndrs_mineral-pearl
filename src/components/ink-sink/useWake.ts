'use client';

import { useEffect, type RefObject } from 'react';
import { useReducedMotion } from '../gate';
import { getFixedGround } from './grounds';

/**
 * Move an element with the page's liquid. Whatever floats on the ground is
 * lifted and tipped by the wake the pointer drags across it, and is otherwise
 * still: nothing idles, so a control only moves when the water is disturbed.
 *
 * The surface is read from the same ripples the shader draws (`sampleWake`),
 * so the DOM and the liquid agree about where the water is.
 */
export function useWake(ref: RefObject<HTMLElement | null>, strength = 1) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || strength <= 0) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let rot = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const ground = getFixedGround();
      if (!ground) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const [ux, uy] = ground.uv({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      const w = ground.sampleWake(ux, uy);
      // the slope tips it and carries it; small, because these are controls
      const tx = -w.gx * 7.5 * strength;
      const ty = w.gy * 7.5 * strength;
      const tr = -w.gx * 1.1 * strength;
      // eased, so a ripple passing under reads as a nudge rather than a jitter
      const k = 0.16;
      x += (tx - x) * k;
      y += (ty - y) * k;
      rot += (tr - rot) * k;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg)`;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [ref, strength, reduced]);
}
