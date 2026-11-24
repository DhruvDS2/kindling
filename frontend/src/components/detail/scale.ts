// The shared time frame for the year-long charts: one x-scale (start of the simulated
// year → as_of), the same gutters, so the usage and score charts line up week for week.
// Colors are design tokens only (DESIGN.md §5): Kindling's school-day reading is ink, the
// naive calendar-day reading is the naive gray, breaks and summer use the data shades.
import type { Span } from './model';

export const PAD_L = 36;   // room for y tick labels (SVG geometry)
export const PAD_R = 8;

export const COLORS = {
  kindling: 'var(--text-primary)',     // school-day windows (what Kindling scores)
  naive: 'var(--data-naive)',          // calendar-day windows (the naive baseline)
  teachers: 'var(--text-primary)',     // the active-teachers line
  sessions: 'var(--text-tertiary)',    // the student-session bars
  // Breaks and summer: --kd-break (detail.css) is --data-break, except in dark mode, where
  // --data-break and --data-summer are tuned for --bg-page and vanish on the drawer's surface.
  // Summer is the break shade at half strength, so it reads as lighter in both themes.
  break: 'var(--kd-break)',
  summer: 'var(--kd-break)',
  grid: 'var(--border-faint)',
  axis: 'var(--border-hairline)',
  surface: 'var(--bg-surface)',
};

export const SUMMER_OPACITY = 0.5;

/** Opacity of the prior window next to the current one (same hue, lighter). */
export const PRIOR_OPACITY = 0.4;

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

/** A bar with a rounded data-end (at most 4 units) and a square baseline. */
export function barPath(x0: number, x1: number, top: number, bottom: number): string {
  const w = x1 - x0, h = bottom - top;
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${bottom}Z`;
}

/** A bar's x-extent inside a slot: a 2-unit surface gap between neighbours, never wider than 24. */
export function barSlot(x0: number, x1: number, max = 24): [number, number] {
  let a = x0 + 1, b = x1 - 1;
  if (b - a > max) { const c = (a + b) / 2; a = c - max / 2; b = c + max / 2; }
  if (b - a < 1) b = a + 1;
  return [a, b];
}

export const compact = (v: number) => (v >= 10_000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-US'));
