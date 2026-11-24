// The drawer's decision line (score, status, the line that matters, renewal or signup facts)
// and its 4A properties. Everything is read from the list row the drawer was opened from
// until /schools/{id} arrives, then from the detail. Thresholds come from /meta.
import type { ReactNode } from 'react';
import type { HealthScore, Lifecycle, Meta, PqlScore, SchoolDetail } from '../../types';
import { NumberFlow, PropertyList, ScoreMeter, StatusPill, statusTone, type Property } from '../../design';
import { dayNum, long, plural } from './model';

export type ListRow = PqlScore | HealthScore;
export const isHealth = (s: ListRow): s is HealthScore => 'health_score' in s;
export const scoreOf = (s: ListRow) => (isHealth(s) ? s.health_score : s.pql_score);

/** The word on the pill when there is no live score. */
const LIFECYCLE_WORD: Record<Lifecycle, string> = {
  free: 'Not scored',
  converted: 'Converted',
  no_signup: 'No signup yet',
  paid: 'Not scored',
  not_started: 'Not scored yet',
  renewed: 'Renewed',
  churned: 'Churned',
  expanded: 'Expanded',
};

/** One sentence for a school that has no live score at this date. */
export function lifecycleNote(d: SchoolDetail, meta: Meta): string | null {
  switch (d.lifecycle) {
    case 'converted': return `Converted to paid${d.converted_on ? ` on ${long(d.converted_on)}` : ''}. Readiness scoring stops at conversion; the history below runs up to it.`;
    case 'no_signup': return 'No teacher has signed up yet, so there is nothing to score.';
    case 'not_started': return `Health scoring starts after ${plural(meta.thresholds.health_min_school_days, 'school day')} of the school year. This school has had ${plural(d.school_days_elapsed, 'school day')} so far.`;
    case 'renewed': case 'churned': case 'expanded':
      return `${LIFECYCLE_WORD[d.lifecycle]} at renewal${d.renewal_date ? ` on ${long(d.renewal_date)}` : ''}. Health stops scoring at the renewal date; the history below runs up to it.`;
    default: return d.score ? null : 'Not scored at this date.';
  }
}

interface Props {
  kind: 'pql' | 'health';
  row: ListRow;                       // the list row the drawer was opened from
  detail: SchoolDetail | undefined;
  meta: Meta;
  asOf: string;
}

function liveScore(row: ListRow, detail: SchoolDetail | undefined): ListRow | null {
  return detail ? detail.score : row;
}

function renewal(row: ListRow, detail: SchoolDetail | undefined, asOf: string) {
  const live = liveScore(row, detail);
  const date = detail?.renewal_date ?? (isHealth(row) ? row.renewal_date : null);
  const days = live && isHealth(live) ? live.days_to_renewal : date ? dayNum(date) - dayNum(asOf) : null;
  return { date, days };
}

/** Under the name: meter + status word + the line that matters, then one line of context. */
export function HeaderMeta({ kind, row, detail, meta, asOf }: Props) {
  const live = liveScore(row, detail);
  const t = meta.thresholds;
  const admin = live && !isHealth(live) && live.ready_rule === 'admin';
  const threshold = kind === 'pql' ? (admin ? t.pql_admin_ready : t.pql_ready) : t.health_at_risk_below;
  const rule = kind === 'pql'
    ? admin ? `Ready by the admin rule: ${t.pql_admin_ready}+ with an admin signed up` : `Ready at ${t.pql_ready}+`
    : `At risk below ${t.health_at_risk_below}`;

  let context: ReactNode = null;
  const note = detail ? lifecycleNote(detail, meta) : null;
  if (note) {
    context = note;
  } else if (kind === 'health') {
    const { date, days } = renewal(row, detail, asOf);
    if (date && days !== null) {
      context = days >= 0
        ? <>Renews in <NumberFlow value={days} reveal={false} className="kd-meta__num" /> {days === 1 ? 'day' : 'days'} · {long(date)}</>
        : <>Renewal was {plural(-days, 'day')} ago · {long(date)}</>;
    }
  } else {
    const pqlRow = live && !isHealth(live) ? live : !isHealth(row) ? row : null;
    const parts: string[] = [];
    if (pqlRow) parts.push(pqlRow.admin_signed_up_on ? `Admin signed up ${long(pqlRow.admin_signed_up_on)}` : 'No admin signed up yet');
    if (detail?.first_signup) parts.push(`First teacher signed up ${long(detail.first_signup)}`);
    context = parts.join(' · ') || null;
  }

  return (
    <>
      {live ? (
        <>
          <ScoreMeter value={scoreOf(live)} threshold={threshold} tone={statusTone(live.status)} thresholdLabel={rule} />
          <StatusPill tone={statusTone(live.status)}>{live.status}</StatusPill>
          <span className="kd-meta__rule">{rule}</span>
        </>
      ) : detail ? (
        <StatusPill tone="neutral">{LIFECYCLE_WORD[detail.lifecycle]}</StatusPill>
      ) : null}
      {context && <span className="kd-meta__line" data-testid="detail-context">{context}</span>}
    </>
  );
}

function place(p: ListRow | SchoolDetail, detail?: SchoolDetail) {
  const kind = p.type === 'district' ? 'District' : 'Independent';
  return [kind, p.district, `${p.city}, ${p.state}`, detail?.region].filter(Boolean).join(' · ');
}

/** 4A: the facts as label/value rows. */
export function Facts({ kind, row, detail, asOf }: Props) {
  const p = detail ?? row;
  const live = liveScore(row, detail);
  const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
  const calendar = detail
    ? `${detail.calendar_id} · ${plural(detail.school_days_elapsed, 'school day')} so far`
    : row.calendar_id;
  const contact = `${p.contact_name} · ${p.contact_title}`;

  const items: Property[] = [];
  if (kind === 'health') {
    const { date, days } = renewal(row, detail, asOf);
    const outcome = detail?.renewal_outcome;
    items.push({
      label: 'Renews',
      value: !date ? null
        : outcome ? `${LIFECYCLE_WORD[outcome]} on ${long(date)}`
        : days !== null && days >= 0 ? `${long(date)} · in ${plural(days, 'day')}` : long(date),
    });
    const arr = detail?.arr ?? (isHealth(row) ? row.arr : null);
    items.push({ label: 'ARR · seats', value: arr !== null ? `${usd(arr)} · ${plural(p.seats, 'seat')}` : null });
  } else {
    items.push({
      label: 'Plan',
      value: detail?.converted_on ? `Converted to paid on ${long(detail.converted_on)}` : 'Free',
    });
    const pqlRow = live && !isHealth(live) ? live : null;
    items.push({
      label: 'Active teachers',
      value: pqlRow ? `${pqlRow.active_teachers} · ${pqlRow.active_teachers_prev} in the prior window` : null,
    });
    items.push({ label: 'Students', value: detail ? detail.students.toLocaleString('en-US') : null });
  }
  items.push({ label: 'Type · location', value: place(p, detail) });
  items.push({ label: 'Calendar · school days', value: calendar });
  items.push({ label: 'Contact', value: contact });
  items.push({ label: 'Email', value: p.contact_email });
  return <PropertyList items={items} className="kd-facts" />;
}
