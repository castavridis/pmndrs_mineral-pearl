import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon } from './Icons';
import styles from './CopyButton.module.css';

export interface CopyAction {
  key: string;
  /** Glyph for the action; give `label` for its accessible name. */
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  /** Resting and confirmed labels; omit `label` for a glyph-only button. */
  label?: string;
  copiedLabel?: string;
  /** Extra actions sharing the green bar, as in the reference screenshot. */
  actions?: CopyAction[];
  /** How long the confirmation shows, ms. */
  resetAfter?: number;
  className?: string;
}

/**
 * Copy control on the brand green, the same in light and dark. Shows a confirmation for a
 * moment after copying, and can host sibling actions in the same bar (the row of glyphs in
 * reference/ui-screenshots/"copy (dark and light)").
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied!',
  actions,
  resetAfter = 1600,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), resetAfter);
  };

  return (
    <div className={[styles.bar, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={`${styles.action} ${label ? '' : styles.iconOnly}`}
        onClick={copy}
        // The label changes under the pointer, so announce it rather than the click.
        aria-live="polite"
        aria-label={label ? undefined : copied ? copiedLabel : label}
      >
        <span className={styles.glyph} aria-hidden="true">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
        {label && (
          // Both strings occupy the cell, so the bar keeps one width across the swap.
          <span className={styles.label}>
            <span aria-hidden="true" className={styles.ghost}>
              {label.length >= copiedLabel.length ? label : copiedLabel}
            </span>
            <span>{copied ? copiedLabel : label}</span>
          </span>
        )}
      </button>
      {actions?.length ? <span className={styles.divider} aria-hidden="true" /> : null}
      {actions?.map((a) =>
        a.href ? (
          <a
            key={a.key}
            className={`${styles.action} ${styles.iconOnly}`}
            href={a.href}
            aria-label={a.label}
          >
            <span className={styles.glyph} aria-hidden="true">
              {a.icon}
            </span>
          </a>
        ) : (
          <button
            key={a.key}
            type="button"
            className={`${styles.action} ${styles.iconOnly}`}
            onClick={a.onClick}
            aria-label={a.label}
          >
            <span className={styles.glyph} aria-hidden="true">
              {a.icon}
            </span>
          </button>
        )
      )}
    </div>
  );
}
