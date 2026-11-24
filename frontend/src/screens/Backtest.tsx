import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BacktestData, BacktestResults, ResultsRun } from '../types';
import { fetchBacktest, fetchBacktestResults } from '../api';
import { useAsOf } from '../asOf';
import { SkeletonCard } from '../components/Skeleton';
import RunCard, { HeadlineStats } from '../components/backtest/RunCard';
import WeeklyAlertsChart from '../components/backtest/WeeklyAlertsChart';
import MissingRuns from '../components/backtest/MissingRuns';
import { HEADLINE_RUNS, cardStyle, commandFor, sortExperiments } from '../components/backtest/metrics';

// Every number on this screen comes from GET /backtest/results (the results/*.json
// files backtest.py wrote) or GET /backtest (weekly counts). Nothing is computed here.

function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
        {intro && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 820 }}>{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function LoadError({ what, error }: { what: string; error: unknown }) {
  return (
    <div role="alert" style={{ ...cardStyle, color: 'var(--muted)', fontSize: 14 }}>
      Couldn't load {what}: {error instanceof Error ? error.message : String(error)}. Is the API running?
    </div>
  );
}

function MissingRunCard({ id, label }: { id: string; label: string }) {
  return (
    <div style={{ ...cardStyle, alignSelf: 'start', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{label}</div>
      <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>results/{id}.json</code> wasn't found.
      Run <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink)' }}>{commandFor(id)}</code> to write it.
    </div>
  );
}

/** A run whose tables each compare two columns fits in half the width; wider ones get a full row. */
const isCompact = (run: ResultsRun) => run.tables.every(t => t.index_name === null && t.columns.length <= 2);

const twoUp = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoFlow: 'row dense', gap: 20, alignItems: 'start' } as const;

export default function Backtest() {
  const { meta } = useAsOf();
  const results = useQuery<BacktestResults>({ queryKey: ['backtest-results'], queryFn: fetchBacktestResults });
  const weekly = useQuery<BacktestData>({ queryKey: ['backtest'], queryFn: fetchBacktest });

  const runs = results.data?.runs ?? [];
  const pql = runs.find(r => r.id === HEADLINE_RUNS.pql);
  const health = runs.find(r => r.id === HEADLINE_RUNS.health);
  const experiments = sortExperiments(runs);

  return (
    <div data-testid="backtest" style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingBottom: 48 }}>
      {results.error && <LoadError what="the backtest results (GET /backtest/results)" error={results.error} />}
      {results.data && <MissingRuns missing={results.data.missing} />}

      <Section
        title="Kindling vs a naive baseline"
        intro="Both scores were replayed every Monday without seeing outcomes, then graded against what each school did. Every row of each results file is shown, including the ones where the naive model wins. Bold marks the better number on a row."
      >
        {results.isLoading ? (
          <div style={twoUp}><SkeletonCard rows={9} /><SkeletonCard rows={9} /></div>
        ) : results.data && (
          <div style={{ ...twoUp, alignItems: 'stretch' }}>
            {pql
              ? <RunCard run={pql} eyebrow="Ready to buy · free schools" summary={<HeadlineStats run={pql} labels={['precision', 'recall']} />} />
              : <MissingRunCard id={HEADLINE_RUNS.pql} label="PQL backtest" />}
            {health
              ? <RunCard run={health} eyebrow="At risk · paying schools" summary={<HeadlineStats run={health} labels={['false alarm rate', 'recall (churners)']} />} />
              : <MissingRunCard id={HEADLINE_RUNS.health} label="Health backtest" />}
          </div>
        )}
      </Section>

      <Section
        title="At-risk alerts, week by week"
        intro={`Paying schools scored At risk (health below ${meta.thresholds.health_at_risk_below}) on each Monday of the replay, by each model. Descriptive counts from GET /backtest: no outcomes are needed to draw them.`}
      >
        {weekly.error ? <LoadError what="the weekly series (GET /backtest)" error={weekly.error} />
          : weekly.isLoading || !weekly.data ? <SkeletonCard rows={6} />
          : (
            <div style={cardStyle}>
              <WeeklyAlertsChart data={weekly.data} />
              <p style={{ fontSize: 14, color: 'var(--body)', margin: '16px 0 0', lineHeight: 1.6, maxWidth: 860 }}>
                The naive model reads every school break as a drop in usage, so its alerts spike as school comes back.
                Counting school days instead of calendar days means a break doesn't look like a drop, so Kindling's alerts don't spike.
              </p>
            </div>
          )}
      </Section>

      {(results.isLoading || experiments.length > 0) && (
        <Section
          title="Experiments"
          intro="Separate runs, each written to its own results file. None of them changes the headline numbers above. District calendars first, then the admin rule, the threshold sweep, and rules vs logistic regression."
        >
          {results.isLoading ? <SkeletonCard rows={8} /> : (
            <div style={twoUp}>
              {experiments.map(run => (
                <div key={run.id} style={{ gridColumn: isCompact(run) ? 'span 1' : '1 / -1', minWidth: 0 }}>
                  <RunCard run={run} tag={run.id === 'pql_admin_threshold' ? 'Experiment only: off in live scoring' : undefined} />
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
