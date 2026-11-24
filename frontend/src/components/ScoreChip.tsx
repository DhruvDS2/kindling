import { StatusPill, statusTone } from '../design';
import type { ReasonDetail } from '../types';

interface Props {
  score: number;
  /** Kept for callers; the tone comes from the status word. */
  type: 'pql' | 'health';
  status?: string;
}

/**
 * `84 · Ready`, `38 · At risk`, `91 · Healthy` on the status color (DESIGN.md §5: Ready is ochre,
 * never ember). The status word comes from the API and is always printed; with no status, only the score.
 * New screens use ScoreMeter instead; this stays for the screens that haven't moved yet.
 */
export default function ScoreChip({ score, status }: Props) {
  return (
    <StatusPill tone={statusTone(status)}>
      <span className="k-num">{score}</span>{status ? ` · ${status}` : ''}
    </StatusPill>
  );
}

/** Points as the scorer reported them: whole numbers stay whole, fractions keep one decimal. */
export function fmtPoints(p: number): string {
  const s = Number.isInteger(p) ? String(p) : p.toFixed(1);
  return p < 0 ? `−${s.slice(1)}` : s;
}

/** The API's top reasons (`reasons`) matched to their points in `reason_details`, in the API's order. */
export function topReasons(school: { reasons: string[]; reason_details: ReasonDetail[] }): ReasonDetail[] {
  return school.reasons.map(text =>
    school.reason_details.find(d => d.text === text) ?? { text, points: Number.NaN, max_points: Number.NaN });
}

/**
 * The school's top reasons, each with the points it earned out of the most it could earn.
 * A penalty (no maximum) shows as a negative number.
 */
export function ReasonList({ reasons, empty = 'No scoring signals in this window', wrap = true }: {
  reasons: ReasonDetail[];
  empty?: string;
  wrap?: boolean;
}) {
  if (reasons.length === 0) {
    return <span className="k-text-sm k-tertiary">{empty}</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-0-5)' }}>
      {reasons.map(r => {
        const known = Number.isFinite(r.points);
        const penalty = known && r.max_points <= 0;
        return (
          <div key={r.text} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1-5)', minWidth: 0 }}>
            <span
              className="k-num k-text-label"
              title={known ? (penalty ? `${fmtPoints(r.points)} points (penalty)` : `${fmtPoints(r.points)} of ${r.max_points} points`) : undefined}
              style={{ width: 'var(--space-6)', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}
            >
              {known ? (
                <>
                  <span className="k-primary k-medium">{fmtPoints(r.points)}</span>
                  {!penalty && <span className="k-tertiary">/{r.max_points}</span>}
                </>
              ) : null}
            </span>
            <span className={['k-text-sm', 'k-secondary', wrap ? '' : 'k-truncate'].join(' ').trim()}>
              {r.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
