// The school detail drawer. Opened from a list row; fetches the full picture for that
// school at the console's as_of date: profile and windows, daily usage, its calendar,
// and its weekly score history in both window modes.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PqlScore, HealthScore } from '../types';
import { notifySlack, fetchSchool, fetchSchoolHistory, fetchSchoolUsage, fetchCalendar } from '../api';
import { useAsOf } from '../asOf';
import Header from './detail/Header';
import UsageChart from './detail/UsageChart';
import WindowLens from './detail/WindowLens';
import ScoreChart from './detail/ScoreChart';
import { Reasons, Signals } from './detail/Why';
import { type Metric, METRIC, breakSpans, dayNum, plural, summerSpans, weekday } from './detail/model';
import { COLORS, SUMMER_OPACITY } from './detail/scale';
import { Key, Note, Section, SectionError, SectionSkeleton, Toggle } from './detail/ui';
import { useWidth } from './detail/useWidth';

type School = PqlScore | HealthScore;

interface Props {
  type: 'pql' | 'health';
  school: School;
  onClose: () => void;
}

export default function AccountDetail({ type, school, onClose }: Props) {
  const { asOf, meta } = useAsOf();
  const id = school.school_id;
  const [metric, setMetric] = useState<Metric>('teachers');
  const [slackState, setSlackState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contacted, setContacted] = useState(false);
  const [bodyRef, width] = useWidth();

  // Keep showing this school's previous date while a new as_of loads (no skeleton flash),
  // but never another school's data.
  const sameSchool = <T,>(prev: T | undefined, q: { queryKey: readonly unknown[] } | undefined) =>
    q?.queryKey[1] === id ? prev : undefined;

  const detailQ = useQuery({ queryKey: ['school', id, asOf], queryFn: () => fetchSchool(id, asOf), placeholderData: sameSchool });
  const usageQ = useQuery({ queryKey: ['school-usage', id, asOf], queryFn: () => fetchSchoolUsage(id, asOf), placeholderData: sameSchool });
  const kindlingQ = useQuery({ queryKey: ['school-history', id, asOf, 'school_days'], queryFn: () => fetchSchoolHistory(id, asOf, 'school_days'), placeholderData: sameSchool });
  const naiveQ = useQuery({ queryKey: ['school-history', id, asOf, 'calendar'], queryFn: () => fetchSchoolHistory(id, asOf, 'calendar'), placeholderData: sameSchool });
  const calendarId = detailQ.data?.calendar_id ?? school.calendar_id;
  const calendarQ = useQuery({ queryKey: ['calendar', calendarId], queryFn: () => fetchCalendar(calendarId), staleTime: Infinity });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // a different school in the same drawer starts with fresh actions
  const [actionsFor, setActionsFor] = useState(id);
  if (actionsFor !== id) { setActionsFor(id); setSlackState('idle'); setContacted(false); }

  const detail = detailQ.data;
  const kind = detail?.score_kind ?? type;
  const live = detail ? detail.score : school;
  const channel = kind === 'pql' ? 'sales' : 'cs';
  const channelLabel = kind === 'pql' ? '#sales' : '#customer-success';
  const threshold = kind === 'pql' ? meta.thresholds.pql_ready : meta.thresholds.health_at_risk_below;

  const d0 = dayNum(meta.sim_start);
  const asOfN = dayNum(asOf);
  const cal = calendarQ.data;
  const breaks = cal ? breakSpans(cal) : [];
  const summers = cal ? summerSpans(cal, meta.sim_start, meta.sim_end) : [];
  const stale = (q: { isPlaceholderData: boolean }) => (q.isPlaceholderData ? { opacity: 0.55, transition: 'opacity 150ms' } : undefined);

  const handleSlack = async () => {
    setSlackState('sending');
    try {
      const res = await notifySlack(channel, id, asOf);
      setSlackState(res.ok ? 'sent' : 'error');
    } catch {
      setSlackState('error');
    }
  };

  const windowsKey = detail && (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <Key swatch={{ background: COLORS.break }}>School break</Key>
      <Key swatch={{ background: COLORS.break, opacity: SUMMER_OPACITY }}>Summer</Key>
      <Key swatch={{ background: COLORS.schoolDays }}>School-day window</Key>
      <Key swatch={{ background: COLORS.calendar }}>Calendar-day window</Key>
      <Key swatch={{ background: COLORS.schoolDays, opacity: 0.35 }}>Prior window (lighter)</Key>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,25,0.18)', zIndex: 40 }} />

      <aside role="dialog" aria-modal="true" aria-labelledby="detail-title" data-testid="account-detail" tabIndex={-1}
        ref={el => { if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true }); }} style={{
        outline: 'none',
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(720px, 100vw)', zIndex: 50,
        background: 'var(--card)', boxShadow: '-8px 0 32px rgba(28,27,25,0.10)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 24px' }}>
          <div ref={bodyRef} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {detailQ.error
              ? <>
                  <Header type={type} row={school} detail={undefined} meta={meta} asOf={asOf} onClose={onClose} />
                  <SectionError what="this school" error={detailQ.error} onRetry={() => detailQ.refetch()} />
                </>
              : <div style={stale(detailQ)}><Header type={type} row={school} detail={detail} meta={meta} asOf={asOf} onClose={onClose} /></div>}

            <Section title="Usage over time" testId="detail-usage"
              aside={<Toggle label="Usage measure" value={metric} onChange={setMetric}
                options={[{ id: 'teachers', label: METRIC.teachers.label }, { id: 'sessions', label: METRIC.sessions.label }]} />}>
              {usageQ.error ? <SectionError what="usage" error={usageQ.error} onRetry={() => usageQ.refetch()} />
                : calendarQ.error ? <SectionError what={`the ${calendarId} calendar`} error={calendarQ.error} onRetry={() => calendarQ.refetch()} />
                : !usageQ.data || !detail || !cal || !width ? <SectionSkeleton height={190} />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...stale(usageQ) }}>
                    <Note>{METRIC[metric].weekly}, {weekday(meta.sim_start)} to {weekday(asOf)}.</Note>
                    {windowsKey}
                    <UsageChart width={width} days={usageQ.data.days} d0={d0} asOf={asOfN} breaks={breaks} summers={summers}
                      windows={detail.windows} metric={metric} />
                    <Note>
                      <b style={{ color: 'var(--body)', fontWeight: 600 }}>School-day window</b> (Kindling): the last {plural(detail.windows.school_days.length, 'school day')} on
                      this school’s calendar vs the {detail.windows.school_days.length} before, skipping weekends and breaks.{' '}
                      <b style={{ color: 'var(--body)', fontWeight: 600 }}>Calendar-day window</b> (naive): the last {plural(detail.windows.calendar.length, 'calendar day')} vs
                      the {detail.windows.calendar.length} before, breaks and all.
                    </Note>
                  </div>
                )}
            </Section>

            <Section title="The two windows, day by day" testId="detail-windows"
              aside={<span style={{ fontSize: 12, color: 'var(--muted)' }}>ending {weekday(asOf)}</span>}>
              {usageQ.error || calendarQ.error ? <Note>Needs usage and calendar data (see above).</Note>
                : !usageQ.data || !detail || !width ? <SectionSkeleton height={150} />
                : <div style={stale(usageQ)}>
                    <WindowLens width={width} days={usageQ.data.days} windows={detail.windows} asOf={asOf} d0={d0}
                      breaks={breaks} summers={summers} metric={metric} />
                  </div>}
            </Section>

            <Section title="Score over time" testId="detail-score-history"
              aside={<span style={{ fontSize: 12, color: 'var(--muted)' }}>every Monday from {weekday(meta.replay_start)}</span>}>
              {kindlingQ.error ? <SectionError what="score history" error={kindlingQ.error} onRetry={() => kindlingQ.refetch()} />
                : naiveQ.error ? <SectionError what="calendar-day score history" error={naiveQ.error} onRetry={() => naiveQ.refetch()} />
                : !kindlingQ.data || !naiveQ.data || !width ? <SectionSkeleton height={150} />
                : kindlingQ.data.points.length === 0 && naiveQ.data.points.length === 0
                  ? <Note>No weekly scores up to {weekday(asOf)}. {detail?.lifecycle === 'no_signup' ? 'Nobody has signed up yet.' : `Scoring is weekly from ${weekday(meta.replay_start)}.`}</Note>
                  : <div style={stale(kindlingQ)}>
                      <ScoreChart width={width} kind={kind} threshold={threshold} kindling={kindlingQ.data.points} naive={naiveQ.data.points}
                        d0={d0} asOf={asOfN} breaks={breaks} summers={summers} />
                    </div>}
            </Section>

            <Section title={live ? `Why ${kind === 'pql' ? 'PQL' : 'health'} ${'health_score' in live ? live.health_score : live.pql_score} · ${live.status}` : 'Why'} testId="detail-reasons"
              aside={<span style={{ fontSize: 12, color: 'var(--muted)' }}>points earned / most possible</span>}>
              {!live ? <Note>No score at this date, so no reasons.</Note>
                : <Reasons kind={kind} details={live.reason_details} history={kindlingQ.data?.points} />}
            </Section>

            <Section title="Signals" testId="detail-signals"
              aside={<span style={{ fontSize: 12, color: 'var(--muted)' }}>dates from the weekly score history</span>}>
              {kindlingQ.error || naiveQ.error ? <Note>Needs the score history (see above).</Note>
                : !kindlingQ.data || !naiveQ.data ? <SectionSkeleton height={60} />
                : <Signals kind={kind} threshold={threshold} kindling={kindlingQ.data.points} naive={naiveQ.data.points} />}
            </Section>
          </div>
        </div>

        {/* Actions. "Send" POSTs to /notify/slack: only a person clicks it. */}
        <footer style={{ display: 'flex', gap: 8, padding: '12px 24px', borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
          <button
            onClick={slackState === 'idle' || slackState === 'error' ? handleSlack : undefined}
            disabled={slackState === 'sending' || slackState === 'sent' || !live}
            title={!live ? 'No live score at this date' : undefined}
            style={{
              flex: 1, height: 40,
              background: slackState === 'sent' ? 'var(--steady)' : slackState === 'error' ? 'var(--risk)' : 'var(--ink)',
              color: 'var(--paper)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'Inter',
              cursor: slackState === 'sending' || slackState === 'sent' || !live ? 'default' : 'pointer',
              opacity: live ? 1 : 0.4,
            }}
          >
            {slackState === 'sent' && `✓ Sent to ${channelLabel}`}
            {slackState === 'sending' && 'Sending…'}
            {slackState === 'error' && 'Failed. Click to retry'}
            {slackState === 'idle' && `Send to ${channelLabel}`}
          </button>
          <button
            onClick={() => setContacted(v => !v)}
            aria-pressed={contacted}
            style={{
              flex: 1, height: 40, background: 'transparent',
              color: contacted ? 'var(--steady)' : 'var(--ink)',
              border: `1px solid ${contacted ? 'var(--steady)' : 'var(--line)'}`,
              borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter',
            }}
          >
            {contacted ? '✓ Marked contacted' : 'Mark contacted'}
          </button>
        </footer>
      </aside>
    </>
  );
}
