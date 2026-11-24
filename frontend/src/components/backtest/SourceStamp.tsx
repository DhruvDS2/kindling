import type { ResultsRun } from '../../types';
import { fmtRunTime } from './metrics';

/**
 * Where a results table came from: its file, when backtest.py wrote it (in the viewer's
 * time zone) and at which commit. Quiet, but always printed under the numbers it vouches for.
 */
export default function SourceStamp({ run }: { run: ResultsRun }) {
  return (
    <p className="bt-stamp" data-testid="source-stamp" data-run={run.id}>
      <span className="bt-stamp__item"><span className="bt-stamp__key">Source</span> {run.source}</span>
      <span className="bt-stamp__item">
        <span className="bt-stamp__key">Run</span> <time dateTime={run.generated_at} title={run.generated_at}>{fmtRunTime(run.generated_at)}</time>
      </span>
      <span className="bt-stamp__item">
        <span className="bt-stamp__key">Commit</span> {run.commit ? <span className="k-mono">{run.commit}</span> : 'not recorded'}
      </span>
    </p>
  );
}
