import { useSyncExternalStore } from 'react';

// Progressive-enhancement gates shared by the components: everything renders
// as DOM first, and the ink layers only arrive where they can run.

const matchQuery = (query: string) =>
  typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query) : null;

const reducedQuery = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void) => {
  const mq = matchQuery(reducedQuery);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
};
const readReduced = () => matchQuery(reducedQuery)?.matches ?? false;
const readReducedServer = () => false;

/** True when the OS asks for reduced motion; the splat then lands already settled. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, readReducedServer);
}

let webgl: boolean | null = null;
const noop = () => () => {};
const detectWebGL = () => {
  if (webgl === null) {
    try {
      const canvas = document.createElement('canvas');
      webgl = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
};
const readWebGLServer = () => null;

/** Whether WebGL is available; `null` on the server and during hydration. */
export function useWebGL(): boolean | null {
  return useSyncExternalStore(noop, detectWebGL, readWebGLServer);
}
