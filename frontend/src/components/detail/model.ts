// Pure helpers for the school detail drawer. Everything here derives from API payloads;
// no number on screen is typed in by hand.
import type { HistoryPoint, SchoolCalendar, UsageDay } from '../../types';
import { fmtDay } from '../../nav';

const DAY_MS = 86_400_000;

/** YYYY-MM-DD → whole days since 1970-01-01. UTC on both sides, so no time-zone drift. */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function isoOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const short = (iso: string) => fmtDay(iso, { month: 'short', day: 'numeric' });
export const long = (iso: string) => fmtDay(iso, { month: 'short', day: 'numeric', year: 'numeric' });
export const weekday = (iso: string) => fmtDay(iso, { weekday: 'short', month: 'short', day: 'numeric' });
export const rangeLabel = (a: string, b: string) => (a === b ? short(a) : `${short(a)} – ${short(b)}`);

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

export const fmtPct = (p: number | null) => (p === null ? 'n/a' : p > 0 ? `+${p}%` : p < 0 ? `−${Math.abs(p)}%` : '0%');

// ---------- usage ----------

export type Metric = 'teachers' | 'sessions';

export const METRIC: Record<Metric, { label: string; short: string; daily: string; weekly: string; unit: (n: number) => string }> = {
  teachers: {
    label: 'Active teachers',
    short: 'Teachers',
    daily: 'Active teachers per day',
    weekly: 'Teacher-days per week (each day’s active teachers, summed)',
    unit: n => plural(n, 'teacher-day'),
  },
  sessions: {
    label: 'Student sessions',
    short: 'Sessions',
    daily: 'Student sessions per day',
    weekly: 'Student sessions per week',
    unit: n => plural(n, 'session'),
  },
};

export const dayValue = (d: UsageDay, m: Metric) => (m === 'teachers' ? d.active_teachers : d.student_sessions);

export interface Bin {
  start: number;      // first day (inclusive)
  end: number;        // last day (inclusive)
  teachers: number;   // teacher-days
  peak: number;       // active teachers on the busiest day of the bin
  sessions: number;
  schoolDays: number;
}

export const binValue = (b: Bin, m: Metric) => (m === 'teachers' ? b.teachers : b.sessions);

/** 7-day bins that end on as_of, so the newest bin is always a full week. */
export function weeklyBins(days: UsageDay[], from: number, asOf: number): Bin[] {
  const byDay = new Map(days.map(d => [dayNum(d.day), d]));
  const bins: Bin[] = [];
  for (let end = asOf; end >= from; end -= 7) {
    const b: Bin = { start: Math.max(end - 6, from), end, teachers: 0, peak: 0, sessions: 0, schoolDays: 0 };
    for (let n = b.start; n <= end; n++) {
      const u = byDay.get(n);
      if (!u) continue;
      b.teachers += u.active_teachers;
      b.peak = Math.max(b.peak, u.active_teachers);
      b.sessions += u.student_sessions;
      if (u.kind === 'instructional') b.schoolDays++;
    }
    bins.push(b);
  }
  return bins.reverse();
}

export interface Span { start: number; end: number }   // inclusive day numbers

export const breakSpans = (cal: SchoolCalendar): Span[] =>
  cal.breaks.map(b => ({ start: dayNum(b.start), end: dayNum(b.end) }));

/** Summer = before the calendar's first school day and after its last one. */
export function summerSpans(cal: SchoolCalendar, simStart: string, simEnd: string): Span[] {
  return [
    { start: dayNum(simStart), end: dayNum(cal.first_day) - 1 },
    { start: dayNum(cal.last_day) + 1, end: dayNum(simEnd) },
  ].filter(s => s.start <= s.end);
}

export interface WindowStats {
  start: string;
  end: string;
  days: number;        // calendar days covered
  schoolDays: number;
  breakDays: number;   // break or summer days inside the window
  teachers: number;    // teacher-days
  sessions: number;
}

/** Sums usage over [start, end]. Before the first school day the API can return start > end: an empty window. */
export function windowStats(days: UsageDay[], start: string | null, end: string): WindowStats | null {
  if (!start) return null;
  const s: WindowStats = { start, end, days: 0, schoolDays: 0, breakDays: 0, teachers: 0, sessions: 0 };
  if (start > end) return s;
  s.days = dayNum(end) - dayNum(start) + 1;
  for (const d of days) {
    if (d.day < start || d.day > end) continue;
    s.teachers += d.active_teachers;
    s.sessions += d.student_sessions;
    if (d.kind === 'instructional') s.schoolDays++;
    if (d.kind === 'break' || d.kind === 'summer') s.breakDays++;
  }
  return s;
}

export const statValue = (s: WindowStats, m: Metric) => (m === 'teachers' ? s.teachers : s.sessions);

// ---------- axes ----------

/** 0..top in 3–4 clean integer steps (1, 2, 5 × 10ⁿ). */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag);
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}

/** The first day of every month inside [from, to). */
export function monthStarts(from: number, to: number): number[] {
  const out: number[] = [];
  const d = new Date(from * DAY_MS);
  let y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (d.getUTCDate() !== 1) m += 1;
  for (;;) {
    const n = Math.round(Date.UTC(y, m, 1) / DAY_MS);
    if (n >= to) break;
    out.push(n);
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

export const monthLabel = (n: number) => {
  const iso = isoOf(n);
  const month = fmtDay(iso, { month: 'short' });
  return iso.slice(5, 7) === '01' ? `${month} ’${iso.slice(2, 4)}` : month;
};

// ---------- history ----------

export const flagFor = (kind: 'pql' | 'health') => (kind === 'pql' ? 'Ready' : 'At risk');

/** A reason's identity across weeks: same wording with the numbers taken out. */
export const reasonKey = (text: string) =>
  text.replace(/\d+(\.\d+)?/g, '#').replace(/\bteachers\b/g, 'teacher');

/** The first Monday of the unbroken run, ending at the latest point, for which `test` holds. */
export function runStart(points: HistoryPoint[], test: (p: HistoryPoint) => boolean): { first: HistoryPoint; weeks: number; before: HistoryPoint | null } | null {
  let i = points.length - 1;
  if (i < 0 || !test(points[i])) return null;
  while (i > 0 && test(points[i - 1])) i--;
  return { first: points[i], weeks: points.length - i, before: i > 0 ? points[i - 1] : null };
}

/** The Monday a reason started its current run among the week's top reasons, if it is there now. */
export function reasonSince(text: string, points: HistoryPoint[]): HistoryPoint | null {
  const key = reasonKey(text);
  return runStart(points, p => p.reasons.some(r => reasonKey(r) === key))?.first ?? null;
}
