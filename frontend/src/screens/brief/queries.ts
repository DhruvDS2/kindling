// /stats for the brief: this week, the week before (for "vs Jan 26"), and the last 8 weeks
// (sparklines). Same cache keys as the shared useStats(), so nothing is fetched twice.
import { useState } from 'react';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { fetchStats } from '../../api';
import { addWeeks } from '../../design';
import type { Meta, Stats } from '../../types';

/** How many weeks a sparkline covers. Layout, not data: every point is a /stats call. */
export const TREND_WEEKS = 8;

export function useStatsAt(day: string | null) {
  return useQuery({
    queryKey: ['stats', day],
    queryFn: () => fetchStats(day as string),
    enabled: day != null,
    placeholderData: keepPreviousData,
  });
}

/** `asOf` and the same weekday in each of the previous weeks, oldest first, inside the simulated year. */
export function trendDays(asOf: string, meta: Meta, weeks = TREND_WEEKS): string[] {
  const days: string[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const d = addWeeks(asOf, -k);
    if (d >= meta.sim_start && d <= meta.sim_end) days.push(d);
  }
  return days;
}

/**
 * /stats for each day, oldest first. While a new week's point loads, the last complete series stays
 * on screen (no sparkline flicker). A past day's stats never change, so they are cached for good.
 */
export function useStatsTrend(days: string[]): Stats[] | null {
  const results = useQueries({
    queries: days.map(d => ({ queryKey: ['stats', d], queryFn: () => fetchStats(d), staleTime: Infinity })),
  });
  const key = days.join(',');
  const complete = results.length > 0 && results.every(r => r.data) ? results.map(r => r.data as Stats) : null;
  const [kept, setKept] = useState<{ key: string; series: Stats[] } | null>(null);
  if (complete && kept?.key !== key) setKept({ key, series: complete });
  return complete ?? kept?.series ?? null;
}
