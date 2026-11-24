import { useState } from 'react';
import { SegmentedControl } from '../../design';
import type { ResultsRun } from '../../types';
import { Bar, DisplayValue } from './Bars';
import {
  columnIndex, daysEarly, display, findIndexedTable, findRow, findTable, rawValue, sentenceCase, unitOf,
} from './metrics';
import { Note } from './Note';
import ResultsTable from './ResultsTable';
import { Disclosure, Section } from './Section';
import SourceStamp from './SourceStamp';

// The district-calendar experiment as a before/after: Kindling reading one national calendar
// vs each school's own district calendar, in a world where schools follow their districts.
// The bars morph between the two columns of district_calendar_backtest (over --motion-base).

type State = 'national' | 'district';
const COLUMN: Record<State, RegExp> = { national: /national/i, district: /district/i };

const FALSE_ALARM_RATE = 'false alarm rate';
const RECALL = 'recall (churners)';
const LEAD = 'median lead time on churners (days)';

/** The one-sentence takeaway, from the health table: false alarms before → after, and the cost. */
function DistrictTakeaway({ run }: { run: ResultsRun }) {
  const t = findTable(run, /health/i) ?? findTable(run);
  const fa = (s: State) => display(t, FALSE_ALARM_RATE, COLUMN[s]);
  const rc = (s: State) => display(t, RECALL, COLUMN[s]);
  if (!fa('national') || !fa('district')) return null;
  return (
    <>
      Reading each school’s own district calendar takes Kindling’s false alarms from <span className="k-num">{fa('national')}</span> to <span className="k-num">{fa('district')}</span>
      {rc('national') && rc('district') && <>. Churners flagged early go from <span className="k-num">{rc('national')}</span> to <span className="k-num">{rc('district')}</span></>}.
    </>
  );
}

export default function DistrictExperiment({ run }: { run: ResultsRun }) {
  const [state, setState] = useState<State>('national');
  const health = findTable(run, /health/i) ?? findTable(run);
  const byCalendar = findIndexedTable(run, 'calendar');
  const col = (s: State, t = health) => columnIndex(t, COLUMN[s]);
  const early = daysEarly(health);

  const metrics = [
    { label: FALSE_ALARM_RATE, title: 'Healthy schools flagged by mistake' },
    { label: RECALL, title: early ? `Churners flagged ${early}+ days before renewal` : 'Churners flagged early' },
    { label: LEAD, title: 'Warning before a renewal' },
  ].filter(m => findRow(health, m.label));

  // Day rows scale to the longer of the two states.
  const dayMax = (label: string) => {
    const row = findRow(health, label);
    return Math.max(rawValue(row, col('national')) ?? 0, rawValue(row, col('district')) ?? 0) || 1;
  };

  // "Healthy schools flagged at least once, by the calendar the school actually follows": n of total.
  const totalCol = columnIndex(byCalendar, /healthy/i);

  return (
    <Section
      id="district"
      title="Experiment: district calendars"
      intro={<p><DistrictTakeaway run={run} /></p>}
    >
      <div className="bt-district" data-testid="district" data-state={state}>
        <div className="bt-district__control">
          <SegmentedControl<State>
            aria-label="Calendar Kindling reads"
            value={state}
            onChange={setState}
            options={[
              { id: 'national', label: 'One national calendar' },
              { id: 'district', label: 'District calendars' },
            ]}
          />
          <span className="bt-district__column">
            Column: “{health?.columns[col(state)] ?? '—'}”
          </span>
        </div>

        <div className="bt-district__metrics">
          {metrics.map(m => {
            const row = findRow(health, m.label);
            const unit = unitOf(m.label);
            const v = rawValue(row, col(state));
            return (
              <div key={m.label} className="bt-metric bt-metric--single" data-metric={m.label}>
                <div className="bt-metric__label">
                  <span className="bt-metric__title">{m.title}</span>
                  <span className="bt-metric__sub">{sentenceCase(m.label)}</span>
                </div>
                <div className="bt-metric__bars">
                  <Bar
                    tone="hero"
                    rail
                    frac={v == null ? null : unit ? v / dayMax(m.label) : v}
                    value={<DisplayValue text={display(health, m.label, col(state))} after={unit ? ` ${unit}` : ''} />}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {byCalendar && totalCol >= 0 && (
          <div className="bt-district__calendars">
            <h3 className="bt-district__subhead">{byCalendar.note?.replace(/\.\s*$/, '') ?? 'Healthy schools flagged at risk, by calendar'}</h3>
            {byCalendar.rows.map(row => {
              const n = rawValue(row, col(state, byCalendar));
              const total = rawValue(row, totalCol);
              return (
                <div key={row.label} className="bt-metric bt-metric--single bt-metric--compact" data-calendar={row.label}>
                  <div className="bt-metric__label">
                    <span className="bt-metric__title">{sentenceCase(row.label)}</span>
                  </div>
                  <div className="bt-metric__bars">
                    <Bar
                      tone="hero"
                      rail
                      frac={n == null || !total ? null : n / total}
                      value={<><DisplayValue text={row.display[col(state, byCalendar)] ?? null} /> of {row.display[totalCol]}</>}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Note text={run.note} className="bt-district__note" />
        <SourceStamp run={run} />

        <div className="bt-disclosures">
          <Disclosure id="district-tables" title="Full tables" takeaway={`All ${run.tables.length} tables from ${run.source}, including the naive model and the PQL score.`}>
            {run.tables.map((t, i) => <ResultsTable key={i} run={run} table={t} />)}
          </Disclosure>
        </div>
      </div>
    </Section>
  );
}
