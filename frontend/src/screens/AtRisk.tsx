import { Fragment, useState, type CSSProperties } from 'react';
import { useAsOf, useHealth, useStats } from '../asOf';
import { fmtDay } from '../nav';
import type { HealthScore } from '../types';
import ScoreChip, { ReasonList, topReasons } from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';
import AccountDetail from '../components/AccountDetail';

interface Props {
  schoolId: string | null;                      // the open drawer (?school=…)
  onSelectSchool: (schoolId: string | null) => void;
}

type Filter = 'risk' | 'all';

const MONO = 'JetBrains Mono, monospace';
const th: CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 12, color: 'var(--muted)',
  fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)',
};
const td: CSSProperties = { padding: '12px 14px', verticalAlign: 'top' };
const num: CSSProperties = { ...td, fontFamily: MONO, fontSize: 13, color: 'var(--body)', textAlign: 'right', whiteSpace: 'nowrap', paddingTop: 15 };
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

function place(s: HealthScore) {
  const kind = s.type === 'district' ? 'District' : 'Independent';
  return [kind, s.district, `${s.city}, ${s.state}`].filter(Boolean).join(' · ');
}

function FilterTabs({ value, onChange, options }: {
  value: Filter;
  onChange: (f: Filter) => void;
  options: { id: Filter; label: string; count: number }[];
}) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'var(--nav)', gap: 2 }}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            data-filter={o.id}
            onClick={() => onChange(o.id)}
            style={{
              border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13,
              fontFamily: 'Inter', fontWeight: active ? 600 : 400, color: active ? 'var(--ink)' : 'var(--muted)',
              background: active ? 'var(--card)' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {o.label} <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--muted)' }}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AtRisk({ schoolId, onSelectSchool }: Props) {
  const { asOf, meta } = useAsOf();
  const { data, isLoading, error } = useHealth();
  const { data: stats } = useStats();
  const [picked, setPicked] = useState<Filter | null>(null);
  const [linkedSchool] = useState(schoolId);   // a school opened from a link or the brief, which may be Healthy

  if (error) return <div style={{ color: 'var(--muted)' }}>Couldn't load health scores: {(error as Error).message}</div>;
  if (isLoading || !data) return <SkeletonCard rows={6} />;

  // Every scored paid school (the API only returns schools whose renewal is still ahead), lowest health first.
  const ranked = [...data].sort((a, b) => a.health_score - b.health_score || a.days_to_renewal - b.days_to_renewal);
  const atRisk = ranked.filter(s => s.status === 'At risk');     // the one at-risk rule: the API's status
  const linkedHealthy = data.some(s => s.school_id === linkedSchool && s.status !== 'At risk');
  // Default: At risk when any school is at risk, otherwise all. A linked Healthy school opens on All so its row shows.
  const filter: Filter = picked ?? (atRisk.length > 0 && !linkedHealthy ? 'risk' : 'all');
  const rows = filter === 'risk' ? atRisk : ranked;
  const lineAt = filter === 'all' && atRisk.length > 0 ? rows.findIndex(s => s.status !== 'At risk') : -1;
  const selected = schoolId ? data.find(s => s.school_id === schoolId) ?? null : null;
  const cols = 5;

  return (
    <>
      {schoolId && !selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 14px', fontSize: 13,
                      color: 'var(--body)', background: 'var(--nav)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <span><span style={{ fontFamily: MONO }}>{schoolId}</span> isn't a paid school with a health score and a renewal ahead on {fmtDay(asOf)}.</span>
          <button onClick={() => onSelectSchool(null)}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Summary + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px',
                      borderBottom: '1px solid var(--line)' }}>
          <div>
            <div data-testid="risk-summary" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: atRisk.length ? 'var(--risk)' : 'var(--ink)' }}>{atRisk.length}</span> at risk
              <span style={{ color: 'var(--muted)' }}> of </span>
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>{ranked.length}</span> paid schools with a renewal still ahead
              {stats && stats.arr_at_risk > 0 && (
                <>
                  <span style={{ color: 'var(--muted)' }}> · </span>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--risk)' }}>{usd(stats.arr_at_risk)}</span> ARR at risk
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              At risk = health score below <span style={{ fontFamily: MONO }}>{meta.thresholds.health_at_risk_below}</span> ·
              lowest health first · each school scored on its own last <span style={{ fontFamily: MONO }}>{meta.windows.school_days}</span> school days
            </div>
          </div>
          <FilterTabs
            value={filter}
            onChange={setPicked}
            options={[
              { id: 'risk', label: 'At risk', count: atRisk.length },
              { id: 'all', label: 'All paid schools', count: ranked.length },
            ]}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 270, paddingLeft: 16 }}>School · contact</th>
              <th style={{ ...th, width: 132 }}>Health</th>
              <th style={th}>Top reasons <span style={{ fontWeight: 400 }}>· points earned / max</span></th>
              <th style={{ ...th, width: 132, textAlign: 'right' }}>Days to renewal</th>
              <th style={{ ...th, width: 96, textAlign: 'right', paddingRight: 16 }}>ARR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} style={{ ...td, padding: '28px 16px', color: 'var(--muted)', fontSize: 14 }}>
                  {filter === 'risk'
                    ? `No paid school is at risk on ${fmtDay(asOf)}.`
                    : `No paid school has a health score on ${fmtDay(asOf)}: none has a renewal still ahead and a full scoring window.`}
                  {filter === 'risk' && ranked.length > 0 && (
                    <button onClick={() => setPicked('all')}
                      style={{ marginLeft: 8, border: 'none', background: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                      Show all paid schools
                    </button>
                  )}
                </td>
              </tr>
            )}
            {rows.map((school, i) => {
              const risky = school.status === 'At risk';
              const isSel = school.school_id === schoolId;
              const restBg = isSel ? 'var(--nav)' : 'transparent';
              return (
                <Fragment key={school.school_id}>
                  {i === lineAt && (
                    <tr data-testid="risk-threshold">
                      <td colSpan={cols} style={{ padding: '6px 16px', background: 'var(--paper)', borderTop: '1px solid var(--row-divider)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--risk)' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            Health threshold · <span style={{ fontFamily: MONO }}>{meta.thresholds.health_at_risk_below}</span>
                            <span style={{ color: 'var(--muted)' }}> · At risk above this line, Healthy below</span>
                          </span>
                          <span style={{ flex: 1, borderTop: '1px dashed var(--risk)' }} />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    data-school={school.school_id}
                    data-status={school.status}
                    tabIndex={0}
                    onClick={() => onSelectSchool(school.school_id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSchool(school.school_id); } }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                    onMouseLeave={e => (e.currentTarget.style.background = restBg)}
                    style={{ borderTop: i === 0 || i === lineAt ? 'none' : '1px solid var(--row-divider)', cursor: 'pointer', background: restBg }}
                  >
                    <td style={{ ...td, paddingLeft: 16, boxShadow: risky ? 'inset 3px 0 0 var(--risk)' : 'none' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{place(school)}</div>
                      <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 4 }}>
                        {school.contact_name}<span style={{ color: 'var(--muted)' }}> · {school.contact_title}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <ScoreChip score={school.health_score} type="health" status={school.status} />
                    </td>
                    <td style={{ ...td, paddingTop: 13 }}>
                      <ReasonList reasons={topReasons(school)} />
                    </td>
                    <td data-testid="days-to-renewal" style={{ ...num, paddingTop: 13 }}>
                      <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{plural(school.days_to_renewal, 'day')}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, fontFamily: 'Inter' }}>renews {fmtDay(school.renewal_date)}</div>
                    </td>
                    <td style={{ ...num, paddingRight: 16, color: 'var(--ink)' }}>{usd(school.arr)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <AccountDetail type="health" school={selected} onClose={() => onSelectSchool(null)} />}
    </>
  );
}
