import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notifySlack } from '../api';
import { useAsOf } from '../asOf';
import AccountDetail from '../components/AccountDetail';
import {
  Button, EmptyState, ErrorState, Kbd, NumberFlow, ScoreMeter, SearchField, SegmentedControl, Skeleton, Table, TruncatedText,
  fmtShort, fmtWeek, useToast, type Column, type RowAction, type SortState, type TableDivider,
} from '../design';
import { DrawerListContext } from '../drawerList';
import type { PqlScore } from '../types';
import { isReady, place, useNewThisWeek, usePqlAt, weekBefore } from './ready/data';
import { ReasonsInline } from './ready/Reasons';
import { EnsureToasts } from './ready/toasts';
import './ready/ready.css';

interface Props {
  schoolId: string | null;                      // the open drawer (?school=…)
  onSelectSchool: (schoolId: string | null) => void;
}

type Filter = 'ready' | 'all';
type SortKey = 'school' | 'score' | 'teachers';

const SORTERS: Record<SortKey, (s: PqlScore) => number | string> = {
  school: s => s.name.toLowerCase(),
  score: s => s.pql_score,
  teachers: s => s.active_teachers,
};
const BY_SCORE: SortState = { columnId: 'score', direction: 'desc' };
const NONE: ReadonlySet<string> = new Set();
const rowKey = (s: PqlScore) => s.school_id;
const rowLabel = (s: PqlScore) => s.name;

/** The same stable sort the Table applies, so the drawer pager sees rows in on-screen order. */
function sortRows(rows: PqlScore[], sort: SortState): PqlScore[] {
  const by = SORTERS[sort.columnId as SortKey];
  if (!by) return rows;
  const dir = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: by(r) }))
    .sort((a, b) => (a.v < b.v ? -dir : a.v > b.v ? dir : a.i - b.i))
    .map(x => x.r);
}

function matches(s: PqlScore, q: string) {
  if (!q) return true;
  const hay = `${s.name} ${s.city} ${s.state} ${s.district ?? ''} ${s.contact_name}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

export default function ReadyToBuy(props: Props) {
  return <EnsureToasts><ReadyScreen {...props} /></EnsureToasts>;
}

function ReadyScreen({ schoolId, onSelectSchool }: Props) {
  const { asOf, setAsOf, meta } = useAsOf();
  const toast = useToast();
  const threshold = meta.thresholds.pql_ready;

  // This week, and the week before (for "new this week"). Both keep the old rows while a new week loads.
  const q = usePqlAt(asOf);
  const prevDay = weekBefore(asOf, meta);
  const prevQ = usePqlAt(prevDay);
  const data = q.data;
  const newSinceLastWeek = useNewThisWeek(data, prevQ.data, !q.isPlaceholderData && !prevQ.isPlaceholderData, isReady);
  const newThisWeek = prevDay ? newSinceLastWeek : NONE;

  const ranked = useMemo(() => [...(data ?? [])].sort((a, b) => b.pql_score - a.pql_score), [data]);
  const rank = useMemo(() => new Map(ranked.map((s, i) => [s.school_id, i + 1])), [ranked]);
  const ready = useMemo(() => ranked.filter(isReady), [ranked]);
  const selected = schoolId ? data?.find(s => s.school_id === schoolId) ?? null : null;

  // Default to the work for the week (Ready). A link that opens a school outside it starts on All instead.
  const [filterChoice, setFilter] = useState<Filter | null>(null);
  if (filterChoice === null && data && !q.isPlaceholderData) setFilter(selected && !isReady(selected) ? 'all' : 'ready');
  const filter: Filter = filterChoice ?? 'ready';

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(BY_SCORE);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => sortRows((filter === 'ready' ? ready : ranked).filter(s => matches(s, query)), sort),
    [filter, ready, ranked, query, sort],
  );

  // The Ready line sits above the first school under the threshold, only while ranked by score.
  const byScore = sort.columnId === 'score' && sort.direction === 'desc';
  const firstBelow = byScore ? visible.find(s => s.pql_score < threshold) : undefined;
  const dividers: TableDivider[] = firstBelow
    ? [{ beforeKey: firstBelow.school_id, label: `Ready line · score ${threshold}` }]
    : [];

  // §3.2: schools that crossed into Ready since the week on screen before get one brief tint.
  const [tint, setTint] = useState<ReadonlySet<string>>(NONE);
  const shownWeek = useRef<{ day: string; ready: Set<string> } | null>(null);
  useEffect(() => {
    if (!data || q.isPlaceholderData) return;
    const now = new Set(data.filter(isReady).map(s => s.school_id));
    const before = shownWeek.current;
    shownWeek.current = { day: asOf, ready: now };
    if (!before || before.day === asOf) return;
    const crossed = [...now].filter(id => !before.ready.has(id));
    if (crossed.length) setTint(new Set(crossed));
  }, [data, q.isPlaceholderData, asOf]);

  // 8B row actions. "Send to #sales" posts for real (POST /notify/slack): only ever on a click or `s`.
  const [sending, setSending] = useState<ReadonlySet<string>>(NONE);
  const copyEmail = useCallback(async (s: PqlScore) => {
    try {
      await navigator.clipboard.writeText(s.contact_email);
      toast({ message: `Copied ${s.contact_name}'s email, ${s.contact_email}`, tone: 'success' });
    } catch {
      toast({ message: `Couldn't copy. ${s.contact_name}'s email is ${s.contact_email}`, tone: 'error' });
    }
  }, [toast]);
  const sendToSales = useCallback(async (s: PqlScore) => {
    setSending(prev => new Set(prev).add(s.school_id));
    try {
      const res = await notifySlack('sales', s.school_id, asOf);
      if (res.ok) toast({ message: `Sent ${s.name} to #sales`, tone: 'success' });
      else toast({ message: `Couldn't send ${s.name} to #sales${res.error ? `: ${res.error}` : ''}`, tone: 'error' });
    } catch (e) {
      toast({ message: `Couldn't send ${s.name} to #sales: ${(e as Error).message}`, tone: 'error' });
    } finally {
      setSending(prev => { const next = new Set(prev); next.delete(s.school_id); return next; });
    }
  }, [asOf, toast]);
  const rowActions = useCallback((s: PqlScore): RowAction<PqlScore>[] => {
    const busy = sending.has(s.school_id);
    return [
      { id: 'open', label: 'Open', shortcut: 'Enter', onSelect: () => onSelectSchool(s.school_id) },
      { id: 'copy', label: 'Copy email', shortcut: 'c', onSelect: copyEmail },
      { id: 'send', label: busy ? 'Sending…' : 'Send to #sales', shortcut: 's', onSelect: sendToSales, disabled: busy },
    ];
  }, [sending, onSelectSchool, copyEmail, sendToSales]);

  const columns = useMemo<Column<PqlScore>[]>(() => [
    {
      id: 'rank', header: '#', numeric: true, width: '4%', skeleton: '50%',
      cell: s => <span className="ready-rank">{rank.get(s.school_id)}</span>,
    },
    {
      id: 'school', header: 'School', width: '22%', sortValue: SORTERS.school, skeletonLines: 2, skeleton: '70%',
      cell: s => (
        <div className="ready-cell2">
          <TruncatedText className="k-medium">{s.name}</TruncatedText>
          <div className="ready-subline">
            {newThisWeek.has(s.school_id) && <span className="ready-new">New this week ·</span>}
            <TruncatedText className="ready-sub">{place(s)}</TruncatedText>
          </div>
        </div>
      ),
    },
    {
      id: 'score', header: 'Score', width: '14%', sortValue: SORTERS.score, firstDirection: 'desc', skeleton: '80%',
      cell: s => (
        <div className="ready-score">
          <ScoreMeter value={s.pql_score} threshold={threshold} tone={isReady(s) ? 'ready' : 'neutral'} thresholdLabel={`Ready at ${threshold}`} />
          {s.ready_rule === 'admin' && <span className="ready-rule">Ready by admin rule</span>}
        </div>
      ),
    },
    {
      id: 'why', header: 'Why', skeleton: '90%', skeletonLines: 2,
      cell: s => <div className="ready-pad-sm"><ReasonsInline school={s} /></div>,
    },
    {
      id: 'teachers', header: 'Teachers', numeric: true, width: '8%', sortValue: SORTERS.teachers, skeleton: '40%',
      cell: s => <NumberFlow value={s.active_teachers} reveal={false} />,
    },
    {
      id: 'contact', header: 'Contact', width: '15%', skeletonLines: 2, skeleton: '70%',
      cell: s => (
        <div className="ready-cell2">
          <TruncatedText>{s.contact_name}</TruncatedText>
          <TruncatedText className="ready-sub">{s.contact_title}</TruncatedText>
        </div>
      ),
    },
  ], [rank, newThisWeek, threshold]);

  const day = fmtShort(asOf);
  const empty = query
    ? <EmptyState action={{ label: 'Clear search', onClick: () => setQuery('') }}>No school {filter === 'ready' ? 'ready to buy ' : ''}matches “{query}”.</EmptyState>
    : ranked.length === 0
      ? (
        <EmptyState action={asOf !== meta.demo_as_of ? { label: `Go to the demo date, ${fmtWeek(meta.demo_as_of)}`, onClick: () => setAsOf(meta.demo_as_of) } : undefined}>
          Scores start once a free school's teachers use Kindling in class.
        </EmptyState>
      )
      : (
        <EmptyState action={{ label: `Show all ${ranked.length} free schools`, onClick: () => setFilter('all') }}>
          No school is ready to buy on {day}. Scores move every Monday, so check back next week.
        </EmptyState>
      );
  const error = q.error && !data
    ? <ErrorState title={`Couldn't load readiness scores for ${day}.`} detail={(q.error as Error).message} onRetry={() => void q.refetch()} retrying={q.isFetching} />
    : undefined;

  return (
    <div className="ready">
      <header className="ready-head">
        {data ? (
          <p className="ready-summary" data-testid="ready-summary">
            {ranked.length === 0 ? (
              <>No free school has a readiness score on {day} yet.</>
            ) : (
              <>
                <strong><NumberFlow value={ready.length} reveal={false} /></strong> of{' '}
                <strong><NumberFlow value={ranked.length} reveal={false} /></strong> free schools{' '}
                {ready.length === 1 ? 'is' : 'are'} ready to buy on {day}.
              </>
            )}
          </p>
        ) : (
          <Skeleton width="40%" />
        )}
        <p className="ready-note">
          A school is ready at a score of {threshold}. Each score reads the school's own last {meta.windows.school_days} school days, so a break never counts against it.
          {ranked.some(s => s.ready_rule === 'admin') && <> An admin signup makes a school ready from {meta.thresholds.pql_admin_ready}.</>}
        </p>
      </header>

      {schoolId && data && !q.isPlaceholderData && !selected && (
        <div className="ready-notice" role="status">
          <span><span className="k-mono">{schoolId}</span> isn't a free school with a readiness score on {day}.</span>
          <Button variant="quiet" size="sm" onClick={() => onSelectSchool(null)}>Dismiss</Button>
        </div>
      )}

      <div className="ready-toolbar">
        <SegmentedControl<Filter>
          aria-label="Which schools"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'ready', label: 'Ready', count: data ? ready.length : undefined },
            { id: 'all', label: 'All', count: data ? ranked.length : undefined },
          ]}
        />
        <SearchField ref={searchRef} value={query} onChange={setQuery} placeholder="Find a school or contact" />
        <span className="ready-keys" aria-hidden="true">
          <Kbd>j</Kbd><Kbd>k</Kbd> move<span className="ready-keys__gap" /><Kbd>↵</Kbd> open<span className="ready-keys__gap" /><Kbd>/</Kbd> search
        </span>
      </div>

      <Table<PqlScore>
        aria-label={filter === 'ready' ? 'Schools ready to buy' : 'All free schools, ranked by score'}
        rows={visible}
        columns={columns}
        rowKey={rowKey}
        rowLabel={rowLabel}
        loading={q.isLoading}
        skeletonRows={8}
        error={error}
        empty={empty}
        sort={sort}
        onSortChange={setSort}
        onOpen={s => onSelectSchool(s.school_id)}
        rowActions={rowActions}
        searchRef={searchRef}
        keyboard="page"
        dividers={dividers}
        tintKeys={tint}
        selectedKey={schoolId}
      />

      {selected && (
        <DrawerListContext.Provider
          value={{
            ids: visible.map(s => s.school_id),
            label: filter === 'ready' ? 'ready to buy' : 'free schools',
            open: id => onSelectSchool(id),
          }}
        >
          <AccountDetail type="pql" school={selected} onClose={() => onSelectSchool(null)} />
        </DrawerListContext.Provider>
      )}
    </div>
  );
}

