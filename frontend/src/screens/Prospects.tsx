import { Fragment, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchPql, fetchTop10Prospects, notifySlack, type ProspectSignal, type TopProspect } from '../api';
import { useAsOf } from '../asOf';
import { fmtDay } from '../nav';
import type { PqlScore } from '../types';
import {
  Button, EmptyState, ErrorState, NumberFlow, Skeleton, Table, Tooltip, TruncatedText,
  addWeeks, fmtShort, useToast, type Column, type RowAction, type TableDivider,
} from '../design';

// Prospects: free schools with little or no use, ranked by the API's priority score
// (GET /prospects/top10), plus every other cold school (GET /pql). Outreach lives in the 8B
// row actions: neutral buttons, no Slack/LinkedIn/Gmail brand colors.

const stack: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };

// ── Outreach ─────────────────────────────────────────────────────────────────

function gmailUrl(email: string, subject: string, body: string) {
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

function linkedInUrl(school: PqlScore) {
  const who = [school.contact_name, school.name].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(who)}`;
}

function buildEmailDraft(school: PqlScore) {
  const first = school.contact_name?.split(' ')[0] || 'there';
  if (school.pql_score === 0) {
    return {
      subject: `Getting started at ${school.name}`,
      body:
        `Hi ${first},\n\n` +
        `${school.name} signed up for Kindling a little while back and I wanted to reach out personally. ` +
        `Getting a new platform off the ground is always a lift, and I want to make sure you're not stuck on anything.\n\n` +
        `We've helped schools like yours get their first teachers up and running quickly, ` +
        `and I'd love to do the same for you. Even a short call to walk through the setup together can make a big difference.\n\n` +
        `Would that be useful? Happy to work around your calendar.\n\nBest,`,
    };
  }
  return {
    subject: `How's ${school.name} finding the platform?`,
    body:
      `Hi ${first},\n\n` +
      `Wanted to check in on how things are going at ${school.name}. ` +
      `I can see ${school.active_teachers} teacher${school.active_teachers !== 1 ? 's' : ''} have been exploring the platform ` +
      `and wanted to make sure the team is getting what they need.\n\n` +
      `Is there anything that's gotten in the way of wider adoption? Or a better time of year to reconnect?\n\n` +
      `Happy to jump on a quick call, no agenda: I just want to make sure ${school.name} is set up for success.\n\nBest,`,
  };
}

/**
 * The four outreach row actions (DESIGN.md §3.4): Open in Gmail · Find on LinkedIn · Copy email `c`
 * · Send to #sales `s`. Send posts for real (POST /notify/slack), only when the rep asks, and
 * confirms with a toast.
 */
function useOutreach(asOf: string) {
  const toast = useToast();
  const inFlight = useRef(new Set<string>());
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const keyOf = useCallback((s: PqlScore) => `${s.school_id}@${asOf}`, [asOf]);

  const send = useCallback(async function sendToSales(s: PqlScore): Promise<void> {
    const key = keyOf(s);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setSending(prev => new Set(prev).add(key));
    const fail = (why?: string) => toast({
      message: `Couldn't send ${s.name} to #sales${why ? `: ${why}` : '.'}`,
      tone: 'error',
      action: { label: 'Try again', onClick: () => { void sendToSales(s); } },
    });
    try {
      const res = await notifySlack('sales', s.school_id, asOf);
      if (res.ok) {
        setSent(prev => new Set(prev).add(key));
        toast({ message: `Sent ${s.name} to #sales.`, tone: 'success' });
      } else {
        fail(res.error);
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : undefined);
    } finally {
      inFlight.current.delete(key);
      setSending(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [asOf, keyOf, toast]);

  const copy = useCallback(async (s: PqlScore) => {
    try {
      await navigator.clipboard.writeText(s.contact_email);
      toast({ message: `Copied ${s.contact_email}`, tone: 'success' });
    } catch {
      toast({ message: `Couldn't copy. The email is ${s.contact_email}`, tone: 'error' });
    }
  }, [toast]);

  return useCallback((s: PqlScore): RowAction<PqlScore>[] => {
    const key = keyOf(s);
    const isSending = sending.has(key);
    const isSent = sent.has(key);
    const draft = buildEmailDraft(s);
    return [
      {
        id: 'gmail', label: 'Open in Gmail', disabled: !s.contact_email,
        onSelect: () => { window.open(gmailUrl(s.contact_email, draft.subject, draft.body), '_blank', 'noopener,noreferrer'); },
      },
      { id: 'linkedin', label: 'Find on LinkedIn', onSelect: () => { window.open(linkedInUrl(s), '_blank', 'noopener,noreferrer'); } },
      { id: 'copy', label: 'Copy email', shortcut: 'c', disabled: !s.contact_email, onSelect: () => { void copy(s); } },
      {
        id: 'send',
        label: isSending ? 'Sending…' : isSent ? 'Sent to #sales' : 'Send to #sales',
        shortcut: isSending || isSent ? undefined : 's',
        disabled: isSending || isSent,
        onSelect: () => { void send(s); },
      },
    ];
  }, [keyOf, sending, sent, send, copy]);
}

// ── Cells ────────────────────────────────────────────────────────────────────

function SchoolCell({ s }: { s: PqlScore }) {
  const place = [s.type === 'district' ? 'District' : 'Independent', [s.city, s.state].filter(Boolean).join(', ')]
    .filter(Boolean).join(' · ');
  return (
    <div style={stack}>
      <TruncatedText className="k-medium">{s.name}</TruncatedText>
      <TruncatedText className="k-text-sm k-tertiary">{place}</TruncatedText>
    </div>
  );
}

function ContactCell({ s }: { s: PqlScore }) {
  if (!s.contact_name) return <span className="k-text-sm k-tertiary">No contact yet</span>;
  return (
    <div style={stack}>
      <TruncatedText>{s.contact_name}</TruncatedText>
      {s.contact_title && <TruncatedText className="k-text-sm k-tertiary">{s.contact_title}</TruncatedText>}
    </div>
  );
}

/** Why a school ranks where it does: each signal the API scored, with its points. Details on hover or focus. */
function WhyCell({ signals }: { signals: ProspectSignal[] }) {
  const scored = signals.filter(s => s.pts > 0);
  const flags = signals.filter(s => s.pts <= 0);
  const parts: ReactNode[] = [
    ...scored.map(s => (
      <span key={s.label} style={{ whiteSpace: 'nowrap' }}>
        {s.label} <span className="k-num k-tertiary">{s.pts}</span>
      </span>
    )),
    ...flags.map(s => <span key={s.label} className="k-tertiary" style={{ whiteSpace: 'nowrap' }}>{s.label}</span>),
  ];
  return (
    <Tooltip
      content={
        <span style={{ ...stack, gap: 'var(--space-0-5)' }}>
          {signals.map(s => <span key={s.label}>{s.label}: <span className="k-secondary">{s.detail}</span></span>)}
        </span>
      }
    >
      <span tabIndex={0} className="k-focus k-text-sm k-secondary" style={{ display: 'block', borderRadius: 'var(--radius-1)' }}>
        {parts.map((p, i) => <Fragment key={i}>{i > 0 && <span className="k-tertiary"> · </span>}{p}</Fragment>)}
      </span>
    </Tooltip>
  );
}

function SectionHead({ title, context, aside }: { title: ReactNode; context?: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-1-5)' }}>
      <div style={{ ...stack, flex: 1, gap: 'var(--space-0-5)' }}>
        <h2 className="k-text-lg k-medium k-primary">{title}</h2>
        {context && <p className="k-text-sm k-tertiary" style={{ margin: 0 }}>{context}</p>}
      </div>
      {aside}
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

type Ranked = TopProspect & { rank: number };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export default function Prospects() {
  // Toasts confirm Copy and Send; the app root mounts the ToastProvider.
  return <ProspectsView />;
}

function ProspectsView() {
  const { asOf, setAsOf, meta } = useAsOf();
  const top = useQuery({
    queryKey: ['prospects-top10', asOf],
    queryFn: () => fetchTop10Prospects(asOf),
    placeholderData: keepPreviousData,
  });
  const pql = useQuery({ queryKey: ['pql', asOf], queryFn: () => fetchPql(asOf), placeholderData: keepPreviousData });
  const actions = useOutreach(asOf);
  const [showRest, setShowRest] = useState(false);

  const ranked = useMemo<Ranked[]>(() => (top.data?.top10 ?? []).map((p, i) => ({ ...p, rank: i + 1 })), [top.data]);
  const total = top.data?.total_prospects ?? 0;

  // Every prospect the API counted is a free school with the lowest readiness scores, so the
  // `total_prospects` lowest-scoring schools in /pql are exactly that pool (no cut-off typed in here).
  const rest = useMemo(() => {
    if (!pql.data || !top.data) return null;
    const pool = [...pql.data].sort((a, b) => a.pql_score - b.pql_score).slice(0, top.data.total_prospects);
    const inTop = new Set(top.data.top10.map(p => p.school_id));
    const others = pool.filter(s => !inTop.has(s.school_id));
    const some = others.filter(s => s.pql_score > 0).sort((a, b) => b.pql_score - a.pql_score || a.name.localeCompare(b.name));
    const none = others.filter(s => s.pql_score === 0).sort((a, b) => a.name.localeCompare(b.name));
    return { rows: [...some, ...none], some, none };
  }, [pql.data, top.data]);

  const topColumns = useMemo<Column<Ranked>[]>(() => [
    { id: 'rank', header: '#', numeric: true, width: '5%', skeleton: '50%', cell: r => <span className="k-tertiary">{r.rank}</span> },
    { id: 'school', header: 'School', width: '24%', sortValue: r => r.name, skeleton: '70%', skeletonLines: 2, cell: r => <SchoolCell s={r} /> },
    {
      id: 'priority', header: 'Priority', numeric: true, width: '9%', sortValue: r => r.priority_score, skeleton: '45%',
      cell: r => <NumberFlow value={r.priority_score} reveal={false} className="k-medium" />,
    },
    { id: 'why', header: 'Why', skeleton: '90%', skeletonLines: 2, cell: r => <WhyCell signals={r.signals} /> },
    {
      id: 'pql', header: 'PQL', numeric: true, width: '7%', sortValue: r => r.pql_score, skeleton: '40%',
      cell: r => <NumberFlow value={r.pql_score} reveal={false} className="k-secondary" />,
    },
    { id: 'contact', header: 'Contact', width: '18%', skeleton: '70%', skeletonLines: 2, cell: r => <ContactCell s={r} /> },
  ], []);

  const restColumns = useMemo<Column<PqlScore>[]>(() => [
    { id: 'school', header: 'School', cell: r => <SchoolCell s={r} /> },
    { id: 'teachers', header: 'Active teachers', numeric: true, width: '12%', cell: r => <NumberFlow value={r.active_teachers} reveal={false} /> },
    { id: 'sessions', header: 'Student sessions', numeric: true, width: '12%', cell: r => <NumberFlow value={r.student_sessions} reveal={false} /> },
    { id: 'pql', header: 'PQL', numeric: true, width: '7%', cell: r => <NumberFlow value={r.pql_score} reveal={false} className="k-secondary" /> },
    { id: 'contact', header: 'Contact', width: '18%', cell: r => <ContactCell s={r} /> },
  ], []);

  const restDividers: TableDivider[] = [];
  if (rest?.some.length) restDividers.push({ beforeKey: rest.some[0].school_id, label: `Some activity · ${plural(rest.some.length, 'school')}`, tone: 'neutral' });
  if (rest?.none.length) restDividers.push({ beforeKey: rest.none[0].school_id, label: `No activity yet · ${plural(rest.none.length, 'school')}`, tone: 'neutral' });

  const day = fmtDay(asOf);
  const lastWeek = addWeeks(asOf, -1);
  const firstLoad = top.isLoading;

  const title = firstLoad
    ? <Skeleton width="25%" />
    : ranked.length > 0 ? `${plural(ranked.length, 'cold school')} worth a first call` : 'Cold schools worth a first call';
  const context = firstLoad
    ? <Skeleton width="50%" height="label" />
    : top.data && ranked.length > 0
      ? `Picked from ${plural(total, 'free school')} with little or no use on ${day}. Priority adds up the points under Why.`
      : undefined;

  return (
    <div data-testid="prospects-top" style={{ ...stack, gap: 'var(--space-6)' }}>
      <section aria-label="Cold schools worth a first call">
        <SectionHead title={title} context={context} />
        <Table
          aria-label={`Cold schools worth a first call on ${day}`}
          rows={ranked}
          columns={topColumns}
          rowKey={r => r.school_id}
          rowLabel={r => r.name}
          loading={firstLoad}
          skeletonRows={10}
          defaultSort={{ columnId: 'priority', direction: 'desc' }}
          rowActions={actions}
          error={top.error && !top.data ? (
            <ErrorState
              title={`Couldn't load the cold schools for ${day}.`}
              detail={(top.error as Error).message}
              onRetry={() => { void top.refetch(); }}
              retrying={top.isFetching}
            />
          ) : undefined}
          empty={
            <EmptyState action={lastWeek >= meta.sim_start ? { label: `Show ${fmtShort(lastWeek)}`, onClick: () => setAsOf(lastWeek) } : undefined}>
              No cold schools on {day}: every free school is getting some use.
            </EmptyState>
          }
        />
      </section>

      {pql.error && !pql.data ? (
        <ErrorState
          title={`Couldn't load the other free schools for ${day}.`}
          detail={(pql.error as Error).message}
          onRetry={() => { void pql.refetch(); }}
          retrying={pql.isFetching}
        />
      ) : rest && rest.rows.length > 0 && (
        <section aria-label="More cold schools">
          <SectionHead
            title={`${plural(rest.rows.length, 'more cold school')}`}
            context={`Lower priority on ${day}. Schools with some activity come first.`}
            aside={
              <Button variant="quiet" size="sm" aria-expanded={showRest} onClick={() => setShowRest(v => !v)}>
                {showRest ? 'Hide' : `Show all ${rest.rows.length}`}
              </Button>
            }
          />
          {showRest && (
            <Table
              aria-label={`More cold schools on ${day}`}
              rows={rest.rows}
              columns={restColumns}
              rowKey={r => r.school_id}
              rowLabel={r => r.name}
              dividers={restDividers}
              rowActions={actions}
            />
          )}
        </section>
      )}
    </div>
  );
}
