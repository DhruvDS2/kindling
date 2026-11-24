// Drawer header: who the school is, where its score stands, and its commercial facts.
import type { ReactNode } from 'react';
import type { HealthScore, Lifecycle, Meta, PqlScore, SchoolDetail } from '../../types';
import { dayNum, long, plural } from './model';
import { MONO } from './scale';
import { Note } from './ui';

type ListRow = PqlScore | HealthScore;
const isHealth = (s: ListRow): s is HealthScore => 'health_score' in s;

const LIFECYCLE: Record<Lifecycle, string> = {
  free: 'Free plan',
  converted: 'Converted to paid',
  no_signup: 'No signup yet',
  paid: 'Paying',
  not_started: 'Paying · not scored yet',
  renewed: 'Renewed',
  churned: 'Churned',
  expanded: 'Expanded',
};

const CHIP: Record<string, { bg: string; fg: string }> = {
  Ready: { bg: 'var(--ember-chip-bg)', fg: 'var(--ember-chip-text)' },
  'Not yet': { bg: 'var(--nav)', fg: 'var(--muted)' },
  'At risk': { bg: 'var(--risk-chip-bg)', fg: 'var(--risk)' },
  Healthy: { bg: 'color-mix(in srgb, var(--steady) 12%, var(--card))', fg: 'var(--steady)' },
};

export function StatusChip({ score, status, kind }: { score: number | null; status: string; kind: 'pql' | 'health' }) {
  const c = CHIP[status] ?? CHIP['Not yet'];
  return (
    <span data-testid="detail-score" style={{
      display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6, background: c.bg, color: c.fg,
      fontSize: 13, fontFamily: MONO, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {kind === 'pql' ? 'PQL' : 'Health'} {score !== null ? `${score} · ` : ''}{status}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</div>
    </div>
  );
}

function unscoredNote(d: SchoolDetail, meta: Meta): string | null {
  switch (d.lifecycle) {
    case 'converted': return `Converted to paid${d.converted_on ? ` on ${long(d.converted_on)}` : ''}. PQL scoring stops at conversion; the history below runs up to it.`;
    case 'no_signup': return 'No teacher has signed up yet, so there is nothing to score.';
    case 'not_started': return `Health scoring starts once the school year has ${plural(meta.thresholds.health_min_school_days, 'school day')}. This school has had ${plural(d.school_days_elapsed, 'school day')} so far.`;
    case 'renewed': case 'churned': case 'expanded':
      return `${LIFECYCLE[d.lifecycle]} at renewal${d.renewal_date ? ` (${long(d.renewal_date)})` : ''}. Health stops scoring at the renewal date; the history below runs up to it.`;
    default: return d.score ? null : 'Not scored at this date.';
  }
}

interface Props {
  type: 'pql' | 'health';
  row: ListRow;                       // the list row the drawer was opened from: shown until the detail loads
  detail: SchoolDetail | undefined;
  meta: Meta;
  asOf: string;
  onClose: () => void;
}

export default function Header({ type, row, detail, meta, asOf, onClose }: Props) {
  const p = detail ?? row;
  const kind = detail?.score_kind ?? type;
  const live = detail ? detail.score : row;
  const score = live ? (isHealth(live) ? live.health_score : live.pql_score) : null;
  const health = live && isHealth(live) ? live : null;
  const pqlRow = live && !isHealth(live) ? live : null;
  const note = detail ? unscoredNote(detail, meta) : null;

  const renewal = detail?.renewal_date ?? health?.renewal_date ?? null;
  const daysToRenewal = health ? health.days_to_renewal : renewal ? dayNum(renewal) - dayNum(asOf) : null;
  const arr = detail?.arr ?? health?.arr ?? null;

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            {p.type === 'district' ? `District school${p.district ? ` · ${p.district}` : ''}` : 'Independent school'}
            {' · '}{p.city}, {p.state}{detail ? ` · ${detail.region}` : ''}
          </div>
          <h2 id="detail-title" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{p.name}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer',
          width: 32, height: 32, fontSize: 18, lineHeight: 1, color: 'var(--muted)', flexShrink: 0,
        }}>×</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {live && <StatusChip score={score} status={live.status} kind={kind} />}
        {detail && (
          <span data-testid="detail-lifecycle" style={{ fontSize: 12, color: 'var(--body)', padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6 }}>
            {LIFECYCLE[detail.lifecycle]}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {kind === 'pql'
            ? pqlRow?.ready_rule === 'admin'
              ? `Ready by the admin rule (score ${meta.thresholds.pql_admin_ready}+ with an admin signed up)`
              : `Ready at ${meta.thresholds.pql_ready}+`
            : `At risk below ${meta.thresholds.health_at_risk_below}`}
        </span>
      </div>

      {note && <Note style={{ color: 'var(--body)', fontSize: 13 }}>{note}</Note>}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px 16px',
        padding: '12px 0', borderTop: '1px solid var(--row-divider)', borderBottom: '1px solid var(--row-divider)',
      }}>
        {kind === 'health' ? (
          <>
            <Fact label="Renews">{renewal ? long(renewal) : '—'}</Fact>
            <Fact label={daysToRenewal !== null && daysToRenewal < 0 ? 'Renewal was' : 'Days to renewal'}>
              {daysToRenewal === null ? '—' : daysToRenewal < 0 ? `${plural(-daysToRenewal, 'day')} ago` : plural(daysToRenewal, 'day')}
            </Fact>
            <Fact label="ARR">{arr !== null ? `$${arr.toLocaleString('en-US')}` : '—'}</Fact>
            <Fact label="Seats">{p.seats.toLocaleString('en-US')}</Fact>
          </>
        ) : (
          <>
            <Fact label="Admin signed up">{pqlRow ? (pqlRow.admin_signed_up_on ? long(pqlRow.admin_signed_up_on) : 'Not yet') : '—'}</Fact>
            <Fact label="First teacher signup">{detail?.first_signup ? long(detail.first_signup) : detail ? 'None yet' : '—'}</Fact>
            <Fact label={detail?.converted_on ? 'Converted' : 'Active teachers'}>
              {detail?.converted_on ? long(detail.converted_on) : pqlRow ? `${pqlRow.active_teachers} (prior ${pqlRow.active_teachers_prev})` : '—'}
            </Fact>
            <Fact label="Students">{detail ? detail.students.toLocaleString('en-US') : '—'}</Fact>
          </>
        )}
        <Fact label="Calendar">{p.calendar_id}</Fact>
        <Fact label="School days so far">{detail ? detail.school_days_elapsed : '—'}</Fact>
        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Contact</div>
          <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={`${p.contact_name}, ${p.contact_title} · ${p.contact_email}`}>
            {p.contact_name} <span style={{ color: 'var(--muted)' }}>· {p.contact_title}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
