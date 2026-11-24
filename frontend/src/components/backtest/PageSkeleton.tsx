import { Skeleton, StatRow, Table, type Column } from '../../design';

// First load: gray shapes where the headline, stat row, bars and first table will be (9A).
// No spinner, no text.

const skeletonColumns: Column<never>[] = [
  { id: 'label', header: '', cell: () => null, width: '40%', skeleton: '70%' },
  { id: 'a', header: '', cell: () => null, numeric: true, skeleton: '40%' },
  { id: 'b', header: '', cell: () => null, numeric: true, skeleton: '40%' },
];

export function HeadSkeleton() {
  return (
    <div className="bt-head" aria-hidden="true">
      <Skeleton width="44%" height="label" />
      <div className="bt-skel-headline">
        <Skeleton width="62%" height="display" />
        <Skeleton width="38%" height="display" />
      </div>
      <Skeleton width="48%" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="bt-stats">
      <StatRow items={['Precision', 'Recall', 'False alarms', 'Lead time'].map(label => ({ label, value: null, loading: true }))} />
    </div>
  );
}

export function BarsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bt-hero" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bt-metric">
          <div className="bt-metric__label">
            <Skeleton width="70%" />
            <Skeleton width="30%" height="label" />
          </div>
          <div className="bt-metric__bars bt-skel-bars">
            <Skeleton width={`${72 - i * 7}%`} height="label" />
            <Skeleton width={`${40 + i * 6}%`} height="label" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <Table<never> rows={[]} columns={skeletonColumns} rowKey={() => ''} aria-label="Loading results" loading skeletonRows={rows} />;
}

/** Gray columns along a baseline where the weekly chart will be (shape only, no data). */
const COLUMN_HEIGHTS = [18, 24, 30, 22, 34, 28, 40, 32, 26, 36, 30, 22, 28, 34, 24, 18, 26, 20, 14, 22, 16, 12, 10, 8];

export function ChartSkeleton() {
  return (
    <div className="bt-skel-chart" aria-hidden="true">
      {COLUMN_HEIGHTS.map((h, i) => <span key={i} className="k-skeleton bt-skel-col" style={{ height: `${h}%` }} />)}
    </div>
  );
}
