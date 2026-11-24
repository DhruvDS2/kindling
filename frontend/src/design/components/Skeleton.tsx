import type { CSSProperties } from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  /** Width as a percentage or token, e.g. '60%' or 'var(--size-meter)'. Default 100%. */
  width?: string;
  /** Height token. Default: one line of body text. */
  height?: 'line' | 'label' | 'display' | 'control';
  className?: string;
}

/** A gray bar shaped like the content it stands in for. No spinners (DESIGN.md §7). */
export function Skeleton({ width = '100%', height = 'line', className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={['k-skeleton', `k-skeleton--${height}`, className ?? ''].join(' ').trim()}
      style={{ '--k-w': width } as CSSProperties}
    />
  );
}
