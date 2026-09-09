'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavStore } from './store';
import styles from './CmdPalette.module.css';

/**
 * Minimal command palette owned by the nav. Opened by the "Cmd" item or ⌘K / Ctrl+K.
 * Lists the nav links (plus the logo/home) and navigates on selection.
 */
export function CmdPalette() {
  const open = useNavStore((s) => s.paletteOpen);
  const setOpen = useNavStore((s) => s.setPaletteOpen);
  const links = useNavStore((s) => s.links);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listId = useId();

  // Global shortcut. Toggle from the dialog's real state: after Escape the <dialog> is
  // already closed while its `close` event (which syncs the store) is still queued.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!dialogRef.current?.open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Sync <dialog> with the store.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      inputRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const items = useMemo(() => {
    const all = [{ id: 'logo', label: 'Home', href: '/' }, ...links];
    const q = query.trim().toLowerCase();
    return q ? all.filter((l) => l.label.toLowerCase().includes(q)) : all;
  }, [links, query]);

  const go = (href: string) => {
    setOpen(false);
    window.location.assign(href);
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Command palette"
      // `cancel` fires synchronously on Escape; `close` is queued. If the palette was
      // re-opened before the queued `close` lands, that stale event must not close it.
      onCancel={() => setOpen(false)}
      onClose={(e) => {
        if (!e.currentTarget.open) {
          setOpen(false);
          setQuery('');
          setIndex(0);
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className={styles.panel}>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          placeholder="Where to?"
          aria-label="Search pages"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items[index] ? `${listId}-${items[index].id}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && items[index]) {
              e.preventDefault();
              go(items[index].href);
            }
          }}
        />
        <ul id={listId} role="listbox" className={styles.list} aria-label="Pages">
          {items.length === 0 && (
            <li className={styles.empty} role="option" aria-selected="false">
              No matches
            </li>
          )}
          {items.map((l, i) => (
            <li
              key={l.id}
              id={`${listId}-${l.id}`}
              role="option"
              aria-selected={i === index}
              className={styles.item}
              data-selected={i === index || undefined}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(l.href)}
            >
              {l.label}
              <span className={styles.href}>{l.href}</span>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
