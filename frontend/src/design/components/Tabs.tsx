import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { tr, useReduce } from '../motion';
import './Tabs.css';

export interface ChoiceOption<T extends string> {
  id: T;
  label: ReactNode;
  /** A plain tabular count after the label. */
  count?: number;
  disabled?: boolean;
}

interface ChoiceProps<T extends string> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (id: T) => void;
  'aria-label': string;
  className?: string;
}

/** Arrow keys / Home / End move between options (roving tabindex). */
function useRoving<T extends string>(options: ChoiceOption<T>[], value: T, onChange: (id: T) => void) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = options.filter(o => !o.disabled);
    const i = enabled.findIndex(o => o.id === value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = enabled[next].id;
    onChange(id);
    refs.current.get(id)?.focus();
  };
  const ref = (id: T) => (el: HTMLButtonElement | null) => { if (el) refs.current.set(id, el); else refs.current.delete(id); };
  return { onKeyDown, ref };
}

function Label({ label, count }: { label: ReactNode; count?: number }) {
  return (
    <>
      <span className="k-choice__label">{label}</span>
      {count != null && <span className="k-choice__count k-num">{count.toLocaleString('en-US')}</span>}
    </>
  );
}

/** Tabs: an underline indicator that moves between tabs with layoutId over --motion-base. */
export function Tabs<T extends string>({ options, value, onChange, className, ...aria }: ChoiceProps<T>) {
  const layoutId = `k-tabs-${useId()}`;
  const reduce = useReduce();
  const { onKeyDown, ref } = useRoving(options, value, onChange);
  return (
    <div role="tablist" aria-label={aria['aria-label']} className={['k-tabs', className ?? ''].join(' ').trim()} onKeyDown={onKeyDown}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={ref(o.id)}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            data-option={o.id}
            className={['k-tabs__tab', 'k-focus', on ? 'is-on' : ''].join(' ').trim()}
            onClick={() => onChange(o.id)}
          >
            <Label label={o.label} count={o.count} />
            {on && <motion.span layoutId={layoutId} className="k-tabs__bar" transition={reduce ? { duration: 0 } : tr('base')} />}
          </button>
        );
      })}
    </div>
  );
}

/** SegmentedControl: a filter ("Ready 9 | All 85"). The pale thumb slides between options with layoutId. */
export function SegmentedControl<T extends string>({ options, value, onChange, className, ...aria }: ChoiceProps<T>) {
  const layoutId = `k-seg-${useId()}`;
  const reduce = useReduce();
  const { onKeyDown, ref } = useRoving(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={aria['aria-label']} className={['k-seg', className ?? ''].join(' ').trim()} onKeyDown={onKeyDown}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={ref(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            data-option={o.id}
            className={['k-seg__opt', 'k-focus', on ? 'is-on' : ''].join(' ').trim()}
            onClick={() => onChange(o.id)}
          >
            {on && <motion.span layoutId={layoutId} className="k-seg__thumb" transition={reduce ? { duration: 0 } : tr('base')} />}
            <Label label={o.label} count={o.count} />
          </button>
        );
      })}
    </div>
  );
}
