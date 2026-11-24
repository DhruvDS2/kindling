import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { dur, ease, useReduce } from '../motion';

export interface CountThroughOptions {
  /** Count up from 0 once on first mount over --motion-reveal (first load). Default true. */
  reveal?: boolean;
}

/**
 * 7A count-through (DESIGN.md §3.3): returns a number that travels through intermediate values
 * to `target` over --motion-base with the enter easing. First mount counts up once over
 * --motion-reveal. Reduced motion swaps instantly. `null` holds the last value.
 */
export function useCountThrough(target: number | null | undefined, { reveal = true }: CountThroughOptions = {}): number | null {
  const reduce = useReduce();
  const [shown, setShown] = useState<number | null>(() => (target == null ? null : reveal && !reduce ? 0 : target));
  const from = useRef<number | null>(shown);
  const first = useRef(true);

  useEffect(() => {
    if (target == null) return;
    const start = from.current;
    const isFirst = first.current || start == null;
    first.current = false;
    if (reduce || (isFirst && !reveal) || start === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const controls = animate(isFirst ? 0 : start ?? 0, target, {
      duration: dur(isFirst ? 'reveal' : 'base'),
      ease: ease('enter'),
      onUpdate: v => { from.current = v; setShown(v); },
      onComplete: () => { from.current = target; setShown(target); },
    });
    return () => controls.stop();
  }, [target, reduce, reveal]);

  return shown;
}

export interface NumberFlowProps extends CountThroughOptions {
  value: number | null | undefined;
  /** Formats each intermediate value. Default: rounded with thousands separators. */
  format?: (n: number) => string;
  /** Shown while value is null (loading). */
  placeholder?: string;
  className?: string;
}

// Perf (Phase 3): one cached formatter instead of toLocaleString() per frame per number (an 85-row
// week step formats ~170 numbers every frame of the count-through). Same output.
const INT = new Intl.NumberFormat('en-US');
const defaultFormat = (n: number) => INT.format(Math.round(n));

/** A metric that counts through to its new value, in tabular figures so the width never jumps. */
export function NumberFlow({ value, format = defaultFormat, placeholder = '—', className, reveal }: NumberFlowProps) {
  const shown = useCountThrough(value, { reveal });
  const final = value == null ? null : format(value);
  return (
    <span className={['k-num', className ?? ''].join(' ').trim()}>
      {/* Screen readers get the settled value once, not every frame. */}
      <span aria-hidden="true">{shown == null ? placeholder : format(shown)}</span>
      <span className="k-sr-only">{final ?? placeholder}</span>
    </span>
  );
}
