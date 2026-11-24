import type { CSSProperties, ReactNode } from 'react';
import { NumberFlow } from '../../design';
import { parseDisplay } from './metrics';

/**
 * 5B labeled bars: one bar per value, the value printed at the bar's end. The hero series
 * (Kindling) is full ink; the comparison (naive) is the muted data color and thinner.
 * Widths animate through CSS (`width` follows --k-frac), so a bar grows from 0 when it is
 * first revealed (over --motion-reveal) and morphs between states (over --motion-base).
 */
export interface BarProps {
  /** Series name printed before the bar ("Kindling", "Naive"). */
  name?: string;
  tone: 'hero' | 'muted';
  /** 0–1 of the track. null = no bar (value missing). */
  frac: number | null;
  /** The value label at the bar's end. */
  value: ReactNode;
  /** false until revealed: the bar sits at 0 and grows when this turns true. */
  grown?: boolean;
  /** Draw the full track behind the bar (for "3 of 12" style values). */
  rail?: boolean;
}

export function Bar({ name, tone, frac, value, grown = true, rail }: BarProps) {
  const f = frac == null ? 0 : Math.max(0, Math.min(1, frac));
  return (
    <div className={`bt-bar bt-bar--${tone}${name ? '' : ' is-unnamed'}`}>
      {name && <span className="bt-bar__name">{name}</span>}
      <span className={rail ? 'bt-bar__track has-rail' : 'bt-bar__track'}>
        {frac != null && <span className="bt-bar__fill" style={{ '--k-frac': grown ? f : 0 } as CSSProperties} aria-hidden="true" />}
        <span className="bt-bar__value k-num">{value}</span>
      </span>
    </div>
  );
}

/**
 * A display string that counts through to its new value when it changes ("19%" → "0%"),
 * using 7A NumberFlow. At rest it prints the string exactly as backtest.py wrote it.
 */
export function DisplayValue({ text, after = '' }: { text: string | null; after?: string }) {
  const p = parseDisplay(text);
  if (!text) return <>—</>;
  if (!p) return <>{text}{after}</>;
  const format = (n: number) => `${n === p.n ? text.trim() : `${Math.round(n)}${p.suffix}`}${after}`;
  return <NumberFlow value={p.n} format={format} reveal={false} />;
}
