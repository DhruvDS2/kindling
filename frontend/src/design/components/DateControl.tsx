import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { addWeeks, fmtMonth, fmtWeek, mondaysBetween, toMonday } from '../dates';
import { durMs } from '../motion';
import { Button } from './Button';
import { ChevronLeft, ChevronRight, Reset } from './icons';
import './DateControl.css';

export interface WeekPagerProps {
  /** The as-of day ('YYYY-MM-DD'), normally a Monday. */
  value: string;
  /** The simulated year's bounds (meta.sim_start / meta.sim_end). */
  min: string;
  max: string;
  onChange: (monday: string) => void;
  /** meta.demo_as_of: shows a quiet "Demo date" reset when the value differs. */
  demoDate?: string;
  disabled?: boolean;
}

/** ‹ Mon, Feb 2, 2026 ›: steps one Monday at a time. Data comes in as props (lane A wires /meta). */
export function WeekPager({ value, min, max, onChange, demoDate, disabled }: WeekPagerProps) {
  const monday = toMonday(value);
  const prev = value === monday ? addWeeks(monday, -1) : monday;
  const next = addWeeks(monday, 1);
  const first = mondaysBetween(min, max)[0] ?? min;
  const canPrev = !disabled && prev >= first;
  const canNext = !disabled && next <= max;
  return (
    <div className="k-weekpager" role="group" aria-label="Week">
      <Button variant="quiet" size="sm" icon={<ChevronLeft />} aria-label={`Previous week, ${fmtWeek(prev)}`} disabled={!canPrev} onClick={() => onChange(prev)} />
      <span className="k-weekpager__label k-num" aria-live="polite" data-testid="as-of-label">{fmtWeek(value)}</span>
      <Button variant="quiet" size="sm" icon={<ChevronRight />} aria-label={`Next week, ${fmtWeek(next)}`} disabled={!canNext} onClick={() => onChange(next)} />
      {demoDate && value !== demoDate && (
        <Button variant="quiet" size="sm" icon={<Reset />} disabled={disabled} onClick={() => onChange(demoDate)}>Demo date</Button>
      )}
    </div>
  );
}

export interface RulerBreak { start: string; end: string; kind?: 'break' | 'summer' }

export interface WeekRulerProps {
  /** Every Monday of the school year, oldest first (from /meta; see mondaysBetween). */
  mondays: string[];
  /** The selected Monday. */
  value: string;
  /** Called once per settled week: on release after a drag or click, or after keys stop. */
  onChange: (monday: string) => void;
  /** Called live while scrubbing (optional, e.g. to preview the date label). */
  onScrub?: (monday: string) => void;
  /** Breaks from /calendars/{shared}; summer is shaded more lightly. */
  breaks?: RulerBreak[];
  /** The current week (demo date): the one ember mark on the ruler. */
  current?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * 10B week ruler (DESIGN.md §3.5): one tick per Monday, breaks shaded, gray only, with ember just for
 * the current-week marker. Click or drag to scrub; ←/→ step a week, PageUp/PageDown four, Home/End
 * jump to the ends. Emits settled-week changes only.
 */
export function WeekRuler({ mondays, value, onChange, onScrub, breaks = [], current, disabled, ...aria }: WeekRulerProps) {
  const n = mondays.length;
  const span = Math.max(n - 1, 1);
  const valueIndex = Math.max(0, mondays.indexOf(toMonday(value)));
  const [pending, setPending] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const shown = pending ?? valueIndex;

  useEffect(() => { setPending(null); }, [value]);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const bands = useMemo(() => breaks.map(b => {
    const a = mondays.findIndex(m => addWeeks(m, 1) > b.start);
    let z = -1;
    mondays.forEach((m, i) => { if (m <= b.end) z = i; });
    return a < 0 || z < a ? null : { a, z, kind: b.kind ?? 'break' };
  }).filter(Boolean) as { a: number; z: number; kind: 'break' | 'summer' }[], [breaks, mondays]);

  const months = useMemo(() => mondays
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => i === 0 || m.slice(5, 7) !== mondays[i - 1].slice(5, 7)), [mondays]);

  const indexAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / (r.width || 1))) * span);
  };
  const preview = (i: number) => { setPending(i); onScrub?.(mondays[i]); };
  const commit = (i: number) => {
    window.clearTimeout(settle.current);
    if (mondays[i] !== mondays[valueIndex]) onChange(mondays[i]);
    else setPending(null);
  };
  const commitLater = (i: number) => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => commit(i), durMs('slow'));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || !n || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    setDragging(true);
    preview(indexAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!n) return;
    const i = indexAt(e.clientX);
    if (dragging) { if (i !== pending) preview(i); } else setHover(i);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    commit(indexAt(e.clientX));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !n) return;
    const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
    let i: number | null = null;
    if (e.key in steps) i = Math.max(0, Math.min(n - 1, shown + steps[e.key]));
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    if (i == null) return;
    e.preventDefault();
    preview(i);
    commitLater(i);
  };

  const x = (i: number) => ({ '--k-x': i / span } as CSSProperties);
  const currentIndex = current ? mondays.indexOf(toMonday(current)) : -1;

  return (
    <div
      className={['k-ruler', 'k-focus', dragging ? 'is-dragging' : '', disabled ? 'is-disabled' : ''].join(' ').trim()}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={aria['aria-label'] ?? 'Week of the school year'}
      aria-valuemin={0}
      aria-valuemax={Math.max(n - 1, 0)}
      aria-valuenow={shown}
      aria-valuetext={n ? fmtWeek(mondays[shown]) : undefined}
      aria-disabled={disabled || undefined}
      data-testid="week-ruler"
      data-value={n ? mondays[shown] : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div className="k-ruler__track" ref={trackRef}>
        {bands.map(b => (
          <span
            key={`${b.a}-${b.z}`}
            className={`k-ruler__band k-ruler__band--${b.kind}`}
            style={{ '--k-a': (b.a - 0.5) / span, '--k-b': (b.z + 0.5) / span } as CSSProperties}
          />
        ))}
        <span className="k-ruler__base" />
        {mondays.map((m, i) => (
          <span key={m} className={['k-ruler__tick', m.slice(8) <= '07' ? 'is-month' : ''].join(' ').trim()} style={x(i)} />
        ))}
        {hover != null && !dragging && hover !== shown && <span className="k-ruler__ghost" style={x(hover)} />}
        {currentIndex >= 0 && <span className="k-ruler__current" style={x(currentIndex)} title={`This week: ${fmtWeek(mondays[currentIndex])}`} />}
        {n > 0 && <span className="k-ruler__handle" style={x(shown)} />}
      </div>
      <div className="k-ruler__labels" aria-hidden="true">
        {months.map(({ m, i }) => <span key={m} className="k-ruler__month" style={x(i)}>{fmtMonth(m)}</span>)}
      </div>
    </div>
  );
}
