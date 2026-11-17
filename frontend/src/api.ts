import type { PqlScore, HealthScore, BacktestData, AutomationRun, PipelineFunnelData } from './types';

export const API = 'http://localhost:8000';
const today = new Date();
export const DEFAULT_AS_OF = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPql(asOf = DEFAULT_AS_OF): Promise<PqlScore[]> {
  const data = await get<{ scores: PqlScore[] }>(`/pql?as_of=${asOf}`);
  return data.scores;
}

export async function fetchHealth(asOf = DEFAULT_AS_OF): Promise<HealthScore[]> {
  const data = await get<{ scores: HealthScore[] }>(`/health?as_of=${asOf}`);
  return data.scores;
}

export async function fetchBacktest(): Promise<BacktestData> {
  return get<BacktestData>('/backtest');
}

export async function fetchAutomationsLog(): Promise<AutomationRun[]> {
  const data = await get<{ runs: AutomationRun[]; last_run: AutomationRun | null }>('/automations/log');
  return data.runs ?? [];
}

export async function fetchSnapshotSchools(asOf?: string, status?: string): Promise<{ as_of: string | null; schools: { school_id: string; name: string; pql_score: number; status: string }[] }> {
  const params = new URLSearchParams();
  if (asOf) params.set('as_of', asOf);
  if (status) params.set('status', status);
  return get(`/snapshot/pql/schools?${params}`);
}

export async function fetchPipelineFunnel(): Promise<PipelineFunnelData> {
  return get<PipelineFunnelData>('/pipeline/funnel');
}

export async function postSnapshot(asOf = DEFAULT_AS_OF): Promise<{ ok: boolean; count: number }> {
  const res = await fetch(`${API}/snapshot/pql?as_of=${asOf}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface ProspectSignal { label: string; pts: number; detail: string; }
export interface TopProspect extends PqlScore { priority_score: number; signals: ProspectSignal[]; }

export async function fetchTop10Prospects(asOf = DEFAULT_AS_OF): Promise<{ top10: TopProspect[]; total_prospects: number }> {
  return get(`/prospects/top10?as_of=${asOf}`);
}

export async function notifySlack(
  channel: 'cs' | 'sales',
  schoolId?: string,
  asOf = DEFAULT_AS_OF,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/notify/slack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, school_id: schoolId, as_of: asOf }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
