import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, LabelList, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Table, readToken, type Column } from '../../design';
import type { BacktestData, BacktestWeek, SchoolCalendar } from '../../types';
import { fmtDay, parseDay } from '../../nav';
import { Disclosure } from './Section';

// Paying schools scored At risk each Monday of the replay, naive vs Kindling (GET /backtest),
// with breaks and summer shaded. Colors, type and spacing come from tokens via CSS classes
// (backtest.css); recharts only gets geometry.

const SERIES = [
  { key: 'kindling', name: 'Kindling', detail: 'school-day windows', className: 'is-kindling' },
  { key: 'naive', name: 'Naive model', detail: 'calendar-day windows', className: 'is-naive' },
] as const;

type Span = { kind: 'break' | 'summer'; start: string; end: string };

/** Contiguous runs of break weeks and of summer weeks, as first and last Monday (inclusive). */
function shadedSpans(weeks: BacktestWeek[]): Span[] {
  const spans: Span[] = [];
  let open: Span | null = null;
  for (const w of weeks) {
    const kind = w.is_summer ? 'summer' : w.is_break ? 'break' : null;
    if (open && open.kind === kind) { open.end = w.date; continue; }
    if (open) spans.push(open);
    open = kind ? { kind, start: w.date, end: w.date } : null;
  }
  if (open) spans.push(open);
  return spans;
}

function peakIndex(weeks: BacktestWeek[], key: 'naive' | 'kindling'): number {
  let best = -1;
  weeks.forEach((w, i) => { if (w[key] > 0 && (best < 0 || w[key] > weeks[best][key])) best = i; });
  return best;
}

/** A token's px value as a number, for recharts geometry (e.g. px('--space-3') → 24). */
const px = (token: string) => parseFloat(readToken(token)) || 0;

const short = (d: string) => fmtDay(d, { month: 'short', day: 'numeric' });

function weekTag(label: string, week: BacktestWeek | undefined, calendar: SchoolCalendar): string | null {
  if (!week) return null;
  if (week.is_summer) return `Summer (school year ${short(calendar.first_day)} to ${short(calendar.last_day)})`;
  if (!week.is_break) return null;
  const sunday = new Date(parseDay(label).getTime() + 6 * 86400000);
  const brk = calendar.breaks.find(b => parseDay(b.start) <= sunday && parseDay(b.end) >= parseDay(label));
  return brk ? `Break, ${short(brk.start)} to ${short(brk.end)}` : 'Break week';
}

interface TipProps { active?: boolean; label?: string | number; payload?: { dataKey?: string | number; value?: number }[] }

function WeekTooltip({ active, label, payload, weeks, calendar }: TipProps & { weeks: BacktestWeek[]; calendar: SchoolCalendar }) {
  if (!active || !payload?.length || typeof label !== 'string') return null;
  const week = weeks.find(w => w.date === label);
  const tag = weekTag(label, week, calendar);
  return (
    <div className="bt-tip">
      <div className="bt-tip__head">Week of {fmtDay(label, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
      {tag && <div className="bt-tip__tag">{tag}</div>}
      {SERIES.map(s => (
        <div key={s.key} className="bt-tip__row">
          <span className={`bt-swatch ${s.className}`} aria-hidden="true" />
          <span className="bt-tip__name">{s.name}</span>
          <span className="bt-tip__value k-num">{payload.find(p => p.dataKey === s.key)?.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** One sentence from the series: where the naive model peaks (and whether it's right after a break), and Kindling's peak. */
export function WeeklyTakeaway({ data }: { data: BacktestData }) {
  const weeks = data.weeks;
  const n = peakIndex(weeks, 'naive');
  const k = peakIndex(weeks, 'kindling');
  if (n < 0) return null;
  const afterBreak = n > 0 && weeks[n - 1].is_break && !weeks[n].is_break;
  return (
    <>
      The naive model’s alerts peak at <span className="k-num">{weeks[n].naive}</span> on {fmtDay(weeks[n].date, { month: 'short', day: 'numeric' })}
      {afterBreak ? ', the first Monday back from a break' : ''}
      {k >= 0 ? <>. Kindling’s busiest week has <span className="k-num">{weeks[k].kindling}</span>.</> : '.'}
    </>
  );
}

const weekColumns: Column<BacktestWeek>[] = [
  { id: 'date', header: 'Monday', cell: w => fmtDay(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), width: '34%' },
  { id: 'kindling', header: 'Kindling', numeric: true, cell: w => w.kindling },
  { id: 'naive', header: 'Naive model', numeric: true, cell: w => w.naive },
  { id: 'kind', header: 'Week', cell: w => (w.is_summer ? 'Summer' : w.is_break ? 'Break' : ''), width: '22%' },
];

export default function WeeklyAlertsChart({ data }: { data: BacktestData }) {
  const weeks = data.weeks;
  const spans = useMemo(() => shadedSpans(weeks), [weeks]);
  const monthTicks = useMemo(() => weeks
    .filter((w, i) => i === 0 || parseDay(w.date).getMonth() !== parseDay(weeks[i - 1].date).getMonth())
    .map(w => w.date), [weeks]);
  // Label only each series' peak week (recharts skips a label whose value is undefined).
  const rows = useMemo(() => {
    const peaks = { naive: peakIndex(weeks, 'naive'), kindling: peakIndex(weeks, 'kindling') };
    return weeks.map((w, i) => ({
      ...w,
      naive_peak: i === peaks.naive ? w.naive : undefined,
      kindling_peak: i === peaks.kindling ? w.kindling : undefined,
    }));
  }, [weeks]);

  const gap = px('--size-hairline');
  const margin = { top: px('--space-3'), right: px('--space-1'), bottom: 0, left: 0 };

  return (
    <div className="bt-weekly" data-testid="weekly-chart">
      <div className="bt-legend">
        {SERIES.map(s => (
          <span key={s.key} className="bt-legend__item">
            <span className={`bt-swatch ${s.className}`} aria-hidden="true" />
            {s.name} <span className="bt-legend__detail">· {s.detail}</span>
          </span>
        ))}
        <span className="bt-legend__item"><span className="bt-swatch is-break" aria-hidden="true" />School break</span>
        <span className="bt-legend__item"><span className="bt-swatch is-summer" aria-hidden="true" />Summer</span>
        <span className="bt-legend__detail">({data.calendar.calendar_id} calendar)</span>
      </div>

      <div className="bt-chart" role="img" aria-label="Weekly at-risk alerts, naive model versus Kindling. Exact numbers are in the weekly table below.">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} barCategoryGap="12%" barGap={gap} margin={margin}>
            <CartesianGrid vertical={false} className="bt-chart__grid" />
            {spans.map(s => (
              <ReferenceArea
                key={`${s.kind}-${s.start}`}
                x1={s.start}
                x2={s.end}
                className={`bt-chart__span is-${s.kind}`}
                fillOpacity={1}
                ifOverflow="hidden"
                label={{ value: s.kind === 'summer' ? 'Summer' : 'Break', position: 'insideTop', className: 'bt-chart__span-label' }}
              />
            ))}
            <XAxis
              dataKey="date"
              ticks={monthTicks}
              tickFormatter={(d: string) => fmtDay(d, { month: 'short' })}
              className="bt-chart__axis"
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis allowDecimals={false} className="bt-chart__axis" axisLine={false} tickLine={false} width={px('--space-4')} />
            <Tooltip
              content={<WeekTooltip weeks={weeks} calendar={data.calendar} />}
              cursor={{ className: 'bt-chart__cursor' }}
              isAnimationActive={false}
            />
            {SERIES.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.name} className={`bt-chart__bar ${s.className}`} radius={[2, 2, 0, 0]} maxBarSize={10} isAnimationActive={false}>
                <LabelList dataKey={`${s.key}_peak`} position="top" offset={px('--space-0-5')} className="bt-chart__peak" />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bt-disclosures">
        <Disclosure id="weekly-table" title="Weekly numbers" takeaway={`Every Monday from ${fmtDay(data.replay.start)} to ${fmtDay(data.replay.end)}, as the chart draws them.`}>
          <Table<BacktestWeek> rows={weeks} columns={weekColumns} rowKey={w => w.date} aria-label="At-risk alerts by week" />
          <p className="bt-stamp" data-testid="weekly-source">
            <span className="bt-stamp__item"><span className="bt-stamp__key">Source</span> GET /backtest, counted live from the simulated year (no outcomes needed)</span>
          </p>
        </Disclosure>
      </div>
    </div>
  );
}
