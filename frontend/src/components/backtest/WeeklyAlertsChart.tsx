import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer, LabelList,
} from 'recharts';
import type { BacktestData, BacktestWeek, SchoolCalendar } from '../../types';
import { fmtDay, parseDay } from '../../nav';

const SERIES = [
  { key: 'naive', name: 'Naive (calendar-day windows)', color: 'var(--naive)' },
  { key: 'kindling', name: 'Kindling (school-day windows)', color: 'var(--ember)' },
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

interface TipProps { active?: boolean; label?: string | number; payload?: { dataKey?: string | number; value?: number }[] }

function WeekTooltip({ active, label, payload, weeks, calendar }: TipProps & { weeks: BacktestWeek[]; calendar: SchoolCalendar }) {
  if (!active || !payload?.length || typeof label !== 'string') return null;
  const week = weeks.find(w => w.date === label);
  const sunday = new Date(parseDay(label).getTime() + 6 * 86400000);
  const brk = week?.is_break
    ? calendar.breaks.find(b => parseDay(b.start) <= sunday && parseDay(b.end) >= parseDay(label))
    : undefined;
  const range = (a: string, b: string) => `${fmtDay(a, { month: 'short', day: 'numeric' })} to ${fmtDay(b, { month: 'short', day: 'numeric' })}`;
  const tag = week?.is_summer
    ? `Summer (school year ${range(calendar.first_day, calendar.last_day)})`
    : brk ? `Break ${range(brk.start, brk.end)}` : week?.is_break ? 'Break week' : null;
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px',
      fontFamily: 'Inter', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 210,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: tag ? 2 : 6 }}>
        Week of {fmtDay(label, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      {tag && <div style={{ color: 'var(--body)', fontWeight: 500, marginBottom: 6 }}>{tag}</div>}
      {SERIES.map(s => {
        const v = payload.find(p => p.dataKey === s.key)?.value;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <span aria-hidden style={{ width: 12, height: 2, background: s.color, borderRadius: 1 }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--ink)', minWidth: 22 }}>{v ?? '—'}</span>
            <span style={{ color: 'var(--muted)' }}>{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Paying schools scored At risk each Monday of the replay, naive vs Kindling, with breaks and summer shaded. */
export default function WeeklyAlertsChart({ data }: { data: BacktestData }) {
  const weeks = data.weeks;
  const spans = shadedSpans(weeks);
  const monthTicks = weeks
    .filter((w, i) => i === 0 || parseDay(w.date).getMonth() !== parseDay(weeks[i - 1].date).getMonth())
    .map(w => w.date);
  // Label only each series' peak week (recharts skips a label whose value is undefined).
  const peaks = { naive: peakIndex(weeks, 'naive'), kindling: peakIndex(weeks, 'kindling') };
  const rows = weeks.map((w, i) => ({
    ...w,
    naive_peak: i === peaks.naive ? w.naive : undefined,
    kindling_peak: i === peaks.kindling ? w.kindling : undefined,
  }));
  const peakLabelStyle = { fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: 'var(--body)' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12, color: 'var(--muted)' }}>
        {SERIES.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.name}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 14, height: 10, borderRadius: 2, background: 'var(--break-shade)', border: '1px solid var(--line)' }} />
          School break or summer ({data.calendar.calendar_id} calendar)
        </span>
      </div>

      <div role="img" aria-label="Weekly at-risk alerts, naive versus Kindling. Exact numbers are in the weekly table below.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows} barCategoryGap="10%" barGap={2} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--row-divider)" />
            {spans.map(s => (
              <ReferenceArea
                key={`${s.kind}-${s.start}`}
                x1={s.start}
                x2={s.end}
                fill="var(--break-shade)"
                fillOpacity={1}
                ifOverflow="hidden"
                label={{ value: s.kind === 'summer' ? 'Summer' : 'Break', position: 'insideTop', fontSize: 10.5, fill: 'var(--muted)', fontFamily: 'Inter' }}
              />
            ))}
            <XAxis
              dataKey="date"
              ticks={monthTicks}
              tickFormatter={(d: string) => fmtDay(d, { month: 'short' })}
              tick={{ fontSize: 12, fill: 'var(--muted)', fontFamily: 'Inter' }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<WeekTooltip weeks={weeks} calendar={data.calendar} />} cursor={{ fill: 'var(--nav)', fillOpacity: 0.7 }} />
            {SERIES.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={10} isAnimationActive={false}>
                <LabelList dataKey={`${s.key}_peak`} position="top" offset={6} style={peakLabelStyle} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
          Weekly numbers ({fmtDay(data.replay.start)} to {fmtDay(data.replay.end)})
        </summary>
        <table style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ textAlign: 'left', fontWeight: 500, padding: '4px 16px 4px 0' }}>Monday</th>
              {SERIES.map(s => <th key={s.key} style={{ textAlign: 'right', fontWeight: 500, padding: '4px 0 4px 16px' }}>{s.name}</th>)}
              <th style={{ textAlign: 'left', fontWeight: 500, padding: '4px 0 4px 16px' }}>Week</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(w => (
              <tr key={w.date} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                <td style={{ padding: '3px 16px 3px 0', fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>{w.date}</td>
                <td style={{ padding: '3px 0 3px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{w.naive}</td>
                <td style={{ padding: '3px 0 3px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{w.kindling}</td>
                <td style={{ padding: '3px 0 3px 16px', color: 'var(--muted)' }}>{w.is_summer ? 'Summer' : w.is_break ? 'Break' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
