import type {
  PqlScore, HealthScore, Stats, Meta, SchoolDetail, SchoolHistory, SchoolUsage, SchoolCalendar,
  BacktestData, BacktestResults, AutomationRun, PipelineFunnelData,
} from './types';

// Set VITE_API_URL to point the UI at another API (e.g. a second dev server).
export const API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

const q = (asOf: string) => `as_of=${encodeURIComponent(asOf)}`;

export const fetchMeta = () => get<Meta>('/meta');

export async function fetchPql(asOf: string): Promise<PqlScore[]> {
  return (await get<{ scores: PqlScore[] }>(`/pql?${q(asOf)}`)).scores;
}

export async function fetchHealth(asOf: string): Promise<HealthScore[]> {
  return (await get<{ scores: HealthScore[] }>(`/health?${q(asOf)}`)).scores;
}

export const fetchStats = (asOf: string) => get<Stats>(`/stats?${q(asOf)}`);

export const fetchSchool = (schoolId: string, asOf: string) =>
  get<SchoolDetail>(`/schools/${encodeURIComponent(schoolId)}?${q(asOf)}`);

export const fetchSchoolHistory = (schoolId: string, asOf: string, mode: 'school_days' | 'calendar' = 'school_days') =>
  get<SchoolHistory>(`/schools/${encodeURIComponent(schoolId)}/history?${q(asOf)}&mode=${mode}`);

export const fetchSchoolUsage = (schoolId: string, asOf: string) =>
  get<SchoolUsage>(`/schools/${encodeURIComponent(schoolId)}/usage?${q(asOf)}`);

export const fetchCalendar = (calendarId: string) =>
  get<SchoolCalendar>(`/calendars/${encodeURIComponent(calendarId)}`);

export const fetchBacktest = () => get<BacktestData>('/backtest');

export const fetchBacktestResults = () => get<BacktestResults>('/backtest/results');

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

export const fetchPipelineFunnel = () => get<PipelineFunnelData>('/pipeline/funnel');

export async function postSnapshot(asOf: string): Promise<{ ok: boolean; count: number }> {
  const res = await fetch(`${API}/snapshot/pql?${q(asOf)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface ProspectSignal { label: string; pts: number; detail: string; }
export interface TopProspect extends PqlScore { priority_score: number; signals: ProspectSignal[]; }

export const fetchTop10Prospects = (asOf: string) =>
  get<{ top10: TopProspect[]; total_prospects: number }>(`/prospects/top10?${q(asOf)}`);

export async function notifySlack(channel: 'cs' | 'sales', schoolId: string, asOf: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API}/notify/slack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, school_id: schoolId, as_of: asOf }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
