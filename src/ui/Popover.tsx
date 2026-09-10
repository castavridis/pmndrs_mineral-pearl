import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { ExternalIcon, RoseIcon } from './Icons';
import styles from './Popover.module.css';

export interface PopoverItem {
  key: string;
  label: string;
  /** Leading glyph; defaults to the pmndrs rose, as in the reference. */
  icon?: ReactNode;
  /** Trailing glyph; defaults to the external-link mark for items with an `href`. */
  trailing?: ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Draw a hairline above this item. */
  separatorBefore?: boolean;
}

export interface PopoverProps {
  /** Trigger text. */
  label: string;
  items: PopoverItem[];
  /** Align the panel to the trigger's right edge. */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * A menu on a button, per reference/ui-screenshots/popover (dark|light): roomy rows with a
 * leading glyph and a trailing external mark.
 *
 * Keyboard: Enter / Space / ArrowDown open and focus the first item, arrows and Home/End move,
 * Escape closes and returns focus to the trigger. Pointer: click outside closes.
 */
export function Popover({ label, items, align = 'left', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Close on outside pointer or Escape; Escape also returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const openAndFocus = () => {
    setOpen(true);
    // The panel mounts this commit; focus once it is in the document.
    requestAnimationFrame(() => focusItem(0));
  };

  return (
    <div ref={root} className={[styles.root, className].filter(Boolean).join(' ')}>
      <Button
        ref={trigger}
        chevron
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openAndFocus();
          }
        }}
      >
        {label}
      </Button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={`${styles.panel} ${align === 'right' ? styles.right : ''}`}
        >
          {items.map((item, i) => {
            const props = {
              role: 'menuitem',
              className: styles.item,
              tabIndex: -1,
              ref: (el: HTMLElement | null) => void (itemRefs.current[i] = el),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  focusItem(i + 1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusItem(i - 1);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  focusItem(0);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  focusItem(items.length - 1);
                }
              },
              onClick: () => {
                item.onSelect?.();
                setOpen(false);
              },
            };
            const body = (
              <>
                <span className={styles.leading} aria-hidden="true">
                  {item.icon ?? <RoseIcon />}
                </span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.trailing} aria-hidden="true">
                  {item.trailing ?? (item.href ? <ExternalIcon /> : null)}
                </span>
              </>
            );
            return (
              <div key={item.key}>
                {item.separatorBefore && <div className={styles.separator} role="separator" />}
                {item.href ? (
                  <a href={item.href} {...(props as React.ComponentProps<'a'>)}>
                    {body}
                  </a>
                ) : (
                  <button type="button" {...(props as React.ComponentProps<'button'>)}>
                    {body}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
