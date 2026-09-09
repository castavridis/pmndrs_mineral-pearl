'use client';

import { useEffect, useState } from 'react';
import { useSurfaceTier, type SurfaceTier } from '../surface/Surface';
import type { NavLink } from './types';
import { createNavStore, NavStoreContext, useNavStore, useNavStoreApi, watchReducedMotion } from './store';
import { Nav2D } from './Nav2D';
import styles from './Nav.module.css';

/** `auto` runs the gates (WebGL, the shaders switch, reduced motion); the others force a tier. */
export type EnhancementLevel = 'auto' | SurfaceTier;

export interface NavProps {
  /** Middle links. Logo and Cmd are always present and are not part of this list. */
  links: NavLink[];
  /**
   * `auto` (default) runs the gate; the others force a tier. In dev,
   * `?nav=full|calm|flat` overrides `auto`.
   */
  enhancement?: EnhancementLevel;
  /**
   * Id of the current page's link. When omitted, the link whose href equals
   * `location.pathname` is used. Pass this from your router for client-side navigation.
   */
  active?: string | null;
}

const override = (): SurfaceTier | null => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('nav');
  return v === 'full' || v === 'calm' || v === 'flat' ? v : null;
};

/**
 * Public entry. Renders the DOM nav immediately; the pill's surface is the
 * page's liquid where it can run (WebGL, shaders on), a flat outline where
 * it cannot. The DOM is the a11y/SEO source of truth in every tier.
 */
export function Nav({ links, enhancement = 'auto', active }: NavProps) {
  const [store] = useState(() => createNavStore({ links }));
  return (
    <NavStoreContext.Provider value={store}>
      <NavInner links={links} enhancement={enhancement} active={active} />
    </NavStoreContext.Provider>
  );
}

function NavInner({ links, enhancement: requested, active }: Required<Omit<NavProps, 'active'>> & Pick<NavProps, 'active'>) {
  const setLinks = useNavStore((s) => s.setLinks);
  const setActive = useNavStore((s) => s.setActive);
  const isLiquid = useNavStore((s) => s.isLiquid);
  const setIsLiquid = useNavStore((s) => s.setIsLiquid);
  const api = useNavStoreApi();
  const [forced] = useState(override);
  const wanted: SurfaceTier = requested === 'auto' ? (forced ?? 'full') : requested;
  const tier = useSurfaceTier(wanted);

  useEffect(() => setLinks(links), [links, setLinks]);
  useEffect(() => {
    if (active !== undefined) setActive(active);
  }, [active, setActive]);
  useEffect(() => watchReducedMotion(api), [api]);
  useEffect(() => setIsLiquid(tier !== 'flat'), [tier, setIsLiquid]);

  return (
    <div className={styles.root} data-liquid={isLiquid || undefined} data-enhancement={tier}>
      <Nav2D links={links} tier={tier} />
    </div>
  );
}
