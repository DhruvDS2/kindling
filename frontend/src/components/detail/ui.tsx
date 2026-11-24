// Small building blocks shared by the school detail drawer. Tokens only (detail.css).
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorState, Skeleton, icons, tr, useReduce } from '../../design';
import './detail.css';

export function Note({ children, tone = 'tertiary', className }: { children: ReactNode; tone?: 'secondary' | 'tertiary'; className?: string }) {
  return <p className={['kd-note', tone === 'secondary' ? 'kd-note--secondary' : '', className ?? ''].join(' ').trim()}>{children}</p>;
}

/** Loading: a skeleton shaped like the chart or list it stands in for. */
export function SectionSkeleton({ lines = 0, chart }: { lines?: number; chart?: 'tall' | 'short' }) {
  return (
    <div className="kd-skeleton" aria-busy="true" aria-label="Loading">
      {chart && <span aria-hidden="true" className={`kd-skeleton__chart kd-skeleton__chart--${chart}`} />}
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={i % 2 ? '55%' : '85%'} />)}
    </div>
  );
}

/** Error: what failed, plus retry. */
export function SectionError({ what, error, onRetry, retrying }: { what: string; error: unknown; onRetry: () => void; retrying?: boolean }) {
  return (
    <ErrorState
      title={`Couldn’t load ${what}.`}
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}

/** Legend key: a short swatch beside a text-token label (text never wears the series color). */
export function Key({ swatch, line, faded, children }: { swatch: string; line?: boolean; faded?: boolean; children: ReactNode }) {
  return (
    <span className="kd-key">
      <span aria-hidden="true" className={[line ? 'kd-key__line' : 'kd-key__swatch', faded ? 'is-faded' : ''].join(' ').trim()} style={{ background: swatch }} />
      {children}
    </span>
  );
}

/** Hover card for a chart. x is the pointer's x inside a chart of the given width. */
export function ChartTip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const gap = 12;
  const side: CSSProperties = x > width / 2 ? { right: width - x + gap } : { left: x + gap };
  return <div role="tooltip" className="kd-tip" style={side}>{children}</div>;
}

export function TipRow({ label, value, swatch }: { label: string; value: ReactNode; swatch?: string }) {
  return (
    <div className="kd-tip__row">
      <span className="kd-tip__label">
        {swatch && <span aria-hidden="true" className="kd-key__swatch" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="kd-tip__value k-num">{value}</span>
    </div>
  );
}

/** A collapsed block: a quiet row that opens with a height animation over --motion-base. */
export function Disclosure({ label, hint, children, testId }: { label: ReactNode; hint?: ReactNode; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReduce();
  const id = useId();
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: tr('base') }, exit: { opacity: 0, transition: tr('fast', 'exit') } }
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: 'auto', opacity: 1, transition: tr('base') },
        exit: { height: 0, opacity: 0, transition: tr('base', 'exit') },
      };
  return (
    <div className="kd-disclosure" data-testid={testId}>
      <button type="button" className="kd-disclosure__btn k-focus" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <icons.ChevronRight className={['kd-disclosure__chev', open ? 'is-open' : ''].join(' ').trim()} />
        <span className="kd-disclosure__label">{label}</span>
        {hint && <span className="kd-disclosure__hint">{hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} key="body" className="kd-disclosure__body" {...motionProps}>
            <div className="kd-disclosure__inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
