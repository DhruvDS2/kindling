// Week helpers for the date control. Days are 'YYYY-MM-DD' strings in local time (never UTC,
// which shifts the day in US time zones). The school year is stepped one Monday at a time.

export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The Monday on or before `day`. */
export function toMonday(day: string): string {
  const d = parseDay(day);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return isoDay(d);
}

export function addWeeks(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n * 7);
  return isoDay(d);
}

/** Every Monday from the first Monday on or after `start` through `end`. */
export function mondaysBetween(start: string, end: string): string[] {
  let m = toMonday(start);
  if (m < start) m = addWeeks(m, 1);
  const out: string[] = [];
  while (m <= end) { out.push(m); m = addWeeks(m, 1); }
  return out;
}

/** "Mon, Feb 2, 2026" */
export function fmtWeek(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Feb 2" */
export function fmtShort(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Feb" */
export function fmtMonth(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', { month: 'short' });
}
