import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAutomationsLog } from '../api';
import { usePql, useHealth } from '../asOf';
import { type Screen, parseDay as parseDayLocal } from '../nav';
import type { AutomationRun } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';


interface Props {
  onNavigate: (screen: Screen, schoolId?: string) => void;
}

function StatTile({
  label, value, subline, valueColor, onClick, hint,
}: {
  label: string;
  value: string | number;
  subline: string;
  valueColor?: string;
  onClick?: () => void;
  hint?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && onClick ? 'var(--nav)' : 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
        flex: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {onClick && (
          <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.1s', fontSize: 12 }}>
            {hint ?? 'View all →'}
          </span>
        )}
      </div>
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

function Row({ label, value, sub, dimmed }: { label: string; value: string; sub?: string; dimmed?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: dimmed ? 'var(--muted)' : 'var(--body)' }}>{label}</span>
      <span style={{
        fontSize: 13,
        fontFamily: 'JetBrains Mono, monospace',
        color: dimmed ? 'var(--muted)' : 'var(--ink)',
        fontWeight: dimmed ? 400 : 500,
      }}>
        {value}{sub && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{sub}</span>}
      </span>
    </div>
  );
}

export default function MondayBrief({ onNavigate }: Props) {
  const { data: pql, isLoading: pqlLoading, error: pqlError } = usePql();
  const { data: health, isLoading: healthLoading, error: healthError } = useHealth();
  const { data: automations, isLoading: autoLoading } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });
  const [nrrOpen, setNrrOpen] = useState(false);

  if (pqlError || healthError) {
    return <div style={{ color: 'var(--muted)', fontSize: 14 }}>Failed to load — is the API running?</div>;
  }

  const ready = pql?.filter(s => s.status === 'Ready') ?? [];
  const atRisk = health?.filter(s => s.status === 'At risk') ?? [];

  // Always show 3 schools in the At risk card — real at-risk first, then lowest health scores to fill
  const atRiskIds = new Set(atRisk.map(s => s.school_id));
  const watchFill = [...(health ?? [])]
    .filter(s => !atRiskIds.has(s.school_id))
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, Math.max(0, 3 - atRisk.length));
  const top3Risk = [
    ...atRisk.slice(0, 3).map(s => ({ ...s, _watch: false })),
    ...watchFill.map(s => ({ ...s, _watch: true })),
  ];

  // Real NRR calculation from actual data
  const totalARR = health?.reduce((sum, s) => sum + s.arr, 0) ?? 0;
  const atRiskARR = atRisk.reduce((sum, s) => sum + s.arr, 0);
  const retainedARR = totalARR - atRiskARR;
  const nrr = totalARR > 0 ? Math.round((retainedARR / totalARR) * 100) : 100;
  // Upside: if all Ready-to-buy schools convert at the avg ARR per existing customer
  const avgARR = health && health.length > 0 ? Math.round(totalARR / health.length) : 0;
  const upsideARR = ready.length * avgARR;
  const nrrWithUpside = totalARR > 0 ? Math.round(((retainedARR + upsideARR) / totalARR) * 100) : 100;

  const nrrSubline = atRisk.length === 0
    ? 'No churn risk in next 90 days'
    : `${atRisk.length} school${atRisk.length !== 1 ? 's' : ''} likely to churn`;

  const top5Ready = ready.slice(0, 5);
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
          subline={`${ready.length} school${ready.length !== 1 ? 's' : ''} scored ≥ 60 PQL`}
          valueColor="var(--ember)"
          onClick={() => onNavigate('ready')}
        />
        <StatTile
          label="At risk"
          value={atRisk.length}
          subline="Renewing in the next 90 days"
          valueColor={atRisk.length > 0 ? 'var(--risk)' : 'var(--ink)'}
          onClick={() => onNavigate('risk')}
        />
        <StatTile
          label="ARR at risk"
          value={`$${atRiskARR.toLocaleString()}`}
          subline={atRisk.length === 0 ? 'No schools at risk of churning' : `Across ${atRisk.length} school${atRisk.length !== 1 ? 's' : ''} renewing soon`}
          valueColor={atRiskARR > 0 ? 'var(--ember)' : 'var(--ink)'}
          onClick={() => onNavigate('risk')}
        />
        <StatTile
          label="Projected NRR"
          value={`${nrr}%`}
          subline={nrrSubline}
          valueColor={nrr >= 100 ? 'var(--steady)' : 'var(--risk)'}
          onClick={() => setNrrOpen(o => !o)}
          hint={nrrOpen ? 'Hide breakdown ↑' : 'See breakdown ↓'}
        />
      </div>

      {/* NRR breakdown panel */}
      {nrrOpen && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            Projected NRR · how we got to {nrr}%
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
            {/* Left: the math */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Retention math
              </div>
              <div style={{ borderTop: '1px solid var(--row-divider)' }}>
                <Row
                  label={`Starting ARR (${health?.length ?? 0} paying schools)`}
                  value={`$${totalARR.toLocaleString()}`}
                />
                <Row
                  label={`Projected churn (${atRisk.length} at-risk in 90 days)`}
                  value={atRiskARR > 0 ? `-$${atRiskARR.toLocaleString()}` : '-$0'}
                  dimmed={atRiskARR === 0}
                />
                <div style={{ borderTop: '1px solid var(--row-divider)', marginTop: 4 }} />
                <Row
                  label="Projected retained ARR"
                  value={`$${retainedARR.toLocaleString()}`}
                />
                <Row
                  label={`NRR = $${retainedARR.toLocaleString()} / $${totalARR.toLocaleString()}`}
                  value={`${nrr}%`}
                />
              </div>
            </div>

            {/* Right: upside */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Potential upside (if Ready schools convert)
              </div>
              <div style={{ borderTop: '1px solid var(--row-divider)' }}>
                <Row
                  label={`Avg ARR per paying school`}
                  value={`$${avgARR.toLocaleString()}`}
                  dimmed
                />
                <Row
                  label={`${ready.length} Ready-to-buy schools × $${avgARR.toLocaleString()}`}
                  value={`+$${upsideARR.toLocaleString()}`}
                />
                <div style={{ borderTop: '1px solid var(--row-divider)', marginTop: 4 }} />
                <Row
                  label="NRR with full conversion"
                  value={`${nrrWithUpside}%`}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                  This assumes all {ready.length} Ready schools convert at the average contract value.
                  Real conversion will be lower — but this is the ceiling.
                </div>
              </div>
            </div>
          </div>

          {atRisk.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--row-divider)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Schools pulling NRR down
              </div>
              {atRisk.map(s => {
                const renewDate = parseDayLocal(s.renewal_date);
                return (
                  <div
                    key={s.school_id}
                    onClick={() => onNavigate('risk', s.school_id)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--risk)', fontFamily: 'JetBrains Mono, monospace' }}>
                      -${s.arr.toLocaleString()} · renews {renewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
              style={{ background: 'none', border: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
            >
              View all {ready.length}
            </button>
          </div>

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
              onClick={() => onNavigate('ready', school.school_id)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 1fr',
                gap: 8,
                padding: '10px 8px',
                borderBottom: i < top5Ready.length - 1 ? '1px solid var(--row-divider)' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'background 0.1s',
                margin: '0 -8px',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                  {school.district ? 'District' : 'Independent'} · {school.state}
                </div>
              </div>
              <ScoreChip score={school.pql_score} type="pql" status={school.status} />
              <div style={{ fontSize: 13, color: 'var(--body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {atRisk.length > 0 ? 'At risk · next 90 days' : 'Watch list · lowest health scores'}
            </span>
            <button
              onClick={() => onNavigate('risk')}
              style={{ background: 'none', border: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
            >
              View all
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 150px 80px 70px 1fr',
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
            const renewDate = parseDayLocal(school.renewal_date);
            const renewLabel = renewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div
                key={school.school_id}
                onClick={() => onNavigate('risk', school.school_id)}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 150px 80px 70px 1fr',
                  gap: 8,
                  padding: '10px 8px',
                  borderBottom: i < top3Risk.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRadius: 6,
                  transition: 'background 0.1s',
                  margin: '0 -8px',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                  {school._watch && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Watch · low health</div>
                  )}
                </div>
                <ScoreChip score={school.health_score} type="health" status={school.status} />
                <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>{renewLabel}</div>
                <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>${(school.arr / 1000).toFixed(0)}K</div>
                <div style={{ fontSize: 13, color: 'var(--body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {school.reasons[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cold leads card */}
      {(() => {
        const cold = (pql ?? []).filter(s => s.pql_score === 0).slice(0, 3);
        const dormant = (pql ?? []).filter(s => s.pql_score > 0 && s.pql_score < 20).slice(0, 3 - cold.length);
        const prospects = [...cold, ...dormant].slice(0, 3);
        return (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Prospects · needs activation</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 10 }}>
                  {(pql ?? []).filter(s => s.pql_score < 20).length} schools with no meaningful activity
                </span>
              </div>
              <button
                onClick={() => onNavigate('prospects')}
                style={{ background: 'none', border: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
              >
                View all →
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {prospects.map(school => (
                <div
                  key={school.school_id}
                  onClick={() => onNavigate('prospects')}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{
                    flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{school.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {school.state} · PQL {school.pql_score} · {school.active_teachers} teachers active
                  </div>
                  {school.contact_name && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {school.contact_name} · {school.contact_title}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
            <span style={{ fontSize: 13, fontWeight: 600, color: lastRun.status === 'succeeded' ? 'var(--steady)' : 'var(--risk)' }}>
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
