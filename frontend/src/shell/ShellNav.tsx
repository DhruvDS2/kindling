// 1A grouped sidebar (base Nav: 8A travelling highlight, plain tabular counts) plus the quiet
// footer: when n8n last sent alerts, and the theme switch.
import type { FocusEvent, PointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Nav, SegmentedControl, Skeleton, useCountThrough, type NavGroup } from '../design';
import { fetchAutomationsLog } from '../api';
import { useStats } from '../asOf';
import { type Screen, PAGE_TITLES, isScreen, parseDay } from '../nav';
import type { AutomationRun } from '../types';
import { preloadScreen } from './screens';
import { useThemePref, type ThemePref } from './theme';

const DAILY: Screen[] = ['brief', 'ready', 'risk'];
const PROOF: Screen[] = ['pipeline', 'prospects', 'backtest', 'automations'];

/** A count that counts through to its new week's value (7A); null while unknown. */
function useNavCount(value: number | undefined): number | null {
  const shown = useCountThrough(value, { reveal: false });
  return shown == null ? null : Math.round(shown);
}

export function ShellNav({ active, onSelect }: { active: Screen; onSelect: (s: Screen) => void }) {
  const { data: stats } = useStats();
  const ready = useNavCount(stats?.ready_to_buy);
  const risk = useNavCount(stats?.at_risk);
  const counts: Partial<Record<Screen, number | null>> = { ready, risk };
  const item = (id: Screen) => ({ id, label: PAGE_TITLES[id], count: counts[id] });

  const groups: NavGroup[] = [
    { id: 'daily', items: DAILY.map(item) },
    { id: 'proof', label: 'Pipeline and proof', items: PROOF.map(item) },
  ];

  // Fetch a screen's chunk as soon as the rep points at (or tabs to) its nav item.
  const warm = (e: PointerEvent | FocusEvent) => {
    const id = (e.target as Element).closest?.('[data-nav]')?.getAttribute('data-nav');
    if (isScreen(id)) void preloadScreen(id).catch(() => undefined);
  };

  return (
    <div className="kshell-nav" onPointerOver={warm} onFocus={warm}>
      <Nav
        aria-label="Kindling"
        groups={groups}
        activeId={active}
        onSelect={id => { if (isScreen(id)) onSelect(id); }}
        brand={<><span className="kshell-mark" aria-hidden="true">K</span>Kindling</>}
        footer={<><AlertsSent /><ThemeSwitch /></>}
      />
    </div>
  );
}

/** "Alerts sent Nov 17 (n8n)": the latest run_at in /automations/log (a real date, not the simulated one). */
function AlertsSent() {
  const { data, isLoading, error } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });
  if (isLoading) return <Skeleton width="80%" height="label" />;
  if (error) return <p className="kshell-alerts">Alert runs unavailable</p>;
  // The log isn't sorted: the latest run is the greatest run_at (ISO strings sort as dates).
  const last = (data ?? []).reduce<AutomationRun | null>((a, r) => (!a || r.run_at > a.run_at ? r : a), null);
  if (!last) return <p className="kshell-alerts">No alerts sent yet (n8n)</p>;
  const day = parseDay(last.run_at);
  const short = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const full = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <p className="kshell-alerts" data-testid="alerts-sent" title={`Last n8n run: ${full}`}>
      {last.status === 'failed' ? 'Alert run failed' : 'Alerts sent'}{' '}
      <time className="k-num" dateTime={last.run_at.slice(0, 10)}>{short}</time> (n8n)
    </p>
  );
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function ThemeSwitch() {
  const [pref, setPref] = useThemePref();
  return (
    <div className="kshell-theme" data-testid="theme-switch">
      <SegmentedControl aria-label="Theme" value={pref} onChange={setPref} options={THEMES} />
    </div>
  );
}
