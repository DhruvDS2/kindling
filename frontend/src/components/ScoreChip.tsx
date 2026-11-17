interface Props {
  score: number;
  type: 'pql' | 'health';
}

export default function ScoreChip({ score, type }: Props) {
  const isEmber = type === 'pql';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: 6,
      background: isEmber ? 'var(--ember-chip-bg)' : 'var(--risk-chip-bg)',
      color: isEmber ? 'var(--ember-chip-text)' : 'var(--risk)',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {score} · {isEmber ? 'Ready' : 'At risk'}
    </span>
  );
}
