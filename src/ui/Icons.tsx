/**
 * The glyph set the flat UI components need, drawn as strokes at 24×24 so they inherit
 * `currentColor` and scale with font size. Kept in one file so the folder stays portable.
 */
import type { SVGProps } from 'react';

const stroke = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

const solid = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
} as const;

export type IconProps = SVGProps<SVGSVGElement>;

export function SearchIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ExternalIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The ↵ mark shown on a picker's selected row. */
export function ReturnIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="M20 5v6a3 3 0 0 1-3 3H4" />
      <path d="m8 10-4 4 4 4" />
    </svg>
  );
}

export function CopyIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h9" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

export function TerminalIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="m5 7 5 5-5 5M13 17h6" />
    </svg>
  );
}

export function BoltIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <path d="M13 3 5 14h6l-1 7 8-11h-6z" />
    </svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 16.5V11M12 8h.01" />
    </svg>
  );
}

export function GitHubIcon(p: IconProps) {
  return (
    <svg {...solid} {...p}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

export function TwitterIcon(p: IconProps) {
  return (
    <svg {...solid} {...p}>
      <path d="M17.2 3h3.3l-7.2 8.2L22 21h-6.6l-5.2-6.7L4.2 21H.9l7.7-8.8L.6 3h6.8l4.7 6.2zm-1.2 16h1.8L7.9 4.8H6z" />
    </svg>
  );
}

export function DiscordIcon(p: IconProps) {
  return (
    <svg {...solid} {...p}>
      <path d="M19.3 5.4A16.9 16.9 0 0 0 15.1 4l-.3.6a12.6 12.6 0 0 1 3.7 1.9 13.5 13.5 0 0 0-12.9 0A12.6 12.6 0 0 1 9.3 4.6L9 4a16.9 16.9 0 0 0-4.2 1.4C2.1 9.4 1.4 13.3 1.7 17.1A17 17 0 0 0 6.9 20l1-1.5c-.9-.3-1.7-.7-2.4-1.2l.5-.4a12.1 12.1 0 0 0 10.1 0l.5.4c-.8.5-1.6.9-2.4 1.2l1 1.5a17 17 0 0 0 5.2-2.9c.4-4.4-.7-8.3-2.9-11.7zM8.7 14.8c-1 0-1.8-.9-1.8-2.1s.8-2.1 1.8-2.1 1.9.9 1.8 2.1c0 1.2-.8 2.1-1.8 2.1zm6.6 0c-1 0-1.8-.9-1.8-2.1s.8-2.1 1.8-2.1 1.9.9 1.8 2.1c0 1.2-.8 2.1-1.8 2.1z" />
    </svg>
  );
}

/** The pmndrs rose, used as the leading glyph in popover items. */
export function RoseIcon(p: IconProps) {
  return (
    <svg {...stroke} {...p}>
      <circle cx="8.5" cy="8" r="3.6" />
      <path d="M8.5 4.4c1.6 0 2.6 1.3 2.6 2.6M6 10.4c-.7-.8-.8-2 0-2.8" />
      <path d="M11 10.6 20 20M16.4 16l1.8-1.8M18.6 18.2l1.8-1.8" />
    </svg>
  );
}
