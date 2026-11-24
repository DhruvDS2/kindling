import {
  createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { durMs, tr, useReduce } from '../motion';
import { Button } from './Button';
import { ArrowRight, ChevronLeft, ChevronRight, Close } from './icons';
import './Drawer.css';

export interface DrawerPager {
  /** 0-based position in the list the rep came from. */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** What the list is, e.g. "at risk" → "2 of 4 at risk". */
  label?: string;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** The record's name. Rises through its own clip on open; swaps in place on pager change. */
  title: ReactNode;
  /** The decision line under the name (score, status, meter). Rises with the title. */
  meta?: ReactNode;
  /** 4C: "2 of 4" with ‹ › and j/k (and ↑/↓). */
  pager?: DrawerPager;
  /** Changes when the pager moves to another record: the body cross-fades, the panel doesn't re-wipe. */
  contentKey?: string;
  /** Footer actions (e.g. Send to #customer-success, Mark contacted). */
  footer?: ReactNode;
  /** "Next school →": does what j does. Pass undefined on the last record to hide it. */
  nextLink?: { label?: string; onClick: () => void };
  /** Where focus returns on close. Default: whatever had focus when the drawer opened (the row). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Accessible name when `title` isn't plain text. */
  'aria-label'?: string;
}

const DrawerIntro = createContext(false);

/**
 * A generic right-side panel (DESIGN.md §3.1, Preymaker motion adapted):
 * open = clip wipe `inset(0 0 0 100%) → inset(0)` over --motion-slow, enter easing; scrim fades over
 * --motion-base; close = the wipe retracts to the right over --motion-base, exit easing, and pointer
 * events are cleared at once so the list responds immediately. Reduced motion: opacity only.
 * Focus is trapped while open, Esc closes, and focus returns to where it came from.
 */
export function Drawer(props: DrawerProps) {
  const { open, returnFocusRef } = props;
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (open && !wasOpen.current) returnTo.current = (document.activeElement as HTMLElement | null) ?? null;
    if (!open && wasOpen.current) {
      const el = returnFocusRef?.current ?? returnTo.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, [open]);

  return createPortal(
    <AnimatePresence>{open && <DrawerPanel key="drawer" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function DrawerPanel({ onClose, title, meta, pager, contentKey, footer, nextLink, children, ...aria }: DrawerProps) {
  const reduce = useReduce();
  const present = useIsPresent();
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setIntro(false), durMs('slow'));
    return () => window.clearTimeout(t);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const editable = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab') {
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = nodes ? Array.from(nodes).filter(n => n.offsetParent !== null) : [];
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (!pager || editable || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'j' || e.key === 'ArrowDown') && pager.index < pager.total - 1) { e.preventDefault(); e.stopPropagation(); pager.onNext(); }
    if ((e.key === 'k' || e.key === 'ArrowUp') && pager.index > 0) { e.preventDefault(); e.stopPropagation(); pager.onPrev(); }
  };

  // Closing: pointer events off immediately (Preymaker), so the list behind responds at once.
  const pointer = present ? 'auto' : 'none';
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: tr('base', 'enter') }, exit: { opacity: 0, transition: tr('base', 'exit') } }
    : {
        initial: { clipPath: 'inset(0% 0% 0% 100%)' },
        animate: { clipPath: 'inset(0% 0% 0% 0%)', transition: tr('slow', 'enter') },
        exit: { clipPath: 'inset(0% 0% 0% 100%)', transition: tr('base', 'exit') },
      };
  const rise = reduce ? {} : { initial: { y: '100%' }, animate: { y: '0%', transition: tr('slow', 'enter') } };

  return (
    <div className="k-drawer-root">
      <motion.div
        className="k-drawer__scrim"
        style={{ pointerEvents: pointer }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: tr('base', 'enter') }}
        exit={{ opacity: 0, transition: tr('base', 'exit') }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={aria['aria-label'] ? undefined : titleId}
        aria-label={aria['aria-label']}
        tabIndex={-1}
        className="k-drawer"
        data-drawer=""
        style={{ pointerEvents: pointer }}
        onKeyDown={onKeyDown}
        {...panelMotion}
      >
        <header className="k-drawer__head">
          <div className="k-drawer__bar">
            {pager ? (
              <div className="k-drawer__pager">
                <Button variant="quiet" size="sm" aria-label="Previous" icon={<ChevronLeft />} disabled={pager.index <= 0} onClick={pager.onPrev} />
                <Button variant="quiet" size="sm" aria-label="Next" icon={<ChevronRight />} disabled={pager.index >= pager.total - 1} onClick={pager.onNext} />
                <span className="k-drawer__count k-num" aria-live="polite">
                  {pager.index + 1} of {pager.total}{pager.label ? ` ${pager.label}` : ''}
                </span>
                <span className="k-drawer__keys" aria-hidden="true">j / k</span>
              </div>
            ) : <span />}
            <Button variant="quiet" size="sm" aria-label="Close" icon={<Close />} shortcut="Esc" onClick={onClose} />
          </div>
          <div className="k-drawer__clip">
            <motion.h2 id={titleId} className="k-drawer__title" {...rise}>{title}</motion.h2>
          </div>
          {meta && (
            <div className="k-drawer__clip">
              <motion.div className="k-drawer__meta" {...rise}>{meta}</motion.div>
            </div>
          )}
        </header>
        <DrawerIntro.Provider value={intro && !reduce}>
          <Hairline />
          <div className="k-drawer__body">
            <AnimatePresence initial={false}>
              <motion.div
                key={contentKey ?? 'body'}
                className="k-drawer__page"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: tr('base', 'enter') }}
                exit={{ opacity: 0, transition: tr('base', 'exit') }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          {(footer || nextLink) && (
            <footer className="k-drawer__foot">
              <div className="k-drawer__foot-actions">{footer}</div>
              {nextLink && (
                <Button variant="quiet" iconAfter={<ArrowRight />} onClick={nextLink.onClick}>{nextLink.label ?? 'Next school'}</Button>
              )}
            </footer>
          )}
        </DrawerIntro.Provider>
      </motion.section>
    </div>
  );
}

/** A hairline that grows from its left edge while the drawer opens (static otherwise). */
function Hairline() {
  const intro = useContext(DrawerIntro);
  return (
    <motion.div
      className="k-drawer__rule"
      aria-hidden="true"
      initial={intro ? { scaleX: 0 } : false}
      animate={{ scaleX: 1, transition: tr('slow', 'enter') }}
    />
  );
}

/** A titled block inside the drawer body, separated by a hairline that grows on open. */
export function DrawerSection({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="k-drawer__section">
      <Hairline />
      {(title || aside) && (
        <div className="k-drawer__section-head">
          {title && <h3 className="k-drawer__section-title">{title}</h3>}
          {aside && <div className="k-drawer__section-aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
