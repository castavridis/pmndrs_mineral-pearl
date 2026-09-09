'use client';

import { useCallback, useEffect, useRef } from 'react';
import { InkSplat } from '../ink-splat';
import { getFixedGround, getGrounds, schemeLiquid, useGroundCount } from '../ink-sink/grounds';
import { useReducedMotion, useWebGL } from '../gate';
import { page, resolveTheme, useSystemTheme, useThemeStore } from '../theme';
import styles from './InkThemeTransition.module.css';

/**
 * The theme change as ink. A request with an origin (see `InkThemeToggle`)
 * mounts a full-viewport splat from that point.
 *
 * With the liquid shaders on, the splat is the liquid itself: the splat's
 * coverage is fed to every scheme-following ground as a mask, and where the
 * ink has landed the ground shows the *new* body (mineral or pearl), rendered
 * live. The splat itself stays on top of the page, drawn with the ground's
 * own pixels for ink, so the new liquid rolls over the content as well. Once
 * the flood has covered the page the grounds switch outright, the theme
 * commits underneath, and the overlay fades to reveal the switched content.
 *
 * With the shaders off (or no WebGL for them), the splat is a flat flood of
 * the new page colour, as a fallback. Reduced motion commits at once.
 */
export function InkThemeTransition() {
  const theme = useThemeStore((s) => s.theme);
  const pending = useThemeStore((s) => s.pending);
  const commit = useThemeStore((s) => s.commit);
  const finish = useThemeStore((s) => s.finish);
  const shaders = useThemeStore((s) => s.shaders);
  const system = useSystemTheme();
  const reducedMotion = useReducedMotion();
  const webgl = useWebGL();
  // no ink when nothing visible changes (e.g. light → system on a light OS).
  // Only judged before the commit: afterwards the stored theme *is* the
  // pending one, and the overlay must stay for its fade.
  const sameLook =
    pending?.phase === 'splat' && resolveTheme(pending.theme, system) === resolveTheme(theme, system);
  const skip = reducedMotion || webgl === false || sameLook;

  // the liquid path needs grounds to roll. Judged in render, before the splat
  // mounts: its context must be created with a preserved drawing buffer, and
  // that cannot be changed afterwards
  const groundCount = useGroundCount();
  const liquid = shaders && webgl !== false && groundCount > 0;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!pending) return;
    if (pending.phase === 'splat' && skip) {
      commit();
      finish();
    } else if (pending.phase === 'fade' && (reducedMotion || webgl === false)) {
      // the ink was skipped mid-way (preference changed): no overlay to fade
      finish();
    }
  }, [pending, skip, reducedMotion, webgl, commit, finish]);

  const target = pending ? resolveTheme(pending.theme, system) : 'dark';

  // liquid path: hand the splat's canvas to every ground as the mask
  const onCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (canvas && liquid && pending?.phase === 'splat') {
        const to = schemeLiquid(target === 'dark');
        for (const g of getGrounds()) g.beginMaskedSwitch(to, canvas);
      }
    },
    [liquid, pending, target]
  );

  const onSettle = useCallback(() => {
    if (liquid) for (const g of getGrounds()) g.endMaskedSwitch();
    // the overlay now shows the new liquid everywhere; commit under it and
    // let the fade reveal the switched content
    commit();
  }, [liquid, commit]);

  const fill = liquid ? (getFixedGround()?.canvas ?? null) : null;

  if (!pending || skip) return null;
  const fading = pending.phase === 'fade';
  return (
    <div
      aria-hidden="true"
      className={styles.overlay}
      onTransitionEnd={() => {
        if (fading) finish();
      }}
      style={{ opacity: fading ? 0 : 1 }}
    >
      <InkSplat
        autoplay
        interactive={false}
        logo={false}
        ink={page[target].bg}
        origin={pending.origin}
        onSettle={onSettle}
        fillCanvas={fill}
        canvasRef={liquid ? onCanvas : undefined}
        preserve={liquid}
        dpr={liquid ? 1 : undefined}
      />
    </div>
  );
}
