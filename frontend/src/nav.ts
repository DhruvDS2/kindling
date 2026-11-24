export type Screen = 'brief' | 'ready' | 'risk' | 'backtest' | 'automations' | 'pipeline' | 'prospects';

export const SCREENS: Screen[] = ['brief', 'ready', 'risk', 'pipeline', 'prospects', 'backtest', 'automations'];

/** Screen and date live in the URL (?screen=risk&as_of=2026-02-02) so any view can be linked or screenshotted. */
export function readUrl(): { screen: Screen | null; asOf: string | null; school: string | null } {
  const p = new URLSearchParams(window.location.search);
  const s = p.get('screen') as Screen | null;
  return { screen: s && SCREENS.includes(s) ? s : null, asOf: p.get('as_of'), school: p.get('school') };
}

export function writeUrl(patch: Partial<{ screen: Screen; asOf: string | null; school: string | null }>) {
  const p = new URLSearchParams(window.location.search);
  if (patch.screen) p.set('screen', patch.screen);
  if (patch.asOf !== undefined) { if (patch.asOf) p.set('as_of', patch.asOf); else p.delete('as_of'); }
  if (patch.school !== undefined) { if (patch.school) p.set('school', patch.school); else p.delete('school'); }
  window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
}

/** YYYY-MM-DD as a local date (never UTC, which shifts the day in US time zones). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return parseDay(day).toLocaleDateString('en-US', opts);
}

/** True for a known screen id (e.g. a data-nav value). */
export function isScreen(s: string | null | undefined): s is Screen {
  return !!s && (SCREENS as string[]).includes(s);
}

/** The page title in the top bar, shown at display size. */
export const PAGE_TITLES: Record<Screen, string> = {
  brief: 'Monday brief',
  ready: 'Ready to buy',
  risk: 'At risk',
  pipeline: 'Pipeline',
  prospects: 'Prospects',
  backtest: 'Backtest',
  automations: 'Automations',
};

/**
 * Screens whose numbers are scored for the as-of week. They get the week pager and ruler;
 * Backtest (the whole replayed year) and Automations (real n8n run dates) don't depend on it.
 */
export const DATED_SCREENS: readonly Screen[] = ['brief', 'ready', 'risk', 'pipeline', 'prospects'];
