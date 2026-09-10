export interface NavLink {
  id: string;
  label: string;
  href: string;
  /** One line under the title in the ⌘K picker. */
  description?: string;
  /** Breadcrumb under it, e.g. "docs / fiber". Defaults to the href's path. */
  section?: string;
}

/** Responsive layout mode. Driven by container width vs. measured content width. */
export type NavMode = 'full' | 'compact' | 'collapsed';

export const NAV_MODES: readonly NavMode[] = ['full', 'compact', 'collapsed'];
