import { create } from 'zustand';
import type { InkSplatHandle } from '../components';

// The splat page's controls (leva buttons) reach the mounted splat through
// this store rather than through a ref read during render.
interface SplatPageState {
  splat: InkSplatHandle | null;
  setSplat: (handle: InkSplatHandle | null) => void;
  settled: boolean;
  setSettled: (settled: boolean) => void;
}

export const useSplatPage = create<SplatPageState>((set) => ({
  splat: null,
  setSplat: (splat) => set({ splat }),
  settled: false,
  setSettled: (settled) => set({ settled }),
}));

export const replay = () => useSplatPage.getState().splat?.splat();
