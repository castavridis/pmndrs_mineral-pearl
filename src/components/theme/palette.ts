/**
 * The official pmndrs palette. These are the same nine colours the pond's
 * `brand()` spectrum runs through, and the same set the sibling repo tints its
 * glass with, so a kind, a facet of nacre and a glass petal all agree.
 */
export const palette = {
  dark: '#36342f',
  light: '#eae5da',
  purple: '#d855f9',
  red: '#ff4980',
  orange: '#ffc043',
  yellow: '#ebff0f',
  green: '#caf543',
  teal: '#00f7a3',
  blue: '#2bdcf6',
} as const;

export type PaletteName = keyof typeof palette;

const hex = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const to2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Mix `a` toward `b` by `t` (0..1), as concrete hex — three has to parse these. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const m = (x: number, y: number) => to2(x + (y - x) * t);
  return `#${m(ar!, br!)}${m(ag!, bg!)}${m(ab!, bb!)}`;
}
