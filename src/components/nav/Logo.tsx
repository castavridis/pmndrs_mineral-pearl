import type { SVGProps } from 'react';

/**
 * pmndrs mark, inline so it renders with no network request and inherits
 * `currentColor`. The path data is `reference/logo.svg` verbatim (an 800 unit
 * box on a 40 unit grid); only the fills are dropped so the ink is inherited.
 *
 * The same mark is carried a second time as an SDF in the ink splat's shader
 * (`logoSDF` in `ink-splat/shaders.ts`), which cannot consume a path. Change
 * one and check the other.
 */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 800 800"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M520 560H280V800H520V560Z" />
      <path d="M520 280H280V520H520V280Z" />
      <path d="M240 280H0V520H240V280Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M560 0H280V240H560V520H800V0H560Z" />
    </svg>
  );
}
