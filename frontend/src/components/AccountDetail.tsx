// The school detail drawer (DESIGN.md §3.1): the base Drawer's Preymaker motion, 4A
// properties, the 4C pager from the list the rep came from (DrawerListContext), the 5A
// usage chart with the school-day / calendar-day toggle, and the score history. Opened from
// At risk (type="health") and Ready (type="pql"); the props stay { type, school, onClose }.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PqlScore, HealthScore } from '../types';
import { notifySlack, fetchSchool, fetchSchoolHistory, fetchSchoolUsage, fetchCalendar } from '../api';
import { useAsOf } from '../asOf';
import { useDrawerList } from '../drawerList';
import { Button, Drawer, DrawerSection, SegmentedControl, durMs } from '../design';
import { Facts, HeaderMeta } from './detail/Header';
import ScoreChart from './detail/ScoreChart';
import UsageBody from './detail/Usage';
import type { WindowMode } from './detail/UsageChart';
import { Reasons, Signals } from './detail/Why';
import { breakSpans, dayNum, summerSpans, weekday } from './detail/model';
import { Note, SectionError, SectionSkeleton } from './detail/ui';
import { EnsureToasts, useOptionalToast } from './detail/toasts';
import { useWidth } from './detail/useWidth';

type School = PqlScore | HealthScore;

interface Props {
  type: 'pql' | 'health';
  school: School;
  onClose: () => void;
}

const schoolKey = (id: string, asOf: string) => ['school', id, asOf] as const;
const usageKey = (id: string, asOf: string) => ['school-usage', id, asOf] as const;
const historyKey = (id: string, asOf: string, mode: 'school_days' | 'calendar') => ['school-history', id, asOf, mode] as const;

export default function AccountDetail(props: Props) {
  return <EnsureToasts><SchoolDrawer {...props} /></EnsureToasts>;
}

function SchoolDrawer({ type, school, onClose }: Props) {
  const { asOf, meta } = useAsOf();
  const id = school.school_id;
  const list = useDrawerList();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  // The window mode carries over when the pager moves; a ref, so toggling never re-renders the drawer.
  const modeRef = useRef<WindowMode>('school_days');
  const rememberMode = useCallback((m: WindowMode) => { modeRef.current = m; }, []);
  const returnRef = useRef<HTMLElement | null>(null);
  // Charts wipe in once, for the school the drawer opened on; paging cross-fades instead.
  const [firstId] = useState(id);
  const [paged, setPaged] = useState(false);
  // The charts render once the wipe has finished, so the open animation never shares a frame
  // with chart layout (their data is already being fetched meanwhile).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), durMs('slow'));
    return () => window.clearTimeout(t);
  }, []);
  if (id !== firstId && !paged) setPaged(true);

  // Close: the wipe retracts first (base, exit), then the parent clears ?school=. Focus goes
  // back to the row of the school on screen (after paging, that's the row the pager reached).
  const close = useCallback(() => {
    returnRef.current = document.querySelector<HTMLElement>(`#root tr[data-key="${CSS.escape(id)}"]`);
    setOpen(false);
    window.setTimeout(onClose, durMs('base'));
  }, [id, onClose]);

  // 4C pager: the list the rep came from, in on-screen order.
  const index = list ? list.ids.indexOf(id) : -1;
  const pager = list && index >= 0 ? {
    index,
    total: list.ids.length,
    label: list.label,
    onPrev: () => { if (index > 0) list.open(list.ids[index - 1]); },
    onNext: () => { if (index < list.ids.length - 1) list.open(list.ids[index + 1]); },
  } : undefined;
  const nextId = list && index >= 0 ? list.ids[index + 1] : undefined;
  const prevId = list && index > 0 ? list.ids[index - 1] : undefined;

  // Paging can remove the focused control ("Next school" on the last school, or a control on the
  // page that just faded out). Focus then falls to <body>, where Esc and j/k would reach the list
  // behind the scrim instead of the drawer, so it goes back to the panel.
  useEffect(() => {
    const keep = () => {
      const a = document.activeElement;
      if (!a || a === document.body) document.querySelector<HTMLElement>('.k-drawer[role="dialog"]')?.focus({ preventScroll: true });
    };
    keep();
    const t = window.setTimeout(keep, durMs('slow'));   // after the old page has faded out
    return () => window.clearTimeout(t);
  }, [id]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (e.key === 'Escape' && (!a || a === document.body)) { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Paging feels instant: once this school has opened, warm its neighbours.
  useEffect(() => {
    const ids = [nextId, prevId].filter((x): x is string => !!x);
    if (!ids.length) return;
    const t = window.setTimeout(() => {
      for (const n of ids) {
        void qc.prefetchQuery({ queryKey: schoolKey(n, asOf), queryFn: () => fetchSchool(n, asOf) });
        void qc.prefetchQuery({ queryKey: usageKey(n, asOf), queryFn: () => fetchSchoolUsage(n, asOf) });
        void qc.prefetchQuery({ queryKey: historyKey(n, asOf, 'school_days'), queryFn: () => fetchSchoolHistory(n, asOf, 'school_days') });
        void qc.prefetchQuery({ queryKey: historyKey(n, asOf, 'calendar'), queryFn: () => fetchSchoolHistory(n, asOf, 'calendar') });
      }
    }, durMs('slow'));
    return () => window.clearTimeout(t);
  }, [nextId, prevId, asOf, qc]);

  // The detail for this school: header and footer read it; the body pages with the school.
  const detailQ = useQuery({ queryKey: schoolKey(id, asOf), queryFn: () => fetchSchool(id, asOf), placeholderData: sameSchool(id) });
  const detail = detailQ.data;
  const kind = detail?.score_kind ?? type;
  const live = detail ? detail.score : school;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={school.name}
      meta={<HeaderMeta kind={kind} row={school} detail={detail} meta={meta} asOf={asOf} />}
      pager={pager}
      contentKey={id}
      returnFocusRef={returnRef}
      nextLink={nextId ? { label: 'Next school', onClick: () => list!.open(nextId) } : undefined}
      footer={<Actions key={id} kind={kind} schoolId={id} name={school.name} canSend={!!live} />}
    >
      <DrawerBody type={type} school={school} initialMode={modeRef.current} onModeChange={rememberMode} reveal={!paged} settled={settled} />
    </Drawer>
  );
}

/** placeholderData for school queries: keep this school's previous date on screen while a new
 *  as_of loads (no skeleton flash, DESIGN.md §3.2), but never show another school's data. */
const sameSchool = (id: string) =>
  <T,>(prev: T | undefined, prevQuery: { queryKey: readonly unknown[] } | undefined) => (prevQuery?.queryKey[1] === id ? prev : undefined);

function DrawerBody({ type, school, initialMode, onModeChange, reveal, settled }: {
  type: 'pql' | 'health'; school: School; initialMode: WindowMode; onModeChange: (m: WindowMode) => void; reveal: boolean; settled: boolean;
}) {
  const { asOf, meta } = useAsOf();
  const id = school.school_id;
  const [bodyRef, width] = useWidth();

  const detailQ = useQuery({ queryKey: schoolKey(id, asOf), queryFn: () => fetchSchool(id, asOf), placeholderData: sameSchool(id) });
  const usageQ = useQuery({ queryKey: usageKey(id, asOf), queryFn: () => fetchSchoolUsage(id, asOf), placeholderData: sameSchool(id) });
  const kindlingQ = useQuery({ queryKey: historyKey(id, asOf, 'school_days'), queryFn: () => fetchSchoolHistory(id, asOf, 'school_days'), placeholderData: sameSchool(id) });
  const naiveQ = useQuery({ queryKey: historyKey(id, asOf, 'calendar'), queryFn: () => fetchSchoolHistory(id, asOf, 'calendar'), placeholderData: sameSchool(id) });
  const calendarId = detailQ.data?.calendar_id ?? school.calendar_id;
  const calendarQ = useQuery({ queryKey: ['calendar', calendarId], queryFn: () => fetchCalendar(calendarId), staleTime: Infinity });

  const detail = detailQ.data;
  const kind = detail?.score_kind ?? type;
  const live = detail ? detail.score : school;
  const threshold = kind === 'pql' ? meta.thresholds.pql_ready : meta.thresholds.health_at_risk_below;
  const d0 = dayNum(meta.sim_start);
  const asOfN = dayNum(asOf);
  const cal = calendarQ.data;
  const breaks = cal ? breakSpans(cal) : [];
  const summers = cal ? summerSpans(cal, meta.sim_start, meta.sim_end) : [];
  const stale = (q: { isPlaceholderData: boolean }) => (q.isPlaceholderData ? 'kd-stale is-stale' : 'kd-stale');

  const whyTitle = !live ? 'Why'
    : live.status === 'At risk' ? 'Why it’s at risk'
    : live.status === 'Healthy' ? 'Why it’s healthy'
    : live.status === 'Ready' ? 'Why it’s ready'
    : 'Why it’s not ready yet';

  return (
    <div ref={bodyRef} className="kd-body" data-testid="account-detail" data-school={id}>
      <DrawerSection>
        {detailQ.error
          ? <SectionError what="this school's details" error={detailQ.error} onRetry={() => detailQ.refetch()} retrying={detailQ.isFetching} />
          : <div className={stale(detailQ)}><Facts kind={kind} row={school} detail={detail} meta={meta} asOf={asOf} /></div>}
      </DrawerSection>

      <DrawerSection title={whyTitle} aside={live?.reason_details.length ? 'points earned of the most possible' : undefined}>
        <div data-testid="detail-reasons" className={stale(detailQ)}>
          {!live
            ? <Note>No score at this date, so there are no reasons.</Note>
            : <Reasons details={live.reason_details} history={kindlingQ.data?.points} />}
        </div>
      </DrawerSection>

      <UsageSection initialMode={initialMode} onModeChange={onModeChange}>
        {mode => usageQ.error ? <SectionError what="usage" error={usageQ.error} onRetry={() => usageQ.refetch()} retrying={usageQ.isFetching} />
          : calendarQ.error ? <SectionError what={`the ${calendarId} calendar`} error={calendarQ.error} onRetry={() => calendarQ.refetch()} retrying={calendarQ.isFetching} />
          : detailQ.error ? <Note>Needs the school’s details (see above).</Note>
          : !settled || !usageQ.data || !detail || !cal || !width ? <SectionSkeleton chart="tall" lines={2} />
          : (
            <div className={stale(usageQ)}>
              <UsageBody width={width} days={usageQ.data.days} d0={d0} asOf={asOf} asOfN={asOfN} breaks={breaks} summers={summers}
                windows={detail.windows} mode={mode} reveal={reveal} />
            </div>
          )}
      </UsageSection>

      <DrawerSection title="Score every Monday" aside={`from ${weekday(meta.replay_start)}`}>
        <div data-testid="detail-score-history">
          {kindlingQ.error ? <SectionError what="the score history" error={kindlingQ.error} onRetry={() => kindlingQ.refetch()} retrying={kindlingQ.isFetching} />
            : naiveQ.error ? <SectionError what="the calendar-day score history" error={naiveQ.error} onRetry={() => naiveQ.refetch()} retrying={naiveQ.isFetching} />
            : !settled || !kindlingQ.data || !naiveQ.data || !width ? <SectionSkeleton chart="short" lines={3} />
            : kindlingQ.data.points.length === 0 && naiveQ.data.points.length === 0
              ? <Note>No weekly scores up to {weekday(asOf)}. {detail?.lifecycle === 'no_signup' ? 'Nobody has signed up yet.' : `Scoring is weekly from ${weekday(meta.replay_start)}.`}</Note>
              : (
                <div className={['kd-history', stale(kindlingQ)].join(' ')}>
                  <ScoreChart width={width} kind={kind} threshold={threshold} kindling={kindlingQ.data.points} naive={naiveQ.data.points}
                    d0={d0} asOf={asOfN} breaks={breaks} summers={summers} reveal={reveal} />
                  <Signals kind={kind} threshold={threshold} kindling={kindlingQ.data.points} naive={naiveQ.data.points} />
                </div>
              )}
        </div>
      </DrawerSection>
    </div>
  );
}

/** The usage section owns the window toggle's state, so a toggle re-renders only this section
 *  (the morph then runs on a quiet main thread). The mode carries over when the pager moves. */
function UsageSection({ initialMode, onModeChange, children }: {
  initialMode: WindowMode; onModeChange: (m: WindowMode) => void; children: (mode: WindowMode) => ReactNode;
}) {
  const [mode, setMode] = useState(initialMode);
  return (
    <DrawerSection
      title="Usage"
      aside={
        // Arrow keys belong to the segmented control here, not to the drawer's pager.
        <div className="kd-toggle" onKeyDown={e => { if (e.key.startsWith('Arrow')) e.stopPropagation(); }}>
          <SegmentedControl<WindowMode>
            aria-label="Scoring window"
            value={mode}
            onChange={m => { setMode(m); onModeChange(m); }}
            options={[{ id: 'school_days', label: 'School days' }, { id: 'calendar', label: 'Calendar days' }]}
          />
        </div>
      }
    >
      <div data-testid="detail-usage">{children(mode)}</div>
    </DrawerSection>
  );
}

/** Footer actions. "Send" POSTs to /notify/slack: only a person clicks it, never on load. */
function Actions({ kind, schoolId, name, canSend }: { kind: 'pql' | 'health'; schoolId: string; name: string; canSend: boolean }) {
  const { asOf } = useAsOf();
  const toast = useOptionalToast();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [contacted, setContacted] = useState(false);
  const channel = kind === 'pql' ? 'sales' : 'cs';
  const channelLabel = kind === 'pql' ? '#sales' : '#customer-success';

  const send = async () => {
    setState('sending');
    try {
      const res = await notifySlack(channel, schoolId, asOf);
      if (!res.ok) throw new Error(res.error ?? 'Slack did not accept the message');
      setState('sent');
      toast?.({ message: `Sent ${name} to ${channelLabel}.`, tone: 'success' });
    } catch (e) {
      setState('idle');
      toast?.({ message: `Couldn’t send to ${channelLabel}: ${e instanceof Error ? e.message : String(e)}`, tone: 'error' });
    }
  };

  return (
    <>
      <Button variant="primary" loading={state === 'sending'} disabled={!canSend || state === 'sent'} onClick={send}
        title={!canSend ? 'No live score at this date' : undefined} data-testid="detail-send">
        {state === 'sent' ? `Sent to ${channelLabel}` : `Send to ${channelLabel}`}
      </Button>
      <Button variant="secondary" aria-pressed={contacted} onClick={() => setContacted(v => !v)} data-testid="detail-contacted">
        {contacted ? 'Marked contacted' : 'Mark contacted'}
      </Button>
    </>
  );
}
