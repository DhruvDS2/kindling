import type { ResultsRun } from '../../types';
import { fmtRunTime } from './metrics';

/** Where a results table came from: its file, when backtest.py wrote it, and at which commit. */
export default function SourceStamp({ run }: { run: ResultsRun }) {
  const item = { display: 'inline-flex', gap: 5, alignItems: 'baseline' } as const;
  const key = { color: 'var(--muted)' } as const;
  const val = { fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' } as const;
  return (
    <div
      data-testid="source-stamp"
      style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4, fontSize: 11.5, lineHeight: 1.5 }}
    >
      <span style={item}><span style={key}>Source</span><span style={val}>{run.source}</span></span>
      <span style={item} title={run.generated_at}>
        <span style={key}>Run</span><span style={val}>{fmtRunTime(run.generated_at)}</span>
      </span>
      <span style={item}>
        <span style={key}>Commit</span><span style={val}>{run.commit ?? 'not recorded'}</span>
      </span>
    </div>
  );
}
