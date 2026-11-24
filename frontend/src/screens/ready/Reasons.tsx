import { Fragment } from 'react';
import { fmtPoints, topReasons } from '../../components/ScoreChip';
import type { ReasonDetail } from '../../types';

/** "+35" for points earned, "−5" for a penalty, nothing when the API gave no points. */
function points(r: ReasonDetail) {
  if (!Number.isFinite(r.points)) return null;
  return r.points < 0 ? fmtPoints(r.points) : `+${fmtPoints(r.points)}`;
}

/** Keep a leading count with its noun ("5 teachers") so a line never breaks between them. */
const keepLead = (text: string) => text.replace(/^(\S{1,4}) /, '$1\u00a0');

/**
 * The school's top reasons as one running line, each followed by its points in quiet tabular
 * figures: "5 teachers with heavy student use +35 · An admin signed up +15".
 * `lines` caps the height (2 in the Ready table, 1 in the brief); the drawer has the full list.
 */
export function ReasonsInline({ school, max = 3, lines = 2, showPoints = true, empty = 'No usage signals in this window' }: {
  school: { reasons: string[]; reason_details: ReasonDetail[] };
  max?: number;
  lines?: 1 | 2;
  showPoints?: boolean;
  empty?: string;
}) {
  const reasons = topReasons(school).slice(0, max);
  if (reasons.length === 0) return <span className="ready-why ready-why--1 ready-why--empty">{empty}</span>;
  return (
    <p className={`ready-why ready-why--${lines}`}>
      {reasons.map((r, i) => {
        const p = showPoints ? points(r) : null;
        return (
          <Fragment key={r.text}>
            {i > 0 && <span className="ready-why__sep" aria-hidden="true"> · </span>}
            <span>{keepLead(r.text)}</span>
            {p && <span className="ready-why__pts k-num"> {p}</span>}
          </Fragment>
        );
      })}
    </p>
  );
}
