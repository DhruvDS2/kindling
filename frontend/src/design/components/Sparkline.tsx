import './Sparkline.css';

export interface SparklineProps {
  /** Oldest first, e.g. the last 8 Mondays from /stats. */
  values: number[];
  /** Describes the trend for screen readers, e.g. "Ready to buy, last 8 Mondays: 3 to 9". */
  label: string;
  className?: string;
}

/** A small trend line for a StatBlock. Gray line, the latest point in ink. No axes, no fill. */
export function Sparkline({ values, label, className }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 22 - ((v - min) / span) * 20] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className={['k-spark', className ?? ''].join(' ').trim()} viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} className="k-spark__line" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={1.6} className="k-spark__dot" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
