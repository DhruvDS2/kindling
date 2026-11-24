import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dur, icons, tr, useReduce } from '../../design';

/**
 * An editorial section: a hairline, then the title and a short intro in the left rail,
 * the content to the right (stacked on narrow screens).
 */
export function Section({ id, title, intro, children }: {
  id: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `bt-${id}-title`;
  return (
    <section className="bt-section" aria-labelledby={headingId} data-section={id}>
      <div className="bt-section__head">
        <h2 id={headingId} className="bt-section__title">{title}</h2>
        {intro && <div className="bt-section__intro">{intro}</div>}
      </div>
      <div className="bt-section__body">{children}</div>
    </section>
  );
}

/**
 * A disclosure row: a title and a one-sentence takeaway; the full tables open underneath
 * with a height animation over --motion-base (an opacity fade only with reduced motion).
 */
export function Disclosure({ title, takeaway, tag, children, id }: {
  title: ReactNode;
  takeaway?: ReactNode;
  tag?: string;
  children: ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReduce();
  const panelId = useId();
  return (
    <div className={open ? 'bt-disclosure is-open' : 'bt-disclosure'} data-disclosure={id}>
      <button
        type="button"
        className="bt-disclosure__summary k-focus"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
      >
        <span className="bt-disclosure__chevron" aria-hidden="true"><icons.ChevronRight small /></span>
        <span className="bt-disclosure__text">
          <span className="bt-disclosure__title">
            {title}
            {tag && <span className="bt-disclosure__tag">{tag}</span>}
          </span>
          {takeaway && <span className="bt-disclosure__takeaway">{takeaway}</span>}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            className="bt-disclosure__panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce
              ? { opacity: 0, transition: { duration: dur('fast') } }
              : { height: 0, opacity: 0, transition: tr('base', 'exit') }}
            transition={reduce ? { duration: dur('base') } : tr('base', 'enter')}
          >
            <div className="bt-disclosure__inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
