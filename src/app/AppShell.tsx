import type { ReactNode } from 'react';
import { InkThemeToggle, InkThemeTransition, LiquidGround, ThemeApplier } from '../components';

/**
 * Everything around a page: theme handling, the ink transition overlay and
 * the fixed toggle. The toggle comes after the page in DOM order so the page
 * keeps the first Tab stop; it sits above the overlay so it stays visible
 * while the ink lands. `toggle={false}` leaves it out for a page that puts a
 * theme switch of its own somewhere in the content.
 */
export function AppShell({ children, toggle = true }: { children: ReactNode; toggle?: boolean }) {
  return (
    <>
      <ThemeApplier />
      <LiquidGround fixed />
      {children}
      <InkThemeTransition />
      {toggle && <InkThemeToggle style={{ position: 'fixed', top: 16, left: 16, zIndex: 60 }} />}
    </>
  );
}
