// A day-by-day close-up of the two scoring windows ending at as_of: the school-day window
// (what Kindling scores, ink) and the calendar-day window (what a naive model scores, gray).
import { useMemo, useState } from 'react';
import type { SchoolDetail, UsageDay } from '../../types';
import {
  type Metric, type Span, type WindowStats, METRIC, dayNum, dayValue, fmtPct, isoOf, niceTicks, pctChange,
  plural, rangeLabel, short, statValue, weekday, windowStats,
} from './model';
import { COLORS, PRIOR_OPACITY, SUMMER_OPACITY, barPath, barSlot, makeX, spanPx } from './scale';
import { ChartTip, Note, TipRow } from './ui';

// SVG geometry (allowlisted): a left gutter for the row names, then the days.
const GUTTER = 96;
const PLOT_TOP = 18;
const PLOT_H = 64;
const SEG_H = 16;

type Win = SchoolDetail['windows']['school_days'] | SchoolDetail['windows']['calendar'];

const valid = (a: string | null, b: string): a is string => !!a && a <= b;

interface Props {
  width: number;
  days: UsageDay[];
  windows: SchoolDetail['windows'];
  asOf: string;
  d0: number;
  breaks: Span[];
  summers: Span[];
  metric: Metric;
}

export default function WindowLens({ width, days, windows, asOf, d0, breaks, summers, metric }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const sd = windows.school_days, cal = windows.calendar;
  const last = dayNum(asOf);

  const starts = [sd.prev_start, sd.start, cal.prev_start, cal.start].filter((s): s is string => !!s && s <= asOf).map(dayNum);
  const first = Math.max(d0, Math.min(last - (cal.length * 2 - 1), ...starts));
  const xs = makeX(first, last + 1, width, GUTTER, 2);
  const shown = useMemo(() => days.filter(d => { const n = dayNum(d.day); return n >= first && n <= last; }), [days, first, last]);
  const ticks = niceTicks(Math.max(0, ...shown.map(d => dayValue(d, metric))), 2);
  const top = ticks[ticks.length - 1];
  const bottom = PLOT_TOP + PLOT_H;
  const y = (v: number) => bottom - (v / top) * PLOT_H;
  const rowSd = bottom + 28, rowCal = rowSd + SEG_H + 8;
  const height = rowCal + SEG_H + 2;
  const dayW = xs.x(first + 1) - xs.x(first);

  const stats = {
    sd: { cur: windowStats(days, sd.start, sd.end), prev: windowStats(days, sd.prev_start, sd.prev_end) },
    cal: { cur: windowStats(days, cal.start, cal.end), prev: windowStats(days, cal.prev_start, cal.prev_end) },
  };
  const inWin = (n: number, a: string | null, b: string) => valid(a, b) && n >= dayNum(a) && n <= dayNum(b);
  const hoveredDay = hover === null ? null : shown.find(d => dayNum(d.day) === hover) ?? null;

  const seg = (w: Win, rowY: number, color: string, onSolid: string, cur: string, prior: string) => {
    const parts = [
      { a: w.prev_start, b: w.prev_end, solid: false, text: prior },
      { a: w.start, b: w.end, solid: true, text: cur },
    ];
    return parts.map((p, i) => {
      if (!valid(p.a, p.b)) return null;
      const px = spanPx(xs, { start: dayNum(p.a), end: dayNum(p.b) });
      if (!px) return null;
      const wPx = px[1] - px[0] - 2;
      return (
        <g key={i}>
          <rect x={px[0] + 1} y={rowY} width={Math.max(1, wPx)} height={SEG_H} rx={2}
            style={{ fill: color, fillOpacity: p.solid ? 1 : PRIOR_OPACITY }} />
          {wPx >= p.text.length * 6.4 + 8 && (
            <text x={px[0] + 1 + wPx / 2} y={rowY + 12} textAnchor="middle" className="kd-svg-seg"
              style={{ fill: p.solid ? onSolid : 'var(--text-primary)' }}>{p.text}</text>
          )}
        </g>
      );
    });
  };

  return (
    <div className="kd-lens">
      <div className="kd-chart">
        <svg width={width} height={height} role="img" className="kd-svg"
          aria-label={`Day by day, ${rangeLabel(isoOf(first), asOf)}: the school-day window and the calendar-day window`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
            setHover(px >= xs.left && px <= xs.right ? xs.inv(px) : null);
          }}>
          {/* day backgrounds: weekends faintly; breaks and summer down through the window rows */}
          {shown.map(d => {
            if (d.kind === 'instructional') return null;
            const n = dayNum(d.day);
            if (d.kind === 'weekend') {
              return <rect key={d.day} x={xs.x(n)} y={PLOT_TOP} width={dayW} height={PLOT_H} style={{ fill: 'var(--bg-subtle)' }} />;
            }
            return <rect key={d.day} x={xs.x(n)} y={PLOT_TOP} width={dayW + 0.5} height={rowCal + SEG_H - PLOT_TOP}
              style={{ fill: d.kind === 'summer' ? COLORS.summer : COLORS.break, fillOpacity: d.kind === 'summer' ? SUMMER_OPACITY : 1 }} />;
          })}
          {breaks.concat(summers).map((s, i) => {
            const px = spanPx(xs, s);
            if (!px || px[1] - px[0] < 40) return null;
            return <text key={i} x={px[0] + 4} y={PLOT_TOP + 12} className="kd-svg-label">{i < breaks.length ? 'Break' : 'Summer'}</text>;
          })}
          {hover !== null && hover >= first && hover <= last && (
            <rect x={xs.x(hover)} y={PLOT_TOP} width={dayW} height={PLOT_H} style={{ fill: 'var(--text-primary)', fillOpacity: 0.06 }} />
          )}
          <text x={0} y={10} className="kd-svg-title">{METRIC[metric].short} <tspan className="kd-svg-label">· per day</tspan></text>
          {ticks.map(t => (
            <g key={t}>
              {t > 0 && <line x1={GUTTER} x2={xs.right} y1={y(t)} y2={y(t)} style={{ stroke: COLORS.grid }} />}
              <text x={GUTTER - 8} y={y(t) + 4} textAnchor="end" className="kd-svg-label kd-svg-num">{t}</text>
            </g>
          ))}
          {shown.map(d => {
            const v = dayValue(d, metric);
            if (v <= 0) return null;
            const n = dayNum(d.day);
            const [x0, x1] = barSlot(xs.x(n), xs.x(n + 1), 12);
            return <path key={d.day} d={barPath(x0, x1, y(v), bottom)} style={{ fill: COLORS.sessions }} />;
          })}
          <line x1={GUTTER} x2={xs.right} y1={bottom} y2={bottom} style={{ stroke: COLORS.axis }} />
          {shown.filter(d => new Date(dayNum(d.day) * 86_400_000).getUTCDay() === 1).map(d => {
            const x = xs.x(dayNum(d.day));
            return (
              <g key={d.day}>
                <line x1={x} x2={x} y1={bottom} y2={bottom + 4} style={{ stroke: COLORS.axis }} />
                {xs.right - x >= 36 && <text x={x + 2} y={bottom + 16} className="kd-svg-label">{short(d.day)}</text>}
              </g>
            );
          })}

          <text x={0} y={rowSd + 12} className="kd-svg-title">School days</text>
          {seg(sd, rowSd, COLORS.kindling, 'var(--bg-surface)', `last ${sd.length} school days`, `prior ${sd.length}`)}
          <text x={0} y={rowCal + 12} className="kd-svg-title">Calendar days</text>
          {seg(cal, rowCal, COLORS.naive, 'var(--text-primary)', `last ${cal.length} days`, `prior ${cal.length}`)}
        </svg>
        {hoveredDay && hover !== null && (
          <ChartTip x={xs.x(hover)} width={width}>
            <div className="kd-tip__title">{weekday(hoveredDay.day)}</div>
            <div className="kd-tip__note">
              {hoveredDay.kind === 'instructional' ? 'School day' : hoveredDay.kind === 'weekend' ? 'Weekend' : hoveredDay.kind === 'break' ? 'School break' : 'Summer'}
            </div>
            <TipRow label="Active teachers" value={hoveredDay.active_teachers} />
            <TipRow label="Student sessions" value={hoveredDay.student_sessions} />
            {[
              inWin(hover, sd.start, sd.end) && 'school-day window',
              inWin(hover, sd.prev_start, sd.prev_end) && 'prior school-day window',
              inWin(hover, cal.start, cal.end) && 'calendar window',
              inWin(hover, cal.prev_start, cal.prev_end) && 'prior calendar window',
            ].filter(Boolean).map(t => <div key={String(t)} className="kd-tip__note">In the {t}</div>)}
          </ChartTip>
        )}
      </div>

      <WindowTable sd={sd} cal={cal} stats={stats} metric={metric} />
    </div>
  );
}

function WindowTable({ sd, cal, stats, metric }: {
  sd: SchoolDetail['windows']['school_days']; cal: SchoolDetail['windows']['calendar'];
  stats: Record<'sd' | 'cal', { cur: WindowStats | null; prev: WindowStats | null }>; metric: Metric;
}) {
  const cell = (s: WindowStats | null) => s ? (
    <>
      <div className="kd-wtable__primary k-num">{s.days ? rangeLabel(s.start, s.end) : 'none yet'}</div>
      <div className="kd-wtable__secondary k-num">{plural(s.schoolDays, 'school day')} · {METRIC[metric].unit(statValue(s, metric))}</div>
    </>
  ) : <div className="kd-wtable__secondary">no prior window yet</div>;

  // the change in the chosen measure; a window with nothing before it has no percentage
  const change = (c: WindowStats | null, p: WindowStats | null) => {
    if (!c || !p) return { cell: '—', reads: 'has no prior window to compare' };
    const cur = statValue(c, metric), prev = statValue(p, metric);
    if (prev > 0) { const pct = fmtPct(pctChange(cur, prev)); return { cell: pct, reads: `reads ${pct}` }; }
    return cur > 0
      ? { cell: 'new', reads: 'shows activity where the prior window had none' }
      : { cell: '—', reads: 'shows no activity in either' };
  };
  const rows = [
    { key: 'sd', color: COLORS.kindling, name: 'School days', what: `last ${sd.length} on the ${sd.calendar_id} calendar`, ...stats.sd },
    { key: 'cal', color: COLORS.naive, name: 'Calendar days', what: `last ${cal.length}, breaks included`, ...stats.cal },
  ];
  const sdChange = change(stats.sd.cur, stats.sd.prev);
  const calChange = change(stats.cal.cur, stats.cal.prev);
  const c = stats.cal.cur, s = stats.sd.cur, cp = stats.cal.prev, sp = stats.sd.prev;
  const takeaway = (() => {
    if (!c || !s || !s.days) return null;
    const same = sd.start === cal.start && sd.prev_start === cal.prev_start;
    if (same) return <>No break in these {cal.length * 2} days: both windows cover the same school days, so they agree{sdChange.cell === '—' ? '' : ` (${sdChange.cell})`}.</>;
    const sdPart = <>The school-day window compares {plural(s.schoolDays, 'school day')} with the {sp?.schoolDays ?? 0} before (from {short(sd.prev_start ?? sd.start)}) and {sdChange.reads}.</>;
    if (c.schoolDays < s.schoolDays) {
      return <>The last {cal.length} calendar days hold only {plural(c.schoolDays, 'school day')}, so a calendar window {calChange.reads}. {sdPart}</>;
    }
    if (cp && sp && cp.schoolDays < sp.schoolDays) {
      return <>The prior {cal.length} calendar days held only {plural(cp.schoolDays, 'school day')}, so a calendar window {calChange.reads}. {sdPart}</>;
    }
    return <>The calendar-day window ({c.schoolDays} vs {cp?.schoolDays ?? 0} school days) {calChange.reads}. {sdPart}</>;
  })();

  return (
    <>
      <table className="kd-wtable">
        <thead>
          <tr><th scope="col">Window</th><th scope="col">This window</th><th scope="col">Prior window</th><th scope="col" className="is-num">Change</th></tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const ch = change(r.cur, r.prev);
            return (
              <tr key={r.key}>
                <td>
                  <div className="kd-wtable__name"><span aria-hidden="true" className="kd-key__swatch" style={{ background: r.color }} />{r.name}</div>
                  <div className="kd-wtable__secondary">{r.what}</div>
                </td>
                <td>{cell(r.cur)}</td>
                <td>{cell(r.prev)}</td>
                <td className="is-num k-num kd-wtable__change">{ch.cell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {takeaway && <Note tone="secondary">{takeaway}</Note>}
    </>
  );
}
