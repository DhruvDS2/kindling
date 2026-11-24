import { Button } from '../../design';
import { commandFor } from './metrics';

/**
 * Results files the API looked for and didn't find, with the command that writes each one.
 * Their sections are left out rather than filled with old numbers.
 */
export default function MissingRuns({ missing, onRetry, retrying }: { missing: string[]; onRetry?: () => void; retrying?: boolean }) {
  if (missing.length === 0) return null;
  const commands = [...new Set(missing.map(commandFor))];
  return (
    <section className="bt-missing" data-testid="missing-runs" role="status" aria-labelledby="bt-missing-title">
      <p id="bt-missing-title" className="bt-missing__title">
        {missing.length === 1 ? 'One results file hasn’t been written yet' : `${missing.length} results files haven’t been written yet`}, so
        {missing.length === 1 ? ' its numbers are' : ' their numbers are'} left off this page rather than shown from an older run.
      </p>
      <ul className="bt-missing__list">
        {missing.map(id => (
          <li key={id} className="bt-missing__item">
            <span className="bt-missing__file">results/{id}.json</span>
            <span className="bt-missing__by">written by</span>
            <code className="bt-code">{commandFor(id)}</code>
          </li>
        ))}
      </ul>
      <div className="bt-missing__foot">
        <p className="bt-missing__how">
          Run {commands.map((c, i) => <span key={c}>{i > 0 && ' and '}<code className="bt-code">{c}</code></span>)} from the repo root, then check again.
        </p>
        {onRetry && <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>Check again</Button>}
      </div>
    </section>
  );
}
