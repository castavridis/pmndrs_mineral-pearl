import { useState } from 'react';
import { useThemeStore } from '../theme';

/**
 * A banner's dismissal, undone by the next change of theme: `[gone, dismiss]`
 * for the page that mounts the banner. Pass `dismiss` as the banner's
 * `onDismiss` and leave the banner out while `gone`.
 *
 * Once a change of theme has run its course — its ink has cleared, or at once
 * for a change without ink — a dismissed banner is back: it mounts afresh,
 * under the new scheme's liquid, and surfaces into it as it did on load.
 * Nothing is remembered past the visit.
 */
export function useDismissal(): [gone: boolean, dismiss: () => void] {
  const changes = useThemeStore((s) => s.changes);
  const phase = useThemeStore((s) => s.pending?.phase ?? null);
  // the count the dismissal belongs to. One made while a change's ink is still
  // landing belongs to the change about to commit, so that change does not
  // undo it.
  const [goneAt, setGoneAt] = useState<number | null>(null);
  const gone = goneAt !== null && (goneAt === changes || phase !== null);
  const dismiss = () => setGoneAt(phase === 'splat' ? changes + 1 : changes);
  return [gone, dismiss];
}
