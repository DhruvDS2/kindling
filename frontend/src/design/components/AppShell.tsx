import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { tr, useReduce } from '../motion';
import './AppShell.css';

export interface NavItem {
  id: string;
  label: string;
  /** A plain tabular count (e.g. schools ready this week). null/undefined hides it; 0 shows "0". */
  count?: number | null;
}
export interface NavGroup {
  id: string;
  /** Sentence-case group label; omit for the first, ungrouped block. */
  label?: string;
  items: NavItem[];
}

export interface NavProps {
  groups: NavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Product mark + name at the top. */
  brand?: ReactNode;
  /** Quiet status at the bottom, e.g. "Alerts sent Nov 17". */
  footer?: ReactNode;
  'aria-label'?: string;
}

/**
 * 1A grouped sidebar. One soft highlight travels between hovered items (8A, motion layoutId,
 * --motion-fast); the active item keeps its own background and ink text. Counts are plain numbers.
 */
export function Nav({ groups, activeId, onSelect, brand, footer, ...aria }: NavProps) {
  const [hover, setHover] = useState<string | null>(null);
  const reduce = useReduce();
  return (
    <nav className="k-nav" aria-label={aria['aria-label'] ?? 'Main'} onPointerLeave={() => setHover(null)}>
      {brand && <div className="k-nav__brand">{brand}</div>}
      <div className="k-nav__groups">
        {groups.map(g => (
          <div className="k-nav__group" key={g.id} role="group" aria-label={g.label}>
            {g.label && <div className="k-nav__group-label">{g.label}</div>}
            {g.items.map(item => {
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-nav={item.id}
                  aria-current={active ? 'page' : undefined}
                  className={['k-nav__item', 'k-focus', active ? 'is-active' : ''].join(' ').trim()}
                  onClick={() => onSelect(item.id)}
                  onPointerEnter={() => setHover(item.id)}
                >
                  <AnimatePresence>
                    {hover === item.id && (
                      <motion.span
                        layoutId="k-nav-hover"
                        className="k-nav__hover"
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reduce ? { duration: 0, opacity: tr('fast') } : tr('fast')}
                      />
                    )}
                  </AnimatePresence>
                  <span className="k-nav__label">{item.label}</span>
                  {item.count != null && <span className="k-nav__count k-num">{item.count.toLocaleString('en-US')}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {footer && <div className="k-nav__footer">{footer}</div>}
    </nav>
  );
}

export interface TopBarProps {
  title: ReactNode;
  /** One narrative line under the title, built from API numbers. */
  subtitle?: ReactNode;
  /** The date control (WeekPager), plus anything quiet such as <UpdatingMark>. */
  actions?: ReactNode;
  /** Full-width row under the title, e.g. the WeekRuler. */
  below?: ReactNode;
}

/** The top bar: display-size title, one narrative line, the date control on the right. */
export function TopBar({ title, subtitle, actions, below }: TopBarProps) {
  return (
    <header className="k-topbar">
      <div className="k-topbar__row">
        <div className="k-topbar__titles">
          <h1 className="k-topbar__title">{title}</h1>
          {subtitle && <p className="k-topbar__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="k-topbar__actions">{actions}</div>}
      </div>
      {below && <div className="k-topbar__below">{below}</div>}
    </header>
  );
}

/** Sidebar + main column. The sidebar stays in view while the page scrolls. */
export function AppShell({ nav, topBar, children }: { nav: ReactNode; topBar?: ReactNode; children: ReactNode }) {
  return (
    <div className="k-shell">
      <aside className="k-shell__side">{nav}</aside>
      <main className="k-shell__main">
        {topBar}
        <div className="k-shell__content">{children}</div>
      </main>
    </div>
  );
}
