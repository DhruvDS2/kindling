import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAutomationsLog } from '../api';
import { useAsOf, useHealth, usePql, useStats } from '../asOf';
import { type Screen, fmtDay } from '../nav';
import type { AutomationRun, HealthScore, PqlScore } from '../types';
import ScoreChip, { ReasonList, topReasons } from '../components/ScoreChip';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';

interface Props {
  onNavigate: (screen: Screen, schoolId?: string) => void;
}

// Layout only (how many rows fit a card), never data: counts on screen come from the API.
const CARD_ROWS = 5;
const WATCH_MIN_ROWS = 3;

const MONO = 'JetBrains Mono, monospace';
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const pct = (x: number) => x.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 });
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

function StatTile({ label, value, subline, valueColor, onClick, hint, testId }: {
  label: string;
  value: ReactNode;
  subline: ReactNode;
  valueColor?: string;
  onClick?: () => void;
  hint?: string;
  testId: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      data-testid={testId}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && onClick ? 'var(--nav)' : 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{label}</span>
        {onClick && (
          <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.1s', fontSize: 12, whiteSpace: 'nowrap' }}>
            {hint ?? 'View all →'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: valueColor ?? 'var(--ink)', lineHeight: 1.1, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>{subline}</div>
    </div>
  );
}

function Card({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

/** One school in a brief card: name, a context line, its chip, and its top reason with points. */
function BriefRow({ name, sub, chip, reasonOf, onClick, first }: {
  name: string;
  sub: ReactNode;
  chip: ReactNode;
  reasonOf: PqlScore | HealthScore;
  onClick: () => void;
  first: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      style={{
        padding: '10px 8px', margin: '0 -8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s',
        borderTop: first ? 'none' : '1px solid var(--row-divider)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
        </div>
        {chip}
      </div>
      <div style={{ marginTop: 6 }}>
        <ReasonList reasons={topReasons(reasonOf).slice(0, 1)} wrap={false} />
      </div>
    </div>
  );
}

const kindOf = (s: { type: 'district' | 'independent' }) => (s.type === 'district' ? 'District' : 'Independent');

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 2px' }}>
      {children}
    </div>
  );
}

export default function MondayBrief({ onNavigate }: Props) {
  const { asOf } = useAsOf();
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats();
  const { data: pql, error: pqlError } = usePql();
  const { data: health, error: healthError } = useHealth();
  const { data: automations, isLoading: autoLoading } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });
  const [nrrOpen, setNrrOpen] = useState(false);

  if (statsError) {
    return <div style={{ color: 'var(--muted)', fontSize: 14 }}>Couldn't load the brief: {(statsError as Error).message}</div>;
  }
  if (statsLoading || !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1 }}><SkeletonCard rows={3} /></div>)}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  const ready = (pql ?? []).filter(s => s.status === 'Ready');
  // The API's order is lowest health first; the watch list follows the API's status, never a score cut of its own.
  const byHealth = [...(health ?? [])].sort((a, b) => a.health_score - b.health_score);
  const atRisk = byHealth.filter(s => s.status === 'At risk');
  const lowestHealthy = atRisk.length < WATCH_MIN_ROWS
    ? byHealth.filter(s => s.status !== 'At risk').slice(0, WATCH_MIN_ROWS - atRisk.length)
    : [];
  // The run log isn't sorted: the latest run is the greatest run_at (ISO strings sort as dates).
  const lastRun = (automations ?? []).reduce<AutomationRun | null>(
    (latest, r) => (!latest || r.run_at > latest.run_at ? r : latest), null);
  const csAlerts = lastRun ? (lastRun.health_alerts ?? lastRun.cs_alerts) : undefined;

  const healthRow = (s: HealthScore, i: number) => (
    <BriefRow
      key={s.school_id}
      first={i === 0}
      name={s.name}
      sub={<>{kindOf(s)} · renews {fmtDay(s.renewal_date)}, in <span style={{ fontFamily: MONO }}>{s.days_to_renewal}</span> {s.days_to_renewal === 1 ? 'day' : 'days'} · <span style={{ fontFamily: MONO }}>{usd(s.arr)}</span> ARR</>}
      chip={<ScoreChip score={s.health_score} type="health" status={s.status} />}
      reasonOf={s}
      onClick={() => onNavigate('risk', s.school_id)}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat tiles: every number and definition here comes from GET /stats */}
      <div style={{ display: 'flex', gap: 16 }}>
        <StatTile
          testId="tile-ready"
          label="Ready to buy"
          value={stats.ready_to_buy}
          subline={stats.definitions.ready}
          valueColor="var(--ember)"
          onClick={() => onNavigate('ready')}
        />
        <StatTile
          testId="tile-at-risk"
          label="At risk"
          value={stats.at_risk}
          subline={stats.definitions.at_risk}
          valueColor={stats.at_risk > 0 ? 'var(--risk)' : 'var(--ink)'}
          onClick={() => onNavigate('risk')}
        />
        <StatTile
          testId="tile-arr-at-risk"
          label="ARR at risk"
          value={usd(stats.arr_at_risk)}
          subline={stats.arr_at_risk_school_count > 0
            ? <>Across {plural(stats.arr_at_risk_school_count, 'at-risk school')} · of {usd(stats.total_arr)} paid ARR</>
            : <>No paid school is at risk · {usd(stats.total_arr)} paid ARR</>}
          valueColor={stats.arr_at_risk > 0 ? 'var(--risk)' : 'var(--ink)'}
          onClick={() => onNavigate('risk')}
        />
        <StatTile
          testId="tile-nrr"
          label="Projected NRR"
          value={pct(stats.projected_nrr)}
          subline={<>{usd(stats.arr_churned_to_date)} churned to date · {usd(stats.arr_at_risk)} at risk</>}
          onClick={() => setNrrOpen(o => !o)}
          hint={nrrOpen ? 'Hide how ↑' : 'How it’s computed ↓'}
        />
      </div>

      {nrrOpen && (
        <div data-testid="nrr-breakdown" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Projected NRR · {pct(stats.projected_nrr)}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{stats.definitions.projected_nrr}</div>
          <div style={{ maxWidth: 520, borderTop: '1px solid var(--row-divider)' }}>
            {[
              ['Total paid ARR', usd(stats.total_arr)],
              [`ARR already churned by ${fmtDay(asOf)}`, `− ${usd(stats.arr_churned_to_date)}`],
              [`ARR at risk (${plural(stats.arr_at_risk_school_count, 'school')})`, `− ${usd(stats.arr_at_risk)}`],
              ['Projected NRR', pct(stats.projected_nrr)],
            ].map(([label, value], i, all) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13,
                borderTop: i === all.length - 1 ? '1px solid var(--line)' : 'none',
                fontWeight: i === all.length - 1 ? 600 : 400,
              }}>
                <span style={{ color: 'var(--body)' }}>{label}</span>
                <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to buy + watch list */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Card
          title="Ready to buy"
          action={<LinkButton onClick={() => onNavigate('ready')}>{stats.ready_to_buy > 0 ? `View all ${stats.ready_to_buy}` : 'View ranking'}</LinkButton>}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Highest PQL first · {stats.definitions.ready}</div>
          {pqlError ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Couldn't load PQL scores: {(pqlError as Error).message}</div>
          ) : !pql ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              {[0, 1, 2].map(i => <SkeletonBlock key={i} height={36} />)}
            </div>
          ) : ready.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>No school is Ready on {fmtDay(asOf)}.</div>
          ) : (
            ready.slice(0, CARD_ROWS).map((s, i) => (
              <BriefRow
                key={s.school_id}
                first={i === 0}
                name={s.name}
                sub={<>{kindOf(s)} · {s.city}, {s.state}{s.ready_rule === 'admin' ? ' · Ready by admin rule' : ''}</>}
                chip={<ScoreChip score={s.pql_score} type="pql" status={s.status} />}
                reasonOf={s}
                onClick={() => onNavigate('ready', s.school_id)}
              />
            ))
          )}
        </Card>

        <Card
          title="Watch list"
          action={<LinkButton onClick={() => onNavigate('risk')}>{stats.at_risk > 0 ? `View all ${stats.at_risk} at risk` : 'View all paid schools'}</LinkButton>}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Lowest health first · {stats.definitions.at_risk}</div>
          {healthError ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Couldn't load health scores: {(healthError as Error).message}</div>
          ) : !health ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              {[0, 1, 2].map(i => <SkeletonBlock key={i} height={36} />)}
            </div>
          ) : (
            <>
              {atRisk.length === 0 ? (
                <div data-testid="watch-none" style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>
                  No paid school is at risk on {fmtDay(asOf)}.
                </div>
              ) : (
                atRisk.slice(0, CARD_ROWS).map(healthRow)
              )}
              {lowestHealthy.length > 0 && (
                <div data-testid="watch-lowest-healthy">
                  <GroupLabel>Lowest health · not at risk</GroupLabel>
                  {lowestHealthy.map(healthRow)}
                </div>
              )}
              {byHealth.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>No paid school has a health score and a renewal still ahead on this date.</div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Last automation run */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, flexShrink: 0 }}>Last automation run</span>
        {autoLoading ? (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Reading the run log…</span>
        ) : lastRun ? (
          <>
            <span data-testid="last-run-date" style={{ fontSize: 13, color: 'var(--body)', fontFamily: MONO }}>
              {fmtDay(lastRun.run_at)}{lastRun.trigger ? ` · ${lastRun.trigger}` : ''}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: MONO }}>{plural(lastRun.pql_alerts, 'PQL alert')}</span>
            {csAlerts !== undefined && (
              <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: MONO }}>{plural(csAlerts, 'CS alert')}</span>
            )}
            <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: MONO }}>{plural(lastRun.email_drafts, 'email draft')}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: lastRun.status === 'succeeded' ? 'var(--steady)' : 'var(--risk)' }}>
              {lastRun.status === 'succeeded' ? 'Succeeded' : 'Failed'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
              n8n run log · {plural((automations ?? []).length, 'run')} logged
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            No automation runs yet. Import the n8n workflow and trigger it.
          </span>
        )}
      </div>
    </div>
  );
}
