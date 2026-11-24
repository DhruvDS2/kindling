import { useMemo, type ReactNode } from 'react';
import {
  Button, EmptyState, ErrorState, ScoreMeter, Table, TruncatedText, fmtShort, icons, type Column,
} from '../../design';
import type { HealthScore, Meta, PqlScore } from '../../types';
import { isAtRisk, isReady, plural, useHealthAt, useNewThisWeek, usePqlAt, usd, weekBefore } from '../ready/data';
import { ReasonsInline } from '../ready/Reasons';

/** Rows per list on the brief. Layout only: the counts and the rows come from the API. */
const TOP = 5;

function Section({ title, sub, more, children, testId }: { title: string; sub?: string; more?: ReactNode; children: ReactNode; testId: string }) {
  return (
    <section className="brief-section" data-testid={testId}>
      <div className="brief-section__head">
        <div>
          <h2 className="brief-section__title">{title}</h2>
          {sub && <p className="brief-section__sub">{sub}</p>}
        </div>
        {more}
      </div>
      {children}
    </section>
  );
}

function More({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="quiet" size="sm" iconAfter={<icons.ArrowRight small />} onClick={onClick}>{label}</Button>;
}

function Name({ name, isNew }: { name: string; isNew: boolean }) {
  return (
    <div className="ready-name">
      <TruncatedText className="k-medium">{name}</TruncatedText>
      {isNew && <span className="ready-new">New this week</span>}
    </div>
  );
}

const pqlKey = (s: PqlScore) => s.school_id;
const healthKey = (s: HealthScore) => s.school_id;
const nameOf = (s: { name: string }) => s.name;

/** "Ready to buy · top 5": the highest-scoring Ready schools, each with its top reason. */
export function ReadyTop({ asOf, meta, definition, onOpen, onAll }: {
  asOf: string;
  meta: Meta;
  definition?: string;
  onOpen: (schoolId: string) => void;
  onAll: () => void;
}) {
  const threshold = meta.thresholds.pql_ready;
  const q = usePqlAt(asOf);
  const prevDay = weekBefore(asOf, meta);
  const prevQ = usePqlAt(prevDay);
  const isNew = useNewThisWeek(q.data, prevQ.data, !q.isPlaceholderData && !prevQ.isPlaceholderData, isReady);

  const ready = useMemo(() => (q.data ?? []).filter(isReady).sort((a, b) => b.pql_score - a.pql_score), [q.data]);
  const rows = ready.slice(0, TOP);

  const columns = useMemo<Column<PqlScore>[]>(() => [
    { id: 'rank', header: '#', numeric: true, width: '5%', skeleton: '50%', cell: (_s, i) => <span className="ready-rank">{i + 1}</span> },
    { id: 'school', header: 'School', width: '30%', skeleton: '70%', cell: s => <Name name={s.name} isNew={!!prevDay && isNew.has(s.school_id)} /> },
    {
      id: 'score', header: 'Score', width: '18%', skeleton: '80%',
      cell: s => <ScoreMeter value={s.pql_score} threshold={threshold} tone="ready" thresholdLabel={`Ready at ${threshold}`} />,
    },
    { id: 'why', header: 'Top reason', skeleton: '85%', cell: s => <div className="ready-pad-sm"><ReasonsInline school={s} max={1} lines={1} /></div> },
  ], [threshold, isNew, prevDay]);

  const title = ready.length > TOP ? `Ready to buy · top ${TOP}` : 'Ready to buy';
  return (
    <Section
      testId="brief-ready"
      title={title}
      sub={definition}
      more={q.data && <More label={ready.length > 0 ? `All ${ready.length}` : 'Full ranking'} onClick={onAll} />}
    >
      <Table<PqlScore>
        aria-label="Top schools ready to buy"
        rows={rows}
        columns={columns}
        rowKey={pqlKey}
        rowLabel={nameOf}
        loading={q.isLoading}
        skeletonRows={TOP}
        onOpen={s => onOpen(s.school_id)}
        error={q.error && !q.data
          ? <ErrorState title={`Couldn't load readiness scores for ${fmtShort(asOf)}.`} detail={(q.error as Error).message} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          : undefined}
        empty={
          <EmptyState action={{ label: 'See the full ranking', onClick: onAll }}>
            No school is ready to buy on {fmtShort(asOf)}. Scores move every Monday.
          </EmptyState>
        }
      />
    </Section>
  );
}

/** "Slipping · renewal ahead": paying schools at risk, lowest health first, with renewal and ARR. */
export function Slipping({ asOf, meta, definition, onOpen, onAll }: {
  asOf: string;
  meta: Meta;
  definition?: string;
  onOpen: (schoolId: string) => void;
  onAll: () => void;
}) {
  const line = meta.thresholds.health_at_risk_below;
  const q = useHealthAt(asOf);
  const prevDay = weekBefore(asOf, meta);
  const prevQ = useHealthAt(prevDay);
  const isNew = useNewThisWeek(q.data, prevQ.data, !q.isPlaceholderData && !prevQ.isPlaceholderData, isAtRisk);

  const atRisk = useMemo(() => (q.data ?? []).filter(isAtRisk).sort((a, b) => a.health_score - b.health_score), [q.data]);
  const rows = atRisk.slice(0, TOP);

  const columns = useMemo<Column<HealthScore>[]>(() => [
    { id: 'school', header: 'School', width: '35%', skeleton: '70%', cell: s => <Name name={s.name} isNew={!!prevDay && isNew.has(s.school_id)} /> },
    {
      id: 'health', header: 'Health', width: '18%', skeleton: '80%',
      cell: s => <ScoreMeter value={s.health_score} threshold={line} tone="risk" thresholdLabel={`At risk below ${line}`} />,
    },
    {
      id: 'renews', header: 'Renewal', width: '18%', skeleton: '70%',
      cell: s => (
        <span className="brief-renews k-num">
          in {s.days_to_renewal} {plural(s.days_to_renewal, 'day')}
          <span className="brief-renews__arr"> · {usd(s.arr)}</span>
        </span>
      ),
    },
    { id: 'why', header: 'Top reason', skeleton: '85%', cell: s => <div className="ready-pad-sm"><ReasonsInline school={s} max={1} lines={1} showPoints={false} /></div> },
  ], [line, isNew, prevDay]);

  const title = atRisk.length > TOP ? `Slipping · renewal ahead · lowest ${TOP}` : 'Slipping · renewal ahead';
  return (
    <Section
      testId="brief-slipping"
      title={title}
      sub={definition}
      more={q.data && <More label={atRisk.length > 0 ? `All ${atRisk.length}` : 'All paying schools'} onClick={onAll} />}
    >
      <Table<HealthScore>
        aria-label="Paying schools slipping before renewal"
        rows={rows}
        columns={columns}
        rowKey={healthKey}
        rowLabel={nameOf}
        loading={q.isLoading}
        skeletonRows={3}
        onOpen={s => onOpen(s.school_id)}
        error={q.error && !q.data
          ? <ErrorState title={`Couldn't load health scores for ${fmtShort(asOf)}.`} detail={(q.error as Error).message} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          : undefined}
        empty={
          <EmptyState action={{ label: 'See all paying schools', onClick: onAll }}>
            No paying school is slipping before its renewal on {fmtShort(asOf)}.
          </EmptyState>
        }
      />
    </Section>
  );
}
