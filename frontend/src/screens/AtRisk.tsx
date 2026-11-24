// At risk: paying schools with a renewal ahead, on the base Table (2A) like Ready. Filter
// "At risk N | All N", sort, j/k/↵ / Esc, 8B row actions, 9A first-load fill, and on a week
// change rows slide to their new rank and newly at-risk rows tint once (§3.2). The open
// school (?school=) is the drawer; it pages through the rows shown here, in this order.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchHealth, notifySlack } from '../api';
import { useAsOf } from '../asOf';
import { fmtDay } from '../nav';
import type { HealthScore } from '../types';
import AccountDetail from '../components/AccountDetail';
import { EnsureToasts, useOptionalToast } from '../components/detail/toasts';
import { DrawerListContext, type DrawerList } from '../drawerList';
import {
  Button, EmptyState, ErrorState, Kbd, NumberFlow, SearchField, SegmentedControl, Table,
  type RowAction, type SortState, type TableDivider,
} from '../design';
import { place, riskColumns } from './risk/columns';
import './risk/risk.css';

interface Props {
  schoolId: string | null;                      // the open drawer (?school=…)
  onSelectSchool: (schoolId: string | null) => void;
}

type Filter = 'risk' | 'all';

const DEFAULT_SORT: SortState = { columnId: 'health', direction: 'asc' };
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function AtRisk(props: Props) {
  return <EnsureToasts><AtRiskScreen {...props} /></EnsureToasts>;
}

function AtRiskScreen({ schoolId, onSelectSchool }: Props) {
  const { asOf, setAsOf, meta } = useAsOf();
  const threshold = meta.thresholds.health_at_risk_below;
  const toast = useOptionalToast();
  // Keep last week's rows on screen while a new week loads: no skeletons after first load (§3.2).
  const q = useQuery({ queryKey: ['health', asOf], queryFn: () => fetchHealth(asOf), placeholderData: keepPreviousData });
  const data = q.data;

  const [picked, setPicked] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [linkedSchool] = useState(schoolId);   // a school opened from a link or the brief, which may be Healthy
  const search = useRef<HTMLInputElement>(null);

  // Lowest health first; ties go to the sooner renewal. The one at-risk rule is the API's status.
  const ranked = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.health_score - b.health_score || a.days_to_renewal - b.days_to_renewal),
    [data],
  );
  const atRisk = useMemo(() => ranked.filter(s => s.status === 'At risk'), [ranked]);
  const linkedHealthy = !!data?.some(s => s.school_id === linkedSchool && s.status !== 'At risk');
  // Default: At risk when any school is at risk, otherwise all. A linked Healthy school opens on All so its row shows.
  const filter: Filter = picked ?? (!data || (atRisk.length > 0 && !linkedHealthy) ? 'risk' : 'all');

  const columns = useMemo(() => riskColumns(threshold), [threshold]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = (filter === 'risk' ? atRisk : ranked).filter(s => !needle
      || [s.name, s.contact_name, s.contact_email, place(s)].some(v => v.toLowerCase().includes(needle)));
    const col = columns.find(c => c.id === sort.columnId);
    if (!col?.sortValue) return base;
    const dir = sort.direction === 'asc' ? 1 : -1;
    // Stable, and the same comparison the Table makes, so the drawer pages in on-screen order.
    return base.map((r, i) => ({ r, i, v: col.sortValue!(r) }))
      .sort((a, b) => (a.v < b.v ? -dir : a.v > b.v ? dir : a.i - b.i))
      .map(x => x.r);
  }, [filter, atRisk, ranked, query, columns, sort]);

  // §3.2: rows that newly fell below the line this week get one brief tint.
  const [tint, setTint] = useState<ReadonlySet<string>>(new Set());
  const seen = useRef<{ asOf: string; risk: Set<string> } | null>(null);
  useEffect(() => {
    if (!data || q.isPlaceholderData) return;
    const risk = new Set(data.filter(s => s.status === 'At risk').map(s => s.school_id));
    const last = seen.current;
    if (last && last.asOf !== asOf) {
      const crossed = [...risk].filter(id => !last.risk.has(id));
      if (crossed.length) setTint(new Set(crossed));
    }
    seen.current = { asOf, risk };
  }, [data, q.isPlaceholderData, asOf]);

  // The at-risk line, only when sorted by health and both sides are on screen.
  const dividers: TableDivider[] = useMemo(() => {
    if (sort.columnId !== 'health' || filter !== 'all') return [];
    const first = sort.direction === 'asc'
      ? visible.find(s => s.status !== 'At risk' && visible.some(r => r.status === 'At risk'))
      : visible.find(s => s.status === 'At risk' && visible.some(r => r.status !== 'At risk'));
    return first ? [{ beforeKey: first.school_id, label: `At-risk line · health ${threshold}`, tone: 'neutral' }] : [];
  }, [sort, filter, visible, threshold]);

  // The drawer keeps the row it was opened from if a week change drops the school from this
  // list (it renewed, say): the drawer then shows the new lifecycle instead of vanishing.
  const [lastRow, setLastRow] = useState<HealthScore | null>(null);
  const found = schoolId ? data?.find(s => s.school_id === schoolId) ?? null : null;
  if (found && found !== lastRow) setLastRow(found);
  const selected = found ?? (schoolId && lastRow?.school_id === schoolId ? lastRow : null);

  // Paging moves the open row too: keep it in view behind the scrim.
  useEffect(() => {
    if (!schoolId) return;
    document.querySelector(`#root tr[data-key="${CSS.escape(schoolId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [schoolId]);

  const copyEmail = useCallback(async (s: HealthScore) => {
    try {
      await navigator.clipboard.writeText(s.contact_email);
      toast?.({ message: `Copied ${s.contact_email}`, tone: 'success' });
    } catch {
      toast?.({ message: `Couldn’t copy. The address is ${s.contact_email}`, tone: 'error' });
    }
  }, [toast]);

  // Posts for real (POST /notify/slack): only ever from a click or the `s` key on a focused row.
  const sendToCs = useCallback(async (s: HealthScore) => {
    setSending(prev => new Set(prev).add(s.school_id));
    try {
      const res = await notifySlack('cs', s.school_id, asOf);
      if (!res.ok) throw new Error(res.error ?? 'Slack did not accept the message');
      toast?.({ message: `Sent ${s.name} to #customer-success.`, tone: 'success' });
    } catch (e) {
      toast?.({ message: `Couldn’t send ${s.name}: ${e instanceof Error ? e.message : String(e)}`, tone: 'error' });
    } finally {
      setSending(prev => { const next = new Set(prev); next.delete(s.school_id); return next; });
    }
  }, [asOf, toast]);

  const rowActions = useCallback((s: HealthScore): RowAction<HealthScore>[] => [
    { id: 'open', label: 'Open', shortcut: 'Enter', onSelect: r => onSelectSchool(r.school_id) },
    { id: 'copy', label: 'Copy email', shortcut: 'c', onSelect: r => { void copyEmail(r); } },
    { id: 'send', label: 'Send to #customer-success', shortcut: 's', disabled: sending.has(s.school_id), onSelect: r => { void sendToCs(r); } },
  ], [onSelectSchool, copyEmail, sendToCs, sending]);

  const drawerList: DrawerList = useMemo(() => ({
    ids: visible.map(s => s.school_id),
    label: filter === 'risk' ? 'at risk' : 'paid schools',
    open: onSelectSchool,
  }), [visible, filter, onSelectSchool]);

  const day = fmtDay(asOf);
  const arrAtRisk = atRisk.reduce((sum, s) => sum + s.arr, 0);
  const empty = query.trim()
    ? <EmptyState action={{ label: 'Clear search', onClick: () => setQuery('') }}>No {filter === 'risk' ? 'at-risk' : 'paying'} school matches “{query.trim()}”.</EmptyState>
    : filter === 'risk' && ranked.length > 0
      ? <EmptyState action={{ label: `Show all ${ranked.length} paying schools`, onClick: () => setPicked('all') }}>No paying school is at risk on {day}. Health is rescored every Monday.</EmptyState>
      : <EmptyState action={asOf !== meta.demo_as_of ? { label: 'Go to the demo date', onClick: () => setAsOf(meta.demo_as_of) } : undefined}>
          No paying school has a health score on {day}: none has a renewal ahead and a full {meta.windows.school_days}-school-day window yet.
        </EmptyState>;

  return (
    <div className="rk">
      {data && (
        <div className="rk-summary" data-testid="risk-summary">
          <p className="rk-summary__lead">
            {atRisk.length > 0 ? (
              <>
                <strong><NumberFlow value={atRisk.length} reveal={false} /></strong> of <NumberFlow value={ranked.length} reveal={false} /> paying
                schools with a renewal ahead {atRisk.length === 1 ? 'is' : 'are'} at risk,
                with <strong><NumberFlow value={arrAtRisk} reveal={false} format={usd} /></strong> ARR up for renewal.
              </>
            ) : (
              <>No paying school is at risk this week. <NumberFlow value={ranked.length} reveal={false} /> have a renewal ahead.</>
            )}
          </p>
          <p className="rk-summary__rule">
            At risk means a health score below {threshold}, read on each school’s own last {meta.windows.school_days} school days, so breaks don’t count against it.
          </p>
        </div>
      )}

      {schoolId && data && !selected && (
        <p className="rk-notice" role="status">
          <span>That school isn’t a paying school with a health score and a renewal ahead on {day}.</span>
          <Button variant="quiet" size="sm" onClick={() => onSelectSchool(null)}>Dismiss</Button>
        </p>
      )}

      <div className="rk-toolbar">
        <SegmentedControl<Filter>
          aria-label="Show"
          value={filter}
          onChange={setPicked}
          options={[
            // Counts only once scores are in: "0" while loading or after an error would be wrong.
            { id: 'risk', label: 'At risk', count: data ? atRisk.length : undefined },
            { id: 'all', label: 'All', count: data ? ranked.length : undefined },
          ]}
        />
        <SearchField ref={search} value={query} onChange={setQuery} placeholder="Find a school" />
        <span className="rk-toolbar__keys" aria-hidden="true">
          <Kbd>j</Kbd><Kbd>k</Kbd> move · <Kbd>↵</Kbd> open · <Kbd>c</Kbd> copy email · <Kbd>s</Kbd> send · <Kbd>/</Kbd> search
        </span>
      </div>

      <div data-testid="risk-table">
        <Table<HealthScore>
          aria-label={filter === 'risk' ? 'Paying schools at risk' : 'Paying schools with a renewal ahead'}
          rows={visible}
          columns={columns}
          rowKey={s => s.school_id}
          rowLabel={s => s.name}
          loading={q.isLoading && !data}
          skeletonRows={6}
          error={q.error && !data
            ? <ErrorState title={`Couldn’t load health scores for ${day}.`} detail={(q.error as Error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
            : undefined}
          empty={data ? empty : undefined}
          sort={sort}
          onSortChange={setSort}
          onOpen={s => onSelectSchool(s.school_id)}
          rowActions={rowActions}
          searchRef={search}
          keyboard="page"
          dividers={dividers}
          tintKeys={tint}
          selectedKey={schoolId}
        />
      </div>

      {selected && (
        <DrawerListContext.Provider value={drawerList}>
          <AccountDetail type="health" school={selected} onClose={() => onSelectSchool(null)} />
        </DrawerListContext.Provider>
      )}
    </div>
  );
}
