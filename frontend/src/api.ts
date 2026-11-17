import type { PqlScore, HealthScore, BacktestData, AutomationRun } from './types';

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
