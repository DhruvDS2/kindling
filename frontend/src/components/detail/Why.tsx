// Why the school scores what it does (reason_details with points earned out of the most
// possible), and dated signals taken from the weekly history. Every date is a real Monday
// from /schools/{id}/history; nothing is typed in.
import type { CSSProperties } from 'react';
import type { HistoryPoint, ReasonDetail } from '../../types';
import { flagFor, long, plural, reasonSince, runStart, short } from './model';
import { Note } from './ui';

const fmtPts = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1));

/** A readable list, no chips: the reason, since when it has been a top reason, and its points. */
export function Reasons({ details, history }: { details: ReasonDetail[]; history: HistoryPoint[] | undefined }) {
  if (!details.length) return <Note>No reasons at this date: nothing has earned points yet.</Note>;
  return (
    <ol className="kd-reasons" data-testid="detail-reasons-list">
      {details.map((r, i) => {
        const penalty = r.max_points === 0 && r.points < 0;
        const frac = r.max_points > 0 ? Math.max(0, Math.min(1, r.points / r.max_points)) : 0;
        const since = i < 3 && history ? reasonSince(r.text, history) : null;
        return (
          <li key={r.text} className="kd-reason">
            <span className="kd-reason__text">{r.text}</span>
            <span className="kd-reason__since k-num" title={since ? `A top reason every week since ${long(since.as_of)}` : undefined}>
              {since ? `since ${short(since.as_of)}` : ''}
            </span>
            {penalty
              ? <span className="kd-reason__since">penalty</span>
              : (
                <span aria-hidden="true" className="kd-reason__track" style={{ '--kd-frac': frac } as CSSProperties}>
                  <span className="kd-reason__fill" />
                </span>
              )}
            <span className="kd-reason__pts k-num" aria-label={penalty ? `${fmtPts(r.points)} points` : `${fmtPts(r.points)} of ${r.max_points} points`}>
              {penalty ? fmtPts(r.points).replace('-', '−') : <>{fmtPts(r.points)}<span className="kd-reason__max"> / {r.max_points}</span></>}
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
    out.push({ date: peak.as_of, text: `Highest ${kind === 'pql' ? 'readiness' : 'health'} score so far: ${peak.score}.` });
  }

  // where the naive calendar-day model disagrees with school-day windows, Monday by Monday
  const naiveBy = new Map(n.map(p => [p.as_of, p]));
  const both = k.filter(p => naiveBy.has(p.as_of));
  const extra = both.filter(p => p.status !== flag && naiveBy.get(p.as_of)!.status === flag);
  const missed = both.filter(p => p.status === flag && naiveBy.get(p.as_of)!.status !== flag);
  const list = (ps: HistoryPoint[]) => ps.slice(0, 4).map(p => short(p.as_of)).join(', ') + (ps.length > 4 ? ` and ${ps.length - 4} more` : '');
  if (extra.length) {
    out.push({ date: extra[0].as_of, text: `Only calendar days called it ${flag} on ${plural(extra.length, 'Monday')}: ${list(extra)}. School days didn’t.` });
  }
  if (missed.length) {
    out.push({ date: missed[0].as_of, text: `Only school days called it ${flag} on ${plural(missed.length, 'Monday')}: ${list(missed)}. Calendar days didn’t.` });
  }
  if (!extra.length && !missed.length && both.length) {
    out.push({ date: both[0].as_of, text: `Calendar days and school days agreed on the status every Monday (${plural(both.length, 'week')}).` });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function Signals({ kind, threshold, kindling, naive }: { kind: 'pql' | 'health'; threshold: number; kindling: HistoryPoint[]; naive: HistoryPoint[] }) {
  const items = signals(kind, threshold, kindling, naive);
  if (!items.length) return <Note>No weekly scores yet at this date, so there are no dated signals.</Note>;
  return (
    <ul className="kd-signals" data-testid="detail-signals">
      {items.map(s => (
        <li key={s.date + s.text} className="kd-signal">
          <span className="kd-signal__date k-num">{long(s.date)}</span>
          <span className="kd-signal__text">{s.text}</span>
        </li>
      ))}
    </ul>
  );
}
