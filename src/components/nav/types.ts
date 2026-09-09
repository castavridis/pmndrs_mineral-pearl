export interface NavLink {
  id: string;
  label: string;
  href: string;
}

/** Responsive layout mode. Driven by container width vs. measured content width. */
export type NavMode = 'full' | 'compact' | 'collapsed';

export const NAV_MODES: readonly NavMode[] = ['full', 'compact', 'collapsed'];
