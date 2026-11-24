// Weekly score in school-day mode (Kindling) vs calendar-day mode (naive), on the same
// time frame as the usage chart, with the status line from /meta.
import { useMemo, useState } from 'react';
import type { HistoryPoint } from '../../types';
import { type Span, dayNum, flagFor, weekday } from './model';
import { MonthAxis, Shading, YTicks } from './timeAxis';
import { COLORS, MONO, PAD_L, makeX } from './scale';
import { ChartTip, Key, TipRow } from './ui';

const PLOT_TOP = 8;
const PLOT_H = 120;

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
}

const statusColor = (status: string) =>
  status === 'Ready' ? 'var(--ember)' : status === 'At risk' ? 'var(--risk)' : status === 'Healthy' ? 'var(--steady)' : 'var(--muted)';

export default function ScoreChart({ width, kind, threshold, kindling, naive, d0, asOf, breaks, summers }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const xs = makeX(d0, asOf + 1, width);
  const bottom = PLOT_TOP + PLOT_H;
  const y = (v: number) => bottom - (v / 100) * PLOT_H;
  const flag = flagFor(kind);
  const height = bottom + 20;

  const series = useMemo(() => [
    { key: 'kindling', name: 'School-day windows (Kindling)', color: COLORS.schoolDays, points: kindling },
    { key: 'naive', name: 'Calendar-day windows (naive)', color: COLORS.calendar, points: naive },
  ], [kindling, naive]);

  const cx = (iso: string) => xs.x(dayNum(iso)) + (xs.x(1) - xs.x(0)) / 2;   // middle of the Monday
  const path = (pts: HistoryPoint[]) => {
    let d = '', prev = -Infinity;
    for (const p of pts) {
      const n = dayNum(p.as_of);
      d += `${n - prev > 7 ? 'M' : 'L'}${cx(p.as_of).toFixed(1)},${y(p.score).toFixed(1)}`;   // gap → new segment
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {series.map(s => {
          const lastPt = s.points.at(-1);
          return (
            <Key key={s.key} swatch={{ background: s.color, height: 3 }}>
              {s.name}{lastPt && <> · <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{lastPt.score} {lastPt.status}</span></>}
            </Key>
          );
        })}
        <Key swatch={{ background: statusColor(flag), width: 9, height: 9, borderRadius: '50%', boxShadow: '0 0 0 2px var(--card)' }}>
          {flag} week
        </Key>
      </div>
      <div style={{ position: 'relative' }}>
        <svg width={width} height={height} role="img" style={{ display: 'block', overflow: 'visible' }}
          aria-label={`Weekly ${kind === 'pql' ? 'PQL' : 'health'} score, school-day windows vs calendar-day windows; ${thresholdLabel}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
            setHover(px >= xs.left && px <= xs.right ? xs.inv(px) : null);
          }}>
          <Shading xs={xs} breaks={breaks} summers={summers} top={PLOT_TOP} height={PLOT_H} labels={false} />
          <YTicks ticks={[0, 50, 100]} y={y} left={PAD_L} right={xs.right} />
          {hovered && <line x1={cx(hovered)} x2={cx(hovered)} y1={PLOT_TOP} y2={bottom}
            style={{ stroke: 'var(--muted)', strokeOpacity: 0.5 }} />}
          {/* the status line: the one threshold, from /meta */}
          <line x1={PAD_L} x2={xs.right} y1={y(threshold)} y2={y(threshold)}
            style={{ stroke: 'var(--ink)', strokeOpacity: 0.55, strokeDasharray: '4 3' }} />
          <text x={PAD_L + 4} y={y(threshold) - 4} style={{ fontSize: 10, fill: 'var(--body)' }}>{thresholdLabel}</text>
          {[...series].reverse().map(s => (
            <path key={s.key} d={path(s.points)} style={{ fill: 'none', stroke: s.color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
          ))}
          {[...series].reverse().map(s => s.points.filter(p => p.status === flag).map(p => (
            <circle key={`${s.key}-${p.as_of}`} cx={cx(p.as_of)} cy={y(p.score)} r={4}
              style={{ fill: statusColor(flag), stroke: 'var(--card)', strokeWidth: 2 }} />
          )))}
          <MonthAxis xs={xs} y={bottom} />
        </svg>
        {hovered && hover !== null && (
          <ChartTip x={cx(hovered)} width={width}>
            <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{weekday(hovered)}</div>
            {series.map(s => {
              const p = at(s.points, hovered);
              return <TipRow key={s.key} swatch={s.color} label={s.key === 'kindling' ? 'School days' : 'Calendar days'}
                value={p ? `${p.score} · ${p.status}` : '—'} />;
            })}
            {(() => {
              const p = at(kindling, hovered);
              return p?.reasons[0] && <div style={{ color: 'var(--muted)', marginTop: 4 }}>{p.reasons[0]}</div>;
            })()}
          </ChartTip>
        )}
      </div>
    </div>
  );
}
