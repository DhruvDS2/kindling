import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState } from '../design';
import type { BacktestData, BacktestResults, ResultsRun } from '../types';
import { fetchBacktest, fetchBacktestResults } from '../api';
import { useAsOf } from '../asOf';
import { Headline, HeadlineStats } from '../components/backtest/Headline';
import HeroBars from '../components/backtest/HeroBars';
import MissingRuns from '../components/backtest/MissingRuns';
import { Note } from '../components/backtest/Note';
import { BarsSkeleton, ChartSkeleton, HeadSkeleton, StatsSkeleton, TableSkeleton } from '../components/backtest/PageSkeleton';
import ResultsTable from '../components/backtest/ResultsTable';
import { Section } from '../components/backtest/Section';
import WeeklyAlertsChart, { WeeklyTakeaway } from '../components/backtest/WeeklyAlertsChart';
import { HEADLINE_RUNS, display, findTable } from '../components/backtest/metrics';
import '../components/backtest/backtest.css';

// An editorial results page. Every number on it comes from GET /backtest/results (the
// results/*.json files backtest.py wrote, looked up by row label) or GET /backtest (weekly
// counts). Nothing is computed or typed here, and every results table carries its stamp.

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The sentence over the bars: how many schools each model flags, and what that costs. */
function barsIntro(pql?: ResultsRun, health?: ResultsRun) {
  const pt = findTable(pql), ht = findTable(health);
  const nFlag = display(pt, 'schools flagged', 'naive'), kFlag = display(pt, 'schools flagged', 'kindling');
  const nAlarm = display(ht, 'false alarms (healthy flagged at risk)', 'naive');
  const kAlarm = display(ht, 'false alarms (healthy flagged at risk)', 'kindling');
  return (
    <>
      {nFlag && kFlag && <p>The naive model flags far more schools (<span className="k-num">{nFlag}</span> free schools to Kindling’s <span className="k-num">{kFlag}</span>), so it catches more buyers and churners, and sooner.</p>}
      {nAlarm && kAlarm && <p>The cost is noise: <span className="k-num">{nAlarm}</span> healthy paying schools flagged at risk by mistake, against <span className="k-num">{kAlarm}</span>.</p>}
    </>
  );
}

export default function Backtest() {
  const { meta } = useAsOf();
  const results = useQuery<BacktestResults>({ queryKey: ['backtest-results'], queryFn: fetchBacktestResults });
  const weekly = useQuery<BacktestData>({ queryKey: ['backtest'], queryFn: fetchBacktest });

  const runs = results.data?.runs ?? [];
  const missing = results.data?.missing ?? [];
  const pql = runs.find(r => r.id === HEADLINE_RUNS.pql);
  const health = runs.find(r => r.id === HEADLINE_RUNS.health);
  const headline = [pql, health].filter((r): r is ResultsRun => !!r);
  const loading = results.isLoading;

  const weeklySection = (
    <Section
      id="weekly"
      title="At-risk alerts, week by week"
      intro={(
        <>
          <p>Paying schools scored At risk (health below <span className="k-num">{meta.thresholds.health_at_risk_below}</span>) on each Monday of the replay. No outcomes are needed to draw this.</p>
          {weekly.data && <p><WeeklyTakeaway data={weekly.data} /></p>}
        </>
      )}
    >
      {weekly.error ? (
        <ErrorState
          title="Couldn’t load the weekly alerts."
          detail={`GET /backtest: ${errorText(weekly.error)}`}
          onRetry={() => void weekly.refetch()}
          retrying={weekly.isFetching}
        />
      ) : weekly.data ? <WeeklyAlertsChart data={weekly.data} /> : <ChartSkeleton />}
    </Section>
  );

  if (results.error) {
    return (
      <div className="bt" data-testid="backtest">
        <ErrorState
          title="Couldn’t load the backtest results."
          detail={`GET /backtest/results: ${errorText(results.error)}. Is the API running?`}
          onRetry={() => void results.refetch()}
          retrying={results.isFetching}
        />
        {weeklySection}
      </div>
    );
  }

  if (!loading && runs.length === 0) {
    return (
      <div className="bt" data-testid="backtest">
        {missing.length > 0 ? (
          <MissingRuns missing={missing} onRetry={() => void results.refetch()} retrying={results.isFetching} />
        ) : (
          <EmptyState action={{ label: 'Check again', onClick: () => void results.refetch() }}>
            No backtest results yet. Run <code className="bt-code">make backtest</code> and <code className="bt-code">make experiments</code> from the repo root to replay the year and write them.
          </EmptyState>
        )}
        {weeklySection}
      </div>
    );
  }

  return (
    <div className="bt" data-testid="backtest" aria-busy={loading || undefined}>
      {!loading && <MissingRuns missing={missing} onRetry={() => void results.refetch()} retrying={results.isFetching} />}
      {loading ? <HeadSkeleton /> : <Headline pql={pql} health={health} />}
      {loading ? <StatsSkeleton /> : <HeadlineStats pql={pql} health={health} />}

      {(loading || headline.length > 0) && (
        <Section
          id="bars"
          title="Where each model wins"
          intro={loading ? null : barsIntro(pql, health)}
        >
          {loading ? <BarsSkeleton /> : <HeroBars pql={pql} health={health} />}
        </Section>
      )}

      {(loading || headline.length > 0) && (
        <Section
          id="tables"
          title="Full results"
          intro={<p>Every row of each results file, exactly as backtest.py wrote it, including the rows where the naive model wins. The better number on a row is set darker.</p>}
        >
          {loading ? <TableSkeleton /> : (
            <div className="bt-tables">
              {headline.map(run => (
                <div key={run.id} className="bt-run" data-run={run.id}>
                  <h3 className="bt-run__title">
                    {run.id === HEADLINE_RUNS.pql ? 'Ready to buy' : 'At risk'}
                    <span className="bt-run__who"> · {run.id === HEADLINE_RUNS.pql ? 'free schools' : 'paying schools'}</span>
                  </h3>
                  <Note text={run.note} />
                  {run.tables.map((t, i) => <ResultsTable key={i} run={run} table={t} />)}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {weeklySection}

    </div>
  );
}
