import { Fragment, useState, type CSSProperties } from 'react';
import { useAsOf, usePql } from '../asOf';
import { fmtDay } from '../nav';
import type { PqlScore } from '../types';
import ScoreChip, { ReasonList, topReasons } from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';
import AccountDetail from '../components/AccountDetail';

interface Props {
  schoolId: string | null;                      // the open drawer (?school=…)
  onSelectSchool: (schoolId: string | null) => void;
}

type Filter = 'all' | 'ready';

const MONO = 'JetBrains Mono, monospace';
const th: CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--muted)',
  fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)',
};
const td: CSSProperties = { padding: '12px 16px', verticalAlign: 'top' };

function place(s: PqlScore) {
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

export default function ReadyToBuy({ schoolId, onSelectSchool }: Props) {
  const { asOf, meta } = useAsOf();
  const { data, isLoading, error } = usePql();
  const [filter, setFilter] = useState<Filter>('all');

  if (error) return <div style={{ color: 'var(--muted)' }}>Couldn't load PQL scores: {(error as Error).message}</div>;
  if (isLoading || !data) return <SkeletonCard rows={8} />;

  const threshold = meta.thresholds.pql_ready;
  const ranked = [...data].sort((a, b) => b.pql_score - a.pql_score);
  const rank = new Map(ranked.map((s, i) => [s.school_id, i + 1]));
  const ready = ranked.filter(s => s.status === 'Ready');
  const rows = filter === 'ready' ? ready : ranked;
  const anyAdminRule = ranked.some(s => s.ready_rule === 'admin');
  // The Ready line sits above the first school scoring under the threshold.
  const lineAt = filter === 'all' ? rows.findIndex(s => s.pql_score < threshold) : -1;
  const selected = schoolId ? data.find(s => s.school_id === schoolId) ?? null : null;

  return (
    <>
      {schoolId && !selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 14px', fontSize: 13,
                      color: 'var(--body)', background: 'var(--nav)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <span><span style={{ fontFamily: MONO }}>{schoolId}</span> isn't a free school with a PQL score on {fmtDay(asOf)}.</span>
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
            <div data-testid="ready-summary" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--ember-chip-text)' }}>{ready.length}</span> Ready
              <span style={{ color: 'var(--muted)' }}> of </span>
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>{ranked.length}</span> free schools, ranked by PQL score
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              Ready = PQL score <span style={{ fontFamily: MONO }}>{threshold}</span> or higher ·
              each school scored on its own last <span style={{ fontFamily: MONO }}>{meta.windows.school_days}</span> school days
              {anyAdminRule && <> · admin rule on: an admin signup makes a school Ready at <span style={{ fontFamily: MONO }}>{meta.thresholds.pql_admin_ready}</span></>}
            </div>
          </div>
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All free schools', count: ranked.length },
              { id: 'ready', label: 'Ready', count: ready.length },
            ]}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 44, textAlign: 'right' }}>#</th>
              <th style={{ ...th, width: 270 }}>School</th>
              <th style={{ ...th, width: 140 }}>PQL</th>
              <th style={th}>Top reasons <span style={{ fontWeight: 400 }}>· points earned / max</span></th>
              <th style={{ ...th, width: 190 }}>Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...td, padding: '28px 16px', color: 'var(--muted)', fontSize: 14 }}>
                  No school is Ready on {fmtDay(asOf)}.
                </td>
              </tr>
            )}
            {rows.map((school, i) => {
              const isSel = school.school_id === schoolId;
              const restBg = isSel ? 'var(--nav)' : 'transparent';
              return (
                <Fragment key={school.school_id}>
                  {i === lineAt && (
                    <tr data-testid="ready-threshold">
                      <td colSpan={5} style={{ padding: '6px 16px', background: 'var(--paper)', borderTop: '1px solid var(--row-divider)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ember-chip-text)' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            Ready threshold · PQL <span style={{ fontFamily: MONO }}>{threshold}</span>
                            <span style={{ color: 'var(--muted)' }}>{i === 0 ? ' · no school is at or above it' : ' · schools below are Not yet'}</span>
                          </span>
                          <span style={{ flex: 1, borderTop: '1px dashed var(--ember)' }} />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    data-school={school.school_id}
                    tabIndex={0}
                    onClick={() => onSelectSchool(school.school_id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSchool(school.school_id); } }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                    onMouseLeave={e => (e.currentTarget.style.background = restBg)}
                    style={{ borderTop: i === 0 || i === lineAt ? 'none' : '1px solid var(--row-divider)', cursor: 'pointer', background: restBg }}
                  >
                    <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12, color: 'var(--muted)', paddingTop: 15 }}>
                      {rank.get(school.school_id)}
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{place(school)}</div>
                    </td>
                    <td style={td}>
                      <ScoreChip score={school.pql_score} type="pql" status={school.status} />
                      {school.ready_rule === 'admin' && (
                        <div title={`An admin signed up and the PQL score is ${meta.thresholds.pql_admin_ready} or higher`}
                          style={{ fontSize: 11, color: 'var(--ember-chip-text)', marginTop: 5 }}>
                          Ready by admin rule
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, paddingTop: 13 }}>
                      <ReasonList reasons={topReasons(school)} />
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{school.contact_title}</div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <AccountDetail type="pql" school={selected} onClose={() => onSelectSchool(null)} />}
    </>
  );
}
