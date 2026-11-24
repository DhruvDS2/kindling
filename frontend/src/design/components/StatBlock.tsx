import type { ReactNode } from 'react';
import { NumberFlow } from './NumberFlow';
import { Skeleton } from './Skeleton';
import './StatBlock.css';

export interface StatBlockProps {
  label: string;
  /** null while loading or when there is no value. */
  value: number | null | undefined;
  format?: (n: number) => string;
  /** The one context line: change vs last week, or what the number is out of. */
  context?: ReactNode;
  /** Optional trend (a <Sparkline>). */
  sparkline?: ReactNode;
  loading?: boolean;
  /** What failed, e.g. "Couldn't load". Replaces the context line. */
  error?: string;
  /** Count up once on first mount. Default true. */
  reveal?: boolean;
  className?: string;
}

/** 3B: a number with one context line under it, plus an optional sparkline. Never a bare number. */
export function StatBlock({ label, value, format, context, sparkline, loading, error, reveal = true, className }: StatBlockProps) {
  return (
    <div className={['k-stat', className ?? ''].join(' ').trim()} aria-busy={loading || undefined}>
      <div className="k-stat__label">{label}</div>
      <div className="k-stat__value-row">
        <div className="k-stat__value">
          {loading ? <Skeleton width="60%" height="display" /> : <NumberFlow value={error ? null : value} format={format} reveal={reveal} />}
        </div>
        {!loading && !error && sparkline}
      </div>
      <div className={['k-stat__context', error ? 'is-error' : ''].join(' ').trim()}>
        {loading ? <Skeleton width="80%" height="label" /> : error ?? context}
      </div>
    </div>
  );
}

export interface StatRowItem extends Omit<StatBlockProps, 'className' | 'sparkline'> {
  /** The stat at full ink; the others are secondary. Use on one item at most. */
  emphasis?: boolean;
}

/** 3A: a ruled row of (usually four) stats between hairlines. */
export function StatRow({ items, className }: { items: StatRowItem[]; className?: string }) {
  return (
    <div className={['k-statrow', className ?? ''].join(' ').trim()} style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
      {items.map(({ emphasis, ...it }) => (
        <StatBlock key={it.label} {...it} className={emphasis ? 'is-emphasis' : 'is-quiet'} />
      ))}
    </div>
  );
}
