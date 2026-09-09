import type { SVGProps } from 'react';

/** pmndrs logo, inline so it renders with no network request and inherits `currentColor`. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M9.8 -0.0L27.9 -0.0L28.0 0.0L28.0 18.1L28.0 18.2L19.6 18.2L19.6 8.7L19.4 8.5L19.3 8.4L9.8 8.4L9.8 0.0Z M0.0 9.1L9.1 9.1L9.1 18.1L9.1 18.2L0.0 18.2Z M9.9 18.9L18.8 18.9L18.9 18.9L18.9 28.0L9.8 28.0L9.8 18.9Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
