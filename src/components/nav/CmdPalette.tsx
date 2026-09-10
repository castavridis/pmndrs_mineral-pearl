'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Picker, type PickerItem } from '../../ui/Picker';
import { useNavStore } from './store';
import styles from './CmdPalette.module.css';

/**
 * Minimal command palette owned by the nav. Opened by the "Cmd" item or ⌘K / Ctrl+K.
 * Lists the nav links (plus the logo/home) and navigates on selection. The panel
 * itself is the shared `Picker` (`src/ui`), so it matches the rest of the flat set.
 */
export function CmdPalette() {
  const open = useNavStore((s) => s.paletteOpen);
  const setOpen = useNavStore((s) => s.setPaletteOpen);
  const links = useNavStore((s) => s.links);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

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

  const items = useMemo<(PickerItem & { href: string })[]>(() => {
    const all = [{ id: 'logo', label: 'Home', href: '/' }, ...links];
    const q = query.trim().toLowerCase();
    const matched = q ? all.filter((l) => l.label.toLowerCase().includes(q)) : all;
    return matched.map((l) => ({
      id: l.id,
      label: l.label,
      description: 'description' in l ? l.description : undefined,
      // Breadcrumb: the explicit section, else the href read as a path.
      meta: ('section' in l && l.section) || l.href.replace(/^\//, '').split('/').join(' / ') || 'home',
      href: l.href,
    }));
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
      <Picker
        items={items}
        query={query}
        onQueryChange={setQuery}
        index={index}
        onIndexChange={setIndex}
        onSelect={(item) => go((item as PickerItem & { href: string }).href)}
        onDismiss={() => setOpen(false)}
        inputRef={inputRef}
        placeholder="Where to?"
        inputLabel="Search pages"
        listLabel="Pages"
      />
    </dialog>
  );
}
