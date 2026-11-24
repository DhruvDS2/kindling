// Usage over the simulated year, by week, with the school's own breaks shaded and the
// two scoring windows drawn as brackets under the bars.
import { useMemo, useState } from 'react';
import type { SchoolDetail, UsageDay } from '../../types';
import { type Metric, type Span, METRIC, binValue, dayNum, niceTicks, rangeLabel, isoOf, weeklyBins } from './model';
import { MonthAxis, Shading, YTicks } from './timeAxis';
import { COLORS, PAD_L, barPath, compact, makeX, spanPx } from './scale';
import { ChartTip, TipRow } from './ui';

const PLOT_TOP = 6;
const PLOT_H = 132;
const TRACK_H = 8;
const PRIOR_OPACITY = 0.35;

interface Props {
  width: number;
  days: UsageDay[];
  d0: number;          // first day of the simulated year
  asOf: number;
  breaks: Span[];
  summers: Span[];
  windows: SchoolDetail['windows'] | null;
  metric: Metric;
}

export default function UsageChart({ width, days, d0, asOf, breaks, summers, windows, metric }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const bins = useMemo(() => weeklyBins(days, d0, asOf), [days, d0, asOf]);
  const xs = makeX(d0, asOf + 1, width);
  const max = Math.max(0, ...bins.map(b => binValue(b, metric)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const bottom = PLOT_TOP + PLOT_H;
  const y = (v: number) => bottom - (v / top) * PLOT_H;
  const axisY = bottom;
  const track1 = axisY + 26;
  const track2 = track1 + 18;
  const height = track2 + TRACK_H + 4;

  const hovered = hover === null ? null : bins.find(b => hover >= b.start && hover <= b.end) ?? null;

  const tracks = windows ? [
    { key: 'sd', w: windows.school_days, y: track1, color: COLORS.schoolDays,
      label: `Last ${windows.school_days.length} school days + prior ${windows.school_days.length}` },
    { key: 'cal', w: windows.calendar, y: track2, color: COLORS.calendar,
      label: `Last ${windows.calendar.length} calendar days + prior ${windows.calendar.length}` },
  ] : [];

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" style={{ display: 'block', overflow: 'visible' }}
        aria-label={`${METRIC[metric].weekly}, ${rangeLabel(isoOf(d0), isoOf(asOf))}, with school breaks shaded`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          setHover(px >= xs.left && px <= xs.right ? xs.inv(px) : null);
        }}>
        <Shading xs={xs} breaks={breaks} summers={summers} top={PLOT_TOP} height={height - 2 - PLOT_TOP} />
        <YTicks ticks={ticks} y={y} left={PAD_L} right={xs.right} fmt={compact} />
        {hovered && (() => {
          const px = spanPx(xs, { start: hovered.start, end: hovered.end });
          return px && <rect x={px[0]} y={PLOT_TOP} width={px[1] - px[0]} height={PLOT_H} style={{ fill: 'var(--ink)', fillOpacity: 0.05 }} />;
        })()}
        {bins.map(b => {
          const v = binValue(b, metric);
          if (v <= 0) return null;
          let x0 = xs.x(b.start) + 1, x1 = xs.x(b.end + 1) - 1;   // 2px gap between weeks
          if (x1 - x0 > 24) { const c = (x0 + x1) / 2; x0 = c - 12; x1 = c + 12; }
          if (x1 - x0 < 1) x1 = x0 + 1;
          return <path key={b.start} d={barPath(x0, x1, y(v), bottom)} style={{ fill: COLORS.activity }} />;
        })}
        <MonthAxis xs={xs} y={axisY} />

        {tracks.map(t => {
          const segs = [
            { start: t.w.prev_start, end: t.w.prev_end, opacity: PRIOR_OPACITY },
            { start: t.w.start, end: t.w.end, opacity: 1 },
          ].flatMap(s => {
            if (!s.start || s.start > s.end) return [];
            const px = spanPx(xs, { start: dayNum(s.start), end: dayNum(s.end) });
            return px ? [{ px, opacity: s.opacity }] : [];
          });
          if (!segs.length) return null;
          const leftmost = Math.min(...segs.map(s => s.px[0]));
          const room = leftmost - 8 - PAD_L;
          return (
            <g key={t.key}>
              {room >= t.label.length * 5.6 && (
                <text x={leftmost - 8} y={t.y + TRACK_H - 0.5} textAnchor="end" style={{ fontSize: 11, fill: 'var(--muted)' }}>{t.label}</text>
              )}
              {segs.map((s, i) => (
                <rect key={i} x={s.px[0] + 0.5} y={t.y} width={Math.max(1, s.px[1] - s.px[0] - 1)} height={TRACK_H} rx={2}
                  style={{ fill: t.color, fillOpacity: s.opacity }} />
              ))}
            </g>
          );
        })}
      </svg>
      {hovered && hover !== null && (
        <ChartTip x={xs.x(hover)} width={width}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{rangeLabel(isoOf(hovered.start), isoOf(hovered.end))}</div>
          <TipRow label="School days" value={hovered.schoolDays} />
          <TipRow label="Teacher-days" value={hovered.teachers.toLocaleString('en-US')} swatch={metric === 'teachers' ? COLORS.activity : undefined} />
          <TipRow label="Student sessions" value={hovered.sessions.toLocaleString('en-US')} swatch={metric === 'sessions' ? COLORS.activity : undefined} />
          {hovered.schoolDays === 0 && <div style={{ color: 'var(--muted)', marginTop: 2 }}>No school this week</div>}
        </ChartTip>
      )}
    </div>
  );
}

