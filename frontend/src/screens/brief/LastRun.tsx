import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchAutomationsLog } from '../../api';
import { Button, Skeleton, fmtWeek, icons } from '../../design';
import type { AutomationRun } from '../../types';
import { plural } from '../ready/data';

/** The latest run in the n8n log (the log isn't sorted; ISO dates sort as strings). */
function latest(runs: AutomationRun[]): AutomationRun | null {
  return runs.reduce<AutomationRun | null>((best, r) => (!best || r.run_at > best.run_at ? r : best), null);
}

/** One quiet line: when the Slack alerts last went out, and what they were. */
export function LastRun({ onOpen }: { onOpen: () => void }) {
  const q = useQuery({ queryKey: ['automations'], queryFn: fetchAutomationsLog, placeholderData: keepPreviousData });
  const run = q.data ? latest(q.data) : null;
  const cs = run ? run.health_alerts ?? run.cs_alerts : undefined;

  return (
    <div className="brief-run" data-testid="brief-last-run">
      <span className="brief-run__label">Last alert run</span>
      {q.isLoading ? (
        <Skeleton width="40%" />
      ) : q.error && !q.data ? (
        <>
          <span>Couldn't read the alert log: {(q.error as Error).message}</span>
          <Button variant="quiet" size="sm" onClick={() => void q.refetch()} loading={q.isFetching}>Try again</Button>
        </>
      ) : run ? (
        <>
          <span className="brief-run__when k-num" data-testid="last-run-date">{fmtWeek(run.run_at)}</span>
          <span className="k-num">
            {run.pql_alerts} sales {plural(run.pql_alerts, 'alert')}
            {cs !== undefined && <> · {cs} CS {plural(cs, 'alert')}</>}
            {' · '}{run.email_drafts} {plural(run.email_drafts, 'email')} drafted
          </span>
          {run.status === 'failed' && <span className="brief-run__fail">Failed</span>}
        </>
      ) : (
        <span>No alerts have gone out yet. They start when the n8n workflow runs.</span>
      )}
      <Button variant="quiet" size="sm" iconAfter={<icons.ArrowRight small />} onClick={onOpen}>Automations</Button>
    </div>
  );
}
