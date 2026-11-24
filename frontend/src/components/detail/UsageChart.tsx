// Usage over the simulated year by week (5A: a line plus bars). Two panels share one time
// axis instead of sharing a y-axis: active teachers as a line on top, student sessions as
// bars below. The school's own breaks and summer are shaded from /calendars/{id}, and the
// scoring windows for the chosen mode (school days or calendar days) are banded across both
// panels. Switching mode morphs the bands to the other window over --motion-base (CSS
// transitions on x/width; none under reduced motion).
import { useMemo, useState } from 'react';
import type { SchoolDetail, UsageDay } from '../../types';
import { type Span, dayNum, isoOf, niceTicks, rangeLabel, weeklyBins } from './model';
import { MonthAxis, Shading, YTicks } from './timeAxis';
import { COLORS, PAD_L, PRIOR_OPACITY, barPath, barSlot, compact, makeX, spanPx } from './scale';
import { ChartTip, TipRow } from './ui';

export type WindowMode = 'school_days' | 'calendar';

// SVG geometry (allowlisted by the token lint): two plots, one label row above each.
const A_TOP = 24;
const A_H = 60;
const B_LABEL = A_TOP + A_H + 26;
const B_TOP = B_LABEL + 10;
const B_H = 84;
const AXIS = B_TOP + B_H;
const BRACKET = AXIS + 26;
const HEIGHT = BRACKET + 6;

interface Props {
  width: number;
  days: UsageDay[];
  d0: number;          // first day of the simulated year
  asOf: number;
  breaks: Span[];
  summers: Span[];
  windows: SchoolDetail['windows'];
  mode: WindowMode;
  /** Wipe the marks in once (first open of the drawer). */
  reveal?: boolean;
}

type Win = SchoolDetail['windows']['school_days'] | SchoolDetail['windows']['calendar'];

/** [prior, current] as pixel extents; an empty or missing window collapses to its start. */
function windowPx(xs: ReturnType<typeof makeX>, w: Win): { prior: [number, number] | null; current: [number, number] | null } {
  const px = (a: string | null, b: string) => (a && a <= b ? spanPx(xs, { start: dayNum(a), end: dayNum(b) }) : null);
  return { prior: px(w.prev_start, w.prev_end), current: px(w.start, w.end) };
}

export default function UsageChart({ width, days, d0, asOf, breaks, summers, windows, mode, reveal }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const bins = useMemo(() => weeklyBins(days, d0, asOf), [days, d0, asOf]);
  const xs = makeX(d0, asOf + 1, width);

  const tA = niceTicks(Math.max(0, ...bins.map(b => b.peak)), 2);
  const tB = niceTicks(Math.max(0, ...bins.map(b => b.sessions)), 2);
  const yA = (v: number) => A_TOP + A_H - (v / tA[tA.length - 1]) * A_H;
  const yB = (v: number) => AXIS - (v / tB[tB.length - 1]) * B_H;
  const mid = (start: number, end: number) => (xs.x(start) + xs.x(end + 1)) / 2;

  const line = bins.map((b, i) => `${i ? 'L' : 'M'}${mid(b.start, b.end).toFixed(1)},${yA(b.peak).toFixed(1)}`).join('');
  const last = bins[bins.length - 1];

  const w = mode === 'school_days' ? windows.school_days : windows.calendar;
  const color = mode === 'school_days' ? COLORS.kindling : COLORS.naive;
  const band = windowPx(xs, w);
  const hovered = hover === null ? null : bins.find(b => hover >= b.start && hover <= b.end) ?? null;

  // The windows: a guide at each window edge through both plots, and a bracket under the
  // month axis (prior lighter, current solid). Fills would read as breaks, so there are none.
  // Every rect keeps its element across modes, so x and width transition: the morph.
  const edges = [band.prior?.[0], band.current?.[0] ?? band.prior?.[1], band.current?.[1]];
  const guides = edges.map((x, i) => (
    <rect key={i} className="kd-band__rect" data-edge={i} y={A_TOP} height={AXIS - A_TOP}
      style={{ x: (x ?? xs.right) - 0.5, width: 1, fill: 'var(--border-strong)', fillOpacity: x === undefined ? 0 : 1 }} />
  ));
  const bracket = (key: 'prior' | 'current', ext: [number, number] | null) => (
    <rect key={key} className="kd-band__rect" data-window={key} rx={1} y={BRACKET} height={4}
      style={{
        x: ext ? ext[0] + 1 : xs.right, width: ext ? Math.max(1, ext[1] - ext[0] - 2) : 0,
        fill: color, fillOpacity: key === 'current' ? 1 : PRIOR_OPACITY,
      }} />
  );

  return (
    <div className="kd-chart">
      <svg width={width} height={HEIGHT} role="img" className="kd-svg"
        aria-label={`Active teachers and student sessions by week, ${rangeLabel(isoOf(d0), isoOf(asOf))}, with the school's breaks shaded. `
          + `Highlighted: ${w.start <= w.end ? rangeLabel(w.start, w.end) : 'no window yet'}${w.prev_start ? ` and the prior window ${rangeLabel(w.prev_start, w.prev_end)}` : ''}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          setHover(px >= xs.left && px <= xs.right ? xs.inv(px) : null);
        }}>
        <text x={0} y={12} className="kd-svg-title">Active teachers <tspan className="kd-svg-label">· busiest day each week</tspan></text>
        <text x={0} y={B_LABEL} className="kd-svg-title">Student sessions <tspan className="kd-svg-label">· per week</tspan></text>

        <Shading xs={xs} breaks={breaks} summers={summers} top={A_TOP} height={A_H} part="fill" />
        <Shading xs={xs} breaks={breaks} summers={summers} top={B_TOP} height={B_H} labels={false} />
        <g aria-hidden="true">{guides}</g>
        <Shading xs={xs} breaks={breaks} summers={summers} top={A_TOP} height={A_H} part="labels" />
        <YTicks ticks={tA} y={yA} left={PAD_L} right={xs.right} />
        <YTicks ticks={tB} y={yB} left={PAD_L} right={xs.right} fmt={compact} />

        {hovered && (() => {
          const px = spanPx(xs, { start: hovered.start, end: hovered.end });
          return px && (
            <g aria-hidden="true">
              <rect x={px[0]} y={A_TOP} width={px[1] - px[0]} height={A_H} style={{ fill: 'var(--text-primary)', fillOpacity: 0.05 }} />
              <rect x={px[0]} y={B_TOP} width={px[1] - px[0]} height={B_H} style={{ fill: 'var(--text-primary)', fillOpacity: 0.05 }} />
            </g>
          );
        })()}

        <g className={reveal ? 'kd-reveal' : undefined}>
          {bins.map(b => {
            if (b.sessions <= 0) return null;
            const [x0, x1] = barSlot(xs.x(b.start), xs.x(b.end + 1));
            return <path key={b.start} d={barPath(x0, x1, yB(b.sessions), AXIS)} style={{ fill: COLORS.sessions }} />;
          })}
          <path d={line} style={{ fill: 'none', stroke: COLORS.teachers }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && (
            <circle cx={mid(last.start, last.end)} cy={yA(last.peak)} r={4}
              style={{ fill: COLORS.teachers, stroke: COLORS.surface }} strokeWidth={2} />
          )}
        </g>
        <MonthAxis xs={xs} y={AXIS} />
        <g aria-hidden="true">{bracket('prior', band.prior)}{bracket('current', band.current)}</g>
      </svg>
      {hovered && hover !== null && (
        <ChartTip x={xs.x(hover)} width={width}>
          <div className="kd-tip__title">{rangeLabel(isoOf(hovered.start), isoOf(hovered.end))}</div>
          <TipRow label="School days" value={hovered.schoolDays} />
          <TipRow label="Busiest day" value={`${hovered.peak} ${hovered.peak === 1 ? 'teacher' : 'teachers'}`} swatch={COLORS.teachers} />
          <TipRow label="Student sessions" value={hovered.sessions.toLocaleString('en-US')} swatch={COLORS.sessions} />
          {hovered.schoolDays === 0 && <div className="kd-tip__note">No school this week</div>}
        </ChartTip>
      )}
    </div>
  );
}
