// Why the school scores what it does (reason_details with points), and dated signals
// taken from the weekly history. Every date here is a real Monday from /schools/{id}/history.
import type { HistoryPoint, ReasonDetail } from '../../types';
import { flagFor, long, plural, reasonSince, runStart, short } from './model';
import { MONO } from './scale';
import { Note } from './ui';

const fmtPts = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1));

export function Reasons({ kind, details, history }: { kind: 'pql' | 'health'; details: ReasonDetail[]; history: HistoryPoint[] | undefined }) {
  if (!details.length) return <Note>No reasons at this date: nothing earned points yet.</Note>;
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
      {details.map((r, i) => {
        const penalty = r.max_points === 0 && r.points < 0;
        const frac = r.max_points > 0 ? Math.max(0, Math.min(1, r.points / r.max_points)) : 0;
                // PQL: points earned toward Ready. Health: points kept (steady) vs points lost (risk tint).
        const fill = kind === 'pql' ? 'var(--ember)' : 'var(--steady)';
        const track = kind === 'pql' ? 'var(--row-divider)' : 'var(--risk-chip-bg)';
        const since = i < 3 && history ? reasonSince(r.text, history) : null;
        return (
          <li key={r.text} style={{
            display: 'grid', gridTemplateColumns: '1fr auto 88px 64px', alignItems: 'center', gap: 12,
            padding: '7px 0', borderBottom: '1px solid var(--row-divider)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.4 }}>{r.text}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}
              title={since ? `In the top reasons every week since ${long(since.as_of)}` : undefined}>
              {since ? `since ${short(since.as_of)}` : ''}
            </span>
            {penalty ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>penalty</span> : (
              <span aria-hidden style={{ height: 6, borderRadius: 3, background: track, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${frac * 100}%`, background: fill, borderRadius: 3 }} />
              </span>
            )}
            <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}
              aria-label={penalty ? `${fmtPts(r.points)} points` : `${fmtPts(r.points)} of ${r.max_points} points`}>
              {penalty ? fmtPts(r.points).replace('-', '−') : <>{fmtPts(r.points)}<span style={{ color: 'var(--muted)' }}> / {r.max_points}</span></>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface Signal { date: string; text: string }

function signals(kind: 'pql' | 'health', threshold: number, k: HistoryPoint[], n: HistoryPoint[]): Signal[] {
  const out: Signal[] = [];
  if (!k.length) return out;
  const flag = flagFor(kind);
  const now = k[k.length - 1];

  const run = runStart(k, p => p.status === flag);
  if (run) {
    const crossed = kind === 'pql' ? `Crossed ${threshold}: Ready` : `Fell below ${threshold}: At risk`;
    out.push({
      date: run.first.as_of,
      text: run.before
        ? `${crossed} (${run.before.score} → ${run.first.score}). ${plural(run.weeks, 'week')} running.`
        : `${flag} from its first weekly score (${run.first.score}).`,
    });
  } else {
    const lastFlag = [...k].reverse().find(p => p.status === flag);
    out.push(lastFlag
      ? { date: lastFlag.as_of, text: `Last ${flag} week (score ${lastFlag.score}). ${now.status} since.` }
      : { date: k[0].as_of, text: `First weekly score (${k[0].score}). Not ${flag} in any of ${plural(k.length, 'weekly score')} since.` });
  }

  const peak = k.reduce((a, b) => (b.score > a.score ? b : a), k[0]);
  if (peak.score !== now.score && peak.as_of !== run?.first.as_of) {
    out.push({ date: peak.as_of, text: `Highest ${kind === 'pql' ? 'PQL' : 'health'} score so far: ${peak.score}.` });
  }

  // where the naive calendar-day model disagrees with school-day windows, Monday by Monday
  const naiveBy = new Map(n.map(p => [p.as_of, p]));
  const both = k.filter(p => naiveBy.has(p.as_of));
  const extra = both.filter(p => p.status !== flag && naiveBy.get(p.as_of)!.status === flag);
  const missed = both.filter(p => p.status === flag && naiveBy.get(p.as_of)!.status !== flag);
  const list = (ps: HistoryPoint[]) => ps.slice(0, 4).map(p => short(p.as_of)).join(', ') + (ps.length > 4 ? ` and ${ps.length - 4} more` : '');
  if (extra.length) {
    out.push({ date: extra[0].as_of, text: `Only calendar-day windows called it ${flag} on ${plural(extra.length, 'Monday')}: ${list(extra)}. School-day windows didn’t.` });
  }
  if (missed.length) {
    out.push({ date: missed[0].as_of, text: `Only school-day windows called it ${flag} on ${plural(missed.length, 'Monday')}: ${list(missed)}. Calendar-day windows didn’t.` });
  }
  if (!extra.length && !missed.length && both.length) {
    out.push({ date: both[0].as_of, text: `Calendar-day and school-day windows agreed on the status every Monday (${plural(both.length, 'week')}).` });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function Signals({ kind, threshold, kindling, naive }: { kind: 'pql' | 'health'; threshold: number; kindling: HistoryPoint[]; naive: HistoryPoint[] }) {
  const items = signals(kind, threshold, kindling, naive);
  if (!items.length) return <Note>No weekly scores yet at this date, so there are no dated signals.</Note>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(s => (
        <li key={s.date + s.text} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, alignItems: 'baseline' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{long(s.date)}</span>
          <span style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.45 }}>{s.text}</span>
        </li>
      ))}
    </ul>
  );
}
