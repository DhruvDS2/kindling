// Weekly score every Monday: school-day windows (Kindling, ink) vs calendar-day windows
// (naive, gray), on the same time frame as the usage chart, with the one status line from
// /meta. Flagged weeks get a status-colored dot, and the legend prints the status word.
import { useMemo, useState } from 'react';
import type { HistoryPoint } from '../../types';
import { statusTone } from '../../design';
import { type Span, dayNum, flagFor, short, weekday } from './model';
import { MonthAxis, Shading, YTicks } from './timeAxis';
import { COLORS, PAD_L, makeX } from './scale';
import { ChartTip, Key, TipRow } from './ui';

const PLOT_TOP = 8;
const PLOT_H = 112;

interface Props {
  width: number;
  kind: 'pql' | 'health';
  threshold: number;
  kindling: HistoryPoint[];
  naive: HistoryPoint[];
  d0: number;
  asOf: number;
  breaks: Span[];
  summers: Span[];
  reveal?: boolean;
}

const statusFill = (status: string) => `var(--status-${statusTone(status)}-fg)`;

export default function ScoreChart({ width, kind, threshold, kindling, naive, d0, asOf, breaks, summers, reveal }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const xs = makeX(d0, asOf + 1, width);
  const bottom = PLOT_TOP + PLOT_H;
  const y = (v: number) => bottom - (v / 100) * PLOT_H;
  const flag = flagFor(kind);
  const height = bottom + 22;

  const series = useMemo(() => [
    { key: 'kindling', name: 'School days (Kindling)', color: COLORS.kindling, points: kindling },
    { key: 'naive', name: 'Calendar days (naive)', color: COLORS.naive, points: naive },
  ], [kindling, naive]);

  const cx = (iso: string) => xs.x(dayNum(iso)) + (xs.x(1) - xs.x(0)) / 2;   // middle of the Monday
  const path = (pts: HistoryPoint[]) => {
    let d = '', prev = -Infinity;
    for (const p of pts) {
      const n = dayNum(p.as_of);
      d += `${n - prev > 7 ? 'M' : 'L'}${cx(p.as_of).toFixed(1)},${y(p.score).toFixed(1)}`;   // a gap starts a new segment
      prev = n;
    }
    return d;
  };

  // nearest Monday to the pointer, from either series
  const mondays = useMemo(() => [...new Set([...kindling, ...naive].map(p => p.as_of))].sort(), [kindling, naive]);
  const hovered = hover === null || !mondays.length ? null
    : mondays.reduce((best, m) => Math.abs(dayNum(m) - hover) < Math.abs(dayNum(best) - hover) ? m : best, mondays[0]);
  const at = (pts: HistoryPoint[], m: string) => pts.find(p => p.as_of === m) ?? null;

  const thresholdLabel = kind === 'pql' ? `Ready at ${threshold}+` : `At risk below ${threshold}`;
  // The ready line is the one place ember marks a chart (DESIGN.md §5); the at-risk line is neutral.
  const lineColor = kind === 'pql' ? 'var(--accent)' : 'var(--text-tertiary)';

  return (
    <div className="kd-score">
      <div className="kd-legend">
        {series.map(s => {
          const lastPt = s.points.at(-1);
          return (
            <Key key={s.key} swatch={s.color} line>
              {s.name}
              {lastPt && <> · <span className="kd-legend__value k-num">{lastPt.score} {lastPt.status}</span>{dayNum(lastPt.as_of) !== asOf && ` on ${short(lastPt.as_of)}`}</>}
            </Key>
          );
        })}
        <span className="kd-key">
          <span aria-hidden="true" className="kd-key__dot" style={{ background: statusFill(flag) }} />
          {flag} week
        </span>
      </div>
      <div className="kd-chart">
        <svg width={width} height={height} role="img" className="kd-svg"
          aria-label={`Weekly ${kind === 'pql' ? 'readiness' : 'health'} score, school-day windows vs calendar-day windows; ${thresholdLabel}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
            setHover(px >= xs.left && px <= xs.right ? xs.inv(px) : null);
          }}>
          <Shading xs={xs} breaks={breaks} summers={summers} top={PLOT_TOP} height={PLOT_H} labels={false} />
          <YTicks ticks={[0, 50, 100]} y={y} left={PAD_L} right={xs.right} />
          {hovered && <line x1={cx(hovered)} x2={cx(hovered)} y1={PLOT_TOP} y2={bottom} style={{ stroke: 'var(--border-strong)' }} />}
          {/* the status line: the one threshold, from /meta */}
          <line x1={PAD_L} x2={xs.right} y1={y(threshold)} y2={y(threshold)} style={{ stroke: lineColor }} />
          <text x={PAD_L + 4} y={y(threshold) - 5} className="kd-svg-label">{thresholdLabel}</text>
          <g className={reveal ? 'kd-reveal' : undefined}>
            {[...series].reverse().map(s => (
              <path key={s.key} d={path(s.points)} style={{ fill: 'none', stroke: s.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {[...series].reverse().map(s => s.points.filter(p => p.status === flag).map(p => (
              <circle key={`${s.key}-${p.as_of}`} cx={cx(p.as_of)} cy={y(p.score)} r={4}
                style={{ fill: statusFill(flag), stroke: COLORS.surface }} strokeWidth={2} />
            )))}
          </g>
          <MonthAxis xs={xs} y={bottom} />
        </svg>
        {hovered && hover !== null && (
          <ChartTip x={cx(hovered)} width={width}>
            <div className="kd-tip__title">{weekday(hovered)}</div>
            {series.map(s => {
              const p = at(s.points, hovered);
              return <TipRow key={s.key} swatch={s.color} label={s.key === 'kindling' ? 'School days' : 'Calendar days'}
                value={p ? `${p.score} · ${p.status}` : '—'} />;
            })}
            {(() => {
              const p = at(kindling, hovered);
              return p?.reasons[0] && <div className="kd-tip__note">{p.reasons[0]}</div>;
            })()}
          </ChartTip>
        )}
      </div>
    </div>
  );
}
