import { createContext, useContext, useState, type ReactNode } from 'react';
import { keepPreviousData, useIsFetching, useQuery, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query';
import { fetchMeta, fetchPql, fetchHealth, fetchStats } from './api';
import type { Meta } from './types';
import { readUrl, writeUrl } from './nav';
import { ApiDown, BootSkeleton } from './shell/Boot';

interface AsOfValue {
  asOf: string;               // the date every score on screen is computed for
  setAsOf: (d: string) => void;
  meta: Meta;                 // demo date, simulated year, replay range, thresholds (from GET /meta)
  /** The as-of day before the rep's latest change (null until they change the week). */
  previousAsOf: string | null;
}

const AsOfContext = createContext<AsOfValue | null>(null);

const clamp = (d: string, meta: Meta) => (d < meta.sim_start ? meta.sim_start : d > meta.sim_end ? meta.sim_end : d);

export function AsOfProvider({ children }: { children: ReactNode }) {
  const { data: meta, error, refetch, isFetching } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta, staleTime: Infinity });
  const [picked, setPicked] = useState<string | null>(() => readUrl().asOf);
  const [previousAsOf, setPreviousAsOf] = useState<string | null>(null);

  if (error && !meta) {
    return <ApiDown message={(error as Error).message} onRetry={() => void refetch()} retrying={isFetching} />;
  }
  if (!meta) return <BootSkeleton />;

  const asOf = clamp(picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) ? picked : meta.demo_as_of, meta);
  const setAsOf = (d: string) => {
    const next = clamp(d, meta);
    if (next === asOf) return;
    setPreviousAsOf(asOf);
    setPicked(next);
    writeUrl({ asOf: next === meta.demo_as_of ? null : next });
  };
  return <AsOfContext.Provider value={{ asOf, setAsOf, meta, previousAsOf }}>{children}</AsOfContext.Provider>;
}

export function useAsOf(): AsOfValue {
  const v = useContext(AsOfContext);
  if (!v) throw new Error('useAsOf must be used inside <AsOfProvider>');
  return v;
}

// Week stepping (DESIGN.md §3.2): after first load, a new as_of keeps the previous week's data on
// screen (placeholderData) until the new week arrives, so tables and numbers never fall back to
// skeletons; rows reorder and numbers count through instead.

export function usePql() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['pql', asOf], queryFn: () => fetchPql(asOf), placeholderData: keepPreviousData });
}

export function useHealth() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['health', asOf], queryFn: () => fetchHealth(asOf), placeholderData: keepPreviousData });
}

export function useStats() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['stats', asOf], queryFn: () => fetchStats(asOf), placeholderData: keepPreviousData });
}

/**
 * A query is "updating for the new week" when it is fetching for the current as_of while an observer
 * shows placeholder data, and the same query for the previous as_of has data (so the placeholder is
 * last week's, not, say, another school's in the drawer).
 */
function isWeekPlaceholder(q: Query, client: QueryClient, asOf: string, previous: string): boolean {
  if (!q.queryKey.includes(asOf)) return false;
  if (!q.observers.some(o => o.getCurrentResult().isPlaceholderData)) return false;
  return client.getQueryData(q.queryKey.map(k => (k === asOf ? previous : k))) !== undefined;
}

/**
 * True while a new week loads behind last week's numbers: any as_of query (usePql, useHealth,
 * useStats, or a screen's own query with placeholderData) is fetching with placeholder data.
 * False on first load, which shows skeletons instead. Screens pair it with NumberFlow and the
 * Table reorder; the top bar shows the quiet "Updating…" mark from it.
 */
export function useIsUpdating(): boolean {
  const { asOf, previousAsOf } = useAsOf();
  const client = useQueryClient();
  const fetching = useIsFetching({
    predicate: q => previousAsOf != null && isWeekPlaceholder(q, client, asOf, previousAsOf),
  });
  return fetching > 0;
}
