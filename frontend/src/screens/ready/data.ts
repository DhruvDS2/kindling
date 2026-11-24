// Data helpers shared by the Monday brief and Ready to buy. Every number comes from the API:
// these only pick which date to ask for and compare two weeks the API already scored.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchPql } from '../../api';
import { addWeeks } from '../../design';
import type { Meta } from '../../types';

/** One week before `asOf`, clamped to the start of the simulated year. null when there is no earlier day. */
export function weekBefore(asOf: string, meta: Meta): string | null {
  const back = addWeeks(asOf, -1);
  const day = back < meta.sim_start ? meta.sim_start : back;
  return day < asOf ? day : null;
}

/**
 * Readiness scores for one day. Same cache key as the shared usePql(), plus keepPreviousData so a
 * week change keeps the current rows on screen until the new ones arrive (DESIGN.md §3.2).
 */
export function usePqlAt(day: string | null) {
  return useQuery({
    queryKey: ['pql', day],
    queryFn: () => fetchPql(day as string),
    enabled: day != null,
    placeholderData: keepPreviousData,
  });
}

/** Health scores for one day (same cache key as the shared useHealth()). */
export function useHealthAt(day: string | null) {
  return useQuery({
    queryKey: ['health', day],
    queryFn: () => fetchHealth(day as string),
    enabled: day != null,
    placeholderData: keepPreviousData,
  });
}

const NONE: ReadonlySet<string> = new Set();

/**
 * Schools that match `hit` now but didn't a week earlier ("new this week"). Only recomputed when
 * both weeks are real data, never a placeholder from the previous week, so the marker doesn't
 * flicker while a new week loads.
 */
export function useNewThisWeek<T extends { school_id: string }>(
  now: T[] | undefined,
  before: T[] | undefined,
  fresh: boolean,
  hit: (s: T) => boolean,
): ReadonlySet<string> {
  const computed = useMemo(() => {
    if (!fresh || !now || !before) return null;
    const had = new Set(before.filter(hit).map(s => s.school_id));
    return new Set(now.filter(s => hit(s) && !had.has(s.school_id)).map(s => s.school_id)) as ReadonlySet<string>;
  }, [now, before, fresh, hit]);
  const [kept, setKept] = useState<ReadonlySet<string>>(NONE);
  if (computed && computed !== kept) setKept(computed);
  return computed ?? kept;
}

export const isReady = (s: { status: string }) => s.status === 'Ready';
export const isAtRisk = (s: { status: string }) => s.status === 'At risk';

/** "Independent · Fresno, CA" or "District · Maple USD · Fresno, CA". */
export function place(s: { type: 'district' | 'independent'; district: string | null; city: string; state: string }) {
  return [s.type === 'district' ? 'District' : 'Independent', s.district, `${s.city}, ${s.state}`].filter(Boolean).join(' · ');
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
