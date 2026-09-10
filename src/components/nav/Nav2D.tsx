'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Surface, type SurfaceTier } from '../surface/Surface';
import { POND_BG, type Liquid } from '../ink-sink/liquid-pond';
import { onInk, page, useResolvedTheme } from '../theme';
import { palette } from '../theme/palette';
import { getNacreStage } from '../nacre-callout/stage';
import { InkSplat } from '../ink-splat';
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
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const hovered = useNavStore((s) => s.hovered);
  const setHovered = useNavStore((s) => s.setHovered);
  /** what the pill is under: whatever the pointer is over, else the current page */
  const pillTarget = hovered ?? current;

  // One pill moves along the row, so it stretches between items rather than
  // appearing per item. It measures against the row, not the link list, so the
  // Cmd item is as reachable as the links.
  useEffect(() => {
    const row = rowRef.current;
    const pill = indicatorRef.current;
    if (!row || !pill) return;
    const place = () => {
      const el = pillTarget
        ? row.querySelector<HTMLElement>(`[data-id="${CSS.escape(pillTarget)}"]`)
        : null;
      if (!el) {
        pill.style.opacity = '0';
        return;
      }
      pill.style.opacity = '1';
      pill.style.width = `${el.offsetWidth + 24}px`;
      pill.style.height = `${el.offsetHeight + 12}px`;
      pill.style.left = `${el.offsetLeft - 12}px`;
      pill.style.top = `${el.offsetTop - 6}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(row);
    return () => ro.disconnect();
  }, [pillTarget, links, mode]);

  // The gooey callout shader draws it: the page's nacre stage, one more card,
  // with a pill's own corner radius.
  useEffect(() => {
    const pill = indicatorRef.current;
    if (!pill || tier === 'flat') return;
    const stage = getNacreStage();
    if (!stage) return;
    return stage.register({ el: pill, icon: null, accent: palette.dark, radius: 999 });
  }, [tier]);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const blotRef = useRef<HTMLSpanElement>(null);

  // The mark's blot lives outside the bar and behind it, so the bar's liquid
  // covers the part that lands on it and only the spill shows. It has to be
  // told where the mark is, since that moves with the layout mode.
  useEffect(() => {
    const nav = navRef.current;
    const logo = logoRef.current;
    const blot = blotRef.current;
    if (!nav || !logo || !blot) return;
    const place = () => {
      const nr = nav.getBoundingClientRect();
      const lr = logo.getBoundingClientRect();
      if (!lr.width) return;
      blot.style.left = `${lr.left - nr.left + lr.width / 2}px`;
      blot.style.top = `${lr.top - nr.top + lr.height / 2}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    ro.observe(logo);
    return () => ro.disconnect();
  }, [tier, mode]);

  /**
   * A click is a blow: the bar gives in the direction of the hit, then drifts
   * back. The offset is tiny — it is a bar of liquid, not a door.
   */
  const impact = (e: React.PointerEvent) => {
    const el = navRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    el.style.setProperty('--nudge-x', `${(-dx * 14).toFixed(2)}px`);
    el.style.setProperty('--nudge-y', `${(-dy * 7).toFixed(2)}px`);
    el.dataset.impact = '';
    window.setTimeout(() => {
      el.style.setProperty('--nudge-x', '0px');
      el.style.setProperty('--nudge-y', '0px');
      delete el.dataset.impact;
    }, 110);
  };
  /** Measured pill width per mode. Reset whenever links change. */
  const required = useRef<Partial<Record<NavMode, number>>>({});

  const cssVars = useMemo(
    () =>
      ({
        ...tokensToCssVars(),
        '--nav-ink': onInk(POND_BG[bar]),
        '--nav-active-ink': onInk(POND_BG[active]),
        // the sliding pill is drawn by the nacre stage, which is the black
        // mineral body in either scheme, so its label is light in both
        '--nav-pill-ink': onInk(POND_BG.mineral),
      }) as CSSProperties,
    [bar, active]
  );

  // Mark the current page as active on mount (unless <Nav active> controls it).
  useEffect(() => {
    if (current !== null) return;
    const path = window.location.pathname;
    const match = links.find((l) => l.href === path);
    // No link is this page (the home page is not one of them), so the first
    // link stands as the current one: the pill always has somewhere to be.
    setActive(match?.id ?? links[0]?.id ?? null);
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
      <nav aria-label="Main" className={styles.nav} ref={navRef} onPointerDown={impact}>
        {tier !== 'flat' && (
          <span ref={blotRef} className={styles.logoBlot} aria-hidden="true">
            <InkSplat
              autoplay
              interactive={false}
              logo={false}
              flood={false}
              preserve
              ink={page[scheme].ink}
              nacre={0.85}
              scale={0.95}
            />
          </span>
        )}
        <Surface
          ref={pillRef}
          shape="pill"
          material={bar}
          radius={tokens.pillRadius}
          expressiveness={tier}
          unit={tokens.pillHeight * 4}
          className={styles.pill}
        >
          <div ref={rowRef} className={styles.row}>
            <span
              ref={indicatorRef}
              className={styles.pillIndicator}
              data-flat={tier === 'flat' || undefined}
              aria-hidden="true"
            />
            <a
              ref={logoRef}
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
            <LinkList links={links} active={current} />

            <button
              type="button"
              className={styles.cmd}
              data-id="cmd"
              data-lit={pillTarget === 'cmd' || undefined}
              aria-haspopup="dialog"
              aria-keyshortcuts="Meta+K Control+K"
              onClick={() => setPaletteOpen(true)}
              onPointerEnter={() => setHovered('cmd')}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => {
                setFocused('cmd');
                setHovered('cmd');
              }}
              onBlur={() => {
                setFocused(null);
                setHovered(null);
              }}
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
          {mode === 'collapsed' && <LinkList links={links} active={current} />}
        </div>
      </nav>
      <CmdPalette />
    </div>
  );
}

function LinkList({
  links,
  active,
}: {
  links: NavLink[];
  active: string | null;
}) {
  const setHovered = useNavStore((st) => st.setHovered);
  const setFocused = useNavStore((st) => st.setFocused);
  const target = useNavStore((st) => st.hovered) ?? active;
  return (
    <ul className={styles.links}>
      {links.map((l) => (
        <li key={l.id}>
          <a
            className={styles.link}
            href={l.href}
            data-id={l.id}
            data-lit={target === l.id || undefined}
            aria-current={active === l.id ? 'page' : undefined}
            onPointerEnter={() => setHovered(l.id)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => {
              setFocused(l.id);
              setHovered(l.id);
            }}
            onBlur={() => {
              setFocused(null);
              setHovered(null);
            }}
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
