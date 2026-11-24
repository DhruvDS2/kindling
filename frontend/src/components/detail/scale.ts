// The shared time frame for the year-long charts: one x-scale (start of the simulated
// year → as_of), the same gutters, so the usage and score charts line up week for week.
import type { Span } from './model';

export const PAD_L = 36;   // room for y tick labels
export const PAD_R = 10;

export const COLORS = {
  activity: 'var(--body)',
  schoolDays: 'var(--ember)',     // Kindling: school-day windows
  calendar: 'var(--naive)',       // the naive baseline: calendar-day windows
  break: 'var(--break-shade)',
  grid: 'var(--row-divider)',
  axis: 'var(--line)',
};
export const SUMMER_OPACITY = 0.5;   // summer is shaded more lightly than a break

export interface XScale {
  d0: number;          // first day (inclusive)
  d1: number;          // day after the last one (exclusive)
  left: number;
  right: number;
  x: (n: number) => number;        // left edge of day n
  inv: (px: number) => number;     // day under pixel px
}

export function makeX(d0: number, d1: number, width: number, left = PAD_L, right = PAD_R): XScale {
  const r = Math.max(left + 1, width - right);
  const k = (r - left) / Math.max(1, d1 - d0);
  return { d0, d1, left, right: r, x: n => left + (n - d0) * k, inv: px => Math.floor(d0 + (px - left) / k) };
}

/** Clip an inclusive day span to the frame, as pixel [x0, x1]. Null if it falls outside. */
export function spanPx(xs: XScale, s: Span): [number, number] | null {
  const a = Math.max(s.start, xs.d0), b = Math.min(s.end + 1, xs.d1);
  return a < b ? [xs.x(a), xs.x(b)] : null;
}

/** A bar with a 4px rounded data-end and a square baseline. */
export function barPath(x0: number, x1: number, top: number, bottom: number): string {
  const w = x1 - x0, h = bottom - top;
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${bottom}Z`;
}

export const compact = (v: number) => (v >= 10_000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-US'));

export const MONO = 'JetBrains Mono, monospace';
