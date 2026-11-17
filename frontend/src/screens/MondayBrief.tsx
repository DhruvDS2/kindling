import { useQuery } from '@tanstack/react-query';
import { fetchPql, fetchHealth, fetchAutomationsLog } from '../api';
import type { PqlScore, HealthScore, AutomationRun } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';

type Screen = 'brief' | 'ready' | 'risk' | 'backtest' | 'automations';

interface Props {
  onNavigate: (screen: Screen) => void;
}

function StatTile({
  label, value, subline, valueColor,
}: {
  label: string;
  value: string | number;
  subline: string;
  valueColor?: string;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      padding: 20,
      flex: 1,
    }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: valueColor ?? 'var(--ink)',
        lineHeight: 1.1,
        marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{subline}</div>
    </div>
  );
}

export default function MondayBrief({ onNavigate }: Props) {
  const { data: pql, isLoading: pqlLoading, error: pqlError } = useQuery<PqlScore[]>({ queryKey: ['pql'], queryFn: () => fetchPql() });
  const { data: health, isLoading: healthLoading, error: healthError } = useQuery<HealthScore[]>({ queryKey: ['health'], queryFn: () => fetchHealth() });
  const { data: automations, isLoading: autoLoading } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });

  if (pqlError || healthError) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>
        Failed to load — is the API running?
      </div>
    );
  }

  const ready = pql?.filter(s => s.status === 'Ready') ?? [];
  const atRisk = health?.filter(s => s.status === 'At risk' && s.days_to_renewal <= 90) ?? [];
  const arrAtRisk = atRisk.reduce((sum, s) => sum + s.arr, 0);

  const totalPaid = health?.length ?? 0;
  const nrrProjected = totalPaid > 0
    ? ((totalPaid - atRisk.length) / totalPaid * 104 + (atRisk.length / totalPaid * 60)).toFixed(0)
    : '104';
  const nrrLabel = parseInt(nrrProjected) >= 100 ? 'Expansion offsets churn' : 'Churn risk present';

  const top5Ready = ready.slice(0, 5);
  const top3Risk = atRisk.slice(0, 3);
  const lastRun = automations?.[0];

  const isLoading = pqlLoading || healthLoading;

  if (isLoading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} rows={3} />)}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat tiles */}
      <div style={{ display: 'flex', gap: 16 }}>
        <StatTile
          label="Ready to buy"
          value={ready.length}
          subline="+2 since last week"
          valueColor="var(--ember)"
        />
        <StatTile
          label="At risk"
          value={atRisk.length}
          subline="Renewing in the next 90 days"
          valueColor="var(--risk)"
        />
        <StatTile
          label="ARR at risk"
          value={`$${arrAtRisk.toLocaleString()}`}
          subline={`Across ${atRisk.length} schools`}
          valueColor="var(--ember)"
        />
        <StatTile
          label="Projected NRR"
          value={`${nrrProjected}%`}
          subline={nrrLabel}
          valueColor="var(--steady)"
        />
      </div>

      {/* Two side-by-side cards */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Ready to buy top 5 */}
        <div style={{
          flex: 1,
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 20,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Ready to buy · top 5</span>
            <button
              onClick={() => onNavigate('ready')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ember)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                padding: 0,
              }}
            >
              View all {ready.length}
            </button>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 1fr',
            gap: 8,
            paddingBottom: 8,
            borderBottom: '1px solid var(--row-divider)',
            fontSize: 12,
            color: 'var(--muted)',
          }}>
            <span>School</span>
            <span>PQL</span>
            <span>Top reason</span>
          </div>

          {top5Ready.map((school, i) => (
            <div
              key={school.school_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 1fr',
                gap: 8,
                padding: '10px 0',
                borderBottom: i < top5Ready.length - 1 ? '1px solid var(--row-divider)' : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                  {school.district ? 'District' : 'Independent'} · {school.state}
                </div>
              </div>
              <ScoreChip score={school.pql_score} type="pql" />
              <div style={{
                fontSize: 13,
                color: 'var(--body)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {school.reasons[0]}
              </div>
            </div>
          ))}
        </div>

        {/* At risk */}
        <div style={{
          flex: 1,
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 20,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>At risk · next 90 days</span>
            <button
              onClick={() => onNavigate('risk')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ember)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                padding: 0,
              }}
            >
              View all {atRisk.length}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 80px 70px 1fr',
            gap: 8,
            paddingBottom: 8,
            borderBottom: '1px solid var(--row-divider)',
            fontSize: 12,
            color: 'var(--muted)',
          }}>
            <span>School</span>
            <span>Health</span>
            <span>Renews</span>
            <span>ARR</span>
            <span>Top reason</span>
          </div>

          {top3Risk.map((school, i) => {
            const renewDate = new Date(Date.now() + school.days_to_renewal * 86400000);
            const renewLabel = renewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div
                key={school.school_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 80px 70px 1fr',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: i < top3Risk.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                <ScoreChip score={school.health_score} type="health" />
                <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>{renewLabel}</div>
                <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>${(school.arr / 1000).toFixed(0)}K</div>
                <div style={{
                  fontSize: 13,
                  color: 'var(--body)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {school.reasons[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last automation run strip */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, flexShrink: 0 }}>Last automation run</span>
        {autoLoading ? (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span>
        ) : lastRun ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {new Date(lastRun.run_at).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {lastRun.trigger}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {lastRun.pql_alerts + (lastRun.cs_alerts ?? lastRun.health_alerts ?? 0)} Slack alerts
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {lastRun.email_drafts} email drafts
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: lastRun.status === 'succeeded' ? 'var(--steady)' : 'var(--risk)',
            }}>
              {lastRun.status === 'succeeded' ? 'Succeeded' : 'Failed'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            No automation runs yet — import the n8n workflow and trigger it.
          </span>
        )}
      </div>
    </div>
  );
}
