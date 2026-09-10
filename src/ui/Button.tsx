import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from './Icons';
import styles from './Button.module.css';

type Common = {
  children?: ReactNode;
  /** Square button for a lone glyph; pass `aria-label` when you use it. */
  icon?: boolean;
  size?: 'default' | 'small';
  /** Trailing chevron that flips while `aria-expanded` is true (popover triggers). */
  chevron?: boolean;
  className?: string;
};

// ComponentProps carries `ref` too (React 19 passes it as a plain prop).
export type ButtonProps = Common & ComponentProps<'button'>;
export type ButtonLinkProps = Common & ComponentProps<'a'> & { href: string };

const classes = ({ icon, size, className }: Common) =>
  [styles.button, icon && styles.icon, size === 'small' && styles.small, className]
    .filter(Boolean)
    .join(' ');

/**
 * The utilitarian control: flat surface, hairline border, 10px corners, in both themes.
 * Used for ⌘K, the social links and popover triggers.
 */
export function Button({
  children,
  icon,
  size,
  chevron,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={classes({ icon, size, className })} {...rest}>
      {children}
      {chevron && <ChevronDownIcon className={styles.chevron} />}
    </button>
  );
}

/** The same control as a link, for destinations rather than actions. */
export function ButtonLink({ children, icon, size, chevron, className, ...rest }: ButtonLinkProps) {
  return (
    <a className={classes({ icon, size, className })} {...rest}>
      {children}
      {chevron && <ChevronDownIcon className={styles.chevron} />}
    </a>
  );
}

/** Keyboard hint inside a button, e.g. the K of ⌘K. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
