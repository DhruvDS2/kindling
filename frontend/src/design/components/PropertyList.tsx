import type { ReactNode } from 'react';
import { TruncatedText } from './Tooltip';
import './PropertyList.css';

export interface Property {
  label: string;
  /** A string truncates with a tooltip; a node renders as given. null/undefined shows an em dash. */
  value: ReactNode;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
}

/** 4A record properties: label/value rows, labels muted, values ink, hairline between groups. */
export function PropertyList({ title, items, className }: { title?: ReactNode; items: Property[]; className?: string }) {
  return (
    <section className={['k-props', className ?? ''].join(' ').trim()}>
      {title && <h3 className="k-props__title">{title}</h3>}
      <dl className="k-props__list">
        {items.map(p => (
          <div className="k-props__row" key={p.label}>
            <dt className="k-props__label">{p.label}</dt>
            <dd className={['k-props__value', p.numeric ? 'k-num' : ''].join(' ').trim()}>
              {p.value == null || p.value === '' ? <span className="k-props__none" aria-label="None">—</span>
                : typeof p.value === 'string' ? <TruncatedText>{p.value}</TruncatedText>
                : p.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
