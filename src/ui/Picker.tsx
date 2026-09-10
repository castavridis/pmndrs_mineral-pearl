import { useId, type ReactNode, type RefObject } from 'react';
import { ReturnIcon, SearchIcon } from './Icons';
import styles from './Picker.module.css';

export interface PickerItem {
  id: string;
  label: string;
  /** One line under the title. */
  description?: string;
  /** Breadcrumb under the description, e.g. "authoring / sandpack". */
  meta?: string;
}

export interface PickerProps {
  items: PickerItem[];
  query: string;
  onQueryChange: (q: string) => void;
  /** Index of the highlighted row. */
  index: number;
  onIndexChange: (i: number) => void;
  onSelect: (item: PickerItem, index: number) => void;
  /** Called by the esc badge and the Escape key. */
  onDismiss?: () => void;
  /** Caption above the card ("Search" in the reference); omit for none. */
  caption?: ReactNode;
  placeholder?: string;
  /** Accessible name for the input. */
  inputLabel?: string;
  /** Accessible name for the list. */
  listLabel?: string;
  emptyLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Marks where `query` occurs in `text`, expanded to whole words — the reference highlights
 * the matched word ("sandpack" → "Sandpack"), not the typed fragment, which would otherwise
 * split a word in two.
 */
const WORD = /[\p{L}\p{N}_-]/u;

function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle, from); at !== -1; at = lower.indexOf(needle, from)) {
    let start = at;
    let end = at + needle.length;
    while (start > 0 && WORD.test(text[start - 1]!)) start--;
    while (end < text.length && WORD.test(text[end]!)) end++;
    if (start > from) out.push(text.slice(from, start));
    out.push(<mark key={start}>{text.slice(start, end)}</mark>);
    from = end;
  }
  if (from === 0) return text;
  if (from < text.length) out.push(text.slice(from));
  return out;
}

/**
 * The command picker's presentation: search row with an esc badge, then results with the
 * matched term highlighted, a description, a breadcrumb and a return mark on the selected
 * row (reference/ui-screenshots/picker).
 *
 * State is the caller's — this renders what it is given, so it can sit in a dialog (the nav's
 * ⌘K palette), a page section, or anywhere else.
 */
export function Picker({
  items,
  query,
  onQueryChange,
  index,
  onIndexChange,
  onSelect,
  onDismiss,
  caption = 'Search',
  placeholder = 'Search…',
  inputLabel = 'Search',
  listLabel = 'Results',
  emptyLabel = 'No matches',
  inputRef,
}: PickerProps) {
  const listId = useId();
  const active = items[index];

  return (
    <div className={styles.wrap}>
      {caption && (
        <div className={styles.caption}>
          <span className={styles.captionMark} aria-hidden="true">
            ✦
          </span>
          {caption}
        </div>
      )}
      <div className={styles.card}>
        <div className={styles.search}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            placeholder={placeholder}
            aria-label={inputLabel}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              onIndexChange(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                onIndexChange(Math.min(index + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                onIndexChange(Math.max(index - 1, 0));
              } else if (e.key === 'Enter' && active) {
                e.preventDefault();
                onSelect(active, index);
              }
            }}
          />
          {onDismiss && (
            <button type="button" className={styles.esc} onClick={onDismiss}>
              esc
            </button>
          )}
        </div>
        <ul id={listId} role="listbox" className={styles.list} aria-label={listLabel}>
          {items.length === 0 && (
            <li className={styles.empty} role="option" aria-selected="false">
              {emptyLabel}
            </li>
          )}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={i === index}
              className={styles.item}
              data-selected={i === index || undefined}
              onMouseEnter={() => onIndexChange(i)}
              onClick={() => onSelect(item, i)}
            >
              <div className={styles.title}>{highlight(item.label, query)}</div>
              {item.description && <div className={styles.description}>{item.description}</div>}
              {(item.meta || i === index) && (
                <div className={styles.meta}>
                  <span>{item.meta}</span>
                  {i === index && (
                    <span className={styles.enter} aria-hidden="true">
                      <ReturnIcon />
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
