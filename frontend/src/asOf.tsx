import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMeta, fetchPql, fetchHealth, fetchStats } from './api';
import type { Meta } from './types';
import { readUrl, writeUrl } from './nav';

interface AsOfValue {
  asOf: string;               // the date every score on screen is computed for
  setAsOf: (d: string) => void;
  meta: Meta;                 // demo date, simulated year, replay range, thresholds (from GET /meta)
}

const AsOfContext = createContext<AsOfValue | null>(null);

const clamp = (d: string, meta: Meta) => (d < meta.sim_start ? meta.sim_start : d > meta.sim_end ? meta.sim_end : d);

export function AsOfProvider({ children }: { children: ReactNode }) {
  const { data: meta, error } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta, staleTime: Infinity });
  const [picked, setPicked] = useState<string | null>(() => readUrl().asOf);

  if (error) {
    return (
      <div data-testid="api-down" style={{ padding: 48, color: 'var(--muted)', fontFamily: 'Inter' }}>
        Can't reach the Kindling API ({(error as Error).message}). Start it with <code>uvicorn kindling.api:app</code>.
      </div>
    );
  }
  if (!meta) return <div style={{ padding: 48, color: 'var(--muted)', fontFamily: 'Inter' }}>Loading…</div>;

  const asOf = clamp(picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) ? picked : meta.demo_as_of, meta);
  const setAsOf = (d: string) => {
    const next = clamp(d, meta);
    setPicked(next);
    writeUrl({ asOf: next === meta.demo_as_of ? null : next });
  };
  return <AsOfContext.Provider value={{ asOf, setAsOf, meta }}>{children}</AsOfContext.Provider>;
}

export function useAsOf(): AsOfValue {
  const v = useContext(AsOfContext);
  if (!v) throw new Error('useAsOf must be used inside <AsOfProvider>');
  return v;
}

export function usePql() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['pql', asOf], queryFn: () => fetchPql(asOf) });
}

export function useHealth() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['health', asOf], queryFn: () => fetchHealth(asOf) });
}

export function useStats() {
  const { asOf } = useAsOf();
  return useQuery({ queryKey: ['stats', asOf], queryFn: () => fetchStats(asOf) });
}
