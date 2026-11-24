import type { ReactNode } from 'react';
import { StatRow, type StatRowItem } from '../../design';
import type { ResultsRun } from '../../types';
import {
  columnIndex, display, findTable, fmtReplay, naiveAhead, naiveRule, parseDisplay, unitOf,
} from './metrics';

// The top of the page: the replay range, one or two sentences, and the 3A stat row.
// Every number is a display string from the two headline results files, found by row label.

const FALSE_ALARMS = 'false alarms (healthy flagged at risk)';
const FALSE_ALARM_RATE = 'false alarm rate';
const PRECISION = 'precision';
const RECALL = 'recall';
const LEAD = 'median lead time (days)';

export function Headline({ pql, health }: { pql?: ResultsRun; health?: ResultsRun }) {
  const pt = findTable(pql);
  const ht = findTable(health);
  const replay = fmtReplay(pql?.replay ?? health?.replay);

  const kAlarms = display(ht, FALSE_ALARMS, 'kindling');
  const nAlarms = display(ht, FALSE_ALARMS, 'naive');
  const kPrecision = display(pt, PRECISION, 'kindling');
  const nPrecision = display(pt, PRECISION, 'naive');
  const rule = naiveRule(pt?.columns[columnIndex(pt, 'naive')]);

  const alarms = kAlarms != null && nAlarms != null
    ? <>Kindling raised <span className="k-num">{kAlarms}</span> false alarms on healthy schools. <span className="bt-headline__quiet">The naive model raised <span className="k-num">{nAlarms}</span>.</span></>
    : null;
  const list = kPrecision != null && nPrecision != null
    ? <>Reps get a list where <span className="k-num">{kPrecision}</span> buy, against <span className="k-num">{nPrecision}</span> for {rule ? <>“{rule}”</> : 'the naive model'}.</>
    : null;

  return (
    <header className="bt-head">
      {replay && (
        <p className="bt-head__kicker" data-testid="replay-range">
          Replayed every Monday from {replay}, then graded against what each school actually did. The scores never saw those outcomes.
        </p>
      )}
      {(alarms ?? list) && <h2 className="bt-headline" data-testid="headline">{alarms ?? list}</h2>}
      {alarms && list && <p className="bt-head__lede">{list}</p>}
    </header>
  );
}

/** A StatRow value from a display string: counts through, and settles on the exact string. */
function stat(text: string | null, unit = ''): Pick<StatRowItem, 'value' | 'format'> {
  const p = parseDisplay(text);
  if (!p || text == null) return { value: null };
  return { value: p.n, format: n => `${n === p.n ? text.trim() : `${Math.round(n)}${p.suffix}`}${unit}` };
}

function Context({ meaning, naive, ahead, unit = '' }: { meaning: string; naive: string | null; ahead: boolean; unit?: string }): ReactNode {
  return (
    <>
      <span className="bt-stat__meaning">{meaning}</span>
      <span className="bt-stat__naive">
        Naive model <span className="k-num">{naive ?? '—'}{naive ? unit : ''}</span>{ahead && <>, <span className="bt-stat__ahead">ahead here</span></>}
      </span>
    </>
  );
}

/** 3A: Precision, Recall, False alarms, Lead time. Kindling first; the naive model in the context line, including where it wins. */
export function HeadlineStats({ pql, health }: { pql?: ResultsRun; health?: ResultsRun }) {
  const pt = findTable(pql);
  const ht = findTable(health);
  const days = unitOf(LEAD) ? ` ${unitOf(LEAD)}` : '';
  const missing = (run: ResultsRun | undefined, id: string) => (run ? null : `Needs results/${id}.json`);

  const items: StatRowItem[] = [
    {
      label: 'Precision',
      ...stat(display(pt, PRECISION, 'kindling')),
      context: missing(pql, 'pql_backtest') ?? <Context meaning="of Ready schools went on to buy" naive={display(pt, PRECISION, 'naive')} ahead={naiveAhead(pt, PRECISION)} />,
    },
    {
      label: 'Recall',
      ...stat(display(pt, RECALL, 'kindling')),
      context: missing(pql, 'pql_backtest') ?? <Context meaning="of buyers were flagged before buying" naive={display(pt, RECALL, 'naive')} ahead={naiveAhead(pt, RECALL)} />,
    },
    {
      label: 'False alarms',
      emphasis: true,
      ...stat(display(ht, FALSE_ALARM_RATE, 'kindling')),
      context: missing(health, 'health_backtest') ?? <Context meaning="of healthy schools flagged at risk" naive={display(ht, FALSE_ALARM_RATE, 'naive')} ahead={naiveAhead(ht, FALSE_ALARM_RATE)} />,
    },
    {
      label: 'Lead time',
      ...stat(display(pt, LEAD, 'kindling'), days),
      context: missing(pql, 'pql_backtest') ?? <Context meaning="median warning before a purchase" naive={display(pt, LEAD, 'naive')} unit={days} ahead={naiveAhead(pt, LEAD)} />,
    },
  ];
  return (
    <div className="bt-stats" data-testid="stat-row">
      <StatRow items={items} />
    </div>
  );
}
