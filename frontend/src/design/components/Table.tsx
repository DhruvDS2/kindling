import {
  Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import { motion } from 'motion/react';
import { dur, durMs, stagger, tr, useReduce } from '../motion';
import { Skeleton } from './Skeleton';
import { ChevronDown, ChevronUp } from './icons';
import './Table.css';

export type SortDirection = 'asc' | 'desc';
export interface SortState { columnId: string; direction: SortDirection }

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right-aligned with tabular figures. Use for every metric. */
  numeric?: boolean;
  /** A percentage or token, e.g. '32%' or 'var(--size-meter)'. Columns without one share the rest. */
  width?: string;
  /** Makes the column sortable (aria-sort). */
  sortValue?: (row: T) => number | string;
  /** First-click direction. Default: desc for numeric columns, asc otherwise. */
  firstDirection?: SortDirection;
  /** Skeleton shape: bar width per line. Default '60%'. false = no bar. */
  skeleton?: string | false;
  /** Two skeleton lines (name + place). */
  skeletonLines?: 1 | 2;
}

export interface RowAction<T> {
  id: string;
  label: string;
  /** Single key that runs the action on the focused row: 'c' copies, 's' sends (DESIGN.md §3.4). */
  shortcut?: string;
  onSelect: (row: T) => void;
  disabled?: boolean;
}

export interface TableDivider {
  /** The divider sits immediately above this row. */
  beforeKey: string;
  label: ReactNode;
  /** accent: "the ready line" (ember mark). neutral: any other line. */
  tone?: 'accent' | 'neutral';
}

export interface TableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  'aria-label': string;
  /** First load only: skeleton rows until data first arrives. After that the table never shows
   *  skeletons again (DESIGN.md §3.2): keep passing the previous rows while a new week loads. */
  loading?: boolean;
  skeletonRows?: number;
  /** Shown in place of rows when there are none: an <ErrorState>. */
  error?: ReactNode;
  /** Shown when there are no rows: an <EmptyState>. */
  empty?: ReactNode;
  /** Controlled sort; omit both to let the table sort by `defaultSort`. */
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (s: SortState) => void;
  /** ↵ or click. */
  onOpen?: (row: T) => void;
  /** The 8B pale action group, at the right of a row on hover or keyboard focus. */
  rowActions?: (row: T) => RowAction<T>[];
  /** `/` focuses this input. */
  searchRef?: RefObject<HTMLInputElement | null>;
  /** 'page': j/k/↵ work anywhere on the page (not in inputs or dialogs). 'table': only with focus inside. */
  keyboard?: 'table' | 'page';
  dividers?: TableDivider[];
  /** Rows that newly crossed a line this week get one brief tint. Pass a new Set to replay. */
  tintKeys?: ReadonlySet<string>;
  /** The open row (drawer). */
  selectedKey?: string | null;
  /** Accessible row name, e.g. the school name. */
  rowLabel?: (row: T) => string;
  /** Called when keyboard focus moves to a row (j/k), e.g. to sync a drawer pager. */
  onActiveChange?: (row: T | null) => void;
  /** CSS length for the sticky header offset. Default 0. */
  stickyTop?: string;
  /** Reserve width for the row actions instead of floating them over the row's right end. */
  reserveActions?: boolean;
  /** Styleguide only: force the hover look on a row key. */
  forceHoverKey?: string;
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * 2A columned table (DESIGN.md §6 Table): sticky header, sortable columns, right-aligned numbers,
 * j/k ↑/↓ ↵ Esc / keyboard, the 8A travelling row highlight, 8B row actions, 9A skeleton rows that
 * fill in reading order on first load only, and layout-animated reorder when the week changes (§3.2).
 */
export function Table<T>(props: TableProps<T>) {
  const {
    rows, columns, rowKey, loading, skeletonRows = 8, error, empty, sort: sortProp, defaultSort = null, onSortChange,
    onOpen, rowActions, searchRef, keyboard = 'table', dividers, tintKeys, selectedKey, rowLabel, onActiveChange,
    stickyTop, reserveActions, forceHoverKey,
  } = props;
  const reduce = useReduce();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sortState, setSortState] = useState<SortState | null>(defaultSort);
  const sort = sortProp !== undefined ? sortProp : sortState;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);

  // ── First load: skeletons until data first arrives, then one reading-order reveal. ──
  const shownData = useRef(false);
  const [revealing, setRevealing] = useState(false);
  const hasRows = rows.length > 0;
  const showSkeleton = !!loading && !shownData.current && !hasRows;
  useLayoutEffect(() => {
    if (shownData.current || !hasRows) return;
    shownData.current = true;
    if (reduce) return;
    setRevealing(true);
    const t = window.setTimeout(() => setRevealing(false), durMs('reveal') + stagger('row') * 1000 * 10);
    return () => window.clearTimeout(t);
  }, [hasRows, reduce]);

  // ── Sorting (stable). ──
  const sorted = useMemo(() => {
    const col = sort && columns.find(c => c.id === sort.columnId);
    if (!col?.sortValue) return rows;
    const dir = sort!.direction === 'asc' ? 1 : -1;
    return rows
      .map((r, i) => ({ r, i, v: col.sortValue!(r) }))
      .sort((a, b) => (a.v < b.v ? -dir : a.v > b.v ? dir : a.i - b.i))
      .map(x => x.r);
  }, [rows, columns, sort]);
  const keys = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);

  const toggleSort = (c: Column<T>) => {
    const first = c.firstDirection ?? (c.numeric ? 'desc' : 'asc');
    const next: SortState = sort?.columnId === c.id
      ? { columnId: c.id, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
      : { columnId: c.id, direction: first };
    if (sortProp === undefined) setSortState(next);
    onSortChange?.(next);
  };

  // ── Keyboard. ──
  const rowEl = useCallback((key: string) =>
    wrapRef.current?.querySelector<HTMLTableRowElement>(`tr[data-key="${CSS.escape(key)}"]`) ?? null, []);
  const focusRow = useCallback((key: string) => {
    setActiveKey(key);
    const el = rowEl(key);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
    const row = sorted[keys.indexOf(key)];
    onActiveChange?.(row ?? null);
  }, [rowEl, sorted, keys, onActiveChange]);

  const handleKey = useCallback((e: KeyboardEvent | ReactKeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (isEditable(target)) return;
    if (target?.closest('[role="dialog"]')) return;
    if (e.key === '/' && searchRef?.current) { e.preventDefault(); searchRef.current.focus(); return; }
    if (!keys.length) return;
    const current = activeKey && keys.includes(activeKey) ? keys.indexOf(activeKey) : -1;
    const inButton = target?.closest('button') && wrapRef.current?.contains(target);
    switch (e.key) {
      case 'j': case 'ArrowDown':
        e.preventDefault(); focusRow(keys[Math.min(current + 1, keys.length - 1)]); return;
      case 'k': case 'ArrowUp':
        e.preventDefault(); focusRow(keys[Math.max(current - 1, 0)]); return;
      case 'Enter':
        if (inButton || current < 0) return;
        e.preventDefault(); onOpen?.(sorted[current]); return;
      case 'Escape':
        if (current < 0) return;
        e.preventDefault(); setActiveKey(null); (document.activeElement as HTMLElement | null)?.blur(); onActiveChange?.(null); return;
      default: {
        if (current < 0 || !rowActions || e.key.length !== 1) return;
        const action = rowActions(sorted[current]).find(a => a.shortcut?.toLowerCase() === e.key.toLowerCase() && !a.disabled);
        if (action) { e.preventDefault(); action.onSelect(sorted[current]); }
      }
    }
  }, [keys, activeKey, focusRow, onOpen, rowActions, sorted, searchRef, onActiveChange]);

  useEffect(() => {
    if (keyboard !== 'page' && !searchRef) return;
    const onDoc = (e: KeyboardEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;  // handled by the table itself
      if (keyboard === 'page') handleKey(e);
      else if (e.key === '/' && !isEditable(e.target) && searchRef?.current && !(e.target as HTMLElement)?.closest?.('[role="dialog"]')) {
        e.preventDefault(); searchRef.current.focus();
      }
    };
    document.addEventListener('keydown', onDoc);
    return () => document.removeEventListener('keydown', onDoc);
  }, [keyboard, handleKey, searchRef]);

  // ── Tint rows that newly crossed a line (one brief fade, replayed per new Set). ──
  useEffect(() => {
    if (!tintKeys?.size) return;
    for (const k of tintKeys) {
      const el = rowEl(k);
      if (!el) continue;
      delete el.dataset.crossed;
      void el.offsetWidth;
      el.dataset.crossed = '';
      el.addEventListener('animationend', () => { delete el.dataset.crossed; }, { once: true });
    }
  }, [tintKeys, rowEl]);

  // ── 8A: one soft highlight that travels to the hovered (or keyboard-active) row. ──
  const highlightKey = forceHoverKey ?? hoverKey ?? (focusWithin ? activeKey : null);
  const [hl, setHl] = useState<{ y: number; h: number; on: boolean; jump: boolean }>({ y: 0, h: 0, on: false, jump: true });
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = highlightKey ? rowEl(highlightKey) : null;
    if (!wrap || !el) { setHl(p => (p.on ? { ...p, on: false, jump: true } : p)); return; }
    const y = el.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
    setHl(p => ({ y, h: el.offsetHeight, on: true, jump: !p.on }));
  }, [highlightKey, rowEl, sorted]);

  const colCount = columns.length + (rowActions ? 1 : 0);
  const dividerAt = new Map((dividers ?? []).map(d => [d.beforeKey, d]));
  const layoutTransition = reduce ? { duration: 0 } : tr('slow', 'enter');

  return (
    <div
      ref={wrapRef}
      className={['k-table-wrap', revealing ? 'is-revealing' : ''].join(' ').trim()}
      style={stickyTop ? ({ '--k-sticky-top': stickyTop } as CSSProperties) : undefined}
      onKeyDown={e => handleKey(e)}
      onFocus={() => setFocusWithin(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false); }}
      onPointerLeave={() => setHoverKey(null)}
    >
      <motion.div
        className="k-table__hl"
        aria-hidden="true"
        initial={false}
        animate={{ y: hl.y, height: hl.h, opacity: hl.on ? 1 : 0 }}
        transition={{
          y: hl.jump || reduce ? { duration: 0 } : tr('fast'),
          height: hl.jump || reduce ? { duration: 0 } : tr('fast'),
          opacity: tr('fast'),
        }}
      />
      <table className="k-table" aria-label={props['aria-label']} aria-busy={showSkeleton || undefined}>
        <colgroup>
          {columns.map(c => <col key={c.id} style={c.width ? { width: c.width } : undefined} />)}
          {rowActions && <col className={reserveActions ? 'k-table__actions-col--reserve' : 'k-table__actions-col'} />}
        </colgroup>
        <thead>
          <tr>
            {columns.map(c => {
              const on = sort?.columnId === c.id;
              const ariaSort = c.sortValue ? (on ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
              return (
                <th key={c.id} scope="col" aria-sort={ariaSort} className={c.numeric ? 'is-num' : undefined}>
                  {c.sortValue ? (
                    <button type="button" className={['k-table__sort', 'k-focus', on ? 'is-on' : ''].join(' ').trim()} onClick={() => toggleSort(c)}>
                      <span>{c.header}</span>
                      <span className="k-table__sort-icon" aria-hidden="true">
                        {on && sort!.direction === 'asc' ? <ChevronUp small /> : <ChevronDown small />}
                      </span>
                    </button>
                  ) : c.header}
                </th>
              );
            })}
            {rowActions && <th scope="col" className="k-table__actions-th"><span className="k-sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody
          onPointerMove={e => {
            const tr = (e.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-key]');
            setHoverKey(tr?.dataset.key ?? null);
          }}
        >
          {showSkeleton && Array.from({ length: skeletonRows }, (_, i) => (
            <tr key={`sk-${i}`} className="k-table__skeleton-row" aria-hidden="true">
              {columns.map(c => (
                <td key={c.id} className={c.numeric ? 'is-num' : undefined}>
                  {c.skeleton !== false && (
                    <div className={['k-table__skeleton', c.numeric ? 'is-num' : ''].join(' ').trim()}>
                      <Skeleton width={c.skeleton || '60%'} />
                      {c.skeletonLines === 2 && <Skeleton width="40%" height="label" />}
                    </div>
                  )}
                </td>
              ))}
              {rowActions && <td />}
            </tr>
          ))}

          {!showSkeleton && sorted.length === 0 && (error || empty) && (
            <tr className="k-table__message-row">
              <td colSpan={colCount}>{error ?? empty}</td>
            </tr>
          )}

          {!showSkeleton && sorted.map((row, i) => {
            const key = keys[i];
            const divider = dividerAt.get(key);
            const actions = rowActions?.(row) ?? [];
            const label = rowLabel?.(row);
            return (
              <Fragment key={key}>
                {divider && (
                  <motion.tr layout="position" transition={layoutTransition} className={`k-table__divider k-table__divider--${divider.tone ?? 'accent'}`}>
                    <td colSpan={colCount}>
                      <div className="k-table__divider-inner">
                        <span className="k-table__divider-label">{divider.label}</span>
                        <span className="k-table__divider-rule" aria-hidden="true" />
                      </div>
                    </td>
                  </motion.tr>
                )}
                <motion.tr
                  layout={revealing ? false : 'position'}
                  transition={layoutTransition}
                  data-key={key}
                  tabIndex={key === activeKey || (activeKey == null && i === 0) ? 0 : -1}
                  aria-label={label}
                  aria-current={key === selectedKey ? 'true' : undefined}
                  className={['k-table__row', onOpen ? 'is-openable' : '', key === selectedKey ? 'is-selected' : '', key === forceHoverKey ? 'is-hover' : ''].join(' ').trim()}
                  style={{ '--k-i': Math.min(i, 10) } as CSSProperties}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('button, a, input')) return;
                    setActiveKey(key);
                    onOpen?.(row);
                  }}
                  onFocus={() => { if (activeKey !== key) { setActiveKey(key); onActiveChange?.(row); } }}
                >
                  {columns.map((c, j) => (
                    <td key={c.id} className={c.numeric ? 'is-num k-num' : undefined} style={{ '--k-j': j } as CSSProperties}>
                      {c.cell(row, i)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className={['k-table__actions', reserveActions ? 'is-reserved' : ''].join(' ').trim()}>
                      {actions.length > 0 && (
                        <div className="k-rowactions">
                          <div className="k-rowactions__group" role="group" aria-label={label ? `Actions for ${label}` : 'Row actions'}>
                          {actions.map(a => (
                            <button
                              key={a.id}
                              type="button"
                              className="k-rowactions__btn k-focus"
                              disabled={a.disabled}
                              aria-keyshortcuts={a.shortcut}
                              onClick={e => { e.stopPropagation(); setActiveKey(key); a.onSelect(row); }}
                            >
                              {a.label}
                              {a.shortcut && <kbd className="k-rowactions__kbd">{a.shortcut === 'Enter' ? '↵' : a.shortcut.toUpperCase()}</kbd>}
                            </button>
                          ))}
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                </motion.tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Seconds for the first-load reveal of `rows` rows (for callers that sequence after it). */
export function revealSeconds(rows: number) {
  return dur('base') + Math.min(rows, 10) * stagger('row');
}
