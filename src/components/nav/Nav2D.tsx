'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Surface, type SurfaceTier } from '../surface/Surface';
import { POND_BG, type Liquid } from '../ink-sink/liquid-pond';
import { onInk, useResolvedTheme } from '../theme';
import { useNavStore, useNavStoreApi, resolveMode } from './store';
import { tokens, tokensToCssVars } from './tokens';
import { NAV_MODES, type NavLink, type NavMode } from './types';
import { Logo } from './Logo';
import { CmdPalette } from './CmdPalette';
import styles from './Nav2D.module.css';

/**
 * The DOM nav: a pill `Surface` with the logo, the links and the Cmd item on
 * it. It is the a11y / SEO source of truth in every tier; the liquid is
 * only its surface. Its layout mode (full, compact, collapsed) follows the
 * container width against the pill's measured width in each mode.
 *
 * Until the first client-side measurement no `data-mode` is set: the no-JS
 * experience uses the `full` layout with a horizontally scrollable pill.
 */
export function Nav2D({ links, tier = 'full' }: { links: NavLink[]; tier?: SurfaceTier }) {
  // The bar stands against the page rather than with it: the dark page carries
  // the pearl liquid, the light page the black mineral, and the active item is
  // a pill of the other one, so it reads as the page showing through the bar.
  const scheme = useResolvedTheme();
  const bar: Liquid = scheme === 'dark' ? 'pearl' : 'mineral';
  const active: Liquid = scheme === 'dark' ? 'mineral' : 'pearl';
  const mode = useNavStore((s) => s.mode);
  const [measured, setMeasured] = useState(false);
  const setMode = useNavStore((s) => s.setMode);
  const current = useNavStore((s) => s.active);
  const setActive = useNavStore((s) => s.setActive);
  const menuOpen = useNavStore((s) => s.menuOpen);
  const setMenuOpen = useNavStore((s) => s.setMenuOpen);
  const setPaletteOpen = useNavStore((s) => s.setPaletteOpen);
  const setFocused = useNavStore((s) => s.setFocused);
  const api = useNavStoreApi();

  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  /** Measured pill width per mode. Reset whenever links change. */
  const required = useRef<Partial<Record<NavMode, number>>>({});

  const cssVars = useMemo(
    () =>
      ({
        ...tokensToCssVars(),
        '--nav-ink': onInk(POND_BG[bar]),
        '--nav-active-ink': onInk(POND_BG[active]),
      }) as CSSProperties,
    [bar, active]
  );

  // Mark the current page as active on mount (unless <Nav active> controls it).
  useEffect(() => {
    if (current !== null) return;
    const path = window.location.pathname;
    const match = links.find((l) => l.href === path);
    if (match) setActive(match.id);
  }, [links, current, setActive]);

  // Measure + resolve mode. Runs on container resize, pill resize (fonts, links) and links change.
  useLayoutEffect(() => {
    required.current = {};
    const root = rootRef.current;
    const pill = pillRef.current;
    if (!root || !pill) return;

    const measure = () => {
      const current = api.getState().mode;
      // Probe the natural pill width in every mode by swapping data-mode synchronously.
      // The pill is `width: max-content`, so scrollWidth is its natural width. The attribute
      // is restored before we return, so observers never see an intermediate size.
      root.dataset.probing = '';
      for (const m of NAV_MODES) {
        root.dataset.mode = m;
        required.current[m] = pill.scrollWidth + tokens.bleedX * 2;
      }
      root.dataset.mode = current;
      // Force style resolution at the restored mode before re-enabling transitions.
      void pill.scrollWidth;
      delete root.dataset.probing;
      const next = resolveMode(current, root.clientWidth, required.current);
      if (next !== current) setMode(next);
      setMeasured(true);
      api.getState().setPillWidth(required.current[next]! - tokens.bleedX * 2);
    };

    // Defer observer-driven measurements to the next frame: probing mutates the pill's size,
    // and doing that inside the callback trips "ResizeObserver loop completed" errors.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    ro.observe(pill);
    // Attribute must exist before probing so the CSS mode rules apply during the probe.
    root.dataset.mode = api.getState().mode;
    measure();
    // Re-measure once web fonts are in.
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [links, setMode, api]);

  // Collapsed disclosure: close on Escape / outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [menuOpen, setMenuOpen]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-mode={measured ? mode : undefined}
      data-tier={tier}
      style={cssVars}
    >
      <nav aria-label="Main" className={styles.nav}>
        <Surface
          ref={pillRef}
          shape="pill"
          material={bar}
          expressiveness={tier}
          unit={tokens.pillHeight * 4}
          className={styles.pill}
        >
          <div className={styles.row}>
            <a
              className={styles.logo}
              href="/"
              aria-label="pmndrs home"
              data-id="logo"
              onFocus={() => setFocused('logo')}
              onBlur={() => setFocused(null)}
            >
              <Logo />
            </a>

            <button
              type="button"
              className={styles.menuBtn}
              data-id="menu"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
              <span className={styles.srOnly}>Menu</span>
            </button>

            {/* Always in the DOM so every mode can be measured; CSS hides it in collapsed. */}
            <LinkList links={links} active={current} liquid={active} tier={tier} />

            <button
              type="button"
              className={styles.cmd}
              data-id="cmd"
              aria-haspopup="dialog"
              aria-keyshortcuts="Meta+K Control+K"
              onClick={() => setPaletteOpen(true)}
              onFocus={() => setFocused('cmd')}
              onBlur={() => setFocused(null)}
            >
              Cmd
              <kbd aria-hidden="true" className={styles.kbd}>
                ⌘K
              </kbd>
            </button>
          </div>
        </Surface>

        <div
          id="nav-menu"
          className={styles.menu}
          data-open={menuOpen}
          hidden={mode !== 'collapsed' || !menuOpen}
        >
          {mode === 'collapsed' && (
            <LinkList links={links} active={current} liquid={active} tier={tier} />
          )}
        </div>
      </nav>
      <CmdPalette />
    </div>
  );
}

function LinkList({
  links,
  active,
  liquid,
  tier,
}: {
  links: NavLink[];
  active: string | null;
  /** The active item's pill: the liquid the bar is not. */
  liquid: Liquid;
  tier: SurfaceTier;
}) {
  const setHovered = useNavStore((s) => s.setHovered);
  const setFocused = useNavStore((s) => s.setFocused);
  return (
    <ul className={styles.links}>
      {links.map((l) => {
        const isActive = active === l.id;
        const anchor = (
          <a
            className={styles.link}
            href={l.href}
            data-id={l.id}
            aria-current={isActive ? 'page' : undefined}
            onPointerEnter={() => setHovered(l.id)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setFocused(l.id)}
            onBlur={() => setFocused(null)}
          >
            {l.label}
          </a>
        );
        return (
          <li key={l.id}>
            {isActive ? (
              <Surface
                shape="pill"
                material={liquid}
                expressiveness={tier}
                unit={tokens.pillHeight * 2}
                className={styles.active}
              >
                {anchor}
              </Surface>
            ) : (
              anchor
            )}
          </li>
        );
      })}
    </ul>
  );
}
