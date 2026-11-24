// Axis and shading pieces for the year-long charts (scale and colors live in scale.ts).
// Type and color come from classes in detail.css (tokens only); numbers here are SVG geometry.
import type { Span } from './model';
import { monthLabel, monthStarts } from './model';
import { COLORS, SUMMER_OPACITY, type XScale, spanPx } from './scale';

/** The school's own breaks (darker) and summer (lighter), from /calendars/{id}. */
export function Shading({ xs, breaks, summers, top, height, labels = true, part = 'both' }: {
  xs: XScale; breaks: Span[]; summers: Span[]; top: number; height: number; labels?: boolean;
  /** 'labels' draws only the words (with a knockout halo), so they can sit above guide lines. */
  part?: 'both' | 'fill' | 'labels';
}) {
  const band = (s: Span, i: number, kind: 'Break' | 'Summer') => {
    const px = spanPx(xs, s);
    if (!px) return null;
    const w = px[1] - px[0];
    const fill = kind === 'Summer' ? COLORS.summer : COLORS.break;
    const opacity = kind === 'Summer' ? SUMMER_OPACITY : 1;
    return (
      <g key={`${kind}-${i}`}>
        {part !== 'labels' && <rect x={px[0]} y={top} width={w} height={height} style={{ fill, fillOpacity: opacity }} />}
        {part !== 'fill' && labels && w >= (kind === 'Summer' ? 48 : 36) && (
          <text x={px[0] + 4} y={top + 12} className="kd-svg-label kd-svg-halo" style={{ stroke: fill, strokeOpacity: opacity }}>{kind}</text>
        )}
      </g>
    );
  };
  return <g aria-hidden="true">{summers.map((s, i) => band(s, i, 'Summer'))}{breaks.map((s, i) => band(s, i, 'Break'))}</g>;
}

export function MonthAxis({ xs, y, labels = true }: { xs: XScale; y: number; labels?: boolean }) {
  const months = monthStarts(xs.d0, xs.d1);
  return (
    <g aria-hidden="true">
      <line x1={xs.left} x2={xs.right} y1={y} y2={y} style={{ stroke: COLORS.axis }} />
      {labels && months.map(n => {
        const x = xs.x(n);
        if (xs.right - x < 24) return null;   // no room for a label at the very end
        return (
          <g key={n}>
            <line x1={x} x2={x} y1={y} y2={y + 4} style={{ stroke: COLORS.axis }} />
            <text x={x + 3} y={y + 16} className="kd-svg-label">{monthLabel(n)}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Y ticks: hairline grid (solid, recessive) and tabular labels in the left gutter. */
export function YTicks({ ticks, y, left, right, fmt = String }: {
  ticks: number[]; y: (v: number) => number; left: number; right: number; fmt?: (v: number) => string;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map(t => (
        <g key={t}>
          {t > 0 && <line x1={left} x2={right} y1={y(t)} y2={y(t)} style={{ stroke: COLORS.grid }} />}
          <text x={left - 8} y={y(t) + 4} textAnchor="end" className="kd-svg-label kd-svg-num">{fmt(t)}</text>
        </g>
      ))}
    </g>
  );
}
