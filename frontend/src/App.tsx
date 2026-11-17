import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPql, fetchHealth, fetchAutomationsLog, DEFAULT_AS_OF } from './api';
import type { PqlScore, HealthScore, AutomationRun } from './types';
import MondayBrief from './screens/MondayBrief';
import ReadyToBuy from './screens/ReadyToBuy';
import AtRisk from './screens/AtRisk';
import Backtest from './screens/Backtest';
import Automations from './screens/Automations';

type Screen = 'brief' | 'ready' | 'risk' | 'backtest' | 'automations';

export default function App() {
  const [screen, setScreen] = useState<Screen>('brief');

  const { data: pqlData } = useQuery<PqlScore[]>({ queryKey: ['pql'], queryFn: () => fetchPql() });
  const { data: healthData } = useQuery<HealthScore[]>({ queryKey: ['health'], queryFn: () => fetchHealth() });
  const { data: automationsData } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });

  const readyCount = pqlData?.filter(s => s.status === 'Ready').length ?? 0;
  const riskCount = healthData?.filter(s => s.status === 'At risk').length ?? 0;

  const lastRun = automationsData?.[automationsData.length - 1];
  const syncLabel = lastRun
    ? (() => {
        const diff = Date.now() - new Date(lastRun.run_at).getTime();
        const h = Math.round(diff / 3600000);
        return h < 1 ? 'Just now' : `${h}h ago`;
      })()
    : null;

  const pageTitle: Record<Screen, string> = {
    brief: 'Monday brief',
    ready: 'Ready to buy',
    risk: 'At risk',
    backtest: 'Backtest: churn alerts',
    automations: 'Automations',
  };

  const navItems: { id: Screen; label: string; badge?: number; badgeType?: 'ember' | 'risk' }[] = [
    { id: 'brief', label: 'Monday brief' },
    { id: 'ready', label: 'Ready to buy', badge: readyCount, badgeType: 'ember' },
    { id: 'risk', label: 'At risk', badge: riskCount, badgeType: 'risk' },
    { id: 'backtest', label: 'Backtest' },
    { id: 'automations', label: 'Automations' },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
      {/* Left nav */}
      <nav style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--nav)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        padding: '20px 12px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
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
                onClick={() => setScreen(item.id)}
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

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: 220,
        padding: '28px 36px',
        overflowY: 'auto',
        minHeight: '100vh',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              {screen === 'backtest'
                ? 'Replayed every Monday, Sep 2025 to Jun 2026 · scorer never sees outcomes'
                : `Week of ${new Date(DEFAULT_AS_OF + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`}
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
            marginTop: 4,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: syncLabel ? 'var(--steady)' : 'var(--naive)',
              flexShrink: 0,
            }} />
            {syncLabel ? `Synced from n8n · ${syncLabel}` : 'Not yet synced'}
          </div>
        </div>

        {screen === 'brief' && <MondayBrief onNavigate={setScreen} />}
        {screen === 'ready' && <ReadyToBuy />}
        {screen === 'risk' && <AtRisk />}
        {screen === 'backtest' && <Backtest />}
        {screen === 'automations' && <Automations />}
      </main>
    </div>
  );
}
