import { useMemo, useState, type ReactNode } from 'react';
import { ErrorState, NumberFlow, Skeleton, Sparkline, StatBlock, Tooltip, fmtShort } from '../../design';
import type { Meta, Stats } from '../../types';
import { plural, usd, weekBefore } from '../ready/data';
import { trendDays, useStatsAt, useStatsTrend } from './queries';

const count = (n: number) => Math.round(n).toLocaleString('en-US');
const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const countChange = (d: number) => `${sign(Math.round(d))}${count(Math.abs(d))}`;
const usdChange = (d: number) => `${sign(Math.round(d))}${usd(Math.abs(d))}`;
const pointsChange = (d: number) => `${sign(Math.round(d * 1000))}${(Math.abs(d) * 100).toFixed(1)} pts`;

interface Stat {
  label: string;
  value: (s: Stats) => number;
  format: (n: number) => string;
  change: (d: number) => string;
  /** True when the change rounds to nothing in this stat's own format. */
  same: (d: number) => boolean;
  /** Optional second half of the context line. */
  extra?: (s: Stats) => ReactNode;
}

const STATS: Stat[] = [
  { label: 'Ready to buy', value: s => s.ready_to_buy, format: count, change: countChange, same: d => Math.round(d) === 0 },
  {
    label: 'At risk', value: s => s.at_risk, format: count, change: countChange, same: d => Math.round(d) === 0,
    extra: s => <>of <span className="k-num">{count(s.paid_schools_scored)}</span> renewing</>,
  },
  {
    label: 'ARR at risk', value: s => s.arr_at_risk, format: usd, change: usdChange, same: d => Math.round(d) === 0,
    extra: s => <>of <span className="k-num">{usd(s.total_arr)}</span></>,
  },
  {
    label: 'Projected NRR', value: s => s.projected_nrr, format: percent, change: pointsChange, same: d => Math.round(d * 1000) === 0,
    extra: s => (
      <Tooltip content={s.definitions.projected_nrr}>
        <span className="brief-term k-focus" tabIndex={0}>
          {s.arr_churned_to_date > 0 ? <><span className="k-num">{usd(s.arr_churned_to_date)}</span> churned</> : 'none churned'}
        </span>
      </Tooltip>
    ),
  },
];

/** "Feb 2: 9 schools ready to buy, 4 paying schools slipping. $23,600 in renewals at risk." */
export function Narrative({ stats }: { stats: Stats | undefined }) {
  if (!stats) return <Skeleton width="60%" />;
  const { ready_to_buy: ready, at_risk: risk, arr_at_risk: arr } = stats;
  const n = (v: number, format?: (x: number) => string) => <strong><NumberFlow value={v} format={format} reveal={false} /></strong>;
  return (
    <p className="brief-lede" data-testid="brief-narrative">
      {fmtShort(stats.as_of)}:{' '}
      {ready === 0 ? 'no school is ready to buy yet' : <>{n(ready)} {plural(ready, 'school')} ready to buy</>},{' '}
      {risk === 0 ? 'no paying school is slipping' : <>{n(risk)} paying {plural(risk, 'school')} slipping</>}.{' '}
      {arr > 0 ? <>{n(arr, usd)} in renewals at risk.</> : 'No renewal revenue is at risk.'}
    </p>
  );
}

/**
 * The week in four numbers (3B): each with its change vs the week before and an 8-week sparkline,
 * all from /stats. Numbers count through on a week change and count up once on first load.
 */
export function WeekStats({ asOf, meta, reveal }: { asOf: string; meta: Meta; reveal: boolean }) {
  const q = useStatsAt(asOf);
  const prevDay = weekBefore(asOf, meta);
  const prevQ = useStatsAt(prevDay);
  const now = q.data;
  const prev = prevQ.data;

  // Only compare a week with the week before it, never with a placeholder from another week.
  const pair = useMemo(
    () => (now && prev && weekBefore(now.as_of, meta) === prev.as_of ? { now, prev } : null),
    [now, prev, meta],
  );
  const [keptPair, setKeptPair] = useState<typeof pair>(null);
  if (pair && pair !== keptPair) setKeptPair(pair);
  const compare = prevDay ? pair ?? (keptPair?.now.as_of === now?.as_of ? keptPair : null) : null;

  const days = useMemo(() => trendDays(asOf, meta), [asOf, meta]);
  const trend = useStatsTrend(days);

  if (q.error && !now) {
    return (
      <ErrorState
        title={`Couldn't load this week's numbers for ${fmtShort(asOf)}.`}
        detail={(q.error as Error).message}
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
      />
    );
  }

  return (
    <div className="brief-stats" data-testid="brief-stats">
      {STATS.map(stat => {
        const value = now ? stat.value(now) : null;
        const series = trend?.map(stat.value);
        let change: ReactNode = null;
        if (now && !prevDay) change = 'No earlier week to compare';
        else if (compare) {
          const d = stat.value(compare.now) - stat.value(compare.prev);
          const vs = fmtShort(compare.prev.as_of);
          change = stat.same(d)
            ? <>No change vs {vs}</>
            : <><NumberFlow value={d} format={stat.change} reveal={false} /> vs {vs}</>;
        }
        const extra = now && stat.extra ? stat.extra(now) : null;
        return (
          <StatBlock
            key={stat.label}
            label={stat.label}
            value={value}
            format={stat.format}
            loading={!now}
            reveal={reveal}
            context={<>{change}{change && extra ? ' · ' : null}{extra}</>}
            sparkline={series && series.length >= 2
              ? <Sparkline values={series} label={`${stat.label}, last ${series.length} weeks: ${stat.format(series[0])} to ${stat.format(series[series.length - 1])}`} />
              : null}
          />
        );
      })}
    </div>
  );
}

