import { useReduce } from '../../design';
import type { ResultsRun, ResultsTable } from '../../types';
import { Bar } from './Bars';
import { useRevealOnce } from './reveal';
import {
  columnIndex, daysEarly, display, findRow, findTable, naiveAhead, naiveRule, rawValue, unitOf,
} from './metrics';

// 5B: one labeled pair of bars per metric, Kindling (full ink) over the naive model (muted).
// Rows where the naive model wins are drawn the same way and say so.

interface Metric { label: string; title: string; sub: string }
interface Group { id: string; title: string; who: string; table: ResultsTable | undefined; metrics: Metric[] }

function groups(pql?: ResultsRun, health?: ResultsRun): Group[] {
  const pt = findTable(pql);
  const ht = findTable(health);
  const early = daysEarly(ht);
  return [
    {
      id: 'pql', title: 'Ready to buy', who: 'free schools', table: pt,
      metrics: [
        { label: 'precision', title: 'Ready schools that bought', sub: 'Precision' },
        { label: 'recall', title: 'Buyers flagged before they bought', sub: 'Recall' },
        { label: 'median lead time (days)', title: 'Warning before a purchase', sub: 'Median lead time' },
      ],
    },
    {
      id: 'health', title: 'At risk', who: 'paying schools', table: ht,
      metrics: [
        { label: 'false alarm rate', title: 'Healthy schools flagged by mistake', sub: 'False alarm rate' },
        { label: 'recall (churners)', title: early ? `Churners flagged ${early}+ days before renewal` : 'Churners flagged early', sub: 'Recall' },
        { label: 'median lead time on churners (days)', title: 'Warning before a renewal', sub: 'Median lead time' },
      ],
    },
  ];
}

/** Day rows share one scale (the longest lead time shown), so their bars compare across groups. */
function dayScale(gs: Group[]): number {
  let max = 0;
  for (const g of gs) {
    for (const m of g.metrics) {
      if (!unitOf(m.label)) continue;
      const row = findRow(g.table, m.label);
      for (const role of ['kindling', 'naive'] as const) max = Math.max(max, rawValue(row, columnIndex(g.table, role)) ?? 0);
    }
  }
  return max || 1;
}

export default function HeroBars({ pql, health }: { pql?: ResultsRun; health?: ResultsRun }) {
  const reduce = useReduce();
  const [ref, grown] = useRevealOnce(reduce);
  const gs = groups(pql, health).filter(g => g.table && g.metrics.some(m => findRow(g.table, m.label)));
  const scale = dayScale(gs);

  return (
    <div ref={ref} className="bt-hero" data-testid="hero-bars" data-grown={grown || undefined}>
      {gs.map(g => {
        const rule = naiveRule(g.table?.columns[columnIndex(g.table, 'naive')]);
        return (
          <section key={g.id} className="bt-hero__group" aria-label={`${g.title}, ${g.who}`}>
            <div className="bt-hero__group-head">
              <h3 className="bt-hero__group-title">{g.title} <span className="bt-hero__group-who">· {g.who}</span></h3>
              {rule && <span className="bt-hero__group-rule">Naive model: “{rule}”</span>}
            </div>
            {g.metrics.map(m => {
              const row = findRow(g.table, m.label);
              if (!row) return null;
              const unit = unitOf(m.label);
              const after = unit ? ` ${unit}` : '';
              const frac = (role: 'kindling' | 'naive') => {
                const v = rawValue(row, columnIndex(g.table, role));
                return v == null ? null : unit ? v / scale : v;
              };
              const text = (role: 'kindling' | 'naive') => {
                const d = display(g.table, m.label, role);
                return d == null ? '—' : `${d}${after}`;
              };
              const ahead = naiveAhead(g.table, m.label);
              return (
                <div key={m.label} className="bt-metric" data-metric={m.label} data-naive-ahead={ahead || undefined}>
                  <div className="bt-metric__label">
                    <span className="bt-metric__title">{m.title}</span>
                    <span className="bt-metric__sub">{m.sub}{ahead && <> · <span className="bt-metric__ahead">naive ahead</span></>}</span>
                  </div>
                  <div className="bt-metric__bars">
                    <Bar name="Kindling" tone="hero" frac={frac('kindling')} value={text('kindling')} grown={grown} />
                    <Bar name="Naive" tone="muted" frac={frac('naive')} value={text('naive')} grown={grown} />
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
