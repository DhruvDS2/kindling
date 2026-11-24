import type { CSSProperties } from 'react';
import { NumberFlow } from './NumberFlow';
import type { StatusTone } from './StatusPill';
import './ScoreMeter.css';

export interface ScoreMeterProps {
  value: number;
  /** The line that matters (e.g. meta.thresholds.pql_ready). Passed in, never hardcoded. */
  threshold: number;
  max?: number;
  /** Fill color: the row's status tone. Default neutral. */
  tone?: StatusTone;
  /** Print the score before the bar (counts through on change). Default true. */
  showValue?: boolean;
  /** Accessible description of the threshold, e.g. "Ready at 60". */
  thresholdLabel?: string;
  /** Skip the first-load count-up (e.g. inside a table that already revealed). */
  reveal?: boolean;
  className?: string;
}

/** A thin bar with a threshold tick. The number is the point; the bar is context. */
export function ScoreMeter({ value, threshold, max = 100, tone = 'neutral', showValue = true, thresholdLabel, reveal = false, className }: ScoreMeterProps) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n / max));
  const style = { '--k-fill': clamp(value), '--k-tick': clamp(threshold) } as CSSProperties;
  return (
    <span
      className={['k-meter', `k-meter--${tone}`, className ?? ''].join(' ').trim()}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={thresholdLabel ? `Score ${value} of ${max}. ${thresholdLabel}` : `Score ${value} of ${max}`}
      style={style}
    >
      {showValue && <NumberFlow value={value} reveal={reveal} className="k-meter__value" />}
      <span className="k-meter__track" aria-hidden="true">
        <span className="k-meter__fill" />
        <span className="k-meter__tick" />
      </span>
    </span>
  );
}
