import { useQuery } from '@tanstack/react-query';
import type { BacktestData } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import { fetchBacktest } from '../api';
import { SkeletonCard } from '../components/Skeleton';

export default function Backtest() {
  const { data, isLoading, error } = useQuery<BacktestData>({ queryKey: ['backtest'], queryFn: () => fetchBacktest() });

  if (error) return <div style={{ color: 'var(--muted)' }}>Failed to load — is the API running?</div>;
  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><SkeletonCard rows={6} /><SkeletonCard rows={5} /></div>;

  const weekly = data?.weeks ?? [];
  const results = data?.results ?? [];
  const takeaway = data?.takeaway ?? '';

  // Find break periods for ReferenceArea
  const breakPeriods: { start: string; end: string }[] = [];
  let breakStart: string | null = null;
  for (const w of weekly) {
    if (w.is_break && !breakStart) breakStart = w.date;
    if (!w.is_break && breakStart) {
      breakPeriods.push({ start: breakStart, end: w.date });
      breakStart = null;
    }
  }
  if (breakStart && weekly.length > 0) {
    breakPeriods.push({ start: breakStart, end: weekly[weekly.length - 1].date });
  }

  // Build month tick labels
  const monthTicks: string[] = [];
  let lastMonth = '';
  for (const w of weekly) {
    const m = new Date(w.date).toLocaleDateString('en-US', { month: 'short' });
    if (m !== lastMonth) { monthTicks.push(w.date); lastMonth = m; }
    else monthTicks.push('');
  }

  // Parse YYYY-MM-DD as local time (not UTC) to avoid off-by-one-month in timezones
  const parseLocal = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatXAxis = (date: string) => {
    if (!date) return '';
    return parseLocal(date).toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chart card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>
          At-risk alerts per week
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weekly} barCategoryGap="20%" barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              ticks={weekly.filter((_, i) => {
                if (i === 0) return true;
                const prev = parseLocal(weekly[i - 1].date).getMonth();
                const curr = parseLocal(weekly[i].date).getMonth();
                return curr !== prev;
              }).map(w => w.date)}
              tick={{ fontSize: 12, fill: 'var(--muted)', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--muted)', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'Inter',
              }}
              cursor={{ fill: 'var(--nav)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Inter' }}
              formatter={(value) => {
                if (value === 'naive') return 'Naive (calendar days)';
                if (value === 'kindling') return 'Kindling (school days)';
                return value;
              }}
            />
            <Bar dataKey="naive" fill="var(--naive)" radius={[2, 2, 0, 0]} name="naive" maxBarSize={12} />
            <Bar dataKey="kindling" fill="var(--ember)" radius={[2, 2, 0, 0]} name="kindling" maxBarSize={12} />
            {/* Render break shading AFTER bars so it sits as a tint on top */}
            {breakPeriods.map((bp, i) => (
              <ReferenceArea
                key={`front-${i}`}
                x1={bp.start}
                x2={bp.end}
                fill="var(--break-shade)"
                fillOpacity={0.35}
                label=""
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {takeaway && (
          <p style={{
            fontSize: 14,
            color: 'var(--body)',
            fontStyle: 'italic',
            marginTop: 16,
            lineHeight: 1.6,
          }}>
            {takeaway}
          </p>
        )}
      </div>

      {/* Results table */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--row-divider)' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Results</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
              {['Metric', 'Naive', 'Kindling'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px',
                  textAlign: 'left',
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: i < results.length - 1 ? '1px solid var(--row-divider)' : 'none' }}
              >
                <td style={{ padding: '12px 20px', fontSize: 14, color: 'var(--ink)' }}>{row.metric}</td>
                <td style={{ padding: '12px 20px', fontSize: 14, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.naive}
                </td>
                <td style={{
                  padding: '12px 20px',
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: row.kindling_better ? 700 : 400,
                  color: row.kindling_better ? 'var(--ink)' : 'var(--muted)',
                }}>
                  {row.kindling}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--row-divider)' }}>
          Numbers from the real backtest output.
        </div>
      </div>
    </div>
  );
}
