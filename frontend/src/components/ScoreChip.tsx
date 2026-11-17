interface Props {
  score: number;
  type: 'pql' | 'health';
  status?: string;
}

export default function ScoreChip({ score, type, status }: Props) {
  const isEmber = type === 'pql';
  const label = status ?? (isEmber ? 'Ready' : 'At risk');
  const isPositive = label === 'Ready' || label === 'Healthy';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: 6,
      background: isEmber
        ? (isPositive ? 'var(--ember-chip-bg)' : 'var(--nav)')
        : 'var(--risk-chip-bg)',
      color: isEmber
        ? (isPositive ? 'var(--ember-chip-text)' : 'var(--muted)')
        : 'var(--risk)',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {score} · {label}
    </span>
  );
}
