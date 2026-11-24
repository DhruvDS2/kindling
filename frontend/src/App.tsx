import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAutomationsLog } from './api';
import type { AutomationRun } from './types';
import { useAsOf, useStats } from './asOf';
import { type Screen, readUrl, writeUrl, fmtDay } from './nav';
import MondayBrief from './screens/MondayBrief';
import ReadyToBuy from './screens/ReadyToBuy';
import AtRisk from './screens/AtRisk';
import Backtest from './screens/Backtest';
import Automations from './screens/Automations';
import Pipeline from './screens/Pipeline';
import Prospects from './screens/Prospects';

export default function App() {
  const { asOf, setAsOf, meta } = useAsOf();
  const [screen, setScreen] = useState<Screen>(() => readUrl().screen ?? 'brief');
  const [focusSchoolId, setFocusSchoolId] = useState<string | null>(() => readUrl().school);

  function navigate(s: Screen, schoolId?: string) {
    setScreen(s);
    setFocusSchoolId(schoolId ?? null);
    writeUrl({ screen: s, school: schoolId ?? null });
  }

  // The open detail drawer lives in the URL (?school=…) so a drawer can be linked or screenshotted.
  function selectSchool(schoolId: string | null) {
    setFocusSchoolId(schoolId);
    writeUrl({ school: schoolId });
  }

  const { data: stats } = useStats();
  const { data: automationsData } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });

  const readyCount = stats?.ready_to_buy ?? 0;
  const riskCount = stats?.at_risk ?? 0;

  // The run log isn't sorted: the latest run is the greatest run_at (ISO strings sort as dates).
  const lastRun = (automationsData ?? []).reduce<AutomationRun | null>(
    (latest, r) => (!latest || r.run_at > latest.run_at ? r : latest), null);
  const syncLabel = lastRun ? fmtDay(lastRun.run_at) : null;

  const pageTitle: Record<Screen, string> = {
    brief: 'Monday brief',
    ready: 'Ready to buy',
    risk: 'At risk',
    backtest: 'Backtest: churn alerts',
    automations: 'Automations',
    pipeline: 'Pipeline funnel',
    prospects: 'Prospects',
  };

  const navItems: { id: Screen; label: string; badge?: number; badgeType?: 'ember' | 'risk' }[] = [
    { id: 'brief', label: 'Monday brief' },
    { id: 'ready', label: 'Ready to buy', badge: readyCount, badgeType: 'ember' },
    { id: 'risk', label: 'At risk', badge: riskCount, badgeType: 'risk' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'prospects', label: 'Prospects' },
    { id: 'backtest', label: 'Backtest' },
    { id: 'automations', label: 'Automations' },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
      {/* Left nav: the column runs the full page height; the nav itself stays in view while the page scrolls */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--nav)' }}>
      <nav style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        position: 'sticky',
        top: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingLeft: 4 }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'var(--ember)',
            borderRadius: 6,
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
            Kindling
          </span>
        </div>

        {/* Nav items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {navItems.map(item => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                data-nav={item.id}
                onClick={() => navigate(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--card)' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: 'var(--ink)',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: item.badgeType === 'ember' ? 'var(--ember)' : 'var(--risk)',
                    color: '#fff',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </nav>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        minWidth: 0,
        padding: '28px 36px',
        overflowY: 'auto',
        minHeight: '100vh',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div data-testid="page-subtitle" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              {screen === 'backtest'
                ? `Replayed every Monday, ${fmtDay(meta.replay_start)} to ${fmtDay(meta.replay_end)} · scorer never sees outcomes`
                : `Scores as of ${fmtDay(asOf, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}${asOf === meta.demo_as_of ? ' (demo date)' : ''}`}
            </div>
            <h1 style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--ink)',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {pageTitle[screen]}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {/* As-of date: every score on screen is computed for this day of the simulated year */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
            As of
            <input
              type="date"
              data-testid="as-of"
              value={asOf}
              min={meta.sim_start}
              max={meta.sim_end}
              onChange={e => e.target.value && setAsOf(e.target.value)}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '4px 8px',
                       border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)' }}
            />
          </label>
          {asOf !== meta.demo_as_of && (
            <button data-testid="reset-as-of" onClick={() => setAsOf(meta.demo_as_of)}
              style={{ fontSize: 13, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 8,
                       background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
              Demo date
            </button>
          )}
          {/* Sync pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--line)',
            borderRadius: 20,
            fontSize: 13,
            color: 'var(--muted)',
            background: 'var(--card)',
            whiteSpace: 'nowrap',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: !lastRun ? 'var(--naive)' : lastRun.status === 'succeeded' ? 'var(--steady)' : 'var(--risk)',
              flexShrink: 0,
            }} />
            {syncLabel ? `Last n8n run · ${syncLabel}` : 'No n8n runs yet'}
          </div>
          </div>
        </div>

        {screen === 'brief' && <MondayBrief onNavigate={navigate} />}
        {screen === 'ready' && <ReadyToBuy schoolId={focusSchoolId} onSelectSchool={selectSchool} />}
        {screen === 'risk' && <AtRisk schoolId={focusSchoolId} onSelectSchool={selectSchool} />}
        {screen === 'pipeline' && <Pipeline />}
        {screen === 'prospects' && <Prospects />}
        {screen === 'backtest' && <Backtest />}
        {screen === 'automations' && <Automations />}
      </main>
    </div>
  );
}
