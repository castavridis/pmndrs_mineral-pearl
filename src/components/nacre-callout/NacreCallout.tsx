'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { getNacreStage } from './stage';
import { palette } from '../theme/palette';
import styles from './NacreCallout.module.css';

export type NacreKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

/** The study's kinds: GitHub's accents and octicons. */
export const nacreKinds: Record<NacreKind, { label: string; accent: string; d: string }> = {
  note: {
    label: 'Note',
    accent: palette.blue,
    d: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
  tip: {
    label: 'Tip',
    accent: palette.green,
    d: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  },
  important: {
    label: 'Important',
    accent: palette.purple,
    d: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm9 3a1 1 0 1 0-2 0 1 1 0 0 0 2 0ZM7.25 6.5a.75.75 0 0 0 0 1.5h.25v2.25a.75.75 0 0 0 1.5 0V7.25a.75.75 0 0 0-.75-.75Z',
  },
  warning: {
    label: 'Warning',
    accent: palette.orange,
    d: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  caution: {
    label: 'Caution',
    accent: palette.red,
    d: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
};

export interface NacreCalloutProps {
  kind?: NacreKind;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * A callout whose slab is black mineral nacre, drawn by the page's single
 * stage (one WebGL context for every card): a droplet follows the pointer
 * under the surface, blobs drift beneath it, the text is refracted through
 * it with dispersion, and the nacre's iridescence and glitter ride the
 * surface. The content is DOM on top. Without WebGL it is a bordered card.
 */
export function NacreCallout({ kind = 'note', children, className, style }: NacreCalloutProps) {
  const k = nacreKinds[kind];
  const ref = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stage = getNacreStage();
    if (!stage) return;
    // mineral on either page, for now: see the CSS for how the text follows
    const off = stage.register({ el, icon: iconRef.current, accent: k.accent, dark: true });
    // the ghost is the text: refresh it when the scheme (colours) changes
    const obs = new MutationObserver(() => stage.refresh());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      obs.disconnect();
      off();
    };
  }, [k.accent]);
  return (
    <div
      ref={ref}
      className={`${styles.cal} ${className ?? ''}`}
      style={{ '--accent': k.accent, ...style } as CSSProperties}
    >
      <span ref={iconRef} className={styles.ico} aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d={k.d} />
        </svg>
      </span>
      <div className={styles.body}>
        <p className={styles.lbl} data-ghost>
          {k.label}
        </p>
        <div data-ghost>{children}</div>
      </div>
    </div>
  );
}
