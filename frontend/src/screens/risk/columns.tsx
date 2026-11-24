// At risk table columns on the base Table (2A). Status is the pill word plus the meter; no
// colored left-border bars. The threshold tick comes from /meta, never from here.
import type { HealthScore, ReasonDetail } from '../../types';
import { NumberFlow, ScoreMeter, StatusPill, TruncatedText, statusTone, type Column } from '../../design';
import { fmtDay } from '../../nav';

export function place(s: HealthScore) {
  const kind = s.type === 'district' ? 'District' : 'Independent';
  return [kind, s.district, `${s.city}, ${s.state}`].filter(Boolean).join(' · ');
}

/** The API's top reasons (in its order), each with the points it earned out of the most possible. */
export function topReasons(s: { reasons: string[]; reason_details: ReasonDetail[] }, n = 2): ReasonDetail[] {
  return s.reasons.slice(0, n).map(text =>
    s.reason_details.find(d => d.text === text) ?? { text, points: Number.NaN, max_points: Number.NaN });
}

const fmtPts = (r: ReasonDetail) => {
  if (!Number.isFinite(r.points)) return '';
  const p = Number.isInteger(r.points) ? String(r.points) : r.points.toFixed(1);
  return r.max_points > 0 ? `${p}/${r.max_points}` : p.replace('-', '−');
};

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function riskColumns(threshold: number): Column<HealthScore>[] {
  return [
    {
      id: 'school', header: 'School', width: '22%', sortValue: s => s.name.toLowerCase(), skeleton: '75%', skeletonLines: 2,
      cell: s => (
        <div className="rk-stack">
          <TruncatedText className="rk-name">{s.name}</TruncatedText>
          <TruncatedText className="rk-sub">{place(s)}</TruncatedText>
        </div>
      ),
    },
    {
      id: 'health', header: 'Health', width: '13%', sortValue: s => s.health_score, firstDirection: 'asc', skeleton: '85%', skeletonLines: 2,
      cell: s => (
        <div className="rk-health">
          <ScoreMeter value={s.health_score} threshold={threshold} tone={statusTone(s.status)} thresholdLabel={`At risk below ${threshold}`} />
          <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>
        </div>
      ),
    },
    {
      id: 'renews', header: 'Renews', numeric: true, width: '10%', sortValue: s => s.days_to_renewal, firstDirection: 'asc', skeleton: '60%', skeletonLines: 2,
      cell: s => (
        <div className="rk-stack" data-testid="days-to-renewal">
          <span className="rk-strong"><NumberFlow value={s.days_to_renewal} reveal={false} /> {s.days_to_renewal === 1 ? 'day' : 'days'}</span>
          <span className="rk-sub">{fmtDay(s.renewal_date)}</span>
        </div>
      ),
    },
    {
      id: 'arr', header: 'ARR', numeric: true, width: '9%', sortValue: s => s.arr, firstDirection: 'desc', skeleton: '60%', skeletonLines: 2,
      cell: s => (
        <div className="rk-stack">
          <span className="rk-strong"><NumberFlow value={s.arr} reveal={false} format={usd} /></span>
          <span className="rk-sub">{s.seats.toLocaleString('en-US')} {s.seats === 1 ? 'seat' : 'seats'}</span>
        </div>
      ),
    },
    {
      id: 'why', header: 'Why', skeleton: '90%', skeletonLines: 2,
      cell: s => {
        const reasons = topReasons(s);
        if (!reasons.length) return <span className="rk-sub">No scoring signals in this window</span>;
        return (
          <ul className="rk-why">
            {reasons.map(r => (
              <li key={r.text}>
                <span className="rk-pts k-num">{fmtPts(r)}</span>
                <TruncatedText className="rk-why__text">{r.text}</TruncatedText>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      id: 'contact', header: 'Contact', width: '14%', skeleton: '70%', skeletonLines: 2,
      cell: s => (
        <div className="rk-stack">
          <TruncatedText>{s.contact_name}</TruncatedText>
          <TruncatedText className="rk-sub">{s.contact_title}</TruncatedText>
        </div>
      ),
    },
  ];
}
