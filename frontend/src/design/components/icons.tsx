// Simple line icons for controls (never decoration). 16×16 grid, 1.5 stroke, currentColor.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { small?: boolean };

function Svg({ small, className, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={['k-icon', small ? 'k-icon--sm' : '', className ?? ''].join(' ').trim()}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (p: IconProps) => <Svg {...p}><path d="M10 3.5 5.5 8l4.5 4.5" /></Svg>;
export const ChevronRight = (p: IconProps) => <Svg {...p}><path d="M6 3.5 10.5 8 6 12.5" /></Svg>;
export const ChevronUp = (p: IconProps) => <Svg {...p}><path d="M3.5 10 8 5.5l4.5 4.5" /></Svg>;
export const ChevronDown = (p: IconProps) => <Svg {...p}><path d="M3.5 6 8 10.5 12.5 6" /></Svg>;
export const Close = (p: IconProps) => <Svg {...p}><path d="M4 4l8 8M12 4l-8 8" /></Svg>;
export const Search = (p: IconProps) => <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>;
export const ArrowRight = (p: IconProps) => <Svg {...p}><path d="M3 8h10M9 4l4 4-4 4" /></Svg>;
export const Reset = (p: IconProps) => <Svg {...p}><path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2" /><path d="M3.5 2.75V5.5h2.75" /></Svg>;
