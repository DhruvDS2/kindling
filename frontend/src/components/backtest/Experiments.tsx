import { Fragment, type ReactNode } from 'react';
import type { ResultsRun } from '../../types';
import { DISTRICT_RUN, columnIndex, display, findTable, markedRow, rowKeyText, sortExperiments } from './metrics';
import { Note } from './Note';
import ResultsTable from './ResultsTable';
import { Disclosure, Section } from './Section';

// The experiments after the district calendars: one collapsed row each, with a one-sentence
// takeaway built from its own results file, and the full tables (each with its stamp) inside.
// LR vs rules is one row for both of its files. A run the API adds later gets its own row.

const N = ({ children }: { children: ReactNode }) => <span className="k-num">{children}</span>;

function adminTakeaway(run: ResultsRun): ReactNode {
  const base = findTable(run, /default/i) ?? run.tables[0];
  const stress = findTable(run, /stress/i);
  const run2 = /^run 2/i, run3 = /^run 3/i;
  const r2 = display(base, 'recall', run2), r3 = display(base, 'recall', run3);
  const p2 = display(stress, 'precision', run2), p3 = display(stress, 'precision', run3);
  if (!r2 || !r3) return null;
  return (
    <>
      Making schools with an admin Ready at a lower score lifts recall from <N>{r2}</N> to <N>{r3}</N>
      {p2 && p3 && <>, but when admins also join schools that don’t buy, precision falls from <N>{p2}</N> to <N>{p3}</N></>}. It stays off in live scoring.
    </>
  );
}

function sweepTakeaway(run: ResultsRun): ReactNode {
  const pql = findTable(run, /pql/i);
  const health = findTable(run, /health/i);
  const pick = markedRow(pql, 'fall pick');
  const config = markedRow(pql, 'config');
  const sp = columnIndex(pql, /^spring precision$/i);
  const hPick = markedRow(health, 'fall pick');
  const hConfig = markedRow(health, 'config');
  if (!pick || !config || sp < 0) return null;
  return (
    <>
      Fall data would move the Ready line from <N>{rowKeyText(config)}</N> to <N>{rowKeyText(pick)}</N>, but at <N>{rowKeyText(pick)}</N> only <N>{pick.display[sp]}</N> of
      spring’s Ready schools bought, against <N>{config.display[sp]}</N> at <N>{rowKeyText(config)}</N>, so it stays.
      {hPick && hConfig && (hPick === hConfig
        ? <> The At-risk line’s fall pick, <N>{rowKeyText(hPick)}</N>, is the one already in use.</>
        : <> The At-risk line’s fall pick is <N>{rowKeyText(hPick)}</N>, against <N>{rowKeyText(hConfig)}</N> in use.</>)}
    </>
  );
}

function lrTakeaway(pql?: ResultsRun, health?: ResultsRun): ReactNode {
  const pt = findTable(pql), ht = findTable(health);
  const lr = /logistic/i, rules = /^rules/i;
  const recallLr = display(pt, 'recall', lr), recallRules = display(pt, 'recall', rules);
  const precLr = display(pt, 'precision', lr), precRules = display(pt, 'precision', rules);
  const faLr = display(ht, 'false alarm rate', lr), faRules = display(ht, 'false alarm rate', rules);
  const parts: ReactNode[] = [];
  if (recallLr && recallRules && precLr && precRules) {
    parts.push(<>Trained on fall, logistic regression catches more spring buyers (<N>{recallLr}</N> against <N>{recallRules}</N>) but is less precise (<N>{precLr}</N> against <N>{precRules}</N>)</>);
  }
  if (faLr && faRules) {
    parts.push(<>{parts.length ? '; on paying schools' : 'On paying schools, logistic regression'} it raises false alarms on <N>{faLr}</N> of healthy schools, against <N>{faRules}</N> for the rules</>);
  }
  return parts.length ? <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}.</> : null;
}

function RunTables({ run }: { run: ResultsRun }) {
  return (
    <div className="bt-run" data-run={run.id}>
      <h3 className="bt-run__title">{run.title}</h3>
      <Note text={run.note} />
      {run.tables.map((t, i) => <ResultsTable key={i} run={run} table={t} />)}
    </div>
  );
}

export default function Experiments({ runs }: { runs: ResultsRun[] }) {
  const rest = sortExperiments(runs).filter(r => r.id !== DISTRICT_RUN);
  if (rest.length === 0) return null;
  const lr = rest.filter(r => /_lr_comparison$/.test(r.id));
  const rows: { id: string; title: string; tag?: string; takeaway: ReactNode; runs: ResultsRun[] }[] = [];
  for (const run of rest) {
    if (lr.includes(run)) {
      if (run !== lr[0]) continue;
      rows.push({
        id: 'lr', title: 'Rules vs logistic regression', runs: lr,
        takeaway: lrTakeaway(lr.find(r => r.id.startsWith('pql')), lr.find(r => r.id.startsWith('health'))),
      });
    } else if (run.id === 'pql_admin_threshold') {
      rows.push({ id: run.id, title: 'Admin rule', tag: 'Experiment only', takeaway: adminTakeaway(run), runs: [run] });
    } else if (run.id === 'threshold_sweep') {
      rows.push({ id: run.id, title: 'Threshold sweep', takeaway: sweepTakeaway(run), runs: [run] });
    } else {
      rows.push({ id: run.id, title: run.title, takeaway: null, runs: [run] });
    }
  }

  return (
    <Section
      id="experiments"
      title="Other experiments"
      intro={<p>Separate runs, each written to its own results file. None of them changes the numbers above.</p>}
    >
      <div className="bt-disclosures" data-testid="experiments">
        {rows.map(r => (
          <Disclosure key={r.id} id={r.id} title={r.title} tag={r.tag} takeaway={r.takeaway}>
            {r.runs.map(run => <RunTables key={run.id} run={run} />)}
          </Disclosure>
        ))}
      </div>
    </Section>
  );
}
