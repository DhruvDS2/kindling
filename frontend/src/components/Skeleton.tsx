export function SkeletonBlock({ height = 20, width = '100%' }: { height?: number; width?: string | number }) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: 4 }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} height={16} width={i === 0 ? '60%' : '90%'} />
      ))}
    </div>
  );
}
