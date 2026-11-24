// Axis and shading pieces for the year-long charts (scale and colors live in scale.ts).
import type { Span } from './model';
import { monthLabel, monthStarts } from './model';
import { COLORS, MONO, SUMMER_OPACITY, type XScale, spanPx } from './scale';

export function Shading({ xs, breaks, summers, top, height, labels = true }: {
  xs: XScale; breaks: Span[]; summers: Span[]; top: number; height: number; labels?: boolean;
}) {
  const band = (s: Span, i: number, kind: 'Break' | 'Summer') => {
    const px = spanPx(xs, s);
    if (!px) return null;
    const w = px[1] - px[0];
    return (
      <g key={`${kind}-${i}`}>
        <rect x={px[0]} y={top} width={w} height={height}
          style={{ fill: COLORS.break, fillOpacity: kind === 'Summer' ? SUMMER_OPACITY : 1 }} />
        {labels && w >= (kind === 'Summer' ? 44 : 30) && (
          <text x={px[0] + 4} y={top + 11} style={{ fontSize: 10, fill: 'var(--muted)' }}>{kind}</text>
        )}
      </g>
    );
  };
  return <g aria-hidden>{summers.map((s, i) => band(s, i, 'Summer'))}{breaks.map((s, i) => band(s, i, 'Break'))}</g>;
}

export function MonthAxis({ xs, y }: { xs: XScale; y: number }) {
  const months = monthStarts(xs.d0, xs.d1);
  return (
    <g aria-hidden>
      <line x1={xs.left} x2={xs.right} y1={y} y2={y} style={{ stroke: COLORS.axis }} />
      {months.map(n => {
        const x = xs.x(n);
        if (xs.right - x < 22) return null;   // no room for a label at the very end
        return (
          <g key={n}>
            <line x1={x} x2={x} y1={y} y2={y + 4} style={{ stroke: COLORS.axis }} />
            <text x={x + 3} y={y + 14} style={{ fontSize: 10, fill: 'var(--muted)' }}>{monthLabel(n)}</text>
          </g>
        );
      })}
    </g>
  );
}

export function YTicks({ ticks, y, left, right, fmt = String }: {
  ticks: number[]; y: (v: number) => number; left: number; right: number; fmt?: (v: number) => string;
}) {
  return (
    <g aria-hidden>
      {ticks.map(t => (
        <g key={t}>
          {t > 0 && <line x1={left} x2={right} y1={y(t)} y2={y(t)} style={{ stroke: COLORS.grid }} />}
          <text x={left - 6} y={y(t) + 3} textAnchor="end" style={{ fontSize: 10, fill: 'var(--muted)', fontFamily: MONO }}>
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  );
}
