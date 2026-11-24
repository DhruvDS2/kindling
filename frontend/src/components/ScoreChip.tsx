import type { ReasonDetail } from '../types';

interface Props {
  score: number;
  type: 'pql' | 'health';
  status?: string;
}

const MONO = 'JetBrains Mono, monospace';

/** Chip colors by status word. Color never carries meaning alone: the word is always printed. */
function chipColors(type: 'pql' | 'health', status?: string): { bg: string; fg: string } {
  if (type === 'pql') {
    return status === 'Ready'
      ? { bg: 'var(--ember-chip-bg)', fg: 'var(--ember-chip-text)' }
      : { bg: 'var(--nav)', fg: 'var(--muted)' };
  }
  if (status === 'At risk') return { bg: 'var(--risk-chip-bg)', fg: 'var(--risk)' };
  if (status === 'Healthy') return { bg: 'color-mix(in srgb, var(--steady) 11%, var(--card))', fg: 'var(--steady)' };
  return { bg: 'var(--nav)', fg: 'var(--muted)' };
}

/** `84 · Ready`, `38 · At risk`, `91 · Healthy`. The status word comes from the API; with no status, only the score. */
export default function ScoreChip({ score, type, status }: Props) {
  const { bg, fg } = chipColors(type, status);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: 6,
      background: bg,
      color: fg,
      fontSize: 13,
      fontFamily: MONO,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {status ? `${score} · ${status}` : score}
    </span>
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
 * The reason list from DESIGN.md: the school's top reasons, each with the points it earned
 * out of the most it could earn. A penalty (no maximum) shows as a negative number.
 */
export function ReasonList({ reasons, empty = 'No scoring signals in this window', wrap = true }: {
  reasons: ReasonDetail[];
  empty?: string;
  wrap?: boolean;
}) {
  if (reasons.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--muted)' }}>{empty}</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {reasons.map(r => {
        const known = Number.isFinite(r.points);
        const penalty = known && r.max_points <= 0;
        return (
          <div key={r.text} style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span
              title={known ? (penalty ? `${fmtPoints(r.points)} points (penalty)` : `${fmtPoints(r.points)} of ${r.max_points} points`) : undefined}
              style={{ fontFamily: MONO, fontSize: 12, width: 52, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}
            >
              {known ? (
                <>
                  <span style={{ color: penalty ? 'var(--risk)' : 'var(--ink)', fontWeight: 500 }}>{fmtPoints(r.points)}</span>
                  {!penalty && <span style={{ color: 'var(--muted)' }}>/{r.max_points}</span>}
                </>
              ) : null}
            </span>
            <span style={{
              fontSize: 13,
              color: 'var(--body)',
              lineHeight: 1.4,
              minWidth: 0,
              ...(wrap ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
            }}>
              {r.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
